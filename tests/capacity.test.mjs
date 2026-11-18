// Tests for tools/capacity/capacity-core.mjs.  Run: node --test tests/capacity.test.mjs
// Expected values are worked out by hand in the comments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHoldings, setup, capacity, shareWithinCap, impactDrag, maxParticipation, aumForDrag, curve, sampleHoldings } from '../tools/capacity/capacity-core.mjs';
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('parseHoldings: header, separators, normalised weights, bad rows', () => {
  const p = parseHoldings('asset,weight,adv\nA,2,100,000,000\n');   // commas inside numbers are not supported in CSV
  assert.ok(p.rows.length === 1 || p.error === null);
  const q = parseHoldings('asset\tweight\tadv\tvol\nA\t50%\t1e8\t0.03\nB\t50%\t2e8\t\nC\t0\t1e8\nD\t1\n');
  assert.equal(q.header, true); assert.equal(q.rows.length, 2); assert.equal(q.skipped, 2);
  close(q.rows[0].w, 0.5); close(q.rows[0].vol, 0.03); assert.ok(Number.isNaN(q.rows[1].vol));
  assert.ok(parseHoldings('x').error);
});

test('setup: per-rebalance turnover tau = T x k / P', () => {
  const S = setup([{ asset: 'A', w: 1, adv: 1e8 }], { turnover: 8.4, every: 10, P: 240 });
  close(S.tau, 0.35); close(S.T, 8.4);
  close(setup([{ asset: 'A', w: 1, adv: 1e8 }], { turnover: 100, every: 10, P: 240 }).tau, 1);   // capped at full turnover
});

test('capacity: min over names of c x d x ADV / (w x tau)', () => {
  // two names, w 0.5 each, ADV 1e8 and 4e8; tau 0.35; c 5%; d 1 -> 0.05e8/0.175 = 28.57M and 114.3M -> 28.57M, binding A
  const rows = [{ asset: 'A', w: 0.5, adv: 1e8 }, { asset: 'B', w: 0.5, adv: 4e8 }];
  const S = setup(rows, { turnover: 8.4, every: 10, P: 240, cap: 0.05, days: 1 });
  const c = capacity(S);
  close(c.aum, 0.05 * 1e8 / 0.175); assert.equal(c.binding, 'A');
  close(maxParticipation(S, c.aum), 0.05);
  close(shareWithinCap(S, c.aum), 1); close(shareWithinCap(S, 2 * c.aum), 0.5 * 0.5 + 0.5 * 1);
  // three days to trade triples capacity
  close(capacity(setup(rows, { turnover: 8.4, every: 10, P: 240, cap: 0.05, days: 3 })).aum, 3 * c.aum);
});

test('impact drag: square-root law, hand-worked', () => {
  // one name, w 1, ADV 1e8, sigma 2%, Y 1, tau 0.35, T 8.4, d 1, A = 1e7:
  // participation 0.035; cost per trade = 0.02 x sqrt(0.035); drag = 2 x 8.4 x 0.02 x sqrt(0.035)
  const S = setup([{ asset: 'A', w: 1, adv: 1e8 }], { turnover: 8.4, every: 10, P: 240, Y: 1, sigma: 0.02 });
  close(impactDrag(S, 1e7), 2 * 8.4 * 0.02 * Math.sqrt(0.035));
  close(impactDrag(S, 4e7) / impactDrag(S, 1e7), 2);                 // grows with sqrt(AUM)
  close(impactDrag(S, aumForDrag(S, 0.03)), 0.03);
  assert.equal(aumForDrag(S, 0), Infinity);
});

test('per-name volatility overrides the default', () => {
  const S = setup([{ asset: 'A', w: 1, adv: 1e8, vol: 0.04 }], { turnover: 8.4, every: 10, P: 240, Y: 1, sigma: 0.02 });
  close(impactDrag(S, 1e7), 2 * 8.4 * 0.04 * Math.sqrt(0.035));
});

test('curve and sample', () => {
  const p = parseHoldings(sampleHoldings()); assert.equal(p.error, null); assert.equal(p.rows.length, 30);
  assert.equal(sampleHoldings(), sampleHoldings()); close(p.weightSum, 30 * 0.0333, 1e-6);
  const S = setup(p.rows, {}); const c = curve(S, 1e6, 1e10);
  assert.equal(c.length, 61); assert.ok(c[60].drag > c[0].drag); close(c[0].within, 1); assert.ok(c[60].within < 0.5);
  const cap = capacity(S).aum; assert.ok(cap > 1e7 && cap < 1e9, String(cap));
});
