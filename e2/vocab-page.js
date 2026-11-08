/* e2 生词本 · 页面逻辑 */
(function () {
  'use strict';
  const V = window.E2V;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const listEl = $('#vbList'), emptyEl = $('#vbEmpty'), qEl = $('#vbQ'), sortEl = $('#vbSort');
  const countEl = $('#vbCount'), toastEl = $('#vbToast');
  let undoTimer = 0;

  function toast(msg, action) {
    toastEl.innerHTML = `<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = () => { action.fn(); toastEl.hidden = true; };
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { toastEl.hidden = true; }, action ? 5000 : 1900);
  }

  const srcLine = s => V.sourceText(s);

  /* ── 联想候选:全卷真题词表 + 自己收藏的词 + 备注/例句里的词 ──
     相关度 = 完全匹配 > 前缀 > 包含;再叠加是否收藏、真题词频、越短越靠前。 */
  const WORDS = window.E2WORDS || [];
  function extras() {
    const out = [];
    V.all().forEach(it => {
      out.push({ v: it.word, tag: '已收藏' });
      String(it.note || '').split(/[\s,，;；。、()（）]+/).forEach(w => {
        if (w && w.length <= 24 && /^[\p{L}\p{N}'’\-]+$/u.test(w)) out.push({ v: w, tag: '备注' });
      });
      (String(it.sentence || '').match(/[A-Za-z][A-Za-z'’\-]{2,}/g) || [])
        .forEach(w => out.push({ v: w, tag: '例句' }));
    });
    return out;
  }
  function suggest(term) {
    const q = String(term || '').toLowerCase();
    if (!q) return [];
    const cap = /^[A-Z]/.test(String(term));
    const map = new Map();
    const add = (v, score, meta) => {
      const k = String(v || '').toLowerCase();
      if (!k || k === q || score <= 0) return;      // 与输入完全相同不必补全
      const old = map.get(k);
      if (!old || old.score < score) map.set(k, { v: k, score, meta });
    };
    extras().forEach(({ v, tag }) => {
      const l = v.toLowerCase();
      let sc = l === q ? 360 : l.startsWith(q) ? 230 + (tag === '已收藏' ? 80 : 0)
        : l.includes(q) ? 60 : 0;
      if (!sc) return;
      add(v, sc - (l.length - q.length) * 1.5 + (tag === '已收藏' ? 20 : 0), tag);
    });
    for (let i = 0; i < WORDS.length; i++) {
      const w = WORDS[i][0], n = WORDS[i][1];
      if (w[0] !== q[0]) continue;
      if (w === q) continue;
      let sc;
      if (w.startsWith(q)) sc = 200 + Math.min(70, Math.log2(n + 1) * 8) - (w.length - q.length) * 2;
      else if (q.length >= 2 && w.includes(q)) sc = 40 + Math.min(30, Math.log2(n + 1) * 4) - (w.length - q.length);
      else continue;
      add(w, sc + (cap ? 6 : 0), '真题 ' + n + ' 次');
    }
    return Array.from(map.values())
      .map(x => ({ v: x.v, score: Math.round(x.score), meta: x.meta }));
  }
  function bindAC(el, minChars, max) {
    if (window.E2AC && el) window.E2AC.attach(el, { source: suggest, minChars, max });
  }
  bindAC(qEl, 1, 8);
  bindAC($('#vbW'), 1, 8);
  bindAC($('#vbS'), 2, 6);

  const GL = window.E2GL;
  const opened = new Set();                 // 已点开的词条(render 后保持展开状态)
  function glossOf(it) {
    return it.gloss || (GL ? GL.lookup(it.word, it.sentence) : '') || '';
  }

  function rowHTML(it, firstWord) {
    const src = srcLine(it.source);
    const href = V.sourceHref(it.source);
    const srcTag = href
      ? `<a class="vb-src" href="${esc(href)}">${esc(src)}</a>`
      : `<span class="vb-src">${esc(src)}</span>`;
    const when = new Date(it.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    const g = glossOf(it);
    /* 同一句被多个词收藏时,只在第一条显示完整例句,其余指向它,避免整屏重复 */
    const dup = it.sentence && firstWord && firstWord !== it.word;
    const eg = !it.sentence
      ? `<p class="vb-eg empty">暂无例句${it.manual ? '，可在备注里补充' : ''}</p>`
      : dup ? `<p class="vb-eg dup">例句同上 · 见 <b>${esc(firstWord)}</b></p>`
        : `<p class="vb-eg">${esc(it.sentence)}</p>`;
    const cn = it.sentenceCn ? `<p class="vb-eg-cn">${esc(it.sentenceCn)}</p>` : '';
    return `<li class="vb-item" data-id="${esc(it.id)}">
      <div class="vb-row">
        <div class="vb-main">
          <div class="vb-top">
            <button class="vb-wd" type="button" data-act="flip"
              title="点一下显示中文释义与例句">${esc(it.word)}<i class="vb-hint">释义 ⌄</i></button>
            ${srcTag}<i class="vb-date">${when}</i>
          </div>
          <div class="vb-detail" hidden>
            <div class="vb-gloss${g ? '' : ' empty'}"><span>${g ? esc(g) : '暂无内置中文释义'}</span>
              <button type="button" data-act="gloss">${g ? '改' : '补充'}</button></div>
            <input class="vb-gloss-edit" type="text" hidden placeholder="中文释义，如 adj. 社交的">
            ${eg}${cn}
            <button class="vb-cn-b" type="button" data-act="sentcn">${it.sentenceCn ? '改例句译文' : '＋ 补例句译文'}</button>
            <textarea class="vb-cn-edit" rows="2" hidden placeholder="例句的中文翻译（可留空）"></textarea>
          </div>
          <p class="vb-note"${it.note ? '' : ' hidden'}>${esc(it.note || '')}</p>
          <textarea class="vb-note-edit" rows="2" hidden placeholder="写点备注，例如近义、易混、真题里的用法"></textarea>
          <div class="vb-act">
            <button type="button" data-act="note">${it.note ? '改备注' : '加备注'}</button>
            <button type="button" data-act="del" class="danger">删除</button>
          </div>
        </div>
        <button class="vb-swipe-del" type="button" data-act="del" aria-hidden="true" tabindex="-1">删除</button>
      </div>
    </li>`;
  }

  function render() {
    const list = V.query(qEl.value, sortEl.value);
    const all = V.count();
    countEl.textContent = `${all} 个词`;
    const first = new Map();
    list.forEach(it => { if (it.sentence && !first.has(it.sentence)) first.set(it.sentence, it.word); });
    listEl.innerHTML = list.map(it => rowHTML(it, first.get(it.sentence))).join('');
    listEl.querySelectorAll('.vb-item').forEach(el => { if (opened.has(el.dataset.id)) setOpen(el, true); });
    if (!list.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = all
        ? '没有匹配的词条，换个关键词试试。'
        : '还没有收藏。做题时点一下原文里的单词就能收进来，也可以在上面手动添加。';
    } else emptyEl.hidden = true;
  }

  function setOpen(item, on) {
    const d = item.querySelector('.vb-detail');
    if (!d) return;
    d.hidden = !on;
    item.classList.toggle('open', on);
    if (on) opened.add(item.dataset.id); else opened.delete(item.dataset.id);
  }

  /* ── 删除(带撤销) ── */
  function del(id) {
    const rec = V.all().find(x => x.id === id);
    if (!rec) return;
    V.remove(id);
    render();
    toast(`已删除 ${rec.word}`, { label: '撤销', fn: () => { V.restore(rec); render(); } });
  }

  /* ── 事件:点击 / 长按 / 左滑 ── */
  let pressTimer = 0, pressItem = null, suppressClick = false;

  listEl.addEventListener('click', e => {
    const item = e.target.closest('.vb-item');
    if (!item) return;
    const id = item.dataset.id;
    const act = e.target.closest('[data-act]');
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    if (!act) return;

    if (act.dataset.act === 'del') { del(id); return; }
    if (act.dataset.act === 'flip') {
      const d = item.querySelector('.vb-detail');
      setOpen(item, d.hidden);
      return;
    }
    if (act.dataset.act === 'gloss' || act.dataset.act === 'sentcn') {
      const isG = act.dataset.act === 'gloss';
      const f = item.querySelector(isG ? '.vb-gloss-edit' : '.vb-cn-edit');
      const rec = V.all().find(x => x.id === id) || {};
      f.value = isG ? glossOf(rec) : (rec.sentenceCn || '');
      f.hidden = false; f.focus();
      const save = () => {
        V.update(id, isG ? { gloss: f.value.trim() } : { sentenceCn: f.value.trim() });
        render();
      };
      f.onblur = save;
      f.onkeydown = ev => {
        if (ev.key === 'Enter' && (f.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey)) {
          ev.preventDefault(); f.blur();
        }
        if (ev.key === 'Escape') { f.onblur = null; f.hidden = true; }
      };
      return;
    }
    if (act.dataset.act === 'note') {
      const ta = item.querySelector('.vb-note-edit');
      const nt = item.querySelector('.vb-note');
      if (!ta.hidden) { ta.blur(); return; }
      ta.value = V.all().find(x => x.id === id)?.note || '';
      ta.hidden = false; nt.hidden = true;
      bindAC(ta, 2, 6);
      ta.focus();
      const save = () => {
        V.update(id, { note: ta.value.trim() });
        ta.hidden = true;
        render();
      };
      ta.onblur = save;
      ta.onkeydown = ev => {
        if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ta.blur(); }
        if (ev.key === 'Escape') { ta.onblur = null; ta.hidden = true; nt.hidden = false; }
      };
    }
  });

  /* 长按删除:移动端 620ms */
  listEl.addEventListener('touchstart', e => {
    const item = e.target.closest('.vb-item');
    if (!item) return;
    pressItem = item;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      suppressClick = true;
      if (navigator.vibrate) navigator.vibrate(12);
      del(item.dataset.id);
    }, 620);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
    listEl.addEventListener(ev, () => { clearTimeout(pressTimer); }, { passive: true }));
  listEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.vb-item')) e.preventDefault();
  });

  /* 左滑露出删除 */
  let sx = 0, sy = 0, dragging = null, dx = 0;
  listEl.addEventListener('touchstart', e => {
    const row = e.target.closest('.vb-row');
    if (!row) return;
    dragging = row; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0;
    row.style.transition = 'none';
  }, { passive: true });
  listEl.addEventListener('touchmove', e => {
    if (!dragging) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 12) { dragging = null; return; }
    dx = Math.max(-104, Math.min(0, mx));
    if (dx < -6) clearTimeout(pressTimer);
    dragging.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  listEl.addEventListener('touchend', () => {
    if (!dragging) return;
    const row = dragging; dragging = null;
    row.style.transition = 'transform .18s ease';
    row.style.transform = dx < -56 ? 'translateX(-96px)' : 'translateX(0)';
  }, { passive: true });
  document.addEventListener('click', e => {
    if (!e.target.closest('.vb-row')) {
      listEl.querySelectorAll('.vb-row').forEach(r => { r.style.transform = 'translateX(0)'; });
    }
  });

  /* ── 手动添加 ── */
  $('#vbAdd').addEventListener('submit', e => {
    e.preventDefault();
    const w = $('#vbW').value.trim(), s = $('#vbS').value.trim();
    if (!w) return;
    const r = V.add({
      word: w, sentence: s, manual: true, source: { type: 'manual' },
      gloss: GL ? GL.lookup(w, s) : ''          // 手动添加也能带出内置释义
    });
    if (r.ok) {
      $('#vbW').value = ''; $('#vbS').value = '';
      qEl.value = '';
      render();
      toast(`已添加 ${r.item.word}`);
    } else if (r.reason === 'dup') toast(`${r.item.word} 已经在生词本里了`);
    else toast('这个词看起来不太对，检查一下拼写');
    $('#vbW').focus();
  });

  qEl.addEventListener('input', render);
  sortEl.addEventListener('change', render);
  V.on(render);

  /* ── 返回:记住从哪一卷、哪一单元进来的,不再一按就掉回首页 ── */
  const P = new URLSearchParams(location.search);
  const back = $('#vbBack');
  if (P.get('y')) {
    const sp = new URLSearchParams();
    sp.set('y', P.get('y'));
    if (P.get('u')) sp.set('u', P.get('u'));
    sp.set('from', 'vocab');
    back.href = 'index.html?' + sp;
    back.textContent = '← 回到原题';
  }

  render();
})();
