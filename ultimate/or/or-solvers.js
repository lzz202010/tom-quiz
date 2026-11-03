/* 运筹学计算器核心：纯函数，不依赖页面。单纯形法用精确分数（BigInt），可以和手算结果逐格对照。 */
(function (root) {
  'use strict';
  const abs = (x) => (x < 0n ? -x : x);
  const gcd = (a, b) => { a = abs(a); b = abs(b); while (b) { [a, b] = [b, a % b]; } return a; };

  class Q {
    constructor(n, d = 1n) {
      if (d === 0n) throw new Error('分母不能为 0');
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d) || 1n;
      this.n = n / g; this.d = d / g;
    }
    static of(v) {
      if (v instanceof Q) return v;
      if (typeof v === 'bigint') return new Q(v);
      if (typeof v === 'number') return Q.parse(String(v));
      return Q.parse(String(v));
    }
    static parse(s) {
      s = String(s).trim().replace('−', '-');
      if (!s) throw new Error('有空的数');
      if (s.includes('/')) {
        const [a, b] = s.split('/');
        return Q.parse(a).div(Q.parse(b));
      }
      if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) throw new Error('无法识别的数：' + s);
      if (/e/i.test(s)) s = Number(s).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
      const neg = s.startsWith('-');
      s = s.replace(/^[+-]/, '');
      const [ip, fp = ''] = s.split('.');
      const n = BigInt((ip || '0') + fp) * (neg ? -1n : 1n);
      return new Q(n, 10n ** BigInt(fp.length));
    }
    add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
    div(o) { o = Q.of(o); if (o.n === 0n) throw new Error('除以 0'); return new Q(this.n * o.d, this.d * o.n); }
    neg() { return new Q(-this.n, this.d); }
    sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
    isZero() { return this.n === 0n; }
    cmp(o) { o = Q.of(o); const x = this.n * o.d - o.n * this.d; return x > 0n ? 1 : x < 0n ? -1 : 0; }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`; }
  }
  const Z = () => new Q(0n), ONE = () => new Q(1n);

  /* aM + b，用于大 M 法 */
  class MV {
    constructor(a = Z(), b = Z()) { this.a = Q.of(a); this.b = Q.of(b); }
    static of(v) { return v instanceof MV ? v : new MV(Z(), Q.of(v)); }
    add(o) { o = MV.of(o); return new MV(this.a.add(o.a), this.b.add(o.b)); }
    sub(o) { o = MV.of(o); return new MV(this.a.sub(o.a), this.b.sub(o.b)); }
    mulQ(q) { return new MV(this.a.mul(q), this.b.mul(q)); }
    neg() { return new MV(this.a.neg(), this.b.neg()); }
    cmp(o) { o = MV.of(o); const c = this.a.cmp(o.a); return c !== 0 ? c : this.b.cmp(o.b); }
    sign() { return this.cmp(new MV()); }
    toString() {
      if (this.a.isZero()) return this.b.toString();
      const am = this.a.cmp(ONE()) === 0 ? 'M' : this.a.cmp(ONE().neg()) === 0 ? '−M' : `${fmtQ(this.a)}M`;
      if (this.b.isZero()) return am;
      return am + (this.b.sign() > 0 ? '+' : '−') + fmtQ(this.b.sign() < 0 ? this.b.neg() : this.b);
    }
  }
  function fmtQ(q) { const s = q.toString(); return s.replace('-', '−'); }

  /* ---------- 线性规划文本解析 ----------
     第一行：max 3 5   或   min 2 3
     之后每行一个约束：1 0 <= 4   （也接受 ≤ ≥ =）  */
  function parseLP(text) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length < 2) throw new Error('至少需要一行目标函数和一行约束');
    const head = lines[0].split(/[\s,，]+/);
    const sense = head[0].toLowerCase();
    if (sense !== 'max' && sense !== 'min') throw new Error('第一行要以 max 或 min 开头');
    const c = head.slice(1).filter(Boolean).map(Q.parse);
    const n = c.length;
    if (!n) throw new Error('目标函数没有系数');
    const rows = lines.slice(1).map((l, k) => {
      const m = l.replace(/≤/g, '<=').replace(/≥/g, '>=').match(/^(.*?)(<=|>=|=)(.*)$/);
      if (!m) throw new Error(`第 ${k + 2} 行找不到 <=、>= 或 =`);
      const coef = m[1].trim().split(/[\s,，]+/).filter(Boolean).map(Q.parse);
      if (coef.length !== n) throw new Error(`第 ${k + 2} 行有 ${coef.length} 个系数，目标函数有 ${n} 个`);
      return { coef, op: m[2], rhs: Q.parse(m[3].trim()) };
    });
    return { sense, c, rows };
  }

  /* ---------- 单纯形法（大 M 法） ---------- */
  function simplex(lp, maxIter = 40) {
    const n = lp.c.length;
    const rows = lp.rows.map((r) => {
      if (r.rhs.sign() < 0) return { coef: r.coef.map((x) => x.neg()), op: r.op === '<=' ? '>=' : r.op === '>=' ? '<=' : '=', rhs: r.rhs.neg(), flipped: true };
      return { ...r };
    });
    const m = rows.length;
    const names = [];
    for (let j = 0; j < n; j++) names.push(`x${j + 1}`);
    const cost = lp.c.map((q) => MV.of(lp.sense === 'max' ? q : q.neg()));
    const kind = [];
    for (let j = 0; j < n; j++) kind.push('x');
    const slackCol = new Array(m).fill(-1), artCol = new Array(m).fill(-1);
    rows.forEach((r, i) => {
      if (r.op === '<=' || r.op === '>=') {
        slackCol[i] = names.length; names.push(`x${names.length + 1}`); cost.push(new MV()); kind.push(r.op === '<=' ? 's' : 'e');
      }
    });
    rows.forEach((r, i) => {
      if (r.op !== '<=') { artCol[i] = names.length; names.push(`x${names.length + 1}`); cost.push(new MV(ONE().neg(), Z())); kind.push('a'); }
    });
    const N = names.length;
    let A = rows.map((r, i) => {
      const row = new Array(N).fill(null).map(Z);
      r.coef.forEach((q, j) => { row[j] = q; });
      if (slackCol[i] >= 0) row[slackCol[i]] = r.op === '<=' ? ONE() : ONE().neg();
      if (artCol[i] >= 0) row[artCol[i]] = ONE();
      return row;
    });
    let b = rows.map((r) => r.rhs);
    let basis = rows.map((r, i) => (r.op === '<=' ? slackCol[i] : artCol[i]));
    const initCol = basis.slice();
    const tables = [];
    let status = 'iter';
    for (let it = 0; it < maxIter; it++) {
      const sig = [];
      for (let j = 0; j < N; j++) {
        let s = cost[j];
        for (let i = 0; i < m; i++) s = s.sub(cost[basis[i]].mulQ(A[i][j]));
        sig.push(s);
      }
      let z = new MV();
      for (let i = 0; i < m; i++) z = z.add(cost[basis[i]].mulQ(b[i]));
      const tab = { A: A.map((r) => r.slice()), b: b.slice(), basis: basis.slice(), sig, z, enter: -1, leave: -1, theta: [] };
      tables.push(tab);
      let k = -1;
      for (let j = 0; j < N; j++) if (sig[j].sign() > 0 && (k < 0 || sig[j].cmp(sig[k]) > 0)) k = j;
      if (k < 0) { status = 'optimal'; break; }
      let l = -1, best = null;
      for (let i = 0; i < m; i++) {
        if (A[i][k].sign() > 0) {
          const t = b[i].div(A[i][k]);
          tab.theta[i] = t;
          if (l < 0 || t.cmp(best) < 0 || (t.cmp(best) === 0 && basis[i] < basis[l])) { l = i; best = t; }
        }
      }
      tab.enter = k;
      if (l < 0) { status = 'unbounded'; break; }
      tab.leave = l;
      const p = A[l][k];
      A = A.map((r) => r.slice()); b = b.slice();
      A[l] = A[l].map((x) => x.div(p)); b[l] = b[l].div(p);
      for (let i = 0; i < m; i++) {
        if (i === l) continue;
        const f = A[i][k];
        if (f.isZero()) continue;
        A[i] = A[i].map((x, j) => x.sub(f.mul(A[l][j])));
        b[i] = b[i].sub(f.mul(b[l]));
      }
      basis = basis.slice(); basis[l] = k;
    }
    if (status === 'iter') status = 'limit';
    const last = tables[tables.length - 1];
    const x = new Array(N).fill(null).map(Z);
    last.basis.forEach((bj, i) => { x[bj] = last.b[i]; });
    let infeasible = false;
    if (status === 'optimal') last.basis.forEach((bj, i) => { if (kind[bj] === 'a' && last.b[i].sign() > 0) infeasible = true; });
    if (infeasible) status = 'infeasible';
    let zval = Z();
    lp.c.forEach((q, j) => { zval = zval.add(q.mul(x[j])); });
    let multiple = false;
    if (status === 'optimal') {
      for (let j = 0; j < N; j++) if (!last.basis.includes(j) && kind[j] !== 'a' && last.sig[j].sign() === 0) multiple = true;
    }
    let duals = null;
    if (status === 'optimal') {
      duals = initCol.map((j) => {
        const y = cost[j].sub(last.sig[j]);
        return lp.sense === 'max' ? y.b : y.b.neg();
      });
    }
    return { names, kind, cost, tables, status, x: x.slice(0, n), allX: x, z: zval, multiple, duals, rows, n, m, sense: lp.sense };
  }

  /* ---------- 运输问题：伏格尔法 + 位势法 + 闭回路 ---------- */
  function transport(C0, a0, b0) {
    const eps = 1e-9;
    let C = C0.map((r) => r.slice()), a = a0.slice(), b = b0.slice();
    const sa = a.reduce((s, x) => s + x, 0), sb = b.reduce((s, x) => s + x, 0);
    let dummy = null;
    if (sa > sb + eps) { C = C.map((r) => [...r, 0]); b.push(sa - sb); dummy = 'col'; }
    else if (sb > sa + eps) { C.push(new Array(b.length).fill(0)); a.push(sb - sa); dummy = 'row'; }
    const m = a.length, n = b.length;
    const X = Array.from({ length: m }, () => new Array(n).fill(null));
    const S = a.slice(), D = b.slice();
    const rows = new Set([...Array(m).keys()]), cols = new Set([...Array(n).keys()]);
    const vlog = [];
    while (rows.size && cols.size) {
      const pen = [];
      rows.forEach((i) => { const v = [...cols].map((j) => C[i][j]).sort((p, q) => p - q); pen.push({ p: v.length > 1 ? v[1] - v[0] : v[0], t: 'r', k: i }); });
      cols.forEach((j) => { const v = [...rows].map((i) => C[i][j]).sort((p, q) => p - q); pen.push({ p: v.length > 1 ? v[1] - v[0] : v[0], t: 'c', k: j }); });
      pen.sort((p, q) => q.p - p.p || (p.t === q.t ? p.k - q.k : p.t === 'r' ? -1 : 1));
      const top = pen[0];
      let i, j;
      if (top.t === 'r') { i = top.k; j = [...cols].reduce((bj, jj) => (C[i][jj] < C[i][bj] ? jj : bj)); }
      else { j = top.k; i = [...rows].reduce((bi, ii) => (C[ii][j] < C[bi][j] ? ii : bi)); }
      const q = Math.min(S[i], D[j]);
      X[i][j] = q; S[i] -= q; D[j] -= q;
      vlog.push({ by: top.t === 'r' ? `A${top.k + 1} 行` : `B${top.k + 1} 列`, pen: top.p, cell: [i, j], q });
      const rz = S[i] <= eps, cz = D[j] <= eps;
      if (rz && cz) { if (rows.size > 1) rows.delete(i); else cols.delete(j); }
      else if (rz) rows.delete(i);
      else cols.delete(j);
    }
    const basicCount = () => X.flat().filter((v) => v !== null).length;
    // 退化：补 0，使基变量个数为 m+n-1
    const comp = () => {
      const par = [...Array(m + n).keys()];
      const f = (x) => (par[x] === x ? x : (par[x] = f(par[x])));
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (X[i][j] !== null) par[f(i)] = f(m + j);
      return f;
    };
    const zeros = [];
    while (basicCount() < m + n - 1) {
      const f = comp();
      let best = null;
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (X[i][j] === null && f(i) !== f(m + j) && (!best || C[i][j] < C[best[0]][best[1]])) best = [i, j];
      if (!best) break;
      X[best[0]][best[1]] = 0; zeros.push(best);
    }
    const initial = X.map((r) => r.slice());
    const costOf = (Y) => Y.reduce((s, r, i) => s + r.reduce((t, v, j) => t + (v ? v * C[i][j] : 0), 0), 0);
    const iters = [];
    let final = null;
    for (let it = 0; it < 60; it++) {
      const u = new Array(m).fill(null), v = new Array(n).fill(null);
      u[0] = 0;
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
          if (X[i][j] === null) continue;
          if (u[i] !== null && v[j] === null) { v[j] = C[i][j] - u[i]; changed = true; }
          else if (v[j] !== null && u[i] === null) { u[i] = C[i][j] - v[j]; changed = true; }
        }
      }
      const sig = X.map((r, i) => r.map((x, j) => (x === null ? C[i][j] - u[i] - v[j] : null)));
      let ent = null;
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (sig[i][j] !== null && sig[i][j] < -eps && (!ent || sig[i][j] < sig[ent[0]][ent[1]])) ent = [i, j];
      const snap = { X: X.map((r) => r.slice()), u: u.slice(), v: v.slice(), sig, cost: costOf(X) };
      if (!ent) { final = snap; break; }
      // 找闭回路：基格构成的树上，从行 ent[0] 到列 ent[1] 的路径
      const adj = new Map();
      const add = (p, q, cell) => { if (!adj.has(p)) adj.set(p, []); adj.get(p).push([q, cell]); };
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (X[i][j] !== null) { add('r' + i, 'c' + j, [i, j]); add('c' + j, 'r' + i, [i, j]); }
      const start = 'r' + ent[0], goal = 'c' + ent[1];
      const prev = new Map([[start, null]]);
      const queue = [start];
      while (queue.length) { const p = queue.shift(); if (p === goal) break; for (const [q, cell] of adj.get(p) || []) if (!prev.has(q)) { prev.set(q, [p, cell]); queue.push(q); } }
      const path = [];
      let cur = goal;
      while (prev.get(cur)) { const [p, cell] = prev.get(cur); path.unshift(cell); cur = p; }
      const loop = [ent, ...path.reverse()];
      // 符号：入基格 +，之后沿回路交替。path 已从列端回到行端，保证相邻格共行或共列
      const signs = loop.map((_, k) => (k % 2 === 0 ? 1 : -1));
      let theta = Infinity, leaveIdx = -1;
      loop.forEach((cell, k) => { if (signs[k] < 0 && X[cell[0]][cell[1]] < theta - eps) { theta = X[cell[0]][cell[1]]; leaveIdx = k; } });
      X[ent[0]][ent[1]] = 0;
      loop.forEach((cell, k) => { X[cell[0]][cell[1]] += signs[k] * theta; });
      const lc = loop[leaveIdx];
      X[lc[0]][lc[1]] = null;
      iters.push({ ...snap, enter: ent, sigma: sig[ent[0]][ent[1]], loop, signs, theta, leave: lc, newCost: costOf(X) });
    }
    let multiple = false;
    if (final) final.sig.forEach((r) => r.forEach((s) => { if (s !== null && Math.abs(s) < eps) multiple = true; }));
    return { C, a, b, m, n, dummy, vogel: vlog, zeros, initial, initialCost: costOf(initial), iters, final, multiple };
  }

  /* ---------- 指派问题：枚举求精确最优（n ≤ 9） ---------- */
  function assignment(M, mode = 'min') {
    const n = M.length;
    if (!n || M.some((r) => r.length !== n)) throw new Error('需要一个方阵');
    if (n > 9) throw new Error('为了在浏览器里快速算完，这里最多支持 9×9');
    const sgn = mode === 'max' ? -1 : 1;
    let best = Infinity, bestP = null;
    const used = new Array(n).fill(false), cur = [];
    (function dfs(i, acc) {
      if (i === n) { const v = sgn * acc; if (v < best) { best = v; bestP = cur.slice(); } return; }
      for (let j = 0; j < n; j++) if (!used[j]) { used[j] = true; cur.push(j); dfs(i + 1, acc + M[i][j]); cur.pop(); used[j] = false; }
    })(0, 0);
    const base = mode === 'max' ? M.map((r) => r.map((x) => Math.max(...M.flat()) - x)) : M.map((r) => r.slice());
    const rr = base.map((r) => { const mn = Math.min(...r); return r.map((x) => x - mn); });
    const red = rr.map((r) => r.slice());
    for (let j = 0; j < n; j++) { const mn = Math.min(...rr.map((r) => r[j])); for (let i = 0; i < n; i++) red[i][j] = rr[i][j] - mn; }
    return { assign: bestP, total: bestP.reduce((s, j, i) => s + M[i][j], 0), reduced: red, converted: mode === 'max' ? base : null };
  }

  /* ---------- 排队论 ---------- */
  function fact(k) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; }
  function queue(model, lam, mu, c = 1, N = 10) {
    if (!(lam > 0 && mu > 0)) throw new Error('λ 和 μ 都要大于 0');
    const out = { model };
    if (model === 'mm1') {
      const r = lam / mu; out.rho = r;
      if (r >= 1) { out.unstable = true; return out; }
      Object.assign(out, { P0: 1 - r, L: r / (1 - r), Lq: (r * r) / (1 - r), W: 1 / (mu - lam), Wq: r / (mu - lam), Pwait: r });
    } else if (model === 'mm1n') {
      const r = lam / mu; out.rho = r;
      const P = []; let s = 0;
      for (let k = 0; k <= N; k++) { P.push(r ** k); s += r ** k; }
      for (let k = 0; k <= N; k++) P[k] /= s;
      const L = P.reduce((t, p, k) => t + k * p, 0), le = lam * (1 - P[N]), Lq = L - (1 - P[0]);
      Object.assign(out, { P0: P[0], PN: P[N], lamE: le, L, Lq, W: L / le, Wq: Lq / le });
    } else {
      const a = lam / mu, r = a / c; out.rho = r; out.a = a;
      if (r >= 1) { out.unstable = true; return out; }
      let s = 0; for (let k = 0; k < c; k++) s += a ** k / fact(k);
      const tail = a ** c / (fact(c) * (1 - r));
      const P0 = 1 / (s + tail), Lq = (a ** c * r) / (fact(c) * (1 - r) ** 2) * P0;
      Object.assign(out, { P0, Pwait: tail * P0, Lq, L: Lq + a, Wq: Lq / lam, W: Lq / lam + 1 / mu });
    }
    return out;
  }

  root.ORSolvers = { Q, MV, parseLP, simplex, transport, assignment, queue, fmtQ };
  if (typeof module !== 'undefined') module.exports = root.ORSolvers;
})(typeof window !== 'undefined' ? window : globalThis);
