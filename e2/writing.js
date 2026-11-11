/* e2 作文模版 · 渲染逻辑
   数据 window.WR2(writing-data.js)。
   路由:#/ 目录 · #/core 核心句库 · #/drill[/组] 挖空循环练 · #/t/<id> 模版/句库详情
        · #/practice 练习 · #/grade 批改 · #/g/<id> 预测题。
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

  /* ───── 范文块 ───── */
  function sampleHtml(sid) {
    const s = W.samples[sid];
    if (!s) return '';
    return `<div class="ws-hd"><b>${s.title}</b><span>范文 · ${wc(s.en)} 词</span></div>` +
      `<div class="ws-en">${s.en}</div>` +
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
  function bindDrafts(root) {
    const gr = GR();
    root.querySelectorAll('textarea[data-draft]').forEach(ta => {
      const id = ta.dataset.draft;
      ta.value = gr.drafts[id] || '';
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
    MAIN.innerHTML =
      `<div class="whero"><h1>作文模版</h1><p>请选择大作文、小作文学习目录或作文课后练习。</p></div>` +
      `<section class="wsec"><h2>(一) 大作文</h2><div class="wcards">` + W.big.map(card).join('') + `</div></section>` +
      `<section class="wsec"><h2>(二) 小作文</h2><div class="wcards">` + W.small.map(card).join('') + `</div></section>` +
      `<section class="wsec"><div class="wcards">` +
      `<a class="wcard red" href="#/core"><span class="no">句库</span>` +
      `<span class="tt"><b>核心句库</b><i>八哥背诵句 12 组 · 全部题型共用一套句</i>` +
      `<span class="wprog"><b style="width:${Math.round(ds.mastered / ds.total * 100)}%;background:var(--red)"></b></span></span>` +
      `<span class="tg">默写 ${ds.mastered}/${ds.total}</span><span class="ar">›</span></a>` +
      `<a class="wcard blue" href="#/practice"><span class="no">练习</span>` +
      `<span class="tt"><b>作文课后练习</b><i>${W.practice.sub}</i><span class="wprog"><b style="width:${Math.round(pd / W.practice.sessions.length * 100)}%;background:var(--blue)"></b></span></span>` +
      `<span class="tg">${pd}/${W.practice.sessions.length}</span><span class="ar">›</span></a>` +
      `<a class="wcard green" href="#/grade"><span class="no">批改</span>` +
      `<span class="tt"><b>作文批改</b><i>9 道预测题 · 写完对照范文自评</i></span>` +
      `<span class="tg">写 ${gp.drafted}/9 · 评 ${gp.graded}/9</span><span class="ar">›</span></a>` +
      `</div></section>`;
    $('#wtT').textContent = '作文模版';
    document.title = '作文模版 · e2';
  }

  /* ───── 核心句库目录 ───── */
  function renderCore() {
    const ds = drillStats();
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>核心句库</h1><p>八哥背诵句 12 组 · 全部题型共用:小作文素材包、大作文获益句是同一套。点开逐句背,背完去默写。</p></div>` +
      `<a class="drillcta" href="#/drill">句子循环练 · 挖空默写<span>已掌握 ${ds.mastered}/${ds.total} · 写错的句自动回队,直到全对</span><b>去默写 ›</b></a>` +
      `<div class="wcards" style="margin-top:16px">` +
      W.core.map(c => `<a class="wcard" href="#/t/${c.id}"><span class="no">${c.no}</span>` +
        `<span class="tt"><b>${c.title}</b><i>${c.tag}</i></span><span class="ar">›</span></a>`).join('') +
      `</div>`;
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
          fb.innerHTML = `<span class="no-x">✗ 再想想 · 正确答案:<b>${d.a}</b></span>`;
          input.value = '';
          input.focus();
        }
      };
      /* 用 onclick 而非 addEventListener:下面「下一句」要整体替换处理器,
         两者混用会让一次点击既判题又跳下一句。 */
      $('#drillGo').onclick = judge;
      input.addEventListener('keydown', e => {
        if (e.isComposing || e.keyCode === 229) return;   // 输入法选词时的 Enter 不算提交
        if (e.key === 'Enter') judge();
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
  function renderTpl(t) {
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="wd-hd"><h1>${t.no} · ${t.title}</h1><span class="tag">${t.tag}</span></div>` +
      `<div class="wdetail">${t.html}</div>`;
    MAIN.querySelectorAll('[data-sample]').forEach(el => { el.classList.add('wsample'); el.innerHTML = sampleHtml(el.dataset.sample); });
    bindToggles(MAIN);
    $('#wtT').textContent = `${t.no} ${t.title}`;
    document.title = `${t.no} ${t.title} · e2`;
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
  function sessionItem(s) {
    const arr = PR().checks[s.n] || [];
    const ok = s.checks.every((c, i) => arr[i]);
    const link = s.linkext
      ? `<a class="golink" href="${s.linkext}">打开真题页(第 47、48 题)›</a>`
      : (s.link && TPL[s.link] ? `<a class="golink" href="#/t/${s.link}">背「${TPL[s.link].no} ${TPL[s.link].title}」›</a>` : '');
    const samples = (s.sarr || []).map(k => `<div class="wsample" data-sample="${k}"></div>`).join('');
    const chart = s.fig
      ? `<figure class="wfig"><img src="${s.fig}" alt="图表" loading="lazy"></figure>`
      : (s.data ? `<table class="wdata">${s.data}</table>` : '');
    return `<details class="wsess" data-n="${s.n}">` +
      `<summary><span class="sn ${s.kind === '大作文' ? 'big' : ''}">第${CN_NUM[s.n - 1]}次</span>` +
      `<span class="st"><b>${s.title}</b><i>${s.kind} · ${s.type} · ${s.days}</i></span>` +
      `<span class="sd">${ok ? '<span class="done-mark">✓ 完成</span>' : s.days}</span></summary>` +
      `<div class="bd"><p class="cn">${s.cn}</p><p class="en">${s.en}</p>${chart}` +
      `<p class="tm">${s.time}</p>${link}${samples}${checkHtml('p', s.n, s.checks)}</div></details>`;
  }
  function renderPractice() {
    const pd = practiceProgress(), total = W.practice.sessions.length;
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>作文课后练习</h1><p>${W.practice.sub}</p></div>` +
      `<div class="wprogbar"><div class="bar"><b style="width:${Math.round(pd / total * 100)}%;background:var(--red)"></b></div><span>${pd}/${total} 完成</span></div>` +
      `<p class="wnote">写完点开范文对照;勾完全部自查项才算这次完成。范文都是八哥带练原文,里面的句子和句库一模一样。</p>` +
      `<ul class="wsess">` + W.practice.sessions.map(sessionItem).join('') + `</ul>`;
    MAIN.querySelectorAll('[data-sample]').forEach(el => { el.classList.add('wsample'); el.innerHTML = sampleHtml(el.dataset.sample); });
    bindToggles(MAIN);
    paintChecks(MAIN);
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
  function renderGrade() {
    MAIN.innerHTML =
      `<a class="wback" href="#/">‹ 返回目录</a>` +
      `<div class="whero-sm"><h1>作文批改</h1><p>作文课后批改 · 先自己写,再对照范文自评</p></div>` +
      `<div class="wpreds">` + W.preds.map(p => {
        const s = predStatus(p.id);
        return `<a class="wp" data-id="${p.id}" href="#/g/${p.id}"><span class="no">${p.no}</span>` +
          `<span class="tt"><b>${p.title}</b><i>(${p.kind})</i></span>` +
          `<span class="st s${s}">${['未写', '已写草稿', '已自评 ✓'][s]}</span><span class="ar">›</span></a>`;
      }).join('') + `</div>`;
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
      `<div class="wsample">${sampleHtml(p.sample)}</div></div></details>` +
      `<details><summary>自评清单<span class="hint">${p.checks.length} 条</span></summary><div class="bd">` +
      checkHtml('g', p.id, p.checks) + `</div></details>` +
      `</div></div>`;
    bindToggles(MAIN);
    bindDrafts(MAIN);
    paintChecks(MAIN);
    $('#wtT').textContent = `${p.no} ${p.title}`;
    document.title = `${p.no} ${p.title} · e2`;
  }

  /* ───── 路由 ───── */
  function render() {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'core') return renderCore();
    if (parts[0] === 'drill') return renderDrill(parts[1]);
    if (parts[0] === 't' && TPL[parts[1]]) return renderTpl(TPL[parts[1]]);
    if (parts[0] === 'practice') return renderPractice();
    if (parts[0] === 'grade') return renderGrade();
    if (parts[0] === 'g' && PRED[parts[1]]) return renderPred(PRED[parts[1]]);
    return renderHome();
  }
  window.addEventListener('hashchange', render);
  render();
})();
