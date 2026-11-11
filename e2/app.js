/* e2 — 考研英语二真题 · A4 打印
   数据由 scripts/e2/build.py 生成;本文件只负责把每个单元排成一张 A4。 */
(function () {
  'use strict';
  /* 题库按年份拆开:首屏只下 index(几 KB),打开哪一年再取那一年(约 30 KB)。 */
  const D = window.E2 || { years: [], index: {} };
  const PAPERS = {};                       // 已加载的年份数据
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const paper = y => PAPERS[y] || null;
  function loadYear(y) {
    if (PAPERS[y]) return Promise.resolve(PAPERS[y]);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = `d/${y}.js?v=16`;
      s.onload = () => {
        const p = (window.E2DATA || {})[y];
        if (!p) return rej(new Error('该年数据缺失'));
        PAPERS[y] = p; res(p);
      };
      s.onerror = () => rej(new Error('该年数据加载失败'));
      document.head.appendChild(s);
    });
  }
  const S = { y: D.years[D.years.length - 1] || 2025 };
  let PAP = null;                       // 当前年份的 paper

  /* ───── 我的作答:记在本机,用来给难度做个人校准 ───── */
  const MY = {
    key: 'e2.myans',
    read() { try { return JSON.parse(localStorage.getItem(this.key) || '{}') || {}; } catch (e) { return {}; } },
    get(y) { return this.read()[y] || {}; },
    toggle(y, n, a) {
      const all = this.read();
      const yk = all[y] = all[y] || {};
      if (yk[n] === a) delete yk[n]; else yk[n] = a;   // 再点一次取消
      try { localStorage.setItem(this.key, JSON.stringify(all)); } catch (e) {}
    },
    clear(y) {
      const all = this.read();
      delete all[y];
      try { localStorage.setItem(this.key, JSON.stringify(all)); } catch (e) {}
    }
  };
  /* 手动标注单元难度:自动 → 易 → 难 → 自动 */
  const MARK = {
    key: 'e2.manual',
    read() { try { return JSON.parse(localStorage.getItem(this.key) || '{}') || {}; } catch (e) { return {}; } },
    cycle(id) {
      const all = this.read();
      const cur = all[id] || '';
      const next = cur === '' ? 'easy' : (cur === 'easy' ? 'hard' : '');
      if (next) all[id] = next; else delete all[id];
      try { localStorage.setItem(this.key, JSON.stringify(all)); } catch (e) {}
      return next;
    }
  };

  /* ───── 难度:基线(构建期算好)+ 个人正确率校准 + 手动标注 ───── */
  const DIFF_TAGS = { 1: '易', 2: '较易', 3: '中', 4: '难', 5: '偏难' };
  function unitDiff(u) {
    const p = PAP;
    const base = (u.diff && u.diff.lv) ? u.diff.lv : 3;
    const mine = p ? MY.get(p.y) : {};
    const qs = u.qs.filter(q => p && p.answers[String(q.n)]);
    let done = 0, right = 0;
    qs.forEach(q => {
      const m = mine[String(q.n)];
      if (m) { done++; if (m === p.answers[String(q.n)]) right++; }
    });
    let lv = base;
    /* 个人校准:做得越顺,这个单元对你就越容易(全对 −0.8,常错 +2.4),
       样本少于 3 题不动 —— 免得两题定生死。 */
    if (done >= 3) lv = base + (0.75 - right / done) * 3.2;
    const man = MARK.read()[u.id] || '';
    if (man === 'easy') lv = 1; else if (man === 'hard') lv = 5;
    lv = Math.max(1, Math.min(5, Math.round(lv)));
    const mastered = done >= 3 && right / done >= 0.8;
    return { lv, tag: DIFF_TAGS[lv], done, right, n: qs.length, mastered, manual: man };
  }
  /* 题级难度:基线 + 你这一次的作答(做错就往上抬一档) */
  function qDiff(q) {
    let dl = q.dl || 3;
    if (PAP) {
      const mine = mineOf(q), ans = ansOf(q);
      if (mine && ans) dl += (mine === ans) ? 0 : 1;
    }
    return Math.max(1, Math.min(5, dl));
  }

  /* ───── 首页:只列年份 ───── */
  function yearStat(y) {
    /* 难度取该年各单元的平均,再按你自己的正确率校准;正确率按本机作答记录算 */
    const ix = (D.index || {})[y] || {};
    const mine = MY.get(y);
    const ans = ix.key ? ix.key.split(',') : null;
    let done = 0, right = 0;
    Object.keys(mine).forEach(k => {
      done++;
      if (ans && ans[+k - 1] && ans[+k - 1] === mine[k]) right++;
    });
    let lv = ix.diff || 3;
    if (done >= 3) lv = lv + (0.75 - right / done) * 3.2;
    lv = Math.max(1, Math.min(5, Math.round(lv)));
    return { ix, done, right, lv };
  }
  function drawYears() {
    $('#years').innerHTML = D.years.slice().reverse().map(y => {
      const ix = (D.index || {})[y] || {};
      const st = yearStat(y);
      const n = ix.qs || 0;
      const mine = st.done ? `<span class="yd">你 ${st.right}/${st.done}</span>` : '';
      const dots = `<i class="dq" title="难度 ${st.lv}/5 · ${DIFF_TAGS[st.lv]}"><b>${'●'.repeat(st.lv)}</b>${'○'.repeat(5 - st.lv)}</i>`;
      return `<button class="yr" data-y="${y}"><b>${y}</b><i>${n} 题 · ${ix.units || 0} 页</i>
        <span class="ymeta">${dots}${mine}</span></button>`;
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

  /* ───── 答案校对:标记尽量短 ─────
     · 定位胶囊「¶3·5」:点一下跳到原文那句并高亮
     · 决策关键「→ 一句话」:为什么是这个答案
     · 干扰项错因:挂在选项后面,不另起三行中文
     全是屏幕增强层,打印时整块隐藏 —— 印出来的仍是空白卷子。 */
  const CK = { on: false, key: 'e2.ckmode' };
  try { CK.on = localStorage.getItem(CK.key) === '1'; } catch (e) {}
  const ansOf = q => (PAP && PAP.answers[String(q.n)]) || (q.note && q.note.a) || '';
  const mineOf = q => (PAP ? (MY.get(PAP.y)[String(q.n)] || '') : '');

  /* 选项后面的短标:正确项写「决策关键」,干扰项写「错因」 */
  function whyOf(q, L) {
    const n = q.note;
    if (!n) return '';
    if (L === n.a) return n.key || '';
    return (n.w || {})[L] || '';
  }
  function locPill(n) {
    return `<button class="ck-l" type="button" data-loc="${esc(n.loc)}" title="跳到原文那句">${esc(n.loc)}</button>`;
  }
  /* 校对只活在阅读模式:纸面预览与打印永远是干净的空白卷(见 docs/e2.md)。
     以前纸面也按 CK.on 渲染,从「读」切回「纸」时答案/校对笔记会留在卷面上。 */
  function ckOn() { return !!(CK.on && RV.on); }

  /* 完形 20 题挤在一起,只给一行:定位 + 决策关键 */
  function ckLine(q) {
    if (!ckOn()) return '';
    const n = q.note;
    if (!n) return '';
    return `<div class="ck">${locPill(n)}<span class="ck-k">⟶ ${esc(n.key)}</span></div>`;
  }
  function optCells(q, inlineWhy, showAns) {
    const ans = showAns ? ansOf(q) : '';
    const mine = mineOf(q);
    return (q.opts || []).map(o => {
      const m = String(o).match(/^([A-G])\.\s*([\s\S]*)$/);
      const L = m ? m[1] : '';
      const ok = !!(ans && L && L === ans);
      const isMine = !!(mine && L === mine);
      const bad = !!(ans && isMine && L !== ans);
      const why = (showAns && inlineWhy) ? whyOf(q, L) : '';
      return `<span class="o${ok ? ' ok' : ''}${isMine ? ' mine' : ''}${bad ? ' bad' : ''}">` +
        `${m ? `<b>${m[1]}</b>${esc(m[2])}` : esc(o)}` +
        `${ok ? '<i class="mk">✓</i>' : ''}` +
        `${why ? `<i class="ow${L === ans ? ' ok' : ''}">${esc(why)}</i>` : ''}</span>`;
    }).join('');
  }

  /* 段落按句切开:构建期存了每句的字符偏移(pcut),这里按偏移切片,
     每句就带上 data-p/data-s,校对模式能按「¶段·句」精确高亮原文。 */
  function sentHTML(u, pi, html) {
    const cut = (u.pcut && u.pcut[pi]) || [];
    if (!cut.length) return html;
    return cut.map((c, si) =>
      `<span class="sn" data-p="${pi + 1}" data-s="${si + 1}">${html.slice(c[0], c[1])}</span>`).join('');
  }
  function segHTML(u) {
    return (u.seg || []).map((s, si) => {
      const cut = s.cut || [];
      const inner = cut.length
        ? cut.map((c, xi) => `<span class="sn" data-p="${si + 1}" data-s="${xi + 1}">${s.t.slice(c[0], c[1])}</span>`).join('')
        : s.t;
      return `<p class="pseg" data-p="${si + 1}"><em>${s.n}</em>${inner}</p>`;
    }).join('');
  }

  /* 纸面模式 = 打印的样子:不带任何校对标记,屏幕看到的和印出来的一致。
     校对、难度点这些只在阅读模式出现(手机上是主战场)。 */
  function qHTML(q, u) {
    const opts = q.opts || [];
    const cells = optCells(q, false, false);
    const dq = '';   // 纸面不放难度点:纸面要和打印一模一样(难度在纸面外的标题条上)
    if (u.sec === 'cloze') {
      return `<div class="q"><span class="crow"><button class="no qbtn" type="button" data-print-q="${q.n}"
        title="单独打印第 ${q.n} 题">${q.n}.</button>${dq}<span class="opts o4">${cells}</span></span></div>`;
    }
    return `<div class="q"><button class="no qbtn" type="button" data-print-q="${q.n}"
      title="单独打印第 ${q.n} 题">${q.n}.</button>${dq}<span class="st">${esc(q.stem)}</span>
      ${opts.length ? `<div class="opts">${cells}</div>` : ''}</div>`;
  }

  /* Part B:小标题匹配 / 信息匹配 / 正误判断,共用一套 A–G 备选项 */
  function partbHTML(u) {
    const pool = u.pool || [];
    const poolBox = pool.length ? `<div class="pool">
      <div class="pool-h">备选项 <i>OPTIONS A–G</i></div>
      <div class="pool-g">${pool.map(p => `<span><b>${p.k}</b>${esc(p.t)}</span>`).join('')}</div></div>` : '';
    const pass = (u.passage || []).map((p, i) => `<p>${sentHTML(u, i, p)}</p>`).join('');
    const seg = u.type === 'sub' ? segHTML(u) : '';
    let qh;
    if (u.type === 'sub') {
      // 小标题型:正文里已带 41–45 段号,这里只留五个作答位
      qh = `<div class="bgrid">${u.qs.map(q => {
        const ans = ckOn() ? ansOf(q) : '';
        const mine = mineOf(q);
        return `<span>${q.n}<b>${ans || mine ? `<i class="ans${mine && mine === ans ? ' ok' : ''}">${ans || mine}</i>` : ''}</b></span>`;
      }).join('')}</div>`;
      qh += `<div class="cknotes">${u.qs.map(q => ckLine(q)).join('')}</div>`;
    } else {
      const tf = u.type === 'tf';
      qh = u.qs.map(q => {
        const ans = ckOn() ? ansOf(q) : '';
        const mine = mineOf(q);
        return `<div class="pq"><button class="no qbtn" type="button" data-print-q="${q.n}"
          title="单独打印第 ${q.n} 题">${q.n}.</button><span class="st">${esc(q.stem)}</span>
          <span class="pick${tf ? ' tf' : ''}${mine ? ' mine' : ''}">${ans || mine}</span></div>${ckLine(q)}`;
      }).join('');
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
    const passage = (u.passage || []).map((p, i) => `<p>${sentHTML(u, i, p)}</p>`).join('');
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
      <div class="ttl"><h1>${esc(t.h1)}<small>${esc(t.en)}</small></h1>
        <span class="sub">${single ? `${t.range} · 单题打印` : `${t.range} · ${t.score} · 建议 ${t.mins} 分钟`}</span>
        <button class="pbtn" type="button" data-print-page="${idx - 1}" title="只打印这一页">打印本页</button></div>
      <div class="slot${(u.sec === 'translation' || u.sec === 'writing') ? ' subj' : ''}">${bodyHTML(u)}</div></section>`;
  }

  /* 二分找最大字号使内容不溢出;内部尺寸用 em,高度随字号近似线性。
     字号写成 calc(n * var(--upx)):屏幕上 --upx=1px 等于 n px;
     打印时 --upx 随可打印区缩小,字号跟着纸面一起缩放,比例不变。 */
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
    c.style.fontSize = 'calc(' + best.toFixed(2) + ' * var(--upx))';
  }
  /* 纸面预览在窄屏上要缩到屏幕宽度内 —— 不然右侧整列选项被切掉。
     阅读模式下预览层是隐藏的,这时 clientWidth = 0,不能拿它算缩放比。 */
  function fitScreen() {
    const box = $('.pv-scroll'), pages = $('#pvpages');
    if (!box || !pages) return;
    if (box.hidden) { pages.style.zoom = 1; return; }
    const z = (box.clientWidth - 16) / 794;
    pages.style.zoom = z > 0.25 ? Math.min(1, z) : 1;
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
    return loadYear(S.y).then(() => {
      PAP = paper(S.y);
      const p = paper(S.y);
      if (!p || !p.units.length) return 0;
      const units = unitIndex == null ? p.units : [p.units[unitIndex]];
      return paintRoot(pagesHTML(units, qn || null))
        .then(() => $$('.page', $('#printroot')).length);
    });
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

  /* ───── 生词收藏:点词即收,不打断做题 ───── */
  const V = window.E2V;
  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.classList.remove('word-card');
    toastEl.innerHTML = `<span></span>`;
    toastEl.firstChild.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1900);
  }
  /* 点单词后弹出的中文释义卡:默认不显示,点一下才出现,顺带给出真题例句 */
  function toastWord(word, gloss, sentence, added) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    const g = gloss || '暂无中文释义，可在生词本里补充';
    const cut = s => s.length > 120 ? s.slice(0, 118) + '…' : s;
    toastEl.classList.add('word-card');
    toastEl.innerHTML = `<div class="wc-h"><b>${esc(word)}</b>
      <i>${added ? '已收藏' : '已在生词本'}</i></div>
      <div class="wc-g">${esc(g)}</div>
      ${sentence ? `<em>${esc(cut(sentence))}</em>` : ''}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; toastEl.classList.remove('word-card'); }, 3600);
  }

  function caretAt(x, y) {
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r && r.startContainer && r.startContainer.nodeType === 3) return r;
    }
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p && p.offsetNode && p.offsetNode.nodeType === 3)
        return { startContainer: p.offsetNode, startOffset: p.offset };
    }
    return null;
  }
  function wordAt(node, off) {
    const t = node.nodeValue || '';
    const re = /[A-Za-z][A-Za-z’'-]*/g;
    let m;
    while ((m = re.exec(t))) {
      const a = m.index, b = a + m[0].length;
      if (off >= a && off <= b) {
        const w = m[0].replace(/^[-’']+|[-’']+$/g, '');
        return w.length > 1 ? { word: w, start: a, end: b } : null;
      }
      if (a > off) break;
    }
    return null;
  }
  /* 文本节点内偏移 → 整个块内的偏移 */
  function offsetIn(block, node, off) {
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n, pos = 0;
    while ((n = w.nextNode())) {
      if (n === node) return pos + off;
      pos += n.nodeValue.length;
    }
    return pos + off;
  }
  /* 截取包含该词的句子:到上一个 .!? 之后、到下一个 .!? 之前 */
  function sentenceAround(text, at) {
    const isEnd = c => c === '.' || c === '!' || c === '?';
    let s = at;
    while (s > 0) {
      if (isEnd(text[s - 1]) && /\s/.test(text[s] || ' ')) break;
      s--;
    }
    let e = at;
    while (e < text.length) {
      if (isEnd(text[e])) {
        let k = e + 1;
        while (k < text.length && /["”’')]/.test(text[k])) k++;
        if (k >= text.length || /\s/.test(text[k])) { e = k; break; }
        e = k; continue;
      }
      e++;
    }
    let out = text.slice(s, e).replace(/\s+/g, ' ').trim();
    if (out.length > 320) {
      const cut = out.lastIndexOf(',', 300);
      out = out.slice(0, cut > 120 ? cut + 1 : 300).trim() + ' …';
    }
    return out;
  }
  function unitOf(id) {
    const p = paper(S.y);
    return p ? p.units.find(u => u.id === id) : null;
  }
  function pickWord(x, y) {
    const r = caretAt(x, y);
    if (!r) return null;
    const node = r.startContainer;
    if (!node.parentElement) return null;
    if (node.parentElement.closest('button,a,img,.pbtn,.qbtn')) return null;
    const block = node.parentElement.closest('.passage p, .dirbox, .q .st, .pq .st, .opts span, .pool-g span, .passage p.pseg');
    if (!block) return null;
    const w = wordAt(node, r.startOffset);
    if (!w) return null;
    const at = offsetIn(block, node, w.start);
    return { word: w.word, block, at };
  }
  /* 释义词典 393 KB:做题页按需再取,首屏不背。 */
  let glossP = null;
  function glossReady() {
    if (window.E2GLOSS_DATA) return Promise.resolve();
    if (!glossP) glossP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'gloss-data.js?v=16';
      s.onload = () => res();
      s.onerror = () => rej(new Error('释义词典加载失败'));
      document.head.appendChild(s);
    });
    return glossP;
  }
  async function collectFrom(x, y) {
    if (!V) return false;
    const hit = pickWord(x, y);
    if (!hit) return false;
    const holder = hit.block.closest('.page, [data-unit]');
    const unitId = holder ? (holder.dataset.unit || '') : '';
    const u = unitOf(unitId);
    const qEl = hit.block.closest('.q, .pq');
    const qn = qEl && qEl.querySelector('.no') ? parseInt(qEl.querySelector('.no').textContent, 10) : null;
    let sentence = sentenceAround(hit.block.textContent, hit.at);
    // 完形原文的空格是 <u class="gap">5</u>:例句里换成 ____,别让它读成 "and 5 a low mood"
    const gaps = Array.from(hit.block.querySelectorAll('u.gap')).map(g => g.textContent.trim());
    gaps.forEach(n => {
      if (/^\d{1,2}$/.test(n))
        sentence = sentence.replace(new RegExp('(?<![\\d.])' + n + '(?![\\d.])'), '____');
    });
    const src = {
      type: 'paper', year: S.y, section: u ? u.sec : '',
      label: u ? (u.label || '') : '', unitId: unitId || undefined,
      qn: qn || undefined
    };
    const r = V.add({ word: hit.word, sentence, gloss: '', source: src });
    if (r.ok) { markSaved($('#pvpages')); syncVbCount(); }
    const show = gloss => toastWord(hit.word, gloss, sentence, r.ok);
    if (window.E2GLOSS_DATA) {
      show(window.E2GL ? window.E2GL.lookup(hit.word, sentence) : '');
    } else {
      show('释义加载中…');
      try { await glossReady(); } catch (e) { toast('释义词典加载失败'); return true; }
      const gloss = window.E2GL ? window.E2GL.lookup(hit.word, sentence) : '';
      show(gloss);
      // 词已经先收下了,释义到了再补写回去
      if (r.ok && gloss && r.item && V.update) V.update(r.item.id, { gloss });
    }
    if (!r.ok && r.reason === 'bad') toast('没认出来这个词');
    return true;
  }
  /* 已收藏的词在原文里标虚线,一眼看出哪些收过 */
  function markSaved(root) {
    if (!V || !root) return;
    const keys = new Set(V.all().map(x => x.key));
    if (!keys.size) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        if (n.parentElement && n.parentElement.closest('.w-saved')) return NodeFilter.FILTER_REJECT;
        return /[A-Za-z]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      const txt = node.nodeValue, re = /[A-Za-z][A-Za-z’'-]*/g;
      let last = 0, html = '', hit = false, m;
      while ((m = re.exec(txt))) {
        const k = V.norm(m[0]);
        if (!keys.has(k)) continue;
        hit = true;
        html += esc(txt.slice(last, m.index)) +
          `<span class="w-saved" data-w="${esc(k)}">${esc(m[0])}</span>`;
        last = m.index + m[0].length;
      }
      if (!hit) return;
      html += esc(txt.slice(last));
      const wrap = document.createElement('span');
      wrap.innerHTML = html;
      node.parentNode.replaceChild(wrap, node);
    });
  }
  /* ───── 生词本往返:记住年份与当前单元,不再一按返回就掉回首页 ───── */
  const FROM_VOCAB = new URLSearchParams(location.search).get('from') === 'vocab';
  function currentUnitId() {
    const sc = $('.pv-scroll');
    if (!sc) return '';
    const top = sc.getBoundingClientRect().top + 90;
    let id = '';
    $$('#pvpages .page').forEach(p => { if (p.getBoundingClientRect().top <= top) id = p.dataset.unit; });
    return id || ($('#pvpages .page') ? $('#pvpages .page').dataset.unit : '');
  }
  function vbQuery(from) {
    const sp = new URLSearchParams();
    sp.set('y', S.y);
    const u = currentUnitId();
    if (u) sp.set('u', u);
    if (from) sp.set('from', from);
    return sp.toString();
  }
  function syncVbLinks() {
    const el = $('#vbEntry');
    if (el) el.href = 'vocab.html?' + vbQuery('paper');
  }
  function backToVocab() {
    location.replace('vocab.html?' + vbQuery('back'));
  }

  function syncVbCount() {
    const n = V ? V.count() : 0;
    ['#vbCount', '#vbCount2'].forEach(sel => {
      const el = $(sel);
      if (el) el.textContent = n ? String(n) : '';
    });
  }

  /* ───── 阅读模式:手机上别把 A4 缩到 52%,改成单栏重排 ─────
     纸面预览是给打印用的;手机上要看题、要校对,就得一行行读得下去。 */
  const RV = { on: false, idx: 0 };
  function rvUnit(u, i, total) {
    const d = unitDiff(u);
    const st = d.done
      ? `<span class="pm${d.mastered ? ' ok' : ''}">你 ${d.right}/${d.done}${d.mastered ? ' · 已掌握' : ''}</span>`
      : `<span class="pm">难度 ${d.tag}</span>`;
    const prev = i > 0 ? '<button class="rv-nav" data-rv="-1" aria-label="上一单元">‹</button>'
      : '<span class="rv-nav off">‹</span>';
    const next = i < total - 1 ? '<button class="rv-nav" data-rv="1" aria-label="下一单元">›</button>'
      : '<span class="rv-nav off">›</span>';
    let body = '';
    if (u.sec === 'partb') {
      body += `<div class="dirbox">${esc(u.dir || '')}</div>`;
      if (u.pool && u.pool.length) {
        body += `<div class="pool"><div class="pool-h">备选项 <i>OPTIONS A–G</i></div><div class="pool-g">` +
          u.pool.map(p => `<span><b>${esc(p.k)}</b>${esc(p.t)}</span>`).join('') + '</div></div>';
      }
      body += `<div class="sect">原文 <span>PASSAGE</span></div><div class="passage">` +
        (u.type === 'sub' ? segHTML(u) : (u.passage || []).map((p, pi) => `<p>${sentHTML(u, pi, p)}</p>`).join('')) +
        '</div>';
      body += `<div class="sect q">题目 <span>QUESTIONS</span></div><div class="qs">` +
        u.qs.map(q => rvQ(q, u)).join('') + '</div>';
    } else if (u.sec === 'translation' || u.sec === 'writing') {
      body += `<div class="dirbox">${esc(u.dir || '')}</div>`;
      if ((u.passage || []).length) {
        body += `<div class="sect">原文 <span>TEXT</span></div><div class="passage">` +
          u.passage.map((p, pi) => `<p>${sentHTML(u, pi, p)}</p>`).join('') + '</div>';
      }
      if ((u.figs || []).length) body += `<div class="fig"><img src="${esc(u.figs[0])}" alt="原题图表"></div>`;
    } else {
      body += `<div class="sect">原文 <span>PASSAGE</span></div><div class="passage">` +
        (u.passage || []).map((p, pi) => `<p>${sentHTML(u, pi, p)}</p>`).join('') + '</div>';
      body += `<div class="sect q">题目 <span>QUESTIONS</span></div><div class="qs">` +
        u.qs.map(q => rvQ(q, u)).join('') + '</div>';
    }
    return `<div class="rv-head">${prev}<div class="rv-t"><b>${esc(u.label)}</b>${st}</div>${next}</div>
      <div class="rv-body" data-unit="${esc(u.id)}">${body}</div>`;
  }
  function rvQ(q, u) {
    const inlineWhy = ckOn() && (!u || u.sec !== 'cloze');
    const opts = optCells(q, inlineWhy, ckOn());
    const dl = qDiff(q);
    const dq = q.dl ? `<i class="dq" title="难度 ${dl}/5${(q.note && q.note.dwhy) ? ' · ' + q.note.dwhy : ''}"><b>${'●'.repeat(dl)}</b>${'○'.repeat(5 - dl)}</i>` : '';
    const stem = (q.stem || '').trim();
    const four = u && u.sec === 'cloze' ? ' o4' : '';   // 完形四个词排一行,省地方
    const pill = (ckOn() && inlineWhy && q.note && q.note.loc) ? locPill(q.note) : '';
    return `<div class="q rv-q"><div class="rv-stem"><span class="no">${q.n}.</span>` +
      (stem ? `<span class="st">${esc(stem)}</span>` : '') + dq + pill + '</div>' +
      (opts ? `<div class="opts rv-opts${four}">${opts}</div>` : '') +
      (inlineWhy ? '' : ckLine(q)) + '</div>';
  }
  /* keepTop:记完作答重绘时保持滚动位置(否则一点选项就跳回单元开头) */
  function drawRV(keepTop) {
    const box = $('#rv'), p = paper(S.y), units = p ? p.units : [];
    if (!units.length) { box.innerHTML = ''; return; }
    RV.idx = Math.max(0, Math.min(units.length - 1, RV.idx));
    const u = units[RV.idx];
    const top = keepTop ? box.scrollTop : 0;
    box.innerHTML = rvUnit(u, RV.idx, units.length);
    markLocs(box, units);
    box.scrollTop = top;
    $('#pvn').textContent = `${S.y} · ${RV.idx + 1}/${units.length} · ${u.label}`;
  }
  function setRV(on) {
    RV.on = on;
    $('#pvrv').textContent = on ? '纸' : '读';
    $('#pvrv').title = on ? '切回 A4 纸面预览' : '阅读模式:单栏重排,适合手机细读';
    $('#pvrv').setAttribute('aria-label', on ? '切回 A4 纸面预览' : '阅读模式');
    $('#pvrv').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('.pv-scroll').hidden = on;
    $('#rv').hidden = !on;
    document.body.classList.toggle('rv-mode', on);
    const ck = ckOn();
    $('#pvchk').classList.toggle('on', ck);
    $('#pvchk').setAttribute('aria-pressed', ck ? 'true' : 'false');
    if (on) drawRV(); else fitScreen();
  }

  /* 单元标题条:难度 + 自己的正确率。放在纸面之外,打印不带走。 */
  function capHTML(u) {
    const d = unitDiff(u);
    return `<div class="pcap"><b>${esc(u.label)}</b>
      <button class="lv lv${d.lv}" data-lv="${esc(u.id)}"
        title="难度 ${d.lv}/5 · 点一下手动改(自动 → 易 → 难)">${d.tag}</button>
      <span class="pm${d.mastered ? ' ok' : ''}">${pmText(d)}</span></div>`;
  }
  function pmText(d) {
    if (!d.done) return '';
    return `你 ${d.right}/${d.done}${d.mastered ? ' · 已掌握' : ''}`;
  }
  /* 记完作答只改这一题和标题条,不重排整卷(9 页二分字号挺费劲) */
  function paintAnswer(n) {
    if (!PAP) return;
    const ans = PAP.answers[String(n)] || '';
    const mine = MY.get(PAP.y)[String(n)] || '';
    const root = $('#pvpages');
    $$('.q, .pq', root).forEach(qEl => {
      const no = qEl.querySelector('.no');
      if (!no || parseInt(no.textContent, 10) !== n) return;
      $$('.opts .o', qEl).forEach(o => {
        const b = o.querySelector('b');
        const L = b ? b.textContent.trim() : '';
        o.classList.toggle('mine', !!mine && L === mine);
        o.classList.toggle('bad', !!(ans && mine && L === mine && L !== ans));
      });
      const pick = qEl.querySelector('.pick');
      if (pick) {
        pick.textContent = mine || '';
        pick.classList.toggle('mine', !!mine);
      }
    });
    $$('.pcap', root.parentNode).forEach(cap => {
      const btn = cap.querySelector('[data-lv]');
      if (!btn) return;
      const u = PAP.units.find(x => x.id === btn.dataset.lv);
      if (!u) return;
      const d = unitDiff(u);
      const pm = cap.querySelector('.pm');
      if (pm) { pm.textContent = pmText(d); pm.className = 'pm' + (d.mastered ? ' ok' : ''); }
      btn.className = 'lv lv' + d.lv;
      btn.textContent = d.tag;
    });
  }

  /* 校对模式:按「¶段·句」把原文里支撑答案的那句高亮出来 */
  function markLocs(root, units) {
    if (!ckOn()) return;
    units.forEach(u => {
      const page = root.querySelector(`[data-unit="${CSS.escape(u.id)}"]`);
      if (!page) return;
      // 完形不高亮:空格本身就在句子里,整片高亮反而看不清
      if (u.sec === 'cloze') return;
      u.qs.forEach(q => {
        const n = q.note;
        if (!n || !n.loc) return;
        String(n.loc).split('+').forEach(part => {
          const pm = /^¶(\d+)(?:·(\d+))?$/.exec(part.trim());
          if (!pm) return;
          const el = pm[2]
            ? page.querySelector(`.sn[data-p="${pm[1]}"][data-s="${pm[2]}"]`)
            : page.querySelector(`.passage [data-p="${pm[1]}"]`);
          if (el) el.classList.add('hl');
        });
      });
    });
  }

  /* 点定位胶囊:跳到原文那句并闪一下(纸面和阅读模式都管用) */
  function jumpLoc(loc) {
    const box = RV.on ? $('#rv') : $('#pvpages');
    if (!box) return;
    let first = null;
    String(loc || '').split('+').forEach(part => {
      const pm = /^¶(\d+)(?:·(\d+))?$/.exec(part.trim());
      if (!pm) return;
      const sel = pm[2]
        ? `.sn[data-p="${pm[1]}"][data-s="${pm[2]}"]`
        : `.passage [data-p="${pm[1]}"]`;
      const el = box.querySelector(sel);
      if (!el) return;
      el.classList.add('hl', 'loc-flash');
      if (!first) first = el;
    });
    if (!first) return;
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => first.classList.remove('loc-flash'), 1800);
  }

  let token = 0;
  function draw() {
    const my = ++token, box = $('#pvpages'), p = paper(S.y), units = p ? p.units : [];
    const sc = $('.pv-scroll'), keepTop = sc ? sc.scrollTop : 0;
    PAP = p;
    window.__READY__ = false;
    if (!units.length) {
      box.innerHTML = '<section class="page"><p class="doc-empty">没有这一年的数据</p></section>';
      window.__E2_PAGES__ = 0; window.__READY__ = true; return;
    }
    box.innerHTML = units.map((u, i) => capHTML(u) + pageHTML(u, S.y, i + 1, units.length)).join('');
    box.style.zoom = 1;                       // 测量必须 1:1,屏幕缩放最后再套
    readyImages(box).then(() => {
      if (my !== token) return;
      $$('.page', box).forEach(fit);
      fitScreen();
      markSaved(box);                          // 已收藏的词标出来,不改排版尺寸
      markLocs(box, units);                    // 校对模式:高亮原文里支撑答案的句子
      syncVbCount();
      syncVbLinks();                           // 页面渲染完才有 data-unit,补齐 u
      $('#pvn').textContent = `${S.y} · ${units.length} 页 A4 · 点题号可单题打印`;
      $('#pvchk').classList.toggle('on', ckOn());
      $('#pvchk').setAttribute('aria-pressed', ckOn() ? 'true' : 'false');
      window.__E2_PAGES__ = units.length;
      window.__READY__ = true;
      if (sc) sc.scrollTop = keepTop;          // 重绘后回到原来的位置
      if (RV.on) drawRV();
      jumpToUnit();
    });
  }
  async function openPV(y) {
    S.y = y || S.y;
    const f = `pdf/e2-${S.y}.pdf`;
    $('#pvdl').href = f;
    $('#pvdl').textContent = `${S.y} 整套 PDF`;
    $('#pv').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#pvpages').scrollIntoView({ block: 'start' });
    const sp = new URLSearchParams();
    sp.set('y', S.y);
    if (wantUnit) sp.set('u', wantUnit);
    if (FROM_VOCAB) sp.set('from', 'vocab');
    history.pushState({ e2pv: 1 }, '', '?' + sp);
    syncVbLinks();
    if (!PAPERS[S.y]) {
      $('#pvpages').innerHTML = '<section class="page"><p class="doc-empty">正在加载…</p></section>';
      try { await loadYear(S.y); }
      catch (e) {
        $('#pvpages').innerHTML = `<section class="page"><p class="doc-empty">${esc(e.message)}</p></section>`;
        return;
      }
    }
    draw();
  }
  function closePV(fromPop) {
    $('#pv').hidden = true;
    document.body.style.overflow = '';
    if (!fromPop) history.replaceState(null, '', location.pathname);
    drawYears();                              // 回首页时把成绩和难度刷出来
  }
  /* 手机/浏览器返回键:先关预览露出年份列表,不要直接退出整个站点 */
  window.addEventListener('popstate', () => {
    if (!$('#pv').hidden) closePV(true);
  });

  /* 从生词本跳进原题时,顶栏「返回」应当回生词本,而不是关掉预览回首页。
     但「原题 ↔ 生词本」会形成闭环(生词本的返回链接又带回 y 参数),所以补一个
     直达主页的出口;只在 from=vocab 时出现,普通预览层外观不变。 */
  if (FROM_VOCAB) {
    $('#pvx').textContent = '← 生词本';
    const home = document.createElement('a');
    home.className = 'back';
    home.href = 'index.html';
    home.textContent = '主页';
    $('#pvx').parentNode.insertBefore(home, $('#pvx').nextSibling);
  }
  $('#pvx').onclick = () => FROM_VOCAB ? backToVocab() : closePV();
  $('.pv-scroll').addEventListener('scroll', () => { clearTimeout(syncVbLinks.t); syncVbLinks.t = setTimeout(syncVbLinks, 160); }, { passive: true });
  $('#pgo').onclick = () => {
    const p = paper(S.y);
    if (p) printUnits(p.units);
    else toast('题目还在加载，稍等一下再打印');
  };
  /* 答案校对模式:标出正确项、原文定位、决策关键与干扰项错因。
     校对只活在阅读模式 —— 纸面永远是打印的样子(空白卷)。 */
  $('#pvchk').onclick = () => {
    CK.on = !CK.on;
    try { localStorage.setItem(CK.key, CK.on ? '1' : '0'); } catch (e) {}
    $('#pvchk').classList.toggle('on', CK.on);
    $('#pvchk').setAttribute('aria-pressed', CK.on ? 'true' : 'false');
    if (CK.on && !RV.on) { setRV(true); return; }
    draw();
  };
  /* 阅读模式 ↔ A4 纸面 */
  $('#pvrv').onclick = () => setRV(!RV.on);
  $('#rv').addEventListener('click', e => {
    const nav = e.target.closest('[data-rv]');
    if (nav) { RV.idx += +nav.dataset.rv; drawRV(); return; }
    const pl = e.target.closest('[data-loc]');
    if (pl) { jumpLoc(pl.dataset.loc); return; }
    const ob = e.target.closest('.opts .o > b');
    if (ob) {
      const qEl = ob.closest('.q');
      const no = qEl && qEl.querySelector('.no');
      const n = no ? parseInt(no.textContent, 10) : NaN;
      if (n && PAP && PAP.answers[String(n)]) {
        MY.toggle(PAP.y, String(n), ob.textContent.trim());
        drawRV(true);
      }
      return;
    }
    collectFrom(e.clientX, e.clientY);       // 点单词 → 收藏
  });
  $('#pvpages').addEventListener('click', e => {
    const p = paper(S.y);
    if (!p) return;
    const pl = e.target.closest('[data-loc]');
    if (pl) { jumpLoc(pl.dataset.loc); return; }
    const qb = e.target.closest('.qbtn');
    if (qb) {
      const u = p.units.find(x => x.id === qb.closest('.page').dataset.unit);
      printOne(u, +qb.dataset.printQ);
      return;
    }
    const pb = e.target.closest('[data-print-page]');
    if (pb) { printUnits([p.units[+pb.dataset.printPage]]); return; }
    // 点难度徽标:手动改难度(自动 → 易 → 难 → 自动)
    const lvb = e.target.closest('[data-lv]');
    if (lvb) { MARK.cycle(lvb.dataset.lv); draw(); return; }
    // 点选项字母:记下我的作答,难度就能按我的正确率校准
    const ob = e.target.closest('.opts .o > b');
    if (ob) {
      const qEl = ob.closest('.q, .pq');
      const no = qEl && qEl.querySelector('.no');
      const n = no ? parseInt(no.textContent, 10) : NaN;
      if (n && PAP && PAP.answers[String(n)]) {
        MY.toggle(PAP.y, String(n), ob.textContent.trim());
        paintAnswer(n);
      }
      return;
    }
    if (suppressWordClick) { suppressWordClick = false; return; }
    collectFrom(e.clientX, e.clientY);         // 点单词 → 收藏
  });

  /* 移动端长按也能收,免得手指点不准 */
  let pressT = 0, suppressWordClick = false, suppressWTimer = 0;
  $('#pvpages').addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    suppressWordClick = false;              // 每次新触摸先重置
    clearTimeout(pressT);
    pressT = setTimeout(() => {
      if (collectFrom(t.clientX, t.clientY)) {
        suppressWordClick = true;
        clearTimeout(suppressWTimer);
        suppressWTimer = setTimeout(() => { suppressWordClick = false; }, 800);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }, 480);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
    $('#pvpages').addEventListener(ev, () => clearTimeout(pressT), { passive: true }));

  /* 从生词本跳回原题:?y=2024&u=2024-r3 */
  let wantUnit = null;
  function jumpToUnit() {
    if (!wantUnit) return;
    const id = wantUnit;
    wantUnit = null;
    const el = document.querySelector(`#pvpages .page[data-unit="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1400);
  }
  /* 直接按 Cmd/Ctrl+P 时,无条件用当前样式重建打印根:
     避免复用上一次打印留下的旧字号,也避免浏览器自己带上预览层的缩放 */
  window.addEventListener('beforeprint', () => {
    if (printing) return;
    const p = paper(S.y), root = $('#printroot');
    if (!p || !p.units.length) return;
    root.innerHTML = pagesHTML(p.units, null);
    $$('.page', root).forEach(fit);
  });
  window.addEventListener('afterprint', () => {
    if (!printing) $('#printroot').innerHTML = '';
  });
  window.addEventListener('resize', fitScreen);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#pv').hidden) FROM_VOCAB ? backToVocab() : closePV();
    // 阅读模式:左右方向键翻单元
    if (RV.on && !$('#pv').hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const p = paper(S.y);
      if (!p) return;
      const nx = RV.idx + (e.key === 'ArrowRight' ? 1 : -1);
      if (nx >= 0 && nx < p.units.length) { RV.idx = nx; drawRV(); e.preventDefault(); }
    }
  });

  /* 离线壳由 sw-reg.js 在三个入口(真题/作文/生词本)统一注册,这里不再重复。 */

  const q = new URLSearchParams(location.search);
  if (q.has('y') && D.years.includes(+q.get('y'))) S.y = +q.get('y');
  if (q.get('u')) wantUnit = q.get('u');
  drawYears();
  syncVbCount();
  setRV(window.matchMedia('(max-width:760px)').matches);   // 手机上默认用阅读模式
  if (q.has('y') || q.get('print') === '1') openPV(S.y);
})();
