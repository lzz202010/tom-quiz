/* e2 作文模版 · 渲染逻辑
   数据 window.WR2(writing-data.js)。
   路由:#/ 目录 · #/core 核心句库 · #/drill[/组] 挖空循环练 · #/t/<id> 模版/句库详情
        · #/practice 练习 · #/grade 批改 · #/g/<id> 预测题 · #/cram 考前一页纸。
   本机状态:练习勾选 e2.wr2.practice.v1 · 批改草稿/自评 e2.wr2.grade.v1 · 默写统计 e2.wr2.drill.v1。 */
(function () {
  'use strict';
  const W = window.WR2;
  const $ = (s, r) => (r || document).querySelector(s);
  const MAIN = $('#wrMain');

  const LS = {
    read(k, d) { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || '{}') || {}); } catch (e) { return Object.assign({}, d); } },
    write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const PK = 'e2.wr2.practice.v1', GK = 'e2.wr2.grade.v1', DK = 'e2.wr2.drill.v1';
  const PR = () => LS.read(PK, { checks: {} });
  const GR = () => LS.read(GK, { drafts: {}, checks: {} });
  const DR = () => LS.read(DK, { ok: {}, bad: {} });

  const wc = t => (String(t || '').match(/[A-Za-z'’-]+/g) || []).length;

  const TPL = {};
  W.core.concat(W.big, W.small).forEach(t => { TPL[t.id] = t; });
  const PRED = {}; W.preds.forEach(p => { PRED[p.id] = p; });
  const SESSION = {}; W.practice.sessions.forEach(s => { SESSION[s.n] = s; });
  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'];

  /* ───── 内容索引:把范文、真题、练习/预测、句库串成一张网 ─────
     范文标题里带年份 → 能指回那一年的第 47/48 题原卷;
     练习和预测引用了哪篇范文 → 反查得到「这篇还在哪出现」;
     句库哪一组出现在哪篇范文 → 用挖空句的答案做文本匹配(78% 可命中,
     其余是改写句,不硬凑)。 */
  const YEAR_MIN = 2010, YEAR_MAX = 2025;
  function sampleYear(sid) {
    const m = (W.samples[sid].title.match(/(20\d{2})/) || [])[1];
    const y = +m;
    return y >= YEAR_MIN && y <= YEAR_MAX ? y : 0;
  }
  function sampleUnit(sid) {
    const y = sampleYear(sid);
    return y ? `${y}-${sid.charAt(0) === 'l' ? 'w47' : 'w48'}` : '';
  }
  const SAMPLE_LINKS = {};
  W.practice.sessions.forEach(s => (s.sarr || []).forEach(k => {
    (SAMPLE_LINKS[k] = SAMPLE_LINKS[k] || []).push({ href: `#/practice/${s.n}`, label: `练习第${CN_NUM[s.n - 1]}次` });
  }));
  W.preds.forEach(p => {
    (SAMPLE_LINKS[p.sample] = SAMPLE_LINKS[p.sample] || []).push({ href: `#/g/${p.id}`, label: p.no });
  });
  const normText = s => String(s).toLowerCase().replace(/[’']/g, '')
    .replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
  const SAMPLE_TEXT = Object.keys(W.samples).map(k => ({ k: k, t: normText(W.samples[k].en) }));
  const GROUP_SAMPLES = {};
  W.core.forEach(c => {
    const hit = [];
    W.drill.filter(d => d.g === c.id).forEach(d => {
      const probe = normText(d.s.replace(/(_+\s*)+/, ' ' + d.a + ' ')).slice(0, 40);
      if (!probe) return;
      SAMPLE_TEXT.forEach(s => { if (s.t.indexOf(probe) >= 0 && hit.indexOf(s.k) < 0) hit.push(s.k); });
    });
    GROUP_SAMPLES[c.id] = hit;
  });

  /* 逐句标记:范文里凡是句库原句,或命中模板句式,都套一层 .key */
  const KEY_SENTS = [];
  W.drill.forEach(d => {
    const probe = normText(d.s.replace(/(_+\s*)+/, ' ' + d.a + ' ')).slice(0, 40);
    if (probe) KEY_SENTS.push({ probe: probe, g: d.g });
  });
  /* 句库原句在范文里常被改写,光靠精确匹配只能盖住 1/4;
     再加一层模板句式判断,覆盖到约 6 成句子,标出来的才是真·可背句。 */
  const KEY_PAT = [
    /there (are|is) (two|a host of|many).{0,60}(factors|contributors)/i,
    /^\s*first and foremost/i, /^\s*in addition/i, /^\s*last but not least/i,
    /^with due consideration/i, /^i really hope/i, /^i am looking forward/i,
    /^as (a|an|the|one who)/i, /^here are the (reasons|key points|suggestions)/i,
    /(pie|bar|line|table) chart reflects/i, /from the chart, we can (clearly )?see/i,
    /great changes have taken place/i, /was witnessed/i, /gets? the lion'?s share/i,
    /takes? up the second largest/i, /accounts? for .{0,40}respectively/i,
    /which would explain/i, /it is (universally acknowledged|quite famous|difficult for)/i,
    /so .{0,40}that i never fail/i, /this (notice|email|letter) is written to/i,
    /the minutes are as follows/i, /come on and join us/i,
    /(several volunteers|volunteers are needed)/i, /it aims to/i,
    /i am not satisfied with/i, /it is necessary for/i,
    /(increasing|decreasing) (dramatically|steadily)/i,
    /(increased|decreased|rose|fell) from .{0,40} to /i,
    /(occupying|accounting for) \d/i, /is projected to show an upward trend/i,
    /looking forward to your early reply/i
  ];
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function sentenceHtml(en) {
    const re = /[^.!?]+[.!?]*\s*/g;
    let out = '', count = 0, total = 0, m;
    while ((m = re.exec(en))) {
      const raw = m[0];
      if (!raw.trim()) { out += escHtml(raw); continue; }
      total++;
      const norm = normText(raw);
      const hit = KEY_SENTS.find(k => norm.indexOf(k.probe) >= 0 || (norm.length > 26 && k.probe.indexOf(norm) >= 0));
      const pat = !hit && KEY_PAT.some(re2 => re2.test(raw));
      if (hit || pat) {
        count++;
        out += `<span class="sen key"${hit ? ` data-g="${hit.g}"` : ''}>${escHtml(raw)}</span>`;
      } else out += `<span class="sen">${escHtml(raw)}</span>`;
    }
    return { html: out, count: count, total: total };
  }

  /* ───── 范文块 ───── */
  function sampleHtml(sid, ctx) {
    const s = W.samples[sid];
    if (!s) return '';
    const links = [];
    const y = sampleYear(sid);
    if (y) links.push(`<a class="ws-go" href="index.html?y=${y}&u=${sampleUnit(sid)}">${y} 原卷 第${sid.charAt(0) === 'l' ? 47 : 48} 题 ›</a>`);
    (SAMPLE_LINKS[sid] || []).forEach(l => {
      if (l.href === ctx) return;                 // 不给自己所在的页面再放一条自己的链接
      links.push(`<a class="ws-go" href="${l.href}">${l.label} ›</a>`);
    });
    const body = sentenceHtml(s.en);
    return `<div class="ws-hd"><b>${s.title}</b><span>范文 · ${wc(s.en)} 词</span></div>` +
      (links.length ? `<div class="ws-links">${links.join('')}</div>` : '') +
      `<div class="ws-legend"><span>重点句 <b>${body.count}</b>/${body.total} · 下划线为句库必背句</span>` +
      (body.count ? `<button class="ws-only" type="button" data-only>只看重点句</button>` : '') + `</div>` +
      `<div class="ws-en">${body.html}</div>` +
      `<button class="ws-toggle" type="button" data-zh>看译文</button>` +
      `<div class="ws-zh" hidden>${s.zh}</div>`;
  }
  function bindToggles(root) {
    root.querySelectorAll('[data-zh]').forEach(b => {
      b.addEventListener('click', () => {
        const zh = b.nextElementSibling;
        zh.hidden = !zh.hidden;
        b.textContent = zh.hidden ? '看译文' : '收起译文';
      });
    });
    root.querySelectorAll('[data-only]').forEach(b => {
      b.addEventListener('click', () => {
        const box = b.closest('.wsample').querySelector('.ws-en');
        const on = box.classList.toggle('only-key');
        b.textContent = on ? '看全文' : '只看重点句';
        b.classList.toggle('on', on);
      });
    });
  }

  /* ───── 勾选清单 ───── */
  function checkHtml(scope, key, items) {
    return `<div class="wck"><div class="wck-t">自查清单(全勾完才算完成)</div>` +
      items.map((c, i) => `<label><input type="checkbox" data-ck="${scope}:${key}:${i}">${c}</label>`).join('') +
      `</div>`;
  }
  function paintChecks(root) {
    const pr = PR(), gr = GR();
    root.querySelectorAll('input[data-ck]').forEach(cb => {
      const [scope, key, idx] = cb.dataset.ck.split(':');
      const arr = (scope === 'p' ? (pr.checks[key] || []) : (gr.checks[key] || []));
      cb.checked = !!arr[+idx];
    });
  }
  MAIN.addEventListener('change', e => {
    const cb = e.target.closest('input[data-ck]');
    if (!cb) return;
    const [scope, key, idx] = cb.dataset.ck.split(':');
    const st = scope === 'p' ? PR() : GR();
    const bag = st.checks[key] = st.checks[key] || [];
    bag[+idx] = cb.checked;
    LS.write(scope === 'p' ? PK : GK, st);
    if (scope === 'p') { refreshSessionMarks(key); refreshPracticeBar(); }
    else refreshPredStatus(key);
  });

  /* ───── 草稿区 ───── */
  /* 页面重新渲染会换掉 textarea,这里只保留当前这一屏的引用;
     关闭/切走页面时统一落盘,避免最后几个字因为 300ms 防抖丢掉。 */
  const DRAFT_TA = new Map();
  function flushDrafts() {
    if (!DRAFT_TA.size) return;
    const g = GR();
    let dirty = false;
    DRAFT_TA.forEach((ta, id) => {
      if (g.drafts[id] !== ta.value) { g.drafts[id] = ta.value; dirty = true; }
    });
    if (dirty) LS.write(GK, g);
  }
  window.addEventListener('pagehide', flushDrafts);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushDrafts(); });

  function bindDrafts(root) {
    const gr = GR();
    DRAFT_TA.clear();
    root.querySelectorAll('textarea[data-draft]').forEach(ta => {
      const id = ta.dataset.draft;
      ta.value = gr.drafts[id] || '';
      DRAFT_TA.set(id, ta);
      const upd = () => { const n = $('#wc_' + id); if (n) n.textContent = wc(ta.value); };
      upd();
      let t = null;
      ta.addEventListener('input', () => {
        upd();
        clearTimeout(t);
        t = setTimeout(() => { const g = GR(); g.drafts[id] = ta.value; LS.write(GK, g); }, 300);
      });
    });
  }

  /* ───── 默写统计 ───── */
  function drillStats() {
    const st = DR();
    let mastered = 0;
    W.drill.forEach((d, i) => {
      if ((st.ok[i] || 0) > (st.bad[i] || 0)) mastered++;
    });
    return { mastered, total: W.drill.length };
  }

  /* ───── 目录页 ───── */
  function card(t) {
    return `<a class="wcard" href="#/t/${t.id}"><span class="no">${t.no}</span>` +
      `<span class="tt"><b>${t.title}</b><i>${t.tag}</i></span><span class="ar">›</span></a>`;
  }
  function practiceProgress() {
    let done = 0;
    W.practice.sessions.forEach(s => {
      const arr = PR().checks[s.n] || [];
      if (s.checks.every((c, i) => arr[i])) done++;
    });
    return done;
  }
  function gradeProgress() {
    const gr = GR();
    let drafted = 0, graded = 0;
    W.preds.forEach(p => {
      if (wc(gr.drafts[p.id]) > 10) drafted++;
      const arr = gr.checks[p.id] || [];
      if (p.checks.every((c, i) => arr[i])) graded++;
    });
    return { drafted, graded };
  }
  function renderHome() {
    const pd = practiceProgress(), gp = gradeProgress(), ds = drillStats();
    const pct = Math.round(ds.mastered / ds.total * 100);
    MAIN.innerHTML =
      `<div class="whero"><h1>作文模版</h1><p>请选择大作文、小作文学习目录或作文课后练习。</p>` +
      `<div class="wstats">` +
      `<span><b>${ds.mastered}<em>/${ds.total}</em></b><i>句已默写掌握 · ${pct}%</i></span>` +
      `<span><b>${pd}<em>/${W.practice.sessions.length}</em></b><i>次课后练习完成</i></span>` +
      `<span><b>${gp.drafted}<em>/${W.preds.length}</em></b><i>篇预测已写</i></span>` +
      `</div></div>` +
      `<section class="wsec"><h2>(一) 大作文<span class="cnt">${W.big.length} 个模版</span></h2><div class="wcards">` + W.big.map(card).join('') + `</div></section>` +
      `<section class="wsec"><h2>(二) 小作文<span class="cnt">${W.small.length} 个模版</span></h2><div class="wcards">` + W.small.map(card).join('') + `</div></section>` +
      (() => {
        const ys = [...new Set(Object.keys(W.samples).map(sampleYear).filter(Boolean))].sort((a, b) => b - a);
        if (!ys.length) return '';
        return `<section class="wsec"><h2>真题范文<span class="cnt">${ys.length} 年 · 点年份看原卷与范文</span></h2>` +
          `<div class="wyears">` + ys.map(y => `<a href="#/year/${y}">${y}</a>`).join('') + `</div></section>`;
      })() +
      `<section class="wsec"><h2>练与测<span class="cnt">句库 / 练习 / 批改 / 打印</span></h2><div class="wcards">` +
      `<a class="wcard red" href="#/core"><span class="no">句库</span>` +
      `<span class="tt"><b>核心句库</b><i>八哥背诵句 12 组 · 全部题型共用一套句</i>` +
      `<span class="wprog"><b style="width:${Math.round(ds.mastered / ds.total * 100)}%;background:var(--red)"></b></span></span>` +
      `<span class="tg">默写 ${ds.mastered}/${ds.total}</span><span class="ar">›</span></a>` +
      `<a class="wcard blue" href="#/practice"><span class="no">练习</span>` +
      `<span class="tt"><b>作文课后练习</b><i>${W.practice.sub}</i><span class="wprog"><b style="width:${Math.round(pd / W.practice.sessions.length * 100)}%;background:var(--blue)"></b></span></span>` +
      `<span class="tg">${pd}/${W.practice.sessions.length}</span><span class="ar">›</span></a>` +
      `<a class="wcard green" href="#/grade"><span class="no">批改</span>` +
      `<span class="tt"><b>作文批改</b><i>${W.preds.length} 道预测题 · 写完对照范文自评</i></span>` +
      `<span class="tg">写 ${gp.drafted}/${W.preds.length} · 评 ${gp.graded}/${W.preds.length}</span><span class="ar">›</span></a>` +
      `<a class="wcard" href="#/cram"><span class="no">一页纸</span>` +
      `<span class="tt"><b>考前一页纸</b><i>句库浓缩成 2 页 · 可直接打印</i></span>` +
      `<span class="tg">打印</span><span class="ar">›</span></a>` +
      `</div></section>`;
    $('#wtT').textContent = '作文模版';
    document.title = '作文模版 · e2';
  }

  /* ───── 核心句库目录 ───── */
  function coreCard(c) {
    return `<a class="wcard" href="#/t/${c.id}"><span class="no">${c.no}</span>` +
      `<span class="tt"><b>${c.title}</b><i>${c.tag}</i></span><span class="ar">›</span></a>`;
  }
  function renderCore() {
    const ds = drillStats();
    const small = W.core.filter(c => +c.id.slice(1) <= 8);
    const big = W.core.filter(c => +c.id.slice(1) > 8);
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>核心句库</h1><p>八哥背诵句 12 组 · 全部题型共用:小作文素材包、大作文获益句是同一套。点开逐句背,背完去默写。</p></div>` +
      `<a class="drillcta" href="#/drill">句子循环练 · 挖空默写<span>已掌握 ${ds.mastered}/${ds.total} · 写错的句自动回队,直到全对</span><b>去默写 ›</b></a>` +
      `<section class="wsec"><h2>小作文 · 素材包<span class="cnt">8 组 · 首段尾段到各类信件</span></h2><div class="wcards">` +
      small.map(coreCard).join('') + `</div></section>` +
      `<section class="wsec"><h2>大作文 · 数据与论证<span class="cnt">4 组 · 图表句、获益原因、收尾</span></h2><div class="wcards">` +
      big.map(coreCard).join('') + `</div></section>`;
    $('#wtT').textContent = '核心句库';
    document.title = '核心句库 · e2';
  }

  /* ───── 句子循环练(挖空默写 · 错题回队) ───── */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[’']/g, '').replace(/[.,!?;:"()—-]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function renderDrill(gid) {
    const group = gid ? W.core.find(c => c.id === gid) : null;
    let items = W.drill.map((d, i) => Object.assign({ i }, d));
    if (gid) items = items.filter(d => d.g === gid);
    if (!items.length) return renderCore();
    let queue = items.slice();
    let round = 1, hit = 0, miss = 0;
    $('#wtT').textContent = '句子循环练';
    document.title = '句子循环练 · e2';

    function head() {
      const total = items.length, left = queue.length;
      return `<div class="drill-hd"><a class="wback" href="${gid ? '#/t/' + gid : '#/core'}">‹ ${gid ? '返回句组' : '返回句库'}</a>` +
        `<div class="drill-meta"><b>${group ? group.no + ' ' + group.title : '全部句组'}</b>` +
        `<span>第 ${round} 轮 · 剩 ${left}/${total} · ✓${hit} ✗${miss}</span></div></div>`;
    }
    function renderCurrent() {
      const d = queue[0];
      const sentence = d.s.replace(/(_+\s*)+/, '<i class="blank">______</i>');
      MAIN.innerHTML = head() +
        `<div class="drill-card"><p class="drill-sent">${sentence}</p>` +
        `<p class="drill-zh">提示:${d.zh}</p>` +
        `<div class="drill-row"><input id="drillIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="填空(忽略大小写和标点)"><button id="drillGo" class="drill-btn">检查</button></div>` +
        `<div class="drill-fb" id="drillFb" hidden></div>` +
        `<div class="drill-ops"><button id="drillPeek" class="drill-ghost">看答案(回队重练)</button></div></div>`;
      const input = $('#drillIn'), fb = $('#drillFb');
      input.focus();
      const judge = () => {
        const val = input.value;
        if (!val.trim()) return;
        const st = DR();
        if (norm(val) === norm(d.a)) {
          st.ok[d.i] = (st.ok[d.i] || 0) + 1;
          LS.write(DK, st);
          hit++;
          queue.shift();
          if (!queue.length) return renderDone();
          renderCurrent();
        } else {
          st.bad[d.i] = (st.bad[d.i] || 0) + 1;
          LS.write(DK, st);
          miss++;
          fb.hidden = false;
          fb.innerHTML = `<span class="no-x">✗ 再想想 · 正确答案:<b>${d.a}</b>${queue.length > 1 ? '(这句回队尾,后面还会再出)' : '(只有这一句,再写一遍)'}</span>`;
          input.value = '';
          /* 答错按文案回队尾:点「下一句」把本句移到队尾继续练,直到全对。 */
          const go = $('#drillGo');
          go.textContent = '下一句';
          go.onclick = () => { queue.push(queue.shift()); renderCurrent(); };
          input.focus();
        }
      };
      /* 用 onclick 而非 addEventListener:下面「下一句」要整体替换处理器,
         两者混用会让一次点击既判题又跳下一句。 */
      $('#drillGo').onclick = judge;
      input.addEventListener('keydown', e => {
        if (e.isComposing || e.keyCode === 229) return;   // 输入法选词时的 Enter 不算提交
        if (e.key === 'Enter') { e.preventDefault(); $('#drillGo').onclick(); }
      });
      $('#drillPeek').addEventListener('click', () => {
        const st = DR();
        st.bad[d.i] = (st.bad[d.i] || 0) + 1;
        LS.write(DK, st);
        miss++;
        fb.hidden = false;
        fb.innerHTML = `<span class="no-x">答案:<b>${d.a}</b>(这句回队尾,还会再出)</span>`;
        queue.push(queue.shift());
        const go = $('#drillGo');
        go.textContent = '下一句';
        go.onclick = () => renderCurrent();
      });
    }
    function renderDone() {
      const ds = drillStats();
      MAIN.innerHTML = head() +
        `<div class="drill-card drill-done"><h2>✓ 本轮全对</h2>` +
        `<p>本轮答对 ${hit} 句、答错回队 ${miss} 次。全站默写掌握:<b>${ds.mastered}/${ds.total}</b>(答对次数超过答错的句子算已掌握)。</p>` +
        `<div class="drill-ops"><a class="drill-btn" href="#/drill">再来一轮(全部)</a>` +
        (gid ? `<a class="drill-btn ghost" href="#/drill/${gid}">只练本组</a>` : '') +
        `<a class="drill-btn ghost" href="#/core">回句库</a></div></div>`;
    }
    renderCurrent();
  }

  /* ───── 模版/句库详情 ───── */
  function sampleChips(sid) {
    const y = sampleYear(sid);
    const t = W.samples[sid].title.replace(/^[^·]*·\s*/, '').replace(/\(.*?\)/g, '').trim();
    return `<a class="schip" href="#/s/${sid}"><b>${t}</b>` +
      `<i>${y ? y + ' 真题' : '预测 / 原创'} · ${wc(W.samples[sid].en)} 词</i></a>`;
  }
  function renderTpl(t) {
    const rel = /^c\d+$/.test(t.id) ? (GROUP_SAMPLES[t.id] || []) : [];
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="wd-hd"><h1>${t.no} · ${t.title}</h1><span class="tag">${t.tag}</span></div>` +
      `<div class="wdetail">${t.html}</div>` +
      (rel.length
        ? `<section class="wrel"><h3>用到这组句的范文<span class="cnt">${rel.length} 篇</span></h3>` +
          `<div class="schips">${rel.map(sampleChips).join('')}</div></section>`
        : '');
    MAIN.querySelectorAll('[data-sample]').forEach(el => { el.classList.add('wsample'); el.innerHTML = sampleHtml(el.dataset.sample); });
    bindToggles(MAIN);
    $('#wtT').textContent = `${t.no} ${t.title}`;
    document.title = `${t.no} ${t.title} · e2`;
  }

  /* ───── 单篇范文(内容图的中心节点) ───── */
  const SAMPLE_GROUPS = {};
  Object.keys(GROUP_SAMPLES).forEach(g => {
    GROUP_SAMPLES[g].forEach(k => { (SAMPLE_GROUPS[k] = SAMPLE_GROUPS[k] || []).push(g); });
  });
  function renderSample(sid) {
    const s = W.samples[sid];
    if (!s) return renderHome();
    const y = sampleYear(sid);
    const gs = SAMPLE_GROUPS[sid] || [];
    MAIN.innerHTML =
      `<button class="wback wback-btn" id="sBack" type="button">‹ 返回</button>` +
      `<div class="wd-hd"><h1>${s.title}</h1>` +
      `<span class="tag">${y ? y + ' 年真题 · 第' + (sid.charAt(0) === 'l' ? 47 : 48) + ' 题' : '预测 / 原创范文'}</span>` +
      `<p class="wd-meta">${wc(s.en)} 词 · 来自八哥体系</p></div>` +
      `<div class="wdetail"><div class="wsample">${sampleHtml(sid, '#/s/' + sid)}</div>` +
      (gs.length
        ? `<section class="wrel"><h3>这篇用到的句库<span class="cnt">${gs.length} 组</span></h3>` +
          `<div class="schips">${gs.map(gid => {
            const c = W.core.find(x => x.id === gid);
            return `<a class="schip" href="#/t/${gid}"><b>${c.no} ${c.title}</b><i>${c.tag}</i></a>`;
          }).join('')}</div></section>`
        : '') +
      `</div>`;
    bindToggles(MAIN);
    const b = $('#sBack');
    if (b) b.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.hash = '#/core';
    });
    $('#wtT').textContent = s.title;
    document.title = `${s.title} · e2`;
  }

  /* ───── 课后练习 ───── */
  function refreshSessionMarks(n) {
    const s = SESSION[+n]; if (!s) return;
    const arr = PR().checks[n] || [];
    const ok = s.checks.every((c, i) => arr[i]);
    const el = $(`.wsess details[data-n="${n}"] .sd`);
    if (el) el.innerHTML = ok ? `<span class="done-mark">✓ 完成</span>` : s.days;
  }
  function refreshPracticeBar() {
    const bar = $('.wprogbar .bar b'), span = $('.wprogbar span');
    if (!bar) return;
    const pd = practiceProgress(), total = W.practice.sessions.length;
    bar.style.width = Math.round(pd / total * 100) + '%';
    span.textContent = `${pd}/${total} 完成`;
  }
  function sessionItem(s, openN) {
    const arr = PR().checks[s.n] || [];
    const ok = s.checks.every((c, i) => arr[i]);
    const link = s.linkext
      ? `<a class="golink" href="${s.linkext}">打开真题页(第 47、48 题)›</a>`
      : (s.link && TPL[s.link] ? `<a class="golink" href="#/t/${s.link}">背「${TPL[s.link].no} ${TPL[s.link].title}」›</a>` : '');
    const samples = (s.sarr || []).map(k => `<div class="wsample" data-sample="${k}" data-ctx="#/practice/${s.n}"></div>`).join('');
    const chart = s.fig
      ? `<figure class="wfig"><img src="${s.fig}" alt="作文题图表" loading="lazy">` +
        `<figcaption>题目图表 · 裁切自真题 PDF,只含写作题图</figcaption></figure>`
      : (s.data ? `<table class="wdata">${s.data}</table>` : '');
    return `<details class="wsess" data-n="${s.n}"${s.n === openN ? ' open' : ''}>` +
      `<summary><span class="sn ${s.kind === '大作文' ? 'big' : ''}">第${CN_NUM[s.n - 1]}次</span>` +
      `<span class="st"><b>${s.title}</b><i>${s.kind} · ${s.type} · ${s.days}</i></span>` +
      `<span class="sd">${ok ? '<span class="done-mark">✓ 完成</span>' : s.days}</span></summary>` +
      `<div class="bd"><p class="cn">${s.cn}</p><p class="en">${s.en}</p>${chart}` +
      `<p class="tm">${s.time}</p>${link}${samples}${checkHtml('p', s.n, s.checks)}</div></details>`;
  }
  function renderPractice(openN) {
    const pd = practiceProgress(), total = W.practice.sessions.length;
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>作文课后练习</h1><p>${W.practice.sub}</p></div>` +
      `<div class="wprogbar"><div class="bar"><b style="width:${Math.round(pd / total * 100)}%;background:var(--red)"></b></div><span>${pd}/${total} 完成</span></div>` +
      `<p class="wnote">写完点开范文对照;勾完全部自查项才算这次完成。范文都是八哥带练原文,里面的句子和句库一模一样。</p>` +
      `<ul class="wsess">` + W.practice.sessions.map(s => sessionItem(s, openN)).join('') + `</ul>`;
    MAIN.querySelectorAll('[data-sample]').forEach(el => {
      el.classList.add('wsample');
      el.innerHTML = sampleHtml(el.dataset.sample, el.dataset.ctx);
    });
    bindToggles(MAIN);
    paintChecks(MAIN);
    if (openN) {
      const d = MAIN.querySelector(`details[data-n="${openN}"]`);
      if (d) d.scrollIntoView({ block: 'start' });
    }
    $('#wtT').textContent = '作文课后练习';
    document.title = '作文课后练习 · e2';
  }

  /* ───── 批改列表 ───── */
  function predStatus(id) {
    const gr = GR();
    if ((gr.checks[id] || []).length && PRED[id].checks.every((c, i) => (gr.checks[id] || [])[i])) return 2;
    if (wc(gr.drafts[id]) > 10) return 1;
    return 0;
  }
  function refreshPredStatus(id) {
    const el = $(`a.wp[data-id="${id}"] .st`);
    if (el) { const s = predStatus(id); el.textContent = ['未写', '已写草稿', '已自评 ✓'][s]; el.className = `st s${s}`; }
  }
  let GF = 'all';
  function renderGrade() {
    const cnt = {
      all: W.preds.length,
      big: W.preds.filter(p => p.kind === '大作文').length,
      small: W.preds.filter(p => p.kind === '小作文').length
    };
    const list = W.preds.filter(p => GF === 'all' || p.kind === (GF === 'big' ? '大作文' : '小作文'));
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>作文批改</h1><p>作文课后批改 · 先自己写,再对照范文自评</p></div>` +
      `<div class="wfilter">` +
      [['all', '全部'], ['big', '大作文'], ['small', '小作文']].map(([k, t]) =>
        `<button type="button" data-f="${k}"${GF === k ? ' class="on"' : ''}>${t}<i>${cnt[k]}</i></button>`).join('') +
      `</div>` +
      `<div class="wpreds">` + list.map(p => {
        const s = predStatus(p.id);
        return `<a class="wp" data-id="${p.id}" href="#/g/${p.id}"><span class="no">${p.no}</span>` +
          `<span class="tt"><b>${p.title}</b><i>(${p.kind})</i></span>` +
          `<span class="st s${s}">${['未写', '已写草稿', '已自评 ✓'][s]}</span><span class="ar">›</span></a>`;
      }).join('') + `</div>`;
    MAIN.querySelectorAll('.wfilter button').forEach(b => {
      b.addEventListener('click', () => { GF = b.dataset.f; renderGrade(); });
    });
    $('#wtT').textContent = '作文批改';
    document.title = '作文批改 · e2';
  }

  /* ───── 预测题详情 ───── */
  function renderPred(p) {
    const big = p.kind === '大作文';
    const s = predStatus(p.id);
    const data = p.data ? `<table class="wdata">${p.data}</table>` : '';
    MAIN.innerHTML =
      `<a class="wback" href="#/grade">‹ 返回批改列表</a>` +
      `<div class="wd-hd"><h1>${p.no} · ${p.title}</h1>` +
      `<span class="tag">${p.kind} · ${p.type}</span>` +
      `<p class="wd-meta">范文 ${wc(W.samples[p.sample].en)} 词 · 状态:${['未写', '已写草稿', '已自评 ✓'][s]}</p></div>` +
      `<div class="wdetail">` +
      `<div class="wtask"><p class="cn">${p.cn}</p>${data}<p class="dir">${p.dir}</p></div>` +
      `<div class="warea"><textarea id="ta_${p.id}" data-draft="${p.id}" spellcheck="false" placeholder="在这里写,自动保存在本机…"></textarea>` +
      `<div class="wcount"><span>已写 <b id="wc_${p.id}">0</b> 词 · 目标 ${big ? '150 词左右' : '100 词左右'}</span><span>本机自动保存</span></div></div>` +
      `<div class="wsteps">` +
      `<details><summary>审题思路<span class="hint">写之前看</span></summary><div class="bd"><ol>` +
      p.think.map(x => `<li>${x}</li>`).join('') + `</ol></div></details>` +
      `<details><summary>参考提纲<span class="hint">卡住了再看</span></summary><div class="bd"><ul>` +
      p.outline.map(x => `<li>${x}</li>`).join('') + `</ul></div></details>` +
      `<details><summary>高分句型<span class="hint">${p.sents.length} 句 · 和句库同源</span></summary><div class="bd"><ul class="wsent-in">` +
      p.sents.map(x => `<li><span class="en">${x[0]}</span><span class="zh">${x[1]}</span></li>`).join('') +
      `</ul></div></details>` +
      `<details><summary>参考范文<span class="hint">写完再看</span></summary><div class="bd">` +
      `<div class="wsample">${sampleHtml(p.sample, '#/g/' + p.id)}</div></div></details>` +
      `<details><summary>自评清单<span class="hint">${p.checks.length} 条</span></summary><div class="bd">` +
      checkHtml('g', p.id, p.checks) + `</div></details>` +
      `</div></div>`;
    bindToggles(MAIN);
    bindDrafts(MAIN);
    paintChecks(MAIN);
    $('#wtT').textContent = `${p.no} ${p.title}`;
    document.title = `${p.no} ${p.title} · e2`;
  }

  /* ───── 考前一页纸 ───── */
  const stripTags = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  function coreSent(cid, idx) {
    const c = W.core.find(x => x.id === cid);
    if (!c) return '';
    const arr = [...c.html.matchAll(/<li><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/li>/g)];
    return arr[idx] ? stripTags(arr[idx][1]) : '';
  }
  function cramBlock(title, picks) {
    const rows = picks.map(([cid, i]) => coreSent(cid, i)).filter(Boolean);
    if (!rows.length) return '';
    return `<section class="cram-b"><h2>${title}</h2>` + rows.map(s => `<p>${s}</p>`).join('') + `</section>`;
  }
  function renderCram() {
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>考前一页纸</h1><p>把 12 组句库压成一页:小作文骨架、大作文三段、格式差异。打印出来考前扫一遍。</p></div>` +
      `<div class="cram-ops"><button class="drill-btn" id="cramPrint" type="button">打印 / 存成 PDF</button>` +
      `<span>建议 A4 · 双栏 · 2 页内</span></div>` +
      `<div class="cram-grid">` +
      cramBlock('小作文 · 首段与尾段(句库 01)', [['c1', 0], ['c1', 3], ['c1', 4]]) +
      cramBlock('大作文 · 动态图第一段(句库 09)', [['c9', 0], ['c9', 1]]) +
      cramBlock('大作文 · 静态图第一段(句库 10)', [['c10', 3], ['c10', 0], ['c10', 1], ['c10', 2]]) +
      cramBlock('大作文 · 第二段(句库 11)', [['c11', 0], ['c11', 1], ['c11', 3], ['c11', 6]]) +
      cramBlock('大作文 · 第三段收尾(句库 12)', [['c12', 0]]) +
      cramBlock('组合题 · 先漫画后图表(句库 12)', [['c12', 2], ['c12', 3]]) +
      `</div>` +
      `<section class="cram-b cram-fmt"><h2>四种格式 · 头尾别写错</h2>` +
      `<table><tr><th>题型</th><th>头</th><th>尾</th></tr>` +
      `<tr><td>书信</td><td>Dear Sir or Madam / Dear + 人名</td><td>I really hope… + looking forward to your early reply + Yours sincerely, Li Ming</td></tr>` +
      `<tr><td>告示</td><td>Notice 居中 + 日期(标题下一行右侧)</td><td>联系方式 + Come on and join us now! + 机构落款</td></tr>` +
      `<tr><td>纪要</td><td>Subject / Date / Location / Present 顶格</td><td>The minutes are as follows: 后编号列 3 个要点</td></tr>` +
      `<tr><td>备忘录</td><td>To / From / Date / Subject 四行</td><td>直接列要点,不写书信尾段</td></tr>` +
      `</table></section>` +
      `<p class="cram-foot">句子全部来自核心句库,和真题范文同源;背不下来就先回句库逐句过一遍。</p>`;
    const btn = $('#cramPrint');
    if (btn) btn.addEventListener('click', () => window.print());
    $('#wtT').textContent = '考前一页纸';
    document.title = '考前一页纸 · e2';
  }

  /* ───── 按真题年份看作文(从原卷进来时的落点) ───── */
  function renderYear(y) {
    const list = Object.keys(W.samples).filter(k => sampleYear(k) === y);
    const preds = W.preds.filter(p => sampleYear(p.sample) === y);
    const sess = W.practice.sessions.filter(s => (s.sarr || []).some(k => sampleYear(k) === y));
    MAIN.innerHTML =
      `<a class="wback" href="#/grade">‹ 返回批改</a>` +
      `<div class="whero-sm"><h1>${y} 真题 · 作文</h1>` +
      `<p>这一年的大小作文范文,以及它在练习、预测里的位置。</p></div>` +
      `<div class="wyear-links">` +
      `<a class="drill-btn ghost" href="index.html?y=${y}&u=${y}-w47">打开原卷 第 47 题(小作文)›</a>` +
      `<a class="drill-btn ghost" href="index.html?y=${y}&u=${y}-w48">第 48 题(大作文)›</a>` +
      `</div>` +
      (list.length
        ? `<section class="wsec"><h2>范文<span class="cnt">${list.length} 篇</span></h2><div class="schips">${list.map(sampleChips).join('')}</div></section>`
        : `<section class="wsec"><h2>这一年还没有收录范文</h2>` +
          `<p class="wnote">先看几道同题型的预测范文,写法和真题一致:</p><div class="schips">` +
          W.preds.slice(0, 4).map(p => `<a class="schip" href="#/g/${p.id}"><b>${p.no} ${p.title}</b><i>${p.kind} · ${p.type}</i></a>`).join('') +
          `</div></section>`) +
      (preds.length
        ? `<section class="wsec"><h2>作为预测题<span class="cnt">${preds.length} 道</span></h2><div class="schips">` +
          preds.map(p => `<a class="schip" href="#/g/${p.id}"><b>${p.no} ${p.title}</b><i>${p.kind} · ${p.type}</i></a>`).join('') +
          `</div></section>`
        : '') +
      (sess.length
        ? `<section class="wsec"><h2>在练习里<span class="cnt">${sess.length} 次</span></h2><div class="schips">` +
          sess.map(s => `<a class="schip" href="#/practice/${s.n}"><b>第${CN_NUM[s.n - 1]}次 · ${s.title}</b><i>${s.kind} · ${s.type}</i></a>`).join('') +
          `</div></section>`
        : '');
    $('#wtT').textContent = `${y} 真题作文`;
    document.title = `${y} 真题作文 · e2`;
  }

  /* ───── 路由 ───── */
  /* 顶部五个入口跟随当前页高亮:用户随时知道自己在哪、能去哪 */
  const NAV_MAP = { '': '#/', core: '#/core', drill: '#/core', t: '#/', s: '#/core',
    practice: '#/practice', grade: '#/grade', g: '#/grade', cram: '#/cram', year: '#/' };
  function markNav(key) {
    const nav = document.getElementById('wnav');
    if (!nav) return;
    const want = NAV_MAP[key] || '#/';
    nav.querySelectorAll('a').forEach(a => {
      if (a.getAttribute('href') === want) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function render() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    markNav(parts[0] || '');
    if (parts[0] === 'core') return renderCore();
    if (parts[0] === 'drill') return renderDrill(parts[1]);
    if (parts[0] === 't' && TPL[parts[1]]) return renderTpl(TPL[parts[1]]);
    if (parts[0] === 's' && W.samples[parts[1]]) return renderSample(parts[1]);
    if (parts[0] === 'year' && /^\d{4}$/.test(parts[1] || '')) return renderYear(+parts[1]);
    if (parts[0] === 'practice') return renderPractice(+parts[1] || 0);
    if (parts[0] === 'grade') return renderGrade();
    if (parts[0] === 'cram') return renderCram();
    if (parts[0] === 'g' && PRED[parts[1]]) return renderPred(PRED[parts[1]]);
    return renderHome();
  }
  window.addEventListener('hashchange', render);
  render();
})();
