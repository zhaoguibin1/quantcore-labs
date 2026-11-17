// Tests for tools/factor-ic/factor-ic-core.mjs.  Run: node --test tests/factor-ic.test.mjs
// Reference numbers come from pandas / SciPy (spearmanr, pearsonr, rank(method="average")) on the panel below;
// the panel has tied factor values and one date with too few assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRows, parseDate, rankAvg, pearson, bucketOf, analyse, samplePanel, stdev } from '../tools/factor-ic/factor-ic-core.mjs';

const PANEL = `date,asset,factor,fwd_return
2025-01-31,S00,0.0,-0.004
2025-01-31,S01,0.3,-0.049
2025-01-31,S02,-0.27,-0.012
2025-01-31,S03,-0.89,-0.006
2025-01-31,S04,-0.45,-0.0
2025-01-31,S05,-0.99,-0.037
2025-01-31,S06,0.06,-0.009
2025-01-31,S07,1.34,-0.012
2025-01-31,S08,-0.49,-0.019
2025-01-31,S09,-0.62,0.017
2025-01-31,S10,0.49,-0.013
2025-01-31,S11,0.36,0.002
2025-01-31,S12,0.11,0.018
2025-01-31,S13,-0.93,-0.017
2025-01-31,S14,-0.03,-0.002
2025-01-31,S15,0.7,0.006
2025-01-31,S16,-1.34,-0.007
2025-01-31,S17,-0.46,-0.027
2025-01-31,S18,-1.9,-0.01
2025-01-31,S19,-1.29,0.019
2025-01-31,S20,-1.84,-0.042
2025-01-31,S21,-0.24,0.016
2025-01-31,S22,-1.27,-0.005
2025-01-31,S23,0.27,-0.011
2025-01-31,S24,0.16,0.041
2025-02-28,S00,0.76,0.018
2025-02-28,S01,-1.2,-0.014
2025-02-28,S02,0.07,-0.007
2025-02-28,S03,0.58,-0.002
2025-02-28,S04,-0.19,0.029
2025-02-28,S05,0.68,-0.004
2025-02-28,S06,-0.07,-0.006
2025-02-28,S07,0.67,0.011
2025-02-28,S08,1.44,0.006
2025-02-28,S09,-0.68,-0.008
2025-02-28,S10,0.2,-0.021
2025-02-28,S11,-0.46,-0.003
2025-02-28,S12,0.13,-0.008
2025-02-28,S13,-1.19,0.016
2025-02-28,S14,-0.58,0.01
2025-02-28,S15,-0.2,-0.002
2025-02-28,S16,0.9,0.019
2025-02-28,S17,1.15,0.0
2025-02-28,S18,-1.32,0.013
2025-02-28,S19,-0.79,-0.005
2025-02-28,S20,0.65,0.016
2025-02-28,S21,-1.99,-0.038
2025-02-28,S22,-0.46,0.004
2025-02-28,S23,-0.1,-0.034
2025-02-28,S24,1.26,-0.033
2025-03-31,S00,-0.3,0.005
2025-03-31,S01,-0.9,-0.048
2025-03-31,S02,0.16,0.018
2025-03-31,S03,2.24,-0.021
2025-03-31,S04,-0.83,0.01
2025-03-31,S05,-0.62,-0.021
2025-03-31,S06,0.21,0.017
2025-03-31,S07,0.49,0.006
2025-03-31,S08,-0.18,-0.032
2025-03-31,S09,-0.21,0.024
2025-03-31,S10,0.7,0.033
2025-03-31,S11,0.52,0.002
2025-03-31,S12,-1.03,-0.012
2025-03-31,S13,-0.08,-0.004
2025-03-31,S14,0.04,-0.019
2025-03-31,S15,-1.05,0.016
2025-03-31,S16,0.26,-0.009
2025-03-31,S17,-0.86,-0.006
2025-03-31,S18,0.97,-0.01
2025-03-31,S19,0.19,-0.011
2025-03-31,S20,0.09,-0.025
2025-03-31,S21,-0.59,0.022
2025-03-31,S22,-0.12,-0.004
2025-03-31,S23,-2.0,0.007
2025-03-31,S24,-1.13,-0.007
2025-04-30,S00,-0.69,-0.028
2025-04-30,S01,-0.33,0.025
2025-04-30,S02,-0.56,-0.014
2025-04-30,S03,0.01,0.006
2025-04-30,S04,-0.38,-0.003
2025-04-30,S05,-0.3,-0.011
2025-04-30,S06,-1.38,-0.018
2025-04-30,S07,-0.81,0.008
2025-04-30,S08,1.65,0.004
2025-04-30,S09,-0.67,-0.007
2025-04-30,S10,-1.05,-0.006
2025-04-30,S11,0.34,0.026
2025-04-30,S12,1.41,0.022
2025-04-30,S13,-1.45,-0.001
2025-04-30,S14,-0.21,-0.013
2025-04-30,S15,-0.63,-0.031
2025-04-30,S16,-1.76,0.008
2025-04-30,S17,0.73,0.024
2025-04-30,S18,-0.02,-0.003
2025-04-30,S19,0.07,0.011
2025-04-30,S20,-0.75,0.011
2025-04-30,S21,0.45,0.019
2025-04-30,S22,-0.54,0.015
2025-04-30,S23,-0.14,-0.01
2025-04-30,S24,-1.11,0.024
2025-05-31,S00,-1.25,0.001
2025-05-31,S01,0.86,-0.015
2025-05-31,S02,0.49,-0.01
2025-05-31,S03,0.87,-0.015
2025-05-31,S04,1.88,-0.006
2025-05-31,S05,1.48,0.013
2025-05-31,S06,-1.15,-0.023
2025-05-31,S07,-1.69,-0.003
2025-05-31,S08,0.82,0.012
2025-05-31,S09,-1.02,0.034
2025-05-31,S10,-0.01,-0.028
2025-05-31,S11,0.84,0.023
2025-05-31,S12,-1.64,-0.012
2025-05-31,S13,-2.11,-0.013
2025-05-31,S14,0.26,-0.027
2025-05-31,S15,0.04,-0.009
2025-05-31,S16,-0.25,0.013
2025-05-31,S17,0.04,-0.001
2025-05-31,S18,-0.86,-0.004
2025-05-31,S19,-1.51,-0.015
2025-05-31,S20,-0.17,0.022
2025-05-31,S21,-0.97,-0.006
2025-05-31,S22,-1.64,-0.054
2025-05-31,S23,0.51,-0.011
2025-05-31,S24,-0.06,-0.04
2025-06-30,S00,-3.25,-0.004
2025-06-30,S01,-0.53,0.004
2025-06-30,S02,1.33,-0.044
2025-06-30,S03,0.05,0.005
2025-06-30,S04,-1.17,-0.008
2025-06-30,S05,-0.94,-0.004
2025-06-30,S06,1.13,-0.015
2025-06-30,S07,0.16,-0.004
2025-06-30,S08,0.05,-0.003
2025-06-30,S09,-0.05,0.023
2025-06-30,S10,0.04,0.007
2025-06-30,S11,0.81,0.005
2025-06-30,S12,0.55,0.034
2025-06-30,S13,0.22,-0.01
2025-06-30,S14,-1.04,-0.014
2025-06-30,S15,0.51,-0.033
2025-06-30,S16,-0.68,0.027
2025-06-30,S17,1.09,0.026
2025-06-30,S18,-1.27,0.011
2025-06-30,S19,-0.14,0.013
2025-06-30,S20,-0.01,0.002
2025-06-30,S21,-1.32,-0.004
2025-06-30,S22,1.72,0.005
2025-06-30,S23,1.46,0.005
2025-06-30,S24,-0.46,-0.002
2025-07-31,S00,1.51,0.013
2025-07-31,S01,0.56,0.003
2025-07-31,S02,-0.06,-0.02
2025-07-31,S03,-0.58,0.006
2025-07-31,S04,-0.63,0.037
2025-07-31,S05,1.6,0.004
2025-07-31,S06,0.51,-0.001
2025-07-31,S07,0.07,-0.02
2025-07-31,S08,-0.35,0.004
2025-07-31,S09,-1.11,-0.032
2025-07-31,S10,-0.07,-0.023
2025-07-31,S11,0.87,0.031
2025-07-31,S12,-0.39,-0.02
2025-07-31,S13,-0.23,0.02
2025-07-31,S14,-0.22,0.029
2025-07-31,S15,0.11,0.006
2025-07-31,S16,-1.59,0.002
2025-07-31,S17,-0.24,0.038
2025-07-31,S18,-0.85,-0.009
2025-07-31,S19,0.88,-0.007
2025-07-31,S20,-0.77,-0.032
2025-07-31,S21,0.58,0.004
2025-07-31,S22,1.52,0.039
2025-07-31,S23,-0.31,0.017
2025-07-31,S24,-0.6,-0.022
2025-08-31,S00,-0.86,0.04
2025-08-31,S01,-0.5,0.001
2025-08-31,S02,0.29,-0.014
2025-08-31,S03,-0.21,-0.025
2025-08-31,S04,0.21,0.0
2025-08-31,S05,0.3,-0.002
2025-08-31,S06,-0.3,-0.025
2025-08-31,S07,-0.04,0.002
2025-08-31,S08,0.21,-0.022
2025-08-31,S09,-0.08,0.022
2025-08-31,S10,0.5,0.024
2025-08-31,S11,1.87,0.033
2025-08-31,S12,0.59,-0.006
2025-08-31,S13,0.06,0.011
2025-08-31,S14,-1.69,-0.013
2025-08-31,S15,0.39,-0.005
2025-08-31,S16,-1.95,-0.018
2025-08-31,S17,-1.41,-0.034
2025-08-31,S18,0.85,-0.024
2025-08-31,S19,0.71,0.02
2025-08-31,S20,-0.15,-0.005
2025-08-31,S21,-1.71,-0.006
2025-08-31,S22,-0.37,0.018
2025-08-31,S23,-0.68,-0.039
2025-08-31,S24,0.64,-0.012
2025-09-30,S00,1.0,0.01`;
const REF = {"n": 8, "rank_mean": 0.1806115709307094, "rank_std": 0.12438139445443126, "rank_icir": 1.4520786788322975, "rank_t": 4.107098722474881, "hit": 1.0, "pearson_mean": 0.18866121457546287, "spread_mean": 0.0102, "spread_t": 3.0245821153908383, "qmeans": [-0.0072749999999999985, -0.003575, 6.249999999999745e-06, -0.0013541666666666665, 0.0029249999999999996], "rank_ic": [0.13925755210477492, 0.1886066344489722, 0.010773375172220141, 0.3248653772474431, 0.14060096622544435, 0.030701114116175727, 0.33526073793357075, 0.27482681019707383], "mono": 0.8999999999999998, "ties": 5};
const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('rankAvg gives average ranks for ties', () => {
  assert.deepEqual(rankAvg([10, 20, 10, 30]), [1.5, 3, 1.5, 4]);
  assert.deepEqual(rankAvg([5, 5, 5]), [2, 2, 2]);
});

test('pearson and stdev basics', () => {
  close(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  close(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  assert.ok(Number.isNaN(pearson([1, 1, 1], [1, 2, 3])));
  close(stdev([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
});

test('bucketOf makes equal-count buckets and keeps ties together', () => {
  const b = Array.from({ length: 10 }, (_, i) => bucketOf(i + 1, 10, 5));
  assert.deepEqual(b, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(bucketOf(10, 10, 3), 2);
});

test('parseDate accepts the three documented formats and rejects impossible dates', () => {
  assert.equal(parseDate('2025-01-31'), Date.UTC(2025, 0, 31));
  assert.equal(parseDate('2025/1/31'), Date.UTC(2025, 0, 31));
  assert.equal(parseDate('20250131'), Date.UTC(2025, 0, 31));
  assert.equal(parseDate('2025-02-30'), null);
  assert.equal(parseDate('week3'), null);
});

test('parseRows: header, separators, percent, bad rows', () => {
  const p = parseRows('date\tasset\tfactor\tret\n2025-01-31\tA\t1.5\t2%\n2025-01-31;B;0.5;-1\n2025-01-31 C nan 3\nbroken,row\n', { returnsInPercent: true });
  assert.equal(p.header, true);
  assert.equal(p.rows.length, 2);
  assert.equal(p.skipped, 2);
  close(p.rows[0].r, 0.02); close(p.rows[1].r, -0.01);
  assert.ok(parseRows('').error);
});

test('analyse matches pandas / SciPy on a panel with ties', () => {
  const p = parseRows(PANEL);
  assert.equal(p.error, null);
  const a = analyse(p.rows, { minObs: 20, quantiles: 5, horizon: 1 });
  assert.equal(a.error, null);
  assert.equal(a.rank.n, REF.n);
  assert.equal(a.skippedDates, 1);
  a.rankIC.forEach((v, i) => close(v, REF.rank_ic[i]));
  close(a.rank.mean, REF.rank_mean); close(a.rank.std, REF.rank_std);
  close(a.rank.icir, REF.rank_icir); close(a.rank.t, REF.rank_t);
  close(a.rank.hit, REF.hit); close(a.pearson.mean, REF.pearson_mean);
  a.quantileMeans.forEach((v, i) => close(v, REF.qmeans[i]));
  close(a.spreadStats.mean, REF.spread_mean); close(a.spreadStats.t, REF.spread_t, 1e-10);
  close(a.monotonicity, REF.mono);
  close(a.spreadStats.annualised, REF.spread_mean * 252);
  close(a.cumRankIC[a.cumRankIC.length - 1], REF.rank_mean * REF.n, 1e-10);
});

test('horizon scales the t-stat by sqrt(1/h) and the annualised spread by 1/h', () => {
  const rows = parseRows(PANEL).rows;
  const a1 = analyse(rows, { horizon: 1 }), a5 = analyse(rows, { horizon: 5 });
  close(a5.rank.t, a1.rank.t / Math.sqrt(5)); close(a5.rank.mean, a1.rank.mean);
  close(a5.spreadStats.annualised, a1.spreadStats.annualised / 5);
});

test('dates are sorted when they parse, input order is kept when they do not', () => {
  const mk = (d, sign) => Array.from({ length: 20 }, (_, i) => ({ date: d, asset: 'A' + i, f: i, r: sign * i + (i % 3) }));
  const a = analyse([...mk('2025-03-31', 1), ...mk('2025-01-31', -1)], { minObs: 20 });
  assert.deepEqual(a.dates, ['2025-01-31', '2025-03-31']); assert.equal(a.sorted, true);
  assert.ok(a.rankIC[0] < 0 && a.rankIC[1] > 0);
  const b = analyse([...mk('w2', 1), ...mk('w1', -1)], { minObs: 20 });
  assert.deepEqual(b.dates, ['w2', 'w1']); assert.equal(b.sorted, false); assert.equal(b.years.length, 0);
});

test('duplicates keep the last row; too few assets is an error, not a crash', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ date: 'd', asset: 'A' + i, f: i, r: i }));
  rows.push({ date: 'd', asset: 'A0', f: 100, r: 100 });
  const a = analyse(rows, { minObs: 20 });
  assert.equal(a.duplicates, 1); close(a.rankIC[0], 1); assert.equal(a.nAssets[0], 20);
  assert.ok(analyse(rows.slice(0, 5), { minObs: 20 }).error);
  const flat = rows.slice(0, 20).map(x => ({ ...x, f: 1 }));
  assert.ok(analyse(flat, { minObs: 20 }).error);          // constant factor: IC undefined on every date
});

test('per-year table and sample panel', () => {
  const p = parseRows(samplePanel());
  assert.equal(p.error, null); assert.equal(p.rows.length, 72 * 60);
  const a = analyse(p.rows, {});
  assert.equal(a.rank.n, 72); assert.equal(a.years.length, 6);
  assert.equal(a.years.reduce((s, y) => s + y.n, 0), 72);
  assert.ok(a.rank.mean > 0.02 && a.rank.mean < 0.12, String(a.rank.mean));
  assert.equal(samplePanel(), samplePanel());                // deterministic
});
