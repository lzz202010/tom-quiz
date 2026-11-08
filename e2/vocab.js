/* e2 生词本 · 数据层
   存储:localStorage['e2.vocab.v1'] → 词条数组(新的在前)
   一条记录:
   {
     id:        'word-时间戳36进制',       // 唯一键
     word:      'reskilling',              // 原形(首字母大小写按原文)
     key:       'reskilling',              // 归一化小写,去重用
     sentence:  '...',                     // 真题语境例句(自动截取)
     gloss:     'adj. 社交的',             // 中文释义(内置表给出,可手动改)
     sentenceCn:'...',                    // 例句中文译文(可手动补充,默认空)
     source:    { type:'paper'|'manual', year:2021, section:'reading',
                  label:'阅读理解 Text 1', unitId:'2021-r1', qn:21 },
     note:      '',                        // 个人备注
     manual:    false,                     // 是否手动添加
     hits:      1,                          // 重复收藏次数
     createdAt: 1750000000000              // 收藏时间戳(毫秒)
   } */
(function (global) {
  'use strict';
  const KEY = 'e2.vocab.v1';
  const subs = [];
  const norm = w => String(w == null ? '' : w).toLowerCase()
    .replace(/[’']/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');

  function read() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(x => x && x.word) : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); }
    catch (e) { console.warn('生词本写入失败', e); }
    subs.forEach(fn => { try { fn(list); } catch (e) {} });
    return list;
  }

  const api = {
    KEY,
    norm,
    all: read,
    count: () => read().length,
    has(word) {
      const k = norm(word);
      return !!k && read().some(x => x.key === k || norm(x.word) === k);
    },
    find(word) {
      const k = norm(word);
      return read().find(x => x.key === k || norm(x.word) === k) || null;
    },
    /* 收藏:同词去重,只累加 hits 并返回 dup */
    add(it) {
      const word = String((it && it.word) || '').trim();
      const key = norm(word);
      if (!key || !/^[a-z][a-z' -]*$/.test(key)) return { ok: false, reason: 'bad' };
      const list = read();
      const i = list.findIndex(x => x.key === key || norm(x.word) === key);
      if (i >= 0) {
        list[i].hits = (list[i].hits || 1) + 1;
        if (!list[i].sentence && it.sentence) list[i].sentence = it.sentence;
        if (!list[i].gloss && it.gloss) list[i].gloss = it.gloss;
        write(list);
        return { ok: false, reason: 'dup', item: list[i] };
      }
      const rec = {
        id: key + '-' + Date.now().toString(36),
        word,
        key,
        sentence: String(it.sentence || '').trim(),
        gloss: String(it.gloss || '').trim(),
        sentenceCn: String(it.sentenceCn || '').trim(),
        source: it.source || { type: 'manual' },
        note: '',
        manual: !!it.manual || !it.source || it.source.type === 'manual',
        hits: 1,
        createdAt: Date.now()
      };
      list.unshift(rec);
      write(list);
      return { ok: true, item: rec };
    },
    remove(id) {
      write(read().filter(x => x.id !== id));
    },
    /* 撤销删除用 */
    restore(rec) {
      const list = read();
      if (!list.some(x => x.id === rec.id)) { list.unshift(rec); write(list); }
    },
    update(id, patch) {
      const list = read();
      const it = list.find(x => x.id === id);
      if (!it) return null;
      Object.assign(it, patch);
      if (patch.word) it.key = norm(patch.word);
      write(list);
      return it;
    },
    /* q:关键词;sort: new | old | az */
    query(q, sort) {
      const kw = String(q || '').trim().toLowerCase();
      let list = read();
      if (kw) {
        list = list.filter(x =>
          x.word.toLowerCase().includes(kw) ||
          (x.sentence || '').toLowerCase().includes(kw) ||
          (x.note || '').toLowerCase().includes(kw));
      }
      const s = sort || 'new';
      list = list.slice().sort((a, b) => s === 'old' ? a.createdAt - b.createdAt
        : s === 'az' ? a.word.toLowerCase().localeCompare(b.word.toLowerCase())
          : b.createdAt - a.createdAt);
      return list;
    },
    on(fn) { if (typeof fn === 'function') subs.push(fn); },
    sourceText(src) {
      if (!src || src.type === 'manual') return '手动添加';
      const sec = { cloze: '完形填空', reading: '阅读理解', partb: '阅读 Part B',
        translation: '英译汉', writing: '写作' }[src.section] || '';
      let label = String(src.label || '').replace(/\s*·\s*\d+\s*[–-]\s*\d+\s*$/, '').trim();
      let name = label;
      if (sec && !label.toLowerCase().includes(sec.toLowerCase()) && !/^Part\s*B/i.test(label)) {
        name = label ? sec + ' ' + label : sec;
      }
      if (/^Part\s*B/i.test(label) && sec) name = sec;
      return [src.year ? src.year + ' 年' : '', name, src.qn ? '第 ' + src.qn + ' 题' : '']
        .filter(Boolean).join(' · ');
    },
    sourceHref(src) {
      if (!src || src.type === 'manual' || !src.year) return '';
      return 'index.html?y=' + src.year +
        (src.unitId ? '&u=' + encodeURIComponent(src.unitId) : '') + '&from=vocab';
    }
  };
  global.E2V = api;
})(window);
