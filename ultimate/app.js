/* Ultimate · 管综提分
   一组 10 题:系统按「考频 × 没掌握」挑漏分最多的考点,难度跟着你的表现上下浮动(保持在够得着的区间),
   组末一道压轴真题;错题按 1/3/7/16/35 天回来。题库由 scripts/build_ultimate.py 生成。 */
'use strict';

const $ = (s, el) => (el || document).querySelector(s);
const app = $('#app');
const DAY = 86400000;
const KEY = 'ult.v1';
const SUBJ = { math: { name: '数学', pts: 3, per: 25, sec: 150, tgt: 60 }, logic: { name: '逻辑', pts: 2, per: 30, sec: 120, tgt: 46 } };
const IV = [1, 3, 7, 16, 35];
const LET = 'ABCDE';
const LVN = ['', '基础', '中等', '较难', '挑战'];
const COND_OPTS = ['条件(1)充分,但条件(2)不充分', '条件(2)充分,但条件(1)不充分', '条件(1)和(2)单独都不充分,但联合起来充分',
  '条件(1)充分,条件(2)也充分', '条件(1)和(2)单独都不充分,联合起来也不充分'];
const gN = () => S.groupN || 10;        // 每组题数(AI 可改,5–20)

/* ───────────── 状态 ───────────── */
function fresh() {
  return { subj: 'math', cards: {}, tp: {}, days: {}, goal: 20, target: { math: SUBJ.math.tgt, logic: SUBJ.logic.tgt },
           papers: {}, hist: [], cur: null };
}
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { S = fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式等 */ } }

const META = window.UMETA;
const DATA = window.UDATA = window.UDATA || {};
const loading = {};
function loadData(subj) {
  if (DATA[subj] && DATA[subj].byId) return Promise.resolve(DATA[subj]);
  return loading[subj] = loading[subj] || new Promise(function (ok, fail) {
    const s = document.createElement('script');
    s.src = window.UFILES[subj];
    s.onload = function () {
      const d = DATA[subj];
      d.byId = {};
      d.qs.forEach(function (q) { d.byId[q.id] = q; });
      d.topic = {};
      d.topics.forEach(function (t) { d.topic[t.id] = t; });
      ok(d);
    };
    s.onerror = fail;
    document.head.append(s);
  });
}
function topicsOf(subj) { return META[subj].topics; }
function topicName(subj, tid) { const t = topicsOf(subj).find(x => x.id === tid); return t ? t.name : tid; }

/* ───────────── 能力模型(Elo / 一参数 IRT) ─────────────
   每个考点一个能力分 θ,每道题一个难度 b,答对概率 P = 1/(1+e^-(θ−b))。
   答完按(实际 − 预期)修正 θ:新考点步子大(几题就定位),做多了步子小(稳定)。
   没测过的考点先用整个科目的水平 g 代替。 */
const LV_B = [0, -1.3, -0.3, 0.7, 1.7];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sig = x => 1 / (1 + Math.exp(-x));
function lvB(lv) { const i = clamp(Math.floor(lv), 1, 3); return LV_B[i] + (LV_B[i + 1] - LV_B[i]) * clamp(lv - i, 0, 1); }
function eloOf(subj) { S.elo = S.elo || {}; return (S.elo[subj] = S.elo[subj] || { g: 0, t: {} }); }
function theta(subj, tid) { const e = eloOf(subj), t = e.t[tid]; return t ? t.th : e.g; }
function pWin(subj, q) { return sig(theta(subj, q.t) - lvB(q.lv)); }
/* w:这次作答的可信权重(存疑的错题先按「不会」的概率打折扣);返回本次对考点 θ 的完整修正量,供之后补扣/退还 */
function eloUpdate(subj, t, lv, r, w) {
  w = w === undefined ? 1 : w;
  const e = eloOf(subj), x = e.t[t] || (e.t[t] = { th: e.g, n: 0 }), b = lvB(lv);
  const k = x.n < 3 ? 0.9 : x.n < 10 ? 0.45 : x.n < 30 ? 0.25 : 0.15;   // 先快后稳
  const full = k * (r - sig(x.th - b)), fullG = 0.15 * (r - sig(e.g - b));
  x.th = clamp(x.th + full * w, -3, 4); x.n++;
  e.g = clamp(e.g + fullG * w, -3, 4);
  return { full: full, fullG: fullG };
}
function eloShift(subj, t, d, dG) {
  const e = eloOf(subj), x = e.t[t];
  if (x) x.th = clamp(x.th + d, -3, 4);
  e.g = clamp(e.g + dG, -3, 4);
}

/* ───────────── 错题定性:失误(会但手滑/一时忘了)还是真不会 ─────────────
   全在后台按行为推断,不问用户。每道错题先「存疑」,失误概率 post 用贝叶斯几率累积证据:
     先验   = 会做却失误的概率:SLIP·P会 / (SLIP·P会 + (1−P会)),P会 = 答前对这题的把握
     用时   秒选就错(< 正常 35%)×2.2;磨很久才错(> 1.5 倍)×0.5
     看解析 错后扫几秒就走(< 8 秒)×1.8;盯着看了很久(> 45 秒)×0.5
     后续   同考点下一题做对 ×1.6 / 做错 ×0.4;原题隔天复查做对 ×3 / 又错 ×0.15(复查后定案)
   能力分只按 (1−post) 扣,post 变了就补扣或退还;post ≥ 0.85 定为失误(原题 3 天后快速复查,不进错题本),
   ≤ 0.25 定为不会(错题周期、主攻)。存疑的照常算错题。参数偏保守:把真不会误判成失误的代价更大。
   模拟(只用对错,不含用时/看解析信号):15% 失误率的学生能力误差 0.77→0.53,判失误的准确率约一半,
   不失误的学生只有约 1/10 的真错题被误放过。用时和看解析的信号要靠真实数据。 */
const SLIP = 0.12, EV = { sibOk: 1.6, sibBad: 0.4, reOk: 3, reBad: 0.15, slip: 0.85, gap: 0.25 };   // 证据倍数与定案阈值(scripts/ultimate_sim.js 调过)
const odds = p => p / (1 - p), unodds = o => o / (1 + o);
function pendOf(subj) { S.pend = S.pend || {}; return (S.pend[subj] = S.pend[subj] || []); }
function setPost(subj, pd, post) {
  post = clamp(post, 0.02, 0.98);
  const f0 = 1 - pd.post, f1 = 1 - post;        // 已按 f0 扣过,改成按 f1 扣
  eloShift(subj, pd.t, pd.full * (f1 - f0), pd.fullG * (f1 - f0));
  pd.post = post;
  if (post >= EV.slip || post <= EV.gap || pd.ev >= 3) settle(subj, pd);
}
function settle(subj, pd) {
  const c = S.cards[pd.id], slip = pd.post >= 0.5;
  if (c) {
    c.kind = slip ? 'slip' : 'gap';
    if (slip) { c.st = Math.max(pd.st0, 2); c.due = Math.min(c.due, Date.now() + 3 * DAY); }
  }
  const L = pendOf(subj); L.splice(L.indexOf(pd), 1);
}
function evidence(subj, pd, factor, final) {
  pd.ev = (pd.ev || 0) + 1;
  setPost(subj, pd, unodds(odds(pd.post) * factor));
  if (final && pendOf(subj).indexOf(pd) >= 0) settle(subj, pd);
}
/* 错后看解析的时长(在点「下一题」时调用) */
function dwellEvidence(subj, id, secs) {
  const pd = pendOf(subj).find(x => x.id === id && !x.dw);
  if (!pd) return;
  pd.dw = 1;
  if (secs < 8) evidence(subj, pd, 1.8); else if (secs > 45) evidence(subj, pd, 0.5);
}
/* 没有能力分的记录(老版本、旧备份)重放一遍作答历史,得到能力分 */
function migrateElo() {
  if (S.elo) return;
  S.elo = {};
  Object.keys(S.tp || {}).forEach(subj => Object.keys(S.tp[subj]).forEach(t => S.tp[subj][t].forEach(x => eloUpdate(subj, t, x.lv, x.r))));
}
migrateElo();

/* ───────────── 掌握度 · 预估分 ───────────── */
function tpList(subj, tid) { return ((S.tp[subj] || {})[tid]) || []; }
/* 掌握度 = 做对这个考点一道「典型真题」(该考点真题平均难度)的概率 */
function mastery(subj, tid) { const t = topicsOf(subj).find(x => x.id === tid); return sig(theta(subj, tid) - lvB(t.lv)); }
function leak(subj, t) { return t.w * (1 - mastery(subj, t.id)) * SUBJ[subj].pts; }
function est(subj) {
  return topicsOf(subj).reduce((s, t) => s + t.w * mastery(subj, t.id) * SUBJ[subj].pts, 0);
}
function stage(subj, tid) {
  const n = tpList(subj, tid).length, m = mastery(subj, tid);
  if (n < 1) return { k: 0, name: '未测' };
  if (m < 0.45) return { k: 1, name: '漏洞' };
  if (m < 0.65) return { k: 2, name: '修补中' };
  if (m < 0.82 || n < 8) return { k: 3, name: '稳定' };
  return { k: 4, name: '拿稳' };
}

/* ───────────── 推题引擎:逐题匹配 ─────────────
   不预先排好一组,每答完一题按最新能力挑下一题:
   1. 刚答错 → 紧跟一道同考点、更容易的变式(不是原题,原题 2 天后回来;一组最多 2 道)
   2. 还有没测过的考点 → 摸底(按考频从高到低,近年真题)
   3. 每 3 题插 1 道到期复习(一组最多 3 道)
   4. 连错两题、或每组第 6 题:从最拿手的 3 个考点抽一道「保温」题(弱考点最易的题也只有约 50% 把握,靠它把整组正确率拉回心流区)
   5. 组末压轴:所有测过的考点里,做对把握最接近 45% 的一道难真题
   6. 其余:主攻考点(本组开始时 priority 最高的两个,2:1 交替;priority 见下)
   选题时让 P(做对) 贴近「心流目标」:平时 72%;连对 3 题起调到 62%(加难度);连错 2 题调到 85%(先拿回手感)。 */
function dayKey(t) { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dueCards(subj) {
  const now = Date.now();
  return Object.keys(S.cards).filter(id => S.cards[id].s === subj && S.cards[id].due <= now)
    .sort((a, b) => S.cards[a].due - S.cards[b].due);
}
function flowTarget(cur) {
  const rs = cur.ids.filter(id => cur.ans[id]).map(id => cur.ans[id].ok);
  let win = 0, lose = 0;
  for (let i = rs.length - 1; i >= 0 && rs[i]; i--) win++;
  for (let i = rs.length - 1; i >= 0 && !rs[i]; i--) lose++;
  return lose >= 2 ? 0.85 : win >= 3 ? 0.62 : 0.72;
}
/* 在某考点里挑 P(做对) 最贴近 target 的题;同等时真题优先、近年优先,带一点随机避免每次一样 */
function bestIn(d, subj, tid, target, used, opt) {
  opt = opt || {};
  let best = null, bs = -1e9;
  const now = Date.now();
  const scan = fresh => d.qs.forEach(function (q) {
    if (q.t !== tid || q.skip || used.has(q.id)) return;
    const c = S.cards[q.id];
    if (fresh ? c : (!c || c.due <= now + DAY)) return;      // 旧题只用快到期以外的(到期的走复习通道)
    if (opt.minLv && q.lv < opt.minLv) return;
    if (opt.real && !q.real) return;
    const sc = -Math.abs(pWin(subj, q) - target) * 5 + (q.real ? 0.5 : 0) + ((q.y || 2012) - 2010) / 40 + Math.random() * 0.25
      - (fresh ? 0 : 1 + (now - c.last < 7 * DAY ? 1 : 0));
    if (sc > bs) { bs = sc; best = q; }
  });
  scan(true);
  if (!best && !opt.noReuse) scan(false);
  if (!best && opt.real) return bestIn(d, subj, tid, target, used, Object.assign({}, opt, { real: false }));
  return best;
}
/* 主攻考点优先级 = 漏分 × 不确定加成(做得少的估计不准,值得多看几眼)× 疲劳(最近两组主攻过的降权,免得一直练同一块) */
/* 推送倍数:用户在 AI 教练里说「多推/少推某块」时由 AI 写入 S.bias['科目|考点'] = {f, until, why},到期自动失效 */
function biasOf(subj, tid) { const b = (S.bias || {})[subj + '|' + tid]; return b && b.until > Date.now() ? b.f : 1; }
function priority(subj, t) {
  const n = tpList(subj, t.id).length, recent = ((S.recentFocus || {})[subj] || []);
  const tired = recent.filter(f => f.indexOf(t.id) >= 0).length;
  return leak(subj, t) * (1 + 0.8 / Math.sqrt(n + 1)) * Math.pow(0.6, tired) * biasOf(subj, t.id);
}
function focusTopics(subj) {
  const tested = topicsOf(subj).filter(t => tpList(subj, t.id).length);
  const pool = tested.filter(t => biasOf(subj, t.id) > 0.4);              // 被要求大幅少推的考点不当主攻
  return (pool.length ? pool : tested).sort((a, b) => priority(subj, b) - priority(subj, a)).slice(0, 2).map(t => t.id);
}
function chooseNext(cur, d) {
  const subj = cur.subj, used = new Set(cur.ids), k = cur.ids.length, tgt = flowTarget(cur);
  const pick = (q, tag) => { if (q && tag) (cur.tags = cur.tags || {})[q.id] = tag; return q; };
  if (cur.pendVar) {
    const t = cur.pendVar; cur.pendVar = null;
    const v = bestIn(d, subj, t, 0.85, used, { noReuse: true });
    if (v) { cur.n++; return pick(v, '同类再练'); }
  }
  if (cur.tid) {                                             // 考点专练:只在这个考点里配
    if (k === cur.n - 1) { const b = bestIn(d, subj, cur.tid, 0.45, used, { minLv: 3, noReuse: true }); if (b) { cur.boss = b.id; return pick(b, '压轴'); } }
    return bestIn(d, subj, cur.tid, tgt, used);
  }
  const scout = topicsOf(subj).filter(t => !tpList(subj, t.id).length && !cur.ids.some(id => d.byId[id].t === t.id))
    .sort((a, b) => b.w - a.w);
  if (scout.length) return pick(bestIn(d, subj, scout[0].id, 0.6, used, { real: true }), '摸底');
  if (k % 3 === 1 && (cur.rev || 0) < 3) {
    const due = dueCards(subj).filter(id => !used.has(id) && d.byId[id]);
    if (due.length) { cur.rev = (cur.rev || 0) + 1; return pick(d.byId[due[0]], '复习'); }
  }
  const focus = cur.focus && cur.focus.length ? cur.focus : (cur.focus = focusTopics(subj));
  // 连错两题、本组正确率掉到 60% 以下(隔题插)、或每组第 6 题:去最拿手的几个考点抽一道大概率能做对的(找回手感 + 防遗忘)
  const done = cur.ids.filter(id => cur.ans[id]), acc = done.filter(id => cur.ans[id].ok).length / (done.length || 1);
  if (tgt === 0.85 || k === 5 || (done.length >= 4 && acc < 0.6 && k % 2 === 1)) {
    const warm = topicsOf(subj).filter(t => tpList(subj, t.id).length && focus.indexOf(t.id) < 0)
      .sort((a, b) => mastery(subj, b.id) - mastery(subj, a.id)).slice(0, 3);
    if (warm.length) { const q = bestIn(d, subj, warm[Math.floor(Math.random() * warm.length)].id, 0.85, used); if (q) return pick(q, '保温'); }
  }
  if (k === cur.n - 1) {          // 压轴:在已测过的考点里找一道难真题,做对把握最接近 45%(够得着的挑战,不是送死题)
    let b = null, bd = 1e9;
    topicsOf(subj).filter(t => tpList(subj, t.id).length).forEach(function (t) {
      const q = bestIn(d, subj, t.id, 0.45, used, { minLv: 3, real: true, noReuse: true });
      if (q && Math.abs(pWin(subj, q) - 0.45) < bd) { bd = Math.abs(pWin(subj, q) - 0.45); b = q; }
    });
    if (b) { cur.boss = b.id; return pick(b, '压轴'); }
  }
  const order = focus.length ? focus : topicsOf(subj).map(t => t.id);
  const t = order[k % 3 === 2 && order[1] ? 1 : 0];
  return bestIn(d, subj, t, tgt, used) ||
    topicsOf(subj).map(x => bestIn(d, subj, x.id, tgt, used)).filter(Boolean)[0] || null;
}

/* ───────────── 作答记录 ───────────── */
function record(subj, q, pick, secs) {
  const ok = pick === q.ans, slow = secs > SUBJ[subj].sec * 1.25;
  const r = ok ? (slow ? 0.75 : 1) : 0;
  const c = S.cards[q.id];
  const now = Date.now();
  // 先拿这次作答给同考点存疑的错题当证据:原题隔天复查最有力(定案),同考点别的题次之
  pendOf(subj).filter(pd => pd.t === q.t).forEach(function (pd) {
    if (pd.id === q.id) { if (now - pd.at > 18 * 3600e3) evidence(subj, pd, ok ? EV.reOk : EV.reBad, true); }
    else if (!pd.sib) { pd.sib = 1; evidence(subj, pd, ok ? EV.sibOk : EV.sibBad); }
  });
  const pKnow = pWin(subj, q);
  let st;
  if (!c) st = ok ? (slow ? 2 : 4) : 0;              // 新题一次做对:说明会,很久以后再抽查
  else st = ok ? Math.min(c.st + 1, 5) : 0;
  const days = ok ? IV[Math.max(0, st - 1)] * (slow ? 0.5 : 1) : 2;   // 错题隔 2 天再见,免得靠记答案
  S.cards[q.id] = { s: subj, t: q.t, st: st, due: now + days * DAY, n: (c ? c.n : 0) + 1, ok: (c ? c.ok : 0) + (ok ? 1 : 0),
                    w: (c ? c.w : 0) + (ok ? 0 : 1), last: now, p: pick, kind: ok && c ? c.kind : undefined };
  (S.tp[subj] = S.tp[subj] || {});
  const L = S.tp[subj][q.t] = (S.tp[subj][q.t] || []).concat([{ r: r, lv: q.lv }]).slice(-20);
  if (ok) eloUpdate(subj, q.t, q.lv, r);
  else {
    const T = SUBJ[subj].sec;
    let o = odds(clamp(SLIP * pKnow / (SLIP * pKnow + (1 - pKnow)), 0.02, 0.98));
    if (secs > 0 && secs < T * 0.35) o *= 2.2; else if (secs > T * 1.5) o *= 0.5;
    const post = unodds(o), u = eloUpdate(subj, q.t, q.lv, 0, 1 - post);
    const P = pendOf(subj);
    P.slice().forEach(pd => { if (pd.id === q.id) settle(subj, pd); });
    P.push({ id: q.id, t: q.t, at: now, post: post, full: u.full, fullG: u.fullG, st0: c ? c.st : 0, ev: 0 });
    if (P.length > 40) settle(subj, P[0]);       // 太久没等到证据的,按现有判断定案
  }
  const dk = dayKey();
  S.days[dk] = (S.days[dk] || 0) + 1;
  return { ok: ok, slow: slow, n: L.length };
}

/* ───────────── 通用渲染 ───────────── */
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function typeset(node) {
  if (window.renderMathInElement) {
    window.renderMathInElement(node, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false,
                                       macros: { '\\frac': '\\dfrac' } });
  }
  return node;
}
/* 写作模块(writing.js,从旧站复制)要用的几个全局工具 */
const $app = app;
function el(tag, cls, inner) { const n = document.createElement(tag); if (cls) n.className = cls; if (inner != null) n.innerHTML = inner; return n; }
function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式 */ } }
function themeToggle() { return document.createTextNode(''); }     // 旧站页头的外观按钮、科目切换,这里不需要
function subjectTabs() { return document.createTextNode(''); }
function render() { route(); }
function loadWriting(cb) {
  if (window.renderWriting) { cb(); return; }
  const v = (window.UFILES.v ? '?v=' + window.UFILES.v : '');
  const one = (f, done) => { const t = document.createElement('script'); t.src = f + v; t.onload = done; t.onerror = () => toast('写作内容加载失败'); document.head.append(t); };
  one('writing-data.js', () => one('writing.js', cb));
}

const idle = f => (window.requestIdleCallback || (g => setTimeout(g, 300)))(f);
function html(s) { app.innerHTML = s; typeset(app); window.scrollTo(0, 0); }
/* ───────────── 浮层(弹窗、打印预览)统一管理 ─────────────
   打开时往浏览器历史里压一条记录:手机边缘滑动返回 / 浏览器后退 / Esc / 点 ✕ / 点空白处,都只关掉最上面的浮层,不离开当前页面。
   layer(节点, 关闭时回调) → close(),可多层叠放 */
const LAYERS = [];
let layerMark = false, popSkip = 0;       // layerMark:历史里是否已有一条「浮层占位」;同一时间最多一条,避免连续开关时前进后退错位
function layer(node, onClose) {
  document.body.append(node);
  const L = { node: node, onClose: onClose };
  LAYERS.push(L);
  document.body.classList.add('layered');
  if (!layerMark) { history.pushState({ ultLayer: 1 }, ''); layerMark = true; }
  L.close = function (fromPop) {
    const i = LAYERS.indexOf(L);
    if (i < 0) return;
    LAYERS.splice(i, 1);
    node.remove();
    if (!LAYERS.length) document.body.classList.remove('layered');
    if (onClose) onClose();
    // 全关了才把占位退掉;稍等一下,接着打开的新浮层(比如选择框 → 表单)可以直接沿用这条占位
    if (!fromPop) setTimeout(function () {
      if (!LAYERS.length && layerMark) { layerMark = false; popSkip++; history.back(); }
    }, 0);
  };
  return L.close;
}
window.addEventListener('popstate', function () {
  if (popSkip) { popSkip--; return; }
  if (!layerMark) return;
  layerMark = false;                       // 返回手势用掉了占位
  const L = LAYERS[LAYERS.length - 1];
  if (L) L.close(true);
  if (LAYERS.length) { history.pushState({ ultLayer: 1 }, ''); layerMark = true; }   // 还有下面一层:补回占位
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && LAYERS.length) { e.preventDefault(); LAYERS[LAYERS.length - 1].close(); }
});
/* 弹窗外壳:标题、右上角 ✕、内容可滚动、按钮固定在底部;点空白处关闭 */
function sheet(title, bodyHtml, btnHtml, onClose) {
  const m = el('div', 'modal');
  m.innerHTML = `<div class="sheet dlg"><div class="dlg-h"><b>${esc(title)}</b><a href="#" class="dlg-x" aria-label="关闭">✕</a></div>
    <div class="dlg-c">${bodyHtml}</div>${btnHtml ? `<div class="dlg-b">${btnHtml}</div>` : ''}</div>`;
  const close = layer(m, onClose);
  m.onclick = e => { if (e.target === m) close(); };
  $('.dlg-x', m).onclick = e => { e.preventDefault(); close(); };
  return { node: m, close: close };
}
/* 页内对话框。不用浏览器原生 confirm/prompt:内嵌浏览器和部分 WebView 会直接吞掉(立刻当「取消」),表现为点了没反应。
   ask(文字, {ok, cancel, danger, input, type, ph, title}) → Promise:确认框给 true/false,输入框给字符串/null(关掉=取消) */
function ask(msg, opt) {
  opt = opt || {};
  return new Promise(function (ok) {
    const hasIn = opt.input !== undefined;
    let val = hasIn ? null : false;
    const d = sheet(opt.title || (hasIn ? '输入' : '确认'), `<p>${esc(msg).replace(/\n/g, '<br>')}</p>
      ${hasIn ? `<input class="dlg-in" type="${opt.type || 'text'}" value="${esc(opt.input)}" placeholder="${esc(opt.ph || '')}" autocomplete="off" autocapitalize="off" spellcheck="false">` : ''}`,
      `<button class="ghost" data-v="0">${opt.cancel || '取消'}</button><button class="go sm${opt.danger ? ' danger-b' : ''}" data-v="1">${opt.ok || '确定'}</button>`,
      () => ok(val));
    const inp = $('.dlg-in', d.node);
    const done = v => { val = v; d.close(); };
    d.node.querySelectorAll('[data-v]').forEach(b => b.onclick = () => done(b.dataset.v === '1' ? (inp ? inp.value : true) : (inp ? null : false)));
    if (inp) { setTimeout(() => inp.focus(), 60); inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) done(inp.value); }; }
  });
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'on';
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.className = ''; }, 2600);
}
function fmt(n, d) { return n.toFixed(d === undefined ? 1 : d); }
function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function subjSwitch(route) {
  return '<div class="seg">' + Object.keys(SUBJ).map(k =>
    `<button class="${S.subj === k ? 'on' : ''}" data-subj="${k}" data-route="${route}">${SUBJ[k].name}</button>`).join('') + '</div>';
}
function bar(m, k) { return `<span class="bar k${k}"><i style="width:${k ? Math.round(m * 100) : 0}%"></i></span>`; }   // 没侦察的不画(先验 50% 会误导)

/* ───────────── 首页:丢分账本 ───────────── */
/* 首页极简:科目、一个数、一个按钮。推什么题由引擎决定,不用看清单 */
function viewHome() {
  const subj = S.subj, cf = SUBJ[subj];
  const tested = topicsOf(subj).filter(t => stage(subj, t.id).k).length, all = topicsOf(subj).length;
  const resume = S.cur && S.cur.subj === subj, today = S.days[dayKey()] || 0;
  // 摸底完成前不显示预估分(没测过的考点算出来的分是猜的)
  const num = tested < all ? `<span class="num">${tested}</span><span class="of">/ ${all}</span>`
    : `<span class="num">${fmt(est(subj))}</span><span class="of">/ ${cf.per * cf.pts}</span>`;
  html(`<section class="home">
    ${subjSwitch('home')}
    <div class="big">${num}</div>
    <div class="cap">${tested < all ? '摸底' : '预估'}${today ? ' · 今日 ' + today : ''}</div>
    <button class="go" id="go">${resume ? '继续' : '开始'}</button>
    ${resume ? '<a href="#" id="newg" class="dim sm">换一组</a>' : ''}
  </section>`);
  idle(() => loadData(subj));            // 首页渲染完就在后台把本科题库拉下来,点「开始」直接进
  $('#go').onclick = () => { if (resume) { S.cur.from = '#/'; S.cur.pushed = true; save(); location.hash = '#/s'; } else startTrain(subj); };
  const ng = $('#newg');
  if (ng) ng.onclick = ev => { ev.preventDefault(); S.cur = null; save(); startTrain(subj); };
}

function viewTopic(subj, tid) {
  loadData(subj).then(function (d) {
    const t = d.topic[tid], m = mastery(subj, tid), st = stage(subj, tid), L = tpList(subj, tid);
    const qs = d.qs.filter(q => q.t === tid).sort((a, b) => (b.real || 0) - (a.real || 0) || (b.y || 0) - (a.y || 0) || a.lv - b.lv);
    const done = qs.filter(q => S.cards[q.id]).length;
    html(`<section class="hero slim">
      <a class="back" href="#/bank" id="back">←</a>
      <h1>${t.name}</h1>
      <div class="kv"><span>${st.k ? '掌握 ' + Math.round(m * 100) + '%' : '未测'}</span><span>丢 ${fmt(leak(subj, t))} 分/年</span><span>做过 ${done}/${qs.length}</span></div>
      ${L.length ? `<div class="spark">${L.slice(-20).map(x => `<i class="${x.r >= 1 ? 'y' : x.r > 0 ? 'm' : 'n'}"></i>`).join('')}</div>` : ''}
      <div class="row"><button class="go sm" id="drill">专练 · ${gN()} 题</button><button class="ghost" id="pr">打印</button></div>
    </section>
    <section><ul class="qlist">
      ${qs.map(q => { const c = S.cards[q.id];
        return `<li><a href="#" data-one="${q.id}"><i class="dot ${c ? (c.p === q.ans ? 'y' : 'n') : ''}"></i><span>${q.src}</span>
        ${q.lv >= 4 ? '<em class="lv l4">难</em>' : ''}${q.skip ? '<em>可放弃</em>' : ''}</a></li>`; }).join('')}
    </ul></section>`);
    $('#back').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
    $('#drill').onclick = () => startDyn(subj, { mode: 'topic', tid: tid, title: t.name });
    $('#pr').onclick = () => printAsk(subj, qs.map(q => q.id), t.name, true);
    app.querySelectorAll('[data-one]').forEach(a => a.onclick = function (ev) {
      ev.preventDefault();
      startSession({ mode: 'one', subj: subj, ids: [a.dataset.one], title: t.name });
    });
  });
}

/* ───────────── 做题 ───────────── */
/* 逐题出题的一组(dyn):先只定第一题,后面每答完一题由 chooseNext 现配 */
function startDyn(subj, o) {
  loadData(subj).then(function (d) {
    o = Object.assign({ subj: subj, ids: [], ans: {}, n: gN(), dyn: 1 }, o);
    if (!o.tid) {
      o.focus = focusTopics(subj);
      S.recentFocus = S.recentFocus || {};
      S.recentFocus[subj] = [o.focus].concat(S.recentFocus[subj] || []).slice(0, 2);
    }
    const q = chooseNext(o, d);
    if (!q) { toast('这里的题都做完了'); return; }
    o.ids = [q.id];
    if (!o.title) o.title = topicsOf(subj).some(t => !tpList(subj, t.id).length) ? '摸底' : o.focus.length ? topicName(subj, o.focus[0]) : '练习';
    startSession(o);
  });
}
function startTrain(subj) { startDyn(subj, { mode: 'train' }); }
function startSession(o, sure) {
  if (!o.ids.length) { toast('没有可做的题'); return; }
  const c = S.cur;
  if (!sure && c && o.mode !== 'review' && c.mode !== 'review' && Object.keys(c.ans).length && c.ans && !c.done) {
    ask('「' + c.title + '」还没做完,开始新的会放弃它(已答的题记录保留)。', { ok: '开始新的' }).then(y => { if (y) startSession(o, true); });
    return;
  }
  // 返回规则:记下从哪一页进来的(from)。从结果页「再来一组」进来就顶替结果页那条历史,免得回退时一路翻旧结果
  const here = location.hash || '#/', fromSum = here === '#/sum' && o.mode !== 'review';
  S.cur = Object.assign({ i: 0, ans: {}, est0: est(o.subj), lv0: snapshot(o.subj), t0: Date.now(), combo: 0, best: 0,
                          from: fromSum ? ((S.last || {}).from || '#/') : here, pushed: !fromSum }, o);
  save();
  if (here === '#/s') route();
  else if (fromSum) location.replace('#/s');
  else location.hash = '#/s';
}
/* 离开做题页回到进来的那一页:能用浏览器后退就后退(历史不留做题页),否则直接换过去 */
function leaveSession(clear) {
  const cur = S.cur, to = (cur && cur.from) || '#/';
  if (clear) { S.cur = null; save(); }
  if (cur && cur.pushed && history.length > 1) history.back();
  else location.replace(to);
}
function snapshot(subj) { const o = {}; topicsOf(subj).forEach(t => { o[t.id] = stage(subj, t.id).k; }); return o; }

let tick = null;
function viewSession() {
  const cur = S.cur;
  if (!cur) { location.replace('#/'); return; }
  loadData(cur.subj).then(function (d) {
    if (cur.mode === 'paper' && !cur.done && Date.now() > cur.dl) { submitPaper(); return; }
    const id = cur.ids[cur.i], q = d.byId[id], a = cur.ans[id];
    const reveal = a && (cur.mode !== 'paper' || cur.done);
    if (!a && !cur.qt) cur.qt = Date.now();
    const isBoss = cur.boss === id;
    const opts = q.kind === 'cond' ? COND_OPTS : q.opts;
    const head = `<div class="qhead">
      <a class="x" href="#" id="quit" title="离开(进度保留)">✕</a>
      <div class="dots">${cur.ids.map((x, k) => { const r = cur.ans[x];
        const c = !r ? '' : (cur.mode === 'paper' && !cur.done) ? 'a' : r.skip ? 'u' : r.ok ? 'y' : 'n';
        return `<i class="${c}${k === cur.i ? ' cur' : ''}${cur.boss === x ? ' boss' : ''}" data-go="${k}"></i>`; }).join('')}${
        cur.dyn ? '<i></i>'.repeat(Math.max(0, cur.n - cur.ids.length)) : ''}</div>
      ${cur.mode === 'paper' && !cur.done ? '<a href="#" class="subbtn" id="sub">交卷</a>' : '<span class="clock mono" id="clock"></span>'}</div>`;
    html(`${head}
    <article class="q ${isBoss ? 'isboss' : ''}">
      <div class="meta"><span>${q.src}</span></div>
      <div class="stem">${q.stem}</div>
      ${q.fig ? `<img class="fig" src="${q.fig}" alt="">` : ''}
      ${q.kind === 'cond' ? `<div class="conds"><p>(1) ${q.c1}</p><p>(2) ${q.c2}</p></div>` : ''}
      <div class="opts">${opts.map((o, k) => { const L = LET[k];
        let c = '';
        if (a && a.p === L) c = reveal ? (a.ok ? 'right' : 'wrong') : 'picked';
        if (reveal && q.ans === L && !a.ok) c = 'answer';
        return `<button class="opt ${c}" data-p="${L}" ${reveal ? 'disabled' : ''}><b>${L}</b><span>${o}</span></button>`; }).join('')}</div>
      ${reveal ? `<div class="verdict ${a.ok ? 'ok' : a.skip ? 'skip' : 'bad'}">${a.ok ? '✓' : a.skip ? '未答 · 答案 ' + q.ans : q.ans}
        <span class="mono${a.t > SUBJ[cur.subj].sec * 1.25 ? ' hot' : ''}">${mmss(a.t)}</span>${q.skip ? '<em>可放弃</em>' : ''}</div>
        <div class="sol">${q.sol || ''}</div>
        ${!a.ok && !a.skip && a.p && aiKey() ? '<div class="aiex"><a href="#" id="aiex">AI 讲解</a><div id="aiout"></div></div>' : ''}` : ''}
    </article>
    <footer class="qfoot">
      <button class="ghost" id="prev" ${cur.i ? '' : 'disabled'}>‹</button>
      ${cur.mode === 'paper' && !cur.done ? `<span class="left mono"><span id="left"></span><span class="dim"> · ${cur.ids.filter(x => cur.ans[x]).length}/${cur.ids.length}</span></span>` : ''}
      <button class="go sm" id="next">${nextLabel(cur)}</button>
    </footer>`);
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(b.dataset.p));
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { cur.i = +b.dataset.go; cur.qt = 0; save(); viewSession(); });
    $('#prev').onclick = () => { cur.i--; cur.qt = 0; save(); viewSession(); };
    $('#next').onclick = next;
    const ax = $('#aiex');
    if (ax) {
      if (window.indexedDB) kvGet('ex:' + id + '|' + a.p).then(h => { if (h && $('#aiout')) { ax.remove(); aiExplain(q, a.p, $('#aiout')); } });
      ax.onclick = ev => { ev.preventDefault(); ax.remove(); aiExplain(q, a.p, $('#aiout')); };
    }
    $('#quit').onclick = ev => { ev.preventDefault(); leaveSession(cur.mode === 'review' || cur.mode === 'one'); };
    const sub = $('#sub');
    if (sub) sub.onclick = ev => { ev.preventDefault(); askSubmit(); };
    clearInterval(tick);
    const upd = function () {
      if (cur.mode === 'paper' && !cur.done) {
        const lf = $('#left');
        if (!lf) { clearInterval(tick); return; }
        const left = (cur.dl - Date.now()) / 1000;
        lf.textContent = mmss(left);
        lf.parentNode.classList.toggle('hot', left < 300);
        if (left <= 0) { clearInterval(tick); toast('时间到,已自动交卷'); submitPaper(); }
        return;
      }
      const el = $('#clock');
      if (!el) { clearInterval(tick); return; }
      if (a) { el.textContent = ''; return; }
      const s = (Date.now() - cur.qt) / 1000;
      el.textContent = mmss(s);
      el.className = 'clock mono' + (s > SUBJ[cur.subj].sec ? ' over' : '');
    };
    upd(); tick = setInterval(upd, 1000);
    if (reveal && !a.ok) { const v = $('.verdict'); if (v) setTimeout(() => v.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }
  });
}
function answer(p) {
  const cur = S.cur, d = DATA[cur.subj], id = cur.ids[cur.i], q = d.byId[id];
  const secs = (Date.now() - (cur.qt || Date.now())) / 1000;
  if (cur.mode === 'paper' && !cur.done) {
    cur.ans[id] = { p: p, t: (cur.ans[id] ? cur.ans[id].t : 0) + secs };
    cur.qt = 0;
    if (cur.i < cur.ids.length - 1) cur.i++;
    save(); viewSession(); return;
  }
  if (cur.ans[id]) return;
  const r = record(cur.subj, q, p, secs);
  cur.ans[id] = { p: p, ok: r.ok, t: secs, at: Date.now() };
  // 错了:下一题紧跟一道同考点的变式(由 chooseNext 配),每组最多 3 道;摸底时不加
  if (!r.ok && cur.dyn && (cur.tags || {})[id] !== '摸底' && (cur.extra || 0) < 2) { cur.pendVar = q.t; cur.extra = (cur.extra || 0) + 1; }
  cur.combo = r.ok ? cur.combo + 1 : 0;
  cur.best = Math.max(cur.best, cur.combo);
  cur.qt = 0;
  save(); viewSession();
}
function next() {
  const cur = S.cur;
  if (cur.mode === 'paper' && !cur.done && cur.i === cur.ids.length - 1) {
    const k = cur.ids.findIndex(x => !cur.ans[x]);
    if (k >= 0) { cur.i = k; cur.qt = 0; save(); viewSession(); return; }       // 最后一题按钮:有没答的先带过去
    askSubmit(); return;
  }
  const a0 = cur.ans[cur.ids[cur.i]];
  if (a0 && !a0.ok && a0.at && cur.mode !== 'paper' && cur.mode !== 'review') { dwellEvidence(cur.subj, cur.ids[cur.i], (Date.now() - a0.at) / 1000); a0.at = 0; }
  if (cur.i < cur.ids.length - 1) { cur.i++; cur.qt = 0; save(); viewSession(); return; }
  if (cur.dyn && cur.ids.length < cur.n) {                 // 逐题出题:先答完这题,再按最新能力配下一题
    if (!cur.ans[cur.ids[cur.i]]) { toast('先选一个答案'); return; }
    const q = chooseNext(cur, DATA[cur.subj]);
    if (q) { cur.ids.push(q.id); cur.i++; cur.qt = 0; save(); viewSession(); return; }
  }
  if (cur.mode === 'review' || cur.mode === 'one') { leaveSession(true); return; }
  if (cur.mode !== 'paper' && cur.ids.some(id => !cur.ans[id])) {
    cur.i = cur.ids.findIndex(id => !cur.ans[id]); save(); viewSession(); toast('还有题没做'); return;
  }
  finish();
}
function finish() {
  const cur = S.cur;
  const sum = { subj: cur.subj, mode: cur.mode, title: cur.title, ids: cur.ids, ans: cur.ans, est0: cur.est0, est1: est(cur.subj),
                lv0: cur.lv0, best: cur.best, boss: cur.boss, pid: cur.pid, at: Date.now(), dur: (Date.now() - cur.t0) / 1000 };
  S.hist.unshift({ subj: sum.subj, title: sum.title, n: cur.ids.length, ok: cur.ids.filter(id => (cur.ans[id] || {}).ok).length,
                   d0: sum.est0, d1: sum.est1, at: sum.at, mode: cur.mode });
  S.hist = S.hist.slice(0, 200);
  sum.from = cur.from;
  S.last = sum; S.cur = null; save();
  autoSnap();
  location.replace('#/sum');
}

/* ───────────── 实战套卷 ───────────── */
/* 题库:按套卷、按考点两种找法;都能做、能打印 */
function viewBank() {
  const subj = S.subj;
  const ts = topicsOf(subj);
  const tab = S.bankTab || 'papers';
  html(`<a href="#/me" class="back" id="bback">← 我的</a>
  <section class="slim bank-h">${subjSwitch('bank')}
    <div class="seg sm2">${[['papers', '套卷'], ['topics', '考点']].map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-tab="${x[0]}">${x[1]}</button>`).join('')}</div></section>
  ${tab === 'papers' ? `<section class="papers">${META[subj].papers.map(p => { const r = S.papers[p.id];
    return `<div class="paper"><b>${p.y || p.name}</b><span class="mono dim">${r ? r.best + '/' + p.n * SUBJ[subj].pts : ''}</span>
      <span class="acts"><a href="#" data-start="${p.id}">做</a><a href="#" data-print="${p.id}">打印</a></span></div>`; }).join('')}</section>`
  : `<section class="ledger">${ts.map(t => { const st = stage(subj, t.id);
    const bf = biasOf(subj, t.id);
    return `<a class="lr${st.k === 1 ? ' weak' : ''}" href="#/t/${subj}/${t.id}"><span class="nm">${t.name}${bf > 1 ? ' <i class="bias">↑</i>' : bf < 1 ? ' <i class="bias">↓</i>' : ''}</span>
      <span>${bar(mastery(subj, t.id), st.k)}</span><span class="mono lk">${t.n}</span></a>`; }).join('')}</section>`}`);
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.bankTab = b.dataset.tab; save(); viewBank(); });
  $('#bback').onclick = ev => { if (navCount > 1) { ev.preventDefault(); history.back(); } };
  app.querySelectorAll('[data-start]').forEach(b => b.onclick = ev => { ev.preventDefault(); startPaper(subj, b.dataset.start); });
  app.querySelectorAll('[data-print]').forEach(b => b.onclick = function (ev) {
    ev.preventDefault();
    loadData(subj).then(d => { const p = d.papers.find(x => x.id === b.dataset.print); printAsk(subj, p.ids, p.name, false); });
  });
}
function startPaper(subj, pid) {
  loadData(subj).then(function (d) {
    const p = d.papers.find(x => x.id === pid);
    startSession({ mode: 'paper', subj: subj, ids: p.ids, pid: pid, title: p.name, dl: Date.now() + p.min * 60000 });
  });
}
function nextLabel(cur) {
  const last = cur.i === cur.ids.length - 1 && !(cur.dyn && cur.ids.length < cur.n);
  if (!last) return '下一题';
  if (cur.mode !== 'paper' || cur.done) return '完成';
  const left = cur.ids.filter(x => !cur.ans[x]).length;
  return left ? '去第 ' + (cur.ids.findIndex(x => !cur.ans[x]) + 1) + ' 题(未答 ' + left + ')' : '交卷';
}
/* 交卷前说清楚还有几题没答;取消就带到第一道没答的题 */
function askSubmit() {
  const cur = S.cur, left = cur.ids.filter(x => !cur.ans[x]);
  const msg = left.length ? '还有 ' + left.length + ' 题没答。\n没答的按 0 分算,但不算「不会」:不计入掌握度,也不进错题。\n确定交卷?' : '确定交卷?';
  ask(msg, { ok: '交卷', cancel: left.length ? '回去作答' : '取消' }).then(function (y) {
    if (y) { submitPaper(); return; }
    if (left.length && S.cur === cur) { cur.i = cur.ids.indexOf(left[0]); cur.qt = 0; save(); viewSession(); }
  });
}
function submitPaper() {
  const cur = S.cur, d = DATA[cur.subj];
  if (!cur || cur.done) return;
  cur.ids.forEach(function (id) {
    const a = cur.ans[id], q = d.byId[id];
    if (!a) { cur.ans[id] = { p: '', ok: false, t: 0, skip: 1 }; return; }     // 没答 ≠ 不会:不记作答、不动能力分
    a.ok = record(cur.subj, q, a.p, a.t).ok;
  });
  cur.done = true;
  const score = cur.ids.filter(id => cur.ans[id].ok).length * SUBJ[cur.subj].pts;
  const r = S.papers[cur.pid] || { best: 0, n: 0 };
  S.papers[cur.pid] = { best: Math.max(r.best, score), n: r.n + 1, last: score, at: Date.now() };
  finish();
}

/* ───────────── 一组结束 ───────────── */
function viewSum() {
  const s = S.last;
  if (!s) { location.replace('#/'); return; }
  loadData(s.subj).then(function (d) {
    const n = s.ids.length, ok = s.ids.filter(id => (s.ans[id] || {}).ok).length, delta = s.est1 - s.est0;
    const pts = SUBJ[s.subj].pts;
    const ups = topicsOf(s.subj).filter(t => (s.lv0 || {})[t.id] !== undefined && stage(s.subj, t.id).k > s.lv0[t.id] && s.lv0[t.id] > 0);
    const found = topicsOf(s.subj).filter(t => s.lv0 && s.lv0[t.id] === 0 && stage(s.subj, t.id).k > 0);
    const slow = s.ids.filter(id => (s.ans[id] || {}).ok && s.ans[id].t > SUBJ[s.subj].sec * 1.25).length;
    const bossA = s.boss && s.ans[s.boss];
    const scouting = topicsOf(s.subj).some(t => !stage(s.subj, t.id).k);
    html(`<section class="home">
      <div class="big">${s.mode === 'paper' ? `<span class="num">${ok * pts}</span><span class="of">/ ${n * pts}</span>`
        : scouting ? `<span class="num">${ok}</span><span class="of">/ ${n}</span>`
        : `<span class="num">${fmt(s.est1)}</span><span class="of">${Math.abs(delta) >= 0.05 ? (delta > 0 ? '+' : '') + fmt(delta) : ''}</span>`}</div>
      <div class="cap">${s.mode === 'paper' ? '对 ' + ok + ' / ' + n + (s.ids.some(id => (s.ans[id] || {}).skip) ? ' · 未答 ' + s.ids.filter(id => (s.ans[id] || {}).skip).length : '') : scouting ? '摸底' : ok + '/' + n}</div>
      <button class="go" id="again">${s.mode === 'paper' ? '返回' : '继续'}</button>
      <div class="links"><a href="#" id="rv">回看</a><a href="#" id="pr">打印</a></div>
    </section>`);
    $('#again').onclick = () => { if (s.mode === 'paper') location.replace('#/bank'); else startTrain(s.subj); };
    $('#pr').onclick = ev => { ev.preventDefault(); printAsk(s.subj, s.ids, s.title, false); };
    const review = k => { startSession({ mode: 'review', subj: s.subj, ids: s.ids, title: '回看 · ' + s.title, done: true });
                          S.cur.ans = s.ans; S.cur.i = k; S.cur.boss = s.boss; save(); viewSession(); };
    $('#rv').onclick = ev => { ev.preventDefault(); review(Math.max(0, s.ids.findIndex(id => !(s.ans[id] || {}).ok))); };
  });
}

/* ───────────── 记录 · 设置 ───────────── */
/* 我的:iOS「设置」式分组列表——上面两个数,下面一组组圆角卡片,每行左名右值 */
function viewMe() {
  const subj = S.subj, cf = SUBJ[subj];
  const wrong = Object.keys(S.cards).filter(id => S.cards[id].s === subj && S.cards[id].w > 0 && S.cards[id].st < 3 && S.cards[id].kind !== 'slip');
  const done = Object.keys(S.cards).filter(id => S.cards[id].s === subj).length;
  const row = (id, label, val, cls) => `<a href="#" class="row-i${cls ? ' ' + cls : ''}" id="${id}"><span>${label}</span><span class="v">${val || ''}</span></a>`;
  html(`<section class="slim">${subjSwitch('me')}</section>
  <section class="stats"><div><b>${done}</b><span>做过</span></div><div><b>${wrong.length}</b><span>待攻克错题</span></div></section>
  <div class="grp-h">题库</div>
  <div class="grp">${row('bkp', '真题套卷', META[subj].papers.length + ' 套', 'chev')}${row('bkt', '按考点', topicsOf(subj).length + ' 个', 'chev')}</div>
  <div class="grp-h">错题</div>
  <div class="grp">${row('redo', '重做错题', wrong.length ? Math.min(wrong.length, gN()) + ' 题' : '', wrong.length ? 'chev' : 'off')}
    ${row('prw', '打印错题', '', wrong.length ? 'chev' : 'off')}</div>
  <div class="grp-h">AI 设置</div>
  <div class="grp">${row('aiprov', '服务商', PROV()[AI.provider].name, 'chev')}${row('aikey', 'API Key', AI.keys[AI.provider] ? '已设置' : builtinKey(AI.provider) ? '内置' : '未设置', 'chev')}
    ${row('airem', '记住 Key', AI.remember ? '记住' : '关闭网页即清除', 'chev')}
    ${row('aimodel', '模型', MODELS()[AI.model][0], 'chev')}${row('aibud', '每日上限', kTok(AI.budget) + ' token', 'chev')}
    <div class="row-i"><span>今日已用</span><span class="v">${kTok(aiToday().in + aiToday().out)} · 约 ${yuan(aiToday().usd)}</span></div></div>
  <div class="grp-h">目标分</div>
  <div class="grp">
    <label class="row-i"><span>数学</span><span class="v"><input type="number" inputmode="numeric" id="tm" min="20" max="75" value="${S.target.math}"> / 75</span></label>
    <label class="row-i"><span>逻辑</span><span class="v"><input type="number" inputmode="numeric" id="tl" min="20" max="60" value="${S.target.logic}"> / 60</span></label></div>
  <div class="grp-h">数据</div>
  <div class="grp">${row('ex', '导出备份', S.lastBackup ? ago(S.lastBackup) : '从未', 'chev')}${row('im', '从备份恢复', '', 'chev')}</div>
  <div class="grp-h">本机自动备份 · 每天一份,留 7 天</div>
  <div class="grp" id="snaps"><div class="row-i off"><span>读取中…</span></div></div>
  <div class="grp danger-g">${row('rs', '清空记录', '', 'danger')}</div>`);
  app.querySelectorAll('a.row-i').forEach(a => a.addEventListener('click', ev => ev.preventDefault()));
  const num = (el, k, f) => { el.onchange = () => { const v = Math.round(+el.value); if (v > 0) { f(v); save(); toast('已保存'); } }; };
  num($('#tm'), 'm', v => { S.target.math = Math.min(75, v); });
  num($('#tl'), 'l', v => { S.target.logic = Math.min(60, v); });
  $('#redo').onclick = () => wrong.length && loadData(S.subj).then(() => startSession({ mode: 'redo', subj: S.subj, title: '错题重做',
    ids: wrong.sort((a, b) => S.cards[a].due - S.cards[b].due).slice(0, gN()) }));
  $('#prw').onclick = () => wrong.length && printAsk(S.subj, wrong, SUBJ[S.subj].name + '错题', false);
  $('#bkp').onclick = () => { S.bankTab = 'papers'; save(); location.hash = '#/bank'; };
  $('#bkt').onclick = () => { S.bankTab = 'topics'; save(); location.hash = '#/bank'; };
  $('#aikey').onclick = () => askKey().then(viewMe);
  $('#airem').onclick = () => { AI.remember = !AI.remember; saveAI(); viewMe(); toast(AI.remember ? 'Key 会保存在本机浏览器' : 'Key 只在本次打开有效'); };
  $('#aimodel').onclick = () => { const ks = Object.keys(MODELS()).filter(k => MODELS()[k][3] === AI.provider); AI.model = ks[(ks.indexOf(AI.model) + 1) % ks.length]; saveAI(); viewMe(); };
  $('#aiprov').onclick = () => pickProvider().then(viewMe);
  $('#aibud').onclick = () => ask('每天最多用多少万 token?', { input: String(AI.budget / 10000), type: 'number' }).then(v => { if (v && +v > 0) { AI.budget = Math.round(+v * 10000); saveAI(); viewMe(); } });
  $('#ex').onclick = exportBackup;
  $('#im').onclick = importBackup;
  fillSnaps();
  $('#rs').onclick = () => ask('清空全部做题记录?不可恢复(建议先导出备份)。', { ok: '清空', danger: true }).then(y => { if (y) { S = fresh(); save(); route(); } });
}

/* ───────────── 备份 ─────────────
   导出:Mac 上的 Chrome / Edge(有文件夹接口)→ 第一次选一个上级目录,自动在里面建「Ultimate 备份」并记住,之后直接写入;
         iPhone Safari → 系统分享面板(选「存储到文件」,iOS 默认放回上次的文件夹);都不行就普通下载。文件名都自动带日期时间。
   恢复:有文件夹接口的直接读该文件夹里最新一份;否则打开系统文件选择器(「最近项目」里刚存的排最前)。
   另外每天在本机 IndexedDB 存一份快照,留 7 天,「我的」里一点就能恢复。 */
const BK_DIR = 'Ultimate 备份';
function ago(t) { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? '今天' : d === 1 ? '昨天' : d + ' 天前'; }
function bkName() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `Ultimate备份_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
}
function idb() {
  return idb.p = idb.p || new Promise(function (ok, no) {
    const r = indexedDB.open('ultimate', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
const kvDo = (mode, f) => idb().then(db => new Promise(ok => { const t = db.transaction('kv', mode), q = f(t.objectStore('kv'));
  t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => ok(undefined); }));
const kvGet = k => kvDo('readonly', st => st.get(k));
const kvSet = (k, v) => kvDo('readwrite', st => st.put(v, k));
const kvDel = k => kvDo('readwrite', st => st.delete(k));
/* 拿到「Ultimate 备份」文件夹(有读写权限);ask=false 时不弹选择框 */
async function bkFolder(ask) {
  let root = await kvGet('bkRoot');
  if (root) {
    let perm = await root.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await root.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') root = null;
  }
  if (!root) {
    if (!ask) return null;
    toast('选一个放备份的位置(比如「文稿」),会在里面自动建「' + BK_DIR + '」');
    root = await window.showDirectoryPicker({ id: 'ultimate-backup', mode: 'readwrite', startIn: 'documents' });
    await kvSet('bkRoot', root);
  }
  return root.name === BK_DIR ? root : root.getDirectoryHandle(BK_DIR, { create: true });
}
async function exportBackup(ev) {
  if (ev) ev.preventDefault();
  const name = bkName(), json = JSON.stringify({ app: 'ultimate', at: new Date().toISOString(), S: S });
  const done = msg => { S.lastBackup = Date.now(); save(); if (msg) toast(msg); if (location.hash === '#/me') viewMe(); };
  try {
    if (window.showDirectoryPicker) {
      const dir = await bkFolder(true);
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(json); await w.close();
      return done('已存到「' + BK_DIR + '」:' + name);
    }
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return done(); }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; a.click();
  done('已下载:' + name);
}
async function importBackup(ev) {
  if (ev) ev.preventDefault();
  try {
    if (window.showDirectoryPicker) {
      const dir = await bkFolder(true);
      let best = null;
      for await (const [n, h] of dir.entries()) if (h.kind === 'file' && /^Ultimate备份_.*\.json$/.test(n) && (!best || n > best.n)) best = { n: n, h: h };
      if (!best) { toast('「' + BK_DIR + '」里还没有备份'); return; }
      return applyBackup(await (await best.h.getFile()).text(), best.n);
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => inp.files[0] && inp.files[0].text().then(t => applyBackup(t, inp.files[0].name)).catch(() => toast('文件读不了'));
  inp.click();
}
function restoreS(data) { S = Object.assign(fresh(), data); if (!data.elo) { S.elo = null; migrateElo(); } save(); route(); }
function applyBackup(text, name) {
  let d;
  try { d = JSON.parse(text); } catch (e) { toast('不是 Ultimate 的备份文件'); return; }
  if (d.app !== 'ultimate' || !d.S) { toast('不是 Ultimate 的备份文件'); return; }
  const n = Object.keys(d.S.cards || {}).length;
  ask('用「' + name + '」恢复?\n备份时间 ' + new Date(d.at).toLocaleString('zh-CN') + ',做过 ' + n + ' 题。\n当前记录会被覆盖。', { ok: '恢复' })
    .then(y => { if (y) { restoreS(d.S); toast('已恢复'); } });
}
/* 本机快照:每天一份(当天内后来的覆盖前面的),留最近 7 天 */
async function autoSnap() {
  if (!window.indexedDB || !Object.keys(S.cards).length) return;
  try {
    const k = dayKey(), list = (await kvGet('snaps')) || [];
    await kvSet('snap:' + k, { at: Date.now(), n: Object.keys(S.cards).length, S: JSON.parse(JSON.stringify(Object.assign({}, S, { cur: null }))) });
    if (list.indexOf(k) < 0) list.unshift(k);
    for (const old of list.splice(7)) await kvDel('snap:' + old);
    await kvSet('snaps', list);
  } catch (e) { /* 隐私模式等存不了就算了 */ }
}
async function fillSnaps() {
  const box = $('#snaps');
  if (!box) return;
  const list = window.indexedDB ? ((await kvGet('snaps')) || []) : [];
  const snaps = (await Promise.all(list.map(k => kvGet('snap:' + k).then(v => v && Object.assign({ k: k }, v))))).filter(Boolean);
  if (!$('#snaps')) return;
  box.innerHTML = snaps.length ? snaps.map(x => { const d = new Date(x.at);
    return `<a href="#" class="row-i chev" data-snap="${x.k}"><span>${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span><span class="v">${x.n} 题</span></a>`; }).join('')
    : '<div class="row-i off"><span>还没有,做完一组后自动生成</span></div>';
  box.querySelectorAll('[data-snap]').forEach(a => a.onclick = async function (ev) {
    ev.preventDefault();
    const x = await kvGet('snap:' + a.dataset.snap);
    if (x && await ask('恢复到 ' + new Date(x.at).toLocaleString('zh-CN') + ' 的记录(做过 ' + x.n + ' 题)?当前记录会被覆盖。', { ok: '恢复' })) { restoreS(x.S); toast('已恢复'); }
  });
}

/* ───────────── AI 教练(Claude API,浏览器直连,官方 SDK 打包在 vendor/anthropic-sdk-1.0.0.mjs) ─────────────
   Key 只存本机 localStorage 'ult.ai.v1'(不进备份),只发给 api.anthropic.com。
   省 token:每日 token 上限、每次 max_tokens 封顶、effort 默认 low、学情发压缩摘要、讲解结果缓存、
   对话超过约 1.2 万 token 或隔 6 小时自动开新对话、同一时间只发一个请求。
   对话只追加不改写(思考块绑定对话前缀,改历史会被拒),学情变化时把新摘要附在新的一条消息里。
   AI 能调 4 个工具改网站:推送倍数、组练习、出打印、目标分;练习和打印只生成按钮,用户点了才执行。 */
/* 服务商与模型。内置 DeepSeek(默认)和 Anthropic;「添加其他服务商」可以接任何 Anthropic 兼容接口(填地址、模型名、价格、Key)。
   模型表:[显示名, 输入 $/百万, 输出 $/百万, 服务商, 缓存命中相对输入价, 实际模型 id(自定义的才有)]。
   非 Anthropic 官方的一律走「兼容模式」:非 beta 通道、工具去掉 strict、不发 cache_control / fallbacks。DeepSeek 价格按高峰价记(偏保守) */
const AI_MODELS = { 'deepseek-flash': ['DeepSeek Flash', 0.3, 1.2, 'deepseek', 0.02], 'deepseek-v4-pro': ['DeepSeek V4 Pro', 1.32, 3.96, 'deepseek', 0.033],
  'claude-opus-5-5': ['Opus 5.5', 4, 20, 'anthropic', 0.1], 'claude-sonnet-5-5': ['Sonnet 5.5', 2, 10, 'anthropic', 0.1],
  'claude-haiku-5-5': ['Haiku 5.5', 0.1, 0.5, 'anthropic', 0.1] };
const AI_PROV = { deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/anthropic', hint: 'sk-…' },
  anthropic: { name: 'Anthropic', base: undefined, hint: 'sk-ant-…', official: true } };
const AIK = 'ult.ai.v1', AICK = 'ult.aichat.v1';
let AI = Object.assign({ keys: {}, provider: 'deepseek', model: 'deepseek-flash', effort: 'low', budget: 100000, fallback: true, used: {}, remember: true, custom: [] }, load(AIK, {}));
if (AI.key) { AI.keys.anthropic = AI.key; delete AI.key; }        // 旧版只有一个 Key
/* 「记住 Key」关掉时 Key 只放在 sessionStorage(关掉网页即清除),localStorage 里不存 */
try { if (!AI.remember) AI.keys = JSON.parse(sessionStorage.getItem(AIK + '.keys') || '{}'); } catch (e) { /* 无痕模式 */ }
function PROV() { const o = Object.assign({}, AI_PROV); AI.custom.forEach(c => { o[c.id] = { name: c.name, base: c.base, hint: 'API Key' }; }); return o; }
function MODELS() { const o = Object.assign({}, AI_MODELS); AI.custom.forEach(c => { o[c.id + ':' + c.model] = [c.model, c.pin, c.pout, c.id, 0.1, c.model]; }); return o; }
/* 内置 Key:ultimate/ai-key.js 里的 window.ULT_KEYS = { deepseek: '…' }(本地文件,不要上传到公开网站);本机填的 Key 优先 */
const builtinKey = pv => ((window.ULT_KEYS || {})[pv] || '').trim();
const aiKey = () => AI.keys[AI.provider] || builtinKey(AI.provider);
/* 按格式认 Key 是哪家的:Anthropic 是 sk-ant-…,DeepSeek 是 sk- 加一串十六进制 */
const keyKind = k => /^sk-ant-/.test(k) ? 'anthropic' : /^sk-[0-9a-f]{16,}$/i.test(k) ? 'deepseek' : '';
const firstModel = pv => Object.keys(MODELS()).find(m => MODELS()[m][3] === pv);
if (!PROV()[AI.provider] || !MODELS()[AI.model]) { AI.provider = 'deepseek'; AI.model = 'deepseek-flash'; }
const saveAI = () => {
  store(AIK, Object.assign({}, AI, { keys: AI.remember ? AI.keys : {} }));
  try { if (AI.remember) sessionStorage.removeItem(AIK + '.keys'); else sessionStorage.setItem(AIK + '.keys', JSON.stringify(AI.keys)); } catch (e) { /* 无痕模式 */ }
};
/* 放错服务商的 Key(比如 DeepSeek 的 Key 存在 Anthropic 下)挪到对的位置,并切换过去 */
(function fixKeys() {
  let moved = '';
  Object.keys(AI.keys).forEach(function (pv) {
    const k = AI.keys[pv], kind = keyKind(k || '');
    if (k && kind && kind !== pv && !AI.keys[kind]) { AI.keys[kind] = k; delete AI.keys[pv]; moved = kind; }
  });
  if (moved) { AI.provider = moved; AI.model = firstModel(moved); saveAI(); setTimeout(() => toast('检测到 ' + PROV()[moved].name + ' 的 Key,已切换服务商'), 800); }
})();
let CHAT = load(AICK, null) || { msgs: [], view: [], tok: 0, at: 0, snap: '' };
const saveChat = () => store(AICK, CHAT);
let aiBusy = false;
function aiToday() { return AI.used[dayKey()] || { in: 0, out: 0, usd: 0 }; }
function kTok(n) { return n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
async function aiCall(body, maxTokens) {
  if (!aiKey()) throw new Error('先在「我的 → API Key」里填入你的 ' + PROV()[AI.provider].name + ' API Key');
  const u = aiToday();
  if (u.in + u.out >= AI.budget) throw new Error('今天的 AI 额度(' + kTok(AI.budget) + ' token)用完了,明天再来,或在「我的」里调高上限');
  if (aiBusy) throw new Error('上一个请求还没回来');
  aiBusy = true;
  try {
    const A = (await import('./vendor/anthropic-sdk-1.0.0.mjs')).default;
    const pv = PROV()[AI.provider], ds = !pv.official;              // ds:兼容模式(DeepSeek 和自定义服务商)
    const client = new A({ apiKey: aiKey(), baseURL: pv.base, dangerouslyAllowBrowser: true, maxRetries: 1 });
    const req = Object.assign({ model: MODELS()[AI.model][5] || AI.model, max_tokens: maxTokens, output_config: { effort: AI.effort } }, body);
    if (!ds) req.cache_control = { type: 'ephemeral' };
    if (ds && req.tools) req.tools = req.tools.map(t => { const c = Object.assign({}, t); delete c.strict; return c; });
    if (!ds && AI.fallback && AI.model !== 'claude-haiku-5-5') { req.betas = ['server-side-fallback-2026-07-01']; req.fallbacks = 'default'; }   // 被安全策略拒绝时服务端换模型重试
    let res;
    try { res = await (ds ? client.messages : client.beta.messages).create(req); }     // 兼容模式不走 beta 通道
    catch (e) {
      if (e instanceof A.AuthenticationError) {
        const kind = keyKind(aiKey());
        throw new Error(kind && kind !== AI.provider ? '这个 Key 看起来是 ' + PROV()[kind].name + ' 的,服务商却选的是 ' + PROV()[AI.provider].name + ',去「我的 → 服务商」换一下'
          : PROV()[AI.provider].name + ' 说这个 Key 不对或已失效(401),去控制台确认一下 Key');
      }
      if (e instanceof A.PermissionDeniedError) throw new Error('这个 Key 没有权限用 ' + MODELS()[AI.model][0]);
      if (e instanceof A.APIError && e.status === 402) throw new Error(PROV()[AI.provider].name + ' 账户余额不足');
      if (e instanceof A.RateLimitError) throw new Error('请求太频繁或账户额度不足,稍后再试');
      if (e instanceof A.APIConnectionError) throw new Error('连不上 ' + PROV()[AI.provider].name + '(检查网络)');
      if (e instanceof A.APIError) { const er = new Error('接口错误 ' + (e.status || '') + ':' + (e.message || '')); er.status = e.status; throw er; }
      throw e;
    }
    const us = res.usage || {}, pr = MODELS()[AI.model];
    const tin = (us.input_tokens || 0) + (us.cache_creation_input_tokens || 0) + (us.cache_read_input_tokens || 0), tout = us.output_tokens || 0;
    const d = AI.used[dayKey()] = aiToday();
    d.in += tin; d.out += tout;
    d.usd += ((us.input_tokens || 0) + (us.cache_creation_input_tokens || 0) * 1.25 + (us.cache_read_input_tokens || 0) * pr[4]) * pr[1] / 1e6 + tout * pr[2] / 1e6;
    Object.keys(AI.used).sort().slice(0, -14).forEach(k => delete AI.used[k]);
    saveAI();
    res._tin = tin;
    return res;
  } finally { aiBusy = false; }
}
const aiText = res => res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
/* AI 回复的轻量排版:**粗体**、- 列表、换行;公式 $...$ 交给 KaTeX */
function mdLite(t) {
  return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').split('\n').map(l => /^\s*[-•]\s+/.test(l) ? '<li>' + l.replace(/^\s*[-•]\s+/, '') + '</li>' : l)
    .join('\n').replace(/(<li>[\s\S]*?<\/li>)(?!\n<li>)/g, '$1').replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>').replace(/\n/g, '<br>').replace(/<\/li><br>/g, '</li>').replace(/<ul><br>|<br><\/ul>/g, m => m.replace('<br>', ''));
}

/* 学情摘要(约 600 token):每个考点一行 */
function aiSnapshot() {
  const L = [], now = Date.now();
  ['math', 'logic'].forEach(function (subj) {
    const ts = topicsOf(subj), cf = SUBJ[subj], tested = ts.filter(t => tpList(subj, t.id).length).length;
    L.push(`[${cf.name}] ${tested < ts.length ? '摸底 ' + tested + '/' + ts.length : '预估 ' + fmt(est(subj)) + '/' + cf.per * cf.pts} · 目标 ${S.target[subj]}`);
    ts.forEach(function (t) {
      const n = tpList(subj, t.id).length, cs = Object.values(S.cards).filter(c => c.s === subj && c.t === t.id);
      const gap = cs.filter(c => c.w > 0 && c.st < 3 && c.kind !== 'slip').length, slip = cs.filter(c => c.kind === 'slip').length, bf = biasOf(subj, t.id);
      const b = (S.bias || {})[subj + '|' + t.id];
      L.push(`${t.id} ${t.name}|考频${t.w}|${n ? '掌握' + Math.round(mastery(subj, t.id) * 100) + '%|做' + n : '未测'}${gap ? '|待攻克' + gap : ''}${slip ? '|失误' + slip : ''}${bf !== 1 ? '|推送×' + bf + '(剩' + Math.ceil((b.until - now) / DAY) + '天)' : ''}`);
    });
    const ps = META[subj].papers.filter(p => S.papers[p.id]).map(p => p.id + ' 最好' + S.papers[p.id].best + '/' + p.n * cf.pts);
    if (ps.length) L.push('套卷:' + ps.join(','));
  });
  const days = [];
  for (let k = 6; k >= 0; k--) days.push(S.days[dayKey(now - k * DAY)] || 0);
  L.push('近7天题量:' + days.join(','));
  const hs = S.hist.slice(0, 5).map(h => SUBJ[h.subj].name + h.title + ' ' + h.ok + '/' + h.n);
  if (hs.length) L.push('最近几组:' + hs.join(';'));
  return L.join('\n');
}

const AI_SYS = `你是 Ultimate 管综刷题站里的私人教练,有权直接操作这个网站。学员备考管理类联考(数学 75 分、逻辑 60 分),有基础,追求提分效率。
每段对话开头会附:学员的长期记忆(你之前记下的)、学情摘要;数据变化后会再附新摘要。字段:考频=平均每套卷考几题;掌握=做对该考点典型难度真题的概率;待攻克=判定为真不会或还在观察的错题;失误=系统根据作答行为判定为会做但手滑的错题;推送×=当前推送倍数(0=暂停)。
做事方式:学员要求什么就直接用工具做,不要反问确认;要具体分析某块时,先用 get_wrong_questions / get_topic_detail 看真实题目和记录再下结论,不凭空猜。你判断某块该调整时可以直接调整,并说明理由。学员透露的偏好、作息、目标、反复出现的薄弱点,用 remember 记下(简短),过时的用 forget 删掉。
回答:中文,直接、具体,只依据数据,不编造。一般 200 字以内;要报告时不超过 600 字。不用表格,公式用 $...$。操作完一句话说明做了什么。
套卷 id:数学 m+年份(m2010–m2025)、全真模拟 mk1–mk8;逻辑 l+年份(l2020–l2026)。考点 id 见学情摘要每行开头;题目 id 从 get_wrong_questions 得到。`;
const USD_CNY = 7.1;        // 估算用汇率
const yuan = usd => '¥' + (usd * USD_CNY).toFixed(usd * USD_CNY < 1 ? 3 : 2);
function aiTools() {
  const tids = topicsOf('math').concat(topicsOf('logic')).map(t => t.id);
  const pids = META.math.papers.concat(META.logic.papers).map(p => p.id).concat(['']);
  const subject = { type: 'string', enum: ['math', 'logic'] }, topics = { type: 'array', items: { type: 'string', enum: tids } };
  const obj = (props, req) => ({ type: 'object', additionalProperties: false, required: req || Object.keys(props), properties: props });
  const pick = (desc) => obj({ subject: subject, source: { type: 'string', enum: ['wrong', 'topic', 'paper'], description: 'wrong=待攻克错题;topic=考点里的题;paper=整套卷' },
    topic_ids: Object.assign({ description: '限定的考点,空数组=不限' }, topics), paper_id: { type: 'string', enum: pids, description: 'source=paper 时填,否则空字符串' },
    count: { type: 'integer', description: desc } });
  const T = (name, description, input_schema) => ({ name: name, strict: true, description: description, input_schema: input_schema });
  return [
    T('get_wrong_questions', '查看待攻克错题的具体内容:题干、学员选的、正确答案、系统判定、错几次。分析具体错因前先调用。',
      obj({ subject: subject, topic_ids: Object.assign({ description: '空数组=不限' }, topics), limit: { type: 'integer', description: '1–6' } })),
    T('get_topic_detail', '查看一个考点的详细记录:最近作答对错序列、做过的题的难度分布、剩余新题数、推送倍数。', obj({ subject: subject, topic_id: { type: 'string', enum: tids } })),
    T('set_push_bias', '调整考点推送力度,影响之后每组练习主攻哪些考点。factor>1 多推,<1 少推,0 暂停推送,1 恢复正常。',
      obj({ subject: subject, topic_id: { type: 'string', enum: tids }, factor: { type: 'number', description: '0–3' }, days: { type: 'integer', description: '有效天数 1–60' }, reason: { type: 'string' } })),
    T('make_practice', '按条件组一组练习并立刻开始(回复结束后自动进入做题页)。', pick('题数 1–30')),
    T('make_print', '按条件挑题并立刻打开打印预览。', pick('题数 1–60')),
    T('mark_mastered', '把错题标为已掌握,移出错题本(学员说某题已经会了,或复盘后确认是失误)。', obj({ question_ids: { type: 'array', items: { type: 'string' } } })),
    T('set_group_size', '设置每组练习的题数。', obj({ size: { type: 'integer', description: '5–20' } })),
    T('set_target', '修改某科目标分。', obj({ subject: subject, score: { type: 'integer' } })),
    T('navigate', '回复结束后打开网站的某个页面。', obj({ page: { type: 'string', enum: ['home', 'bank', 'me', 'writing', 'topic'] }, subject: subject,
      topic_id: { type: 'string', enum: tids.concat(['']), description: 'page=topic 时填,否则空字符串' } })),
    T('remember', '把关于学员的一条信息存进长期记忆(每条 60 字以内,最多 12 条,新对话都会带上)。', obj({ note: { type: 'string' } })),
    T('forget', '删除一条过时的长期记忆。', obj({ index: { type: 'integer', description: '记忆编号,从 1 开始' } })),
  ];
}
function wrongIds(subj, tids) {
  return Object.keys(S.cards).filter(id => { const c = S.cards[id];
    return c.s === subj && c.w > 0 && c.st < 3 && c.kind !== 'slip' && (!tids.length || tids.indexOf(c.t) >= 0); })
    .sort((a, b) => S.cards[a].due - S.cards[b].due);
}
function tName(subj, tids) { return tids.length ? tids.map(t => topicName(subj, t)).join('、') : SUBJ[subj].name; }
function memText() { return (S.aiMem || []).map((m, i) => (i + 1) + '. ' + m).join('\n') || '(暂无)'; }
/* 执行工具:返回给 AI 的结果(尽量短,省 token);练习/打印/跳转排进 CHAT.after,回复结束后执行 */
async function runTool(name, x) {
  const note = (t, act) => CHAT.view.push({ who: 'act', text: t, act: act });
  if (name === 'get_wrong_questions') {
    const d = await loadData(x.subject), ids = wrongIds(x.subject, x.topic_ids || []).slice(0, clamp(x.limit || 4, 1, 6));
    if (!ids.length) return '没有待攻克的错题';
    note('查看了 ' + ids.length + ' 道错题');
    return ids.map(function (id) {
      const q = d.byId[id], c = S.cards[id], pd = pendOf(x.subject).find(p => p.id === id);
      const opts = q.kind === 'cond' ? '(条件充分性 A–E)' : q.opts.map((o, i) => LET[i] + '.' + plainQ(o).slice(0, 30)).join(' ');
      return `[${id}] ${q.src}·${topicName(x.subject, q.t)}·${LVN[q.lv]}\n${plainQ(q.stem).slice(0, 220)}${q.kind === 'cond' ? '\n(1)' + plainQ(q.c1).slice(0, 80) + ' (2)' + plainQ(q.c2).slice(0, 80) : ''}\n${opts}\n选${c.p || '?'} 答案${q.ans} · 错${c.w}次 · ${c.kind === 'gap' ? '判定不会' : pd ? '观察中(失误概率' + Math.round(pd.post * 100) + '%)' : '待判定'}`;
    }).join('\n\n');
  }
  if (name === 'get_topic_detail') {
    const d = await loadData(x.subject), L = tpList(x.subject, x.topic_id), all = d.qs.filter(q => q.t === x.topic_id && !q.skip);
    const done = all.filter(q => S.cards[q.id]), lv = [1, 2, 3, 4].map(k => done.filter(q => q.lv === k).length);
    note('查看了「' + topicName(x.subject, x.topic_id) + '」的记录');
    return `${topicName(x.subject, x.topic_id)}:掌握${Math.round(mastery(x.subject, x.topic_id) * 100)}% 作答${L.length}次 最近:${L.slice(-15).map(r => r.r >= 1 ? '对' : r.r > 0 ? '慢对' : '错').join('')}
做过 ${done.length}/${all.length} 题(基础${lv[0]} 中等${lv[1]} 较难${lv[2]} 挑战${lv[3]}),真题新题剩 ${all.filter(q => q.real && !S.cards[q.id]).length},推送×${biasOf(x.subject, x.topic_id)}`;
  }
  if (name === 'set_push_bias') {
    const f = Math.round(clamp(+x.factor, 0, 3) * 10) / 10, days = clamp(Math.round(+x.days || 7), 1, 60);
    S.bias = S.bias || {};
    if (f === 1) delete S.bias[x.subject + '|' + x.topic_id];
    else S.bias[x.subject + '|' + x.topic_id] = { f: f, until: Date.now() + days * DAY, why: x.reason || '' };
    save();
    note(topicName(x.subject, x.topic_id) + (f === 1 ? ' 推送恢复正常' : f === 0 ? ' 暂停推送 ' + days + ' 天' : ' 推送 ×' + f + ',' + days + ' 天'));
    return 'ok';
  }
  if (name === 'mark_mastered') {
    const ok = (x.question_ids || []).filter(id => S.cards[id]);
    ok.forEach(id => { const c = S.cards[id]; c.st = Math.max(c.st, 3); c.kind = 'slip'; c.due = Date.now() + 16 * DAY;
      const P = pendOf(c.s), pd = P.find(p => p.id === id); if (pd) P.splice(P.indexOf(pd), 1); });
    save();
    note('标记 ' + ok.length + ' 道错题为已掌握');
    return 'ok:' + ok.length + ' 道';
  }
  if (name === 'set_group_size') { S.groupN = clamp(Math.round(+x.size || 10), 5, 20); save(); note('每组改为 ' + S.groupN + ' 题'); return 'ok'; }
  if (name === 'set_target') {
    const max = SUBJ[x.subject].per * SUBJ[x.subject].pts, v = clamp(Math.round(+x.score || 0), 10, max);
    S.target[x.subject] = v; save(); note(SUBJ[x.subject].name + '目标分改为 ' + v); return 'ok';
  }
  if (name === 'remember') {
    S.aiMem = (S.aiMem || []).concat([String(x.note || '').slice(0, 80)]).slice(-12); save();
    note('记住了:' + x.note); return 'ok:共 ' + S.aiMem.length + ' 条';
  }
  if (name === 'forget') {
    const i = (+x.index || 0) - 1, m = S.aiMem || [];
    if (i < 0 || i >= m.length) return 'error:没有第 ' + x.index + ' 条';
    note('忘掉了:' + m[i]); m.splice(i, 1); save(); return 'ok';
  }
  if (name === 'navigate') {
    const to = x.page === 'topic' && x.topic_id ? '#/t/' + x.subject + '/' + x.topic_id : { home: '#/', bank: '#/bank', me: '#/me', writing: '#/writing' }[x.page] || '#/';
    if (x.page === 'home' || x.page === 'bank') S.subj = x.subject;
    CHAT.after = { nav: to }; return 'ok:回复结束后打开';
  }
  if (name === 'make_practice' || name === 'make_print') {
    const tids = x.topic_ids || [], n = clamp(Math.round(+x.count || 10), 1, name === 'make_print' ? 60 : 30);
    let avail, label;
    if (x.source === 'paper') {
      const p = META[x.subject].papers.find(q => q.id === x.paper_id);
      if (!p) return 'error:没有这套卷 ' + x.paper_id;
      avail = p.n; label = p.name;
    } else if (x.source === 'wrong') {
      avail = Math.min(n, wrongIds(x.subject, tids).length); label = tName(x.subject, tids) + ' 错题';
      if (!avail) return 'error:' + label + '目前没有待攻克的错题';
    } else {
      if (!tids.length) return 'error:source=topic 时要给 topic_ids';
      avail = n; label = tName(x.subject, tids) + ' 专练';
    }
    const act = { kind: name === 'make_print' ? 'print' : 'go', subj: x.subject, source: x.source, tids: tids, pid: x.paper_id, n: n, label: label };
    note((act.kind === 'print' ? '打印:' : '练习:') + label + (x.source === 'paper' ? '' : ' · ' + avail + ' 题'), act);
    CHAT.after = { act: act };
    return 'ok:回复结束后自动' + (act.kind === 'print' ? '打开打印预览' : '开始') + '(' + avail + ' 题)';
  }
  return 'error:未知工具';
}
function doAct(act) {
  loadData(act.subj).then(function (d) {
    if (act.source === 'paper') {
      const p = d.papers.find(q => q.id === act.pid);
      if (act.kind === 'print') printAsk(act.subj, p.ids, p.name, false); else startPaper(act.subj, act.pid);
      return;
    }
    let ids;
    if (act.source === 'wrong') ids = wrongIds(act.subj, act.tids).slice(0, act.n);
    else {
      const used = new Set();
      ids = [];
      for (let k = 0; ids.length < act.n && k < act.n * 3; k++) {
        const t = act.tids[k % act.tids.length], q = bestIn(d, act.subj, t, act.kind === 'print' ? 0.6 : flowTarget({ ids: [], ans: {} }), used);
        if (q) { used.add(q.id); ids.push(q.id); }
      }
    }
    if (!ids.length) { toast('没有符合条件的题'); return; }
    if (act.kind === 'print') printAsk(act.subj, ids, act.label, false);
    else startSession({ mode: act.source === 'wrong' ? 'redo' : 'list', subj: act.subj, ids: ids, title: act.label });
  });
}
/* 新对话:清掉发给 AI 的上下文(省 token),但带上上次最后两轮的要点;keepView=false 时连屏幕上的记录一起清 */
function newChat(keepView) {
  const last = CHAT.view.filter(m => m.who === 'me' || m.who === 'ai').slice(-4)
    .map(m => (m.who === 'me' ? '学员:' : '教练:') + m.text.replace(/\s+/g, ' ').slice(0, 160)).join('\n');
  CHAT = { msgs: [], view: keepView ? CHAT.view.concat(CHAT.view.length ? [{ who: 'sep', text: '新对话' }] : []).slice(-40) : [], tok: 0, at: 0, snap: '', carry: keepView ? last : '' };
  saveChat();
}
/* 一段对话绑定「服务商+模型+系统提示+工具表」的指纹:网站更新或换了模型后,旧历史和新设置对不上会被接口拒绝,直接换新对话 */
function ctxSig() {
  const t = AI.provider + '|' + AI.model + '|' + AI_SYS + JSON.stringify(aiTools());
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return h.toString(36);
}
/* 历史是否完整:每个调了工具的 AI 回复后面都要紧跟工具结果(中途关页面/断网会留下半截) */
function chatIntact(msgs) {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'assistant' && Array.isArray(m.content) && m.content.some(b => b.type === 'tool_use')) {
      const nx = msgs[i + 1];
      if (!nx || nx.role !== 'user' || !Array.isArray(nx.content) || !nx.content.some(b => b.type === 'tool_result')) return false;
    }
  }
  return true;
}
async function aiSend(text, retried) {
  const snap = aiSnapshot(), sig = ctxSig();
  // 太长、隔太久、设置变了、历史残缺:换新上下文(带上次要点),而不是让请求失败
  if (CHAT.msgs.length && (CHAT.tok > 12000 || Date.now() - CHAT.at > 6 * 3600e3 || CHAT.sig !== sig || !chatIntact(CHAT.msgs))) newChat(true);
  CHAT.sig = sig;
  let content = text;
  if (!CHAT.msgs.length) content = `【长期记忆】\n${memText()}\n${CHAT.carry ? '【上次聊到】\n' + CHAT.carry + '\n' : ''}【学情摘要 · ${new Date().toLocaleString('zh-CN')}】\n${snap}\n\n【学员】${text}`;
  else if (snap !== CHAT.snap) content = `【最新学情摘要】\n${snap}\n\n【学员】${text}`;
  CHAT.snap = snap; CHAT.after = null;
  CHAT.view.push({ who: 'me', text: text });
  CHAT.msgs.push({ role: 'user', content: content });
  const tools = aiTools();
  try {
    for (let i = 0; i < 6; i++) {
      const res = await aiCall({ system: AI_SYS, tools: tools, messages: CHAT.msgs }, 4000);
      CHAT.msgs.push({ role: 'assistant', content: res.content });       // 原样追加(含思考块),不改写历史
      CHAT.tok = res._tin + (res.usage.output_tokens || 0); CHAT.at = Date.now();
      const t = aiText(res);
      if (t) CHAT.view.push({ who: 'ai', text: t });
      if (res.stop_reason === 'refusal') { CHAT.view.push({ who: 'ai', text: '(这条请求被安全策略拒绝了,换个说法试试)' }); break; }
      if (res.stop_reason === 'max_tokens') { CHAT.view.push({ who: 'ai', text: '(回答太长被截断了,可以让它说短一点)' }); break; }
      if (res.stop_reason !== 'tool_use') break;
      const results = [];
      for (const b of res.content.filter(b => b.type === 'tool_use')) results.push({ type: 'tool_result', tool_use_id: b.id, content: await runTool(b.name, b.input || {}) });
      CHAT.msgs.push({ role: 'user', content: results });
      saveChat(); if (location.hash === '#/ai') viewAI();
    }
  } catch (e) {
    // 请求没成功:撤回刚追加、还没得到回复的那条用户消息(没进入对话,不算改历史)
    const lastM = CHAT.msgs[CHAT.msgs.length - 1];
    if (lastM && lastM.role === 'user' && typeof lastM.content === 'string') { CHAT.msgs.pop(); CHAT.view.pop(); }
    // 接口说请求格式不对(多半是旧历史的问题):自动开新对话再试一次
    if (e.status === 400 && !retried && CHAT.msgs.length) {
      newChat(true); CHAT.view.push({ who: 'act', text: '之前的对话接不上了,已自动开了新对话' }); saveChat();
      return aiSend(text, true);
    }
    CHAT.view.push({ who: 'me', text: text }, { who: 'err', text: e.message || String(e) });
  }
  saveChat();
  const after = CHAT.after; CHAT.after = null;
  if (after && location.hash === '#/ai') setTimeout(function () {       // 让学员先看到回复,再执行
    if (after.act) doAct(after.act); else if (after.nav) location.hash = after.nav;
  }, 900);
}
function viewAI() {
  const u = aiToday(), v = CHAT.view;
  const chips = ['分析一下我现在的学情', '看看我的错题,说说错在哪', '错题里我只要排列组合的', '数列我很稳了,少推点'];
  html(`<section class="ai-h"><b>AI 教练</b><span class="links"><a href="#" id="newc">新对话</a><a href="#" id="clrc">清空</a></span></section>
  ${aiKey() ? '' : `<div class="grp"><a href="#" class="row-i chev" id="setkey"><span>先填 ${PROV()[AI.provider].name} API Key</span><span class="v">只存在本机</span></a></div>`}
  <div class="chat">${v.length ? v.map((m, i) => m.who === 'me' ? `<div class="me">${esc(m.text)}</div>`
      : m.who === 'sep' ? `<div class="sep"><span>新对话</span></div>`
      : m.who === 'act' ? `<div class="act">✓ ${esc(m.text)}${m.act ? ` <a href="#" data-act="${i}">${m.act.kind === 'print' ? '再打开' : '再开始'}</a>` : ''}</div>`
      : m.who === 'err' ? `<div class="err">${esc(m.text)}</div>` : `<div class="ai">${mdLite(m.text)}</div>`).join('') : ''}
    ${!v.length || v[v.length - 1].who === 'sep' ? `<div class="chips">${chips.map(c => `<a href="#" data-chip="${esc(c)}">${c}</a>`).join('')}</div>` : ''}
    ${aiBusy ? '<div class="ai dim">思考中…</div>' : ''}</div>
  <form class="ask" id="ask"><textarea id="q" rows="1" placeholder="说说你的情况,比如:排列组合老错,多推点"></textarea><button class="go sm" ${aiBusy ? 'disabled' : ''}>发送</button></form>
  <div class="ai-f dim">${MODELS()[AI.model][0]} · 今日 ${kTok(u.in + u.out)} / ${kTok(AI.budget)} token · 约 ${yuan(u.usd)}${CHAT.tok ? ' · 本对话 ' + kTok(CHAT.tok) : ''}</div>`);
  const send = function (t) {
    t = (t || '').trim();
    if (!t || aiBusy) return;
    const p = aiSend(t); viewAI(); p.then(() => { if (location.hash === '#/ai') viewAI(); });
  };
  $('#ask').onsubmit = ev => { ev.preventDefault(); send($('#q').value); };
  $('#q').onkeydown = ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send($('#q').value); } };
  app.querySelectorAll('[data-chip]').forEach(a => a.onclick = ev => { ev.preventDefault(); send(a.dataset.chip); });
  app.querySelectorAll('[data-act]').forEach(a => a.onclick = ev => { ev.preventDefault(); doAct(v[+a.dataset.act].act); });
  $('#newc').onclick = ev => { ev.preventDefault(); if (!aiBusy) { newChat(true); viewAI(); } };
  $('#clrc').onclick = ev => { ev.preventDefault(); if (!aiBusy) ask('清空所有对话记录?(长期记忆保留,可在「我的」里清)', { ok: '清空' }).then(y => { if (y) { newChat(false); viewAI(); } }); };
  const sk = $('#setkey'); if (sk) sk.onclick = ev => { ev.preventDefault(); askKey().then(() => viewAI()); };
  const c = $('.chat'); if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'end' });
}
/* 服务商选择:列出内置和自定义的,可添加/删除自定义(要求 Anthropic 兼容接口) */
function pickProvider() {
  return new Promise(function (done) {
    const P = PROV();
    let next = null;
    const d = sheet('选择 AI 服务商', `<div class="grp plist">${Object.keys(P).map(id => `<a href="#" class="row-i" data-p="${id}"><span>${esc(P[id].name)}</span>
      <span class="v">${AI.keys[id] || builtinKey(id) ? '有 Key' : ''}${id === AI.provider ? ' ✓' : ''}${AI_PROV[id] ? '' : ` <i class="del" data-del="${id}">删除</i>`}</span></a>`).join('')}
      <a href="#" class="row-i chev" data-add="1"><span>添加其他服务商…</span><span class="v"></span></a></div>`, '',
      () => { if (next) next().then(done); else done(); });
    d.node.querySelectorAll('[data-p]').forEach(a => a.onclick = function (e) {
      e.preventDefault();
      const del = e.target.dataset.del;
      if (del) { AI.custom = AI.custom.filter(c => c.id !== del); delete AI.keys[del]; if (AI.provider === del) { AI.provider = 'deepseek'; AI.model = 'deepseek-flash'; } saveAI(); d.close(); return; }
      AI.provider = a.dataset.p; AI.model = firstModel(a.dataset.p); saveAI(); d.close();
    });
    $('[data-add]', d.node).onclick = function (e) { e.preventDefault(); next = addProvider; d.close(); };
  });
}
/* 多栏表单:fields = [{k, label, ph, type, v, half}],half 的两项并排一行 */
function form(title, note, fields) {
  return new Promise(function (ok) {
    let val = null;
    const d = sheet(title, `${note ? `<p class="dlg-note">${esc(note)}</p>` : ''}<div class="fgrid">${fields.map(f => `<label class="fl${f.half ? ' half' : ''}"><span>${f.label}</span>
      <input class="dlg-in" data-k="${f.k}" type="${f.type || 'text'}" placeholder="${esc(f.ph || '')}" value="${esc(f.v || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"${f.type === 'number' ? ' inputmode="decimal"' : ''}></label>`).join('')}</div>`,
      `<button class="ghost" data-v="0">取消</button><button class="go sm" data-v="1">保存</button>`, () => ok(val));
    d.node.querySelectorAll('[data-v]').forEach(b => b.onclick = function () {
      if (b.dataset.v === '1') { val = {}; d.node.querySelectorAll('[data-k]').forEach(i => { val[i.dataset.k] = i.value.trim(); }); }
      d.close();
    });
  });
}
function addProvider() {
  return form('添加服务商', '需提供 Anthropic 兼容接口(地址多以 /anthropic 结尾);价格只用来估算花费。', [
    { k: 'name', label: '名称', ph: '比如 Kimi' }, { k: 'base', label: '接口地址', ph: 'https://…/anthropic', type: 'url' },
    { k: 'model', label: '模型名', ph: '文档里的模型 id' }, { k: 'key', label: 'API Key', type: 'password' },
    { k: 'pin', label: '输入 ¥/百万', type: 'number', v: '2', half: 1 }, { k: 'pout', label: '输出 ¥/百万', type: 'number', v: '8', half: 1 }])
    .then(function (o) {
      if (!o) return;
      if (!o.name || !/^https:\/\//.test(o.base) || !o.model) { toast('名称、https 接口地址、模型名都要填'); return; }
      const id = 'c' + Date.now().toString(36);
      AI.custom.push({ id: id, name: o.name, base: o.base.replace(/\/+$/, ''), model: o.model, pin: (+o.pin || 0) / USD_CNY, pout: (+o.pout || 0) / USD_CNY });
      if (o.key) AI.keys[id] = o.key;
      AI.provider = id; AI.model = id + ':' + o.model; saveAI(); toast('已添加并切换到 ' + o.name);
    });
}
function askKey() {
  const pv = PROV()[AI.provider], cur = aiKey();
  return ask('粘贴你的 ' + pv.name + ' API Key。只保存在这台设备的浏览器里,不进备份,只发给 ' + pv.name + '。' + (cur ? '\n已保存过一个,留空=删除。' : ''),
             { input: '', type: 'password', ph: pv.hint, ok: '保存' }).then(function (k) {
    if (k === null) return;
    if (!k.trim() && !cur) return;
    k = k.trim();
    const kind = keyKind(k);
    if (k && kind && kind !== AI.provider) {            // 粘的是另一家的 Key:自动切过去
      AI.provider = kind; AI.model = firstModel(kind);
      AI.keys[kind] = k; saveAI(); toast('这是 ' + PROV()[kind].name + ' 的 Key,已切换服务商'); return;
    }
    AI.keys[AI.provider] = k; saveAI(); toast(k ? 'Key 已保存' : 'Key 已删除');
  });
}
/* 错题讲解:针对选错的那个选项;按「题|选项」缓存在本机,重复看不花 token */
const AI_EX_SYS = '你是管综(管理类联考)数学/逻辑辅导老师。学员做错了一道题,请针对他选的那个错误选项讲清:他大概错在哪一步、正确思路的关键一步、下次怎么避免。中文,180 字以内,公式用 $...$,不用表格,不复述题目。';
function plainQ(h) { return String(h || '').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
async function aiExplain(q, pick, box) {
  const k = 'ex:' + q.id + '|' + pick, hit = window.indexedDB ? await kvGet(k) : null;
  if (hit) { box.innerHTML = mdLite(hit); typeset(box); return; }
  box.innerHTML = '<span class="dim">思考中…</span>';
  const opts = q.kind === 'cond' ? COND_OPTS : q.opts;
  const msg = `题目:${plainQ(q.stem)}${q.kind === 'cond' ? `\n条件(1):${plainQ(q.c1)}\n条件(2):${plainQ(q.c2)}` : ''}\n选项:${opts.map((o, i) => LET[i] + '. ' + plainQ(o)).join(' ')}\n正确答案:${q.ans}\n学员选了:${pick}\n参考解析:${plainQ(q.sol)}`;
  try {
    const res = await aiCall({ system: AI_EX_SYS, messages: [{ role: 'user', content: msg }] }, 2500);
    const t = aiText(res) || '(没有得到讲解)';
    if (res.stop_reason !== 'refusal' && window.indexedDB) kvSet(k, t);
    box.innerHTML = mdLite(res.stop_reason === 'refusal' ? '(这条请求被安全策略拒绝了)' : t); typeset(box);
  } catch (e) { box.innerHTML = '<span class="hot">' + esc(e.message || String(e)) + '</span>'; }
}

/* ───────────── 打印:所见即所得的 A4 分页预览 ─────────────
   先把每道题渲染到一个和纸面同宽的隐藏容器里量出真实高度,再按 A4 可用高度一页页装(题不跨页),
   预览里看到的每一页就是打出来的那一页。纸面 794×1123px = 210×297mm(96dpi),上下边距 60px≈16mm,左右 57px≈15mm。 */
const PAGE = { h: 1123, py: 60, px: 57, foot: 26 };
function printAsk(subj, ids, title, pickCount) {
  loadData(subj).then(function (d) {
    const o = { ans: 'key', space: subj === 'math' ? 'sm' : 'no', which: 'new', n: 20 };
    const opt = (k, v, t) => `<option value="${v}"${o[k] === v ? ' selected' : ''}>${t}</option>`;
    const pv = el('div', 'pv');
    pv.innerHTML = `<div class="pv-bar">
      <a href="#" class="pv-x">✕</a>
      ${pickCount ? `<select data-k="which">${opt('which', 'new', '没做过的')}${opt('which', 'wrong', '做错过的')}${opt('which', 'all', '全部')}</select>
        <select data-k="n"><option>10</option><option selected>20</option><option>30</option><option value="999">不限</option></select>` : ''}
      <select data-k="ans">${opt('ans', 'none', '不带答案')}${opt('ans', 'key', '附答案')}${opt('ans', 'sol', '附答案和解析')}</select>
      <select data-k="space">${opt('space', 'no', '不留空白')}${opt('space', 'sm', '留少量空白')}${opt('space', 'lg', '留大量空白')}</select>
      <span class="pv-n dim"></span>
      <button class="go sm" id="pgo">打印</button></div>
      <div class="pv-scroll"><div class="pv-pages"></div></div>`;
    document.body.classList.add('previewing');
    const close = layer(pv, () => { document.body.classList.remove('previewing'); window.removeEventListener('resize', fit); });
    const box = $('.pv-pages', pv);
    let list = ids, token = 0;
    const fit = () => { box.style.zoom = Math.min(1, ($('.pv-scroll', pv).clientWidth - 24) / 794); };
    const draw = function () {
      list = !pickCount ? ids : ids.filter(id => o.which === 'all' || (o.which === 'new' ? !S.cards[id] : S.cards[id] && S.cards[id].w > 0 && S.cards[id].kind !== 'slip')).slice(0, +o.n);
      const my = ++token;
      if (!list.length) { box.innerHTML = '<section class="page"><p class="doc-empty">没有符合条件的题</p></section>'; $('.pv-n', pv).textContent = ''; return; }
      paginate(paperBlocks(d, subj, list, title, o)).then(function (pages) {
        if (my !== token) return;
        box.innerHTML = '';
        pages.forEach(p => box.append(p));
        $('.pv-n', pv).textContent = list.length + ' 题 · ' + pages.length + ' 页';
      });
    };
    pv.querySelectorAll('select').forEach(sel => sel.onchange = () => { o[sel.dataset.k] = sel.value; draw(); });
    $('.pv-x', pv).onclick = ev => { ev.preventDefault(); close(); };
    $('#pgo', pv).onclick = () => { if (list.length) window.print(); };
    window.addEventListener('resize', fit);
    fit(); draw();
  });
}
/* 选项排版:都很短排一行 5 个,中等两列,长的一行一个(公式按渲染后的大致宽度估) */
function optCols(opts) {
  const w = Math.max(...opts.map(t => t.replace(/<[^>]+>/g, '').replace(/\$([^$]*)\$/g, (m, x) => 'x'.repeat(Math.ceil(x.replace(/\\[a-z]+|[{}^_]/g, '').length / 1.6))).length));
  return w <= 10 ? 'o5' : w <= 24 ? 'o2' : 'o1';
}
/* 纸面拆成块:页头、每道题、答案表、每题解析;块是分页的最小单位 */
function paperBlocks(d, subj, ids, title, o) {
  const qs = ids.map(id => d.byId[id]), dt = new Date();
  const mins = Math.round(qs.length * SUBJ[subj].sec / 60 * 0.95);
  const head = `<header class="doc-h"><h1>${esc(title)}</h1>
      <div class="doc-m"><span>${SUBJ[subj].name} · ${qs.length} 题 · 建议 ${mins} 分钟 · ${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()}</span>
      <span class="doc-f"><span>用时</span><span>得分</span></span></div></header>
    ${qs.some(q => q.kind === 'cond') ? `<div class="doc-r">条件充分性判断　A. (1) 充分,(2) 不充分　B. (2) 充分,(1) 不充分　C. 单独都不充分,联合充分　D. 单独都充分　E. 单独、联合都不充分</div>` : ''}`;
  const body = qs.map((q, k) => `<div class="pq sp-${o.space}" data-id="${q.id}">
    <div class="pq-t"><b class="pq-n">${k + 1}.</b>${q.stem}</div>
    ${q.fig ? `<img class="pq-f" src="${q.fig}" alt="">` : ''}
    ${q.kind === 'cond' ? `<div class="pq-c"><p>(1) ${q.c1}</p><p>(2) ${q.c2}</p></div>`
      : `<ol class="pq-o ${optCols(q.opts)}">${q.opts.map((t, i) => `<li><b>${LET[i]}.</b> ${t}</li>`).join('')}</ol>`}</div>`);
  // 答案按排版后的最终题序生成(分页时为了填满页面可能调换了题序)
  const ans = order => { const qq = order.map(id => d.byId[id]);
    return o.ans === 'none' ? [] : [`<h2 class="doc-ah">答案${o.ans === 'sol' ? '与解析' : ''}</h2>
    <div class="keys">${qq.map((q, k) => `<span><i>${k + 1}</i>${q.ans}</span>`).join('')}</div>`]
    .concat(o.ans !== 'sol' ? [] : qq.map((q, k) => `<div class="sol-i"><b>${k + 1}. ${q.ans}</b><span class="src">${q.src}</span><div>${q.sol || ''}</div></div>`)); };
  return { head: head, body: body, ans: ans };
}
function paginate(bl) {
  const meas = el('div', 'page measure');
  document.body.append(meas);
  const mk = h => { const n = el('div', 'blk', h); meas.append(n); return n; };
  const ready = nodes => { typeset(meas); const imgs = [...meas.querySelectorAll('img')].filter(i => !i.complete);
    return Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => nodes); };
  const avail = PAGE.h - PAGE.py * 2 - PAGE.foot, pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = []; pages.push(cur); used = 0; };
  const put = n => { if (cur.length && used + n.offsetHeight > avail) newPage(); cur.push(n); used += n.offsetHeight; };
  const head = mk(bl.head), body = bl.body.map(mk);
  return ready().then(function () {
    newPage(); put(head);
    // 装题:放不下时往后看最多 4 题,挑一道放得下的先补进来(题号按最终顺序重编),减少页尾大块空白
    const rest = body.slice();
    while (rest.length) {
      let i = 0;
      if (cur.length && used + rest[0].offsetHeight > avail) {
        const j = rest.slice(1, 5).findIndex(n => used + n.offsetHeight <= avail);
        i = j >= 0 ? j + 1 : 0;
      }
      put(rest.splice(i, 1)[0]);
    }
    const order = [];
    pages.forEach(pg => pg.forEach(n => { const q = n.querySelector('[data-id]'); if (q) { order.push(q.dataset.id); n.querySelector('.pq-n').textContent = order.length + '.'; } }));
    const ans = bl.ans(order).map(mk);
    return ready().then(function () {
      if (ans.length) { newPage(); ans.forEach(put); }
      meas.remove();
      return pages.map(function (blks, i) {
        const pg = el('section', 'page');
        const inner = el('div', 'page-in');
        blks.forEach(b => inner.append(b));
        pg.append(inner, el('div', 'page-no', (i + 1) + ' / ' + pages.length));
        return pg;
      });
    });
  });
}

/* ───────────── 路由 ───────────── */
function route() {
  clearInterval(tick);
  document.title = 'Ultimate';
  const h = location.hash.replace(/^#\/?/, '').split('/');
  const r = h[0] || 'home';
  const tab = r === 't' || r === 'papers' || r === 'bank' ? 'me' : r === 'sum' ? 'home' : r;     // 题库在「我的」里
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === tab));
  document.body.classList.toggle('playing', r === 's');
  document.body.classList.toggle('reading', /^#\/writing\/./.test(location.hash));   // 写作阅读页全屏:它有自己的返回条和上一篇/下一篇
  if (r === 't') viewTopic(h[1], h[2]);
  else if (r === 'bank' || r === 'papers') viewBank();
  else if (r === 'me') viewMe();
  else if (r === 's') viewSession();
  else if (r === 'sum') viewSum();
  else if (r === 'ai') viewAI();
  else if (r === 'writing') loadWriting(() => { if (location.hash.indexOf('#/writing') === 0) window.renderWriting(); });
  else viewHome();
}
document.addEventListener('click', function (ev) {
  const b = ev.target.closest('[data-subj]');
  if (!b) return;
  S.subj = b.dataset.subj; save(); route();
});
document.addEventListener('keydown', function (ev) {
  if (!document.body.classList.contains('playing') || ev.metaKey || ev.ctrlKey || /INPUT|SELECT/.test(ev.target.tagName)) return;
  const k = ev.key.toUpperCase();
  const idx = LET.indexOf(k) >= 0 ? LET.indexOf(k) : '12345'.indexOf(k);
  if (idx >= 0) { const b = app.querySelectorAll('.opt')[idx]; if (b && !b.disabled) b.click(); }
  else if (ev.key === 'Enter' || ev.key === 'ArrowRight') { const n = $('#next'); if (n) n.click(); }
  else if (ev.key === 'ArrowLeft') { const p = $('#prev'); if (p && !p.disabled) p.click(); }
});
/* 做题页左右滑动换题(手机):左滑下一题、右滑上一题;从屏幕左边缘起手的留给 iOS 的返回手势 */
let sw = null;
app.addEventListener('touchstart', function (e) {
  if (!document.body.classList.contains('playing') || e.touches.length > 1) { sw = null; return; }
  const t = e.touches[0];
  sw = t.clientX < 24 || e.target.closest('.katex-display, table') ? null : { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });
app.addEventListener('touchend', function (e) {
  if (!sw) return;
  const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.t < 600;
  sw = null;
  if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  const b = dx < 0 ? $('#next') : $('#prev');
  if (b && !b.disabled) b.click();
}, { passive: true });
let navCount = 0;          // 本次打开后在站内跳过几次;>1 说明后退还停在站内
window.addEventListener('hashchange', () => { navCount++; layerMark = false; while (LAYERS.length) LAYERS[0].close(true); route(); });   // 换页时收起所有浮层
// 申请持久存储(iOS 上减少被系统清掉的可能),打开时顺手存今天的快照
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
setTimeout(autoSnap, 1500);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route); else route();

/* iPhone 键盘弹出时:把底部输入框顶到键盘上方,临时藏起标签栏(visualViewport 比 innerHeight 小的那截就是键盘) */
if (window.visualViewport) {
  const vv = window.visualViewport;
  const onVV = function () {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', kb + 'px');
    document.body.classList.toggle('kb', kb > 80);
  };
  vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV);
}
/* 离线缓存:只在线上启用;本机预览(localhost)注销,免得调试时被旧缓存骗 */
if ('serviceWorker' in navigator) {
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  else window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
