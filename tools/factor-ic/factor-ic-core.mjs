// Factor IC analyzer: pure computation, no DOM. Imported by the page and by tests/factor-ic.test.mjs.
// Conventions match /glossary/information-coefficient/: average ranks for ties, ICIR = mean / sample std,
// t-stat = ICIR * sqrt(n / horizon), dates with fewer than minObs valid assets are skipped.

export function parseDate(s) {
  const m = /^(\d{4})[-\/.]?(\d{1,2})[-\/.]?(\d{1,2})(?:[ T].*)?$/.exec(String(s).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  return new Date(t).getUTCDate() === d ? t : null;
}

function num(s) {
  const t = String(s).trim().replace(/%$/, '');
  if (t === '' || /^(nan|na|null|none|-)$/i.test(t)) return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

// Rows: date, asset, factor, forward return. Separators: comma, tab, semicolon or runs of spaces.
// Returns { rows: [{date, asset, f, r}], skipped, header, error }.
export function parseRows(text, opts = {}) {
  const scale = opts.returnsInPercent ? 0.01 : 1;
  const lines = String(text).split(/\r?\n/);
  const rows = [];
  let skipped = 0, header = false, seen = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = /[,;\t]/.test(line) ? line.split(/[,;\t]/) : line.split(/\s+/);
    seen++;
    if (parts.length < 4) { skipped++; continue; }
    const date = parts[0].trim(), asset = parts[1].trim();
    const f = num(parts[2]), r = num(parts[3]);
    if (seen === 1 && Number.isNaN(f) && Number.isNaN(r) && parseDate(date) === null) { header = true; continue; }
    if (!date || !asset) { skipped++; continue; }
    if (Number.isNaN(f) || Number.isNaN(r)) { skipped++; continue; }
    rows.push({ date, asset, f, r: r * scale });
  }
  if (!rows.length) return { rows, skipped, header, error: 'No valid rows. Expected: date, asset, factor, forward return.' };
  return { rows, skipped, header, error: null };
}

// Average ranks, 1-based (ties share the mean of their positions), like pandas rank(method="average").
export function rankAvg(x) {
  const n = x.length, idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
  const out = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

export function pearson(a, b) {
  const n = a.length;
  if (n < 2) return NaN;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  const den = Math.sqrt(saa * sbb);
  return den > 0 ? sab / den : NaN;
}

export function mean(x) { let s = 0; for (const v of x) s += v; return x.length ? s / x.length : NaN; }
export function stdev(x) {
  const n = x.length;
  if (n < 2) return NaN;
  const m = mean(x);
  let s = 0;
  for (const v of x) s += (v - m) * (v - m);
  return Math.sqrt(s / (n - 1));
}

// Quantile bucket (0 = lowest factor) from an average rank: equal-count buckets, tied values share a bucket.
export function bucketOf(rank, n, q) { return Math.min(q - 1, Math.floor(q * (rank - 0.5) / n)); }

function seriesStats(x, horizon) {
  const v = x.filter(Number.isFinite), n = v.length, m = mean(v), s = stdev(v);
  const icir = s > 0 ? m / s : NaN;
  return { n, mean: m, std: s, icir, t: icir * Math.sqrt(n / horizon), hit: n ? v.filter(z => z > 0).length / n : NaN,
           min: n ? Math.min(...v) : NaN, max: n ? Math.max(...v) : NaN };
}

// Main entry. rows: [{date, asset, f, r}]. opts: { minObs=20, quantiles=5, horizon=1, periodsPerYear=252 }.
export function analyse(rows, opts = {}) {
  const minObs = Math.max(3, opts.minObs ?? 20), Q = opts.quantiles ?? 5, h = Math.max(1, opts.horizon ?? 1);
  const P = opts.periodsPerYear ?? 252;
  const byDate = new Map();
  let duplicates = 0;
  for (const row of rows) {
    let g = byDate.get(row.date);
    if (!g) { g = new Map(); byDate.set(row.date, g); }
    if (g.has(row.asset)) duplicates++;
    g.set(row.asset, row);            // a repeated (date, asset) keeps the last row
  }
  const keys = [...byDate.keys()];
  const parsed = keys.map(parseDate), allDates = parsed.every(t => t !== null);
  const order = keys.map((k, i) => i);
  if (allDates) order.sort((a, b) => parsed[a] - parsed[b]);
  const dates = [], ms = [], nAssets = [], rankIC = [], pearsonIC = [], spread = [];
  const qSum = new Array(Q).fill(0), qCnt = new Array(Q).fill(0);
  let skippedDates = 0;
  for (const i of order) {
    const g = [...byDate.get(keys[i]).values()], n = g.length;
    if (n < Math.max(minObs, Q)) { skippedDates++; continue; }
    const f = g.map(x => x.f), r = g.map(x => x.r);
    const rf = rankAvg(f), rr = rankAvg(r);
    const ric = pearson(rf, rr), pic = pearson(f, r);
    if (!Number.isFinite(ric)) { skippedDates++; continue; }     // constant factor or constant return on that date
    const s = new Array(Q).fill(0), c = new Array(Q).fill(0);
    for (let k = 0; k < n; k++) { const b = bucketOf(rf[k], n, Q); s[b] += r[k]; c[b]++; }
    for (let b = 0; b < Q; b++) if (c[b]) { qSum[b] += s[b] / c[b]; qCnt[b]++; }
    dates.push(keys[i]); ms.push(allDates ? parsed[i] : null); nAssets.push(n);
    rankIC.push(ric); pearsonIC.push(pic);
    spread.push(c[Q - 1] && c[0] ? s[Q - 1] / c[Q - 1] - s[0] / c[0] : NaN);
  }
  if (!dates.length) {
    return { error: `No date has at least ${Math.max(minObs, Q)} assets with both a factor value and a return.`,
             skippedDates, duplicates };
  }
  const quantileMeans = qSum.map((v, b) => (qCnt[b] ? v / qCnt[b] : NaN));
  const sp = seriesStats(spread, h);
  const cum = []; let acc = 0;
  for (const v of rankIC) { acc += v; cum.push(acc); }
  const qi = quantileMeans.map((_, b) => b + 1).filter((_, b) => Number.isFinite(quantileMeans[b]));
  const qv = quantileMeans.filter(Number.isFinite);
  const years = [];
  if (allDates) {
    const m = new Map();
    ms.forEach((t, i) => { const y = new Date(t).getUTCFullYear(); if (!m.has(y)) m.set(y, []); m.get(y).push(rankIC[i]); });
    for (const [y, v] of m) years.push({ year: y, ...seriesStats(v, h) });
  }
  return {
    error: null, dates, ms, nAssets, rankIC, pearsonIC, spread, cumRankIC: cum, quantileMeans, years,
    rank: seriesStats(rankIC, h), pearson: seriesStats(pearsonIC, h),
    spreadStats: { ...sp, annualised: sp.mean * P / h },
    monotonicity: qv.length >= 3 ? pearson(rankAvg(qi), rankAvg(qv)) : NaN,
    avgAssets: mean(nAssets), skippedDates, duplicates, sorted: allDates,
    opts: { minObs, quantiles: Q, horizon: h, periodsPerYear: P },
  };
}

// Deterministic sample panel (mulberry32 + Box-Muller): nDates x nAssets, true rank IC around 0.06.
export function samplePanel(nDates = 72, nAssets = 60, seed = 20261116) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const z = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const out = ['date,asset,factor,fwd_return'];
  let t = Date.UTC(2021, 0, 29);
  for (let d = 0; d < nDates; d++) {
    const dt = new Date(t), mkt = 0.01 * z(), strength = 0.06 + 0.05 * z();
    const ds = dt.toISOString().slice(0, 10);
    for (let i = 0; i < nAssets; i++) {
      const f = z(), r = mkt + 0.08 * (strength * f + Math.sqrt(1 - Math.min(0.9, strength * strength)) * z());
      out.push(`${ds},A${String(i + 1).padStart(3, '0')},${f.toFixed(4)},${r.toFixed(5)}`);
    }
    t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 2, 0);     // next month-end
  }
  return out.join('\n');
}
