/* 运筹学模块(从「运筹学学习站」并入,按 Ultimate 的样式与交互重做)。
   由 app.js 的 loadOR 首次进入 #/or… 时加载:vendor/marked → or/or-data.js(window.ORC,构建生成,勿读)→ or/or-solvers.js → 本文件。
   路由:#/or 首页 · #/or/c/<章号> 讲义 · #/or/cards 闪卡 · #/or/tools/<计算器> · #/or/ai/<场景> AI 助教(每章一个对话,共用 Key 和额度)
   记录存 localStorage ult.or.v1(已学完、阅读位置、闪卡、计算器输入、模拟卷计时),并入导出/导入备份。 */
(function () {
  'use strict';
  const C = window.ORC || { chapters: [], flashcards: [], videos: {} };
  const SV = window.ORSolvers;
  const OK = 'ult.or.v1';
  const st = Object.assign({ done: [], pos: {}, fc: {}, cardFilter: 'all', inputs: {}, timer: {}, last: null }, load(OK, {}));
  const saveOR = () => store(OK, st);
  window.orState = () => st;
  // 计算器代码沿用原站,它用 S.get / S.set 存输入,这里接到 st.inputs
  const S = { get: (k, d) => (k in st.inputs ? st.inputs[k] : d), set: (k, v) => { st.inputs[k] = v; saveOR(); }, del: k => { delete st.inputs[k]; saveOR(); } };
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const DAY_MS = 86400000, INTERVAL = [0, 1, 3, 7, 14, 30, 60];
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

  /* ── 章节:文件编号 no 是固定 ID(进度、闪卡、对话都按它存);阅读顺序和显示编号按西安工业大学 IE(MEM)复试大纲排 ── */
  const ORDER = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '16', '15', '10', '09', '11', '12', '13', '14'];
  const TAG = { '07': '选考', '10': '决策论选考', '09': '一般不考' };
  const isCore = no => { const n = +no; return (n >= 1 && n <= 10 && n !== 9) || n === 15 || n === 16; };
  const DISP = {}; let dk = 0;
  ORDER.forEach(no => { if (isCore(no) || no === '09') DISP[no] = String(++dk).padStart(2, '0'); });
  const relink = s => s.replace(/第 *(\d\d) *章/g, (m, x) => DISP[x] ? '第 ' + DISP[x] + ' 章' : m);
  const CH = C.chapters.slice().sort((a, b) => { const i = ORDER.indexOf(a.id.slice(0, 2)), j = ORDER.indexOf(b.id.slice(0, 2)); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }).map(function (c) {
    const no = c.id.slice(0, 2), m = c.md.match(/^#\s+(.+)$/m), n = +no, body = relink(c.md.replace(/\n## 配套视频[\s\S]*?(?=\n## |$)/, '\n'));
    return { no: no, n: n, d: DISP[no] || '', core: isCore(no), tag: TAG[no] || '', title: (m ? m[1].trim() : c.id).replace(/^\d+\s*/, ''), md: body,
      group: n === 0 ? '开始' : n <= 4 ? '主干:线性规划' : no === '09' ? '选读' : isCore(no) ? '专题' : '考试冲刺',
      plain: body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '') };
  });
  const lab = c => (c.d ? c.d + ' ' : '') + c.title;
  const chOf = no => CH.find(c => c.no === no);

  /* ── Markdown + 公式:公式先抠出来交给 KaTeX,其余交给 marked;图片路径指到 or/images ── */
  function renderMath(src, display) {
    if (!window.katex) return esc(display ? '$$' + src + '$$' : '$' + src + '$');
    try { return katex.renderToString(src, { displayMode: display, throwOnError: false }); } catch (e) { return esc(src); }
  }
  function md(src) {
    const keep = [];
    let s = String(src).replace(/\\\[([\s\S]+?)\\\]/g, (_, x) => '$$' + x + '$$').replace(/\\\(([\s\S]+?)\\\)/g, (_, x) => '$' + x + '$');
    s = s.replace(/```[\s\S]*?```/g, m => { keep.push({ raw: m }); return '@@K' + (keep.length - 1) + '@@'; });
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, x) => { keep.push({ m: x, d: true }); return '@@K' + (keep.length - 1) + '@@'; });
    s = s.replace(/\$([^$\n]+?)\$/g, (_, x) => { keep.push({ m: x, d: false }); return '@@K' + (keep.length - 1) + '@@'; });
    s = s.replace(/@@K(\d+)@@/g, (m, i) => (keep[i].raw ? keep[i].raw : m));
    let h = window.marked ? marked.parse(s, { breaks: false, gfm: true }) : '<pre>' + esc(s) + '</pre>';
    h = h.replace(/@@K(\d+)@@/g, (_, i) => renderMath(keep[i].m, keep[i].d));
    h = h.replace(/<table>/g, '<div class="scroll"><table>').replace(/<\/table>/g, '</table></div>');
    return h.replace(/src="(?:\.\/)?images\//g, 'src="or/images/').replace(/<img /g, '<img loading="lazy" ');
  }
  const mdInline = s => md(s).replace(/^<p>|<\/p>\s*$/g, '');
  window.orMd = md;

  /* ── AI 场景:每章一个对话,讲义原文作为参考;快捷问题按章节生成 ── */
  function profileOf(id) {
    const key = 'or:' + id;
    if (CHAT_PROFILES[key]) return key;
    const c = chOf(id);
    const where = c ? lab(c) : id === 'cards' ? '记忆闪卡' : id === 'tools' ? '计算器' : '整门课';
    const ctx = c ? c.plain.slice(0, 9000) : '';
    CHAT_PROFILES[key] = {
      title: c ? '运筹学 · ' + c.title : '运筹学助教', back: c ? '#/or/c/' + c.no : id === 'cards' ? '#/or/cards' : id === 'tools' ? '#/or/tools' : '#/or',
      tools: false, snap: false, render: richText, ph: '问这一章,或贴解答让它批改',
      hello: c ? '这一章哪里没懂,直接问我。' : '运筹学的问题都可以问我。',
      sys: () => `你是一位耐心、严谨的运筹学助教,用简体中文回答。学生报考西安工业大学工业工程与管理(MEM),运筹学是复试科目,范围按韩伯棠《管理运筹学》:线性规划(单纯形、大 M / 两阶段、对偶、灵敏度)、运输(含转运、生产-库存)、整数规划与指派、目标规划、图与网络、网络计划(PERT/CPM)、动态规划、决策论;排队论、对策论一般不考。考试题型是选择、填空、简答和建模计算大题,不能用软件。记号:max 问题检验数 σj = cj − CB·B⁻¹·Pj,全部 ≤ 0 为最优。
要求:
1. 先给直觉,再给严格步骤;能举例就用课程里的例子。
2. 数学公式用 LaTeX:行内 $...$,独立公式 $$...$$;单纯形表、运输表用 Markdown 表格。
3. 学生要「提示」时只给思路,不直接给答案;学生要「批改」时,逐步检查,指出第一个出错的步骤和原因,并说明这一步在考试中大约扣几分。
4. 出题时给考试风格的题目,先不给答案,等学生作答。
5. 回答简洁,不要堆砌术语;对计算结果要自己验算一遍。
学生当前在看:「${where}」。${ctx ? '\n\n以下是这一章的讲义内容,回答时以它为准:\n' + ctx : ''}`,
      chips: function () {
        if (id === 'tools') return [['怎么用计算器检查作业', '我该怎样用计算器检查自己手算的单纯形表或运输表?哪些地方最容易算错?']];
        if (id === 'cards') return [['帮我出 5 道概念题', '按考试风格出 5 道运筹学概念判断题,每题后面先不要给答案。']];
        if (!c) return [['我该从哪里开始', '我是零基础,离考试还有一段时间,运筹学该按什么顺序学?每部分大概花多久?']];
        const t = c.title;
        return [['用大白话再讲一遍', `「${t}」这一章我没看懂,请换一种更简单的说法讲一遍核心思想,并举一个生活中的例子。`],
          ['出一道考试题', `按期末考试的风格,出一道「${t}」的中等难度计算题,先不要给答案,等我作答。`],
          ['批改我的解答', '', `请批改我对「${t}」这道题的解答:\n题目:\n我的解答:\n`],
          ['最容易丢分的地方', `「${t}」这一章,考试时最容易丢分的地方有哪些?各举一个错误示范和正确写法。`]];
      },
    };
    return key;
  }
  let pending = '';
  function askAI(text, id) {
    pending = text || '';
    location.hash = '#/or/ai/' + (id || (st.last && location.hash.indexOf('#/or/c/') === 0 ? st.last : location.hash.indexOf('#/or/cards') === 0 ? 'cards' : location.hash.indexOf('#/or/tools') === 0 ? 'tools' : 'all'));
  }
  function viewORAI(id) {
    viewAI(profileOf(id || 'all'));
    if (pending) { const t = pending; pending = ''; setTimeout(() => viewAI.send(t), 50); }
  }

  /* ── 首页 ── */
  function dueCount() { const now = Date.now(); return Object.values(st.fc).filter(s => s.due <= now).length; }
  function viewHome() {
    const groups = [];
    CH.forEach(c => { let g = groups.find(x => x.name === c.group); if (!g) groups.push(g = { name: c.group, list: [] }); g.list.push(c); });
    const core = CH.filter(c => c.core), doneN = core.filter(c => st.done.indexOf(c.no) >= 0).length;
    const due = dueCount(), fresh = C.flashcards.length - Object.keys(st.fc).length;
    const last = st.last && chOf(st.last);
    const qs = qcStats(), dd = (n, t) => n ? `<em>${n}</em>${t}` : '';
    $app.innerHTML = `<div class="or-page or-home">
      <a href="#/learn" class="back" id="orback">‹ 学习</a>
      <div class="or-top"><h1 class="or-h1">运筹学</h1><button class="or-sbtn" id="orsb" aria-label="搜讲义"><svg viewBox="0 0 24 24" width="20" height="20"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <div class="or-sbox" id="orsbox" hidden><input class="or-search" id="ors" type="search" placeholder="搜讲义" autocomplete="off"><div id="orsr"></div></div>
      <div class="or-prog"><span class="bar k3"><i style="width:${doneN / core.length * 100}%"></i></span><span>${doneN} / ${core.length} 章</span></div>
      <a class="or-next" href="#/or/c/${last ? last.no : '00'}"><small>${last ? '继续读' : '从这里开始'}</small><b>${esc(last ? lab(last) : '导读')}</b><i>›</i></a>
      <div class="or-tiles">
        <a href="#/or/q"><b>练题</b><span>${dd(qs.due, ' 道待复习') || '选择 · 大题'}</span></a>
        <a href="#/or/cards"><b>闪卡</b><span>${due ? dd(due, ' 张待复习') : fresh ? fresh + ' 张新卡' : '都记住了'}</span></a>
        <a href="#/or/tools"><b>计算器</b><span>逐步出表</span></a>
        <a href="#/or/ai/all"><b>问 AI</b><span>随时答疑</span></a>
      </div>
      <div class="grp-h">学习路线</div>
      <ol class="or-path">${groups.map(g => `<li class="or-stage">${esc(g.name)}</li>${g.list.map(c => {
        const p = st.pos[c.no] || 0, dn = st.done.indexOf(c.no) >= 0, cur = last && last.no === c.no;
        return `<li class="or-step${dn ? ' done' : ''}${cur ? ' cur' : ''}"><a href="#/or/c/${c.no}"><i class="nd">${dn ? '✓' : c.d ? +c.d : c.n === 0 ? '·' : '✎'}</i>
          <span><b>${esc(c.title)}</b>${c.tag ? `<em>${c.tag}</em>` : ''}${CH_DEMOS[c.no] ? '<em class="hasd">▶ 动画</em>' : ''}${!dn && p > 0.05 ? `<em>读到 ${Math.round(p * 100)}%</em>` : ''}</span></a></li>`; }).join('')}`).join('')}</ol>
      <div class="grp-h">动画演示</div>
      <div class="or-demos">${Object.keys(DEMOS).map(d => { const t = DEMOS[d].title.split(':'); return `<a href="#" data-demo="${d}"><i>▶</i><b>${esc(t[0])}</b><span>${esc(t[1] || '')}</span></a>`; }).join('')}</div>
    </div>`;
    window.scrollTo(0, 0);
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    $$('[data-demo]').forEach(a => a.onclick = ev => { ev.preventDefault(); openDemo(a.dataset.demo); });
    const inp = $('#ors'), out = $('#orsr');
    $('#orsb').onclick = () => { const bx = $('#orsbox'); bx.hidden = !bx.hidden; if (!bx.hidden) inp.focus(); };
    inp.oninput = function () {
      const q = inp.value.trim();
      if (!q) { out.innerHTML = ''; return; }
      const hits = [];
      CH.forEach(c => { let i = c.plain.indexOf(q), k = 0; while (i >= 0 && k < 3) { hits.push({ c: c, snip: c.plain.slice(Math.max(0, i - 16), i + q.length + 22).replace(/\s+/g, ' ') }); i = c.plain.indexOf(q, i + q.length); k++; } });
      out.innerHTML = `<div class="grp or-hits">${hits.slice(0, 20).map(h => `<a class="row-i" href="#/or/c/${h.c.no}" data-q="${esc(q)}"><span><b>${esc(lab(h.c))}</b><br><small class="dim">…${esc(h.snip).replace(esc(q), '<mark>' + esc(q) + '</mark>')}…</small></span></a>`).join('') || '<div class="row-i off"><span>没有找到</span></div>'}</div>`;
      $$('[data-q]', out).forEach(a => a.onclick = () => { findQ = a.dataset.q; });
    };
  }

  /* ── 讲义阅读 ── */
  let findQ = '', posTimer = null, tickH = null;
  function viewChapter(no) {
    const c = chOf(no) || CH[0];
    st.last = c.no; saveOR();
    const i = CH.indexOf(c), prev = CH[i - 1], next = CH[i + 1], exam = c.no === '12' || c.no === '13';
    const dn = st.done.indexOf(c.no) >= 0, core = c.core || c.no === '09';
    $app.innerHTML = `<div class="or-page or-read">
      <div class="or-bar"><a href="#/or" class="back" id="orback">‹ 运筹学</a><a href="#" id="orai" class="or-ask">问 AI</a></div>
      ${exam ? timerHTML(c.no) : ''}
      <div class="or-eyebrow">${c.n === 0 ? '导读' : c.d ? '第 ' + c.d + ' 章' + (c.tag ? ' · ' + c.tag : '') : '考试冲刺'}</div>
      <h1 class="or-h1">${esc(c.title)}</h1>
      <div class="or-acts">${core ? `${QB.some(q => q.ch === c.no) || GORDER.some(k => GEN[k].ch === c.no) ? `<a href="#/or/q/ch/${c.no}">练本章题</a>` : ''}<a href="#" id="mark" class="${dn ? 'on' : ''}">${dn ? '✓ 已学完' : '标记学完'}</a><a href="#" id="tocards">闪卡</a>` : ''}</div>
      ${(CH_DEMOS[c.no] || []).map(d => `<a href="#" class="or-demo" data-demo="${d}"><span class="pl">▶</span><span><b>先看动画</b><small>${esc(DEMOS[d].title)}</small></span></a>`).join('')}
      <article class="md">${md(c.md.replace(/^#\s+.+$/m, ''))}</article>
      <div class="or-foot">${prev ? `<a href="#/or/c/${prev.no}">‹ ${esc(lab(prev))}</a>` : '<span></span>'}${next ? `<a href="#/or/c/${next.no}" class="nx">${esc(lab(next))} ›</a>` : ''}</div>
    </div>`;
    $$('.md a').forEach(a => { if (/^https?:/.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener'; } });
    $('#orai').onclick = ev => { ev.preventDefault(); askAI('', c.no); };
    const mk = $('#mark'); if (mk) mk.onclick = ev => { ev.preventDefault(); const k = st.done.indexOf(c.no); if (k >= 0) st.done.splice(k, 1); else st.done.push(c.no); saveOR(); mk.classList.toggle('on', k < 0); mk.textContent = k < 0 ? '✓ 已学完' : '标记学完'; };
    const tc = $('#tocards'); if (tc) tc.onclick = ev => { ev.preventDefault(); st.cardFilter = c.no; saveOR(); location.hash = '#/or/cards'; };
    $$('[data-demo]').forEach(a => a.onclick = ev => { ev.preventDefault(); openDemo(a.dataset.demo); });
    if (exam) bindTimer(c.no);
    // 回到上次读到的位置(或搜索命中处)
    requestAnimationFrame(function () {
      if (findQ) { highlight(findQ); findQ = ''; return; }
      const p = st.pos[c.no]; window.scrollTo(0, p ? p * (document.documentElement.scrollHeight - innerHeight) : 0);
    });
  }
  function highlight(q) {
    const root = $('.md'); if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf(q) >= 0) { const e = n.parentElement; e.scrollIntoView({ block: 'center' }); e.classList.add('or-hit'); setTimeout(() => e.classList.remove('or-hit'), 2500); break; }
  }
  window.addEventListener('scroll', function () {
    if (location.hash.indexOf('#/or/c/') !== 0) return;
    clearTimeout(posTimer);
    posTimer = setTimeout(function () {
      const no = location.hash.slice(7), max = document.documentElement.scrollHeight - innerHeight;
      if (max > 0) { st.pos[no] = Math.min(1, scrollY / max); saveOR(); }
    }, 300);
  }, { passive: true });
  function timerHTML(no) {
    const t = st.timer[no];
    return `<div class="or-timer"><span>模拟考 150 分钟</span><b id="tleft">${t ? '' : '150:00'}</b><span><a href="#" id="tstart">${t ? '重新开始' : '开始计时'}</a>${t ? ' · <a href="#" id="tstop">结束</a>' : ''}</span></div>`;
  }
  function bindTimer(no) {
    clearInterval(tickH);
    const tick = function () {
      const t = st.timer[no], el = $('#tleft'); if (!el || !t) { clearInterval(tickH); return; }
      const left = Math.max(0, t + 150 * 60000 - Date.now());
      el.textContent = left ? String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left % 60000 / 1000)).padStart(2, '0') : '时间到';
      el.classList.toggle('hot', left < 15 * 60000);
      if (!left) clearInterval(tickH);
    };
    $('#tstart').onclick = ev => { ev.preventDefault(); st.timer[no] = Date.now(); saveOR(); viewChapter(no); };
    const sp = $('#tstop'); if (sp) sp.onclick = ev => { ev.preventDefault(); delete st.timer[no]; saveOR(); viewChapter(no); };
    if (st.timer[no]) { tick(); tickH = setInterval(tick, 1000); }
  }
  /* 讲义里选中一段文字 → 浮出「问 AI」 */
  const selBtn = el('button', 'or-selask', '问 AI'); selBtn.hidden = true; document.body.append(selBtn);
  let selText = '';
  document.addEventListener('selectionchange', function () {
    clearTimeout(selBtn._t);
    selBtn._t = setTimeout(function () {
      const sel = window.getSelection(), t = sel ? sel.toString().trim() : '';
      if (!t || t.length > 600 || !sel.rangeCount || !sel.anchorNode || !sel.anchorNode.parentElement || !sel.anchorNode.parentElement.closest('.or-read .md')) { selBtn.hidden = true; return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      selText = t; selBtn.hidden = false;
      selBtn.style.left = Math.min(innerWidth - 84, Math.max(8, r.left + r.width / 2 - 34)) + 'px';
      selBtn.style.top = Math.max(8, r.bottom + 10) + 'px';            // 放在选区下方,避开 iOS 自带的拷贝菜单
    }, 250);
  });
  selBtn.addEventListener('mousedown', e => e.preventDefault());
  selBtn.onclick = function () { selBtn.hidden = true; askAI(`我在读「${(chOf(st.last) || {}).title || ''}」,对这段内容不太理解:\n\n「${selText}」\n\n请用简单的话解释它是什么意思、为什么成立,最好举一个小例子。`, st.last); };

  /* ── 记忆闪卡:1/3/7/14/30/60 天间隔;忘了 10 分钟后本轮再来 ── */
  let queue = [], showA = false;
  function cardsDue(filter) {
    const all = C.flashcards.map((c, i) => Object.assign({ id: c.ch + '-' + i }, c));
    const pool = filter !== 'all' ? all.filter(c => c.ch === filter) : all, now = Date.now();
    const due = pool.filter(c => st.fc[c.id] && st.fc[c.id].due <= now), fresh = pool.filter(c => !st.fc[c.id]);
    const newToday = Object.values(st.fc).filter(s => s.first >= today0()).length;
    return due.concat(fresh.slice(0, Math.max(0, (filter !== 'all' ? 30 : 15) - newToday)));
  }
  function viewCards() {
    const f = st.cardFilter || 'all';
    if (!queue.length || queue._f !== f) { queue = cardsDue(f); queue._f = f; showA = false; }
    const learned = Object.keys(st.fc).length, mastered = Object.values(st.fc).filter(s => s.box >= 4).length;
    const chs = [...new Set(C.flashcards.map(c => c.ch))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)), card = queue[0];
    $app.innerHTML = `<div class="or-page or-cards">
      <a href="#/or" class="back" id="orback">‹ 运筹学</a>
      <h1 class="or-h1">记忆闪卡</h1>
      <section class="stats"><div><b>${queue.length}</b><span>本轮</span></div><div><b>${learned}<small>/${C.flashcards.length}</small></b><span>学过 · 牢固 ${mastered}</span></div></section>
      <div class="or-acts"><label>范围 <select id="cf">${['all'].concat(chs).map(x => `<option value="${x}"${x === f ? ' selected' : ''}>${x === 'all' ? '全部章节' : (DISP[x] ? '第 ' + DISP[x] + ' 章 ' : '') + ((chOf(x) || {}).title || '')}</option>`).join('')}</select></label></div>
      ${card ? `<div class="or-card" id="ocard"><div class="meta"><span>${DISP[card.ch] ? '第 ' + DISP[card.ch] + ' 章 · ' : ''}${esc((chOf(card.ch) || {}).title || '')}</span><span>${st.fc[card.id] ? '复习' : '新卡'}</span></div>
          <div class="q">${mdInline(card.q)}</div>${showA ? `<div class="a">${mdInline(card.a)}</div>` : '<div class="tap dim">先在心里答,再点卡片看答案</div>'}</div>
        ${showA ? `<div class="or-rate"><button data-r="0">忘了</button><button data-r="1">模糊</button><button data-r="2" class="ok">记得</button></div>` : ''}
        <div class="links"><a href="#" id="askcard">这张没懂,问 AI</a></div>`
      : `<div class="or-card done"><b>本轮完成</b><p class="dim">到期的卡明天会自动出现;也可以换个章节范围继续。</p></div>`}
    </div>`;
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    $('#cf').onchange = e => { st.cardFilter = e.target.value; saveOR(); queue = []; viewCards(); };
    const oc = $('#ocard'); if (oc && !showA) oc.onclick = () => { showA = true; viewCards(); };
    $$('.or-rate button').forEach(b => b.onclick = () => rate(card, +b.dataset.r));
    const ac = $('#askcard'); if (ac) ac.onclick = ev => { ev.preventDefault(); askAI(`这是一张复习卡:\n问:${card.q}\n答:${card.a}\n\n请帮我理解为什么是这样,并给一个具体例子。`, 'cards'); };
  }
  function rate(card, r) {
    const s = st.fc[card.id] || { box: 0, first: Date.now() };
    if (r === 0) { s.box = 1; s.due = Date.now() + 10 * 60000; queue.push(card); }
    else if (r === 1) { s.box = Math.max(1, s.box); s.due = today0() + INTERVAL[s.box] * DAY_MS; }
    else { s.box = Math.min(6, s.box + 1); s.due = today0() + INTERVAL[s.box] * DAY_MS; }
    st.fc[card.id] = s; saveOR();
    queue.shift(); showA = false; viewCards();
  }

  /* ---------- 计算器 ---------- */
  const TOOLS = [['simplex', '单纯形法'], ['transport', '运输问题'], ['assign', '指派问题'], ['queue', '排队论'], ['graph', '图解法']];
  function renderTools(tool) {
    tool = TOOLS.some((t) => t[0] === tool) ? tool : 'simplex';
    S.set('tool', tool);
    $app.innerHTML = `<div class="or-page or-tools"><a href="#/or" class="back" id="orback">‹ 运筹学</a><h1 class="or-h1">计算器</h1>
      <p class="hint" style="margin:0">先手算，再用这里核对。单纯形法用精确分数显示每一张表，可以逐格对照。</p>
      <div class="tool-tabs">${TOOLS.map(([k, l]) => `<button class="btn ${k === tool ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      <div id="tool"></div></div>`;
    $$('.tool-tabs .btn').forEach((b) => (b.onclick = () => location.replace('#/or/tools/' + b.dataset.t)));
    ({ simplex: toolSimplex, transport: toolTransport, assign: toolAssign, queue: toolQueue, graph: toolGraph })[tool]($('#tool'));
  }
  const f = (q) => SV.fmtQ(q);

  function lpSolHTML(res) {
    const { names, kind, cost, tables, status } = res;
    const N = names.length;
    const typeName = { s: '松弛', e: '剩余', a: '人工' };
    let html = `<div class="note-line">变量说明：${names.slice(res.n).map((nm, k) => `${nm} 为${typeName[kind[res.n + k]]}变量`).join('，') || '无'}。${res.sense === 'min' ? '原问题求 min，表中按 max z′ = −z 计算。' : ''}${res.rows.some((r) => r.flipped) ? '右端为负的约束已两边乘 −1。' : ''}</div>`;
    tables.forEach((t, k) => {
      html += `<div class="tab-step"><h4>第 ${k + 1} 张表　z = ${esc(String(t.z))}${res.sense === 'min' ? '（即 z′）' : ''}</h4><div class="scroll"><table class="tb">
        <tr><th colspan="3">c<sub>j</sub></th>${cost.map((c) => `<th>${esc(String(c))}</th>`).join('')}<th></th></tr>
        <tr><th>C<sub>B</sub></th><th>基</th><th>b</th>${names.map((n) => `<th>${n}</th>`).join('')}<th>θ</th></tr>
        ${t.A.map((row, i) => `<tr><td>${esc(String(cost[t.basis[i]]))}</td><td>${names[t.basis[i]]}</td><td>${f(t.b[i])}</td>${row.map((x, j) => `<td class="${i === t.leave && j === t.enter ? 'piv' : j === t.enter ? 'hl' : ''}">${f(x)}</td>`).join('')}<td>${t.theta[i] ? f(t.theta[i]) : '—'}</td></tr>`).join('')}
        <tr><th colspan="3">σ<sub>j</sub></th>${t.sig.map((s, j) => `<td class="${j === t.enter ? 'hl' : ''}">${esc(String(s))}</td>`).join('')}<td></td></tr>
      </table></div>
      <div class="note-line">${t.enter >= 0 ? (t.leave >= 0 ? `σ 最大的是 ${names[t.enter]}，入基；最小比值在 ${names[t.basis[t.leave]]} 行，出基；主元为 ${f(t.A[t.leave][t.enter])}。` : `${names[t.enter]} 的检验数为正，但这一列没有正元素：<b>无界解</b>。`) : '所有检验数 ≤ 0，达到最优。'}</div></div>`;
    });
    const xs = res.x.map((v, j) => `x${j + 1} = ${f(v)}`).join('，');
    if (status === 'optimal') html += `<div class="result">最优解：${xs}；最优值 <b>z* = ${f(res.z)}</b>。${res.multiple ? '有非基变量的检验数为 0：<b>存在无穷多最优解</b>。' : ''}${res.duals && !res.rows.some((r) => r.flipped) ? `<br>对偶最优解（影子价格）y = (${res.duals.map(f).join(', ')})。` : ''}</div>`;
    else if (status === 'unbounded') html += `<div class="result"><b>无界解</b>：目标函数可以无限改善。</div>`;
    else if (status === 'infeasible') html += `<div class="result"><b>无可行解</b>：最优表中仍有取正值的人工变量。</div>`;
    else html += `<div class="result">迭代次数过多，已停止。请检查模型。</div>`;
    return html;
  }
  function toolSimplex(el) {
    const def = S.get('t_lp', 'max 3 5\n1 0 <= 4\n0 2 <= 12\n3 2 <= 18');
    el.innerHTML = `<div class="card form">
      <label>模型（第一行目标函数，之后每行一个约束）<textarea id="lpt" rows="6" spellcheck="false">${esc(def)}</textarea></label>
      <div class="hint">例：<code>min 2 3</code> 表示 min z = 2x₁ + 3x₂；<code>1 3 >= 6</code> 表示 x₁ + 3x₂ ≥ 6。支持小数和分数（如 1/3）、<code>&lt;=</code> <code>&gt;=</code> <code>=</code>。变量默认非负。含 ≥ 或 = 时自动用大 M 法。</div>
      <div class="row"><button class="btn primary" id="lpgo">逐步求解</button>
      <button class="btn small" data-ex="max 3 5\n1 0 <= 4\n0 2 <= 12\n3 2 <= 18">例：封测厂</button>
      <button class="btn small" data-ex="min 2 3\n1 1 >= 4\n1 3 >= 6">例：大 M 法</button>
      <button class="btn small" data-ex="max 3 -1 -1\n1 -2 1 <= 11\n-4 1 2 >= 3\n-2 0 1 = 1">例：混合约束</button></div></div>
      <div class="out" id="lpout"></div>`;
    $$('[data-ex]', el).forEach((b) => (b.onclick = () => { $('#lpt').value = b.dataset.ex.replace(/\\n/g, '\n'); run(); }));
    $('#lpgo').onclick = run;
    function run() {
      const out = $('#lpout'); const txt = $('#lpt').value; S.set('t_lp', txt);
      let res;
      try { res = SV.simplex(SV.parseLP(txt)); } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; return; }
      out.innerHTML = lpSolHTML(res);
    }
    run();
  }

  function parseMatrix(t) { return t.trim().split(/\n/).map((l) => l.trim().split(/[\s,，]+/).filter(Boolean).map(Number)).filter((r) => r.length); }
  function parseList(t) { return t.trim().split(/[\s,，]+/).filter(Boolean).map(Number); }

  function trTable(R, X, hl, extra) {
    return `<div class="scroll"><table class="tb"><tr><th></th>${R.b.map((_, j) => `<th>B${j + 1}${R.dummy === 'col' && j === R.n - 1 ? '（虚）' : ''}</th>`).join('')}<th>产量</th></tr>
        ${X.map((r, i) => `<tr><th>A${i + 1}${R.dummy === 'row' && i === R.m - 1 ? '（虚）' : ''}</th>${r.map((x, j) => `<td class="${hl && hl.some((c) => c[0] === i && c[1] === j) ? 'hl' : ''}"><span class="hint">${R.C[i][j]}</span> ${x === null ? (extra ? `<span class="hint">σ=${+extra[i][j].toFixed(4)}</span>` : '') : `<b>${+x.toFixed(4)}</b>`}</td>`).join('')}<td>${R.a[i]}</td></tr>`).join('')}
        <tr><th>销量</th>${R.b.map((x) => `<td>${x}</td>`).join('')}<td></td></tr></table></div>`;
  }
  function trSolHTML(R) {
    let html = R.dummy ? `<div class="note-line">产销不平衡，已加入虚拟${R.dummy === 'col' ? '销地' : '产地'}（运价为 0）。</div>` : '';
    html += `<div class="tab-step"><h4>伏格尔法初始方案　总运费 ${+R.initialCost.toFixed(4)}</h4>${trTable(R, R.initial)}<div class="note-line">分配顺序：${R.vogel.map((v) => `${v.by}（罚数 ${v.pen}）→ (A${v.cell[0] + 1}, B${v.cell[1] + 1}) = ${+v.q.toFixed(4)}`).join('；')}${R.zeros.length ? `。退化，补 0 于 ${R.zeros.map((z) => `(A${z[0] + 1}, B${z[1] + 1})`).join('、')}` : ''}。</div></div>`;
    R.iters.forEach((it, k) => {
      html += `<div class="tab-step"><h4>第 ${k + 1} 次调整</h4>${trTable(R, it.X, it.loop, it.sig)}<div class="note-line">位势 u = (${it.u.map((x) => +x.toFixed(4)).join(', ')})，v = (${it.v.map((x) => +x.toFixed(4)).join(', ')})。(A${it.enter[0] + 1}, B${it.enter[1] + 1}) 检验数 ${+it.sigma.toFixed(4)} 最小，入基。闭回路 ${it.loop.map((c, i) => `(A${c[0] + 1},B${c[1] + 1})${it.signs[i] > 0 ? '+' : '−'}`).join(' → ')}，θ = ${+it.theta.toFixed(4)}，(A${it.leave[0] + 1}, B${it.leave[1] + 1}) 出基。总运费变为 ${+it.newCost.toFixed(4)}。</div></div>`;
    });
    if (R.final) html += `<div class="tab-step"><h4>最优方案</h4>${trTable(R, R.final.X, null, R.final.sig)}<div class="note-line">位势 u = (${R.final.u.map((x) => +x.toFixed(4)).join(', ')})，v = (${R.final.v.map((x) => +x.toFixed(4)).join(', ')})，空格检验数全部 ≥ 0。</div></div><div class="result">最小总运费 <b>${+R.final.cost.toFixed(4)}</b>。${R.multiple ? '有空格检验数为 0：<b>存在其他最优方案</b>。' : ''}</div>`;
    return html;
  }
  function toolTransport(el) {
    const d = S.get('t_tr', { c: '3 11 3 10\n1 9 2 8\n7 4 10 5', a: '7 4 9', b: '3 6 5 6' });
    el.innerHTML = `<div class="card form">
      <label>运价表（每行一个产地）<textarea id="trc" rows="4" spellcheck="false">${esc(d.c)}</textarea></label>
      <div class="grid2"><label>产量<input id="tra" value="${esc(d.a)}"></label><label>销量<input id="trb" value="${esc(d.b)}"></label></div>
      <div class="hint">用伏格尔法求初始方案，再用位势法检验、闭回路调整，直到最优。产销不平衡时自动加虚拟产地或销地。</div>
      <div class="row"><button class="btn primary" id="trgo">求解</button></div></div><div class="out" id="trout"></div>`;
    $('#trgo').onclick = run;
    function run() {
      const data = { c: $('#trc').value, a: $('#tra').value, b: $('#trb').value }; S.set('t_tr', data);
      const out = $('#trout');
      let R;
      try {
        const C = parseMatrix(data.c), a = parseList(data.a), b = parseList(data.b);
        if (C.length !== a.length || C.some((r) => r.length !== b.length)) throw new Error('运价表的行数要等于产量个数，列数要等于销量个数');
        if ([...a, ...b, ...C.flat()].some((x) => !isFinite(x))) throw new Error('有无法识别的数字');
        R = SV.transport(C, a, b);
      } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; return; }
      out.innerHTML = trSolHTML(R);
    }
    run();
  }

  function mat(M, sel) { return `<div class="scroll"><table class="tb">${M.map((r, i) => `<tr>${r.map((x, j) => `<td class="${sel && sel[i] === j ? 'piv' : ''}">${x}</td>`).join('')}</tr>`).join('')}</table></div>`; }
  function asSolHTML(M, R, mode) {
    return `${R.converted ? `<div class="tab-step"><h4>化为最小化：用最大元素减去每个元素</h4>${mat(R.converted)}</div>` : ''}
          <div class="tab-step"><h4>行约简、列约简之后</h4>${mat(R.reduced)}<div class="note-line">如果这里已经能找到 ${M.length} 个不同行、不同列的 0，就不需要画线调整。</div></div>
          <div class="tab-step"><h4>最优指派</h4>${mat(M, R.assign)}</div>
          <div class="result">${R.assign.map((j, i) => `${i + 1} → ${j + 1}`).join('，')}；${mode === 'max' ? '最大效益' : '最小费用'} <b>${R.total}</b></div>`;
  }
  function toolAssign(el) {
    const d = S.get('t_as', { m: '4 8 7 15\n7 9 17 14\n6 9 12 8\n6 7 14 6', mode: 'min' });
    el.innerHTML = `<div class="card form">
      <label>费用（或效益）矩阵，n × n<textarea id="asm" rows="5" spellcheck="false">${esc(d.m)}</textarea></label>
      <label>目标<select id="asmode"><option value="min" ${d.mode === 'min' ? 'selected' : ''}>费用最小</option><option value="max" ${d.mode === 'max' ? 'selected' : ''}>效益最大</option></select></label>
      <div class="hint">给出精确最优指派（最多 9×9），并列出行列约简后的矩阵，方便核对匈牙利法的第一步。</div>
      <div class="row"><button class="btn primary" id="asgo">求解</button></div></div><div class="out" id="asout"></div>`;
    $('#asgo').onclick = run;
    function run() {
      const data = { m: $('#asm').value, mode: $('#asmode').value }; S.set('t_as', data);
      const out = $('#asout');
      try {
        const M = parseMatrix(data.m);
        if (M.flat().some((x) => !isFinite(x))) throw new Error('有无法识别的数字');
        const R = SV.assignment(M, data.mode);
        out.innerHTML = asSolHTML(M, R, data.mode);
      } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    }
    run();
  }

  function toolQueue(el) {
    const d = S.get('t_q', { model: 'mm1', lam: 12, mu: 15, c: 3, N: 5 });
    el.innerHTML = `<div class="card form">
      <label>模型<select id="qm"><option value="mm1">M/M/1</option><option value="mm1n">M/M/1/N（容量有限）</option><option value="mmc">M/M/c（多服务台）</option></select></label>
      <div class="grid2"><label>到达率 λ（每小时）<input id="ql" type="number" step="any" value="${d.lam}"></label><label>每台服务率 μ（每小时）<input id="qu" type="number" step="any" value="${d.mu}"></label>
      <label id="qcw">服务台数 c<input id="qc" type="number" min="1" step="1" value="${d.c}"></label><label id="qnw">系统容量 N<input id="qn" type="number" min="1" step="1" value="${d.N}"></label></div>
      <div class="hint">服务时间平均 4 分钟，就是 μ = 60 ÷ 4 = 15。</div></div><div class="out" id="qout"></div>`;
    $('#qm').value = d.model;
    const upd = () => {
      const data = { model: $('#qm').value, lam: +$('#ql').value, mu: +$('#qu').value, c: Math.max(1, Math.round(+$('#qc').value)), N: Math.max(1, Math.round(+$('#qn').value)) };
      S.set('t_q', data);
      $('#qcw').hidden = data.model !== 'mmc'; $('#qnw').hidden = data.model !== 'mm1n';
      const out = $('#qout');
      try {
        const r = SV.queue(data.model, data.lam, data.mu, data.c, data.N);
        if (r.unstable) { out.innerHTML = `<div class="result">服务强度 ρ = ${r.rho.toFixed(3)} ≥ 1，<b>队伍会无限增长</b>，没有稳态。需要提高服务率或增加服务台。</div>`; return; }
        const rows = [['服务强度 ρ', r.rho, ''], ['空闲概率 P₀', r.P0, ''], r.Pwait !== undefined && data.model !== 'mm1' ? ['需要等待的概率', r.Pwait, ''] : null, r.PN !== undefined ? ['系统满、被拒绝的概率 P_N', r.PN, ''] : null, r.lamE !== undefined ? ['有效到达率 λₑ', r.lamE, '每小时'] : null,
          ['系统中平均数 L', r.L, ''], ['排队中平均数 L_q', r.Lq, ''], ['平均逗留时间 W', r.W * 60, '分钟'], ['平均等待时间 W_q', r.Wq * 60, '分钟']].filter(Boolean);
        out.innerHTML = `<div class="scroll"><table class="tb">${rows.map(([k, v, u]) => `<tr><th style="text-align:left">${k}</th><td>${(+v).toFixed(4)}</td><td>${u}</td></tr>`).join('')}</table></div>`;
      } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    $$('input,select', el).forEach((i) => i.addEventListener('input', upd));
    upd();
  }

  function toolGraph(el) {
    let LP = S.get('t_g', { sense: 'max', c: [3, 5], cons: [[1, 0, '<=', 4], [0, 2, '<=', 12], [3, 2, '<=', 18]] });
    el.innerHTML = `<div class="grid2"><div class="card form">
      <div class="cons-row"><select id="gs"><option>max</option><option>min</option></select>z =<input id="gc1">x₁+<input id="gc2">x₂</div>
      <div id="gcons" class="form"></div>
      <div class="row"><button class="btn small" id="gadd">+ 添加约束</button><button class="btn small" id="gai">让 AI 讲解这个图</button></div>
      <div class="result" id="gres" style="white-space:pre-wrap;font-family:var(--f-mono);font-size:13px"></div></div>
      <canvas class="lp" id="gcv" width="620" height="620"></canvas></div>`;
    $('#gs').value = LP.sense; $('#gc1').value = LP.c[0]; $('#gc2').value = LP.c[1];
    const list = () => {
      $('#gcons').innerHTML = LP.cons.map((r, i) => `<div class="cons-row"><input data-i="${i}" data-k="0" value="${r[0]}">x₁+<input data-i="${i}" data-k="1" value="${r[1]}">x₂<select data-i="${i}" data-k="2">${['<=', '>=', '='].map((o) => `<option ${o === r[2] ? 'selected' : ''}>${o}</option>`).join('')}</select><input data-i="${i}" data-k="3" value="${r[3]}"><button class="btn small ghost" data-del="${i}" aria-label="删除约束">×</button></div>`).join('');
      $$('#gcons [data-k]').forEach((e) => (e.oninput = e.onchange = () => { const k = +e.dataset.k; LP.cons[+e.dataset.i][k] = k === 2 ? e.value : parseFloat(e.value) || 0; upd(); }));
      $$('#gcons [data-del]').forEach((b) => (b.onclick = () => { LP.cons.splice(+b.dataset.del, 1); list(); upd(); }));
    };
    const upd = () => { LP.sense = $('#gs').value; LP.c = [parseFloat($('#gc1').value) || 0, parseFloat($('#gc2').value) || 0]; S.set('t_g', LP); solve(); };
    ['gs', 'gc1', 'gc2'].forEach((id) => ($('#' + id).oninput = $('#' + id).onchange = upd));
    $('#gadd').onclick = () => { LP.cons.push([1, 1, '<=', 10]); list(); upd(); };
    $('#gai').onclick = () => askAI(`请用图解法讲解这个线性规划：\n${LP.sense} z = ${LP.c[0]}x1 + ${LP.c[1]}x2\n${LP.cons.map((r) => `${r[0]}x1 + ${r[1]}x2 ${r[2]} ${r[3]}`).join('\n')}\nx1, x2 >= 0\n说明可行域的形状、每个顶点、最优解，以及解是否唯一。`);
    list(); upd();
    function solve() {
      const eps = 1e-7, all = [...LP.cons, [1, 0, '>=', 0], [0, 1, '>=', 0]];
      const ok = (p) => all.every(([a, b, s, r]) => { const v = a * p[0] + b * p[1]; return s === '<=' ? v <= r + eps : s === '>=' ? v >= r - eps : Math.abs(v - r) < 1e-6; });
      const V = [];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const [a1, b1, , r1] = all[i], [a2, b2, , r2] = all[j]; const d = a1 * b2 - a2 * b1; if (Math.abs(d) < eps) continue;
        const p = [(r1 * b2 - r2 * b1) / d, (a1 * r2 - a2 * r1) / d]; if (ok(p) && !V.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)) V.push(p);
      }
      const z = (p) => LP.c[0] * p[0] + LP.c[1] * p[1], sg = LP.sense === 'max' ? 1 : -1;
      let unb = false;
      for (const p of V) for (let t = 0; t <= 64 && !unb; t++) { const ang = (t / 64) * (Math.PI / 2), q = [p[0] + 1e6 * Math.cos(ang), p[1] + 1e6 * Math.sin(ang)]; if (ok(q) && sg * z(q) > sg * z(p) + 1) unb = true; }
      let best = null; V.forEach((p) => { if (!best || sg * z(p) > sg * z(best) + eps) best = p; });
      const ties = best ? V.filter((p) => Math.abs(z(p) - z(best)) < 1e-6) : [];
      const fm = (x) => String(Math.round(x * 1000) / 1000);
      $('#gres').textContent = !V.length ? '无可行解：约束互相矛盾。' : unb ? '无界解：目标可以沿可行域无限改善。' : `顶点：${V.map((p) => `(${fm(p[0])}, ${fm(p[1])})`).join(' ')}\n最优解：x₁ = ${fm(best[0])}，x₂ = ${fm(best[1])}\n最优值：z* = ${fm(z(best))}${ties.length > 1 ? '\n有多个顶点同时最优：无穷多最优解。' : ''}`;
      draw(V, unb ? null : best);
    }
    function draw(V, best) {
      const cv = $('#gcv'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, P = 46;
      const cs = getComputedStyle(document.documentElement), col = (n) => cs.getPropertyValue(n).trim();
      let m = 8; V.forEach((p) => (m = Math.max(m, p[0] * 1.25, p[1] * 1.25)));
      LP.cons.forEach(([a, b, , r]) => { if (a > 0 && r > 0) m = Math.max(m, Math.min((r / a) * 1.1, 60)); if (b > 0 && r > 0) m = Math.max(m, Math.min((r / b) * 1.1, 60)); });
      m = Math.min(Math.ceil(m), 200);
      const sx = (x) => P + (x / m) * (W - P - 16), sy = (y) => W - P - (y / m) * (W - P - 16);
      g.clearRect(0, 0, W, W); g.font = '14px ui-monospace, Menlo, monospace';
      const step = m <= 12 ? 1 : m <= 30 ? 2 : m <= 60 ? 5 : m <= 120 ? 10 : 20;
      g.lineWidth = 1;
      for (let t = 0; t <= m; t += step) {
        g.strokeStyle = col('--line'); g.beginPath(); g.moveTo(sx(t), sy(0)); g.lineTo(sx(t), sy(m)); g.moveTo(sx(0), sy(t)); g.lineTo(sx(m), sy(t)); g.stroke();
        g.fillStyle = col('--mute'); g.textAlign = 'center'; g.fillText(t, sx(t), W - P + 20); g.textAlign = 'right'; g.fillText(t, P - 8, sy(t) + 5);
      }
      if (V.length >= 3) {
        const cx = V.reduce((s, p) => s + p[0], 0) / V.length, cy = V.reduce((s, p) => s + p[1], 0) / V.length;
        const H = [...V].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
        g.fillStyle = col('--soft'); g.globalAlpha = 0.18; g.beginPath(); H.forEach((p, i) => (i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1])))); g.closePath(); g.fill(); g.globalAlpha = 1;
      }
      g.save(); g.beginPath(); g.rect(P, 0, W - P, W - P); g.clip();
      LP.cons.forEach(([a, b, , r]) => { g.strokeStyle = col('--soft'); g.lineWidth = 1.8; g.beginPath(); if (Math.abs(b) > 1e-9) { g.moveTo(sx(0), sy(r / b)); g.lineTo(sx(m), sy((r - a * m) / b)); } else if (Math.abs(a) > 1e-9) { g.moveTo(sx(r / a), sy(0)); g.lineTo(sx(r / a), sy(m)); } g.stroke(); });
      if (best) { const zz = LP.c[0] * best[0] + LP.c[1] * best[1]; g.setLineDash([7, 6]); g.strokeStyle = col('--acc'); g.lineWidth = 1.8; g.beginPath(); if (Math.abs(LP.c[1]) > 1e-9) { g.moveTo(sx(0), sy(zz / LP.c[1])); g.lineTo(sx(m), sy((zz - LP.c[0] * m) / LP.c[1])); } else { g.moveTo(sx(best[0]), sy(0)); g.lineTo(sx(best[0]), sy(m)); } g.stroke(); g.setLineDash([]); }
      g.restore();
      V.forEach((p) => { g.fillStyle = col('--soft'); g.beginPath(); g.arc(sx(p[0]), sy(p[1]), 4, 0, 7); g.fill(); });
      if (best) { g.fillStyle = col('--acc'); g.beginPath(); g.arc(sx(best[0]), sy(best[1]), 7.5, 0, 7); g.fill(); g.fillStyle = col('--ink'); g.textAlign = 'left'; const r2 = (v) => Math.round(v * 100) / 100; g.fillText(`最优 (${r2(best[0])}, ${r2(best[1])})`, Math.min(sx(best[0]) + 12, W - 170), Math.max(sy(best[1]) - 12, 18)); }
      g.fillStyle = col('--mute'); g.textAlign = 'left'; g.fillText('x₁', W - 28, W - P - 8); g.fillText('x₂', P + 8, 18);
    }
  }



  /* ───────────── 动画演示:分步播放,每步一句大白话;iOS 上左右滑动换步、按钮在拇指区、边缘返回只关演示 ───────────── */
  const qn = q => Number(q.n) / Number(q.d);                    // 计算器里的精确分数 → 小数
  const svgOpen = (w, h) => `<svg viewBox="0 0 ${w} ${h}" class="demo-svg" role="img">`;
  // 图解法与单纯形共用的封测厂模型:max z = 3x1 + 5x2;x1 ≤ 4,2x2 ≤ 12,3x1 + 2x2 ≤ 18
  const G = { W: 320, H: 320, ox: 36, oy: 292, kx: 38, ky: 27 };
  const gx = x => G.ox + x * G.kx, gy = y => G.oy - y * G.ky;
  const FEAS = [[0, 0], [4, 0], [4, 3], [2, 6], [0, 6]];
  function axes() {
    let s = '';
    for (let i = 0; i <= 7; i++) s += `<line x1="${gx(i)}" y1="${gy(0)}" x2="${gx(i)}" y2="${gy(10)}" class="dg-grid"/><text x="${gx(i)}" y="${gy(0) + 16}" class="dg-t" text-anchor="middle">${i}</text>`;
    for (let j = 0; j <= 10; j += 2) s += `<line x1="${gx(0)}" y1="${gy(j)}" x2="${gx(7)}" y2="${gy(j)}" class="dg-grid"/><text x="${gx(0) - 8}" y="${gy(j) + 4}" class="dg-t" text-anchor="end">${j}</text>`;
    return s + `<line x1="${gx(0)}" y1="${gy(0)}" x2="${gx(7.2)}" y2="${gy(0)}" class="dg-ax"/><line x1="${gx(0)}" y1="${gy(0)}" x2="${gx(0)}" y2="${gy(10.4)}" class="dg-ax"/>
      <text x="${gx(7.1)}" y="${gy(0) - 6}" class="dg-t" text-anchor="end">x₁</text><text x="${gx(0) + 6}" y="${gy(10.2)}" class="dg-t">x₂</text>`;
  }
  const poly = (pts, cls) => `<polygon points="${pts.map(p => gx(p[0]) + ',' + gy(p[1])).join(' ')}" class="${cls}"/>`;
  const seg = (a, b, cls) => `<line x1="${gx(a[0])}" y1="${gy(a[1])}" x2="${gx(b[0])}" y2="${gy(b[1])}" class="${cls}"/>`;
  const dot = (p, r, cls, label) => `<circle cx="${gx(p[0])}" cy="${gy(p[1])}" r="${r}" class="${cls}"/>${label ? `<text x="${gx(p[0]) + 8}" y="${gy(p[1]) - 8}" class="dg-lab">${label}</text>` : ''}`;
  function constraints(n) {                                     // 依次加上前 n 个约束(涂色 = 满足这个约束的一侧)
    let s = '';
    if (n >= 1) s += poly([[0, 0], [4, 0], [4, 10], [0, 10]], 'dg-half') + seg([4, 0], [4, 10], 'dg-line') + `<text x="${gx(4) + 4}" y="${gy(9.6)}" class="dg-lab">x₁ ≤ 4</text>`;
    if (n >= 2) s += poly([[0, 0], [7, 0], [7, 6], [0, 6]], 'dg-half') + seg([0, 6], [7, 6], 'dg-line') + `<text x="${gx(5.2)}" y="${gy(6) - 6}" class="dg-lab">x₂ ≤ 6</text>`;
    if (n >= 3) s += poly([[0, 0], [6, 0], [0, 9]], 'dg-half') + seg([0, 9], [6, 0], 'dg-line') + `<text x="${gx(4.5)}" y="${gy(2.6)}" class="dg-lab">3x₁+2x₂ ≤ 18</text>`;
    return s;
  }
  function profitLine(z, cls) {                                 // 3x1 + 5x2 = z 在画框里的那一段
    const pts = [[0, z / 5], [z / 3, 0], [7, (z - 21) / 5], [(z - 50) / 3, 10]].filter(p => p[0] >= -1e-9 && p[0] <= 7 + 1e-9 && p[1] >= -1e-9 && p[1] <= 10 + 1e-9);
    return pts.length >= 2 ? seg(pts[0], pts[1], cls) : '';
  }
  function demoGraph() {
    const caps = [
      '老周的封测厂要安排两种芯片的产量:产品 1 每件赚 3 千元,产品 2 每件赚 5 千元。设产量为 x₁、x₂,目标是让利润 <b>z = 3x₁ + 5x₂</b> 最大。图上每个点就是一种生产方案。',
      '设备 A 每周最多 4 小时,产品 1 每件占 1 小时:<b>x₁ ≤ 4</b>。涂色那一侧的方案都满足。',
      '设备 B:产品 2 每件占 2 小时,最多 12 小时:2x₂ ≤ 12,也就是 <b>x₂ ≤ 6</b>。',
      '设备 C 两种产品都要用:<b>3x₁ + 2x₂ ≤ 18</b>,只有这条斜线下方才行。',
      '三个条件<b>同时</b>满足的区域叫<b>可行域</b>,是个五边形。所有能执行的方案都在里面,最优方案也只能在这里挑。',
      '利润 z = 3x₁ + 5x₂ 在图上是一条斜线,线上的方案利润都一样。<b>拖动下面的滑块</b>把 z 调大,看这条线往哪走、什么时候离开可行域。',
      '线一直往右上平移,最后一个还碰着可行域的点是 <b>(2, 6)</b>:做 2 件产品 1、6 件产品 2,利润 <b>36</b> 千元。结论:<b>最优解一定出现在可行域的顶点上</b>——单纯形法就是从这里出发的。',
    ];
    let z = 15;
    return { steps: caps.length, render: function (i, stage, cap) {
      const draw = function () {
        let s = svgOpen(G.W, G.H) + axes() + constraints(Math.min(i, 3));
        if (i >= 4) s += poly(FEAS, 'dg-feas') + FEAS.map(p => dot(p, 3.5, 'dg-v')).join('');
        if (i === 5) {
          const best = Math.max(...FEAS.map(p => 3 * p[0] + 5 * p[1]));
          s += profitLine(z, z > best ? 'dg-z out' : 'dg-z');
          if (z === best) s += dot([2, 6], 7, 'dg-best', '(2, 6)');
        }
        if (i === 6) s += profitLine(36, 'dg-z') + dot([2, 6], 7, 'dg-best', '最优 (2, 6),z = 36');
        stage.firstElementChild.innerHTML = s + '</svg>';
        if (i === 5) {
          const best = 36;
          $('#dzv', stage).textContent = 'z = ' + z;
          $('#dzs', stage).textContent = z < best ? '线还穿过可行域,还能再往外推' : z === best ? '刚好只碰到一个顶点 (2, 6)——这就是最优!' : '整条线都在可行域外面了,做不到';
          $('#dzs', stage).className = z === best ? 'demo-ok' : z > best ? 'demo-bad' : 'dim';
        }
      };
      stage.innerHTML = '<div class="demo-pic"></div>' + (i === 5 ? `<div class="demo-slider"><span id="dzv"></span><input type="range" min="0" max="45" step="1" value="${z}" id="dz"><span id="dzs"></span></div>` : '');
      cap.innerHTML = caps[i];
      if (i === 5) $('#dz', stage).oninput = e => { z = +e.target.value; draw(); };
      draw();
    } };
  }
  function demoSimplex() {
    const res = SV.simplex(SV.parseLP('max 3 5\n1 0 <= 4\n0 2 <= 12\n3 2 <= 18'));
    const T = res.tables, names = res.names, meaning = { x3: '设备 A 剩余工时', x4: '设备 B 剩余工时', x5: '设备 C 剩余工时' };
    const vert = t => { const x = [0, 0]; t.basis.forEach((bj, i) => { if (bj < 2) x[bj] = qn(t.b[i]); }); return x; };
    const path = T.map(vert);
    const steps = 1 + T.length;
    return { steps: steps, render: function (i, stage, cap) {
      let s = svgOpen(G.W, G.H) + axes() + poly(FEAS, 'dg-feas') + FEAS.map(p => dot(p, 3.5, 'dg-v')).join('');
      const k = Math.min(Math.max(i - 1, 0), T.length - 1);
      for (let j = 1; j <= k; j++) s += `<line x1="${gx(path[j - 1][0])}" y1="${gy(path[j - 1][1])}" x2="${gx(path[j][0])}" y2="${gy(path[j][1])}" class="dg-path"/>`;
      if (i >= 1) s += dot(path[k], 7, 'dg-best', `(${path[k].join(', ')}) z = ${SV.fmtQ(T[k].z)}`);
      let tb = '';
      if (i >= 1) {
        const t = T[k];
        tb = `<div class="scroll"><table class="tb dtb"><tr><th>基</th><th>b</th>${names.map((n, j) => `<th class="${j === t.enter ? 'hl' : ''}">${n}</th>`).join('')}<th>θ</th></tr>
          ${t.A.map((row, r) => `<tr class="${r === t.leave ? 'lv' : ''}"><td>${names[t.basis[r]]}</td><td>${SV.fmtQ(t.b[r])}</td>${row.map((x, j) => `<td class="${r === t.leave && j === t.enter ? 'piv' : j === t.enter ? 'hl' : ''}">${SV.fmtQ(x)}</td>`).join('')}<td>${t.theta[r] ? SV.fmtQ(t.theta[r]) : '—'}</td></tr>`).join('')}
          <tr><th>σ</th><td></td>${t.sig.map((x, j) => `<td class="${j === t.enter ? 'hl' : ''}">${SV.fmtQ(x)}</td>`).join('')}<td></td></tr></table></div>`;
      }
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>${tb}`;
      if (i === 0) { cap.innerHTML = '图解法画不出 8 个变量,单纯形法换个办法:<b>从一个顶点出发,每次走到相邻的、利润更高的顶点</b>,走不动了就是最优。还是封测厂这道题,看它怎么走。下面的表格就是每一步的「单纯形表」。'; return; }
      const t = T[k], x = path[k];
      if (t.enter < 0) { cap.innerHTML = `现在在顶点 <b>(${x.join(', ')})</b>,利润 ${SV.fmtQ(t.z)}。最下面一行检验数 σ <b>全都 ≤ 0</b>:不管再增加哪个变量,利润都不会涨了——<b>这就是最优解</b>。和图解法的结果一样:(2, 6),z = 36。`; return; }
      const en = names[t.enter], lvn = names[t.basis[t.leave]];
      cap.innerHTML = `${k === 0 ? '从原点出发:什么都不生产,三台设备的工时全剩着(基变量是松弛变量 x₃、x₄、x₅)。' : `走到了顶点 <b>(${x.join(', ')})</b>,利润 ${SV.fmtQ(t.z)}。`}
        <br>① <b>谁入基?</b>看最下面的检验数 σ,<b>${en}</b> 最大(${SV.fmtQ(t.sig[t.enter])}):每多做一件它,利润涨得最多。
        <br>② <b>谁出基?</b>算比值 θ = b ÷ 这一列的正数,最小的在 <b>${lvn}</b> 那行(${SV.fmtQ(t.theta[t.leave])})——${meaning[lvn] ? meaning[lvn] + '最先用完' : lvn + ' 最先降到 0'},所以 ${lvn} 出基。
        <br>③ 以红格 <b>${SV.fmtQ(t.A[t.leave][t.enter])}</b> 为主元做一次变换,图上的点就沿可行域的边走到下一个顶点。`;
    } };
  }
  function demoDijkstra() {
    const P = { S: [28, 150], A: [112, 62], B: [112, 238], C: [208, 62], D: [208, 238], T: [292, 150] };
    const E = [['S', 'A', 4], ['S', 'B', 2], ['A', 'B', 1], ['A', 'C', 5], ['B', 'D', 7], ['C', 'D', 2], ['C', 'T', 3], ['D', 'T', 6]];
    const nodes = Object.keys(P), frames = [];
    const dist = {}, prev = {}, done = new Set();
    nodes.forEach(n => { dist[n] = Infinity; }); dist.S = 0;
    frames.push({ dist: Object.assign({}, dist), prev: Object.assign({}, prev), done: new Set(), cur: null, cap: '求从 <b>S</b> 到 <b>T</b> 的最短路。先给 S 标上 0,其他点暂时标 ∞。规则只有一条:<b>每次把「临时标号最小」的点定下来</b>,再用它去更新邻居。' });
    while (done.size < nodes.length) {
      const u = nodes.filter(n => !done.has(n)).sort((a, b) => dist[a] - dist[b])[0];
      done.add(u);
      const upd = [];
      E.forEach(([a, b, w]) => { [[a, b], [b, a]].forEach(([x, y]) => { if (x === u && !done.has(y) && dist[u] + w < dist[y]) { dist[y] = dist[u] + w; prev[y] = u; upd.push(y + ' → ' + dist[y]); } }); });
      frames.push({ dist: Object.assign({}, dist), prev: Object.assign({}, prev), done: new Set(done), cur: u,
        cap: `没定下来的点里,<b>${u}</b> 的标号最小(${dist[u]}),把它<b>定下来</b>(涂黑):从 S 到 ${u} 不可能更短了。${upd.length ? '再从 ' + u + ' 出发更新邻居:' + upd.join(',') + '。' : '它没有能更新的邻居。'}` });
    }
    const route = []; for (let v = 'T'; v; v = prev[v]) route.unshift(v);
    frames.push(Object.assign({}, frames[frames.length - 1], { cur: null, route: route, cap: `全部定完。顺着「从哪来」往回找:<b>${route.join(' → ')}</b>,总长 <b>${dist.T}</b>。注意 S→A 直接走是 4,绕 B 走 S→B→A 只要 3——这就是为什么要一步步更新,而不是看着近就走。` }));
    return { steps: frames.length, render: function (i, stage, cap) {
      const f = frames[i], onRoute = (a, b) => f.route && f.route.some((v, k) => k && ((f.route[k - 1] === a && v === b) || (f.route[k - 1] === b && v === a)));
      let s = svgOpen(320, 300);
      E.forEach(([a, b, w]) => { const tree = f.prev[b] === a || f.prev[a] === b;
        s += `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" class="dj-e${onRoute(a, b) ? ' route' : tree ? ' tree' : ''}"/><text x="${(P[a][0] + P[b][0]) / 2 + 6}" y="${(P[a][1] + P[b][1]) / 2 - 6}" class="dg-t">${w}</text>`; });
      nodes.forEach(n => { const d = f.dist[n];
        s += `<circle cx="${P[n][0]}" cy="${P[n][1]}" r="17" class="dj-n${f.done.has(n) ? ' done' : ''}${f.cur === n ? ' cur' : ''}"/><text x="${P[n][0]}" y="${P[n][1] + 5}" class="dj-l${f.done.has(n) ? ' done' : ''}" text-anchor="middle">${n}</text>
          <text x="${P[n][0]}" y="${P[n][1] + (P[n][1] > 150 ? 36 : -24)}" class="dj-d" text-anchor="middle">${d === Infinity ? '∞' : d}</text>`; });
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>`;
      cap.innerHTML = f.cap;
    } };
  }
  function demoQueue() {
    let lam = 12, mu = 15, raf = 0, last = 0, t = 0, q = [], busy = null, nextA = 0, area = 0, areaL = 0, served = 0;
    const exp = r => -Math.log(1 - Math.random()) / r, SPEED = 1 / 1.5;   // 现实 1.5 秒 = 模拟 1 小时,一分钟左右实测就接近理论值
    const reset = () => { t = 0; q = []; busy = null; nextA = exp(lam); area = 0; areaL = 0; served = 0; };
    const caps = [
      '银行只有一个窗口。顾客平均每小时来 <b>λ = 12</b> 个,窗口每小时能办 <b>μ = 15</b> 个。服务能力比来客多 25%,应该不怎么排队吧?看左边的队伍和下面的实测数字。',
      '理论上的平均排队人数 <b>L<sub>q</sub> = ρ²/(1−ρ) = 3.2</b>(ρ = λ/μ = 0.8)。顾客是<b>随机</b>来的,有时一下来好几个,队就排起来了——比直觉多得多。',
      '把 λ 调到 <b>14</b>:ρ = 0.93,理论 L<sub>q</sub> ≈ 12.6。只多来了 2 个人,队伍却长了将近 4 倍!<b>服务强度 ρ 越接近 1,队伍涨得越快</b>——这是排队论最重要的一句话。',
      '自己拖两个滑块试试。λ ≥ μ(ρ ≥ 1)时队伍会无限变长,公式也不成立了。考试常问的 L、L<sub>q</sub>、W、W<sub>q</sub>,在「计算器 → 排队论」里能直接算。',
    ];
    function frame(ts) {
      const dt = last ? Math.min(0.1, (ts - last) / 1000) * SPEED : 0; last = ts;
      let left = dt;
      while (left > 0) {
        const tNext = Math.min(nextA, busy ? busy.end : Infinity), step = Math.min(left, tNext - t);
        area += q.length * step; areaL += (q.length + (busy ? 1 : 0)) * step; t += step; left -= step;
        if (Math.abs(t - nextA) < 1e-9 || t >= nextA) { q.push({ born: t }); nextA = t + exp(lam); }
        if (busy && t >= busy.end) { busy = null; served++; }
        if (!busy && q.length) { q.shift(); busy = { end: t + exp(mu) }; }
        if (step <= 0) break;
      }
      paint();
      raf = requestAnimationFrame(frame);
    }
    function paint() {
      const c = $('#qcv'); if (!c) { cancelAnimationFrame(raf); return; }
      const g = c.getContext('2d'), W = c.width, H = c.height, cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
      g.clearRect(0, 0, W, H);
      const cy = 92, n = Math.floor((W - 190) / 40);
      g.fillStyle = col('--bg'); g.fillRect(W - 112, 44, 92, 96); g.strokeStyle = col('--ink'); g.lineWidth = 3; g.strokeRect(W - 112, 44, 92, 96);
      g.fillStyle = col('--soft'); g.font = '600 26px -apple-system, "PingFang SC", sans-serif'; g.textAlign = 'center'; g.fillText('窗口', W - 66, 178);
      if (busy) { g.fillStyle = col('--acc'); g.beginPath(); g.arc(W - 66, cy, 22, 0, 7); g.fill(); }
      g.fillText('排队', (W - 150) / 2, 178);
      q.slice(0, n).forEach((_, k) => { g.fillStyle = col('--ink'); g.beginPath(); g.arc(W - 150 - k * 40, cy, 16, 0, 7); g.fill(); });
      if (q.length > n) { g.fillStyle = col('--acc'); g.textAlign = 'left'; g.fillText('+' + (q.length - n), 8, cy + 9); }
      const rho = lam / mu, th = rho < 1 ? (rho * rho / (1 - rho)).toFixed(2) : '∞';
      const st = $('#qst'); if (st) st.innerHTML = `ρ = ${rho.toFixed(2)} · 模拟了 ${t.toFixed(1)} 小时 · 排队 <b>${q.length}</b> 人<br>实测平均排队 L<sub>q</sub> = <b>${t > 0 ? (area / t).toFixed(2) : '—'}</b> · 理论 L<sub>q</sub> = <b>${th}</b><br><small class="dim">模拟越久,实测越接近理论值</small>`;
    }
    return { steps: caps.length, stop: () => cancelAnimationFrame(raf), render: function (i, stage, cap) {
      if (i === 2 && lam !== 14) { lam = 14; reset(); }
      if (!$('#qcv', stage)) {
        stage.innerHTML = `<div class="demo-pic"><canvas id="qcv" width="600" height="200"></canvas></div><div class="demo-st" id="qst"></div>
          <div class="demo-slider"><span>到达率 λ = <b id="ql">${lam}</b>/小时</span><input type="range" id="qlam" min="2" max="20" value="${lam}"></div>
          <div class="demo-slider"><span>服务率 μ = <b id="qm">${mu}</b>/小时</span><input type="range" id="qmu" min="5" max="20" value="${mu}"></div>`;
        $('#qlam', stage).oninput = e => { lam = +e.target.value; $('#ql').textContent = lam; reset(); };
        $('#qmu', stage).oninput = e => { mu = +e.target.value; $('#qm').textContent = mu; reset(); };
        reset(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      }
      $('#qlam', stage).value = lam; $('#ql').textContent = lam;
      cap.innerHTML = caps[i];
    } };
  }
  function demoTransport() {                                    // 讲义第 05 章的例题:3 个仓库 → 4 个客户
    const C = [[3, 11, 3, 10], [1, 9, 2, 8], [7, 4, 10, 5]], SUP = [7, 4, 9], DEM = [3, 6, 5, 6];
    const R = ['A₁', 'A₂', 'A₃'], K = ['B₁', 'B₂', 'B₃', 'B₄'], cell = (i, j) => `(${R[i]},${K[j]})`;
    const ORDER = [[1, 0], [1, 2], [0, 2], [2, 1], [2, 3], [0, 3]];        // 最小元素法依次选中的格子
    const LOOP = [[1, 3], [0, 3], [0, 2], [1, 2]];                          // 从入基格 (A₂,B₄) 出发的闭回路
    const cp = X => X.map(r => r.slice());
    const cost = X => X.reduce((s, r, i) => s + r.reduce((t, x, j) => t + (x == null ? 0 : x * C[i][j]), 0), 0);
    function pot(X) {                                           // 位势:数字格上 u + v = 运费,令 u₁ = 0
      const u = [0, null, null], v = [null, null, null, null];
      for (let k = 0; k < 6; k++) X.forEach((r, i) => r.forEach((x, j) => {
        if (x == null) return;
        if (u[i] != null && v[j] == null) v[j] = C[i][j] - u[i]; else if (v[j] != null && u[i] == null) u[i] = C[i][j] - v[j];
      }));
      return { u: u, v: v };
    }
    const frames = [];
    let X = C.map(r => r.map(() => null)); const s = SUP.slice(), d = DEM.slice();
    frames.push({ X: cp(X), s: s.slice(), d: d.slice(), cap: '三个仓库 A 的库存是 7、4、9 批,四个客户 B 要 3、6、5、6 批。格子右上角的小数字是每批的运费(千元)。怎么调货总运费最低?<b>第一步先找一个能用的方案</b>:最小元素法——<b>哪条线路最便宜,就先尽量往那儿运</b>。' });
    ORDER.forEach(([i, j], k) => {
      const q = Math.min(s[i], d[j]); X[i][j] = q; s[i] -= q; d[j] -= q;
      const gone = s[i] === 0 && d[j] === 0 ? `${R[i]} 发完、${K[j]} 也满足了` : s[i] === 0 ? `${R[i]} 发完,整行划掉` : `${K[j]} 满足,整列划掉`;
      frames.push({ X: cp(X), s: s.slice(), d: d.slice(), hit: [i, j],
        cap: k === ORDER.length - 1 ? `最后只剩 ${cell(i, j)},填 <b>${q}</b>。初始方案完成:总运费 <b>${cost(X)}</b> 千元,数字格正好 6 个(= 行数 + 列数 − 1)。`
          : `${k ? '剩下的' : '全表'}格子里运费最小的是 ${cell(i, j)} 的 <b>${C[i][j]}</b>,能运多少运多少:min(还剩 ${s[i] + q},还要 ${d[j] + q}) = <b>${q}</b>。${gone}。` });
    });
    const P1 = pot(X), X2 = cp(X);
    X2[1][3] = 1; X2[0][3] = 2; X2[0][2] = 5; X2[1][2] = null;
    const fin = { s: s.slice(), d: d.slice() };
    frames.push(Object.assign({ X: cp(X), pot: P1, cap: '方案有了,是不是最便宜?用<b>位势法</b>检验:给每行配一个 u、每列配一个 v,让<b>每个数字格</b>都满足 u + v = 运费。先令 u₁ = 0,再顺着数字格一个个解出来(右边一列和最下一行)。' }, fin));
    frames.push(Object.assign({ X: cp(X), pot: P1, sig: true, cap: '再给每个<b>空格</b>算检验数 σ = 运费 − (u + v):意思是「改走这条线路运 1 批,总运费会变多少」。(A₂,B₄) 是 <b>−1</b>——每改运 1 批能省 1 千元!有负数,就还不是最优。' }, fin));
    frames.push(Object.assign({ X: cp(X), pot: P1, sig: true, loop: true, cap: '从 (A₂,B₄) 出发,只横着、竖着走,<b>每个拐角都落在数字格上</b>,绕一圈回来——这就是<b>闭回路</b>。拐角依次标 +θ、−θ、+θ、−θ:一处多运,相邻一处就得少运,库存和需求才保持平衡。−θ 格里最小的是 <b>1</b>,所以 θ = 1。' }, fin));
    frames.push(Object.assign({ X: X2, pot: pot(X2), sig: true, cap: `按 θ = 1 调整:+θ 的格子加 1,−θ 的格子减 1,(A₂,B₃) 减到 0 离开。总运费 86 − 1 = <b>${cost(X2)}</b>。重新算检验数,<b>全都 ≥ 0</b>——最优了。(A₁,B₁) 的检验数是 0,说明还有另一个同样便宜的方案。` }, fin));
    const LW = 36, CW = 54, H0 = 26, RH = 46, SX = LW + 4 * CW, UX = SX + 40;
    return { steps: frames.length, render: function (n, stage, cap) {
      const f = frames[n], cx = j => LW + j * CW, cy = i => H0 + i * RH;
      let out = svgOpen(UX + 36, H0 + 3 * RH + 56);
      K.forEach((k, j) => { out += `<text x="${cx(j) + CW / 2}" y="18" class="tp-h" text-anchor="middle">${k}</text>`; });
      out += `<text x="${SX + 18}" y="18" class="tp-h" text-anchor="middle">库存</text>`;
      R.forEach((r, i) => {
        out += `<text x="${LW / 2}" y="${cy(i) + RH / 2 + 5}" class="tp-h" text-anchor="middle">${r}</text>`;
        K.forEach((_, j) => {
          const x = f.X[i][j], done = f.s[i] === 0 || f.d[j] === 0;
          const sg = f.sig && x == null ? C[i][j] - f.pot.u[i] - f.pot.v[j] : null;
          const hit = f.hit && f.hit[0] === i && f.hit[1] === j;
          out += `<rect x="${cx(j) + 1}" y="${cy(i) + 1}" width="${CW - 2}" height="${RH - 2}" rx="6" class="tp-c${hit ? ' hit' : sg < 0 ? ' neg' : x == null && done && !f.pot ? ' dim' : ''}"/>
            <text x="${cx(j) + CW - 6}" y="${cy(i) + 14}" class="tp-cost" text-anchor="end">${C[i][j]}</text>`;
          if (x != null) out += `<text x="${cx(j) + CW / 2}" y="${cy(i) + RH / 2 + 8}" class="tp-x" text-anchor="middle">${x}</text>`;
          else if (sg != null) out += `<text x="${cx(j) + CW / 2}" y="${cy(i) + RH / 2 + 8}" class="tp-sig${sg < 0 ? ' neg' : ''}" text-anchor="middle">σ=${sg}</text>`;
        });
        out += `<text x="${SX + 18}" y="${cy(i) + RH / 2 + 5}" class="tp-h" text-anchor="middle">${f.s[i] === 0 ? '✓' : f.s[i]}</text>`;
        if (f.pot) out += `<text x="${UX + 16}" y="${cy(i) + RH / 2 + 5}" class="tp-pv" text-anchor="middle">${f.pot.u[i]}</text>`;
      });
      const dy = cy(3) + 20;
      out += `<text x="${LW / 2}" y="${dy}" class="tp-h" text-anchor="middle">需求</text>`;
      K.forEach((_, j) => { out += `<text x="${cx(j) + CW / 2}" y="${dy}" class="tp-h" text-anchor="middle">${f.d[j] === 0 ? '✓' : f.d[j]}</text>`; });
      if (f.pot) {
        out += `<text x="${UX + 16}" y="18" class="tp-pv" text-anchor="middle">u</text><text x="${LW / 2}" y="${dy + 26}" class="tp-pv" text-anchor="middle">v</text>`;
        K.forEach((_, j) => { out += `<text x="${cx(j) + CW / 2}" y="${dy + 26}" class="tp-pv" text-anchor="middle">${f.pot.v[j]}</text>`; });
      }
      if (f.loop) {
        const ctr = ([i, j]) => [cx(j) + CW / 2, cy(i) + RH / 2];
        out += `<polygon points="${LOOP.map(p => ctr(p).join(',')).join(' ')}" class="tp-loop"/>`;
        LOOP.forEach((p, k) => { out += `<text x="${cx(p[1]) + 5}" y="${cy(p[0]) + 14}" class="tp-th">${k % 2 ? '−θ' : '+θ'}</text>`; });
      }
      stage.innerHTML = `<div class="demo-pic">${out}</svg></div>`;
      cap.innerHTML = f.cap;
    } };
  }

  function demoBnB() {                                          // 讲义第 06 章:max 5x₁ + 8x₂,x₁ + x₂ ≤ 6,5x₁ + 9x₂ ≤ 45,整数
    const ox = 30, oy = 212, k = 32, bx = x => ox + x * k, by = y => oy - y * k;
    const FR = [[0, 0], [6, 0], [2.25, 3.75], [0, 5]];
    function clip(P, a, b, c) {                                 // 多边形只保留 a·x₁ + b·x₂ ≤ c 的部分
      const out = [], g = p => a * p[0] + b * p[1] - c;
      P.forEach((p, i) => { const q = P[(i + 1) % P.length], gp = g(p), gq = g(q);
        if (gp <= 1e-9) out.push(p);
        if ((gp < -1e-9 && gq > 1e-9) || (gp > 1e-9 && gq < -1e-9)) { const t = gp / (gp - gq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } });
      return out;
    }
    const U3 = [0, 1, 3], L4 = [0, -1, -4], G2 = [-1, 0, -2], X1 = [1, 0, 1], U4 = [0, 1, 4], L5 = [0, -1, -5];
    const N = [
      { at: [170, 22], cons: [], sol: [2.25, 3.75], z: 41.25 },
      { par: 0, at: [290, 84], lab: 'x₂≤3', cons: [U3], sol: [3, 3], z: 39, kind: 'int' },
      { par: 0, at: [110, 84], lab: 'x₂≥4', cons: [L4], sol: [1.8, 4], z: 41 },
      { par: 2, at: [44, 146], lab: 'x₁≥2', cons: [L4, G2], kind: 'none' },
      { par: 2, at: [176, 146], lab: 'x₁≤1', cons: [L4, X1], sol: [1, 40 / 9], z: 5 + 320 / 9 },
      { par: 4, at: [116, 208], lab: 'x₂≤4', cons: [L4, X1, U4], sol: [1, 4], z: 37, kind: 'cut' },
      { par: 4, at: [240, 208], lab: 'x₂≥5', cons: [L4, X1, L5], sol: [0, 5], z: 40, kind: 'int' },
    ];
    const reg = n => N[n].cons.reduce((P, c) => clip(P, c[0], c[1], c[2]), FR);
    const r2 = v => Math.round(v * 100) / 100;
    const F = [
      { show: 1, cur: 0, regs: [0], round: true, cap: '老板要买设备:甲每台赚 5、乙每台赚 8,机位最多 6 个、预算 45 万。先<b>不管整数</b>,解出来是 (2.25, 3.75),z = 41.25(红点)。可设备不能买 0.25 台。四舍五入成 (2, 4)?预算 46 万,<b>超了</b>(✕)。灰点是所有买得起的整数方案。' },
      { show: 1, cur: 0, regs: [1, 2], cap: '<b>分支</b>:x₂ = 3.75 不是整数,那最优整数解要么 x₂ ≤ 3,要么 x₂ ≥ 4——把中间那条不含整数点的带子<b>切掉</b>,分成两个子问题(两块红区)。一个整数点都没丢。根节点的 41.25 是<b>上界</b>:整数解不可能比它好。' },
      { show: 2, cur: 1, regs: [1], best: 1, cap: '左边那块(x₂ ≤ 3):解得 (3, 3),z = 39,<b>正好是整数</b>!记下来:目前最好的整数解是 39,叫<b>下界</b>。这一支不用再分了。' },
      { show: 3, cur: 2, regs: [2], best: 1, cap: '另一块(x₂ ≥ 4):解得 (1.8, 4),z = 41。41 > 39,这里面<b>可能还藏着更好的整数解</b>,得继续。x₁ = 1.8 不是整数,对 x₁ 分支。' },
      { show: 4, cur: 3, regs: [], best: 1, cap: '再加 x₁ ≥ 2:要 x₁ ≥ 2 又要 x₂ ≥ 4,预算至少 5×2 + 9×4 = 46 > 45,<b>无解</b>,剪掉(虚线框)。' },
      { show: 5, cur: 4, regs: [4], best: 1, cap: '加 x₁ ≤ 1:解得 (1, 4.44),z ≈ 40.56。还是比 39 大,继续对 x₂ 分支。' },
      { show: 6, cur: 5, regs: [5], best: 1, cap: '加 x₂ ≤ 4:只剩 (1, 4) 一小段,z = 37 < 39。<b>上界都不如手里的 39</b>,下面不可能更好,剪掉。这就是「定界」省下的功夫。' },
      { show: 7, cur: 6, regs: [6], best: 6, cap: '加 x₂ ≥ 5:只剩 (0, 5) 一个点,z = 40,整数,而且比 39 好——<b>下界更新为 40</b>。' },
      { show: 7, cur: null, regs: [0], best: 6, done: true, cap: '所有分支都处理完了:<b>买 5 台乙,每月 40 万</b>。它离「不管整数」的最优点很远,四舍五入根本找不到。剪枝只有三种情况:<b>无解</b>、<b>已是整数</b>、<b>上界 ≤ 当前下界</b>。' },
    ];
    return { steps: F.length, render: function (n, stage, cap) {
      const f = F[n];
      let p = svgOpen(340, 236);
      for (let i = 0; i <= 6; i++) p += `<line x1="${bx(i)}" y1="${by(0)}" x2="${bx(i)}" y2="${by(6.3)}" class="dg-grid"/><text x="${bx(i)}" y="${by(0) + 15}" class="dg-t" text-anchor="middle">${i}</text>
        <line x1="${bx(0)}" y1="${by(i)}" x2="${bx(6.6)}" y2="${by(i)}" class="dg-grid"/>${i ? `<text x="${bx(0) - 7}" y="${by(i) + 4}" class="dg-t" text-anchor="end">${i}</text>` : ''}`;
      p += `<line x1="${bx(0)}" y1="${by(6)}" x2="${bx(6)}" y2="${by(0)}" class="dg-line"/><line x1="${bx(0)}" y1="${by(5)}" x2="${bx(6.6)}" y2="${by((45 - 33) / 9)}" class="dg-line"/>`;
      p += `<polygon points="${FR.map(q => bx(q[0]) + ',' + by(q[1])).join(' ')}" class="dg-half"/>`;
      f.regs.forEach(r => { const P = reg(r); if (P.length) p += `<polygon points="${P.map(q => bx(q[0]) + ',' + by(q[1])).join(' ')}" class="bb-reg"/>`; });
      const inReg = (x, y) => f.regs.some(r => N[r].cons.every(c => c[0] * x + c[1] * y <= c[2] + 1e-9));
      for (let x = 0; x <= 6; x++) for (let y = 0; y <= 6; y++) if (x + y <= 6 && 5 * x + 9 * y <= 45) p += `<circle cx="${bx(x)}" cy="${by(y)}" r="3.2" class="bb-pt${inReg(x, y) ? ' in' : ''}"/>`;
      if (f.round) p += `<text x="${bx(2)}" y="${by(4) + 5}" class="bb-x" text-anchor="middle">✕</text>`;
      const sn = f.cur != null ? N[f.cur] : f.done ? N[6] : null;
      if (sn && sn.sol) p += dotAt(bx(sn.sol[0]), by(sn.sol[1]));
      else if (f.cur == null || n < 2) p += dotAt(bx(2.25), by(3.75));
      const bst = f.best != null ? N[f.best].z : null;
      p += `<text x="254" y="40" class="bb-k">上界</text><text x="254" y="62" class="bb-v">${r2(f.cur != null && N[f.cur].z != null ? N[f.cur].z : 41.25)}</text>
        <text x="254" y="98" class="bb-k">下界(最好整数解)</text><text x="254" y="120" class="bb-v acc">${bst == null ? '—' : bst}</text>`;
      let t = svgOpen(340, 232);
      N.slice(0, f.show).forEach((nd, i) => { if (nd.par == null) return; const a = N[nd.par].at, b = nd.at;
        t += `<line x1="${a[0]}" y1="${a[1] + 17}" x2="${b[0]}" y2="${b[1] - 17}" class="bb-e"/><text x="${(a[0] + b[0]) / 2 + (b[0] > a[0] ? 6 : -6)}" y="${(a[1] + b[1]) / 2 + 4}" class="dg-lab sm" text-anchor="${b[0] > a[0] ? 'start' : 'end'}">${nd.lab}</text>`; });
      N.slice(0, f.show).forEach((nd, i) => {
        const cls = (f.best === i ? ' best' : nd.kind === 'none' || nd.kind === 'cut' ? ' cut' : '') + (f.cur === i ? ' cur' : '');
        t += `<rect x="${nd.at[0] - 38}" y="${nd.at[1] - 17}" width="76" height="34" rx="8" class="bb-n${cls}"/>`;
        if (nd.kind === 'none') t += `<text x="${nd.at[0]}" y="${nd.at[1] + 4}" class="bb-t" text-anchor="middle">无解 ✕</text>`;
        else t += `<text x="${nd.at[0]}" y="${nd.at[1] - 3}" class="bb-t${f.best === i ? ' best' : ''}" text-anchor="middle">(${r2(nd.sol[0])}, ${r2(nd.sol[1])})</text>
          <text x="${nd.at[0]}" y="${nd.at[1] + 11}" class="bb-t${f.best === i ? ' best' : ''}" text-anchor="middle">z=${r2(nd.z)}${nd.kind === 'cut' ? ' ✕' : ''}</text>`;
      });
      stage.innerHTML = `<div class="demo-pic two">${p}</svg>${t}</svg></div>`;
      cap.innerHTML = f.cap;
    } };
    function dotAt(x, y) { return `<circle cx="${x}" cy="${y}" r="7" class="dg-best"/>`; }
  }

  function demoDP() {                                           // 讲义第 07 章开头:A 经 B、C、D 到 E
    const P = { A: [22, 125], B1: [102, 62], B2: [102, 190], C1: [184, 34], C2: [184, 125], C3: [184, 216], D1: [264, 72], D2: [264, 180], E: [322, 125] };
    const E = { A: { B1: 2, B2: 4 }, B1: { C1: 7, C2: 3, C3: 4 }, B2: { C1: 3, C2: 2, C3: 4 }, C1: { D1: 1, D2: 4 }, C2: { D1: 6, D2: 3 }, C3: { D1: 3, D2: 3 }, D1: { E: 3 }, D2: { E: 4 } };
    const nm = v => v.length > 1 ? v[0] + '₀₁₂₃'[+v[1]] : v;
    const LAY = [['D1', 'D2'], ['C1', 'C2', 'C3'], ['B1', 'B2'], ['A']];
    const f = { E: 0 }, nx = {}, frames = [];
    const GREEDY = ['A', 'B1', 'C2', 'D2', 'E'];
    frames.push({ f: {}, nx: {}, greedy: true, cap: '从 A 走到 E,要依次经过 B、C、D 三站,线上的数字是距离。<b>贪心</b>的走法是每一步都挑最近的:A→B₁(2)→C₂(3)→D₂(3)→E(4),总长 <b>12</b>(虚线)。能不能更短?' });
    const intro = ['动态规划反过来想:<b>从终点往回算</b>。记 f(X) = 从 X 走到 E 的最短距离。最后一站最简单:', '再往前一站。站在 C 的每个点上,下一步去哪个 D 都行,而 D 以后怎么走<b>已经算好了</b>,直接拿来加:', '同样算 B 这一站,每个点只记住「从这儿出发的最好结果」(加粗的线就是它选的下一步):', '最后回到起点:'];
    LAY.forEach((lay, li) => {
      const eq = lay.map(v => { const ops = Object.keys(E[v]).map(w => ({ w: w, s: E[v][w] + f[w], txt: E[v][w] + '+' + f[w] }));
        const best = ops.reduce((a, b) => (b.s < a.s ? b : a)); f[v] = best.s; nx[v] = best.w;
        return ops.length > 1 ? `f(${nm(v)}) = min{${ops.map(o => o.txt).join(', ')}} = <b>${best.s}</b>` : `f(${nm(v)}) = <b>${best.s}</b>`; });
      frames.push({ f: Object.assign({}, f), nx: Object.assign({}, nx), cur: lay, cap: intro[li] + '<br>' + eq.join('<br>') });
    });
    const route = ['A']; while (route[route.length - 1] !== 'E') route.push(nx[route[route.length - 1]]);
    frames.push({ f: Object.assign({}, f), nx: Object.assign({}, nx), route: route, cap: `f(A) = 11。顺着加粗的线从 A 走:<b>${route.map(nm).join('→')}</b>,总长 11,比贪心少 1。第一步故意走了远一点的 B₂(4 > 2),后面反而省得多。<br>这就是<b>最优性原理</b>:最优路线的后半段,本身也是最优的。讲义里「5 台设备分给 3 个车间」是同一个套路,只是把「点」换成「还剩几台设备」。` });
    return { steps: frames.length, render: function (n, stage, cap) {
      const fr = frames[n], on = (path, a, b) => path && path.some((v, k) => k && path[k - 1] === a && v === b);
      let s = svgOpen(344, 252);
      Object.keys(E).forEach(a => Object.keys(E[a]).forEach(b => {
        const t = a === 'A' || b === 'E' ? 0.5 : 0.3, x = P[a][0] + (P[b][0] - P[a][0]) * t, y = P[a][1] + (P[b][1] - P[a][1]) * t;
        const cls = on(fr.route, a, b) ? ' route' : fr.nx[a] === b ? ' tree' : '';
        s += `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" class="dj-e${cls}"/>`;
        if (fr.greedy && on(GREEDY, a, b)) s += `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" class="dp-greedy"/>`;
        s += `<text x="${x}" y="${y - 3}" class="dg-lab sm" text-anchor="middle">${E[a][b]}</text>`;
      }));
      Object.keys(P).forEach(v => { const done = fr.f[v] != null, cur = fr.cur && fr.cur.indexOf(v) >= 0;
        s += `<circle cx="${P[v][0]}" cy="${P[v][1]}" r="16" class="dj-n${done ? ' done' : ''}${cur ? ' cur' : ''}"/><text x="${P[v][0]}" y="${P[v][1] + 5}" class="dj-l${done ? ' done' : ''}" text-anchor="middle">${nm(v)}</text>`;
        if (done && v !== 'E') s += `<text x="${P[v][0]}" y="${P[v][1] + (P[v][1] >= 125 ? 34 : -23)}" class="dj-d" text-anchor="middle">${fr.f[v]}</text>`; });
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>`;
      cap.innerHTML = fr.cap;
    } };
  }

  function demoDTree() {                                        // 讲义第 10 章:扩产三方案
    const ACT = [['大规模', [200, 50, -120]], ['中等', [120, 80, -30]], ['小规模', [60, 40, 10]]], PR = [0.3, 0.5, 0.2], ST = ['高', '中', '低'];
    const EV = ACT.map(a => Math.round(a[1].reduce((s, v, k) => s + v * PR[k], 0) * 10) / 10);
    const D = [22, 150], CY = [52, 150, 248], CX = 132, LX = 258;
    const caps = [
      '董事会要定明年扩产多大。需求高、中、低的概率是 0.3、0.5、0.2,右边是每种情况的年收益(万元)。<b>方框</b>是你做选择的地方,<b>圆圈</b>是「看天意」的地方。决策树<b>从右往左</b>算。',
      `先算圆圈:圆圈的值 = 各种结果按概率加权平均(期望值)。大规模:0.3×200 + 0.5×50 + 0.2×(−120) = <b>${EV[0]}</b>。`,
      `同样,中等:0.3×120 + 0.5×80 + 0.2×(−30) = <b>${EV[1]}</b>;小规模:0.3×60 + 0.5×40 + 0.2×10 = <b>${EV[2]}</b>。`,
      `再算方框:方框是你自己选,当然选<b>最大的</b> ${Math.max(...EV)}——<b>中等扩产</b>。没选的两支画上「∥」剪掉。大规模好的时候赚得多,但亏起来也狠,平均下来不如中等。`,
      '如果有人能<b>提前告诉你</b>明年需求:高时选大(200),中时选中(80),低时选小(10),标红的三个数。期望 = 0.3×200 + 0.5×80 + 0.2×10 = <b>102</b>,比 70 多 <b>32</b> 万——这就是<b>完全信息价值 EVPI</b>:任何预测、调研最多只值这么多钱。',
      '再进一步:花 <b>8 万</b>请咨询公司调研,结论「看好 / 不看好」不一定准。用贝叶斯公式修正概率后:看好时选大规模,期望 113.9;不看好时选中等,期望 44.5。调研这一支 = 0.51×113.9 + 0.49×44.5 ≈ <b>79.9</b>,扣掉 8 万是 71.9 > 70,<b>值得调研</b>。多级决策只能这样画树,从右往左一层层算。',
    ];
    const BEST = [0, 1, 2];                                     // 完全信息时各需求下的最优方案:高→大,中→中,低→小
    return { steps: caps.length, render: function (n, stage, cap) {
      let s;
      if (n < 5) {
        s = svgOpen(340, 300);
        const pick = EV.indexOf(Math.max(...EV));
        ACT.forEach(([name, pay], a) => {
          const cut = n >= 3 && a !== pick, y = CY[a];
          s += `<path d="M${D[0] + 11} ${D[1]} L${CX - 14} ${y}" class="dt-e${cut ? ' cut' : ''}"/><text x="${(D[0] + CX) / 2 + 4}" y="${(D[1] + y) / 2 - 6}" class="dg-lab sm" text-anchor="middle">${name}</text>`;
          if (cut) { const mx = (D[0] + CX) / 2 + 14, my = D[1] + (y - D[1]) * ((mx - D[0]) / (CX - D[0])); s += `<text x="${mx}" y="${my + 5}" class="dt-cut" text-anchor="middle">∥</text>`; }
          pay.forEach((v, k) => { const ly = y + (k - 1) * 30;
            s += `<path d="M${CX + 14} ${y} L${LX - 54} ${ly}" class="dt-e${cut ? ' cut' : ''}"/><text x="${LX - 8}" y="${ly + 4}" class="dt-l" text-anchor="end">${ST[k]} ${PR[k]}</text>
              <text x="${LX}" y="${ly + 5}" class="dt-pay${n === 4 && BEST[k] === a ? ' hl' : ''}">${v}</text>`; });
          s += `<circle cx="${CX}" cy="${y}" r="13" class="dt-ci"/>`;
          if (n >= 2 || (n === 1 && a === 0)) s += `<text x="${CX}" y="${y - 20}" class="dt-v" text-anchor="middle">${EV[a]}</text>`;
        });
        s += `<rect x="${D[0] - 11}" y="${D[1] - 11}" width="22" height="22" class="dt-sq"/>`;
        if (n >= 3) s += `<text x="${D[0] - 11}" y="${D[1] - 20}" class="dt-v">${n === 4 ? '70 → 102' : '70'}</text>`;
      } else {
        s = svgOpen(340, 250);
        const R0 = [22, 130], CH = [120, 82], NO = [120, 212], G = [208, 40], B = [208, 124];
        s += `<path d="M${R0[0] + 11} ${R0[1]} L${CH[0] - 13} ${CH[1]}" class="dt-e"/><text x="${(R0[0] + CH[0]) / 2 - 2}" y="${(R0[1] + CH[1]) / 2 - 8}" class="dg-lab sm" text-anchor="middle">调研 −8</text>
          <path d="M${R0[0] + 11} ${R0[1]} L${NO[0] - 6} ${NO[1]}" class="dt-e cut"/><text x="${(R0[0] + NO[0]) / 2 - 2}" y="${(R0[1] + NO[1]) / 2 + 20}" class="dg-lab sm" text-anchor="middle">不调研</text>
          <text x="${(R0[0] + NO[0]) / 2 + 12}" y="${(R0[1] + NO[1]) / 2 + 6}" class="dt-cut" text-anchor="middle">∥</text>
          <text x="${NO[0]}" y="${NO[1] + 5}" class="dt-pay">按上一页:70</text>
          <path d="M${CH[0] + 13} ${CH[1]} L${G[0] - 11} ${G[1]}" class="dt-e"/><text x="${(CH[0] + G[0]) / 2}" y="${(CH[1] + G[1]) / 2 - 8}" class="dt-l" text-anchor="middle">看好 0.51</text>
          <path d="M${CH[0] + 13} ${CH[1]} L${B[0] - 11} ${B[1]}" class="dt-e"/><text x="${(CH[0] + B[0]) / 2}" y="${(CH[1] + B[1]) / 2 + 20}" class="dt-l" text-anchor="middle">不看好 0.49</text>
          <circle cx="${CH[0]}" cy="${CH[1]}" r="13" class="dt-ci"/><text x="${CH[0]}" y="${CH[1] - 20}" class="dt-v" text-anchor="middle">79.9</text>
          <rect x="${G[0] - 10}" y="${G[1] - 10}" width="20" height="20" class="dt-sq"/><text x="${G[0] + 18}" y="${G[1] + 5}" class="dt-pay">选大规模 <tspan class="dt-v">113.9</tspan></text>
          <rect x="${B[0] - 10}" y="${B[1] - 10}" width="20" height="20" class="dt-sq"/><text x="${B[0] + 18}" y="${B[1] + 5}" class="dt-pay">选中等 <tspan class="dt-v">44.5</tspan></text>
          <rect x="${R0[0] - 11}" y="${R0[1] - 11}" width="22" height="22" class="dt-sq"/><text x="${R0[0] + 2}" y="${R0[1] + 34}" class="dt-v" text-anchor="middle">71.9</text>`;
      }
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>`;
      cap.innerHTML = caps[n];
    } };
  }
  function demoCPM() {                                          // 第 16 章:新产线 8 项工作的双代号网络图
    const N = { 1: [18, 130], 2: [76, 130], 3: [138, 46], 4: [198, 130], 6: [138, 214], 5: [258, 130], 7: [310, 130], 8: [354, 130] };
    const A0 = [['A', 1, 2, 3], ['B', 2, 3, 5], ['C', 2, 4, 7], ['D', 2, 6, 4], ['虚', 3, 4, 0], ['E', 4, 5, 4], ['F', 6, 5, 3], ['G', 5, 7, 2], ['H', 7, 8, 1]];
    const ORDN = [1, 2, 3, 6, 4, 5, 7, 8];
    function times(arcs) {
      const TE = {}, TL = {};
      ORDN.forEach(j => { TE[j] = Math.max(0, ...arcs.filter(a => a[2] === j).map(a => TE[a[1]] + a[3])); });
      ORDN.slice().reverse().forEach(i => { const out = arcs.filter(a => a[1] === i); TL[i] = out.length ? Math.min(...out.map(a => TL[a[2]] - a[3])) : TE[8]; });
      return { TE: TE, TL: TL, tf: a => TL[a[2]] - TE[a[1]] - a[3] };
    }
    const T0 = times(A0), A1 = A0.map(a => a[0] === 'E' ? ['E', 4, 5, 3] : a[0] === 'C' ? ['C', 2, 4, 6] : a), T1 = times(A1);
    const F = [
      { cap: '新产线拆成 8 项工作。<b>双代号网络图</b>里,每条<b>箭线</b>是一项工作(字母 + 周数),<b>圆圈</b>是「前面做完、后面能开始」的时刻。E 要等 B 和 C 都做完,所以 B 先到 ③,再用一条<b>虚线</b>(虚工作,0 周)接到 ④。' },
      { te: [1, 2, 3, 6], cur: [2, 3, 6], cap: '<b>顺推</b>最早时间 T<sub>E</sub>(圆圈旁的黑色数字):起点是 0,沿箭线往后加。② = 0 + 3 = 3,③ = 3 + 5 = 8,⑥ = 3 + 4 = 7。' },
      { te: [1, 2, 3, 6, 4], cur: [4], hot: ['C', '虚'], cap: '④ 有两条箭线进来:C 走过来是 3 + 7 = <b>10</b>,虚工作走过来是 8 + 0 = 8。E 要等两边<b>都</b>做完,所以取<b>大</b>的:T<sub>E</sub>(④) = 10。<b>顺推取大。</b>' },
      { te: ORDN, cur: [5, 7, 8], cap: '⑤ = max{10 + 4, 7 + 3} = 14,⑦ = 16,⑧ = <b>17</b>。终点的最早时间就是<b>总工期:17 周</b>。' },
      { te: ORDN, tl: [8, 7, 5, 4, 6], cur: [4, 6], cap: '再从终点<b>逆推</b>最迟时间 T<sub>L</sub>(红色数字):⑧ 是 17,往前减。⑤ = 14,④ = 14 − 4 = 10,⑥ = 14 − 3 = 11。' },
      { te: ORDN, tl: ORDN, cur: [2], hot: ['B', 'C', 'D'], cap: '② 有三条箭线出去:B 要求 10 − 5 = 5,C 要求 10 − 7 = 3,D 要求 11 − 4 = 7。要照顾最急的那个,取<b>小</b>的:T<sub>L</sub>(②) = 3。<b>逆推取小。</b>' },
      { te: ORDN, tl: ORDN, tf: true, crit: true, cap: '每项工作的<b>总时差</b> TF = 终点 T<sub>L</sub> − 起点 T<sub>E</sub> − 工期。TF = 0 的就是<b>关键工作</b>,连起来是关键路线 <b>A → C → E → G → H</b>(红线),一天都不能拖。B 能拖 2 周,D、F 能拖 4 周。' },
      { te: ORDN, tl: ORDN, tf: true, crit: true, crash: true, cap: '客户要 15 周投产。只压<b>关键工作</b>,先压最便宜的:E 少 1 周(+1.5 万),C 少 1 周(+2 万),工期 17 → <b>15</b>,共多花 3.5 万。压 B、D、F 没用——它们不在最长的那条路上。' },
    ];
    return { steps: F.length, render: function (n, stage, cap) {
      const f = F[n], arcs = f.crash ? A1 : A0, T = f.crash ? T1 : T0;
      const isCrit = a => f.crit && T.tf(a) === 0 && a[0] !== '虚';
      let s = svgOpen(372, 262) + '<defs><marker id="cpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="cp-h"/></marker><marker id="cpc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="cp-h c"/></marker></defs>';
      arcs.forEach(a => {
        const p = N[a[1]], q = N[a[2]], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        const x1 = p[0] + ux * 15, y1 = p[1] + uy * 15, x2 = q[0] - ux * 16, y2 = q[1] - uy * 16, cr = isCrit(a), hot = f.hot && f.hot.indexOf(a[0]) >= 0;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cp-a${cr ? ' crit' : ''}${hot ? ' hot' : ''}${a[0] === '虚' ? ' dum' : ''}" marker-end="url(#${cr || hot ? 'cpc' : 'cpa'})"/>`;
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, horiz = Math.abs(dy) < 1, side = dx > 0 && dy !== 0 ? (a[1] === 2 ? -1 : 1) : 0;
        const txt = (a[0] === '虚' ? '虚' : a[0] + ' ' + a[3]) + (f.tf && a[0] !== '虚' && T.tf(a) > 0 ? ' · 差' + T.tf(a) : '');
        const chg = f.crash && (a[0] === 'E' || a[0] === 'C');
        s += horiz ? `<text x="${mx}" y="${my + 18}" class="cp-l${chg ? ' chg' : ''}" text-anchor="middle">${txt}</text>`
          : `<text x="${p[0] + dx * (side < 0 ? 0.62 : 0.4) + (side < 0 ? -8 : 8)}" y="${p[1] + dy * (side < 0 ? 0.62 : 0.4) + 4}" class="cp-l" text-anchor="${side < 0 ? 'end' : 'start'}">${txt}</text>`;
      });
      Object.keys(N).forEach(k => {
        const p = N[k], j = +k, cur = f.cur && f.cur.indexOf(j) >= 0, below = j === 6;
        const te = f.te && f.te.indexOf(j) >= 0 ? T.TE[j] : '', tl = f.tl && f.tl.indexOf(j) >= 0 ? T.TL[j] : '';
        s += `<circle cx="${p[0]}" cy="${p[1]}" r="14" class="dj-n${cur ? ' cur' : ''}"/><text x="${p[0]}" y="${p[1] + 5}" class="dj-l" text-anchor="middle">${k}</text>`;
        if (te !== '') s += `<text x="${p[0]}" y="${p[1] + (below ? 30 : -33)}" class="cp-t" text-anchor="middle">${te}</text>`;
        if (tl !== '') s += `<text x="${p[0]}" y="${p[1] + (below ? 43 : -20)}" class="cp-t cp-tl" text-anchor="middle">${tl}</text>`;
      });
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>${f.crash ? '' : ''}`;
      cap.innerHTML = f.cap;
    } };
  }

  function demoGoal() {                                         // 第 15 章:三个目标按优先级逐级缩小区域
    const ox = 30, oy = 224, kx = 42, ky = 22, X = x => ox + x * kx, Y = y => oy - y * ky;
    const pts = P => P.map(p => X(p[0]) + ',' + Y(p[1])).join(' ');
    const HARD = [[0, 0], [6, 0], [0, 9]], R1 = [[0, 5.4], [0, 9], [4, 3]], R2 = [[2 / 3, 5], [8 / 3, 5], [4, 3]];
    const F = [
      { reg: HARD, cap: '还是那两种芯片(每件赚 3 千、5 千元)。设备 C 每周最多 18 小时是<b>硬约束</b>:3x₁ + 2x₂ ≤ 18,得到灰色三角形。第 02 章的最优解 (2, 6) 利润 36 最高,可老周现在有<b>三个目标</b>,按重要性排了序。' },
      { reg: R1, line: 1, cap: '<b>P₁:利润不低于 27</b>。写成 3x₁ + 5x₂ + d₁⁻ − d₁⁺ = 27,要让「差额」d₁⁻ 最小。在利润线右上方就能做到 d₁⁻ = 0,区域缩成红色小三角形。' },
      { reg: R2, line: 2, cap: '<b>P₂:设备 B 尽量不加班</b>(正常 10 小时,2x₂ ≤ 10,即 x₂ ≤ 5),压 d₂⁺。<b>只能在上一步剩下的区域里挑</b>:砍掉 x₂ > 5 的一块。(2, 6) 被排除了——它要加班 2 小时。' },
      { reg: R2, line: 3, best: true, cap: '<b>P₃:产品 1 交够 5 件</b>(x₁ ≥ 5),压 d₃⁻。可剩下的区域里 x₁ 最多到 4。做不到,就<b>尽量靠近</b>:取点 <b>(4, 3)</b>,d₃⁻ = 1。为了 P₃ 去牺牲 P₁、P₂?不允许。' },
      { reg: R2, line: 3, best: true, done: true, cap: '满意解 <b>(4, 3)</b>:利润 27 刚好守住底线(d₁⁻ = 0),设备 B 只用 6 小时不加班(d₂⁺ = 0),产品 1 差 1 件(d₃⁻ = 1)。比 (2, 6) 少赚 9 千元,但更合老周的心意。<b>目标规划不求「最优」,求按优先级的「满意」。</b>' },
    ];
    return { steps: F.length, render: function (n, stage, cap) {
      const f = F[n];
      let s = svgOpen(320, 246);
      for (let i = 0; i <= 6; i++) s += `<line x1="${X(i)}" y1="${Y(0)}" x2="${X(i)}" y2="${Y(9.6)}" class="dg-grid"/><text x="${X(i)}" y="${Y(0) + 15}" class="dg-t" text-anchor="middle">${i}</text>`;
      for (let j = 0; j <= 9; j += 3) s += `<line x1="${X(0)}" y1="${Y(j)}" x2="${X(6.6)}" y2="${Y(j)}" class="dg-grid"/>${j ? `<text x="${X(0) - 7}" y="${Y(j) + 4}" class="dg-t" text-anchor="end">${j}</text>` : ''}`;
      s += `<polygon points="${pts(HARD)}" class="dg-half"/><line x1="${X(0)}" y1="${Y(9)}" x2="${X(6)}" y2="${Y(0)}" class="dg-line"/>`;
      if (f.reg !== HARD) s += `<polygon points="${pts(f.reg)}" class="bb-reg"/>`;
      if (f.line >= 1) s += `<line x1="${X(0)}" y1="${Y(5.4)}" x2="${X(6.5)}" y2="${Y(1.5)}" class="gp-l"/><text x="${X(5.2)}" y="${Y(2.3) - 4}" class="dg-lab sm">利润 = 27</text>`;
      if (f.line >= 2) s += `<line x1="${X(0)}" y1="${Y(5)}" x2="${X(6.6)}" y2="${Y(5)}" class="gp-l"/><text x="${X(4.4)}" y="${Y(5) - 6}" class="dg-lab sm">x₂ = 5(B 不加班)</text>`;
      if (f.line >= 3) s += `<line x1="${X(5)}" y1="${Y(0)}" x2="${X(5)}" y2="${Y(9.6)}" class="gp-l far"/><text x="${X(5) + 4}" y="${Y(8.6)}" class="dg-lab sm">x₁ = 5(订单)</text>`;
      s += `<circle cx="${X(2)}" cy="${Y(6)}" r="4.5" class="${n >= 2 ? 'gp-old out' : 'gp-old'}"/><text x="${X(2) + 8}" y="${Y(6) - 6}" class="dg-t">(2, 6)</text>`;
      if (f.best) s += `<circle cx="${X(4)}" cy="${Y(3)}" r="7" class="dg-best"/><text x="${X(4) + 10}" y="${Y(3) + 16}" class="dg-lab">(4, 3)</text>`;
      stage.innerHTML = `<div class="demo-pic">${s}</svg></div>`;
      cap.innerHTML = f.cap;
    } };
  }
  const DEMOS = {
    graph: { title: '图解法:把利润线推到最远的顶点', make: demoGraph },
    simplex: { title: '单纯形法:从一个顶点走到更好的顶点', make: demoSimplex },
    dijkstra: { title: '最短路:每次定下一个最近的点', make: demoDijkstra },
    queue: { title: '排队:为什么只多来两个人,队伍就长了好几倍', make: demoQueue },
    transport: { title: '运输问题:先找方案,再用闭回路省运费', make: demoTransport },
    bnb: { title: '分支定界:为什么四舍五入找不到整数最优', make: demoBnB },
    dp: { title: '动态规划:从终点往回算,比贪心更短', make: demoDP },
    dtree: { title: '决策树:从右往左算,圆圈求平均、方框挑最大', make: demoDTree },
    cpm: { title: '网络计划:顺推取大、逆推取小,找出关键路线', make: demoCPM },
    goal: { title: '目标规划:按优先级一级一级缩小区域', make: demoGoal },
  };
  const CH_DEMOS = { '01': ['graph'], '02': ['graph'], '03': ['simplex'], '04': ['simplex'], '05': ['transport'], '06': ['bnb'], '07': ['dp'], '08': ['dijkstra'], '09': ['queue'], '10': ['dtree'], '15': ['goal'], '16': ['cpm'] };
  function openDemo(id) {
    const D = DEMOS[id]; if (!D) return;
    const inst = D.make(), m = el('div', 'demo');
    m.innerHTML = `<div class="demo-h"><b>${esc(D.title)}</b><a href="#" class="demo-x" aria-label="关闭">✕</a></div>
      <div class="demo-body"><div class="demo-stage"></div><div class="demo-cap"></div></div>
      <div class="demo-ctl"><button class="ghost" id="dprev">‹</button><span class="demo-dots"></span><button class="go sm" id="dnext">下一步</button></div>`;
    const close = layer(m, () => { if (inst.stop) inst.stop(); document.removeEventListener('keydown', key); });
    let i = 0;
    const stage = $('.demo-stage', m), cap = $('.demo-cap', m);
    const show = function () {
      inst.render(i, stage, cap);
      $('.demo-dots', m).innerHTML = Array.from({ length: inst.steps }, (_, k) => `<i class="${k === i ? 'on' : k < i ? 'past' : ''}"></i>`).join('');
      $('#dprev', m).disabled = i === 0;
      $('#dnext', m).textContent = i === inst.steps - 1 ? '学会了' : '下一步';
      $('.demo-body', m).scrollTop = 0;
    };
    const go = d => { const n = i + d; if (n < 0) return; if (n >= inst.steps) { close(); return; } i = n; show(); };
    $('#dprev', m).onclick = () => go(-1);
    $('#dnext', m).onclick = () => go(1);
    $('.demo-x', m).onclick = ev => { ev.preventDefault(); close(); };
    const key = e => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    // 手机:在图和文字上左右滑动换步(滑块上不算)
    let sx = null;
    m.addEventListener('touchstart', e => { const t = e.touches[0]; sx = e.target.closest('input') || t.clientX < 24 ? null : { x: t.clientX, y: t.clientY }; }, { passive: true });
    m.addEventListener('touchend', e => { if (!sx) return; const t = e.changedTouches[0], dx = t.clientX - sx.x, dy = t.clientY - sx.y; sx = null; if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) go(dx < 0 ? 1 : -1); }, { passive: true });
    show();
  }
  window.orOpenDemo = openDemo;

  /* ───────────── 练题:概念选择题(按大纲每章配套)+ 计算大题(程序随机出数字,解答由求解器精确算出) ─────────────
     st.qc[题id] = {box, due, ok, bad}:概念题按 1/3/7/14/30 天回来;st.qt[题型] = {n, ok};st.qw = 做错的计算题 [{k, s}] */
  const QB = C.quiz || [];
  st.qc = st.qc || {}; st.qt = st.qt || {}; st.qw = st.qw || [];
  const QIV = [0, 1, 3, 7, 14, 30];
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const shuffle = (R, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SUBS = '₀₁₂₃₄₅₆₇₈₉', sb = n => String(n).split('').map(d => SUBS[d]).join('');
  const X = j => 'x' + sb(j + 1), Y = i => 'y' + sb(i + 1), V = i => 'v' + sb(i + 1);
  function lin(co, nm) {                                         // [2, −1, 0] → 2x₁ − x₂
    let s = '';
    co.forEach((c, j) => { if (!c) return; const a = Math.abs(c), t = (a === 1 ? '' : a) + nm(j);
      s += s ? (c < 0 ? ' − ' : ' + ') + t : (c < 0 ? '−' : '') + t; });
    return s || '0';
  }
  const tb = (head, rows, cls) => `<div class="scroll"><table class="tb${cls ? ' ' + cls : ''}"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const rnd = v => Math.round(v * 100) / 100;
  const OPS = { '<=': '≤', '>=': '≥', '=': '=' };

  function graphSVG(n, E, opt) {                                 // 无向/有向图,点放在圆上(有向图按层)
    const P = opt.pos || Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [160 + 118 * Math.cos(a), 128 + 104 * Math.sin(a)]; });
    let s = `<svg viewBox="0 0 320 256" class="demo-svg qg">${opt.dir ? '<defs><marker id="qa" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M0 0L10 5L0 10z" class="cp-h"/></marker></defs>' : ''}`;
    E.forEach(([a, b, w], k) => {
      const p = P[a], q = P[b], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, on = opt.hl && opt.hl[k];
      s += `<line x1="${p[0] + ux * 15}" y1="${p[1] + uy * 15}" x2="${q[0] - ux * 16}" y2="${q[1] - uy * 16}" class="dj-e${on ? ' route' : ''}"${opt.dir ? ' marker-end="url(#qa)"' : ''}/>
        <text x="${(p[0] + q[0]) / 2 - uy * 9}" y="${(p[1] + q[1]) / 2 + ux * 9 + 4}" class="dg-lab sm" text-anchor="middle">${w}</text>`;
    });
    P.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="14" class="dj-n"/><text x="${p[0]}" y="${p[1] + 5}" class="dj-l" text-anchor="middle">${opt.names ? opt.names[i] : V(i)}</text>`; });
    return `<div class="demo-pic">${s}</svg></div>`;
  }
  function randGraph(R, n) {                                     // 连通、每点 2–4 条边的无向图
    for (let t = 0; t < 300; t++) {
      const E = [], has = (a, b) => E.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
      const ord = [0].concat(shuffle(R, Array.from({ length: n - 1 }, (_, i) => i + 1)));
      for (let k = 1; k < n; k++) { const a = ord[ri(R, Math.max(0, k - 2), k - 1)]; E.push([Math.min(a, ord[k]), Math.max(a, ord[k]), ri(R, 1, 9)]); }
      for (let k = 0; k < n; k++) { const a = ri(R, 0, n - 1), b = ri(R, 0, n - 1); if (a !== b && !has(a, b)) E.push([Math.min(a, b), Math.max(a, b), ri(R, 1, 9)]); }
      const deg = Array(n).fill(0); E.forEach(e => { deg[e[0]]++; deg[e[1]]++; });
      if (E.length >= n + 2 && deg.every(d => d <= 4)) return E.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    }
    return null;
  }

  const GEN = {
    lp2: { ch: '02', name: '图解法', make(R) {
      for (let t = 0; t < 400; t++) {
        const c = [ri(R, 1, 6), ri(R, 1, 6)];
        const cons = [[ri(R, 1, 4), ri(R, 1, 4)], [ri(R, 1, 4), ri(R, 0, 2)], [ri(R, 0, 2), ri(R, 1, 4)]].map(([a, b]) => [a, b, ri(R, 6, 24)]);
        const L = cons.concat([[1, 0, 0], [0, 1, 0]]), Vx = [];
        const ok = p => p[0] > -1e-9 && p[1] > -1e-9 && cons.every(k => k[0] * p[0] + k[1] * p[1] <= k[2] + 1e-9);
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
          const [a1, b1, r1] = L[i], [a2, b2, r2] = L[j], det = a1 * b2 - a2 * b1; if (!det) continue;
          const p = [(r1 * b2 - r2 * b1) / det, (a1 * r2 - a2 * r1) / det];
          if (ok(p) && !Vx.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 1e-9)) Vx.push(p);
        }
        if (Vx.length < 4 || Vx.some(p => Math.abs(p[0] - Math.round(p[0])) > 1e-9 || Math.abs(p[1] - Math.round(p[1])) > 1e-9)) continue;
        if (cons.some(k => !Vx.some(p => Math.abs(k[0] * p[0] + k[1] * p[1] - k[2]) < 1e-9))) continue;    // 不要多余约束
        const cx = Vx.reduce((s, p) => s + p[0], 0) / Vx.length, cy = Vx.reduce((s, p) => s + p[1], 0) / Vx.length;
        Vx.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
        const z = Vx.map(p => c[0] * p[0] + c[1] * p[1]), best = Math.max(...z);
        if (z.filter(v => v === best).length > 1) continue;
        const bi = z.indexOf(best), bp = Vx[bi], tight = cons.filter(k => Math.abs(k[0] * bp[0] + k[1] * bp[1] - k[2]) < 1e-9);
        const m = Math.max(...Vx.map(p => Math.max(p[0], p[1]))) + 1, k = 236 / m, gx = x => 34 + x * k, gy = y => 250 - y * k;
        let svg = `<div class="demo-pic"><svg viewBox="0 0 290 270" class="demo-svg">`;
        for (let i = 0; i <= m; i++) svg += `<line x1="${gx(i)}" y1="${gy(0)}" x2="${gx(i)}" y2="${gy(m)}" class="dg-grid"/><line x1="${gx(0)}" y1="${gy(i)}" x2="${gx(m)}" y2="${gy(i)}" class="dg-grid"/><text x="${gx(i)}" y="${gy(0) + 14}" class="dg-t" text-anchor="middle">${i}</text>${i ? `<text x="${gx(0) - 6}" y="${gy(i) + 4}" class="dg-t" text-anchor="end">${i}</text>` : ''}`;
        cons.forEach(([a, b, r]) => { const pts = [[0, b ? r / b : 0], [a ? r / a : 0, 0], [m, b ? (r - a * m) / b : 0], [a ? (r - b * m) / a : 0, m]].filter(p => p[0] >= -1e-9 && p[1] >= -1e-9 && p[0] <= m + 1e-9 && p[1] <= m + 1e-9 && Math.abs(a * p[0] + b * p[1] - r) < 1e-6);
          if (pts.length >= 2) svg += `<line x1="${gx(pts[0][0])}" y1="${gy(pts[0][1])}" x2="${gx(pts[1][0])}" y2="${gy(pts[1][1])}" class="dg-line"/>`; });
        svg += `<polygon points="${Vx.map(p => gx(p[0]) + ',' + gy(p[1])).join(' ')}" class="dg-feas"/>`;
        const zl = [[0, best / c[1]], [best / c[0], 0]];
        svg += `<line x1="${gx(zl[0][0])}" y1="${gy(zl[0][1])}" x2="${gx(zl[1][0])}" y2="${gy(zl[1][1])}" class="dg-z"/>`;
        Vx.forEach(p => { svg += `<circle cx="${gx(p[0])}" cy="${gy(p[1])}" r="3.5" class="dg-v"/>`; });
        svg += `<circle cx="${gx(bp[0])}" cy="${gy(bp[1])}" r="7" class="dg-best"/></svg></div>`;
        return {
          q: `用图解法求解:<div class="qm">max z = ${lin(c, X)}<br>${cons.map(k => `${lin(k.slice(0, 2), X)} ≤ ${k[2]}`).join('<br>')}<br>x₁, x₂ ≥ 0</div>写出可行域的全部顶点、最优解和最优值。`,
          sol: `<p>依次画出三条约束直线,三个半平面与第一象限的公共部分就是可行域(红色)。顶点及目标值:</p>
            ${tb(['顶点', 'z = ' + lin(c, X)], Vx.map((p, i) => [`(${p[0]}, ${p[1]})`, i === bi ? `<b>${z[i]}</b>` : z[i]]))}
            ${svg}<p>目标函数等值线 ${lin(c, X)} = z 沿法向 (${c[0]}, ${c[1]}) 平移,z 越大越往右上。最后离开可行域的点是 <b>(${bp[0]}, ${bp[1]})</b>(虚线是 z = ${best} 的等值线)。</p>
            <p>该点处 ${tight.map(k => `${lin(k.slice(0, 2), X)} = ${k[2]}`).join('、')} 取等号(这些资源恰好用完)。</p>
            <div class="result">最优解 x₁ = ${bp[0]},x₂ = ${bp[1]},最优值 <b>z* = ${best}</b></div>` };
      }
    } },
    simplex: { ch: '03', name: '单纯形法', make(R) {
      const den = q => { const p = String(q).split('/'); return p[1] ? +p[1] : 1; };
      for (let t = 0; t < 400; t++) {
        const c = [ri(R, 1, 6), ri(R, 1, 6), ri(R, 0, 5)], A = [0, 1, 2].map(() => [ri(R, 0, 4), ri(R, 0, 4), ri(R, 0, 4)]), b = [0, 1, 2].map(() => ri(R, 4, 30));
        if (A.some(r => r.every(x => !x)) || [0, 1, 2].some(j => A.every(r => !r[j]))) continue;
        let res; try { res = SV.simplex(SV.parseLP(`max ${c.join(' ')}\n${A.map((r, i) => r.join(' ') + ' <= ' + b[i]).join('\n')}`)); } catch (e) { continue; }
        if (res.status !== 'optimal' || res.tables.length < 3 || res.tables.length > 4) continue;
        const last = res.tables[res.tables.length - 1];
        if (last.b.some(v => den(v) > 4) || den(res.z) > 4) continue;
        return { q: `用单纯形法求解:<div class="qm">max z = ${lin(c, X)}<br>${A.map((r, i) => `${lin(r, X)} ≤ ${b[i]}`).join('<br>')}<br>x₁, x₂, x₃ ≥ 0</div>写出每张单纯形表。`,
          sol: `<p>加松弛变量 x₄、x₅、x₆ 化为标准型,以它们为初始基。检验数 σⱼ = cⱼ − C<sub>B</sub>B⁻¹Pⱼ,max 问题全部 ≤ 0 为最优。</p>${lpSolHTML(res)}` };
      }
    } },
    dual: { ch: '04', name: '写对偶问题', make(R) {
      const isMax = R() < 0.6, m = 3, n = 3;
      const c = [0, 1, 2].map(() => ri(R, 1, 7) * (R() < 0.15 ? -1 : 1)), A = [0, 1, 2].map(() => [0, 1, 2].map(() => R() < 0.15 ? 0 : ri(R, -3, 5) || 1)), b = [0, 1, 2].map(() => ri(R, 2, 20));
      const ops = ['<=', '>=', '='].map(() => 0).map(() => ['<=', '>=', '='][R() < 0.45 ? 0 : R() < 0.6 ? 1 : 2]);
      const sg = [0, 1, 2].map(() => R() < 0.6 ? '>=0' : R() < 0.5 ? '<=0' : 'free');
      if (!ops.some(o => o !== (isMax ? '<=' : '>=')) && !sg.some(s => s !== '>=0')) { ops[1] = '='; sg[2] = 'free'; }
      // 规则:原问题 max → 对偶 min;约束 ≤ ↔ y ≥ 0,≥ ↔ y ≤ 0,= ↔ y 无约束;x ≥ 0 ↔ 对偶约束 ≥,x ≤ 0 ↔ ≤,x 无约束 ↔ =。原问题 min 时全部反过来。
      const ySign = ops.map(o => o === '=' ? 'free' : (o === '<=') === isMax ? '>=0' : '<=0');
      const dOp = sg.map(s => s === 'free' ? '=' : (s === '>=0') === isMax ? '>=' : '<=');
      const signTxt = (s, v) => s === 'free' ? v + ' 无符号限制' : v + (s === '>=0' ? ' ≥ 0' : ' ≤ 0');
      const AT = [0, 1, 2].map(j => A.map(r => r[j]));
      return { q: `写出下列线性规划的对偶问题:<div class="qm">${isMax ? 'max' : 'min'} z = ${lin(c, X)}<br>${A.map((r, i) => `${lin(r, X)} ${OPS[ops[i]]} ${b[i]}`).join('<br>')}<br>${sg.map((s, j) => signTxt(s, X(j))).join(',')}</div>`,
        sol: `<p>原问题求 ${isMax ? 'max' : 'min'},对偶问题求 ${isMax ? 'min' : 'max'};每个约束对应一个对偶变量 yᵢ,目标系数是原问题的右端 b,约束系数矩阵转置,右端是原问题的目标系数 c。</p>
          ${tb(['原问题', '对偶问题'], ops.map((o, i) => [`第 ${i + 1} 个约束 ${OPS[o]}`, signTxt(ySign[i], Y(i))]).concat(sg.map((s, j) => [signTxt(s, X(j)), `第 ${j + 1} 个约束 ${OPS[dOp[j]]}`])))}
          <div class="qm">${isMax ? 'min' : 'max'} w = ${lin(b, Y)}<br>${AT.map((r, j) => `${lin(r, Y)} ${OPS[dOp[j]]} ${c[j]}`).join('<br>')}<br>${ySign.map((s, i) => signTxt(s, Y(i))).join(',')}</div>
          <p class="dim">口诀(原问题求 max):约束「≤ 正常 → y ≥ 0,≥ 反常 → y ≤ 0,= → 自由」;变量「≥ 0 正常 → 对偶约束 ≥,≤ 0 → ≤,自由 → =」。原问题求 min 时,「正常」的约束是 ≥,对偶约束的方向也全部反过来。</p>` };
    } },
    transport: { ch: '05', name: '运输问题', make(R) {
      for (let t = 0; t < 300; t++) {
        const C = [0, 1, 2].map(() => [0, 1, 2, 3].map(() => ri(R, 1, 12))), unb = R() < 0.3;
        const b = [0, 1, 2, 3].map(() => ri(R, 2, 9) * 5), tot = b.reduce((s, x) => s + x, 0) + (unb ? ri(R, 1, 3) * 5 : 0);
        const a1 = ri(R, 2, Math.floor(tot / 5) - 4) * 5, a2 = ri(R, 1, Math.floor((tot - a1) / 5) - 1) * 5, a = [a1, a2, tot - a1 - a2];
        if (a.some(x => x <= 0)) continue;
        let Rs; try { Rs = SV.transport(C, a, b); } catch (e) { continue; }
        if (!Rs.final || Rs.iters.length < 1 || Rs.iters.length > 3 || Rs.zeros.length) continue;
        return { q: `某公司有 3 个产地、4 个销地,单位运价、产量和销量如下。${unb ? '<b>注意产销是否平衡。</b>' : ''}用伏格尔法求初始调运方案,再用位势法检验、闭回路法调整,求最优调运方案和最小总运费。
            ${tb(['', 'B₁', 'B₂', 'B₃', 'B₄', '产量'], C.map((r, i) => ['A' + sb(i + 1)].concat(r, [a[i]])).concat([['销量'].concat(b, [''])]))}`,
          sol: trSolHTML(Rs) };
      }
    } },
    assign: { ch: '06', name: '指派问题', make(R) {
      const mx = R() < 0.25, M = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => ri(R, 2, 15))), Rs = SV.assignment(M, mx ? 'max' : 'min');
      return { q: `4 个人完成 4 项任务,每人只做一项、每项只由一人做。${mx ? '各人完成各任务的<b>效益</b>' : '各人完成各任务的<b>时间</b>'}如下,用匈牙利法求使${mx ? '总效益最大' : '总时间最少'}的指派方案。${tb(['', '任务 1', '任务 2', '任务 3', '任务 4'], M.map((r, i) => ['甲乙丙丁'[i]].concat(r)))}`,
        sol: `${asSolHTML(M, Rs, mx ? 'max' : 'min')}<p class="dim">表中第 i 行是${'甲乙丙丁'.split('').map((p, i) => p + '=' + (i + 1)).join('、')}。若约简后找不到 4 个独立 0:用最少直线覆盖所有 0,未覆盖元素减去其中最小值、两线交叉处加上它,再试指派。</p>` };
    } },
    dp: { ch: '07', name: '动态规划·资源分配', make(R) {
      const N = R() < 0.5 ? 4 : 5, g = [0, 1, 2].map(() => { const inc = shuffle(R, Array.from({ length: N }, () => ri(R, 0, 7))).sort((x, y) => y - x); const r = [0]; inc.forEach(d => r.push(r[r.length - 1] + d)); return r; });
      const f3 = g[2].slice(), f2 = [], u2 = [], rows2 = [];
      for (let s = 0; s <= N; s++) { let best = -1, us = []; const cells = []; for (let u = 0; u <= s; u++) { const v = g[1][u] + f3[s - u]; cells.push(`${g[1][u]}+${f3[s - u]}`); if (v > best) { best = v; us = [u]; } else if (v === best) us.push(u); }
        f2[s] = best; u2[s] = us; rows2.push([s].concat(Array.from({ length: N + 1 }, (_, u) => u <= s ? (us.indexOf(u) >= 0 ? `<b>${cells[u]}</b>` : cells[u]) : ''), [best, us.join(' 或 ')])); }
      let f1 = -1, u1 = []; const c1 = [];
      for (let u = 0; u <= N; u++) { const v = g[0][u] + f2[N - u]; c1.push(v); if (v > f1) { f1 = v; u1 = [u]; } else if (v === f1) u1.push(u); }
      const plans = []; u1.forEach(a => u2[N - a].forEach(b2 => plans.push([a, b2, N - a - b2])));
      let brute = -1; for (let a = 0; a <= N; a++) for (let b2 = 0; a + b2 <= N; b2++) brute = Math.max(brute, g[0][a] + g[1][b2] + g[2][N - a - b2]);
      if (brute !== f1) return null;
      return { q: `把 ${N} 台设备分给 3 个车间,各车间分到 u 台时的新增利润(万元)如下。用动态规划求利润最大的分配方案。${tb(['u'].concat(Array.from({ length: N + 1 }, (_, i) => i)), g.map((r, k) => ['车间 ' + (k + 1)].concat(r)))}`,
        sol: `<p>阶段 k = 车间 k;状态 sₖ = 分配给第 k 至第 3 个车间的设备数;决策 uₖ = 分给车间 k 的台数;状态转移 sₖ₊₁ = sₖ − uₖ;递推 fₖ(sₖ) = max{gₖ(uₖ) + fₖ₊₁(sₖ − uₖ)},f₃(s) = g₃(s)。逆序计算:</p>
          <p><b>k = 3</b>:f₃(s) = g₃(s) = ${f3.map((v, s) => `${v}`).join('、')}(s = 0…${N})</p>
          <p><b>k = 2</b>:表中每格是 g₂(u) + f₃(s − u),加粗的是最大值</p>${tb(['s₂ \\ u₂'].concat(Array.from({ length: N + 1 }, (_, i) => i), ['f₂', 'u₂*']), rows2)}
          <p><b>k = 1</b>:s₁ = ${N},${c1.map((v, u) => `u₁=${u}:${g[0][u]}+${f2[N - u]}=${v}`).join(';')},f₁(${N}) = <b>${f1}</b>,u₁* = ${u1.join(' 或 ')}。</p>
          <div class="result">最优分配(车间 1, 2, 3):${plans.map(p => `(${p.join(', ')})`).join(' 或 ')},最大利润 <b>${f1}</b> 万元</div>` };
    } },
    dijkstra: { ch: '08', name: '最短路 Dijkstra', make(R) {
      const n = R() < 0.5 ? 6 : 7, E = randGraph(R, n); if (!E) return null;
      const d = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false), rows = []; d[0] = 0;
      for (let step = 0; step < n; step++) {
        let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
        if (d[u] === Infinity) return null;
        done[u] = true;
        E.forEach(([a, b2, w]) => [[a, b2], [b2, a]].forEach(([x, y]) => { if (x === u && !done[y] && d[u] + w < d[y]) { d[y] = d[u] + w; prev[y] = u; } }));
        rows.push([step + 1, V(u)].concat(d.map((v, i) => i === u ? `<b>${v}</b>` : done[i] ? '' : v === Infinity ? '∞' : v)));
      }
      const path = i => { const p = []; for (let v = i; v >= 0; v = prev[v]) p.unshift(V(v)); return p.join('→'); };
      const tree = E.map(([a, b2]) => prev[b2] === a || prev[a] === b2);
      return { q: `用 Dijkstra 算法求 v₁ 到其余各点的最短路(无向图,边上数字为长度):${graphSVG(n, E, {})}<p class="dim">${E.map(([a, b2, w]) => `${V(a)}${V(b2)} = ${w}`).join(',')}</p>`,
        sol: `<p>每一步在临时标号中选最小的定为永久标号(加粗),再用它更新相邻点。表中每行是这一步结束后的标号(空格 = 已是永久标号)。</p>${tb(['步', '定下'].concat(Array.from({ length: n }, (_, i) => V(i))), rows)}
          ${graphSVG(n, E, { hl: tree })}${tb(['终点', '最短路', '长度'], Array.from({ length: n - 1 }, (_, i) => [V(i + 1), path(i + 1), d[i + 1]]))}<p class="dim">红色的边组成最短路树。</p>` };
    } },
    mst: { ch: '08', name: '最小支撑树', make(R) {
      const n = R() < 0.5 ? 6 : 7, E = randGraph(R, n); if (!E) return null;
      const order = E.map((e, k) => k).sort((x, y) => E[x][2] - E[y][2] || x - y), par = Array.from({ length: n }, (_, i) => i), find = x => par[x] === x ? x : (par[x] = find(par[x]));
      const rows = [], pick = Array(E.length).fill(false); let tot = 0, cnt = 0;
      order.forEach(k => { if (cnt === n - 1) return; const [a, b2, w] = E[k], ra = find(a), rb = find(b2);
        if (ra === rb) rows.push([`${V(a)}${V(b2)}`, w, '成圈,跳过']); else { par[ra] = rb; pick[k] = true; tot += w; cnt++; rows.push([`${V(a)}${V(b2)}`, w, `<b>加入</b>(第 ${cnt} 条)`]); } });
      return { q: `用避圈法(Kruskal)求下图的最小支撑树及其总长度:${graphSVG(n, E, {})}<p class="dim">${E.map(([a, b2, w]) => `${V(a)}${V(b2)} = ${w}`).join(',')}</p>`,
        sol: `<p>把边按长度从小到大排,依次检查:不和已选的边构成圈就加入,够 ${n - 1} 条(点数 − 1)就停。</p>${tb(['边', '长度', '处理'], rows)}${graphSVG(n, E, { hl: pick })}
          <div class="result">最小支撑树(红色)总长度 <b>${tot}</b></div><p class="dim">长度相同的边先后顺序不同,得到的树可能不同,但总长度一定相同。</p>` };
    } },
    maxflow: { ch: '08', name: '最大流', make(R) {
      const nm = ['s', 'v₁', 'v₂', 'v₃', 'v₄', 't'], pos = [[22, 128], [112, 46], [112, 210], [208, 46], [208, 210], [298, 128]];
      const base = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]], extra = shuffle(R, [[1, 2], [2, 1], [3, 4], [4, 3], [1, 4], [2, 3]]).slice(0, 3);
      const arcs = base.concat(extra.filter((e, i, A) => !A.slice(0, i).some(f2 => f2[0] === e[1] && f2[1] === e[0]))).map(([a, b2]) => [a, b2, ri(R, 2, 9)]);
      const n = 6, cap = Array.from({ length: n }, () => Array(n).fill(0)), fl = Array.from({ length: n }, () => Array(n).fill(0));
      arcs.forEach(([a, b2, c]) => { cap[a][b2] = c; });
      const steps = []; let total = 0;
      for (let it = 0; it < 30; it++) {
        const pr = Array(n).fill(null); pr[0] = [-1, 0]; const qu = [0];
        while (qu.length && !pr[5]) { const u = qu.shift(); for (let v = 0; v < n; v++) { if (pr[v]) continue; if (cap[u][v] - fl[u][v] > 0) { pr[v] = [u, 1]; qu.push(v); } else if (fl[v][u] > 0) { pr[v] = [u, -1]; qu.push(v); } } }
        if (!pr[5]) { var labeled = pr.map(Boolean); break; }
        const path = []; for (let v = 5; v !== 0; v = pr[v][0]) path.unshift([pr[v][0], v, pr[v][1]]);
        const th = Math.min(...path.map(([u, v, d]) => d > 0 ? cap[u][v] - fl[u][v] : fl[v][u]));
        path.forEach(([u, v, d]) => { if (d > 0) fl[u][v] += th; else fl[v][u] -= th; });
        total += th;
        steps.push(`${nm[0]}${path.map(([u, v, d]) => (d > 0 ? '→' : '⇠') + nm[v]).join('')},θ = min{${path.map(([u, v, d]) => d > 0 ? cap[u][v] - fl[u][v] + th : fl[v][u] + th).join(', ')}} = ${th}${path.some(p => p[2] < 0) ? '(⇠ 为后向边,退回流量)' : ''}`);
      }
      if (!labeled) return null;
      const cut = arcs.filter(([a, b2]) => labeled[a] && !labeled[b2]), cutCap = cut.reduce((s, e) => s + e[2], 0);
      if (cutCap !== total || steps.length < 2 || cut.every(e => e[0] === 0) || cut.every(e => e[1] === 5)) return null;   // 割全在起点或终点的太简单
      return { q: `求下面网络从 s 到 t 的最大流,并写出最小割(弧上数字为容量):${graphSVG(n, arcs, { dir: true, pos: pos, names: nm })}<p class="dim">${arcs.map(([a, b2, c]) => `${nm[a]}→${nm[b2]} (${c})`).join(',')}</p>`,
        sol: `<p>从零流开始,每次找一条增广链(前向弧不饱和、后向弧有流量),沿链增加 θ:</p><ol>${steps.map(x => `<li>${x}</li>`).join('')}</ol>
          <p>再标号:从 s 出发能到达的点是 {${nm.filter((_, i) => labeled[i]).join(', ')}},t 无法标号,找不到增广链,当前流即最大流。</p>
          ${tb(['弧', '容量', '流量'], arcs.map(([a, b2, c]) => [`${nm[a]}→${nm[b2]}`, c, fl[a][b2]]))}
          <div class="result">最大流量 <b>${total}</b>;最小割 {${cut.map(([a, b2]) => nm[a] + '→' + nm[b2]).join(', ')}},容量 ${cut.map(e => e[2]).join(' + ')} = ${cutCap},与最大流相等。</div>` };
    } },
    cpm: { ch: '16', name: '网络计划 CPM', make(R) {
      const n = ri(R, 7, 8), L = 'ABCDEFGH'.slice(0, n).split(''), dur = L.map(() => ri(R, 1, 9)), pre = L.map(() => []);
      for (let k = 1; k < n; k++) { if (k <= 1 && R() < 0.6) continue; const m = R() < 0.55 ? 1 : 2; shuffle(R, Array.from({ length: k }, (_, i) => i)).slice(0, m).forEach(i => pre[k].push(i)); pre[k].sort(); }
      const succ = L.map((_, i) => pre.map((p, k) => p.indexOf(i) >= 0 ? k : -1).filter(k => k >= 0));
      if (succ.filter(s => !s.length).length > 2) return null;
      const ES = [], EF = [], LS = [], LF = [];
      L.forEach((_, k) => { ES[k] = Math.max(0, ...pre[k].map(i => EF[i])); EF[k] = ES[k] + dur[k]; });
      const T = Math.max(...EF);
      for (let k = n - 1; k >= 0; k--) { LF[k] = Math.min(T, ...succ[k].map(j => LS[j])); LS[k] = LF[k] - dur[k]; }
      const TF = L.map((_, k) => LS[k] - ES[k]), FF = L.map((_, k) => (succ[k].length ? Math.min(...succ[k].map(j => ES[j])) : T) - EF[k]);
      const starts = L.map((_, k) => k).filter(k => !pre[k].length && TF[k] === 0), crit = [];
      starts.forEach(s0 => (function walk(k, p) { const nx = succ[k].filter(j => TF[j] === 0 && ES[j] === EF[k]); if (!nx.length) { if (EF[k] === T) crit.push(p); return; } nx.forEach(j => walk(j, p.concat(L[j]))); })(s0, [L[s0]]));
      if (TF.every(x => x === 0)) return null;
      return { q: `某工程的工作清单如下(时间:天)。画出网络图,计算各工作的最早/最迟开始和结束时间、总时差、自由时差,确定关键路线和总工期。${tb(['工作'].concat(L), [['时间'].concat(dur), ['紧前工作'].concat(pre.map(p => p.length ? p.map(i => L[i]).join('、') : '—'))])}`,
        sol: `<p>顺推:ES = 紧前工作 EF 的最大值,EF = ES + t;逆推:LF = 紧后工作 LS 的最小值(没有紧后工作的取总工期),LS = LF − t。TF = LS − ES;FF = 紧后工作 ES 的最小值 − EF。</p>
          ${tb(['工作', 't', 'ES', 'EF', 'LS', 'LF', 'TF', 'FF'], L.map((l, k) => [TF[k] === 0 ? `<b>${l}</b>` : l, dur[k], ES[k], EF[k], LS[k], LF[k], TF[k] === 0 ? '<b>0</b>' : TF[k], FF[k]]))}
          <div class="result">总工期 <b>${T}</b> 天;关键工作 ${L.filter((_, k) => TF[k] === 0).join('、')};关键路线 ${crit.map(p => p.join(' → ')).join(' 和 ')}</div>
          <p class="dim">画双代号网络图时,两项工作起止节点相同、或紧前关系部分重叠,要加虚工作。</p>` };
    } },
    decision: { ch: '10', name: '决策准则与期望值', make(R) {
      const A = ['A₁', 'A₂', 'A₃'], P = shuffle(R, [[2, 5, 3], [3, 4, 3], [1, 6, 3], [4, 4, 2], [2, 3, 5]])[0].map(x => x / 10), a = 0.6;
      const M = A.map(() => [0, 1, 2].map(() => ri(R, -6, 20) * 10));
      const mx = M.map(r => Math.max(...r)), mn = M.map(r => Math.min(...r)), hz = M.map((r, i) => rnd(a * mx[i] + (1 - a) * mn[i])), av = M.map(r => rnd(r.reduce((s, x) => s + x, 0) / 3));
      const colMax = [0, 1, 2].map(j => Math.max(...M.map(r => r[j]))), reg = M.map(r => r.map((x, j) => colMax[j] - x)), mr = reg.map(r => Math.max(...r));
      const ev = M.map(r => rnd(r.reduce((s, x, j) => s + x * P[j], 0))), best = Math.max(...ev), evpi = rnd(colMax.reduce((s, x, j) => s + x * P[j], 0) - best);
      const arg = (v, f) => A.filter((_, i) => v[i] === f(...v)).join('、');
      return { q: `某企业有三个方案,未来市场有三种状态,收益矩阵(万元)如下:${tb(['', '状态 1', '状态 2', '状态 3'], M.map((r, i) => [A[i]].concat(r)))}
          (1)分别按乐观准则、悲观准则、折中准则(乐观系数 α = ${a})、等可能准则、最小后悔值准则选择方案;<br>(2)若三种状态的概率为 ${P.join('、')},按期望值准则选择方案,并求完全信息价值 EVPI。`,
        sol: `${tb(['方案', '最大值', '最小值', '折中值', '平均值', '最大后悔值', '期望值'], M.map((r, i) => [A[i], mx[i], mn[i], hz[i], av[i], mr[i], ev[i]]))}
          <p>后悔值 = 该状态下的最大收益 − 本方案收益:${tb(['', '状态 1', '状态 2', '状态 3'], reg.map((r, i) => [A[i]].concat(r)))}</p>
          <ul><li>乐观(大中取大):${arg(mx, Math.max)}</li><li>悲观(小中取大):${arg(mn, Math.max)}</li><li>折中(α·最大 + (1−α)·最小,取大):${arg(hz, Math.max)}</li><li>等可能(平均值取大):${arg(av, Math.max)}</li><li>最小后悔值(最大后悔值取小):${arg(mr, Math.min)}</li><li>期望值准则:${arg(ev, Math.max)},期望收益 ${best}</li></ul>
          <div class="result">有完全信息时:各状态都选最好的方案,期望收益 ${colMax.map((x, j) => `${P[j]}×${x}`).join(' + ')} = ${rnd(best + evpi)};EVPI = ${rnd(best + evpi)} − ${best} = <b>${evpi}</b> 万元</div>` };
    } },
  };
  const GORDER = ['lp2', 'simplex', 'dual', 'transport', 'assign', 'dp', 'dijkstra', 'mst', 'maxflow', 'cpm', 'decision'];
  function genQ(kind, seed) { for (let k = 0; k < 20; k++) { const g = GEN[kind].make(rng(seed + k * 7919)); if (g) return g; } return null; }

  /* 练题首页:概念题一组 10 道;计算题按题型,每点一次换一套数字 */
  function viewQ(ch) {
    const pool = QB.filter(q => !ch || q.ch === ch), now = Date.now(), done = pool.filter(q => st.qc[q.id]).length, due = pool.filter(q => st.qc[q.id] && st.qc[q.id].due <= now).length;
    const kinds = GORDER.filter(k => !ch || GEN[k].ch === ch), c = ch && chOf(ch);
    $app.innerHTML = `<div class="or-page">
      <a href="${c ? '#/or/c/' + ch : '#/or'}" class="back" id="orback">‹ ${c ? esc(c.title) : '运筹学'}</a>
      <h1 class="or-h1">${c ? '练本章' : '练题'}</h1>
      ${pool.length ? `<div class="grp-h">概念题 · 选择</div><div class="grp"><a class="row-i chev" href="#/or/q/c/${ch || 'all'}"><span>练 10 道</span><span class="v">${due ? '待复习 ' + due + ' · ' : ''}做过 ${done} / ${pool.length}</span></a></div>` : ''}
      ${kinds.length ? `<div class="grp-h">计算大题 · 每次换新数字</div><div class="grp">${kinds.map(k => { const s = st.qt[k] || { n: 0, ok: 0 }, cc = chOf(GEN[k].ch);
        return `<a class="row-i chev" href="#/or/q/k/${k}"><span>${GEN[k].name}${!ch && cc && cc.d ? `<small class="dim"> · ${cc.d}</small>` : ''}</span><span class="v">${s.n ? `做对 ${s.ok} / ${s.n}` : ''}</span></a>`; }).join('')}</div>` : ''}
      ${!ch && st.qw.length ? `<div class="grp-h">做错的计算题</div><div class="grp">${st.qw.slice(-8).reverse().map(w => `<a class="row-i chev" href="#/or/q/k/${w.k}/${w.s}"><span>${GEN[w.k] ? GEN[w.k].name : w.k}</span><span class="v">${new Date(w.t).toLocaleDateString()}</span></a>`).join('')}</div>` : ''}
    </div>`;
    window.scrollTo(0, 0);
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
  }
  let cq = null;                                                  // 当前一组概念题
  function viewQC(ch) {
    if (!cq || cq.ch !== ch || cq.i >= cq.list.length && cq.fresh) {
      const pool = QB.filter(q => ch === 'all' || q.ch === ch), now = Date.now(), R = Math.random;
      const due = pool.filter(q => st.qc[q.id] && st.qc[q.id].due <= now), fresh = shuffle(R, pool.filter(q => !st.qc[q.id])), rest = pool.filter(q => st.qc[q.id] && st.qc[q.id].due > now).sort((x, y) => st.qc[x.id].due - st.qc[y.id].due);
      const list = due.concat(fresh, rest).slice(0, 10).map(q => ({ q: q, ord: shuffle(R, q.o.map((_, i) => i)), pick: -1 }));
      cq = { ch: ch, list: list, i: 0, right: 0, fresh: false };
    }
    if (cq.i >= cq.list.length) {
      $app.innerHTML = `<div class="or-page"><a href="#/or/q${cq.ch === 'all' ? '' : '/ch/' + cq.ch}" class="back" id="orback">‹ 练题</a><h1 class="or-h1">这组做完了</h1>
        <div class="or-card done"><b>${cq.right} / ${cq.list.length}</b><p class="dim">做错的题会在 1 天后回来,做对的间隔越来越长。</p></div>
        <button class="go" id="again">再来 10 道</button></div>`;
      $('#again').onclick = () => { cq.fresh = true; viewQC(ch); };
      cq.fresh = true; return;
    }
    const it = cq.list[cq.i], q = it.q, cc = chOf(q.ch), answered = it.pick >= 0;
    $app.innerHTML = `<div class="or-page or-qc">
      <a href="#/or/q${ch === 'all' ? '' : '/ch/' + ch}" class="back" id="orback">‹ 练题</a>
      <div class="qc-meta"><span>${cq.i + 1} / ${cq.list.length}</span><span>${cc ? (cc.d ? '第 ' + cc.d + ' 章 · ' : '') + esc(cc.title) : ''}</span></div>
      <div class="qc-q">${mdInline(q.q)}</div>
      <div class="qc-opts">${it.ord.map((oi, k) => `<button class="qc-o${answered ? (oi === q.a ? ' ok' : k === it.pick ? ' bad' : ' dim') : ''}" data-k="${k}"><b>${'ABCD'[k]}</b><span>${mdInline(q.o[oi])}</span></button>`).join('')}</div>
      ${answered ? `<div class="qc-e">${it.ord[it.pick] === q.a ? '<b class="demo-ok">对了。</b>' : `<b class="demo-bad">选错了,答案是 ${'ABCD'[it.ord.indexOf(q.a)]}。</b>`}${mdInline(q.e)}</div>
        <div class="qc-bar"><a href="#" id="qcai">没懂,问 AI</a><button class="go sm" id="qcnext">${cq.i + 1 < cq.list.length ? '下一题' : '看结果'}</button></div>` : ''}
    </div>`;
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    if (!answered) $$('.qc-o').forEach(b => b.onclick = () => {
      it.pick = +b.dataset.k; const right = it.ord[it.pick] === q.a, s = st.qc[q.id] || { box: 0, ok: 0, bad: 0 };
      if (right) { s.box = Math.min(5, s.box + 1); s.ok++; cq.right++; } else { s.box = 1; s.bad++; }
      s.due = Date.now() + QIV[s.box] * DAY_MS - 3600000; st.qc[q.id] = s; saveOR(); viewQC(ch);
    });
    else {
      $('#qcnext').onclick = () => { cq.i++; viewQC(ch); window.scrollTo(0, 0); };
      $('#qcai').onclick = ev => { ev.preventDefault(); askAI(`这道选择题我没懂:\n${q.q}\n选项:${q.o.map((o, i) => 'ABCD'[i] + '. ' + o).join(';')}\n答案:${q.o[q.a]}\n\n请讲清楚为什么,以及其他选项错在哪里。`, q.ch); };
    }
  }
  function viewQK(kind, seed) {
    if (!GEN[kind]) return viewQ();
    if (!seed) { location.replace('#/or/q/k/' + kind + '/' + Math.floor(Math.random() * 1e9)); return; }
    const g = genQ(kind, +seed), cc = chOf(GEN[kind].ch), key = kind + ':' + seed, graded = (st.qg || {})[key];
    $app.innerHTML = `<div class="or-page or-qk">
      <div class="or-bar"><a href="#/or/q" class="back" id="orback">‹ 练题</a><a href="#" id="qkai" class="or-ask">问 AI</a></div>
      <div class="or-eyebrow">${esc(GEN[kind].name)}${cc && cc.d ? ' · 第 ' + cc.d + ' 章' : ''}</div>
      ${g ? `<div class="qk-q md">${g.q}</div><p class="dim sm">先在纸上做完,再看解答。</p>
        <div id="qksol" hidden><div class="qk-sol md">${g.sol}</div>
          <div class="qk-grade">${graded ? `<span class="dim">已记录:${graded === 1 ? '做对了' : '做错了'}</span>` : '<button class="ghost" data-g="0">做错了</button><button class="go sm" data-g="1">做对了</button>'}</div></div>
        <div class="qk-bar"><button class="ghost" id="qknew">换一道</button><button class="go sm" id="qkshow">看解答</button></div>` : '<p class="dim">这次没生成出合适的题,点「换一道」。</p><div class="qk-bar"><button class="go sm" id="qknew">换一道</button></div>'}
    </div>`;
    window.scrollTo(0, 0);
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    $('#qknew').onclick = () => location.replace('#/or/q/k/' + kind + '/' + Math.floor(Math.random() * 1e9));
    const sh = $('#qkshow'); if (sh) sh.onclick = () => { $('#qksol').hidden = false; sh.style.display = 'none'; $('.qk-bar').style.position = 'static'; $('#qksol').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $$('.qk-grade [data-g]').forEach(b => b.onclick = () => {
      const ok = +b.dataset.g, s = st.qt[kind] || { n: 0, ok: 0 }; s.n++; s.ok += ok; st.qt[kind] = s;
      st.qg = st.qg || {}; st.qg[key] = ok ? 1 : 2;
      st.qw = st.qw.filter(w => w.k + ':' + w.s !== key); if (!ok) st.qw.push({ k: kind, s: +seed, t: Date.now() }); st.qw = st.qw.slice(-40);
      saveOR(); $('.qk-grade').innerHTML = `<span class="dim">已记录:${ok ? '做对了' : '做错了,放进「做错的计算题」'}</span>`;
    });
    $('#qkai').onclick = ev => { ev.preventDefault(); const t = g ? $('.qk-q').innerText : ''; askAI(`这是一道「${GEN[kind].name}」练习题:\n${t}\n\n请先给我解题思路的提示,不要直接给答案。`, GEN[kind].ch); };
  }
  function qcStats() { const now = Date.now(); return { due: QB.filter(q => st.qc[q.id] && st.qc[q.id].due <= now).length, total: QB.length + GORDER.length }; }

  /* ── 路由入口(app.js 调用):parts = ['or', 子页, 参数] ── */
  window.renderOR = function (parts) {
    clearInterval(tickH); selBtn.hidden = true;
    document.title = '运筹学 · Ultimate';
    const sub = parts[1] || '';
    if (sub === 'c') return viewChapter(parts[2]);
    if (sub === 'cards') return viewCards();
    if (sub === 'q') return parts[2] === 'c' ? viewQC(parts[3] || 'all') : parts[2] === 'k' ? viewQK(parts[3], parts[4]) : viewQ(parts[2] === 'ch' ? parts[3] : '');
    if (sub === 'tools') { renderTools(parts[2] || S.get('tool', 'simplex')); window.scrollTo(0, 0); const b = $('#orback'); if (b) b.onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } }; return; }
    if (sub === 'ai') return viewORAI(parts[2]);
    return viewHome();
  };
  window.orSummary = function () {
    const core = CH.filter(c => c.core);
    return { done: core.filter(c => st.done.indexOf(c.no) >= 0).length, total: core.length, due: dueCount(), last: st.last && chOf(st.last) };
  };
})();
