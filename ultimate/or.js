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

  /* ── 章节 ── */
  const CH = C.chapters.map(function (c) {
    const no = c.id.slice(0, 2), m = c.md.match(/^#\s+(.+)$/m), n = +no;
    return { no: no, n: n, title: (m ? m[1].trim() : c.id).replace(/^\d+\s*/, ''), md: c.md,
      group: n === 0 ? '开始' : n <= 4 ? '主干:线性规划' : n <= 10 ? '专题' : '考试冲刺',
      plain: c.md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '') };
  });
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
    const where = c ? c.no + ' ' + c.title : id === 'cards' ? '记忆闪卡' : id === 'tools' ? '计算器' : '整门课';
    const ctx = c ? c.plain.slice(0, 9000) : '';
    CHAT_PROFILES[key] = {
      title: c ? '运筹学 · ' + c.title : '运筹学助教', back: c ? '#/or/c/' + c.no : id === 'cards' ? '#/or/cards' : id === 'tools' ? '#/or/tools' : '#/or',
      tools: false, snap: false, render: richText, ph: '问这一章的任何问题,也可以贴上你的解答让它批改',
      hello: c ? '这一章哪里没懂,直接问我。' : '运筹学的问题都可以问我。',
      sys: () => `你是一位耐心、严谨的运筹学助教,用简体中文回答。学生正在为运筹学考试做准备(课程记号与国内清华版《运筹学》一致:max 问题检验数 σj = cj − CB·B⁻¹·Pj,全部 ≤ 0 为最优)。
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
    const core = CH.filter(c => c.n >= 1 && c.n <= 10), doneN = core.filter(c => st.done.indexOf(c.no) >= 0).length;
    const due = dueCount(), fresh = C.flashcards.length - Object.keys(st.fc).length;
    const last = st.last && chOf(st.last);
    $app.innerHTML = `<div class="or-page">
      <a href="#/learn" class="back" id="orback">‹ 学习</a>
      <h1 class="or-h1">运筹学</h1>
      <div class="or-prog"><span>已学完 ${doneN} / ${core.length} 章</span><span class="bar k3"><i style="width:${doneN / core.length * 100}%"></i></span></div>
      ${last ? `<a class="go or-cont" href="#/or/c/${last.no}">继续读<small>${esc(last.no + ' ' + last.title)}</small></a>` : ''}
      <input class="or-search" id="ors" type="search" placeholder="搜讲义" autocomplete="off">
      <div id="orsr"></div>
      <div class="grp-h">工具</div>
      <div class="grp"><a class="row-i chev" href="#/or/cards"><span>记忆闪卡</span><span class="v">${due ? '今日 ' + due + ' 张' : fresh ? fresh + ' 张新卡' : '全部完成'}</span></a>
        <a class="row-i chev" href="#/or/tools"><span>计算器</span><span class="v">单纯形 · 运输 · 指派 · 排队 · 图解</span></a>
        <a class="row-i chev" href="#/or/ai/all"><span>问 AI 助教</span><span class="v"></span></a></div>
      <div class="grp-h">学习路线</div>
      <ol class="or-path">${groups.map(g => `<li class="or-stage">${esc(g.name)}</li>${g.list.map(c => {
        const p = st.pos[c.no] || 0, dn = st.done.indexOf(c.no) >= 0, cur = last && last.no === c.no;
        return `<li class="or-step${dn ? ' done' : ''}${cur ? ' cur' : ''}"><a href="#/or/c/${c.no}"><i class="nd">${dn ? '✓' : c.no}</i>
          <span><b>${esc(c.title)}</b>${CH_DEMOS[c.no] ? '<em class="hasd">▶ 动画</em>' : ''}${!dn && p > 0.05 ? `<em>读到 ${Math.round(p * 100)}%</em>` : ''}</span></a></li>`; }).join('')}`).join('')}</ol>
      <div class="grp-h">动画演示</div>
      <div class="grp">${Object.keys(DEMOS).map(d => `<a class="row-i chev" href="#" data-demo="${d}"><span>▶ ${esc(DEMOS[d].title)}</span><span class="v"></span></a>`).join('')}</div>
    </div>`;
    window.scrollTo(0, 0);
    $('#orback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    $$('[data-demo]').forEach(a => a.onclick = ev => { ev.preventDefault(); openDemo(a.dataset.demo); });
    const inp = $('#ors'), out = $('#orsr');
    inp.oninput = function () {
      const q = inp.value.trim();
      if (!q) { out.innerHTML = ''; return; }
      const hits = [];
      CH.forEach(c => { let i = c.plain.indexOf(q), k = 0; while (i >= 0 && k < 3) { hits.push({ c: c, snip: c.plain.slice(Math.max(0, i - 16), i + q.length + 22).replace(/\s+/g, ' ') }); i = c.plain.indexOf(q, i + q.length); k++; } });
      out.innerHTML = `<div class="grp or-hits">${hits.slice(0, 20).map(h => `<a class="row-i" href="#/or/c/${h.c.no}" data-q="${esc(q)}"><span><b>${h.c.no} ${esc(h.c.title)}</b><br><small class="dim">…${esc(h.snip).replace(esc(q), '<mark>' + esc(q) + '</mark>')}…</small></span></a>`).join('') || '<div class="row-i off"><span>没有找到</span></div>'}</div>`;
      $$('[data-q]', out).forEach(a => a.onclick = () => { findQ = a.dataset.q; });
    };
  }

  /* ── 讲义阅读 ── */
  let findQ = '', posTimer = null, tickH = null;
  function viewChapter(no) {
    const c = chOf(no) || CH[0];
    st.last = c.no; saveOR();
    const i = CH.indexOf(c), prev = CH[i - 1], next = CH[i + 1], vids = C.videos[c.no], exam = c.no === '12' || c.no === '13';
    const dn = st.done.indexOf(c.no) >= 0, core = c.n >= 1 && c.n <= 10;
    $app.innerHTML = `<div class="or-page or-read">
      <div class="or-bar"><a href="#/or" class="back" id="orback">‹ 运筹学</a><a href="#" id="orai" class="or-ask">问 AI</a></div>
      ${exam ? timerHTML(c.no) : ''}
      <div class="or-eyebrow">${c.n === 0 ? '导读' : c.n <= 10 ? '第 ' + c.no + ' 章' : '考试冲刺'}</div>
      <h1 class="or-h1">${esc(c.title)}</h1>
      <div class="or-acts">${vids ? '<a href="#" id="vbtn">配套视频</a>' : ''}${core ? `<a href="#" id="mark" class="${dn ? 'on' : ''}">${dn ? '✓ 已学完' : '标记学完'}</a><a href="#" id="tocards">练本章闪卡</a>` : ''}</div>
      ${(CH_DEMOS[c.no] || []).map(d => `<a href="#" class="or-demo" data-demo="${d}"><span class="pl">▶</span><span><b>先看动画</b><small>${esc(DEMOS[d].title)}</small></span></a>`).join('')}
      ${vids ? `<div class="or-vids" id="vlist" hidden>${vids.map(v => `<div><b>${esc(v.kind)}</b> ${esc(v.title)}<span>${v.parts.map(p => `<a href="${v.base}${p}" target="_blank" rel="noopener">P${p}</a>`).join('')}</span></div>`).join('')}<small class="dim">链接打开 B 站对应集数</small></div>` : ''}
      <article class="md">${md(c.md.replace(/^#\s+.+$/m, ''))}</article>
      <div class="or-foot">${prev ? `<a href="#/or/c/${prev.no}">‹ ${esc(prev.no + ' ' + prev.title)}</a>` : '<span></span>'}${next ? `<a href="#/or/c/${next.no}" class="nx">${esc(next.no + ' ' + next.title)} ›</a>` : ''}</div>
    </div>`;
    $$('.md a').forEach(a => { if (/^https?:/.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener'; } });
    $('#orai').onclick = ev => { ev.preventDefault(); askAI('', c.no); };
    const vb = $('#vbtn'); if (vb) vb.onclick = ev => { ev.preventDefault(); $('#vlist').hidden = !$('#vlist').hidden; };
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
    const chs = [...new Set(C.flashcards.map(c => c.ch))], card = queue[0];
    $app.innerHTML = `<div class="or-page or-cards">
      <a href="#/or" class="back" id="orback">‹ 运筹学</a>
      <h1 class="or-h1">记忆闪卡</h1>
      <section class="stats"><div><b>${queue.length}</b><span>本轮</span></div><div><b>${learned}<small>/${C.flashcards.length}</small></b><span>学过 · 牢固 ${mastered}</span></div></section>
      <div class="or-acts"><label>范围 <select id="cf">${['all'].concat(chs).map(x => `<option value="${x}"${x === f ? ' selected' : ''}>${x === 'all' ? '全部章节' : '第 ' + x + ' 章'}</option>`).join('')}</select></label></div>
      ${card ? `<div class="or-card" id="ocard"><div class="meta"><span>第 ${card.ch} 章 · ${esc((chOf(card.ch) || {}).title || '')}</span><span>${st.fc[card.id] ? '复习' : '新卡'}</span></div>
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

  function toolSimplex(el) {
    const def = S.get('t_lp', 'max 3 5\n1 0 <= 4\n0 2 <= 12\n3 2 <= 18');
    el.innerHTML = `<div class="card form">
      <label>模型（第一行目标函数，之后每行一个约束）<textarea id="lpt" rows="6" spellcheck="false">${esc(def)}</textarea></label>
      <div class="hint">例：<code>min 2 3</code> 表示 min z = 2x₁ + 3x₂；<code>1 3 >= 6</code> 表示 x₁ + 3x₂ ≥ 6。支持小数和分数（如 1/3）、<code>&lt;=</code> <code>&gt;=</code> <code>=</code>。变量默认非负。含 ≥ 或 = 时自动用大 M 法。</div>
      <div class="row"><button class="btn primary" id="lpgo">逐步求解</button>
      <button class="btn small" data-ex="max 3 5\n1 0 <= 4\n0 2 <= 12\n3 2 <= 18">例：封测厂</button>
      <button class="btn small" data-ex="min 2 3\n1 1 >= 4\n1 3 >= 6">例：大 M 法</button>
      <button class="btn small" data-ex="max 3 -1 -1\n1 -2 1 <= 11\n-4 1 2 >= 3\n-2 0 1 = 1">例：清华版经典</button></div></div>
      <div class="out" id="lpout"></div>`;
    $$('[data-ex]', el).forEach((b) => (b.onclick = () => { $('#lpt').value = b.dataset.ex.replace(/\\n/g, '\n'); run(); }));
    $('#lpgo').onclick = run;
    function run() {
      const out = $('#lpout'); const txt = $('#lpt').value; S.set('t_lp', txt);
      let res;
      try { res = SV.simplex(SV.parseLP(txt)); } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; return; }
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
      out.innerHTML = html;
    }
    run();
  }

  function parseMatrix(t) { return t.trim().split(/\n/).map((l) => l.trim().split(/[\s,，]+/).filter(Boolean).map(Number)).filter((r) => r.length); }
  function parseList(t) { return t.trim().split(/[\s,，]+/).filter(Boolean).map(Number); }

  function toolTransport(el) {
    const d = S.get('t_tr', { c: '3 11 3 10\n1 9 2 8\n7 4 10 5', a: '7 4 9', b: '3 6 5 6' });
    el.innerHTML = `<div class="card form">
      <label>运价表（每行一个产地）<textarea id="trc" rows="4" spellcheck="false">${esc(d.c)}</textarea></label>
      <div class="grid2"><label>产量<input id="tra" value="${esc(d.a)}"></label><label>销量<input id="trb" value="${esc(d.b)}"></label></div>
      <div class="hint">用伏格尔法求初始方案，再用位势法检验、闭回路调整，直到最优。产销不平衡时自动加虚拟产地或销地。</div>
      <div class="row"><button class="btn primary" id="trgo">求解</button></div></div><div class="out" id="trout"></div>`;
    $('#trgo').onclick = run;
    function table(R, X, hl, extra) {
      return `<div class="scroll"><table class="tb"><tr><th></th>${R.b.map((_, j) => `<th>B${j + 1}${R.dummy === 'col' && j === R.n - 1 ? '（虚）' : ''}</th>`).join('')}<th>产量</th></tr>
        ${X.map((r, i) => `<tr><th>A${i + 1}${R.dummy === 'row' && i === R.m - 1 ? '（虚）' : ''}</th>${r.map((x, j) => `<td class="${hl && hl.some((c) => c[0] === i && c[1] === j) ? 'hl' : ''}"><span class="hint">${R.C[i][j]}</span> ${x === null ? (extra ? `<span class="hint">σ=${+extra[i][j].toFixed(4)}</span>` : '') : `<b>${+x.toFixed(4)}</b>`}</td>`).join('')}<td>${R.a[i]}</td></tr>`).join('')}
        <tr><th>销量</th>${R.b.map((x) => `<td>${x}</td>`).join('')}<td></td></tr></table></div>`;
    }
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
      let html = R.dummy ? `<div class="note-line">产销不平衡，已加入虚拟${R.dummy === 'col' ? '销地' : '产地'}（运价为 0）。</div>` : '';
      html += `<div class="tab-step"><h4>伏格尔法初始方案　总运费 ${+R.initialCost.toFixed(4)}</h4>${table(R, R.initial)}<div class="note-line">分配顺序：${R.vogel.map((v) => `${v.by}（罚数 ${v.pen}）→ (A${v.cell[0] + 1}, B${v.cell[1] + 1}) = ${+v.q.toFixed(4)}`).join('；')}${R.zeros.length ? `。退化，补 0 于 ${R.zeros.map((z) => `(A${z[0] + 1}, B${z[1] + 1})`).join('、')}` : ''}。</div></div>`;
      R.iters.forEach((it, k) => {
        html += `<div class="tab-step"><h4>第 ${k + 1} 次调整</h4>${table(R, it.X, it.loop, it.sig)}<div class="note-line">位势 u = (${it.u.map((x) => +x.toFixed(4)).join(', ')})，v = (${it.v.map((x) => +x.toFixed(4)).join(', ')})。(A${it.enter[0] + 1}, B${it.enter[1] + 1}) 检验数 ${+it.sigma.toFixed(4)} 最小，入基。闭回路 ${it.loop.map((c, i) => `(A${c[0] + 1},B${c[1] + 1})${it.signs[i] > 0 ? '+' : '−'}`).join(' → ')}，θ = ${+it.theta.toFixed(4)}，(A${it.leave[0] + 1}, B${it.leave[1] + 1}) 出基。总运费变为 ${+it.newCost.toFixed(4)}。</div></div>`;
      });
      if (R.final) html += `<div class="tab-step"><h4>最优方案</h4>${table(R, R.final.X, null, R.final.sig)}<div class="note-line">位势 u = (${R.final.u.map((x) => +x.toFixed(4)).join(', ')})，v = (${R.final.v.map((x) => +x.toFixed(4)).join(', ')})，空格检验数全部 ≥ 0。</div></div><div class="result">最小总运费 <b>${+R.final.cost.toFixed(4)}</b>。${R.multiple ? '有空格检验数为 0：<b>存在其他最优方案</b>。' : ''}</div>`;
      out.innerHTML = html;
    }
    run();
  }

  function toolAssign(el) {
    const d = S.get('t_as', { m: '4 8 7 15\n7 9 17 14\n6 9 12 8\n6 7 14 6', mode: 'min' });
    el.innerHTML = `<div class="card form">
      <label>费用（或效益）矩阵，n × n<textarea id="asm" rows="5" spellcheck="false">${esc(d.m)}</textarea></label>
      <label>目标<select id="asmode"><option value="min" ${d.mode === 'min' ? 'selected' : ''}>费用最小</option><option value="max" ${d.mode === 'max' ? 'selected' : ''}>效益最大</option></select></label>
      <div class="hint">给出精确最优指派（最多 9×9），并列出行列约简后的矩阵，方便核对匈牙利法的第一步。</div>
      <div class="row"><button class="btn primary" id="asgo">求解</button></div></div><div class="out" id="asout"></div>`;
    $('#asgo').onclick = run;
    function mat(M, sel) { return `<div class="scroll"><table class="tb">${M.map((r, i) => `<tr>${r.map((x, j) => `<td class="${sel && sel[i] === j ? 'piv' : ''}">${x}</td>`).join('')}</tr>`).join('')}</table></div>`; }
    function run() {
      const data = { m: $('#asm').value, mode: $('#asmode').value }; S.set('t_as', data);
      const out = $('#asout');
      try {
        const M = parseMatrix(data.m);
        if (M.flat().some((x) => !isFinite(x))) throw new Error('有无法识别的数字');
        const R = SV.assignment(M, data.mode);
        out.innerHTML = `${R.converted ? `<div class="tab-step"><h4>化为最小化：用最大元素减去每个元素</h4>${mat(R.converted)}</div>` : ''}
          <div class="tab-step"><h4>行约简、列约简之后</h4>${mat(R.reduced)}<div class="note-line">如果这里已经能找到 ${M.length} 个不同行、不同列的 0，就不需要画线调整。</div></div>
          <div class="tab-step"><h4>最优指派</h4>${mat(M, R.assign)}</div>
          <div class="result">${R.assign.map((j, i) => `${i + 1} → ${j + 1}`).join('，')}；${data.mode === 'max' ? '最大效益' : '最小费用'} <b>${R.total}</b></div>`;
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
  const DEMOS = {
    graph: { title: '图解法:把利润线推到最远的顶点', make: demoGraph },
    simplex: { title: '单纯形法:从一个顶点走到更好的顶点', make: demoSimplex },
    dijkstra: { title: '最短路:每次定下一个最近的点', make: demoDijkstra },
    queue: { title: '排队:为什么只多来两个人,队伍就长了好几倍', make: demoQueue },
  };
  const CH_DEMOS = { '01': ['graph'], '02': ['graph'], '03': ['simplex'], '04': ['simplex'], '08': ['dijkstra'], '09': ['queue'] };
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

  /* ── 路由入口(app.js 调用):parts = ['or', 子页, 参数] ── */
  window.renderOR = function (parts) {
    clearInterval(tickH); selBtn.hidden = true;
    document.title = '运筹学 · Ultimate';
    const sub = parts[1] || '';
    if (sub === 'c') return viewChapter(parts[2]);
    if (sub === 'cards') return viewCards();
    if (sub === 'tools') { renderTools(parts[2] || S.get('tool', 'simplex')); window.scrollTo(0, 0); const b = $('#orback'); if (b) b.onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } }; return; }
    if (sub === 'ai') return viewORAI(parts[2]);
    return viewHome();
  };
  window.orSummary = function () {
    const core = CH.filter(c => c.n >= 1 && c.n <= 10);
    return { done: core.filter(c => st.done.indexOf(c.no) >= 0).length, total: core.length, due: dueCount(), last: st.last && chOf(st.last) };
  };
})();
