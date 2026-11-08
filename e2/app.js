/* e2 — 考研英语二真题 · A4 打印
   数据由 scripts/e2/build.py 生成;本文件只负责把每个单元排成一张 A4。 */
(function () {
  'use strict';
  const D = window.E2 || { years: [], papers: [] };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const paper = y => D.papers.find(p => p.y === y);
  const S = { y: D.years[D.years.length - 1] || 2025 };

  /* ───── 首页:只列年份 ───── */
  function drawYears() {
    $('#years').innerHTML = D.years.slice().reverse().map(y => {
      const p = paper(y);
      const n = p ? p.units.reduce((a, u) => a + u.qs.length, 0) : 0;
      return `<button class="yr" data-y="${y}"><b>${y}</b><i>${n} 题 · ${p ? p.units.length : 0} 页</i></button>`;
    }).join('');
    $$('#years .yr').forEach(b => b.onclick = () => openPV(+b.dataset.y));
  }

  /* ───── 一个单元 = 一张 A4 ───── */
  const MIN = { cloze: 18, reading: 18, partb: 15, translation: 20, writing: 15 };
  function titleOf(u) {
    const n = u.qs.map(q => q.n), a = n[0], b = n[n.length - 1];
    const range = a === b ? `${a}` : `${a}–${b}`;
    const T = {
      cloze: ['完形填空', 'Section I · Use of English', '10 分'],
      partb: ['阅读理解 Part B', 'Section II · Part B', '10 分'],
      translation: ['英译汉', 'Section III · Translation', '15 分'],
      reading: [`阅读理解 ${u.label.split(' · ')[0]}`, 'Section II · Reading Comprehension', '10 分'],
      writing: [u.label.startsWith('小作文') ? '写作 Part A · 小作文' : '写作 Part B · 大作文',
                'Section IV · Writing', u.label.startsWith('小作文') ? '10 分' : '15 分']
    }[u.sec];
    return { h1: T[0], en: T[1], range, score: T[2], mins: MIN[u.sec] || 15 };
  }

  function qHTML(q, u) {
    const opts = q.opts || [];
    const cells = opts.map(o => {
      const m = String(o).match(/^([A-G])\.\s*([\s\S]*)$/);
      return `<span>${m ? `<b>${m[1]}</b>${esc(m[2])}` : esc(o)}</span>`;
    }).join('');
    return `<div class="q"><button class="no qbtn" type="button" data-print-q="${q.n}"
      title="单独打印第 ${q.n} 题">${q.n}.</button><span class="st">${esc(q.stem)}</span>
      ${opts.length ? `<div class="opts${u.sec === 'cloze' ? ' o4' : ''}">${cells}</div>` : ''}</div>`;
  }

  /* Part B:小标题匹配 / 信息匹配 / 正误判断,共用一套 A–G 备选项 */
  function partbHTML(u) {
    const pool = u.pool || [];
    const poolBox = pool.length ? `<div class="pool">
      <div class="pool-h">备选项 <i>OPTIONS A–G</i></div>
      <div class="pool-g">${pool.map(p => `<span><b>${p.k}</b>${esc(p.t)}</span>`).join('')}</div></div>` : '';
    const pass = (u.passage || []).map(p => `<p>${p}</p>`).join('');
    const seg = u.type === 'sub'
      ? (u.seg || []).map(s => `<p class="pseg"><em>${s.n}</em>${esc(s.t)}</p>`).join('') : '';
    let qh;
    if (u.type === 'sub') {
      // 小标题型:正文里已带 41–45 段号,这里只留五个作答位
      qh = `<div class="bgrid">${u.qs.map(q => `<span>${q.n}<b></b></span>`).join('')}</div>`;
    } else {
      const tf = u.type === 'tf';
      qh = u.qs.map(q => `<div class="pq"><button class="no qbtn" type="button" data-print-q="${q.n}"
        title="单独打印第 ${q.n} 题">${q.n}.</button><span class="st">${esc(q.stem)}</span>
        <span class="pick${tf ? ' tf' : ''}"></span></div>`).join('');
    }
    return `<div class="dirbox">${esc(u.dir || '')}</div>${poolBox}
      ${pass || seg ? '<div class="sect">原文 <span>PASSAGE</span></div>' : ''}
      <div class="passage">${pass}${seg}</div>
      <div class="sect q">作答 <span>ANSWER</span></div>
      <div class="qs">${qh}</div>`;
  }

  function bodyHTML(u) {
    if (u.sec === 'partb') return `<div class="content">${partbHTML(u)}</div>`;
    const subj = u.sec === 'translation' || u.sec === 'writing';
    const passage = (u.passage || []).map(p => `<p>${p}</p>`).join('');
    const fig = (u.figs || []).map(f => `<div class="fig"><img src="${esc(f)}" alt="原题图表"></div>`).join('');
    let inner = '';
    if (subj) {
      inner += `<div class="dirbox">${esc(u.dir || '')}</div>`;
      if (passage) inner += `<div class="sect">原文 <span>TEXT</span></div><div class="passage">${passage}</div>`;
      inner += fig;
    } else {
      if (passage) inner += `<div class="sect">原文 <span>PASSAGE</span></div><div class="passage">${passage}</div>`;
      inner += `<div class="sect q">题目 <span>QUESTIONS</span></div>
        <div class="qs${u.sec === 'cloze' ? ' cloze' : ''}">${u.qs.map(q => qHTML(q, u)).join('')}</div>`;
    }
    const lines = subj ? (u.sec === 'writing' ? ((u.figs || []).length ? 16 : 24) : 15) : 0;
    const ans = lines ? `<div class="answer fixed">
      <div class="ans-t">作答区<i>ANSWER SHEET</i></div>
      <div class="lines">${'<i></i>'.repeat(lines)}</div></div>` : '';
    return `<div class="content">${inner}</div>${ans}`;
  }

  function pageHTML(u, y, idx, total, single) {
    const t = titleOf(u);
    return `<section class="page" data-unit="${esc(u.id)}">
      <div class="ph"><span class="brand">e2</span><span>${y} 考研英语（二）</span>
        <span class="meta">${esc(t.h1)} · ${t.range}</span>
        <span class="pn">${idx}/${total}</span></div>
      <div class="ttl"><h1>${esc(t.h1)}<small>${esc(t.en)}</small></h1>
        <span class="sub">${single ? `${t.range} · 单题打印` : `${t.range} · ${t.score} · 建议 ${t.mins} 分钟`}</span>
        <button class="pbtn" type="button" data-print-page="${idx - 1}" title="只打印这一页">打印本页</button></div>
      <div class="slot${(u.sec === 'translation' || u.sec === 'writing') ? ' subj' : ''}">${bodyHTML(u)}</div></section>`;
  }

  /* 二分找最大字号使内容不溢出;内部尺寸用 em,高度随字号近似线性 */
  function fit(page) {
    const c = $('.content', page), slot = $('.slot', page), ans = $('.answer', page);
    if (!c || !slot) return;
    const ansH = ans ? ans.getBoundingClientRect().height : 0;
    const mt = (ans && ans.classList.contains('fixed'))
      ? (parseFloat(getComputedStyle(ans).marginTop) || 0) : 0;
    const avail = slot.getBoundingClientRect().height - ansH - mt - 24;
    if (avail < 40) return;
    let lo = 7.6, hi = 13.6, best = 7.6;
    for (let i = 0; i < 14; i++) {
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

  /* ───── 打印 ─────
     不再直接打印预览层(它带 position:fixed / flex / overflow,浏览器分页时
     容易在末尾多吐一张空白页)。先把要印的纸面渲染进 body 下独立的
     #printroot,它没有任何固定/弹性祖先,打印时只显示它。 */
  let printing = false;

  function withQ(u, qn) {
    if (!qn) return u;
    return Object.assign({}, u, { qs: u.qs.filter(q => q.n === qn) });
  }
  function pagesHTML(units, qn) {
    return units.map((u, i) => pageHTML(withQ(u, qn), S.y, i + 1, units.length, !!qn)).join('');
  }
  function paintRoot(html) {
    const root = $('#printroot');
    root.innerHTML = html;
    const pages = () => $$('.page', root);
    pages().forEach(fit);
    return readyImages(root).then(() => {
      pages().forEach(fit);
      return document.fonts && document.fonts.ready ? document.fonts.ready : null;
    }).then(() => {
      pages().forEach(fit);
      // 两帧后再调打印,确保字号/图片已经落到布局里
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  }
  function printUnits(units, qn) {
    if (!units || !units.length || printing) return;
    printing = true;
    const root = $('#printroot');
    root.innerHTML = pagesHTML(units, qn);
    // 整套/整页:沿用预览里已经排好的字号,图片不会因刚插入还没布局而顶版
    // 单题:内容变了,重新二分
    $$('.page', root).forEach(p => {
      const dst = $('.content', p);
      const src = qn ? null : $(`.page[data-unit="${p.dataset.unit}"] .content`, $('#pvpages'));
      if (src && src.style.fontSize) dst.style.fontSize = src.style.fontSize;
      else fit(p);
    });
    // 必须在点击事件里同步调 print():iOS Safari 对延后的 window.print() 不可靠
    try { window.print(); } finally { printing = false; }
  }
  function printOne(u, qn) {
    if (!u) return;
    // Part B / 写作 / 翻译本身是一整块,不能拆开印
    if (u.sec === 'partb' || u.sec === 'writing' || u.sec === 'translation') qn = null;
    printUnits([u], qn);
  }

  /* 构建脚本用:把整套(或单页/单题)放进打印根,返回纸数 */
  window.__E2_PREPARE_PRINT__ = function (unitIndex, qn) {
    const p = paper(S.y);
    if (!p || !p.units.length) return Promise.resolve(0);
    const units = unitIndex == null ? p.units : [p.units[unitIndex]];
    return paintRoot(pagesHTML(units, qn || null))
      .then(() => $$('.page', $('#printroot')).length);
  };

  /* 供校验脚本查看真正会打印的那几张纸 */
  window.__E2_PRINT_AUDIT__ = function () {
    return $$('.page', $('#printroot')).map((p, i) => {
      const c = $('.content', p), slot = $('.slot', p), ans = $('.answer', p);
      const cH = c ? c.getBoundingClientRect().height : 0;
      const aH = ans ? ans.getBoundingClientRect().height : 0;
      const aM = (ans && ans.classList.contains('fixed'))
        ? (parseFloat(getComputedStyle(ans).marginTop) || 0) : 0;
      const sH = slot ? slot.getBoundingClientRect().height : 0;
      return { i: i + 1, slotH: Math.round(sH), contentH: Math.round(cH),
        answerH: Math.round(aH), fs: c ? c.style.fontSize : '',
        over: Math.max(0, Math.round(cH + aH + aM - sH)) };
    });
  };

  /* 排版自检:构建/校验脚本用 */
  window.__E2_AUDIT__ = function () {
    return $$('.page', $('#pvpages')).map((p, i) => {
      const c = $('.content', p), slot = $('.slot', p), ans = $('.answer', p);
      const cH = c ? c.getBoundingClientRect().height : 0;
      const aH = ans ? ans.getBoundingClientRect().height : 0;
      const aM = (ans && ans.classList.contains('fixed'))
        ? (parseFloat(getComputedStyle(ans).marginTop) || 0) : 0;
      const sH = slot ? slot.getBoundingClientRect().height : 0;
      return {
        i: i + 1, slotH: Math.round(sH), contentH: Math.round(cH), answerH: Math.round(aH),
        fs: c ? c.style.fontSize : '',
        over: Math.max(0, Math.round(cH + aH + aM - sH))
      };
    });
  };

  let token = 0;
  function draw() {
    const my = ++token, box = $('#pvpages'), p = paper(S.y), units = p ? p.units : [];
    window.__READY__ = false;
    if (!units.length) {
      box.innerHTML = '<section class="page"><p class="doc-empty">没有这一年的数据</p></section>';
      window.__E2_PAGES__ = 0; window.__READY__ = true; return;
    }
    box.innerHTML = units.map((u, i) => pageHTML(u, S.y, i + 1, units.length)).join('');
    box.style.zoom = 1;                       // 测量必须 1:1,屏幕缩放最后再套
    readyImages(box).then(() => {
      if (my !== token) return;
      $$('.page', box).forEach(fit);
      fitScreen();
      $('#pvn').textContent = `${S.y} · ${units.length} 页 A4 · 点题号可单题打印`;
      window.__E2_PAGES__ = units.length;
      window.__READY__ = true;
    });
  }
  function openPV(y) {
    S.y = y || S.y;
    const f = `pdf/e2-${S.y}.pdf`;
    $('#pvdl').href = f;
    $('#pvdl').textContent = `${S.y} 整套 PDF`;
    $('#pv').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#pvpages').scrollIntoView({ block: 'start' });
    history.replaceState(null, '', `?y=${S.y}`);
    draw();
  }
  function closePV() {
    $('#pv').hidden = true;
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname);
  }

  $('#pvx').onclick = closePV;
  $('#pgo').onclick = () => {
    const p = paper(S.y);
    if (p) printUnits(p.units);
  };
  $('#pvpages').addEventListener('click', e => {
    const p = paper(S.y);
    if (!p) return;
    const qb = e.target.closest('.qbtn');
    if (qb) {
      const u = p.units.find(x => x.id === qb.closest('.page').dataset.unit);
      printOne(u, +qb.dataset.printQ);
      return;
    }
    const pb = e.target.closest('[data-print-page]');
    if (pb) printUnits([p.units[+pb.dataset.printPage]]);
  });
  /* 直接按 Cmd/Ctrl+P 时,把当前整套塞进打印根,避免印出空白 */
  window.addEventListener('beforeprint', () => {
    if (printing) return;
    const p = paper(S.y), root = $('#printroot');
    if (!p || !p.units.length || root.innerHTML.trim()) return;
    root.innerHTML = pagesHTML(p.units, null);
    $$('.page', root).forEach(fit);
  });
  window.addEventListener('afterprint', () => {
    if (!printing) $('#printroot').innerHTML = '';
  });
  window.addEventListener('resize', fitScreen);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pv').hidden) closePV(); });

  const q = new URLSearchParams(location.search);
  if (q.has('y') && D.years.includes(+q.get('y'))) S.y = +q.get('y');
  drawYears();
  if (q.has('y') || q.get('print') === '1') openPV(S.y);
})();
