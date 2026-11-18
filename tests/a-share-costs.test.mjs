// Tests for tools/a-share-costs/a-share-costs-core.mjs.  Run: node --test tests/a-share-costs.test.mjs
// Expected values are worked out by hand in the comments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIMES, regimeOn, cents, sharesFor, legCost, roundTrip, minBindsBelow, annualDrag, costCurve, PRESETS } from '../tools/a-share-costs/a-share-costs-core.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const CUR = regimeOn('2026-11-17');

test('regimes: dates and statutory rates', () => {
  assert.equal(CUR.id, '2023-08-28'); assert.equal(regimeOn('2023-08-28').id, '2023-08-28');
  assert.equal(regimeOn('2023-08-27').id, '2022-04-29'); assert.equal(regimeOn('2022-04-29').id, '2022-04-29');
  assert.equal(regimeOn('2022-04-28').id, '2015-08-01'); assert.equal(regimeOn('2015-08-01').id, '2015-08-01');
  assert.equal(regimeOn('2015-07-31'), null);
  close(CUR.stamp, 0.0005); close(CUR.handling + CUR.mgmt, 0.0000541); close(CUR.transfer, 0.00001);
  close(regimeOn('2020-01-02').stamp, 0.001); close(regimeOn('2020-01-02').transfer, 0.00002);
  for (let i = 1; i < REGIMES.length; i++) assert.ok(REGIMES[i].to < REGIMES[i - 1].from);
});

test('sharesFor: lots of 100, STAR minimum 200 then steps of 1', () => {
  assert.equal(sharesFor(10000, 12.34), 800);        // 810.37 -> 800
  assert.equal(sharesFor(1000, 12.34), 0);           // 81 shares: below one lot
  assert.equal(sharesFor(10000, 12.34, 'star'), 810);
  assert.equal(sharesFor(2000, 12.34, 'star'), 0);   // 162 < 200
  assert.equal(sharesFor(10000, 10), 1000);          // exact, no float loss
});

test('legCost: retail buy of 100,000 CNY', () => {
  // commission 2.5 bp = 25.00, transfer 0.001% = 1.00, no stamp on buys
  const b = legCost({ value: 100000, side: 'buy', commission: 0.00025, minCommission: 5, regime: CUR });
  assert.equal(b.commission, 25); assert.equal(b.transfer, 1); assert.equal(b.stamp, 0); assert.equal(b.regulatory, 0);
  close(b.total, 26); assert.equal(b.minBinding, false);
});

test('legCost: sell pays stamp duty; minimum commission binds on small orders', () => {
  // 10,000 sell: commission max(2.5, 5) = 5.00; transfer 0.10; stamp 0.05% = 5.00 -> 10.10
  const s = legCost({ value: 10000, side: 'sell', commission: 0.00025, minCommission: 5, regime: CUR });
  assert.equal(s.commission, 5); assert.equal(s.stamp, 5); assert.equal(s.transfer, 0.1); close(s.total, 10.1); assert.ok(s.minBinding);
  // before 2023-08-28 the same sell paid 10.00 stamp duty
  close(legCost({ value: 10000, side: 'sell', commission: 0.00025, minCommission: 5, regime: regimeOn('2023-01-03') }).total, 15.1);
});

test('legCost: fees charged separately and slippage', () => {
  // 1,000,000 buy, commission 0.8 bp = 80.00, handling 0.00341% = 34.10, mgmt 0.002% = 20.00, transfer 10.00, slippage 5 bp = 500
  const b = legCost({ value: 1e6, side: 'buy', commission: 0.00008, minCommission: 0, commissionIncludesFees: false, regime: CUR, slippageBps: 5 });
  assert.equal(b.commission, 80); close(b.regulatory, 54.1); assert.equal(b.transfer, 10); close(b.slippage, 500); close(b.total, 644.1);
});

test('roundTrip in bps', () => {
  // 100,000 retail: buy 26.00 + sell (25 + 1 + 50) = 102.00 -> 10.2 bp
  const rt = roundTrip({ value: 100000, commission: 0.00025, minCommission: 5, regime: CUR });
  close(rt.total, 102); close(rt.bps, 10.2);
  // mid-2021: stamp 100 instead of 50, transfer 2.00 a side instead of 1.00 -> 154.00 = 15.4 bp
  close(roundTrip({ value: 100000, commission: 0.00025, minCommission: 5, regime: regimeOn('2021-06-01') }).bps, 15.4);
  assert.ok(Number.isNaN(roundTrip({ value: 0, commission: 0.00025, minCommission: 5, regime: CUR }).bps));
});

test('minimum commission threshold and the cost curve', () => {
  close(minBindsBelow(0.00025, 5), 20000); assert.equal(minBindsBelow(0.0001, 0), 0);
  const c = costCurve({ commission: 0.00025, minCommission: 5, regime: CUR });
  assert.equal(c.length, 81); close(c[0].value, 1000); close(c[80].value, 1e7);
  assert.ok(c[0].bps > c[80].bps);                    // small orders cost more because of the minimum
  close(c[80].bps, 10.2, 1e-3);                       // large orders converge to 2*2.5 + 2*0.1 + 5 bp
});

test('annualDrag = turnover x round-trip cost', () => {
  const d = annualDrag({ value: 100000, commission: 0.00025, minCommission: 5, regime: CUR }, 8, 1e6);
  close(d.fraction, 8 * 0.00102); close(d.cny, 8160); close(d.roundTripBps, 10.2);
});

test('presets are well formed', () => {
  for (const p of Object.values(PRESETS)) { assert.ok(p.commission > 0 && p.commission < 0.003); assert.ok(p.minCommission >= 0); }
  assert.equal(cents(1.005), 1.01); assert.equal(cents(0.004), 0);
});
