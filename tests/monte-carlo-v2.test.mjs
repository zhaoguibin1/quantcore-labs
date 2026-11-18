import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMt19937, createNormalSampler, normalPair, uniformOpen,
} from '../tools/monte-carlo-asset-sim/mc-v2-rng.mjs';
import {
  analyticTerminal, createSimulation, createSimulationWithRng, drawdownAt, gbmStep, lossMetrics,
  prepareInput, quantileType7, sampleMean, simulate, totalStepsForProduct,
} from '../tools/monte-carlo-asset-sim/mc-v2-core.mjs';

const input = {
  schemaVersion: 1, initialPrice: 100, annualDrift: 0.08, annualVolatility: 0.2,
  horizonYears: 0.25, stepsPerYear: 10, pathCount: 5, seed: 5489,
};
const golden = [3499211612, 581869302, 3890346734, 3586334585, 545404204];

function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.value;
}

function error(result, code, reason, field = null) {
  assert.deepEqual(result, { ok: false, error: { schemaVersion: 1, code, field, reason } });
}

function near(actual, expected, tolerance = 1e-12 + 1e-10 * Math.abs(expected)) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
}

test('P1-D01 / C04: MT19937 integer goldens and uint32 seed boundary', () => {
  const stream = createMt19937(5489);
  assert.deepEqual(golden.map(() => stream.nextUint32()), golden);
  for (const seed of [0, 4294967295]) {
    assert.equal(value(prepareInput({ ...input, seed })).input.seed, seed);
    assert.ok(Number.isInteger(createMt19937(seed).nextUint32()));
  }
  for (const seed of [-1, 4294967296, 0.5]) assert.throws(() => createMt19937(seed), RangeError);
});

test('P1-D02 / C04: open interval, Box–Muller goldens and consumption', () => {
  assert.equal(uniformOpen(0), 2 ** -33);
  assert.equal(uniformOpen(0xffffffff), 1 - 2 ** -33);
  const pair = [...normalPair(0.5, 0.25), ...normalPair(0.5, 0.5)];
  [0, 1.1774100225154747, -1.1774100225154747, 0].forEach((expected, i) =>
    near(pair[i], expected, 1e-12));
  // Independent direct substitution of the published integer goldens.
  const u1 = (3499211612 + 0.5) / 4294967296;
  const v1 = (581869302 + 0.5) / 4294967296;
  const u2 = (3890346734 + 0.5) / 4294967296;
  const v2 = (3586334585 + 0.5) / 4294967296;
  const expected = [
    Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * v1),
    Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * v1),
    Math.sqrt(-2 * Math.log(u2)) * Math.cos(2 * Math.PI * v2),
    Math.sqrt(-2 * Math.log(u2)) * Math.sin(2 * Math.PI * v2),
  ];
  let reads = 0;
  const sample = createNormalSampler(() => golden[reads++]);
  [2, 2, 4, 4].forEach((count, i) => {
    near(sample(), expected[i], 1e-12);
    assert.equal(reads, count);
  });
});

test('P1-D03 / C01: normal cache survives path and advance boundaries', () => {
  let reads = 0;
  const job = value(createSimulationWithRng(input, () => ({
    nextUint32: () => golden[(reads++) % golden.length],
  })));
  assert.equal(value(job.advance(3)).completedIncrements, 3);
  assert.equal(reads, 4);
  assert.equal(value(job.advance(1)).completedIncrements, 4);
  assert.equal(reads, 4);
  value(job.advance(100));
  assert.equal(reads, 16);
  const result = value(job.finish());
  const shock = Math.sqrt(-2 * Math.log((3890346734 + 0.5) / 4294967296))
    * Math.sin(2 * Math.PI * (3586334585 + 0.5) / 4294967296);
  near(result.plotData.prices[5], 100 * Math.exp(0.06 / 12 + 0.2 * Math.sqrt(1 / 12) * shock));
});

test('P1-D04 / C04-TEST-HOOK-01: production GBM step with fixed test shocks', () => {
  let logPrice = Math.log(100);
  let peak = logPrice;
  let mdd = 0;
  [0.6931471805599453, -0.6931471805599453, -0.6931471805599453].forEach((shock, i) => {
    logPrice = gbmStep(logPrice, 0, 1, shock);
    near(Math.exp(logPrice), [200, 100, 50][i]);
    mdd = Math.max(mdd, drawdownAt(logPrice, peak));
    peak = Math.max(peak, logPrice);
  });
  near(mdd, 0.75);
  error(createSimulation({ ...input, shocks: [0] }), 'INVALID_INPUT', 'UNKNOWN_FIELD');
  error(simulate({ ...input, shocks: [0] }), 'INVALID_INPUT', 'UNKNOWN_FIELD');
});

test('P1-D05 / C01: zero volatility advances logically without creating an RNG', () => {
  for (const [mu, terminal, mdd] of [[-0.6931471805599453, 50, 0], [0, 100, 0], [0.6931471805599453, 200, 0]]) {
    const job = value(createSimulationWithRng({
      ...input, annualVolatility: 0, annualDrift: mu, horizonYears: 1,
    }, () => assert.fail('zero volatility requested an RNG')));
    assert.deepEqual(value(job.advance(1)), {
      status: 'running', advancedIncrements: 1, completedIncrements: 1, totalIncrements: 50,
    });
    assert.equal(value(job.advance(50)).completedIncrements, 50);
    const result = value(job.finish());
    for (const price of result.pathData.terminalPrices) near(price, terminal);
    for (const drawdown of result.pathData.maxDrawdowns) near(drawdown, mu < 0 ? 0.5 : mdd);
    for (const key of ['mean', 'p5', 'p50', 'p95']) near(result.analyticTerminal[key], terminal);
    assert.equal(result.analyticTerminal.variance, 0);
    near(result.plotData.prices[10], terminal);
  }
});

test('P1-D06 / C04: Type 7, mean, signed loss and nonnegative VaR', () => {
  [0.05, 0.5, 0.95].forEach((p, i) => near(quantileType7([1, 2, 3, 4], p), [1.15, 2.5, 3.85][i]));
  const result = value(simulate({ ...input, initialPrice: 2.5, annualVolatility: 0, annualDrift: 0 }));
  assert.equal(result.summary.mean, 2.5);
  const tiny = value(simulate({ ...input, initialPrice: Number.MIN_VALUE, annualVolatility: 0, annualDrift: 0 }));
  for (const key of ['mean', 'p5', 'p50', 'p95']) assert.equal(tiny.summary[key], Number.MIN_VALUE);
  for (const [prices, p5, loss, var95, fraction] of [
    [[80, 100, 120], 82, 18, 18, 0.18],
    [[100, 100, 100], 100, 0, 0, 0],
    [[110, 120, 130], 111, -11, 0, 0],
  ]) {
    near(quantileType7(prices, 0.05), p5);
    const actual = lossMetrics(100, p5);
    near(actual.lossP95, loss);
    near(actual.var95, var95);
    near(actual.var95Fraction, fraction);
  }
});

test('P1-D04: independent positive-volatility analytic terminal reference', () => {
  const result = value(simulate({
    ...input, horizonYears: 1, annualDrift: 0.34657359027997265, annualVolatility: 0.8325546111576977,
  })).analyticTerminal;
  near(result.mean, 141.4213562373095);
  near(result.variance, 20000);
  near(result.p50, 100);
  const width = 1.6448536269514722 * Math.sqrt(Math.log(2));
  near(result.p5, 100 * Math.exp(-width));
  near(result.p95, 100 * Math.exp(width));
});

test('P1-D07 / C04: fixed discrete drawdown examples', () => {
  for (const [prices, expected] of [
    [[100, 120, 90, 110], 0.25], [[100, 110, 120], 0], [[100, 90, 80], 0.2],
  ]) {
    let peak = Math.log(prices[0]);
    let maximum = 0;
    for (const price of prices) {
      const logPrice = Math.log(price);
      maximum = Math.max(maximum, drawdownAt(logPrice, peak));
      peak = Math.max(peak, logPrice);
    }
    near(maximum, expected);
  }
});

test('P1-B01: ECMAScript rounding, terminal grid and joint budget', () => {
  [2.4999999999999996, 2.5, 2.5000000000000004].forEach((x, i) =>
    assert.equal(totalStepsForProduct(x), [2, 3, 3][i]));
  for (const [horizonYears, expected] of [[0.01, 2], [0.25, 3], [999.9375, 9999], [999.95, 10000]]) {
    assert.equal(value(prepareInput({ ...input, horizonYears })).derived.totalSteps, expected);
  }
  const result = value(simulate({ ...input, annualVolatility: 0, annualDrift: 1 }));
  near(result.plotData.prices[1], 100 * Math.exp(1 / 12));
  near(result.plotData.prices[3], 100 * Math.exp(0.25));
  assert.equal(result.plotData.prices.length, 20);
  assert.equal(value(prepareInput({ ...input, horizonYears: 1000, pathCount: 30 }))
    .derived.float64BufferBytes, 1921152);
  assert.equal(value(prepareInput({ ...input, horizonYears: 100, pathCount: 300 })).derived.totalSteps, 1000);
  error(prepareInput({ ...input, horizonYears: 1000.0625 }), 'BUDGET_EXCEEDED', 'STEP_LIMIT');
  error(prepareInput({ ...input, horizonYears: Number.MAX_VALUE }), 'BUDGET_EXCEEDED', 'STEP_LIMIT');
  error(createSimulationWithRng({ ...input, horizonYears: 100.1, pathCount: 10000 },  // 1001 steps x 10000 > 10,000,000
    () => assert.fail('budget must precede RNG construction')), 'BUDGET_EXCEEDED', 'TOTAL_INCREMENT_LIMIT');
});

test('C03: strict decimal schema, underflow and negative zero', () => {
  for (const token of [' +1 ', '01', '1.', '.5', '1e-2', '\t5e-324\n']) {
    assert.equal(value(prepareInput({ ...input, initialPrice: token })).input.initialPrice, Number(token));
  }
  for (const token of ['', '1 0', '0x10', '1_0', '１', '1,2', '8%', 'NaN', 'Infinity', '1e309']) {
    error(prepareInput({ ...input, initialPrice: token }), 'INVALID_INPUT', 'INVALID_NUMBER', 'initialPrice');
  }
  error(prepareInput({ ...input, initialPrice: '1e-400' }), 'INVALID_INPUT', 'DECIMAL_UNDERFLOW', 'initialPrice');
  for (const seed of ['-0', -0, '0e-400', '-0.0e999']) {
    assert.equal(value(prepareInput({ ...input, seed })).input.seed, 0);
  }
  assert.equal(value(prepareInput({ ...input, stepsPerYear: '1e2' })).input.stepsPerYear, 100);
  error(prepareInput({ ...input, seed: '1.5' }), 'INVALID_INPUT', 'NOT_INTEGER', 'seed');
  error(prepareInput({ ...input, seed: 4294967296 }), 'INVALID_INPUT', 'OUT_OF_RANGE', 'seed');
  error(prepareInput({ ...input, initialPrice: '-0' }), 'INVALID_INPUT', 'OUT_OF_RANGE', 'initialPrice');
});

test('C03: malformed records and deterministic error precedence', () => {
  error(prepareInput([]), 'INVALID_INPUT', 'INVALID_RECORD');
  error(prepareInput({ get schemaVersion() { assert.fail('getter invoked'); } }), 'INVALID_INPUT', 'INVALID_RECORD');
  assert.equal(value(prepareInput(Object.assign(Object.create(null), input))).input.seed, 5489);
  error(prepareInput({ unknown: 0 }), 'INVALID_INPUT', 'MISSING_FIELD', 'schemaVersion');
  error(prepareInput({ schemaVersion: '1', unknown: 0 }), 'INVALID_INPUT', 'UNSUPPORTED_VERSION', 'schemaVersion');
  error(prepareInput({ schemaVersion: 1, unknown: 0 }), 'INVALID_INPUT', 'UNKNOWN_FIELD');
  error(prepareInput({ schemaVersion: 1, initialPrice: 'bad' }), 'INVALID_INPUT', 'MISSING_FIELD', 'annualDrift');
  error(prepareInput({ ...input, initialPrice: 'bad', annualDrift: Infinity }), 'INVALID_INPUT', 'INVALID_NUMBER', 'initialPrice');
  error(prepareInput({ ...input, horizonYears: 1001, pathCount: 300, annualVolatility: 1e200 }),
    'BUDGET_EXCEEDED', 'STEP_LIMIT');
  error(prepareInput({ ...input, horizonYears: 101, pathCount: 10000, annualVolatility: 1e200 }),
    'BUDGET_EXCEEDED', 'TOTAL_INCREMENT_LIMIT');
});

test('P1-B02 / C01: numeric failures are stable and do not expose partial results', () => {
  error(prepareInput({ ...input, annualVolatility: 1e200 }), 'NUMERIC_RANGE', 'NONFINITE_COEFFICIENT');
  for (const [annualDrift, reason] of [[10000, 'PRICE_OVERFLOW'], [-10000, 'PRICE_UNDERFLOW']]) {
    const job = value(createSimulation({ ...input, annualVolatility: 0, annualDrift }));
    const failed = job.advance(1);
    error(failed, 'NUMERIC_RANGE', reason);
    failed.error.reason = 'external change';
    error(job.advance(0), 'NUMERIC_RANGE', reason);
    error(job.finish(), 'NUMERIC_RANGE', reason);
  }
  const job = value(createSimulation({ ...input, initialPrice: 1e200 }));
  value(job.advance(100));
  error(job.finish(), 'NUMERIC_RANGE', 'NONFINITE_STATISTIC');
  error(job.finish(), 'NUMERIC_RANGE', 'NONFINITE_STATISTIC');
});

test('C01/C02: progress, input snapshot, ownership and one-time delivery', () => {
  const raw = { ...input };
  const job = value(createSimulation(raw));
  raw.seed = 1;
  error(job.finish(), 'EXECUTION_FAILED', 'NOT_READY');
  error(job.advance(0), 'INVALID_INPUT', 'INVALID_ADVANCE_LIMIT');
  assert.deepEqual(value(job.advance(1)), {
    status: 'running', advancedIncrements: 1, completedIncrements: 1, totalIncrements: 15,
  });
  assert.deepEqual(value(job.advance(100)), {
    status: 'ready', advancedIncrements: 14, completedIncrements: 15, totalIncrements: 15,
  });
  error(job.advance(1.5), 'INVALID_INPUT', 'INVALID_ADVANCE_LIMIT');
  assert.deepEqual(value(job.advance(1)), {
    status: 'ready', advancedIncrements: 0, completedIncrements: 15, totalIncrements: 15,
  });
  const expected = value(simulate(input));
  const actual = value(job.finish());
  assert.deepEqual(actual, expected);
  actual.input.seed = 0;
  actual.summary.mean = -1;
  actual.pathData.terminalPrices.fill(-1);
  actual.pathData.maxDrawdowns.fill(-1);
  actual.plotData.prices.fill(-1);
  error(job.finish(), 'EXECUTION_FAILED', 'RESULT_ALREADY_TAKEN');
  error(job.finish(), 'EXECUTION_FAILED', 'RESULT_ALREADY_TAKEN');
  error(job.advance(0), 'EXECUTION_FAILED', 'RESULT_ALREADY_TAKEN');
  assert.deepEqual(value(simulate(input)), expected);
});

test('P1-R01 / C01: same seed, different seeds and interleaved partitions', () => {
  const otherInput = { ...input, seed: 1 };
  const expected = value(simulate(input));
  const otherExpected = value(simulate(otherInput));
  assert.ok(expected.pathData.terminalPrices.some((price, i) => price !== otherExpected.pathData.terminalPrices[i]));
  const left = value(createSimulation(input));
  const right = value(createSimulation(otherInput));
  for (let i = 0; i < 15; i++) {
    value(left.advance(1));
    value(right.advance(i % 3 + 1));
  }
  assert.deepEqual(value(left.finish()), expected);
  assert.deepEqual(value(right.finish()), otherExpected);
  const irregular = value(createSimulation(input));
  for (const size of [2, 3, 1, 20]) value(irregular.advance(size));
  assert.deepEqual(value(irregular.finish()), expected);
});

const remediationInput = { ...input, horizonYears: 1, annualDrift: 0 };

function checkVariance(t, overrides, expected, tolerance) {
  const actual = value(simulate({ ...remediationInput, ...overrides })).analyticTerminal.variance;
  t.diagnostic(`variance actual=${actual} expected=${expected}`);
  assert.ok(Number.isFinite(actual) && actual > 0);
  near(actual, expected, tolerance);
}

test('R01-01: representable variance despite an underflowing squared volatility', t => {
  checkVariance(t, { initialPrice: 1e200, annualVolatility: 1e-170 }, 1e60, 1e50);
});

test('R01-02: zero volatility has exact positive-zero variance', t => {
  const actual = value(simulate({
    ...remediationInput, initialPrice: 1e200, annualVolatility: 0,
  })).analyticTerminal.variance;
  t.diagnostic(`variance actual=${actual} expected=+0`);
  assert.equal(actual, 0);
});

test('R01-03: positive subnormal variance is preserved', t => {
  checkVariance(t, { initialPrice: 1, annualVolatility: 1e-160 }, 1e-320, 2 * Number.MIN_VALUE);
});

for (const [id, initialPrice, annualVolatility] of [
  ['R01-04', 1e-100, 1e-170],
  ['R01-05', 1e200, 0.2],
]) {
  test(`${id}: an unrepresentable final variance closes the task without a result`, t => {
    const raw = { ...remediationInput, initialPrice, annualVolatility };
    const job = value(createSimulation(raw));
    assert.equal(value(job.advance(100)).status, 'ready');
    const actual = job.finish();
    t.diagnostic(`actual=${actual.error?.code}/${actual.error?.reason} expected=NUMERIC_RANGE/NONFINITE_STATISTIC`);
    error(actual, 'NUMERIC_RANGE', 'NONFINITE_STATISTIC');
    error(job.finish(), 'NUMERIC_RANGE', 'NONFINITE_STATISTIC');
    error(simulate(raw), 'NUMERIC_RANGE', 'NONFINITE_STATISTIC');
  });
}

test('R01-06: production analytic function avoids intermediate exponential overflow', t => {
  const actual = analyticTerminal({ ...remediationInput, initialPrice: 1e-100, annualVolatility: Math.sqrt(720) });
  const expectedLog = 720 - 200 * Math.log(10);
  const expectedVariance = Math.exp(expectedLog);
  t.diagnostic(`logVariance actual=${actual?.logVariance} expected=${expectedLog}; variance actual=${actual?.variance} expected=${expectedVariance}`);
  assert.equal(Math.expm1(720), Infinity);
  assert.ok(Number.isFinite(actual?.variance) && actual.variance > 0);
  near(actual.logVariance, expectedLog, 1e-10);
  near(actual.variance, expectedVariance, 1e-10 * expectedVariance);
  assert.equal(analyticTerminal({ ...remediationInput, annualVolatility: 1e200 }), null);
});

test('R01-07: extreme drift and large price leave a representable variance', t => {
  const expected = Math.exp(400 * Math.log(10) - 800 + Math.log(Math.expm1(0.04)));
  checkVariance(t, { initialPrice: 1e200, annualDrift: -400, annualVolatility: 0.2 }, expected, 1e-10 * expected);
});

test('R02-01: drift and shock combine before addition to the log price', t => {
  const actual = gbmStep(1, 2 ** -53, 1, 2 ** -53);
  t.diagnostic(`log price actual=${actual} expected=1.0000000000000002`);
  assert.equal(actual, 1.0000000000000002);
});

test('R03-01: finite mean survives overflow of the unscaled sum', t => {
  const actual = value(simulate({
    ...remediationInput, initialPrice: 1e308, annualVolatility: 0,
  })).summary.mean;
  t.diagnostic(`mean actual=${actual} expected=1e308`);
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual / 1e308 - 1) <= 1e-12);
});

test('R03-02: illegal samples are rejected before summation or fallback', t => {
  for (const invalid of [NaN, Infinity, -1]) {
    const actual = sampleMean([1e308, 1e308, invalid], Number.MIN_VALUE, Number.MAX_VALUE);
    t.diagnostic(`sample=${invalid} actual=${actual} expected=null`);
    assert.equal(actual, null);
  }
  assert.equal(sampleMean([0, 0.5, 1.01], 0, 1), null);
});

test('R03-03: ordinary and minimum positive means', t => {
  const ordinary = sampleMean([1, 2, 3, 4], Number.MIN_VALUE, Number.MAX_VALUE);
  const tiny = sampleMean([Number.MIN_VALUE, Number.MIN_VALUE], Number.MIN_VALUE, Number.MAX_VALUE);
  t.diagnostic(`ordinary actual=${ordinary} expected=2.5; minimum actual=${tiny} expected=5e-324`);
  assert.equal(ordinary, 2.5);
  assert.equal(tiny, Number.MIN_VALUE);
});
