/* e2 — 考研英语二真题 · A4 打印
   数据由 scripts/e2/build.py 生成;本文件只负责选题、排版与打印。 */
(function () {
  'use strict';
  const D = window.E2 || { years: [], papers: [] };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEC = { cloze: '完形', reading: '阅读', partb: 'Part B', translation: '翻译', writing: '写作' };
  const SECS = [['all', '全部'], ['cloze', '完形'], ['reading', '阅读'], ['partb', 'Part B'], ['translation', '翻译'], ['writing', '写作']];

  const S = {
    y: D.years[D.years.length - 1] || 2025,
    sec: 'all',
    sel: {},                 // uid -> Set(题号)
    open: {},                // uid -> 展开小题
    mode: 'unit', orig: false, ans: false
  };
  const paper = y => D.papers.find(p => p.y === y);
  const units = () => (paper(S.y) ? paper(S.y).units : []);
  const shown = () => units().filter(u => S.sec === 'all' || u.sec === S.sec);
  function ensure(uid) {
    if (!S.sel[uid]) {
      const u = units().find(x => x.id === uid);
      S.sel[uid] = new Set((u ? u.qs : []).map(q => q.n));
    }
    return S.sel[uid];
  }

  /* ───── 选题页 ───── */
  function drawYears() {
    $('#years').innerHTML = D.years.map(y =>
      `<button class="chip${y === S.y ? ' on' : ''}" data-y="${y}">${y}</button>`).join('');
    $$('#years .chip').forEach(b => b.onclick = () => {
      S.y = +b.dataset.y; S.sel = {}; S.open = {};
      units().forEach(u => ensure(u.id)); drawYears(); drawList();
    });
  }
  function drawSecs() {
    $('#secs').innerHTML = SECS.map(([k, t]) =>
      `<button class="chip${k === S.sec ? ' on' : ''}" data-s="${k}">${t}</button>`).join('');
    $$('#secs .chip').forEach(b => b.onclick = () => { S.sec = b.dataset.s; drawSecs(); drawList(); });
  }
  function drawList() {
    const list = shown();
    if (!list.length) { $('#list').innerHTML = '<div class="u-h">这份卷子没有该题型</div>'; return; }
    $('#list').innerHTML = list.map(u => {
      const sel = ensure(u.id), n = sel.size, tot = u.qs.length;
      return `<div class="u${S.open[u.id] ? ' open' : ''}" data-u="${u.id}">
        <div class="u-h">
          <input type="checkbox" class="u-c" ${n ? 'checked' : ''} ${n && n < tot ? 'data-part="1"' : ''} aria-label="选择${esc(u.label)}">
          <div class="u-t"><b>${esc(u.label)}</b><i>${tot} 题 · ${SEC[u.sec]}</i></div>
          <button class="u-x">${S.open[u.id] ? '收起' : '选小题 ▾'}</button>
        </div>
        <div class="u-q">${u.qs.map(q =>
          `<label><input type="checkbox" class="q-c" data-n="${q.n}" ${sel.has(q.n) ? 'checked' : ''}>${q.n}</label>`).join('')}</div>
      </div>`;
    }).join('');
    $$('#list .u').forEach(row => {
      const uid = row.dataset.u, u = units().find(x => x.id === uid), sel = ensure(uid);
      const uc = $('.u-c', row);
      if (uc.dataset.part) uc.indeterminate = true;
      uc.onchange = () => { if (uc.checked) u.qs.forEach(q => sel.add(q.n)); else sel.clear(); drawList(); };
      $('.u-x', row).onclick = e => { e.stopPropagation(); S.open[uid] = !S.open[uid]; drawList(); };
      $$('.q-c', row).forEach(c => c.onchange = () => {
        const n = +c.dataset.n; c.checked ? sel.add(n) : sel.delete(n); drawList();
      });
      $('.u-h', row).onclick = e => { if (e.target === uc || e.target.closest('.u-x')) return; uc.checked = !uc.checked; uc.onchange(); };
    });
    $('#tip').textContent = `共 ${D.papers.length} 套真题 · ${D.papers.reduce((a, p) => a + p.units.reduce((b, u) => b + u.qs.length, 0), 0)} 道小题。勾选后生成，每个单元恰好一张 A4。`;
  }

  /* ───── A4 页 ───── */
  function qHTML(q, u) {
    const opts = q.opts || [];
    const cls = u.sec === 'cloze' ? 'o4' : (Math.max(...opts.map(o => o.length), 0) <= 26 ? '' : 'o1');
    return `<div class="q"><span class="no">${q.n}.</span><span class="st">${esc(q.stem)}</span>
      ${opts.length ? `<div class="opts ${cls}">${opts.map(o => `<span>${esc(o)}</span>`).join('')}</div>` : ''}</div>`;
  }
  function bodyHTML(u, qs) {
    // 完形/阅读的 Directions 是通用套话,Part B 的说明已在材料里;只保留翻译与写作的具体要求
    const showDir = u.sec === 'translation' || u.sec === 'writing';
    const dir = showDir ? (u.dir || '').replace(/^.*?Directions:\s*/i, 'Directions: ').slice(0, 420) : '';
    const passage = (u.passage || []).map(p => `<p>${p}</p>`).join('');
    const fig = (u.figs || []).map(f => `<div class="fig"><img src="${esc(f)}" alt="原题图表"></div>`).join('');
    return `<div class="content">
      ${dir ? `<div class="dir">${esc(dir)}</div>` : ''}
      ${passage ? `<div class="passage">${passage}</div>` : ''}
      <div class="qs">${qs.map(q => qHTML(q, u)).join('')}</div>
      ${fig}
    </div><div class="lines"></div>`;
  }
  /* 横线用真实元素(不是 CSS 背景),浏览器不打印背景时也不会丢 */
  function fillLines(page) {
    const box = $('.lines', page);
    if (!box) return;
    const n = Math.max(1, Math.floor(box.getBoundingClientRect().height / 26.8));
    box.innerHTML = '<i></i>'.repeat(Math.min(n, 60));
  }
  function pageHTML(inner, head, idx, total) {
    return `<section class="page"><div class="ph"><span><b>e2</b> &nbsp; ${head.y} 考研英语（二）</span><span>${esc(head.label)}</span></div>
      <div class="slot">${inner}</div>
      <div class="pf"><span class="fields"><i>姓名</i><i>用时</i><i>得分</i></span><span>${idx} / ${total}</span></div></section>`;
  }
  function rawPage(pn, head, idx, total) {
    return `<section class="page raw"><div class="ph"><span><b>e2</b> &nbsp; ${head.y} 考研英语（二）</span><span>原题页 · ${esc(head.label)}</span></div>
      <div class="page-img-wrap"><img class="page-img" src="pages/${head.y}-p${String(pn).padStart(2, '0')}.webp" alt="原题页"></div>
      <div class="pf"><span></span><span>${idx} / ${total}</span></div></section>`;
  }
  function answerPage(p, idx, total) {
    const a = p.answers || {}, ks = Object.keys(a);
    const cells = ks.length ? ks.map(n => `<span><i>${n}</i>${esc(a[n])}</span>`).join('')
      : '<div style="grid-column:1/-1;padding:10px;color:#888">该年份原卷未附答案页</div>';
    return `<section class="page"><div class="ph"><span><b>e2</b> &nbsp; ${p.y} 考研英语（二）</span><span>答案</span></div>
      <div class="slot"><div class="content"><h2 class="ah">参考答案</h2><div class="keys">${cells}</div>
      <p class="dir">仅列出原卷 PDF 自带的答案；主观题（翻译、写作）以原卷为准。</p></div><div class="lines"></div></div>
      <div class="pf"><span></span><span>${idx} / ${total}</span></div></section>`;
  }

  function collect() {
    const p = paper(S.y), out = [];
    units().filter(u => S.sec === 'all' || u.sec === S.sec).forEach(u => {
      const sel = ensure(u.id);
      const qs = u.qs.filter(q => sel.has(q.n));
      if (!qs.length) return;
      out.push({ u, qs });
    });
    return { p, out };
  }
  function buildPages() {
    const { p, out } = collect();
    let items = [];
    out.forEach(({ u, qs }) => {
      if (S.mode === 'one') qs.forEach(q => items.push({ kind: 'q', u, qs: [q], label: `${u.label} · 第 ${q.n} 题` }));
      else items.push({ kind: 'q', u, qs, label: u.label });
      if (S.orig) (u.src || []).forEach(pn => items.push({ kind: 'raw', u, pn, label: u.label }));
    });
    if (S.ans) items.push({ kind: 'ans' });
    const total = items.length;
    return items.map((it, i) => {
      if (it.kind === 'raw') return rawPage(it.pn + 1, { y: p.y, label: it.label }, i + 1, total);
      if (it.kind === 'ans') return answerPage(p, i + 1, total);
      return pageHTML(bodyHTML(it.u, it.qs), { y: p.y, label: it.label }, i + 1, total);
    }).join('');
  }

  /* 二分找最大字号,使内容不溢出;所有内部尺寸用 em,故高度随字号近似线性。
     横线区 flex:1 自动吃掉剩余空间 —— 每页都刚好铺满一张 A4。 */
  function fit(page) {
    const c = $('.content', page), slot = $('.slot', page);
    if (!c || !slot) return;
    const MIN = 26;
    const avail = slot.getBoundingClientRect().height - MIN;
    if (avail < 40) return;
    let lo = 8.5, hi = 15, best = 8.5;
    for (let i = 0; i < 11; i++) {
      const fs = (lo + hi) / 2;
      c.style.fontSize = fs + 'px';
      if (c.getBoundingClientRect().height <= avail) { best = fs; lo = fs; } else hi = fs;
    }
    c.style.fontSize = best.toFixed(2) + 'px';
  }
  function fitScreen() {
    const box = $('.pv-scroll'), pages = $('#pvpages');
    if (!box || !pages) return;
    pages.style.zoom = Math.min(1, (box.clientWidth - 24) / 794);
  }
  function readyImages(root) {
    return Promise.all($$('img', root).map(i => {
      if (i.decode) return i.decode().catch(() => {});
      return i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; });
    }));
  }

  let drawToken = 0;
  function drawPreview() {
    const my = ++drawToken, box = $('#pvpages');
    window.__READY__ = false;
    if (!collect().out.length) {
      box.innerHTML = '<section class="page"><p class="doc-empty">还没有勾选任何小题</p></section>';
      $('#pvn').textContent = '0 页'; window.__E2_PAGES__ = 0; window.__READY__ = true; return;
    }
    box.innerHTML = buildPages();
    box.style.zoom = 1;                 // 测量必须在 1:1 下进行,屏幕缩放最后再套
    readyImages(box).then(() => {
      if (my !== drawToken) return;
      $$('.page', box).forEach(p => { fit(p); fillLines(p); });
      fitScreen();
      $('#pvn').textContent = $$('.page', box).length + ' 页 A4';
      window.__E2_PAGES__ = $$('.page', box).length;
      window.__READY__ = true;
    });
  }
  /* 排版自检:给构建/校验脚本用,逐页确认内容不溢出、横线区吃掉剩余空间 */
  window.__E2_AUDIT__ = function () {
    return $$('.page', $('#pvpages')).map((p, i) => {
      const c = $('.content', p), slot = $('.slot', p), lines = $('.lines', p);
      return {
        i: i + 1,
        pageH: Math.round(p.getBoundingClientRect().height),
        slotH: Math.round(slot ? slot.getBoundingClientRect().height : 0),
        contentH: Math.round(c ? c.getBoundingClientRect().height : 0),
        contentScroll: c ? c.scrollHeight : 0,
        linesH: Math.round(lines ? lines.getBoundingClientRect().height : 0),
        fs: c ? c.style.fontSize : '',
        over: c ? Math.max(0, c.scrollHeight - c.clientHeight) : 0
      };
    });
  };

  function openPV() {
    $('#pv').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#pvmode').value = S.mode; $('#pvorig').checked = S.orig; $('#pvans').checked = S.ans;
    drawPreview();
  }
  function closePV() {
    $('#pv').hidden = true; document.body.style.overflow = '';
  }

  /* ───── 事件 ───── */
  $('#go').onclick = openPV;
  $('#pvx').onclick = e => { e.preventDefault(); closePV(); };
  $('#pgo').onclick = () => window.print();
  $('#mode').onchange = e => S.mode = e.target.value;
  $('#orig').onchange = e => S.orig = e.target.checked;
  $('#ans').onchange = e => S.ans = e.target.checked;
  $('#pvmode').onchange = e => { S.mode = e.target.value; $('#mode').value = S.mode; drawPreview(); };
  $('#pvorig').onchange = e => { S.orig = e.target.checked; $('#orig').checked = S.orig; drawPreview(); };
  $('#pvans').onchange = e => { S.ans = e.target.checked; $('#ans').checked = S.ans; drawPreview(); };
  window.addEventListener('resize', fitScreen);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pv').hidden) closePV(); });

  /* 自动预览:给构建/校验脚本用  ?y=2025&all=1&print=1 */
  const q = new URLSearchParams(location.search);
  if (q.has('y') && D.years.includes(+q.get('y'))) S.y = +q.get('y');
  if (q.has('mode')) S.mode = q.get('mode');
  if (q.has('orig')) S.orig = q.get('orig') === '1';
  if (q.has('ans')) S.ans = q.get('ans') === '1';
  if (q.has('sec')) S.sec = q.get('sec');
  drawYears(); drawSecs(); drawList();
  if (q.get('all') === '1') units().forEach(u => ensure(u.id));
  if (q.get('print') === '1') openPV();
})();
