'use strict';
/* 管综数学刷书 · 纯前端单页应用(界面沿用 gzbuild-quiz 模板)
   - 已转录的题集(questions.js):一题一卡,公式用 KaTeX 渲染,选完立即判分并显示解析
   - 未转录的单元:左侧原书页面,右侧答题卡,对答案时点出正确选项(答案键会被记住)
   数据来自 data.js(scripts/build.py)与 questions.js(scripts/build_questions.py) */

const BANK = window.BANK;
const QBANK = window.QBANK || {};
/* 题库按科目拆成三份(qb-math/logic/gk.js),解析另放 sol-*.js:首屏只加载当前科目的题,渲染完再在后台加载它的解析 */
const loadedQ = {}, loadedS = {};
let solState = 2;                 // 2 = 已加载的科目解析都就绪;0 = 有科目的解析还没载;1 = 加载中
const solWaiters = [];
function loadScript(src, ok, bad) {
  const sc = document.createElement('script');
  sc.src = src;
  sc.onload = ok;
  sc.onerror = function () { sc.remove(); if (bad) bad(); };
  document.head.append(sc);
}
function loadGroup(g, cb) {
  if (loadedQ[g] || !window.QFILES) { loadedQ[g] = true; cb(); return; }
  loadScript(window.QFILES[g], function () {
    loadedQ[g] = true;
    BANK.books.filter(b => subjectOf(b) === g).forEach(function (b) {      // 题到了,重建这个科目各书的练习单元
      b.units = buildUnits(b);
      b.units.forEach(function (u) { UNITS[u.key] = u; });
    });
    solState = 0;
    cb();
  }, function () { alert('题库加载失败,请检查网络后刷新重试'); });
}
function loadSols(cb) {
  const need = Object.keys(loadedQ).filter(g => !loadedS[g]);
  if (!need.length) { solState = 2; if (cb) cb(); return; }
  if (cb && solWaiters.indexOf(cb) < 0) solWaiters.push(cb);
  if (solState === 1) return;
  solState = 1;
  let left = need.length;
  need.forEach(function (g) {
    loadScript(window.QSOLF[g], function () {
      const all = window.QSOL || {}, oe = window.QOE || {};
      Object.keys(all).forEach(function (sid) {
        if (QBANK[sid]) QBANK[sid].qs.forEach(function (q) { if (all[sid][q.no] != null) q.sol = all[sid][q.no]; });
      });
      Object.keys(oe).forEach(function (sid) {
        if (QBANK[sid]) QBANK[sid].qs.forEach(function (q) { if (oe[sid][q.no]) q.oe = oe[sid][q.no]; });
      });
      loadedS[g] = true;
      if (--left === 0) { solState = Object.keys(loadedQ).every(k => loadedS[k]) ? 2 : 0; solWaiters.splice(0).forEach(f => f()); }
    }, function () { solState = 0; left = -99; });      // 网络不好时,下次用到再试
  });
}
const rerenderQuiz = function () { if (quiz) render(); };
const LETTERS = 'ABCDE';
const COND_OPTS = [
  '条件(1)充分,但条件(2)不充分',
  '条件(2)充分,但条件(1)不充分',
  '条件(1)和(2)单独都不充分,但条件(1)和(2)联合起来充分',
  '条件(1)充分,条件(2)也充分',
  '条件(1)和(2)单独都不充分,条件(1)和(2)联合起来也不充分',
];
const COND_RUBRIC = '条件充分性判断选项含义:A. 条件(1)充分,但条件(2)不充分　B. 条件(2)充分,但条件(1)不充分　C. 条件(1)(2)单独都不充分,但联合起来充分　D. 条件(1)充分,条件(2)也充分　E. 条件(1)(2)单独和联合起来都不充分';
const DEFAULT_COUNT = 10;

const $app = document.getElementById('app');
const KEY_SHEETS = 'gzb.sheets.v1', KEY_WRONG = 'gzb.wrong.v1', KEY_HIST = 'gzb.hist.v1',
      KEY_SESSION = 'gzb.session.v1';

function load(k, d) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }
  catch (e) { return d; }
}
function store(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
// 答题卡:unitKey -> {count, ans:{题号:选项}, key:{题号:正确选项}, pg:{题号:作答时所看页}, ts}
let sheets = load(KEY_SHEETS, {});
// 错题本(纯收录):'unitKey#题号' -> {t:收录后重做错次数, pick:错选, last:收录时间}
let wrongBook = load(KEY_WRONG, {});
let hist = load(KEY_HIST, []);           // 最近成绩
const saveSheets = () => store(KEY_SHEETS, sheets);
const saveWrong = () => store(KEY_WRONG, wrongBook);
const saveHist = () => store(KEY_HIST, hist);

let quiz = null;            // 当前做题会话

/* 外观:跟随系统 / 浅色 / 深色 */
const THEME_LABEL = { auto: '◐ 跟随系统', light: '☀ 浅色', dark: '☾ 深色' };
const THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
let themePref = load('gzb.theme.v1', 'auto');
function setTheme(t) {
  themePref = t;
  store('gzb.theme.v1', t);
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
setTheme(themePref);
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };
function themeToggle(cls) {
  const b = el('button', cls, THEME_ICON[themePref]);
  b.title = '外观:' + THEME_LABEL[themePref].slice(2) + '(点击切换 跟随系统 / 浅色 / 深色)';
  b.onclick = function () { setTheme(THEME_NEXT[themePref]); render(); };
  return b;
}

/* ───────────── 书与练习单元 ─────────────
   页码统一用 PDF 页号(1 起);书本页码 = PDF 页号 - offset - 1 */
// 每本书以目录的哪一级作为一个练习单元
const UNIT_LEVEL = { wbq: 1, kd: 1, jz200: 0, dw1000: 2, lj: 1, lj7: 1 };

const BOOKS = {};
const UNITS = {};
BANK.books.forEach(function (b) {
  BOOKS[b.id] = b;
  b.lastBookPage = b.pages - b.offset - 1;
  b.units = buildUnits(b);
  b.units.forEach(function (u) { UNITS[u.key] = u; });
});

function pdfOf(book, bookPage) { return Math.min(book.pages, Math.max(1, bookPage + book.offset + 1)); }
function pageLabel(book, pdf) {
  const p = pdf - book.offset - 1;
  return p >= 1 ? '第 ' + p + ' 页' : '扉页 ' + pdf;
}
function pageImg(book, pdf) { return 'books/' + book.id + '/pages/' + String(pdf).padStart(4, '0') + '.webp'; }

function buildUnits(book) {
  const toc = book.toc, lv = UNIT_LEVEL[book.id] != null ? UNIT_LEVEL[book.id] : 1;
  const units = [];
  const answerSecs = [];      // 「解析」下的条目,按顺序对应各单元的答案页
  let inAnswers = false;
  toc.forEach(function (e, i) {
    if (e.level === 0) inAnswers = /^解析$/.test(e.title.trim());     // 「解析几何」不是答案部分
    if (inAnswers) { if (e.level > 0) answerSecs.push(e); return; }
    if (/大纲解读/.test(e.title) || (book.id === 'zt' && /逻辑|写作/.test(e.title))) return;     // 真题里的逻辑、写作暂不做练习
    let isUnit = e.level === lv;
    if (e.level < lv) {           // 没有更细分小节的上级条目,自身也算一个单元
      isUnit = true;
      for (let j = i + 1; j < toc.length && toc[j].level > e.level; j++) {
        if (toc[j].level <= lv) { isUnit = false; break; }
      }
    }
    if (!isUnit) return;
    let end = book.lastBookPage;
    for (let j = i + 1; j < toc.length; j++) {
      if (toc[j].level <= e.level) {
        // overlap:下一部分常在同一页中间开始,单元包含该页
        end = Math.max(e.page, toc[j].page - (book.overlap ? 0 : 1));
        break;
      }
    }
    let group = '';
    for (let j = i - 1; j >= 0; j--) {
      if (toc[j].level < e.level) { group = toc[j].title; break; }
    }
    const u = { key: book.id + ':' + i, book: book, title: e.title, group: group || e.title,
                start: pdfOf(book, e.page), end: pdfOf(book, end), ans: null,
                first: e.first || 1, count: e.count || 0 };   // count>0:题号固定(真题)
    // 已逐题转录的题集:真题按年份(zt-2010),参考书按「书 id|单元名」(jz200|单元一 应用题)
    const name = group && group !== e.title ? group + ' · ' + e.title : e.title;
    const qset = QBANK[book.id + '-' + (group.match(/\d{4}/) || [''])[0]] || QBANK[book.id + '|' + name];
    if (qset) {
      u.qs = {};
      qset.qs.forEach(function (q) { u.qs[q.no] = q; });
      u.qnos = qset.qs.map(q => q.no);
      u.verified = !!qset.verified;
    }
    units.push(u);
  });
  if (answerSecs.length === units.length) {
    units.forEach(function (u, k) { u.ans = pdfOf(book, answerSecs[k].page); });
  }
  return units;
}
function unitName(u) {
  return u.group && u.group !== u.title ? u.group + ' · ' + u.title : u.title;
}
// 主页上显示「书 · 分组 · 单元」:分组名已包含在书名里时(如 02 200 大思维定势)就不重复写
function fullName(u) {
  const g = (u.group || '').replace(/^\d+\s+/, '');
  const rest = g && u.book.title.indexOf(g) >= 0 ? u.title : unitName(u);
  return u.book.title + ' · ' + rest;
}
function unitOfPage(book, pdf) {
  let best = null;
  book.units.forEach(function (u) { if (u.start <= pdf && pdf <= u.end) best = u; });
  return best;
}

/* ───────────── 书页图是否跟仓库一起发布 ─────────────
   books/ 体积大,线上可能还没上传。探测一次封面图:取不到就把需要原页的单元收起来,
   只留已逐题转录的部分;以后把 books/ 放回仓库,刷新即自动恢复,不用动代码。 */
const PAGES = { ok: {}, done: false };
function pagesOk(book) { return PAGES.ok[book.id] === true; }
function unitAvailable(u) { return !!u.qs || pagesOk(u.book); }
function visibleBooks() { return BANK.books.filter(function (b) { return b.units.some(unitAvailable); }); }
function probePages() {
  const ids = Object.keys(BOOKS);
  let left = ids.length;
  if (!left) { PAGES.done = true; return; }
  const settle = function (id, ok) {
    if (id in PAGES.ok) return;
    PAGES.ok[id] = ok;
    if (--left === 0) { PAGES.done = true; render(); }    // 探测完重画当前页
  };
  ids.forEach(function (id) {
    const im = new Image();
    im.onload = function () { settle(id, true); };
    im.onerror = function () { settle(id, false); };
    im.src = 'books/' + id + '/thumbs/0001.webp';
  });
}

/* ───────────── 答题卡与判分 ───────────── */
function getSheet(key) {
  const u = UNITS[key];
  const s = sheets[key] || { count: (u && u.count) || DEFAULT_COUNT, ans: {}, key: {}, pg: {} };
  if (u && u.qs) for (const n in u.qs) { if (u.qs[n].ans) s.key[n] = u.qs[n].ans; }    // 已转录且带答案的题
  return s;
}
function unitList(u, s) { return u.qnos ? u.qnos.slice() : range(u.first, u.first + s.count - 1); }
function putSheet(key, s) {
  s.ts = Date.now();
  sheets[key] = s;
  saveSheets();
}
function status(s, n) {
  const a = s.ans[n], k = s.key[n];
  if (!a) return 'un';
  if (!k) return 'ans';
  return a === k ? 'ok' : 'bad';
}
function sheetStats(s, list) {
  const r = { done: 0, ok: 0, bad: 0, pending: 0 };
  (list || Object.keys(s.ans)).forEach(function (n) {
    const st = status(s, n);
    if (st === 'un') return;
    r.done++;
    if (st === 'ok') r.ok++;
    else if (st === 'bad') r.bad++;
    else r.pending++;
  });
  return r;
}
// 首页上的进度:一节里答满 3 题才开始计入(不在界面上提示)
function progStats(s, list) {
  const r = sheetStats(s, list);
  return r.done >= 3 ? r : { done: 0, ok: 0, bad: 0, pending: 0 };
}
function bookStats(book) {
  const r = { done: 0, ok: 0, bad: 0, pending: 0 };
  book.units.forEach(function (u) {
    if (!sheets[u.key]) return;
    const st = progStats(getSheet(u.key));
    for (const k in r) r[k] += st[k];
  });
  return r;
}

/* ───────────── 收录(错题本) ─────────────
   错题本 = 纯收录模式:答错不自动进本,只有手动「☆ 收录」的题才收录;
   收录的题重做时答错,只累计错误次数,不自动移出。 */
const wid = (key, n) => key + '#' + n;
function recordResult(key, n, pick, right) {
  const r = wrongBook[wid(key, n)];
  if (!r) return;
  if (right) r.ok = (r.ok || 0) + 1;      // 复习做对:抽中概率慢慢降低(不会移出)
  else { r.t = (r.t || 0) + 1; r.pick = pick; }
  saveWrong();
}
function toggleStar(key, n) {
  const id = wid(key, n);
  if (wrongBook[id]) removeWrong(id);
  else { wrongBook[id] = { t: 0, last: Date.now(), pick: null }; saveWrong(); }
}
function removeWrong(id) {
  delete wrongBook[id];
  saveWrong();
}
function isStar(key, n) { return !!wrongBook[wid(key, n)]; }
function starLabel(key, n) { return isStar(key, n) ? '★ 已收录' : '☆ 收录'; }

/* 选答案:有答案键时立即判分并锁定 */
function pickAnswer(n, L) {
  const s = getSheet(quiz.unit.key);
  if (s.ans[n] && s.key[n]) return;
  s.ans[n] = L;
  s.pg[n] = quiz.page;
  putSheet(quiz.unit.key, s);
  if (s.key[n]) {
    recordResult(quiz.unit.key, n, L, L === s.key[n]);
    afterJudge();
  }
  render();
}
/* 对答案(未转录的单元):点出正确选项 */
function setKey(n, L, silent) {
  const s = getSheet(quiz.unit.key);
  s.key[n] = L;
  putSheet(quiz.unit.key, s);
  if (s.ans[n]) recordResult(quiz.unit.key, n, s.ans[n], s.ans[n] === L);
  if (!silent) afterJudge();
  updateHist();
  render();
}
function clearKey(n) {
  const s = getSheet(quiz.unit.key);
  delete s.key[n];
  putSheet(quiz.unit.key, s);
  render();
}
function afterJudge() {
  const s = getSheet(quiz.unit.key);
  if (quiz.list.every(n => status(s, n) === 'ok' || status(s, n) === 'bad')) finishQuiz();
}

/* ───────────── 会话 ───────────── */
function saveSession() {
  if (!quiz) return;
  if (quiz.done) { localStorage.removeItem(KEY_SESSION); return; }
  store(KEY_SESSION, { unit: quiz.unit.key, list: quiz.list, idx: quiz.idx,
                       page: quiz.page, redo: quiz.redo, origin: quiz.origin, lvf: quiz.lvf });
}
function loadSession() {
  const s = load(KEY_SESSION, null);
  return s && UNITS[s.unit] ? s : null;
}
function restoreSession() {
  const s = loadSession();
  if (!s) return null;
  quiz = makeQuiz(UNITS[s.unit], s.list, s.redo, s.origin);
  quiz.lvf = s.lvf;
  quiz.idx = Math.min(s.idx || 0, quiz.list.length - 1);
  quiz.page = s.page || quiz.page;
  return quiz;
}
function makeQuiz(unit, list, redo, origin) {
  const s = getSheet(unit.key);
  if (!list) list = unitList(unit, s);
  const firstPg = s.pg[list[0]];
  const q = unit.qs && unit.qs[list[0]];
  return { unit: unit, book: unit.book, list: list, idx: 0,
           page: q && q.page ? pdfOf(unit.book, q.page) : redo && firstPg ? firstPg : unit.start,
           redo: !!redo, showPage: false, done: false, showResult: false, histId: null,
           origin: origin || '#/' };
}
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

/* ───────────── 难度分级 ─────────────
   每题的 lv(1 基础 · 2 中等 · 3 较难 · 4 挑战)由 scripts/difficulty.py 按解题步骤、知识点、题位估计;
   主页可按难度筛选,只影响新开始的练习(断点续做、错题重做不筛) */
const LV_NAME = ['', '基础', '中等', '较难', '挑战'];
const KEY_LVF = 'gzb.lvfilter.v1';
let lvFilter = load(KEY_LVF, []);
const LV_BARS = '<span class="lvbars"><i></i><i></i><i></i><i></i></span>';
function lvBadge(lv, mini) {
  if (!lv) return '';
  return '<span class="lv lv' + lv + (mini ? ' mini' : '') + '" title="难度:' + LV_NAME[lv] + '">' + LV_BARS +
    (mini ? '' : LV_NAME[lv]) + '</span>';
}
function lvCounts(u) {           // [基础, 中等, 较难, 挑战] 各几题
  const c = [0, 0, 0, 0];
  (u.qnos || []).forEach(function (n) { const lv = u.qs[n].lv; if (lv) c[lv - 1]++; });
  return c;
}
function lvAvg(c) {
  const t = c[0] + c[1] + c[2] + c[3];
  return t ? Math.round((c[0] + 2 * c[1] + 3 * c[2] + 4 * c[3]) / t) : 0;
}
function lvTitle(c) {
  return c.map(function (k, i) { return k ? LV_NAME[i + 1] + ' ' + k : ''; }).filter(Boolean).join(' · ');
}
function lvSpectrum(c) {         // 一条按难度分色的细条,宽度即各档占比
  if (!(c[0] + c[1] + c[2] + c[3])) return '';
  return '<span class="lvspec" title="难度分布:' + lvTitle(c) + '">' +
    c.map(function (k, i) { return k ? '<i class="lv' + (i + 1) + '" style="flex:' + k + '"></i>' : ''; }).join('') + '</span>';
}
function lvPick(u, list) {       // 按主页的难度筛选取题
  return list.filter(n => u.qs[n] && lvFilter.indexOf(u.qs[n].lv) >= 0);
}
function lvFilterName() { return lvFilter.map(lv => LV_NAME[lv]).join('、'); }

function startUnit(unitKey, at) {
  const u = UNITS[unitKey], s = getSheet(unitKey);
  const done = Object.keys(s.ans).length;
  const picked = !at && u.qs && lvFilter.length ? lvPick(u, u.qnos) : null;
  if (picked && !picked.length) {
    choose('这一节没有「' + lvFilterName() + '」难度的题', [['做全部 ' + u.qnos.length + ' 题', function () {
      quiz = makeQuiz(u, null, false, '#/');
      location.hash = '#/quiz';
    }, true]]);
    return;
  }
  const go = function (reset) {
    if (reset) { s.ans = {}; s.pg = {}; putSheet(unitKey, s); render(); return; }     // 重置:只清空记录,留在当前页面,不进答题页
    quiz = makeQuiz(u, picked, false, '#/');
    if (picked) quiz.lvf = lvFilter.slice();
    if (at && at.page) quiz.page = at.page;
    if (at && at.no != null) quiz.idx = Math.max(0, quiz.list.indexOf(at.no));
    else if (!reset) {                       // 继续:跳到第一道没做的题
      const k = quiz.list.findIndex(n => !s.ans[n]);
      if (k >= 0) quiz.idx = k;
    }
    location.hash = '#/quiz';
  };
  if (!done || (at && at.keep)) { go(false); return; }
  choose('这一节已做 ' + done + ' 题', [['继续', () => go(false), true], ['重置', () => go(true)]]);
}
/* 简单的选择弹窗:items = [[按钮文字, 回调, 是否主按钮]] */
function choose(title, items) {
  const bg = el('div', 'choose-bg');
  const box = el('div', 'choose');
  box.append(el('div', 'choose-title', esc(title)));
  const row = el('div', 'choose-row');
  items.forEach(function (it) {
    const b = el('button', 'btn' + (it[2] ? '' : ' ghost'), it[0]);
    b.onclick = function () { bg.remove(); it[1](); };
    row.append(b);
  });
  const x = el('button', 'btn ghost', '取消');
  x.onclick = () => bg.remove();
  row.append(x);
  box.append(row);
  bg.append(box);
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  document.body.append(bg);
}
function startRedo(unitKey, nums, origin) {
  const s = getSheet(unitKey);
  nums.forEach(function (n) { delete s.ans[n]; });
  putSheet(unitKey, s);
  quiz = makeQuiz(UNITS[unitKey], nums.slice().sort((a, b) => a - b), true, origin);
  location.hash = '#/quiz';
}
function finishQuiz() {
  stopQTimer();
  localStorage.removeItem(KEY_SESSION);
  quiz.done = true; quiz.showResult = true;
  if (!quiz.redo && sheetStats(getSheet(quiz.unit.key), quiz.list).done >= 3) {
    quiz.histId = Date.now();
    hist.unshift({ id: quiz.histId, d: todayStr(), unit: quiz.unit.key, ok: 0, total: 0 });
    hist = hist.slice(0, 30);
    updateHist();
  }
}
/* 结束后补对答案时,同步更新这次成绩 */
function updateHist() {
  if (!quiz || !quiz.histId) return;
  const r = hist.find(h => h.id === quiz.histId);
  if (!r) return;
  const st = sheetStats(getSheet(quiz.unit.key), quiz.list);
  r.ok = st.ok; r.total = quiz.list.length; r.pending = st.pending;
  saveHist();
}
function confirmFinish() {
  const s = getSheet(quiz.unit.key);
  const un = quiz.list.filter(n => !s.ans[n]).length;
  if (un && !confirm('还有 ' + un + ' 题未作答,确定结束?')) return;
  finishQuiz();
  render();
}
function setCount(c) {
  const s = getSheet(quiz.unit.key);
  s.count = Math.max(1, Math.min(200, c));
  putSheet(quiz.unit.key, s);
  quiz.list = unitList(quiz.unit, s);
  quiz.idx = Math.min(quiz.idx, quiz.list.length - 1);
  render();
}
function goQ(i) {
  quiz.idx = Math.max(0, Math.min(quiz.list.length - 1, i));
  quiz.showResult = false;
  const q = quiz.unit.qs && quiz.unit.qs[quiz.list[quiz.idx]];
  if (q && q.page) quiz.page = pdfOf(quiz.book, q.page);
  render();
}
function goPage(p) {
  quiz.page = Math.max(1, Math.min(quiz.book.pages, p));
  render();
}

/* ───────────── 单题正计时(督促) ───────────── */
let qTimerId = null, qTimerStart = 0, qTimerIdx = -1;
function stopQTimer() {
  if (qTimerId) { clearInterval(qTimerId); qTimerId = null; }
  qTimerIdx = -1;
}
function tickQTimer() {
  const t = document.getElementById('qtimer');
  if (!t) { if (quiz && !quiz.done) return; stopQTimer(); return; }
  const sec = Math.floor((Date.now() - qTimerStart) / 1000);
  t.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  t.classList.toggle('long', sec >= 180);     // 超过 3 分钟只轻微变色,不闪烁
}
function ensureQTimer(idx) {
  if (qTimerIdx === idx && qTimerId) return;
  qTimerIdx = idx;
  qTimerStart = Date.now();
  if (qTimerId) clearInterval(qTimerId);
  qTimerId = setInterval(tickQTimer, 500);
  tickQTimer();
}

/* ───────────── 小工具 ───────────── */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function todayStr() { const d = new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function relDays(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? '今天' : d === 1 ? '昨天' : d + ' 天前';
}
function pct(ok, total) { return total ? Math.round(ok / total * 100) + '%' : '—'; }
/* 渲染节点内的 $...$ 公式(KaTeX 未加载时保留原文) */
function typeset(node) {
  if (window.renderMathInElement) {
    // 分数统一用正常大小(\dfrac),与试卷排版一致、更易读
    window.renderMathInElement(node, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false,
                                       macros: { '\\frac': '\\dfrac' } });
  }
  return node;
}

/* ───────────── 复制:公式转成可读纯文本 ───────────── */
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
              '+': '⁺', '-': '⁻', 'n': 'ⁿ' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
              '+': '₊', '-': '₋', 'n': 'ₙ', 'k': 'ₖ' };
const TEX_SYM = { le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', times: '×', div: '÷', cdot: '·',
  pm: '±', approx: '≈', parallel: '∥', perp: '⊥', triangle: '△', angle: '∠', pi: 'π', infty: '∞',
  in: '∈', cup: '∪', cap: '∩', alpha: 'α', beta: 'β', theta: 'θ', lambda: 'λ', circ: '°', Rightarrow: '⇒',
  quad: ' ', qquad: '  ', ldots: '…', cdots: '⋯', left: '', right: '', lt: '<', gt: '>',
  varnothing: '∅', emptyset: '∅', subset: '⊂', mathbb: '', begin: '', end: '',
  sigma: 'σ', odot: '⊙', overset: '', frown: '⌒', sin: 'sin', cos: 'cos', lg: 'lg', log: 'log', dfrac: '', Delta: 'Δ', sim: '∼', cong: '≅', iff: '⇔', to: '→', mid: '|', sum: 'Σ', limits: '', ln: 'ln', min: 'min', max: 'max' };
// 取出 s[i] 起的一个 {…} 组或单个字符,返回 [内容, 结束位置]
function texGroup(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] === '\\') {                       // 单个命令作参数,如 \frac\pi2
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
    return [m[0], i + m[0].length];
  }
  if (s[i] !== '{') return [s[i] || '', i + 1];
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') d++;
    else if (s[j] === '}' && --d === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}
function wrap(t) { return /^[\w.]+$|^[^\s+\-−×÷/]+$/.test(t) ? t : '(' + t + ')'; }
function scriptText(t, map, mark) {
  return t.split('').every(c => map[c]) ? t.split('').map(c => map[c]).join('') : mark + wrap(t);
}
function texToText(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      const cmd = m[1];
      i += m[0].length;
      if (/^[a-zA-Z]/.test(cmd)) while (s[i] === ' ') i++;     // 命令后的空格不输出
      if (cmd === 'frac' || cmd === 'dfrac') {
        const a = texGroup(s, i), b = texGroup(s, a[1]);
        out += wrap(texToText(a[0])) + '/' + wrap(texToText(b[0]));
        i = b[1];
      } else if (cmd === 'sqrt') {
        const a = texGroup(s, i);
        const t = texToText(a[0]);
        out += '√' + (t.length > 1 ? '(' + t + ')' : t);
        i = a[1];
      } else if (cmd === 'begin' || cmd === 'end') {      // \begin{cases} 等环境名不输出
        i = texGroup(s, i)[1];
        if (cmd === 'begin') out += '{';
        else out += '}';
      } else if (cmd === '\\') {
        out += ', ';
      } else if (cmd === 'bar') {                         // \bar x → x̄
        const a = texGroup(s, i);
        out += texToText(a[0]) + '\u0304';
        i = a[1];
      } else if (cmd === 'text' || cmd === 'mathrm') {
        const a = texGroup(s, i);
        out += a[0];
        i = a[1];
      } else if (cmd === ',' || cmd === ' ' || cmd === ';') {
        out += cmd === ' ' ? ' ' : '';
      } else if (cmd === '{' || cmd === '}' || cmd === '%' || cmd === '$') {
        out += cmd;
      } else if (TEX_SYM[cmd] != null) {
        out += TEX_SYM[cmd];
      } else out += cmd;
    } else if (c === '^' || c === '_') {
      const a = texGroup(s, i + 1);
      out += scriptText(texToText(a[0]), c === '^' ? SUP : SUB, c);
      i = a[1];
    } else if (c === '{' || c === '}' || c === '&') {
      i++;
    } else {
      out += c === '-' ? '−' : c;
      i++;
    }
  }
  return out;
}
/* 题干/选项 → 纯文本:表格转成行,公式转可读文本 */
function richToText(html) {
  const t = html.replace(/<table[^>]*>/g, '\n').replace(/<\/tr>/g, '\n').replace(/<\/td>\s*<td>/g, ' | ').replace(/<[^>]+>/g, '');
  return t.replace(/\$([^$]*)\$/g, (m, tex) => texToText(tex)).replace(/[ \t]+/g, ' ').trim();
}
function questionPlainText(u, n) {
  const q = u.qs[n];
  let t = '【' + unitName(u) + ' · 第 ' + n + ' 题】\n' + richToText(q.stem);
  if (q.kind === 'cond') {
    t += '\n(1) ' + richToText(q.c1) + '\n(2) ' + richToText(q.c2);
    t += '\n(A 条件(1)充分但(2)不充分 / B 条件(2)充分但(1)不充分 / C 联合充分 / D 都充分 / E 都不充分)';
  } else {
    q.opts.forEach(function (o, i) { t += '\n' + LETTERS[i] + '. ' + richToText(o); });
  }
  if (q.fig) t += '\n(原题附有图形,见刷题页面)';
  return t;
}
/* 复制图片:把题目(出处、题干、图形、条件、选项)排成干净的卷面再截图 */
function captureNode(u, n) {
  const q = u.qs[n];
  const box = el('div', 'capture');
  box.append(el('div', 'cap-src', esc(unitName(u)) + ' · 第 ' + n + ' 题'));
  box.append(el('div', 'cap-stem', '<b>' + n + '.</b> ' + q.stem));
  if (q.fig) {
    const img = el('img', 'cap-fig');
    img.src = q.fig;
    box.append(img);
  }
  if (q.kind === 'cond') {
    box.append(el('div', 'cap-cond', '(1) ' + q.c1));
    box.append(el('div', 'cap-cond', '(2) ' + q.c2));
  } else {
    const opts = el('div', 'cap-opts');
    q.opts.forEach(function (o, i) { opts.append(el('span', '', LETTERS[i] + '. ' + o)); });
    box.append(opts);
  }
  return typeset(box);
}
function flash(btn, text, ok) {
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = text;
  btn.classList.toggle('copied', ok !== false);
  setTimeout(function () { btn.textContent = old; btn.classList.remove('copied'); }, 1500);
}
/* html2canvas 只在点「复制图片」时才加载(200KB,平时用不到) */
let h2cLoad = null;
function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  return h2cLoad || (h2cLoad = new Promise(function (ok, bad) {
    const sc = document.createElement('script');
    sc.src = 'vendor/katex/html2canvas.min.js';
    sc.onload = ok;
    sc.onerror = function () { h2cLoad = null; bad(new Error('html2canvas')); };
    document.head.append(sc);
  }));
}
function copyQuestionImage(u, n, btn) {
  const node = captureNode(u, n);
  document.body.append(node);
  const blob = Promise.all([loadH2C(), ...[...node.querySelectorAll('img')].map(i => i.decode().catch(() => {}))])
    .then(() => window.html2canvas(node, { backgroundColor: '#ffffff', scale: 2, logging: false }))
    .then(c => new Promise(r => c.toBlob(r, 'image/png')))
    .finally(() => node.remove());
  const download = () => blob.then(function (b) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = unitName(u) + '-第' + n + '题.png';
    a.click();
    flash(btn, '已存为图片');
  }).catch(() => copyText(questionPlainText(u, n), btn));
  // ClipboardItem 需在点击时同步创建,内容可以是 Promise(Safari 要求如此)
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(() => flash(btn, '已复制 ✓'), download);
  } else download();
}

function copyText(text, btn) {
  const done = function () { flash(btn, '已复制 ✓'); };
  const fallback = function () {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败,请手动选择'); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else fallback();
}

/* ───────────── 渲染分发 ───────────── */
function renderSidebar(hash) {
  const side = document.getElementById('side');
  side.innerHTML = '';
  const wrongN = wrongIds(curSubject()).length;
  const brand = el('div', 'brand');
  brand.append(el('div', 'brand-title', '管综精练'));
  brand.append(el('div', 'brand-sub', BANK.updated + ' 更新'));
  side.append(brand);
  const nav = el('nav', 'snav');
  const ICON = {
    home: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.2 12 4l8 7.2"/><path d="M6 10v9.2h12V10"/><path d="M10 19.2v-5h4v5"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/></svg>'
  };
  [['#/', '主页', ICON.home], ['#/wrong', '错题本', ICON.star]]
    .forEach(function (item) {
      const active = item[0] === '#/' ? hash.indexOf('#/wrong') !== 0 : hash.indexOf(item[0]) === 0;
      const a = el('a', 'sitem' + (active ? ' active' : ''));
      a.href = item[0];
      a.append(el('span', 'sicon', item[2]));
      a.append(el('span', 'slabel', item[1]));
      if (item[0] === '#/wrong' && wrongN) a.append(el('span', 'sbadge', String(wrongN)));
      nav.append(a);
    });
  side.append(nav);
  const nq = Object.keys(QBANK).reduce((n, k) => n + QBANK[k].qs.length, 0);
  const foot = el('div', 'side-foot', '已逐题转录 ' + nq + ' 题<br>记录存在本机浏览器,记得导出备份');
  const tb = el('button', 'themebtn', THEME_LABEL[themePref]);
  tb.title = '切换外观:跟随系统 / 浅色 / 深色';
  tb.onclick = function () { setTheme(THEME_NEXT[themePref]); render(); };
  foot.append(document.createElement('br'), tb);
  side.append(foot);
}

let lastRoute = '', homeEnter = false, homeSubj = '';
// 离开列表页(主页/错题本)时记住滚动位置和展开的分组,返回时恢复
const savedView = {};
function saveView(route) {
  if (route === 'quiz') return;
  savedView[route] = { y: window.scrollY,
    open: [...$app.querySelectorAll('details')].map(d => d.open) };
}
function restoreView(route) {
  const v = savedView[route];
  if (!v) { window.scrollTo(0, 0); return; }
  $app.querySelectorAll('details').forEach(function (d, i) { if (v.open[i] != null) d.open = v.open[i]; });
  window.scrollTo(0, v.y);
}
function render() {
  const hash = location.hash || '#/';
  const route = hash.split('/')[1] || '';
  const entered = route !== lastRoute;
  if (entered) saveView(lastRoute);
  lastRoute = route;
  homeEnter = entered;
  renderSidebar(hash);
  document.body.classList.toggle('focus', hash.indexOf('#/quiz') === 0);   // 做题时隐藏侧栏,专注
  if (hash.indexOf('#/quiz') === 0) {
    if (!quiz && !restoreSession()) { location.hash = '#/'; return; }
    if (quiz && !unitAvailable(quiz.unit)) {      // 书页没上传,断点/收藏的单元打不开,回首页
      quiz = null;
      localStorage.removeItem(KEY_SESSION);
      location.hash = '#/';
      return;
    }
    saveSession();
    renderQuiz();
    if (entered) window.scrollTo(0, 0);
    return;
  }
  if (quiz && !quiz.done) saveSession();     // 主动退出也保留断点
  stopQTimer();
  quiz = null;
  if (hash.indexOf('#/wrong') === 0) renderWrong();
  else renderHome();
  if (entered) restoreView(route);
  if (typeof refreshPicked === 'function') refreshPicked();
}
window.addEventListener('hashchange', render);

/* ───────────── 首页 ───────────── */
const HELP_HTML =
  '<h3>怎么刷</h3>' +
  '<p><b>已转录的题</b>:一题一卡,点选项立即判分,并显示答案与解析;真题答案已与官方答案核对;1000 题的答案取自原书解析,个别拆分的小问由 AI 解出;如发现有误请以原书为准。点 <b>复制图片</b> 可把整题(含图形)截成图片直接粘贴。</p>' +
  '<p><b>未转录的部分</b>:左边看原书页面,右边答题卡选 A–E;选完翻到答案页,点出正确选项即判分。答案键会被记住,重做时自动判分。</p>' +
  '<p><b>难度分级</b>:每题标有 基础 · 中等 · 较难 · 挑战 四档(信号格越满越难),按解题步骤、知识点和真题题位估计,仅供参考。主页顶部可按难度筛选(可多选),只刷想练的档位;每节卡片上的小信号格是这一节的平均难度,书名旁的彩色细条是全书的难度分布;做完一节,成绩页会按难度统计正确率。</p>' +
  '<p><b>错题本是纯收录模式</b>:答错不会自动进本,做题时点 <b>☆ 收录</b> 把值得重做的题收进来;收录的题不会自动移出,可随时手动移出。</p>' +
  '<p><b>选题打印</b>:点主页顶部的「选题打印」进入选题模式(页面出现虚线边框,右下角有个小小的「选题单」浮标);主页点单元勾选题目、做题页点 <b>＋ 选题单</b>(或按 <code>B</code>)。选好后点浮标 → 打印,会先问要不要附答案(可含解析)。选题单记在本机,下次还在。</p>' +
  '<p>快捷键:<code>A</code>–<code>E</code> 作答 · <code>Enter</code> 下一题 · <code>←</code><code>→</code> 换题 · <code>S</code> 收录 · <code>X</code> 复制图片 · <code>G</code> 题号 · <code>Esc</code> 退出</p>' +
  '<h3>数据备份</h3>' +
  '<p>所有记录只保存在本机浏览器,换浏览器或清缓存会丢失,建议定期<b>导出备份</b>。</p>' +
  '<p>部署在 GitHub 时:把导出的备份文件改名为 <code>progress.json</code> 放进网站目录一起上传;浏览器记录被清空后,打开网站会自动从它恢复。</p>';

/* 主页顶部的科目切换:逻辑题库单独一栏,数学是其余各书 */
const KEY_SUBJECT = 'gzb.subject';
const SUBJECTS = [['math', '数学'], ['logic', '逻辑'], ['gk', '公考']];
function subjectOf(book) { return book.id.slice(0, 2) === 'lj' ? 'logic' : book.id === 'gk' ? 'gk' : 'math'; }
function curSubject() { const v = localStorage.getItem(KEY_SUBJECT); return v === 'logic' || v === 'gk' ? v : 'math'; }
const SUBJ_TITLE = { math: '数学 · 冲刺精练', logic: '逻辑 · 真题精练', gk: '公考 · 判断推理' };
const SUBJ_NAME = { math: '数学', logic: '逻辑', gk: '公考' };
function subjectTabs() {
  const bar = el('div', 'subjtabs');
  SUBJECTS.forEach(function (x) {
    const b = el('button', 'subjtab' + (curSubject() === x[0] ? ' on' : ''), x[1]);
    b.onclick = function () {
      if (curSubject() === x[0]) return;
      localStorage.setItem(KEY_SUBJECT, x[0]);
      loadGroup(x[0], function () { render(); window.scrollTo(0, 0); if (window.requestIdleCallback) requestIdleCallback(function () { loadSols(); }, { timeout: 2000 }); else setTimeout(function () { loadSols(); }, 300); });
    };
    bar.append(b);
  });
  return bar;
}

/* 主页的难度筛选:可多选,全不选 = 全部;选中后各单元显示符合的题数,开始练习时只出这些题 */
function lvFilterBar() {
  const bar = el('div', 'lvfilter');
  bar.append(el('span', 'lvf-label', '难度'));
  const set = function (f) {
    lvFilter = f.length === 4 ? [] : f;
    store(KEY_LVF, lvFilter);
    saveView(lastRoute);           // 保留展开的分组和滚动位置
    render();
    restoreView(lastRoute);
  };
  const all = el('button', 'lvf all' + (lvFilter.length ? '' : ' on'), '全部');
  all.onclick = () => set([]);
  bar.append(all);
  [1, 2, 3, 4].forEach(function (lv) {
    const on = lvFilter.indexOf(lv) >= 0;
    const b = el('button', 'lvf lv' + lv + (on ? ' on' : ''), LV_BARS + LV_NAME[lv]);
    b.title = on ? '取消筛选「' + LV_NAME[lv] + '」' : '只练「' + LV_NAME[lv] + '」(可多选)';
    b.onclick = () => set(on ? lvFilter.filter(x => x !== lv) : lvFilter.concat(lv).sort());
    bar.append(b);
  });
  return bar;
}

function renderHome() {
  $app.innerHTML = '';
  const w = el('div', 'wrap');
  const subj = curSubject();

  const head = el('header', 'hero');
  head.append(themeToggle('themefab'));
  head.append(subjectTabs());
  head.append(el('h1', '', SUBJ_TITLE[subj]));
  // 选题打印按钮放进零高度的 sticky 坞,滚动时始终停在最上方
  const dock = el('div', 'pickdock');
  dock.append(entryButton());
  w.append(dock);
  const books = visibleBooks().filter(b => subjectOf(b) === subj);
  w.append(head);

  const sess = loadSession();
  if (sess && UNITS[sess.unit] && unitAvailable(UNITS[sess.unit]) && subjectOf(UNITS[sess.unit].book) === subj) {
    const u = UNITS[sess.unit], s = getSheet(sess.unit);
    const answered = sess.list.filter(n => s.ans[n]).length;
    if (answered >= 3) {
    const rc = el('div', 'card sec resumecard');
    const info = el('div', 'rinfo');
    info.append(el('div', 'rtitle', '⏵ ' + esc(fullName(u))));
    info.append(el('div', 'rmeta', '做到第 ' + sess.list[sess.idx || 0] + ' 题 / 共 ' + sess.list.length +
      ' 题' + (answered ? ' · 已答 ' + answered : '')));
    rc.append(info);
    const cont = el('button', 'btn small', '继续');
    cont.onclick = function () { location.hash = '#/quiz'; };
    const drop = el('button', 'btn ghost small', '放弃');
    drop.onclick = function () { localStorage.removeItem(KEY_SESSION); render(); };
    const acts = el('div', 'setacts');
    acts.append(cont, drop);
    rc.append(acts);
    w.append(rc);
    }
  }

  const grid = el('div', 'homegrid books');
  if (homeEnter || homeSubj !== subj) grid.classList.add('fresh');
  homeSubj = subj;
  const homeUi = load(KEY_HOMEUI, { order: [], collapsed: {} });
  books.slice().sort(function (x, y) {
    const i = homeUi.order.indexOf(x.id), j = homeUi.order.indexOf(y.id);
    return (x.id === 'lj7' ? 100 : i < 0 ? 99 : i) - (y.id === 'lj7' ? 100 : j < 0 ? 99 : j);     // 开胃小菜固定排最后
  }).forEach(function (book) {
    const c = bookCard(book);
    if (c) { decorateBookCard(c, book, homeUi); c.style.setProperty('--i', grid.children.length); grid.append(c); }
  });
  w.append(grid);

  if (hist.length) {
    const hc = el('section', 'card sec');
    hc.append(el('h2', 'sec-title', '最近成绩'));
    hist.slice(0, 8).forEach(function (r) {
      const u = UNITS[r.unit];
      if (!u || !unitAvailable(u) || subjectOf(u.book) !== subj) return;
      const row = el('div', 'setrow');
      row.append(el('div', 'setname small', esc(fullName(u))));
      row.append(el('div', 'setmeta', r.d));
      row.append(el('div', 'setbest', r.ok + '/' + r.total +
        (r.pending ? '<span class="setmeta"> · 待对答案 ' + r.pending + '</span>' : '')));
      hc.append(row);
    });
    w.append(hc);
  }

  const hd = el('details', 'helpcard');
  hd.append(el('summary', '', '<b>使用说明 / 数据备份</b>'));
  const body = el('div', 'helpbody', HELP_HTML);
  const acts = el('div', 'setacts');
  acts.style.marginLeft = '0';
  const ex = el('button', 'btn small', '导出备份');
  ex.onclick = exportBackup;
  const im = el('button', 'btn ghost small', '导入备份');
  im.onclick = importBackup;
  const clr = el('button', 'btn ghost small', '清空全部记录');
  clr.onclick = function () {
    if (confirm('清空全部本地记录(答题卡、答案键、错题本、成绩)?此操作不可恢复,建议先导出备份。')) {
      sheets = {}; wrongBook = {}; hist = [];
      saveSheets(); saveWrong(); saveHist();
      localStorage.removeItem(KEY_SESSION);
      render();
    }
  };
  acts.append(ex, im, clr);
  body.append(acts);
  hd.append(body);
  w.append(hd);

  $app.append(w);
}

function bookCard(book) {
  const units = book.units.filter(unitAvailable);      // 书页没上传时跳过只能看原页的单元
  if (!units.length) return null;
  const sec = el('section', 'card sec hsec');
  const head = el('div', 'bookhead');
  if (pagesOk(book)) {
    const cover = el('img', 'bookcover');
    cover.src = 'books/' + book.id + '/thumbs/0001.webp';
    cover.alt = '';
    head.append(cover);
  }
  const info = el('div', 'bookinfo');
  info.append(el('h2', 'sec-title', esc(book.title)));
  const st = bookStats(book);
  const bc = [0, 0, 0, 0];
  units.forEach(function (u) { if (u.qs) lvCounts(u).forEach(function (k, i) { bc[i] += k; }); });
  info.append(el('div', 'bookstat', esc(book.author) + (book.pages ? ' · ' + book.pages + ' 页' : '') +
    (st.done ? ' · 已做 <b>' + st.done + '</b> 题' : '')));
  head.append(info);
  head.append(el('span', 'bookcount', units.length + (book.id === 'zt' ? ' 套' : ' 节')));
  sec.style.setProperty('--book', book.color);
  sec.append(head);

  let groups = [];
  units.forEach(function (u) {
    let g = groups.find(x => x.name === u.group);
    if (!g) groups.push(g = { name: u.group, units: [] });
    g.units.push(u);
  });
  // 每组只有一个单元(如真题按年份)时,排成紧凑的年份格子
  if (groups.every(g => g.units.length === 1)) {
    const yg = el('div', 'yeargrid' + (groups.every(g => /\d{4}/.test(g.units[0].group)) ? '' : ' titled'));
    groups.forEach(function (g) { yg.append(yearCell(g.units[0])); });
    sec.append(yg);
    return sec;
  }
  // 每组只有两三个单元(如 1000 题的专项):专项排成两列小卡片,单元直接放卡片里
  const small = groups.filter(g => g.units.length <= 3);
  if (small.length >= 4) {
    const gg = el('div', 'groupgrid');
    small.forEach(function (g) {
      const c = el('div', 'gcard');
      c.append(el('div', 'g-name', esc(g.name)));
      const row = el('div', 'g-units');
      g.units.forEach(function (u) { row.append(unitCell(u, u.title)); });
      c.append(row);
      gg.append(c);
    });
    sec.append(gg);
    groups = groups.filter(g => g.units.length > 3);     // 单元多的组仍用折叠列表
  }
  // 整本书只有一个分组(如 200 思维定势):不再套一层同名折叠,格子直接铺开
  if (groups.length === 1 && !small.length) {
    const ug = el('div', 'unitgrid');
    groups[0].units.forEach(function (u) { ug.append(unitCell(u, u.title)); });
    sec.append(ug);
    return sec;
  }
  groups.forEach(function (g) {
    const used = g.units.reduce((n, u) => n + (sheets[u.key] ? progStats(sheets[u.key]).done : 0), 0);
    const box = el('details', 'foldgroup');
    box.append(el('summary', '', '<b>' + esc(g.name) + '</b><span class="catcnt">' + g.units.length + ' 节' +
      (used ? ' · 已做 ' + used + ' 题' : '') + ' ▾</span>'));
    if (used) box.open = true;
    // 组内单元排成紧凑格子,整块可点
    const ug = el('div', 'unitgrid');
    g.units.forEach(function (u) {
      ug.append(unitCell(u, g.units.length === 1 && u.title === g.name ? '整部分练习' : u.title));
    });
    box.append(ug);
    sec.append(box);
  });
  return sec;
}

function yearCell(u) {
  const s = sheets[u.key] && getSheet(u.key);
  const total = s ? unitList(u, s).length : (u.qnos ? u.qnos.length : u.count);
  const st = s ? progStats(s) : { done: 0, ok: 0, bad: 0 };
  const lc = u.qs && lvCounts(u), want = lc && lvFilter.length ? lvPick(u, u.qnos).length : -1;
  const b = el('button', 'ycell' + (st.done ? ' started' : '') + (u.qs ? '' : ' raw') + (want === 0 ? ' lvnone' : ''));
  b.title = unitName(u) + (u.qs ? '' : '(原卷页面作答)') + (lc ? '\n难度:' + lvTitle(lc) : '');
  b.dataset.u = u.key;
  b.append(el('span', 'y-year', (u.group.match(/\d{4}/) || [u.title])[0]));
  b.append(el('span', 'y-meta', (lc ? lvBadge(lvAvg(lc), true) : '') +
    (want >= 0 ? want + '/' + total + ' 题' : st.done ? st.ok + '/' + total : total + ' 题')));
  b.append(el('span', 'y-bar', '<i style="width:' + Math.round(st.done / total * 100) + '%"></i>'));
  b.onclick = () => unitClick(u);
  return b;
}

function unitCell(u, label) {
  const s = sheets[u.key] && getSheet(u.key);
  const total = u.qnos ? u.qnos.length : (u.count || (s && s.count) || 0);
  const st = s ? progStats(s) : { done: 0, ok: 0 };
  const lc = u.qs && lvCounts(u), want = lc && lvFilter.length ? lvPick(u, u.qnos).length : -1;
  const b = el('button', 'ucell' + (st.done ? ' started' : '') + (want === 0 ? ' lvnone' : ''));
  b.title = unitName(u) + (lc ? '\n难度:' + lvTitle(lc) : '');
  b.dataset.u = u.key;
  b.append(el('span', 'u-name', esc(label.replace(/^第.节\s*/, ''))));
  b.append(el('span', 'u-meta', (lc ? lvBadge(lvAvg(lc), true) : '') +
    (st.done ? '已做 ' + st.done + (total ? '/' + total : '') : (total ? total + ' 题' : '原页')) +
    (want >= 0 ? ' · 选中 ' + want : '')));
  if (total) b.append(el('span', 'y-bar', '<i style="width:' + Math.min(100, Math.round(st.done / total * 100)) + '%"></i>'));
  b.onclick = () => unitClick(u);
  return b;
}

function unitRow(u, label) {
  const row = el('div', 'setrow unit');
  const s = sheets[u.key] && getSheet(u.key);
  const left = el('div', '');
  left.append(el('div', 'setname', esc(label)));
  let meta = u.qs ? u.qnos.length + ' 题'
    : (u.count ? '第 ' + u.first + '–' + (u.first + u.count - 1) + ' 题 · ' : '') + pageLabel(u.book, u.start) +
      (u.end > u.start ? ' – ' + (u.end - u.book.offset - 1) : '');
  if (s) {
    const st = progStats(s);
    if (st.done) meta += ' · 已做 ' + st.done + '/' + unitList(u, s).length +
      (st.ok ? ' · <span class="okc">✓' + st.ok + '</span>' : '') +
      (st.bad ? ' · <span class="badc">✗' + st.bad + '</span>' : '');
  }
  left.append(el('div', 'unitmeta', meta));
  row.append(left);
  const acts = el('div', 'setacts');
  const p = el('button', 'btn small', '做题');
  p.onclick = () => unitClick(u);
  acts.append(p);
  row.append(acts);
  return row;
}

function exportBackup() {
  const data = { app: 'gzb', exported: new Date().toISOString(), sheets: sheets, wrong: wrongBook, hist: hist };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '管综精练备份-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importBackup() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = function () {
    const f = inp.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      const d = JSON.parse(txt);
      if (d.app !== 'gzb' || !d.sheets) throw new Error('bad');
      if (!confirm('导入会覆盖当前的全部记录,确定?')) return;
      sheets = d.sheets; wrongBook = d.wrong || {}; hist = d.hist || [];
      saveSheets(); saveWrong(); saveHist();
      render();
    }).catch(function () { alert('导入失败:文件不是本站导出的备份'); });
  };
  inp.click();
}

/* ───────────── 搜索(首页小搜索框) ───────────── */
let searchQ = '';
let searchHist = load('gzb.searchhist.v1', []);   // 最近搜索,最多 8 条
function rememberSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  searchHist = [q].concat(searchHist.filter(x => x !== q)).slice(0, 8);
  store('gzb.searchhist.v1', searchHist);
}
function historyChips(inp, res) {
  const box = el('div', 'searchhist');
  if (!searchHist.length) return box;
  box.append(el('span', 'sh-label', '最近搜索'));
  searchHist.forEach(function (q) {
    const c = el('button', 'sh-chip', esc(q));
    c.onclick = function () { inp.value = q; searchQ = q; rememberSearch(q); runSearch(q, res); };
    box.append(c);
  });
  const clr = el('button', 'sh-clear', '清除');
  clr.onclick = function () { searchHist = []; store('gzb.searchhist.v1', searchHist); box.innerHTML = ''; };
  box.append(clr);
  return box;
}
function searchBar() {
  const box = el('div', 'minisearch');
  const inp = el('input');
  inp.type = 'search';
  inp.placeholder = '🔍 搜题目关键词,如:圆心、等差、柯西';
  inp.value = searchQ;
  const res = el('div', 'minisearch-res');
  let timer = null;
  inp.oninput = function () {
    clearTimeout(timer);
    timer = setTimeout(function () { searchQ = inp.value.trim(); runSearch(searchQ, res); }, 250);
  };
  inp.onkeydown = function (ev) {
    ev.stopPropagation();
    if (ev.key === 'Enter') rememberSearch(inp.value);
  };
  box.append(inp, res);
  if (searchQ) runSearch(searchQ, res);
  else res.append(historyChips(inp, res));
  return box;
}
function loadSearchText(cb) {
  const need = BANK.books.filter(b => b.searchable && !(window.SEARCH_TEXT && window.SEARCH_TEXT[b.id]));
  if (!need.length) { cb(); return; }
  let left = need.length;
  need.forEach(function (b) {
    const sc = document.createElement('script');
    sc.src = 'text-' + b.id + '.js';
    sc.onload = sc.onerror = function () { if (--left === 0) cb(); };
    document.body.append(sc);
  });
}
function runSearch(q, res) {
  res.innerHTML = '';
  if (!q) {
    const inp = res.parentNode && res.parentNode.querySelector('input');
    if (inp) res.append(historyChips(inp, res));
    return;
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const hits = [];
  function snip(t) {
    const at = Math.max(0, t.indexOf(terms[0]));
    let s = esc(t.slice(Math.max(0, at - 24), at + 56).replace(/\n/g, ' '));
    terms.forEach(function (x) { s = s.split(esc(x)).join('<mark>' + esc(x) + '</mark>'); });
    return '…' + s + '…';
  }
  // 1) 已转录的题目
  Object.values(UNITS).forEach(function (u) {
    if (!u.qs) return;
    u.qnos.forEach(function (n) {
      const t = questionPlainText(u, n);
      if (terms.every(x => t.indexOf(x) >= 0)) {
        hits.push({ title: unitName(u) + ' · 第 ' + n + ' 题', snip: snip(t.split('\n').slice(1).join(' ')),
                    go: () => startUnit(u.key, { no: n, keep: true }) });
      }
    });
  });
  // 2) 有文字层的书页(未转录部分)
  loadSearchText(function () {
    BANK.books.forEach(function (book) {
      const texts = book.searchable && window.SEARCH_TEXT && window.SEARCH_TEXT[book.id];
      if (!texts) return;
      texts.forEach(function (t, i) {
        const pdf = i + 1, u = unitOfPage(book, pdf);
        if (!u || u.qs || !unitAvailable(u) || !terms.every(x => t.indexOf(x) >= 0)) return;
        hits.push({ title: book.title + ' · ' + pageLabel(book, pdf) + ' · ' + unitName(u), snip: snip(t),
                    go: () => startUnit(u.key, { page: pdf, keep: true }) });
      });
    });
    res.innerHTML = '';
    if (!hits.length) { res.append(el('div', 'setmeta', '没有找到「' + esc(q) + '」')); return; }
    res.append(el('div', 'setmeta', '找到 ' + hits.length + ' 处' + (hits.length > 30 ? ',显示前 30 处' : '')));
    hits.slice(0, 30).forEach(function (h) {
      const d = el('div', 'hit');
      d.append(el('div', 'hit-title', esc(h.title)));
      d.append(el('div', 'hit-snip', h.snip));
      d.onclick = function () { rememberSearch(q); h.go(); };
      res.append(d);
    });
  });
}

/* ───────────── 原书页面查看器 ───────────── */
function viewer(book, pdf, onGo, extra) {
  const card = el('div', 'card viewer');
  const ctl = el('div', 'pagectl');
  const prev = el('button', 'btn ghost small', '‹ 上页');
  prev.disabled = pdf <= 1;
  prev.onclick = () => onGo(pdf - 1);
  const next = el('button', 'btn ghost small', '下页 ›');
  next.disabled = pdf >= book.pages;
  next.onclick = () => onGo(pdf + 1);
  ctl.append(prev, el('span', 'pgno', '<b>' + pageLabel(book, pdf) + '</b>'), next);
  ctl.append(el('span', 'grow'));
  const zoom = el('button', 'btn ghost small', '放大');
  ctl.append(zoom);
  card.append(ctl);
  if (extra) card.append(extra);
  const wrap = el('div', 'pagewrap');
  const img = el('img', 'pageimg');
  img.src = pageImg(book, pdf);
  img.alt = book.title + ' ' + pageLabel(book, pdf);
  wrap.append(img);
  zoom.onclick = function () {
    wrap.classList.toggle('zoom');
    zoom.textContent = wrap.classList.contains('zoom') ? '缩小' : '放大';
  };
  card.append(wrap);
  if (pdf < book.pages) { const pre = new Image(); pre.src = pageImg(book, pdf + 1); }
  return card;
}

/* ───────────── 做题页 ───────────── */
function quizTopbar() {
  const u = quiz.unit;
  const bar = el('div', 'topbar focusbar');
  const back = el('button', 'iconbtn', '←');
  back.title = '退出(Esc),进度会保留';
  back.onclick = exitQuiz;
  bar.append(back);
  const t = el('div', 'topbar-title');
  t.append(el('span', 'fb-title', esc(unitName(u)) + (quiz.redo ? ' · 重做' : '') +
    (quiz.lvf ? ' · 只做' + quiz.lvf.map(lv => LV_NAME[lv]).join('、') : '')));
  if (!(quiz.done && quiz.showResult)) {
    // 进度条即拉条:拖动可快速跳题,底色显示已答比例
    const s = getSheet(u.key), st = sheetStats(s, quiz.list);
    const prog = el('div', 'fb-prog');
    const range = el('input', 'fb-range');
    range.type = 'range';
    range.min = 0;
    range.max = Math.max(0, quiz.list.length - 1);
    range.value = quiz.idx;
    range.title = '鼠标移到这里就能滑动换题';
    // 进度条分段:每题一小段,答对绿、答错红、已答未判灰蓝、没答留底色
    const segs = el('div', 'fb-segs' + (quiz.list.length > 60 ? ' tight' : ''));
    quiz.list.forEach(function (n) {
      const k = status(s, n);
      segs.append(el('i', k === 'ok' || k === 'bad' || k === 'ans' ? k : ''));
    });
    const rwrap = el('div', 'fb-rwrap');
    rwrap.append(segs, range);
    const count = el('span', 'fb-count', (quiz.idx + 1) + ' / ' + quiz.list.length);
    range.oninput = function () { count.textContent = '第 ' + quiz.list[+range.value] + ' 题'; };
    range.onchange = function () { goQ(+range.value); };
    range.onkeydown = function (ev) { ev.stopPropagation(); };
    // 鼠标悬停就能滑:不用按住,指到进度条附近,题号随鼠标位置走,停住片刻自动翻到那一题
    let hoverTimer = null;
    prog.onmousemove = function (ev) {
      const r = range.getBoundingClientRect();
      if (ev.clientX < r.left - 10 || ev.clientX > r.right + 10) return;
      const max = +range.max;
      if (!max) return;
      const idx = Math.max(0, Math.min(max, Math.round((ev.clientX - r.left) / r.width * max)));
      range.value = idx;
      count.textContent = '第 ' + quiz.list[idx] + ' 题';
      clearTimeout(hoverTimer);
      if (idx !== quiz.idx) hoverTimer = setTimeout(function () { goQ(idx); }, 160);
    };
    prog.onmouseleave = function () { clearTimeout(hoverTimer); };
    prog.append(rwrap, count);
    t.append(prog);
  }
  bar.append(t);
  const right = el('div', 'topbar-right');
  right.append(themeToggle('quietbtn themeq'));
  if (!(quiz.done && quiz.showResult)) {
    const nb = el('button', 'quietbtn' + (quiz.showNav ? ' on' : ''), '题号');
    nb.title = '展开/收起题号(G)';
    nb.onclick = function () { quiz.showNav = !quiz.showNav; render(); };
    right.append(nb);
  }
  bar.append(right);
  return bar;
}
function exitQuiz() { const org = quiz.origin || '#/'; quiz = null; location.hash = org; }

function renderQuiz() {
  $app.innerHTML = '';
  const u = quiz.unit, s = getSheet(u.key);
  const w = el('div', u.qs ? 'wrap' : 'wrap wide');
  w.append(quizTopbar());

  if (quiz.done && quiz.showResult) {
    w.append(resultView());
    $app.append(w);
    return;
  }
  if (u.qs) {
    if (quiz.showNav) w.append(navGrid(s));
    w.append(questionCard(s));
    $app.append(w);
    return;
  }

  // 未转录:原书页面 + 答题卡
  const chips = el('div', 'unitpages');
  for (let p = u.start; p <= u.end; p++) {
    const c = el('button', 'pchip' + (p === quiz.page ? ' cur' : ''), String(p - u.book.offset - 1));
    c.onclick = (function (pp) { return function () { goPage(pp); }; })(p);
    chips.append(c);
  }
  if (u.ans) {
    const c = el('button', 'pchip ans' + (quiz.page === u.ans ? ' cur' : ''), '答案页');
    c.onclick = () => goPage(u.ans);
    chips.append(c);
  }
  const grid = el('div', 'quizgrid');
  grid.append(viewer(u.book, quiz.page, goPage, chips));
  const col = el('div', 'sheetcol');
  col.append(sheetCard(s));
  grid.append(col);
  w.append(grid);
  $app.append(w);
}

function navCls(s, n, i) {
  let c = i === quiz.idx ? ' cur' : '';
  const st = status(s, n);
  if (st === 'ok' || st === 'bad' || st === 'ans') c += ' ' + st;
  if (isStar(quiz.unit.key, n)) c += ' star';
  const q = quiz.unit.qs && quiz.unit.qs[n];
  if (q && q.lv) c += ' lv' + q.lv;            // 题号下方的小圆点标出难度
  return c;
}
function navGrid(s) {
  const nav = el('div', 'navgrid');
  quiz.list.forEach(function (n, i) {
    const b = el('button', 'nv' + navCls(s, n, i), String(n));
    b.onclick = () => goQ(i);
    nav.append(b);
  });
  return nav;
}


/* 看解析时对照题目:题干滚出屏幕后,右上角冒出「对照题目」,点开是一块只读的题目小浮层 */
function attachRecall(cardEl, stemEl) {
  const box = el('div', 'recall');
  const chip = el('button', 'recall-chip', '对照题目');
  const pop = el('div', 'recall-pop');
  const body = el('div', 'recall-body');
  [...cardEl.children].forEach(function (c) {
    if (/\b(qstem|qfig|cond|optgrid)\b/.test(c.className)) {
      const k = c.cloneNode(true);
      k.querySelectorAll('button').forEach(b => { b.disabled = true; b.onclick = null; });
      body.append(k);
    }
  });
  pop.append(body);
  chip.onclick = function () { box.classList.toggle('open'); };
  box.append(chip, pop);
  cardEl.append(box);
  if (!('IntersectionObserver' in window)) { box.classList.add('show'); return; }
  const io = new IntersectionObserver(function (es) {
    const seen = es[0].isIntersecting;
    box.classList.toggle('show', !seen);
    if (seen) box.classList.remove('open');
  }, { rootMargin: '-56px 0px 0px 0px' });
  io.observe(stemEl);
}

/* ───────────── 主页大类:可折叠、可拖动排序(记在本机) ───────────── */
const KEY_HOMEUI = 'gzb.homeui.v1';
function decorateBookCard(sec, book, ui) {
  sec.dataset.book = book.id;
  const head = sec.querySelector('.bookhead');
  if (!head) return;
  // 头部以外的内容收进 .bookbody,折叠时整块隐藏
  const body = el('div', 'bookbody'), inner = el('div', 'bk-inner');
  [...sec.children].forEach(function (c) { if (c !== head) inner.append(c); });
  body.append(inner);
  sec.append(body);
  const fold = function (on) {
    sec.classList.toggle('folded', on);
    ui.collapsed[book.id] = on || undefined;
    if (!on) { if (book.id === 'lj7') ui.collapsed[book.id] = false; else delete ui.collapsed[book.id]; }
    store(KEY_HOMEUI, ui);
  };
  if (ui.collapsed[book.id] || (book.id === 'lj7' && ui.collapsed[book.id] === undefined)) sec.classList.add('folded');   // 开胃小菜默认收起
  const chev = el('button', 'bk-chev', '▾');
  chev.title = '折叠 / 展开';
  chev.onclick = function (ev) { ev.stopPropagation(); fold(!sec.classList.contains('folded')); };
  const handle = el('button', 'bk-handle2', '⠿');
  handle.title = '按住上下拖动,调整顺序';
  head.prepend(handle);
  head.append(chev);
  head.style.cursor = 'pointer';
  head.onclick = function (ev) { if (!ev.target.closest('button')) fold(!sec.classList.contains('folded')); };
  // 拖动排序:鼠标和触屏都用指针事件
  handle.onpointerdown = function (ev) {
    ev.preventDefault();
    const grid = sec.parentElement;
    document.body.classList.add('bk-dragging');
    sec.classList.add('dragging');
    let raf = null;
    const move = function (e) {
      const cards = [...grid.children].filter(c => c !== sec);
      let placed = false;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { grid.insertBefore(sec, c); placed = true; break; }
      }
      if (!placed) grid.append(sec);
      // 靠近窗口上下边时自动滚动
      cancelAnimationFrame(raf);
      const step = e.clientY < 70 ? -14 : e.clientY > innerHeight - 70 ? 14 : 0;
      if (step) { const loop = function () { window.scrollBy(0, step); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
    };
    const up = function () {
      cancelAnimationFrame(raf);
      sec.classList.remove('dragging');
      document.body.classList.remove('bk-dragging');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      ui.order = [...grid.children].map(c => c.dataset.book).filter(Boolean);
      store(KEY_HOMEUI, ui);
    };
    // 拖动时卡片会在 DOM 里换位置,指针捕获会丢,所以监听挂在 document 上
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };
}

function paintStem(stem, n, q) {
  stem.innerHTML = '<span class="qno">' + n + '.</span> ' + q.stem;
}
/* 一题一卡(已转录的题) */
function questionCard(s) {
  const u = quiz.unit, n = quiz.list[quiz.idx], q = u.qs[n];
  const cardEl = el('div', 'card qcard');
  const meta = el('div', 'qmeta');
  meta.append(el('span', '', (q.kind === 'cond' ? '条件充分性判断' : u.book.id.slice(0, 2) === 'lj' ? '逻辑推理' : u.book.id === 'gk' ? '判断推理' : '问题求解') + (q.tag ? ' · ' + esc(q.tag) : '') +
    lvBadge(q.lv)));
  const tools = el('span', 'qtools');
  const imgBtn = el('button', 'tool', '复制图片');
  imgBtn.title = '把整道题(含图形)截成图片复制,可直接粘贴(X)';
  imgBtn.onclick = function () { copyQuestionImage(u, n, imgBtn); };
  const starBtn = el('button', 'tool star' + (isStar(u.key, n) ? ' on' : ''), isStar(u.key, n) ? '★ 已收录' : '☆ 收录');
  starBtn.title = '收录到错题本 / 移出(S)';
  starBtn.onclick = function () { toggleStar(u.key, n); render(); };
  const bkBtn = el('button', 'tool bk-add' + (inBasket(u.key, n) ? ' on' : ''), inBasket(u.key, n) ? '✓ 在选题单' : '＋ 选题单');
  bkBtn.title = '加入 / 移出打印选题单(B)';
  bkBtn.onclick = function () { toggleBasket(u.key, n); render(); };
  tools.append(imgBtn);
  if (picking) tools.append(bkBtn);
  tools.append(starBtn);
  meta.append(tools);
  cardEl.append(meta);

  const stem = el('div', 'qstem');
  paintStem(stem, n, q);
  cardEl.append(stem);
  if (q.fig) {
    const img = el('img', 'qfig');
    img.src = q.fig;
    img.alt = '原题图示';
    cardEl.append(img);
  }

  const chosen = s.ans[n];
  const key = q.ans || s.key[n];          // 题目自带答案,或用户对照原书点出的答案
  const reveal = !!chosen && !!key;
  if (reveal && q.oe && q.oe.Q) {            // 答题后:题干下方一段「人话」概括
    const sn = el('div', 'stemnote', '<b>这题在说:</b>' + esc(q.oe.Q));
    cardEl.insertBefore(sn, stem.nextSibling);
  }
  const grid = el('div', 'optgrid');
  function optButton(L, txt) {
    const b = el('button', 'opt');
    b.innerHTML = '<span class="ol">' + L + '</span><span class="ot">' + txt + '</span>';
    const isChosen = chosen === L, isAns = key === L;
    if (reveal) {
      if (isAns) b.classList.add('ok');
      if (isChosen && !isAns) b.classList.add('bad');
      if (isChosen) b.classList.add('chosen');
      b.disabled = true;
    } else {
      if (isChosen) b.classList.add('chosen');
      b.onclick = () => pickAnswer(n, L);
    }
    return b;
  }
  if (q.kind === 'cond') {
    cardEl.append(el('div', 'cond', '(1) ' + q.c1));
    cardEl.append(el('div', 'cond', '(2) ' + q.c2));
    COND_OPTS.forEach(function (txt, li) { grid.append(optButton(LETTERS[li], txt)); });
  } else {
    q.opts.forEach(function (o, li) {
      if (o === '(无此选项)') return;      // 4 选项题的占位 E 不显示
      const L = LETTERS[li], note = reveal && q.oe && q.oe[L];
      if (!note) { grid.append(optButton(L, o)); return; }
      const w = el('div', 'optwrap' + (key === L ? ' ok' : ''));       // 答题后:每个选项下方一行小字「人话」解读
      w.append(optButton(L, o), el('div', 'optnote' + (note.length > 34 ? ' long' : ''), esc(note)));
      grid.append(w);
    });
  }
  cardEl.append(grid);

  if (chosen && !key) {
    // 题目没有内置答案:对照原书答案页点出正确选项,之后自动判分
    const kr = el('div', 'keyrow');
    kr.append(el('div', 'klabel', '这题还没有内置答案:对照原书点出<b>正确选项</b>'));
    const kl = el('div', 'letters');
    LETTERS.split('').forEach(function (L) {
      const b = el('button', 'lbtn', L);
      b.onclick = () => setKey(n, L);
      kl.append(b);
    });
    kr.append(kl);
    cardEl.append(kr);
  }
  if (reveal) {
    const p = el('div', 'panel');
    let html = '<div class="ansline">答案 <b class="ansletter">' + key + '</b>';
    if (q.kind === 'cond') html += '<span class="ansmeaning">' + COND_OPTS[LETTERS.indexOf(key)] + '</span>';
    html += chosen === key ? '<span class="yourok">✓ 答对</span>' : '<span class="yourbad">你的答案:' + chosen + '</span>';
    html += '</div>';
    if (q.sol) html += '<div class="solmain">' + q.sol + '</div>';
    else if (solState !== 2) { html += '<div class="solmain solwait">解析加载中…</div>'; loadSols(rerenderQuiz); }
    else if (q.solimg) html += '<img class="solimg" loading="lazy" alt="原书解析" src="' + q.solimg + '">';   // 还没重写成文字的题,先显示原书解析截图
    if (!q.ans) {
      html += '<div class="ainote">答案由你对照原书填写 · <button class="fixkey" id="fixkey">填错了?</button></div>';
    } else if (q.asrc) {
      html += '<div class="ainote">' + (q.asrc === 'book' ? '答案取自原书解析' : '答案由 AI 解出(原书没有对应选项),待核对') + '</div>';
    } else if (q.sol || !u.verified) {
      html += '<div class="ainote">' + (u.verified ? '解析由 AI 撰写,答案已与题库核对' : '答案与解析由 AI 解出,待核对') + '</div>';
    }
    p.innerHTML = html;
    cardEl.append(p);
    const fk = p.querySelector('#fixkey');
    if (fk) fk.onclick = () => clearKey(n);
  }
  typeset(cardEl);
  if (reveal) attachRecall(cardEl, stem);

  const w = el('div', 'wrap');
  w.append(cardEl);
  if (quiz.showPage && pagesOk(quiz.book)) w.append(viewer(quiz.book, quiz.page, goPage));

  const f = el('div', 'qfooter');
  const prev = el('button', 'btn ghost', '← 上一题');
  prev.disabled = quiz.idx === 0;
  prev.onclick = () => goQ(quiz.idx - 1);
  f.append(prev);
  f.append(el('span', 'fcount', reveal ? '<kbd>Enter</kbd> 下一题' : '<kbd>A</kbd>–<kbd>E</kbd> 作答'));
  const last = quiz.idx === quiz.list.length - 1;
  const nx = el('button', 'btn' + (reveal ? '' : ' ghost'), quiz.done ? '返回成绩' : last ? '完成' : '下一题 →');
  nx.onclick = nextOrFinish;
  f.append(nx);
  w.append(f);
  return w;
}
function nextOrFinish() {
  if (quiz.done) { quiz.showResult = true; render(); }
  else if (quiz.idx === quiz.list.length - 1) confirmFinish();
  else goQ(quiz.idx + 1);
}

/* 答题卡(未转录:看原书页面作答) */
function sheetCard(s) {
  const card = el('div', 'card sheet');
  const st = sheetStats(s, quiz.list);
  card.append(el('h2', 'sec-title', '答题卡<span class="catcnt">已答 ' + st.done + '/' + quiz.list.length +
    ' · ✓' + st.ok + ' ✗' + st.bad + '</span>'));

  if (!quiz.redo && !quiz.done && !quiz.unit.count) {
    const cc = el('div', 'cntctl');
    cc.append(el('span', '', '本节题数'));
    [['−5', -5], ['−1', -1], ['+1', 1], ['+5', 5]].forEach(function (x) {
      const b = el('button', '', x[0]);
      b.onclick = () => setCount(s.count + x[1]);
      cc.append(b);
    });
    card.append(cc);
  }
  card.append(navGrid(s));

  const n = quiz.list[quiz.idx];
  const a = s.ans[n], k = s.key[n];
  const cur = el('div', 'curq');
  const ch = el('div', 'curq-head');
  ch.append(el('span', 'curq-no', '第 ' + n + ' 题'));
  if (s.pg[n] && s.pg[n] !== quiz.page) {
    const back = el('button', 'meta-copy', '回到作答页');
    back.onclick = () => goPage(s.pg[n]);
    ch.append(back);
  }
  const star = el('button', 'meta-copy starbtn', starLabel(quiz.unit.key, n));
  star.title = '收录到错题本 / 取消收录';
  star.onclick = function () { toggleStar(quiz.unit.key, n); render(); };
  ch.append(star);
  cur.append(ch);

  const locked = a && k;
  const letters = el('div', 'letters');
  LETTERS.split('').forEach(function (L) {
    const b = el('button', 'lbtn', L);
    if (a === L) b.classList.add('chosen');
    if (locked) {
      if (L === k) b.classList.add('ok');
      if (a === L && L !== k) b.classList.add('bad');
      b.disabled = true;
    } else b.onclick = () => pickAnswer(n, L);
    letters.append(b);
  });
  cur.append(letters);

  if (a && !k) {
    const kr = el('div', 'keyrow');
    kr.append(el('div', 'klabel', '对答案:翻到答案页,点出<b>正确选项</b>' + (quiz.unit.ans ? '' : '(答案一般在本节末尾)')));
    const kl = el('div', 'letters');
    LETTERS.split('').forEach(function (L) {
      const b = el('button', 'lbtn', L);
      b.onclick = () => setKey(n, L);
      kl.append(b);
    });
    kr.append(kl);
    cur.append(kr);
  } else if (locked) {
    const v = el('div', 'verdict ' + (a === k ? 'ok' : 'bad'),
      a === k ? '✓ 答对' : '✗ 答错 · 你选 ' + a + ',正确答案 ' + k);
    const fix = el('button', 'fixkey', '答案键填错了?');
    fix.onclick = () => clearKey(n);
    v.append(fix);
    cur.append(v);
  }
  card.append(cur);

  const cond = el('details', 'condhint');
  cond.append(el('summary', '', '条件充分性判断选项含义'));
  cond.append(el('div', '', COND_RUBRIC));
  card.append(cond);

  const f = el('div', 'sheetfoot');
  const prev = el('button', 'btn ghost small', '上一题');
  prev.disabled = quiz.idx === 0;
  prev.onclick = () => goQ(quiz.idx - 1);
  f.append(prev);
  if (quiz.done) {
    const r = el('button', 'btn small', '返回成绩');
    r.onclick = function () { quiz.showResult = true; render(); };
    f.append(r);
  } else {
    const fin = el('button', 'btn ghost small', '结束');
    fin.onclick = confirmFinish;
    f.append(fin);
  }
  const next = el('button', 'btn small', '下一题');
  next.disabled = quiz.idx === quiz.list.length - 1;
  next.onclick = () => goQ(quiz.idx + 1);
  f.append(next);
  card.append(f);
  card.append(el('div', 'hint', '<kbd>A</kbd>–<kbd>E</kbd> 选答案 · <kbd>←</kbd><kbd>→</kbd> 换题 · <kbd>[</kbd><kbd>]</kbd> 翻页'));
  return card;
}

function resultView() {
  const s = getSheet(quiz.unit.key);
  const c = el('div', 'card result');
  const st = sheetStats(s, quiz.list);
  const total = quiz.list.length, blank = total - st.done;
  c.append(el('div', 'score-big', st.ok + '<span class="score-total"> / ' + total + '</span>'));
  c.append(el('div', 'score-sub', '已判 ' + (st.ok + st.bad) + ' 题' +
    (st.pending ? ' · <b>' + st.pending + ' 题待对答案</b>' : '') + (blank ? ' · 未作答 ' + blank : '')));
  // 按难度统计:哪一档最容易丢分
  const qs = quiz.unit.qs;
  const byLv = qs ? [1, 2, 3, 4].map(function (lv) {
    const ns = quiz.list.filter(n => qs[n] && qs[n].lv === lv);
    const judged = ns.filter(n => status(s, n) === 'ok' || status(s, n) === 'bad');
    return { lv: lv, total: ns.length, judged: judged.length, ok: ns.filter(n => status(s, n) === 'ok').length };
  }).filter(x => x.total) : [];
  if (byLv.length > 1) {
    const box = el('div', 'lvres');
    byLv.forEach(function (x) {
      const rate = x.judged ? Math.round(x.ok / x.judged * 100) : null;
      const row = el('div', 'lvres-row lv' + x.lv);
      row.append(el('span', '', lvBadge(x.lv)));
      row.append(el('span', 'lvres-bar', '<i style="width:' + (rate || 0) + '%"></i>'));
      row.append(el('span', 'lvres-num', x.ok + '/' + x.total + (rate == null ? '' : ' · ' + rate + '%')));
      box.append(row);
    });
    c.append(box);
  }

  const grid = el('div', 'chipgrid');
  quiz.list.forEach(function (n, i) {
    const x = status(s, n);
    const q = quiz.unit.qs && quiz.unit.qs[n];
    const chip = el('button', 'chip ' + (x === 'ok' ? 'ok' : x === 'bad' ? 'bad' : 'un') + (q && q.lv ? ' lv' + q.lv : ''), String(n));
    chip.onclick = function () { quiz.showResult = false; quiz.idx = i; render(); };
    grid.append(chip);
  });
  c.append(grid);

  // 未转录的单元:补对答案
  if (!quiz.unit.qs && st.pending) {
    c.append(el('div', 'rtitle', '对答案 · 点出每题的正确选项即可判分(答案键会被记住)'));
    const tbl = el('div', 'keytable');
    quiz.list.forEach(function (n) {
      if (!s.ans[n]) return;
      const x = status(s, n);
      const line = el('div', 'keyline ' + (x === 'ok' || x === 'bad' ? x : ''));
      line.append(el('span', '', '<b>' + n + '</b>'));
      line.append(el('span', '', '你选 ' + s.ans[n]));
      const ls = el('div', 'letters');
      LETTERS.split('').forEach(function (L) {
        const b = el('button', 'lbtn' + (s.key[n] === L ? ' ok' : ''), L);
        b.onclick = () => setKey(n, L, true);
        ls.append(b);
      });
      line.append(ls);
      tbl.append(line);
    });
    c.append(tbl);
  }

  const acts = el('div', 'actions');
  const home = el('button', 'btn ghost', quiz.origin === '#/wrong' ? '返回错题本' : '返回主页');
  home.onclick = function () { const o = quiz.origin || '#/'; quiz = null; location.hash = o; };
  acts.append(home);
  const wrongNs = quiz.list.filter(n => status(s, n) === 'bad');
  if (wrongNs.length) {
    const b = el('button', 'btn', '重刷本次错题(' + wrongNs.length + ')');
    b.onclick = function () { startRedo(quiz.unit.key, wrongNs, quiz.origin); render(); };
    acts.append(b);
  }
  c.append(acts);
  return c;
}

/* ───────────── 错题本(纯收录) ───────────── */
// 某科目错题本里的题号(数学、逻辑各自独立)
function wrongIds(subj) {
  return Object.keys(wrongBook).filter(function (id) {
    const u = UNITS[id.slice(0, id.lastIndexOf('#'))];
    return u && subjectOf(u.book) === subj;
  });
}
const KEY_WRONGLV = 'gzb.wronglv.v1';
let wrongLv = load(KEY_WRONGLV, []);
function renderWrong() {
  $app.innerHTML = '';
  const w = el('div', 'wrap');
  const subj = curSubject();
  w.append(subjectTabs());
  w.append(el('h2', 'pagetitle', SUBJ_NAME[subj] + '错题本'));

  let items = wrongIds(subj).map(function (id) {
    const i = id.lastIndexOf('#');
    return { id: id, unit: UNITS[id.slice(0, i)], n: Number(id.slice(i + 1)), r: wrongBook[id] };
  }).filter(x => x.unit && unitAvailable(x.unit));

  if (!items.length) {
    w.append(el('div', 'card empty', wrongIds(subj).length
      ? '收录的题都在还没上传书页的板块里 —— 用本地的「启动网站.command」可以看到它们。'
      : '还没有收录题目。做题时点 ☆ 收录,把值得重做的题收进来。'));
    $app.append(w);
    return;
  }
  // 按难度筛选错题(可多选,全不选 = 全部):复习抽题、导出、下面的列表都只看筛出来的题
  const lvOf = x => (x.unit.qs && x.unit.qs[x.n] && x.unit.qs[x.n].lv) || 0;
  const wc = [0, 0, 0, 0];
  items.forEach(function (x) { if (lvOf(x)) wc[lvOf(x) - 1]++; });
  if (wc.some(Boolean)) {
    const bar = el('div', 'wronglv');
    bar.append(el('span', 'lvf-label', '难度'), el('span', '', lvSpectrum(wc)));
    const set = function (f) { wrongLv = f.length === 4 ? [] : f; store(KEY_WRONGLV, wrongLv); render(); };
    const all = el('button', 'lvf all' + (wrongLv.length ? '' : ' on'), '全部 ' + items.length);
    all.onclick = () => set([]);
    bar.append(all);
    [1, 2, 3, 4].forEach(function (lv) {
      if (!wc[lv - 1]) return;
      const on = wrongLv.indexOf(lv) >= 0;
      const b = el('button', 'lvf lv' + lv + (on ? ' on' : ''), LV_BARS + LV_NAME[lv] + ' ' + wc[lv - 1]);
      b.onclick = () => set(on ? wrongLv.filter(x => x !== lv) : wrongLv.concat(lv).sort());
      bar.append(b);
    });
    w.append(bar);
    if (wrongLv.length) items = items.filter(x => wrongLv.indexOf(lvOf(x)) >= 0);
    if (!items.length) {
      w.append(el('div', 'card empty', '所选难度下没有收录的题。'));
      $app.append(w);
      return;
    }
  }
  w.append(reviewCard(items));
  w.append(exportBar(items));
  BANK.books.forEach(function (book) {
    const mine = items.filter(x => x.unit.book === book);
    if (!mine.length) return;
    const sec = el('section', 'card sec');
    sec.append(el('h2', 'sec-title', esc(book.title) + '<span class="catcnt"> · ' + mine.length + ' 题</span>'));
    book.units.forEach(function (u) {
      const us = mine.filter(x => x.unit === u).sort((a, b) => a.n - b.n);
      if (!us.length) return;
      const g = el('div', 'unitgroup');
      const gt = el('div', 'setrow');
      gt.append(el('div', 'unitgroup-title', esc(unitName(u))));
      const all = el('button', 'btn small', '重刷这 ' + us.length + ' 题');
      all.style.marginLeft = 'auto';
      all.onclick = () => startRedo(u.key, us.map(x => x.n), '#/wrong');
      gt.append(all);
      g.append(gt);
      const s = getSheet(u.key);
      us.forEach(function (x) {
        const row = el('div', 'wq');
        row.append(el('span', 'wq-no', '第 ' + x.n + ' 题'));
        const q = u.qs && u.qs[x.n];
        if (q && q.lv) row.append(el('span', 'wq-lv', lvBadge(q.lv)));
        const preview = q ? questionPlainText(u, x.n).split('\n')[1] : '';
        row.append(el('span', 'wq-meta', [
          preview ? esc(preview.slice(0, 42)) + (preview.length > 42 ? '…' : '') : '',
          x.r.t ? '重做错 ' + x.r.t + ' 次' : '',
          x.r.pick ? '错选 ' + x.r.pick : '',
          !q && s.key[x.n] ? '正确 ' + s.key[x.n] : '',
          !q && s.pg[x.n] ? pageLabel(book, s.pg[x.n]) : '',
          '收录于' + relDays(x.r.last)
        ].filter(Boolean).join(' · ')));
        const acts = el('div', 'setacts');
        const redo = el('button', 'btn ghost small', '重做');
        redo.onclick = () => startRedo(u.key, [x.n], '#/wrong');
        const rm = el('button', 'btn ghost small', '移出');
        rm.onclick = function () { removeWrong(x.id); render(); };
        acts.append(redo, rm);
        row.append(acts);
        g.append(row);
      });
      sec.append(g);
    });
    w.append(sec);
  });
  $app.append(w);
}

/* ───────────── 错题复习:加权伪随机抽题 ─────────────
   权重 = 1 + 0.6×重做错次数 − 0.3×重做对次数,限制在 [0.4, 3];
   刚抽过的题(最近 3 次)权重×0.2,避免反复抽到同一题。抽中的题保持不变,直到去做或点「换一题」。
   数学、逻辑各抽各的。 */
const KEY_REVIEW = 'gzb.review.v2';
const reviews = load(KEY_REVIEW, {});
function rv() {
  const k = curSubject();
  return reviews[k] || (reviews[k] = { pick: null, recent: [] });
}
function reviewWeight(id) {
  const r = wrongBook[id] || {};
  let w = Math.min(3, Math.max(0.4, 1 + 0.6 * (r.t || 0) - 0.3 * (r.ok || 0)));
  if (rv().recent.indexOf(id) >= 0) w *= 0.2;
  return w;
}
function drawReview(items) {
  const pool = items.filter(x => x.id !== rv().pick && x.id !== rv().recent[0]);   // 不连续抽到同一题
  if (!pool.length) return items[0] ? items[0].id : null;
  let total = 0;
  pool.forEach(x => { total += reviewWeight(x.id); });
  let roll = Math.random() * total;
  for (const x of pool) { roll -= reviewWeight(x.id); if (roll <= 0) return x.id; }
  return pool[pool.length - 1].id;
}
function setPick(id) {
  rv().pick = id;
  if (id) rv().recent = [id].concat(rv().recent.filter(x => x !== id)).slice(0, 3);
  store(KEY_REVIEW, reviews);
}
function reviewCard(items) {
  if (!rv().pick || !items.some(x => x.id === rv().pick)) setPick(drawReview(items));
  const x = items.find(i => i.id === rv().pick);
  const c = el('section', 'card reviewcard');
  if (!x) return c;
  const u = x.unit, q = u.qs && u.qs[x.n];
  c.append(el('div', 'rv-label', '🎲 今日抽到 · ' + esc(unitName(u)) + ' · 第 ' + x.n + ' 题' +
    (x.r.t ? ' · 重做错 ' + x.r.t + ' 次' : '') + (q ? lvBadge(q.lv) : '')));
  const body = el('div', 'rv-stem', q ? q.stem : '原书' + pageLabel(u.book, getSheet(u.key).pg[x.n] || u.start) + '的第 ' + x.n + ' 题');
  if (q && q.fig) { const img = el('img', 'qfig'); img.src = q.fig; body.append(img); }
  c.append(typeset(body));
  const acts = el('div', 'setacts');
  const go = el('button', 'btn', '开始做这题');
  go.onclick = function () { setPick(null); startRedo(u.key, [x.n], '#/wrong'); };
  const next = el('button', 'btn ghost', '换一题');
  next.onclick = function () { setPick(drawReview(items)); render(); };
  acts.append(go, next);
  c.append(acts);
  return c;
}

/* ───────────── 错题本导出(自动排版 → 打印/存为 PDF) ───────────── */
let exportOpt = load('gzb.export.v1', { ans: true, space: true });
function exportBar(items) {
  const bar = el('div', 'card sec exportbar');
  bar.append(el('div', 'eb-title', '导出错题 <span class="setmeta">自动排版,在打印窗口选「存储为 PDF」即可</span>'));
  const opts = el('div', 'eb-opts');
  [['ans', '最后附答案'], ['space', '每题留作答空白']].forEach(function (o) {
    const lab = el('label', 'eb-opt');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!exportOpt[o[0]];
    cb.onchange = function () { exportOpt[o[0]] = cb.checked; store('gzb.export.v1', exportOpt); };
    lab.append(cb, document.createTextNode(' ' + o[1]));
    opts.append(lab);
  });
  const go = el('button', 'btn small', '导出 PDF(' + items.length + ' 题)');
  go.onclick = function () { printWrong(items); };
  opts.append(go);
  bar.append(opts);
  return bar;
}
function printWrong(items) {
  printItems(items, '错题本', exportOpt, function (x) { return x.r && x.r.t ? ' · 重做错 ' + x.r.t + ' 次' : ''; });
}
// 通用打印:items = [{unit, n, ...}],opt = {ans, sol, space},noteFn(x) 给题目来源行追加说明
function printItems(items, title, opt, noteFn) {
  if (opt && opt.sol && solState !== 2) { loadSols(function () { printItems(items, title, opt, noteFn); }); return; }
  // 与页面一致的顺序:按书、单元、题号
  const order = [];
  BANK.books.forEach(function (b) {
    b.units.forEach(function (u) {
      items.filter(x => x.unit === u).sort((a, c) => a.n - c.n).forEach(x => order.push(x));
    });
  });
  const doc = el('div', 'printdoc');
  const d = new Date();
  doc.append(el('div', 'pd-head', '<b>' + esc(title) + '</b><span>' + order.length + ' 题 · 打印于 ' +
    d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '</span>'));
  const answers = [];
  order.forEach(function (x, k) {
    const u = x.unit, q = u.qs && u.qs[x.n], s = getSheet(u.key);
    const box = el('div', 'pq');
    box.append(el('div', 'pq-src', '<b>' + (k + 1) + '.</b> ' + esc(unitName(u)) + ' · 第 ' + x.n + ' 题' +
      (q && q.lv ? ' · ' + LV_NAME[q.lv] : '') + (noteFn ? noteFn(x) : '')));
    if (q) {
      box.append(el('div', 'pq-stem', q.stem));
      if (q.fig) { const img = el('img', 'pq-fig'); img.src = q.fig; box.append(img); }
      if (q.kind === 'cond') {
        box.append(el('div', 'pq-cond', '(1) ' + q.c1));
        box.append(el('div', 'pq-cond', '(2) ' + q.c2));
      } else {
        const op = el('div', 'pq-opts');
        q.opts.forEach(function (o, i) { op.append(el('span', '', LETTERS[i] + '. ' + o)); });
        box.append(op);
      }
      answers.push({ k: k + 1, ans: q.ans || s.key[x.n] || '—', sol: q.sol });
    } else {
      // 未转录的题:附原书页面
      const pg = s.pg[x.n] || u.start;
      box.append(el('div', 'pq-note', '原书' + pageLabel(u.book, pg) + '(未转录,附原页)'));
      const img = el('img', 'pq-page'); img.src = pageImg(u.book, pg); box.append(img);
      answers.push({ k: k + 1, ans: s.key[x.n] || '—' });
    }
    if (opt.space) box.append(el('div', 'pq-space'));
    doc.append(box);
  });
  if (opt.ans) {
    // 答案紧凑排在最后;要解析时再按题列出
    const sec = el('div', 'pd-ans');
    sec.append(el('div', 'pd-anstitle', '答案'));
    const grid = el('div', 'pa-grid');
    answers.forEach(function (a) { grid.append(el('span', 'pa', a.k + '. <b>' + a.ans + '</b>')); });
    sec.append(grid);
    if (opt.sol) {
      answers.forEach(function (a) {
        if (a.sol) sec.append(el('div', 'pa-sol', '<b>' + a.k + '.</b> ' + a.sol));
      });
    }
    doc.append(sec);
  }
  openPrintPreview(doc, title);
}

/* 打印预览:先把内容排成 A4 页给人看;「存为 PDF」直接生成文件(手机上弹分享),「打印」才调打印机 */
const PV_W = 794, PV_H = 1123, PV_PAD = 60;   // A4 @96dpi,上下边距 16mm
function openPrintPreview(doc, title) {
  const pv = el('div', 'pv');
  const bar = el('div', 'pv-bar');
  const info = el('span', 'pv-info', '排版中…');
  const pdf = el('button', 'btn', '生成 PDF…');
  const prt = el('button', 'btn ghost', '打印');
  const x = el('button', 'btn ghost', '关闭');
  pdf.disabled = true;
  bar.append(el('b', 'pv-title', esc(title)), info, pdf, prt, x);
  const pages = el('div', 'pv-pages');
  pv.append(bar, pages);
  document.body.append(pv);
  document.body.classList.add('previewing');
  let closed = false, file = null;
  const fit = function () { pages.style.zoom = Math.min(1, (window.innerWidth - 24) / PV_W); };
  const close = function () {
    closed = true; pv.remove(); document.body.classList.remove('previewing');
    window.removeEventListener('resize', fit); document.removeEventListener('keydown', esc_);
  };
  const esc_ = function (ev) { if (ev.key === 'Escape') close(); };
  x.onclick = close;
  window.addEventListener('resize', fit);
  document.addEventListener('keydown', esc_);
  fit();
  prt.onclick = function () { window.print(); };

  // 拆成不可分割的块:抬头、每道题、答案表、每条解析
  typeset(doc);
  const blocks = [];
  [...doc.children].forEach(function (c) {
    if (!c.classList.contains('pd-ans')) { blocks.push(c); return; }
    const head = el('div', 'pd-ans'), sols = [];
    [...c.children].forEach(function (k) {
      if (k.classList.contains('pa-sol')) sols.push(k); else head.append(k);
    });
    blocks.push(head, ...sols);
  });
  // 先在页里排好再等图片和字体,量出高度后逐块装页,装不下就换新页
  const newPage = function () {
    const pg = el('div', 'pv-page'), inner = el('div', 'pv-in');
    pg.append(inner); pages.append(pg); return inner;
  };
  let inner = newPage();
  blocks.forEach(b => inner.append(b));
  Promise.all([...pages.querySelectorAll('img')].map(i => i.decode().catch(() => {}))
    .concat(document.fonts ? [document.fonts.ready] : []))
    .then(function () {
      if (closed) return;
      pages.innerHTML = '';
      inner = newPage();
      blocks.forEach(function (b) {
        inner.append(b);
        if (inner.offsetHeight > PV_H - 2 * PV_PAD && inner.children.length > 1) { inner = newPage(); inner.append(b); }
      });
      const n = pages.children.length;
      info.textContent = n + ' 页';
      return renderPdf([...pages.children], function (k) { if (!closed) info.textContent = '生成 PDF ' + k + '/' + n; });
    })
    .then(function (blob) {
      if (closed || !blob) return;
      const d = new Date();
      file = new File([blob], title + '-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '.pdf',
                      { type: 'application/pdf' });
      info.textContent = pages.children.length + ' 页 · ' + Math.max(1, Math.round(blob.size / 1024)) + ' KB';
      pdf.disabled = false;
      const share = matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] });
      pdf.textContent = share ? '分享 PDF' : '下载 PDF';
      pdf.onclick = function () {
        if (share) { navigator.share({ files: [file], title: title }).catch(function () {}); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      };
    })
    .catch(function () { if (!closed) { info.textContent = 'PDF 生成失败,可用「打印 → 存储为 PDF」'; pdf.remove(); } });
}
// 每页用 html2canvas 截成 JPEG,再拼成 PDF(页面在屏幕外克隆一份截,避开预览的缩放)
function renderPdf(pageEls, progress) {
  const box = el('div', 'pv-shot');
  document.body.append(box);
  const out = [];
  let chain = loadH2C();
  pageEls.forEach(function (pg, i) {
    chain = chain.then(function () {
      progress(i + 1);
      const c = pg.cloneNode(true);
      box.innerHTML = ''; box.append(c);
      return Promise.all([...c.querySelectorAll('img')].map(im => im.decode().catch(() => {})))
        .then(() => window.html2canvas(c, { backgroundColor: '#ffffff', scale: 2, logging: false }))
        .then(cv => new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88)).then(b => b.arrayBuffer())
          .then(buf => out.push({ data: new Uint8Array(buf), w: cv.width, h: cv.height,
                                  pw: c.offsetWidth * 0.75, ph: c.offsetHeight * 0.75 })));
    });
  });
  return chain.then(() => buildPdf(out)).finally(() => box.remove());
}
// 最小 PDF:每页一张 JPEG 铺满
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const put = function (d) { if (typeof d === 'string') d = enc.encode(d); parts.push(d); len += d.length; };
  const obj = function (id, dict, stream) {
    offs[id] = len;
    put(id + ' 0 obj\n' + dict);
    if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); }
    put('\nendobj\n');
  };
  const f = v => +v.toFixed(2);
  put('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [' + pages.map((p, i) => (3 + i * 3) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  pages.forEach(function (p, i) {
    const id = 3 + i * 3, cs = enc.encode('q ' + f(p.pw) + ' 0 0 ' + f(p.ph) + ' 0 0 cm /I0 Do Q');
    obj(id, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(p.pw) + ' ' + f(p.ph) + '] /Resources << /XObject << /I0 ' +
        (id + 2) + ' 0 R >> >> /Contents ' + (id + 1) + ' 0 R >>');
    obj(id + 1, '<< /Length ' + cs.length + ' >>', cs);
    obj(id + 2, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.data.length + ' >>', p.data);
  });
  const xref = len, size = 3 + pages.length * 3;
  let t = 'xref\n0 ' + size + '\n0000000000 65535 f \n';
  for (let i = 1; i < size; i++) t += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  put(t + 'trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}

/* ───────────── 备份恢复 ─────────────
   本机没有任何记录时(如浏览器缓存被清),自动从网站目录下的 progress.json 恢复。
   用法:主页「导出备份」得到的文件改名为 progress.json,放进 site/ 一起上传到 GitHub。 */
function restoreFromRepo() {
  if (Object.keys(sheets).length || Object.keys(wrongBook).length || hist.length) return;
  fetch('progress.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || d.app !== 'gzb' || !d.sheets) return;
      sheets = d.sheets; wrongBook = d.wrong || {}; hist = d.hist || [];
      saveSheets(); saveWrong(); saveHist();
      if (!quiz) render();
    }).catch(function () {});
}

/* ───────────── 触屏左右滑动换题 ───────────── */
let touchX = null, touchY = 0;
document.addEventListener('touchstart', function (ev) {
  const t = ev.target;
  // 拉条、表格等可横向操作的元素上不触发
  if (!quiz || ev.touches.length !== 1 || (t.closest && t.closest('input,.qtable,.pagewrap'))) { touchX = null; return; }
  touchX = ev.touches[0].clientX;
  touchY = ev.touches[0].clientY;
  swipeAxis = null;
}, { passive: true });
// 横滑换题时锁定方向:一旦判定为横向,就阻止页面上下跟着晃
let swipeAxis = null;
document.addEventListener('touchmove', function (ev) {
  if (touchX == null || !quiz || ev.touches.length !== 1) return;
  const dx = ev.touches[0].clientX - touchX, dy = ev.touches[0].clientY - touchY;
  if (!swipeAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) swipeAxis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
  if (swipeAxis === 'x' && ev.cancelable) ev.preventDefault();
}, { passive: false });
document.addEventListener('touchend', function (ev) {
  swipeAxis = null;
  if (touchX == null || !quiz || quiz.showResult || (location.hash || '').indexOf('#/quiz') !== 0) return;
  const dx = ev.changedTouches[0].clientX - touchX, dy = ev.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  goQ(quiz.idx + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ───────────── 键盘 ─────────────
   A–E / 1–5 作答 · ←→ 换题 · Enter 下一题 · S 收录 · X 复制图片 · G 题号 · [ ] 翻页 · Esc 退出 */
document.addEventListener('keydown', function (ev) {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
  if (!quiz || (location.hash || '').indexOf('#/quiz') !== 0) return;
  if (ev.key === 'Escape') { exitQuiz(); return; }
  if (quiz.showResult) return;
  const s = getSheet(quiz.unit.key), n = quiz.list[quiz.idx];
  const k = ev.key.toUpperCase();
  const L = LETTERS.indexOf(k) >= 0 && k.length === 1 ? k : '12345'.indexOf(k) >= 0 && k.length === 1 ? LETTERS['12345'.indexOf(k)] : null;
  if (L) {
    // 已作答且待对答案时,按键用于填正确答案
    if (s.ans[n] && !s.key[n]) setKey(n, L);
    else pickAnswer(n, L);
  } else if (k === 'X' && quiz.unit.qs) {
    const b = document.querySelector('.qtools .tool');
    if (b) copyQuestionImage(quiz.unit, n, b);
  } else if (ev.key === 'Enter' || ev.key === 'ArrowRight') {
    if (ev.key === 'Enter') nextOrFinish(); else goQ(quiz.idx + 1);
  } else if (ev.key === 'ArrowLeft') goQ(quiz.idx - 1);
  else if (k === 'S') { toggleStar(quiz.unit.key, n); render(); }
  else if (k === 'B' && picking && quiz.unit.qs) { toggleBasket(quiz.unit.key, n); render(); }
  else if (k === 'G') { quiz.showNav = !quiz.showNav; render(); }
  else if (ev.key === ']') goPage(quiz.page + 1);
  else if (ev.key === '[') goPage(quiz.page - 1);
  else return;
  ev.preventDefault();
});


/* ───────────── 选题打印(选题单) ─────────────
   右侧「选题单」像中转站:进入选题模式后,在主页点单元挑题、在做题页点「＋ 选题单」(快捷键 B),
   题目都收进选题单;选完一次性打印,打印前询问是否附答案(可含解析)。选题单记在本机,下次还在。 */
const KEY_BASKET = 'gzb.basket.v1';
let basket = load(KEY_BASKET, []);       // 'unitKey#题号'
let picking = false;
const saveBasket = () => store(KEY_BASKET, basket);
function inBasket(uk, n) { return basket.indexOf(uk + '#' + n) >= 0; }
function toggleBasket(uk, n) {
  const k = uk + '#' + n, i = basket.indexOf(k);
  if (i >= 0) basket.splice(i, 1); else basket.push(k);
  saveBasket(); basketSync(true);

}
function basketAdd(u, nums, on) {
  nums.forEach(function (n) {
    const k = u.key + '#' + n, i = basket.indexOf(k);
    if (on && i < 0) basket.push(k);
    if (!on && i >= 0) basket.splice(i, 1);
  });
  saveBasket(); basketSync(true);
}
function basketItems() {
  const out = [];
  BANK.books.forEach(function (b) {
    b.units.forEach(function (u) {
      if (!u.qs) return;
      basket.filter(k => k.indexOf(u.key + '#') === 0).map(k => +k.split('#')[1])
        .sort((a, c) => a - c).forEach(n => { if (u.qs[n]) out.push({ unit: u, n: n }); });
    });
  });
  return out;
}
function unitClick(u) {
  if (picking && u.qs) openPicker(u);
  else if (picking) alert('这一节还没有逐题转录,暂时不能加入选题单。');
  else startUnit(u.key);
}
function setPicking(on) {
  picking = on;
  document.body.classList.toggle('picking', on);
  basketSync(true);
}
function refreshPicked() {
  document.querySelectorAll('[data-u]').forEach(function (b) {
    const u = UNITS[b.dataset.u];
    if (!u || !u.qs) return;
    const c = u.qnos.filter(n => inBasket(u.key, n)).length;
    b.classList.toggle('picked', c > 0 && c === u.qnos.length);
    b.classList.toggle('half', c > 0 && c < u.qnos.length);
    let tag = b.querySelector('.pk-tag');
    if (c) {
      if (!tag) b.append(tag = el('span', 'pk-tag'));
      tag.textContent = '选题单 ' + c;
    } else if (tag) tag.remove();
  });
}
function basketSync(rebuild) {
  let fab = document.getElementById('basket');
  if (!fab) {
    fab = el('div', 'bk');
    fab.id = 'basket';
    document.body.append(fab);
  }
  const items = basketItems();
  fab.classList.toggle('on', picking);
  if (!rebuild && fab.dataset.n === String(items.length) && fab.dataset.p === String(picking)) return;
  const prevN = +fab.dataset.n || 0;
  fab.dataset.n = items.length;
  fab.dataset.p = String(picking);
  const wasOpen = fab.classList.contains('open');
  fab.innerHTML = '';
  if (!picking) { fab.classList.remove('open'); refreshPicked(); refreshEntry(); return; }
  // 悬浮小标:只显示已选数量;点开是一个很小的菜单(打印 / 清空 / 退出选题)
  const pill = el('button', 'bk-pill' + (items.length > prevN ? ' bump' : ''));
  pill.innerHTML = '选题单 <b>' + items.length + '</b>';
  pill.title = '点开:打印 / 清空 / 退出选题';
  pill.onclick = function () { fab.classList.toggle('open'); };
  const menu = el('div', 'bk-menu');
  const go = el('button', 'btn small', '打印 ' + items.length + ' 题');
  go.disabled = !items.length;
  go.onclick = function () { fab.classList.remove('open'); openPrintAsk(items); };
  const clr = el('button', 'btn ghost small', '清空');
  clr.disabled = !items.length;
  // 不用 confirm():部分内置浏览器/主屏幕应用会吞掉弹窗,点了没反应。改成页面内二次确认(再点一次才清空,4 秒后复原)
  let clrTimer = 0;
  clr.onclick = function () {
    if (clr.classList.contains('arm')) {
      clearTimeout(clrTimer);
      basket = []; saveBasket(); basketSync(true);
      return;
    }
    clr.classList.add('arm');
    clr.textContent = '再点一次,清空 ' + items.length + ' 题';
    clrTimer = setTimeout(function () { clr.classList.remove('arm'); clr.textContent = '清空'; }, 4000);
  };
  const done = el('button', 'btn ghost small', '退出选题');
  done.onclick = function () { setPicking(false); };
  menu.append(el('div', 'bk-tip', '选题模式:主页点单元挑题,做题页点「＋ 选题单」(B)'), go, clr, done);
  fab.append(menu, pill);
  if (wasOpen) fab.classList.add('open');
  refreshPicked();
  refreshEntry();
}
// 主页上的入口按钮:平时只是一个小按钮,不占地方
function entryButton() {
  const b = el('button', 'pickentry');
  b.id = 'pickentry';
  b.onclick = function () { setPicking(!picking); };
  fillEntry(b);
  return b;
}
function fillEntry(b) {
  const n = basket.length;
  b.classList.toggle('on', picking);
  b.textContent = picking ? '退出选题' : (n ? '选题打印 · ' + n : '选题打印');
  b.title = '攒一批题,一起打印';
}
function refreshEntry() {
  const b = document.getElementById('pickentry');
  if (b) fillEntry(b);
}

/* 某一节的选题面板:列出全部题目,勾选加入选题单 */
function openPicker(u) {
  const ov = el('div', 'bk-ov');
  const dlg = el('div', 'bk-dlg');
  const nums = u.qnos;
  const top = el('div', 'bk-dtop');
  const title = el('div', 'bk-dtitle');
  const sub = el('div', 'bk-dsub');
  top.append(title, sub);
  dlg.append(top);
  const body = el('div', 'bk-dbody');
  const rows = [];
  nums.forEach(function (n) {
    const q = u.qs[n];
    const row = el('label', 'bk-row');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = inBasket(u.key, n);
    cb.onchange = function () { basketAdd(u, [n], cb.checked); upd(); };
    const txt = el('span', 'bk-rtxt');
    const kind = q.kind === 'cond' ? '条件充分' : '';
    txt.innerHTML = '<b>' + n + '.</b> ' + lvBadge(q.lv, true) + (kind ? '<em>' + kind + '</em> ' : '') + q.stem;
    row.append(cb, txt);
    body.append(row);
    rows.push(cb);
  });
  dlg.append(body);
  const foot = el('div', 'bk-dfoot');
  const all = el('button', 'btn ghost small', '全选');
  all.onclick = function () { basketAdd(u, nums, true); rows.forEach(c => c.checked = true); upd(); };
  const none = el('button', 'btn ghost small', '全不选');
  none.onclick = function () { basketAdd(u, nums, false); rows.forEach(c => c.checked = false); upd(); };
  const hard = el('button', 'btn ghost small', '只选较难以上');
  hard.title = '只勾选难度为「较难」「挑战」的题';
  hard.onclick = function () {
    const hs = nums.filter(n => u.qs[n].lv >= 3);
    basketAdd(u, nums, false);
    basketAdd(u, hs, true);
    rows.forEach(function (c, i) { c.checked = hs.indexOf(nums[i]) >= 0; });
    upd();
  };
  const ok = el('button', 'btn small', '完成');
  ok.onclick = function () { ov.remove(); };
  foot.append(all, none, hard, ok);
  dlg.append(foot);
  function upd() {
    const c = nums.filter(n => inBasket(u.key, n)).length;
    title.textContent = u.book.title + ' · ' + unitName(u);
    sub.textContent = '共 ' + nums.length + ' 题,已选 ' + c + ' 题 · 勾选后自动进入右侧选题单';
  }
  upd();
  ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
  ov.append(dlg);
  document.body.append(ov);
  typeset(body);
}

/* 打印前询问:要不要附答案 */
function openPrintAsk(items) {
  const ov = el('div', 'bk-ov');
  const dlg = el('div', 'bk-dlg ask');
  dlg.append(el('div', 'bk-dtitle', '导出 ' + items.length + ' 道题'));
  dlg.append(el('div', 'bk-dsub', '需要附上答案吗?答案会单独排在最后一页,方便先做题再对照。'));
  const lab = el('label', 'bk-space');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = !!exportOpt.space;
  cb.onchange = function () { exportOpt.space = cb.checked; store('gzb.export.v1', exportOpt); };
  lab.append(cb, document.createTextNode(' 每题下面留出答题空白'));
  dlg.append(lab);
  const acts = el('div', 'bk-ask-acts');
  function go(ans, sol) {
    ov.remove();
    printItems(items, '选题练习', { ans: ans, sol: sol, space: exportOpt.space });
  }
  const a = el('button', 'btn ghost', '不附答案');
  a.onclick = function () { go(false, false); };
  const b = el('button', 'btn', '附答案');
  b.onclick = function () { go(true, false); };
  const c = el('button', 'btn', '附答案 + 解析');
  c.onclick = function () { go(true, true); };
  const x = el('button', 'btn ghost small bk-cancel', '取消');
  x.onclick = function () { ov.remove(); };
  acts.append(a, b, c);
  dlg.append(acts, x);
  ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
  ov.append(dlg);
  document.body.append(ov);
}

basketSync(true);

PAGES.done = true;     // 不再加载原书页面:全站只用逐题转录的题,启动时不请求任何书页图
loadGroup(curSubject(), function () {
  render();
  if (window.requestIdleCallback) requestIdleCallback(function () { loadSols(); }, { timeout: 2000 });
  else setTimeout(function () { loadSols(); }, 300);
});
restoreFromRepo();
// 首屏画完后在后台加载解析,等做完第一题时通常早已就绪


/* 离线缓存(Service Worker):只在线上启用;本地预览时注销,免得改完代码还看到缓存里的旧文件 */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(function () {});
  } else {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
}
