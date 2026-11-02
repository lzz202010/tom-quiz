/* 写作板块(路由 #/writing…)。数据 writing-data.js(window.WR,scripts/build_writing.py 生成),
   由 app.js 的 loadWriting 按需加载;用主站的 $app / el / esc / load / store / subjectTabs / themeToggle / render。
   路由:#/writing 首页 · #/writing/read/<id> 阅读一篇 · #/writing/doc/<guide-lz|guide-ls|pattern|cheat> 指南页。
   状态 localStorage gzb.wr.v1 = {read:{id:时间}, notes:{id:文字}, fs:字号倍数, reveal:'ask'|'all', last:id}(并入导出/导入备份) */
(function () {
  const KEY = 'gzb.wr.v1';
  const wr = Object.assign({ read: {}, notes: {}, fs: 1, reveal: 'ask', last: null }, load(KEY, {}));
  const save = () => store(KEY, wr);
  const ITEMS = WR.items, BY = {};
  ITEMS.forEach(it => { BY[it.id] = it; });
  const PART = { lz: '论证有效性分析', ls: '论说文' };
  const DOCS = {
    'guide-lz': ['论证有效性分析 · 怎么写', () => WR.guide.lz],
    'guide-ls': ['论说文 · 怎么写', () => WR.guide.ls],
    pattern: ['近六年规律与预测', () => WR.overview],
    cheat: ['考前一页纸', () => WR.cheat],
  };
  let homeY = 0, revealed = null, scrollFn = null;

  const label = it => it.kind === '模拟' ? '模拟 ' + '一二三'[it.n - 1] : it.y + ' ' + it.kind;
  const title = it => it.title || (it.part === 'lz' ? '论证有效性分析' : '论说文');
  const track = it => ITEMS.filter(x => x.part === it.part && (x.kind === '模拟') === (it.kind === '模拟'));
  const go = h => { location.hash = h; };

  function setPg(w) { let p = document.querySelector('.wr-pg'); if (!p) { p = el('div', 'wr-pg'); document.body.append(p); } p.style.width = w + '%'; }
  function dropPg() { const p = document.querySelector('.wr-pg'); if (p) p.remove(); if (scrollFn) { window.removeEventListener('scroll', scrollFn); scrollFn = null; } }

  window.renderWriting = function () {
    const parts = (location.hash || '').split('/');       // ['#','writing', 'read', id]
    dropPg();
    document.title = '写作 · 管综精练';
    if (parts[2] === 'read' && BY[parts[3]]) return renderRead(BY[parts[3]]);
    if (parts[2] === 'doc' && DOCS[parts[3]]) return renderDoc(parts[3]);
    return renderHome();
  };

  /* ── 首页:一条学习路径(方法 → 真题精读 → 规律) ── */
  function renderHome() {
    $app.innerHTML = '';
    const w = el('div', 'wrap wr');
    const head = el('header', 'hero');
    head.append(themeToggle('themefab'), subjectTabs(), el('h1', '', '写作'));
    w.append(head);
    const done = ITEMS.filter(x => wr.read[x.id]).length;
    w.append(el('p', 'wr-sub', '27 冲点写作讲义 · 管综 / 经综 2021–2026 真题精读 · 已读 ' + done + ' / ' + ITEMS.length));

    if (wr.last && BY[wr.last]) {
      const it = BY[wr.last], b = el('button', 'card wr-resume',
        '<div class="t"><small>继续阅读</small>' + esc(label(it) + ' · ' + PART[it.part]) + '<br>' + esc(title(it)) + '</div>');
      b.append(el('span', 'btn small', '继续'));
      b.onclick = () => go('#/writing/read/' + it.id);
      w.append(b);
    }

    w.append(el('div', 'wr-h', '<i>一</i>方法<span>先知道怎么写</span>'));
    const g = el('div', 'wr-go');
    [['guide-lz', '论证有效性 · 怎么写', '三种质疑思路 · 谬误句式 · 一篇精批'],
     ['guide-ls', '论说文 · 怎么写', '审题四步 · 说理段大表 · 正文模板'],
     ['cheat', '考前一页纸', '句式与骨架,一屏扫完']].forEach(function (x) {
      const b = el('button', 'card', '<b>' + x[1] + '</b><span>' + x[2] + '</span>');
      b.onclick = () => go('#/writing/doc/' + x[0]);
      g.append(b);
    });
    w.append(g);

    w.append(el('div', 'wr-h', '<i>二</i>真题精读<span>先自己想,再看解析</span>'));
    const mx = el('div', 'card wr-mx');
    mx.append(el('div', 'wr-row hd', '<div class="y"></div><div>管综</div><div>经综</div>'));
    const years = [...new Set(ITEMS.filter(x => x.y).map(x => x.y))].sort((a, b) => b - a);
    const pill = (id, txt) => {
      const b = el('button', 'wr-pill' + (wr.read[id] ? ' done' : ''), txt);
      b.onclick = () => go('#/writing/read/' + id);
      return b;
    };
    years.forEach(function (y) {
      const row = el('div', 'wr-row', '<div class="y">' + y + '</div>');
      [['g', '管综'], ['j', '经综']].forEach(function (k) {
        const c = el('div', 'wr-cell');
        c.append(pill('lz' + y + k[0], '论证'), pill('ls' + y + k[0], '论说文'));
        row.append(c);
      });
      mx.append(row);
    });
    const mr = el('div', 'wr-row', '<div class="y">模拟</div>');
    const mc = el('div', 'wr-mock');
    [1, 2, 3].forEach(function (n) { mc.append(pill('lzm' + n, '第' + '一二三'[n - 1] + '套 · 论证'), pill('lsm' + n, '第' + '一二三'[n - 1] + '套 · 论说')); });
    mr.style.gridTemplateColumns = '4.6em 1fr';
    mr.append(mc);
    mx.append(mr);
    w.append(mx);

    w.append(el('div', 'wr-h', '<i>三</i>规律与预测<span>据 12 套真题归纳</span>'));
    const p = el('button', 'card wr-resume',
      '<div class="t"><small>近六年</small>哪类漏洞最常考、立意落点在哪、今年往哪押</div>');
    p.append(el('span', 'btn ghost small', '查看'));
    p.onclick = () => go('#/writing/doc/pattern');
    w.append(p);

    const set = el('label', 'wr-sub', '');
    set.style.cursor = 'pointer';
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = wr.reveal === 'all';
    cb.onchange = () => { wr.reveal = cb.checked ? 'all' : 'ask'; save(); };
    set.append(cb, document.createTextNode(' 进入真题时直接显示解析与范文(默认先遮住,让你先自己想)'));
    w.append(set);
    $app.append(w);
    window.scrollTo(0, homeY);
  }

  /* ── 阅读框架:顶栏(返回 / 字号)+ 正文 + 底栏 ── */
  function frame(barTitle, cls, build, nav) {
    $app.innerHTML = '';
    const w = el('div', 'wrap wr wr-read');
    const bar = el('div', 'wr-bar');
    const back = el('button', '', '‹ 返回');
    back.onclick = function () { homeY = homeY || 0; go('#/writing'); };
    const sm = el('button', '', 'A−'), lg = el('button', '', 'A+');
    const body = el('article', cls);
    const fs = d => { wr.fs = Math.max(.85, Math.min(1.5, +(wr.fs + d * .08).toFixed(2))); body.style.setProperty('--fs', wr.fs); save(); };
    sm.onclick = () => fs(-1); lg.onclick = () => fs(1);
    bar.append(back, el('span', 'sp', esc(barTitle)), sm, lg);
    body.style.setProperty('--fs', wr.fs);
    build(body);
    w.append(bar, body);
    if (nav) w.append(nav);
    $app.append(w);
    window.scrollTo(0, 0);
    scrollFn = function () {
      const h = document.documentElement.scrollHeight - innerHeight, y = window.scrollY;
      setPg(h > 0 ? Math.min(100, y / h * 100) : 0);
      if (frame.onScroll) frame.onScroll(h > 0 ? y / h : 1);
    };
    window.addEventListener('scroll', scrollFn, { passive: true });
    scrollFn();
  }
  frame.onScroll = null;

  function renderDoc(name) {
    frame.onScroll = null;
    const d = DOCS[name];
    frame(d[0], 'wr-doc', function (body) {
      body.append(el('div', 'wr-eye', name === 'cheat' ? '速 查' : '指 南'));
      body.append(el('h1', '', d[0]));
      body.insertAdjacentHTML('beforeend', d[1]());
      body.querySelectorAll('h1').forEach((h, i) => { if (i) h.remove(); });
    });
  }

  function paras(arr) { return arr.map(p => '<p>' + esc(p) + '</p>').join(''); }
  function essayHtml(es) {
    if (!es) return '';
    return '<div class="wr-essay"><h2>' + esc(es.title) + '</h2>' + paras(es.paras) + (es.count ? '<p class="n">' + es.count + ' 字符</p>' : '') + '</div>';
  }
  function labelled(ps) {
    return ps.map(function (p) {
      if (/^\d\.\S{2,8}$/.test(p)) return '<h5>' + esc(p) + '</h5>';
      const m = p.match(/^([^：:，。]{2,12})[：:]([\s\S]*)$/);
      return m ? '<p><b>' + esc(m[1]) + '</b>' + esc(m[2]) + '</p>' : '<p>' + esc(p) + '</p>';
    }).join('');
  }
  const sec = t => '<div class="wr-sec"><span>' + t + '</span></div>';

  function renderRead(it) {
    const tr = track(it), idx = tr.indexOf(it);
    wr.last = it.id; save();
    const ask = wr.reveal !== 'all';
    if (revealed !== it.id && !ask) revealed = it.id;
    frame(label(it), 'wr-art', function (body) {
      body.append(el('div', 'wr-eye', esc(label(it) + ' · ' + PART[it.part])));
      body.append(el('h1', '', esc(title(it))));
      const chipsEl = el('div', 'wr-chips', (it.chips || []).map(c => '<span class="chip">' + esc(c) + '</span>').join(''));
      chipsEl.hidden = revealed !== it.id;        // 谬误类型是答案的一部分,先遮住
      body.append(chipsEl);
      body.insertAdjacentHTML('beforeend', sec('材料') + '<div class="wr-mat">' + paras(it.material) + '</div>');
      const rest = el('div');
      const fill = function () {
        let h = '';
        if (it.part === 'lz') h += sec('本题的谬误点 · ' + it.points.length + ' 个') + '<ol class="wr-pts">' +
          it.points.map(p => '<li><b>' + esc(p[0] || '要点') + '</b>' + esc(p[1]) + '</li>').join('') + '</ol>';
        else h += sec('审题解析') + '<div class="wr-ana">' + labelled(it.shenti) + '</div>' +
          sec('段落写作思路') + '<div class="wr-ana">' + labelled(it.silu) + '</div>';
        h += sec('参考范文') + essayHtml(it.essay);
        rest.innerHTML = h;
        chipsEl.hidden = false;
      };
      const note = function () {
        const d = el('div');
        d.innerHTML = sec('我的笔记');
        const ta = el('textarea', 'wr-note');
        ta.placeholder = it.part === 'lz' ? '我漏掉了哪些点?哪类漏洞我总是看不出来?' : '这篇的核心概念和标题是什么?我没想到的立意?';
        ta.value = wr.notes[it.id] || '';
        let t;
        ta.oninput = function () { clearTimeout(t); t = setTimeout(function () { if (ta.value.trim()) wr.notes[it.id] = ta.value; else delete wr.notes[it.id]; save(); }, 400); };
        d.append(ta);
        const end = el('div', 'wr-end');
        const mk = el('button', 'btn small ' + (wr.read[it.id] ? 'ghost' : ''), wr.read[it.id] ? '已读 ✓(点此取消)' : '标为已读');
        mk.onclick = function () { if (wr.read[it.id]) delete wr.read[it.id]; else wr.read[it.id] = Date.now(); save(); mk.className = 'btn small ' + (wr.read[it.id] ? 'ghost' : ''); mk.textContent = wr.read[it.id] ? '已读 ✓(点此取消)' : '标为已读'; };
        end.append(mk);
        d.append(end);
        return d;
      };
      if (revealed === it.id) { fill(); body.append(rest, note()); }
      else {
        const g = el('div', 'wr-gate', '<b>先自己想一想</b>' + (it.part === 'lz'
          ? '拿一张草稿纸,圈出结论,逐段找漏洞,写下你找到的几点和类型。<br>想完再看,记得最牢。'
          : '先判断:核心概念是什么?关系类型?标题怎么拟?提纲怎么搭?<br>写完提纲再看解析。'));
        const b = el('button', 'btn', '我想好了,看解析与范文');
        b.onclick = function () { revealed = it.id; g.remove(); fill(); body.append(rest, note()); if (!wr.read[it.id]) { wr.read[it.id] = Date.now(); save(); } window.scrollTo({ top: rest.offsetTop - 80, behavior: 'smooth' }); };
        const a = el('a', '', '以后直接显示');
        a.onclick = function () { wr.reveal = 'all'; save(); b.onclick(); };
        g.append(b, a);
        body.append(g);
      }
    }, (function () {
      const nav = el('div', 'wr-foot');
      const pv = el('button', '', '‹ 上一篇'), nx = el('button', '', '下一篇 ›');
      pv.disabled = idx <= 0; nx.disabled = idx >= tr.length - 1;
      pv.onclick = () => go('#/writing/read/' + tr[idx - 1].id);
      nx.onclick = () => go('#/writing/read/' + tr[idx + 1].id);
      nav.append(pv, el('span', 'n', (idx + 1) + ' / ' + tr.length), nx);
      return nav;
    })());
    // 读到末尾自动算已读
    frame.onScroll = function (r) { if (r > .95 && revealed === it.id && !wr.read[it.id]) { wr.read[it.id] = Date.now(); save(); } };
    document.title = '写作 · ' + title(it);
  }

  document.addEventListener('keydown', function (ev) {
    if ((location.hash || '').indexOf('#/writing/read/') !== 0 || /input|textarea/i.test((ev.target || {}).tagName || '')) return;
    const it = BY[(location.hash || '').split('/')[3]];
    if (!it) return;
    const tr = track(it), i = tr.indexOf(it);
    if (ev.key === 'ArrowLeft' && i > 0) go('#/writing/read/' + tr[i - 1].id);
    else if (ev.key === 'ArrowRight' && i < tr.length - 1) go('#/writing/read/' + tr[i + 1].id);
    else if (ev.key === 'Escape') go('#/writing');
  });
  window.addEventListener('hashchange', function () {
    if ((location.hash || '').indexOf('#/writing') !== 0) { dropPg(); document.title = '管综精练 · 数学与逻辑题库'; }
  });
  // 首页滚动位置:离开首页去阅读前记下
  window.addEventListener('scroll', function () { if ((location.hash || '') === '#/writing' || (location.hash || '') === '#/writing/') homeY = window.scrollY; }, { passive: true });
})();
