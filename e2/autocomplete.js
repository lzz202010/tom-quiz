/* e2 输入框联想补全(通用组件)
   用法: E2AC.attach(inputEl, {
     source: (term, el) => [{ v:'social', meta:'真题 42 次', score:120 }, ...] | Promise,
     minChars: 1,          // 少于这个长度不弹
     max: 8,               // 最多几条
     delay: 45,            // 连续快速输入的防抖
     onPick: (v, el) => {} // 可选
   })
   只接管「光标前最后一个词」,自由文本/中文输入不受影响;不接管原生提交与 Tab 导航
   (只有按过 ↑↓ 选中候选后,Enter/Tab 才用于补全)。 */
(function (global) {
  'use strict';
  const TAIL = /[\p{L}\p{N}'’\-]+$/u;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function termOf(el) {
    const pos = el.selectionStart;
    if (pos == null || document.activeElement !== el) return null;
    const before = String(el.value).slice(0, pos);
    const m = before.match(TAIL);
    if (!m) return null;
    return { text: m[0], start: pos - m[0].length, end: Math.max(el.selectionEnd || pos, pos) };
  }

  /* 保留用户敲入的大小写风格:SOC → SOCIAL,Soc → Social,soc → social */
  function matchCase(word, typed) {
    if (/[A-Z]/.test(typed) && typed === typed.toUpperCase()) return word.toUpperCase();
    if (/^[A-Z]/.test(typed)) return word.charAt(0).toUpperCase() + word.slice(1);
    return word.toLowerCase();
  }

  function attach(el, opts) {
    if (!el || el.dataset.ac === '1') return null;
    opts = opts || {};
    const min = opts.minChars == null ? 1 : opts.minChars;
    const max = opts.max || 8;
    const delay = opts.delay == null ? 45 : opts.delay;
    const source = opts.source || (() => []);
    el.dataset.ac = '1';
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('aria-autocomplete', 'list');

    const pop = document.createElement('div');
    pop.className = 'ac-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'listbox');
    document.body.appendChild(pop);

    let items = [], active = -1, token = 0, timer = 0, skip = 0;

    function hide() {
      pop.hidden = true;
      active = -1;
      if (!el.isConnected) { pop.remove(); return; }   // 动态输入框被重建后顺手清理浮层
      el.setAttribute('aria-expanded', 'false');
    }
    function place() {
      const r = el.getBoundingClientRect();
      pop.style.left = Math.round(r.left) + 'px';
      pop.style.width = Math.round(r.width) + 'px';
      const h = pop.offsetHeight || 200;
      const below = r.bottom + 5;
      pop.style.top = (below + h > innerHeight - 8 && r.top - h - 5 > 8)
        ? Math.round(r.top - h - 5) + 'px' : Math.round(below) + 'px';
    }
    function paint() {
      const t = termOf(el);
      const typed = t ? t.text : '';
      pop.innerHTML = items.map((it, i) => {
        const v = it.v;
        const at = typed ? v.toLowerCase().indexOf(typed.toLowerCase()) : -1;
        const a = at < 0 ? '' : esc(v.slice(0, at));
        const b = at < 0 ? esc(v) : `<b>${esc(v.slice(at, at + typed.length))}</b>`;
        const c = at < 0 ? '' : esc(v.slice(at + typed.length));
        return `<div class="ac-item${i === active ? ' on' : ''}" data-i="${i}" role="option"
          aria-selected="${i === active}"><span class="ac-v">${a}${b}${c}</span>
          ${it.meta ? `<i class="ac-meta">${esc(it.meta)}</i>` : ''}</div>`;
      }).join('');
      place();
    }
    function show(list) {
      items = (list || []).filter(x => x && x.v).slice(0, max);
      if (!items.length) { hide(); return; }
      active = -1;                          // 默认不高亮,保证 Enter 仍能正常提交表单
      document.querySelectorAll('.ac-pop:not([hidden])').forEach(p => {
        if (p !== pop) p.hidden = true;     // 同一时刻只留一个候选框
      });
      paint();
      pop.hidden = false;
      el.setAttribute('aria-expanded', 'true');
    }
    function update() {
      if (skip > 0) { skip--; return; }       // 补全后自己派发的 input,不再弹一次
      clearTimeout(timer);
      const t = termOf(el);
      const my = ++token;
      if (!t || t.text.length < min) { hide(); return; }
      timer = setTimeout(() => {
        let res;
        try { res = source(t.text, el); } catch (e) { res = []; }
        Promise.resolve(res).then(list => {
          if (my !== token) return;                       // 快速输入:丢弃过期结果
          const now = termOf(el);
          if (!now || now.text !== t.text) return;        // 光标前的词已被改写
          const typed = t.text.toLowerCase();
          const norm = (list || []).map(x => typeof x === 'string' ? { v: x } : x)
            .filter(x => x && x.v)
            .sort((a, b) => (b.score || 0) - (a.score || 0) ||
              a.v.length - b.v.length || a.v.localeCompare(b.v));
          show(norm);
        }).catch(() => hide());
      }, delay);
    }
    function pick(i) {
      const it = items[i], t = termOf(el);
      if (!it || !t) { hide(); return; }
      const val = matchCase(it.v, t.text);
      const v = String(el.value);
      el.value = v.slice(0, t.start) + val + v.slice(t.end);
      const caret = t.start + val.length;
      try { el.setSelectionRange(caret, caret); } catch (e) {}
      hide();
      skip++;                                // 让接下来这次 input 事件只刷新列表、不重开候选
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof opts.onPick === 'function') opts.onPick(val, el);
    }

    el.addEventListener('input', update);
    el.addEventListener('focus', () => { if (el.value) update(); });
    el.addEventListener('click', () => { if (pop.hidden && el.value) update(); });
    el.addEventListener('keydown', e => {
      if (pop.hidden || !items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault(); active = (active + 1) % items.length; paint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); active = (active - 1 + items.length) % items.length; paint();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (active < 0) { hide(); return; }               // 未选候选 → 维持原生行为
        e.preventDefault(); pick(active);
      } else if (e.key === 'Escape') {
        hide();
      }
    });

    pop.addEventListener('mousedown', e => e.preventDefault());  // 别让输入框失焦
    pop.addEventListener('mouseover', e => {
      const row = e.target.closest('.ac-item');
      if (row && +row.dataset.i !== active) { active = +row.dataset.i; paint(); }
    });
    pop.addEventListener('click', e => {
      const row = e.target.closest('.ac-item');
      if (row) { e.preventDefault(); pick(+row.dataset.i); el.focus(); }
    });
    document.addEventListener('pointerdown', e => {
      if (!pop.hidden && e.target !== el && !pop.contains(e.target)) hide();
    });
    el.addEventListener('blur', () => setTimeout(() => {
      if (!pop.contains(document.activeElement)) hide();
    }, 140));
    window.addEventListener('scroll', () => { if (!pop.hidden) place(); }, true);
    window.addEventListener('resize', () => { if (!pop.hidden) place(); });

    return { update, hide, el };
  }

  global.E2AC = { attach, matchCase };
})(window);
