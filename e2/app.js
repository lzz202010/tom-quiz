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
    sel: {}, open: {},
    mode: 'unit', orig: false, ans: false
  };
  const paper = y => D.papers.find(p => p.y === y);
  function syncDL() {
    const f = `pdf/e2-${S.y}.pdf`;
    ['#dl', '#pvdl'].forEach(s => { const a = $(s); if (a) { a.href = f; a.textContent = `${S.y} 整套 PDF`; } });
  }
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
      units().forEach(u => ensure(u.id)); drawYears(); drawList(); syncDL();
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
    updateGo();
  }

  /* 生成按钮上直接标页数,免得点进去才发现是 0 页 */
  function countPages() {
    const { out } = collect();
    let n = S.mode === 'one' ? out.reduce((a, o) => a + o.qs.length, 0) : out.length;
    if (S.orig) n += out.reduce((a, o) => a + (o.u.src || []).length, 0);
    if (S.ans) n += 1;
    return n;
  }
  function updateGo() {
    const n = countPages(), b = $('#go');
    b.textContent = n ? `生成 A4 预览（${n} 页）` : '生成 A4 预览';
  }

  /* ───── A4 页 ───── */
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
    const cls = u.sec === 'cloze' ? 'o4' : '';
    const cells = opts.map(o => {
      const m = String(o).match(/^([A-G])\.\s*([\s\S]*)$/);
      return `<span>${m ? `<b>${m[1]}</b>${esc(m[2])}` : esc(o)}</span>`;
    }).join('');
    return `<div class="q"><span class="no">${q.n}.</span><span class="st">${esc(q.stem)}</span>
      ${opts.length ? `<div class="opts ${cls}">${cells}</div>` : ''}</div>`;
  }
  function answerHTML(u, qs) {
    const subj = u.sec === 'translation' || u.sec === 'writing';
    if (!subj) return '';                       // 客观题直接写在题号旁,不再占空间放答题卡
    // 大作文要放图表,答题横线相应减少,保证一页装得下
    const lines = u.sec === 'writing' ? ((u.figs || []).length ? 16 : 24) : 15;
    return `<div class="answer fixed">
      <div class="ans-t">作答区<i>ANSWER SHEET</i></div>
      <div class="lines">${'<i></i>'.repeat(lines)}</div>
    </div>`;
  }
  function bodyHTML(u, qs) {
    const subj = u.sec === 'translation' || u.sec === 'writing';
    const passage = (u.passage || []).map(p => `<p>${p}</p>`).join('');
    const fig = (u.figs || []).map(f => `<div class="fig"><img src="${esc(f)}" alt="原题图表"></div>`).join('');
    const fullFig = (u.figs || []).some(f => f.includes('-full'));   // 整图里已含题目要求
    let inner = '';
    if (subj) {
      if (!fullFig) inner += `<div class="dirbox">${esc(u.dir || '')}</div>`;
      if (passage) inner += `<div class="sect">原文 <span>TEXT</span></div><div class="passage">${passage}</div>`;
      inner += fig;
      if (u.sec === 'writing' && u.qs[0].n === 48) {
        inner += `<p class="hint">${fig ? '图表清晰版' : '本卷图表'}：勾选顶部「原题页」可一并打印原卷页。</p>`;
      }
    } else {
      if (passage) inner += `<div class="sect">原文 <span>PASSAGE</span></div><div class="passage">${passage}</div>`;
      inner += `<div class="sect q">题目 <span>QUESTIONS</span></div><div class="qs ${u.sec === 'cloze' ? 'cloze' : ''}">${qs.map(q => qHTML(q, u)).join('')}</div>`;
    }
    return `<div class="content">${inner}</div>${answerHTML(u, qs)}`;
  }
  function headHTML(y, t, tail) {
    return `<div class="ph"><span class="brand">e2</span><span>${y} 考研英语（二）</span>
      <span class="meta">${esc(t)}</span></div>`;
  }
  function footHTML(idx, total) {
    return `<div class="pf"><span class="fields"><i>姓名</i><i>用时</i><i>得分</i></span><span>${idx} / ${total}</span></div>`;
  }
  function pageHTML(u, qs, y, extra, idx, total) {
    const t = titleOf(u);
    const label = extra || `${t.h1} · ${qs[0].n}${qs.length > 1 ? '–' + qs[qs.length - 1].n : ''}`;
    return `<section class="page">
      ${headHTML(y, label)}
      <div class="ttl"><h1>${esc(t.h1)}<small>${esc(t.en)}</small></h1>
        <span class="sub">${t.range} · ${t.score} · 建议 ${t.mins} 分钟</span></div>
      <div class="slot ${(u.sec === 'translation' || u.sec === 'writing') ? 'subj' : ''}">${bodyHTML(u, qs)}</div>
      ${footHTML(idx, total)}</section>`;
  }
  function rawPage(pn, y, label, idx, total) {
    return `<section class="page raw">${headHTML(y, '原题页 · ' + label)}
      <div class="page-img-wrap"><img class="page-img" src="pages/${y}-p${String(pn).padStart(2, '0')}.webp" alt="原题页"></div>
      <div class="pf"><span></span><span>原题页 ${idx} / ${total}</span></div></section>`;
  }
  function answerPage(p, idx, total) {
    const a = p.answers || {}, ks = Object.keys(a);
    const cells = ks.length ? ks.map(n => `<span><i>${n}</i>${esc(a[n])}</span>`).join('')
      : '<div style="grid-column:1/-1;padding:10px;color:#888">该年份原卷未附答案页</div>';
    return `<section class="page">${headHTML(p.y, '参考答案')}
      <div class="ttl"><h1>参考答案<small>ANSWER KEY</small></h1><span class="sub">${p.y}</span></div>
      <div class="slot"><div class="content"><div class="keys">${cells}</div>
      <p class="dirbox" style="margin-top:6mm">仅列出原卷 PDF 自带的客观题答案；翻译与写作以原卷为准。</p></div></div>
      ${footHTML(idx, total)}</section>`;
  }

  function collect() {
    const p = paper(S.y), out = [];
    units().filter(u => S.sec === 'all' || u.sec === S.sec).forEach(u => {
      const sel = ensure(u.id);
      const qs = u.qs.filter(q => sel.has(q.n));
      if (qs.length) out.push({ u, qs });
    });
    return { p, out };
  }
  function buildPages() {
    const { p, out } = collect(), items = [];
    out.forEach(({ u, qs }) => {
      if (S.mode === 'one') qs.forEach(q => items.push({ kind: 'q', u, qs: [q], extra: `${u.label} · 第 ${q.n} 题` }));
      else items.push({ kind: 'q', u, qs });
      if (S.orig) (u.src || []).forEach(pn => items.push({ kind: 'raw', u, pn, label: u.label }));
    });
    if (S.ans) items.push({ kind: 'ans' });
    const total = items.length;
    return items.map((it, i) => {
      if (it.kind === 'raw') return rawPage(it.pn + 1, p.y, it.label, i + 1, total);
      if (it.kind === 'ans') return answerPage(p, i + 1, total);
      return pageHTML(it.u, it.qs, p.y, it.extra, i + 1, total);
    }).join('');
  }

  /* 二分找最大字号使「内容 + 答题区」不溢出;内部尺寸用 em,高度随字号近似线性。
     答题区固定高度并用 margin-top:auto 贴底,中间自然留白 —— 每页版式稳定一致。 */
  function fit(page) {
    const c = $('.content', page), slot = $('.slot', page), ans = $('.answer', page);
    if (!c || !slot) return;
    const ansH = ans ? ans.getBoundingClientRect().height : 0;
    // 只有 .fixed 的 margin-top 是定值;auto 会把剩余空白算进去,不能计入
    const mt = (ans && ans.classList.contains('fixed'))
      ? (parseFloat(getComputedStyle(ans).marginTop) || 0) : 0;
    const avail = slot.getBoundingClientRect().height - ansH - mt - 24;
    if (avail < 40) return;
    let lo = 8.8, hi = 13.6, best = 8.8;
    for (let i = 0; i < 12; i++) {
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

  /* 排版自检:给构建/校验脚本用 */
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

  let drawToken = 0;
  function drawPreview() {
    const my = ++drawToken, box = $('#pvpages');
    window.__READY__ = false;
    if (!collect().out.length) {
      box.innerHTML = '<section class="page"><p class="doc-empty">还没有勾选任何小题</p></section>';
      $('#pvn').textContent = '0 页'; window.__E2_PAGES__ = 0; window.__READY__ = true; return;
    }
    box.innerHTML = buildPages();
    box.style.zoom = 1;                 // 测量必须 1:1,屏幕缩放最后再套
    readyImages(box).then(() => {
      if (my !== drawToken) return;
      $$('.page', box).forEach(fit);
      fitScreen();
      $('#pvn').textContent = $$('.page', box).length + ' 页 A4';
      window.__E2_PAGES__ = $$('.page', box).length;
      window.__READY__ = true;
    });
  }
  function openPV() {
    $('#pv').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#pvmode').value = S.mode; $('#pvorig').checked = S.orig; $('#pvans').checked = S.ans;
    drawPreview();
  }
  function closePV() { $('#pv').hidden = true; document.body.style.overflow = ''; }

  /* ───── 事件 ───── */
  $('#go').onclick = openPV;
  $('#pvx').onclick = e => { e.preventDefault(); closePV(); };
  $('#pgo').onclick = () => window.print();
  $('#mode').onchange = e => { S.mode = e.target.value; updateGo(); };
  $('#orig').onchange = e => { S.orig = e.target.checked; updateGo(); };
  $('#ans').onchange = e => { S.ans = e.target.checked; updateGo(); };
  $('#allY').onclick = () => { units().forEach(u => { const s = ensure(u.id); u.qs.forEach(q => s.add(q.n)); }); drawList(); };
  $('#clrY').onclick = () => { units().forEach(u => ensure(u.id).clear()); drawList(); };
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
  drawYears(); drawSecs(); drawList(); syncDL();
  if (q.get('all') === '1') units().forEach(u => ensure(u.id));
  if (q.get('print') === '1') openPV();
})();
