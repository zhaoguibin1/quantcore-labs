// Strategy capacity calculator: pure computation, no DOM. Imported by the page and by tests/capacity.test.mjs.
//
// A portfolio of AUM A holds weights w_i. It trades a share tau of its value one way at each rebalance
// (tau = annual one-way turnover T x days between rebalances k / trading days per year P), spread pro rata,
// so each name is bought or sold for q_i = A x w_i x tau, and the trade is worked over d days.
//
//   participation p_i(A) = q_i / (d x ADV_i)
//   capacity (participation cap c) = min_i  c x d x ADV_i / (w_i x tau)
//   impact cost of one trade (square-root law) = Y x sigma_i x sqrt(q_i / (d x ADV_i))   as a share of q_i
//   annual impact drag = (P / k) x 2 x sum_i w_i x tau x Y x sigma_i x sqrt(q_i / (d x ADV_i))
//                      = 2 T x sum_i w_i x Y x sigma_i x sqrt(A x w_i x tau / (d x ADV_i))     (grows with sqrt(A))
// The factor 2 counts the buy and the sell that make up one unit of one-way turnover.

export function parseHoldings(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = []; let skipped = 0, header = false;
  const num = s => { const t = String(s ?? '').trim().replace(/,/g, '').replace(/%$/, ''); const v = Number(t); return t === '' ? NaN : v; };
  lines.forEach((line, i) => {
    const p = /[\t;]/.test(line) ? line.split(/[\t;]/) : /,/.test(line) ? line.split(',') : line.split(/\s+/);
    if (p.length < 3) { skipped++; return; }
    const w = num(p[1]), adv = num(p[2]), vol = p.length > 3 ? num(p[3]) : NaN;
    if (i === 0 && !Number.isFinite(w) && !Number.isFinite(adv)) { header = true; return; }
    if (!p[0].trim() || !(w > 0) || !(adv > 0)) { skipped++; return; }
    rows.push({ asset: p[0].trim(), w, adv, vol: vol > 0 ? vol : NaN });
  });
  if (!rows.length) return { rows, skipped, header, error: 'No valid rows. Expected: asset, weight, average daily traded value (CNY)[, daily volatility].' };
  const tot = rows.reduce((s, r) => s + r.w, 0);
  rows.forEach(r => { r.w = r.w / tot; });          // weights are normalised to sum to 1
  return { rows, skipped, header, weightSum: tot, error: null };
}

// opts: { turnover T (one-way, per year), every k (trading days between rebalances), days d (days to work a trade),
//         cap c (max participation), Y (impact coefficient), sigma (default daily vol), P (trading days per year) }
export function setup(rows, o) {
  const P = o.P ?? 242, k = Math.max(1, o.every ?? 10), d = Math.max(1, o.days ?? 1);
  const tau = Math.min(1, (o.turnover ?? 8) * k / P);
  return { P, k, d, tau, T: tau * P / k, c: o.cap ?? 0.05, Y: o.Y ?? 0.7, sigma: o.sigma ?? 0.025,
           rows: rows.map(r => ({ ...r, sig: Number.isFinite(r.vol) ? r.vol : (o.sigma ?? 0.025) })) };
}

export function capacity(S) {
  let best = Infinity, bind = null;
  const per = S.rows.map(r => {
    const a = S.c * S.d * r.adv / (r.w * S.tau);
    if (a < best) { best = a; bind = r.asset; }
    return { asset: r.asset, cap: a };
  }).sort((x, y) => x.cap - y.cap);
  return { aum: best, binding: bind, perName: per };
}

// Share of the trade value that fits under the participation cap at AUM A.
export function shareWithinCap(S, A) {
  let ok = 0;
  for (const r of S.rows) { const q = A * r.w * S.tau; ok += r.w * Math.min(1, S.c * S.d * r.adv / q); }
  return ok;
}

export function impactDrag(S, A) {
  let s = 0;
  for (const r of S.rows) s += r.w * S.Y * r.sig * Math.sqrt(A * r.w * S.tau / (S.d * r.adv));
  return 2 * S.T * s;     // share of AUM per year
}

export function maxParticipation(S, A) {
  let m = 0; for (const r of S.rows) m = Math.max(m, A * r.w * S.tau / (S.d * r.adv)); return m;
}

// AUM at which annual impact drag equals a given share of gross alpha (drag ~ sqrt(A), so closed form).
export function aumForDrag(S, target) {
  const unit = impactDrag(S, 1);        // drag at A = 1 CNY
  return unit > 0 && target > 0 ? (target / unit) ** 2 : Infinity;
}

export function curve(S, lo, hi, n = 61) {
  const out = [];
  for (let i = 0; i < n; i++) { const A = lo * Math.pow(hi / lo, i / (n - 1)); out.push({ aum: A, drag: impactDrag(S, A), within: shareWithinCap(S, A) }); }
  return out;
}

// Deterministic sample: 30 equal-weight A-share names with daily traded value spread like a small/mid-cap book.
export function sampleHoldings(n = 30, seed = 20261117) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const z = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const out = ['asset,weight,adv20_cny,daily_vol'];
  for (let i = 0; i < n; i++) {
    const adv = Math.round(Math.exp(Math.log(1.2e8) + 0.8 * z()) / 1e5) * 1e5;
    const vol = (0.022 + 0.006 * Math.abs(z())).toFixed(4);
    out.push(`S${String(i + 1).padStart(2, '0')},${(1 / n).toFixed(4)},${adv},${vol}`);
  }
  return out.join('\n');
}
