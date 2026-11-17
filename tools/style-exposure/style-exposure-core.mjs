// Style exposure analyzer: pure computation, no DOM. Imported by the page and by tests/style-exposure.test.mjs.
// For each date, every characteristic is turned into a 0-100 percentile inside the pasted universe
// (average ranks, (rank - 0.5) / n). A portfolio's exposure is the weighted mean percentile of its holdings:
// 50 = same as the universe. The size-adjusted version ranks inside size buckets instead of the whole universe.

export function parseDate(s) {
  const m = /^(\d{4})[-\/.]?(\d{1,2})[-\/.]?(\d{1,2})(?:[ T].*)?$/.exec(String(s).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  return new Date(t).getUTCDate() === d ? t : null;
}

function num(s) {
  const t = String(s ?? '').trim().replace(/%$/, '');
  if (t === '' || /^(nan|na|null|none|-)$/i.test(t)) return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

const SIZE_NAMES = /^(size|mcap|market_?cap|mktcap|float_?mcap|log_?mcap|cap)$/i;

// Header row is required. Columns: [date,] asset, weight, then one or more numeric characteristics.
// The date column is recognised by its header name ("date", "dt", "trade_date", "day").
// Returns { hasDate, chars: [names], sizeGuess, rows: [{date, asset, w, x: [..]}], skipped, error }.
export function parseTable(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: 'Paste a header row and at least one data row.' };
  const split = l => (/[,;\t]/.test(l) ? l.split(/[,;\t]/) : l.split(/\s+/)).map(s => s.trim());
  const head = split(lines[0]);
  const hasDate = /^(date|dt|trade_?date|day)$/i.test(head[0]);
  const base = hasDate ? 3 : 2;
  if (head.length < base + 1) {
    return { error: 'Header needs: ' + (hasDate ? 'date, ' : '') + 'asset, weight, then at least one characteristic column.' };
  }
  if (head.slice(base).some(h => h === '') || head.some((h, i) => i >= base && Number.isFinite(num(h)))) {
    return { error: 'The first row must be a header with a name for every characteristic column.' };
  }
  const chars = head.slice(base);
  if (new Set(chars).size !== chars.length) return { error: 'Characteristic column names must be unique.' };
  const rows = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const p = split(lines[i]);
    if (p.length < base) { skipped++; continue; }
    const date = hasDate ? p[0] : '(snapshot)', asset = p[base - 2];
    if (!asset || (hasDate && !date)) { skipped++; continue; }
    const w = num(p[base - 1]);
    rows.push({ date, asset, w: Number.isFinite(w) && w > 0 ? w : 0, x: chars.map((_, k) => num(p[base + k])) });
  }
  if (!rows.length) return { error: 'No readable data rows.' };
  const g = chars.findIndex(c => SIZE_NAMES.test(c));
  return { hasDate, chars, sizeGuess: g, rows, skipped, error: null };
}

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

// Percentile 0-100 of each finite value among the positions listed in `pos`; NaN elsewhere.
// Fewer than minN finite values -> all NaN.
export function percentiles(values, pos, minN = 20) {
  const out = new Array(values.length).fill(NaN);
  const ok = pos.filter(i => Number.isFinite(values[i]));
  if (ok.length < minN) return out;
  const r = rankAvg(ok.map(i => values[i]));
  ok.forEach((i, k) => { out[i] = (r[k] - 0.5) / ok.length * 100; });
  return out;
}

// Size bucket (0 = smallest) per position, or -1. Needs at least buckets * minN finite sizes.
export function sizeBuckets(size, buckets = 10, minN = 20) {
  const out = new Array(size.length).fill(-1);
  const ok = [];
  size.forEach((v, i) => { if (Number.isFinite(v)) ok.push(i); });
  if (ok.length < buckets * minN) return out;
  const r = rankAvg(ok.map(i => size[i]));
  ok.forEach((i, k) => { out[i] = Math.min(buckets - 1, Math.floor(buckets * (r[k] - 0.5) / ok.length)); });
  return out;
}

function wmean(v, w) {
  let s = 0, t = 0;
  for (let i = 0; i < v.length; i++) if (w[i] > 0 && Number.isFinite(v[i])) { s += v[i] * w[i]; t += w[i]; }
  return t > 0 ? s / t : NaN;
}
const mean = x => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);

export function tilt(p) {
  if (!Number.isFinite(p)) return '–';
  const d = p - 50;
  return d >= 10 ? 'clearly high' : d >= 4 ? 'high' : d <= -10 ? 'clearly low' : d <= -4 ? 'low' : 'near universe';
}

// table: result of parseTable. opts: { sizeCol (index into chars, -1 = none), buckets=10, equalWeight=false,
//                                      minUniverse=50, minHoldings=3 }
export function analyse(table, opts = {}) {
  const { chars, rows } = table;
  const sizeCol = opts.sizeCol ?? table.sizeGuess ?? -1, B = opts.buckets ?? 10;
  const minU = Math.max(20, opts.minUniverse ?? 50), minH = Math.max(1, opts.minHoldings ?? 3), eq = !!opts.equalWeight;
  const byDate = new Map();
  let duplicates = 0;
  for (const r of rows) {
    let g = byDate.get(r.date);
    if (!g) { g = new Map(); byDate.set(r.date, g); }
    if (g.has(r.asset)) duplicates++;
    g.set(r.asset, r);
  }
  const keys = [...byDate.keys()], parsed = keys.map(parseDate), sorted = table.hasDate && parsed.every(t => t !== null);
  const order = keys.map((_, i) => i);
  if (sorted) order.sort((a, b) => parsed[a] - parsed[b]);
  const dates = [], nUniverse = [], nHeld = [];
  const raw = chars.map(() => []), adj = chars.map(() => []), cov = chars.map(() => []);
  let skippedDates = 0, sizeAdjDates = 0;
  for (const di of order) {
    const g = [...byDate.get(keys[di]).values()], n = g.length;
    const w = g.map(r => (r.w > 0 ? (eq ? 1 : r.w) : 0)), held = w.filter(v => v > 0).length;
    if (n < minU || held < minH) { skippedDates++; continue; }
    const all = g.map((_, i) => i);
    const bucket = sizeCol >= 0 ? sizeBuckets(g.map(r => r.x[sizeCol]), B) : null;
    const haveBuckets = !!bucket && bucket.some(b => b >= 0);
    if (haveBuckets) sizeAdjDates++;
    const wsum = w.reduce((a, b) => a + b, 0);
    chars.forEach((_, k) => {
      const v = g.map(r => r.x[k]);
      raw[k].push(wmean(percentiles(v, all), w));
      let a = NaN;
      if (haveBuckets) {
        const p = new Array(n).fill(NaN);
        for (let b = 0; b < B; b++) {
          const pb = percentiles(v, all.filter(i => bucket[i] === b));
          for (let i = 0; i < n; i++) if (Number.isFinite(pb[i])) p[i] = pb[i];
        }
        a = wmean(p, w);
      }
      adj[k].push(a);
      let c = 0;
      for (let i = 0; i < n; i++) if (w[i] > 0 && Number.isFinite(v[i])) c += w[i];
      cov[k].push(c / wsum);
    });
    dates.push(keys[di]); nUniverse.push(n); nHeld.push(held);
  }
  if (!dates.length) {
    return { error: `No date has at least ${minU} assets in the universe and ${minH} holdings (weight > 0).`, skippedDates, duplicates };
  }
  const fin = x => x.filter(Number.isFinite);
  const summary = chars.map((name, k) => {
    const r = fin(raw[k]), a = fin(adj[k]);
    return { name, raw: mean(r), adj: mean(a), coverage: mean(cov[k]),
             shareAbove50: (a.length ? a : r).filter(v => v > 50).length / Math.max(1, (a.length ? a : r).length),
             basis: a.length ? 'adj' : 'raw', nDates: r.length };
  });
  return { error: null, chars, dates, raw, adj, coverage: cov, summary, nUniverse, nHeld, skippedDates, duplicates, sorted,
           sizeAdjDates, opts: { sizeCol, buckets: B, equalWeight: eq, minUniverse: minU, minHoldings: minH } };
}

// Deterministic sample: 12 month-ends x 400 assets; a 30-name portfolio tilted to cheap, small, low-volatility names.
export function sampleTable(nDates = 12, nAssets = 400, seed = 20261117) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const z = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const base = Array.from({ length: nAssets }, () => ({ s: 22 + 1.4 * z(), v: z(), q: z(), l: z() }));
  const out = ['date,asset,weight,book_to_price,roe,low_vol_60d,momentum_12m,mcap'];
  for (let d = 0; d < nDates; d++) {
    const ds = new Date(Date.UTC(2026, d + 1, 0)).toISOString().slice(0, 10);
    const A = base.map(b => {
      const lmc = b.s + 0.05 * z(), bp = Math.exp(-0.9 + 0.5 * (b.v + 0.2 * z()) - 0.12 * (lmc - 22));
      const roe = 0.08 + 0.07 * (b.q + 0.2 * z()) + 0.012 * (lmc - 22);
      const lv = -(0.30 + 0.08 * (-b.l + 0.3 * z()) - 0.03 * (lmc - 22));
      return { lmc, bp, roe, lv, mom: 0.08 + 0.3 * z() };
    });
    const score = A.map((x, i) => Math.log(x.bp) * 1.6 + x.lv * 9 - 0.35 * (x.lmc - 22) + 0.6 * z() + i * 1e-9);
    const top = new Set(score.map((s, i) => [s, i]).sort((p, q) => q[0] - p[0]).slice(0, 30).map(p => p[1]));
    A.forEach((x, i) => {
      const w = top.has(i) ? (0.02 + 0.03 * u()).toFixed(4) : '0';
      const roe = u() < 0.03 ? '' : x.roe.toFixed(4);
      out.push(`${ds},S${String(i + 1).padStart(3, '0')},${w},${x.bp.toFixed(4)},${roe},${x.lv.toFixed(4)},${x.mom.toFixed(4)},${Math.exp(x.lmc).toFixed(0)}`);
    });
  }
  return out.join('\n');
}
