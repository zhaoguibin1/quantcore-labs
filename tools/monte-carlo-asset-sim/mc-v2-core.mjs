import { createMt19937, createNormalSampler } from './mc-v2-rng.mjs';

const algorithmId = 'qcl-mc-v2/mt19937-bm-v1';
const fields = {
  initialPrice: [Number.MIN_VALUE, Infinity, false],
  annualDrift: [-Infinity, Infinity, false],
  annualVolatility: [0, Infinity, false],
  horizonYears: [0.01, Infinity, false],
  stepsPerYear: [10, 1000, true],
  pathCount: [5, 20000, true],
  seed: [0, 0xffffffff, true],
};
const decimal = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const ok = value => ({ ok: true, value });
const fail = (code, reason, field = null) => ({
  ok: false, error: { schemaVersion: 1, code, field, reason },
});
const invalid = (reason, field) => fail('INVALID_INPUT', reason, field);

export function totalStepsForProduct(product) {
  return Math.max(2, Math.round(product));
}

export function prepareInput(raw) {
  if (raw === null || typeof raw !== 'object') return invalid('INVALID_RECORD');
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return invalid('INVALID_RECORD');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value'))) {
    return invalid('INVALID_RECORD');
  }
  if (!Object.hasOwn(descriptors, 'schemaVersion')) return invalid('MISSING_FIELD', 'schemaVersion');
  if (descriptors.schemaVersion.value !== 1) return invalid('UNSUPPORTED_VERSION', 'schemaVersion');
  if (keys.some(key => key !== 'schemaVersion' && !Object.hasOwn(fields, key))) {
    return invalid('UNKNOWN_FIELD');
  }
  for (const field of Object.keys(fields)) {
    if (!Object.hasOwn(descriptors, field)) return invalid('MISSING_FIELD', field);
  }
  const input = { schemaVersion: 1 };
  for (const [field, [min, max, integer]] of Object.entries(fields)) {
    const value = descriptors[field].value;
    const token = typeof value === 'string' ? value.trim() : null;
    if (token !== null && !decimal.test(token)) return invalid('INVALID_NUMBER', field);
    const number = token === null ? value : Number(token);
    if (!Number.isFinite(number)) return invalid('INVALID_NUMBER', field);
    if (token !== null && number === 0 && /[1-9]/.test(token.split(/[eE]/, 1)[0])) {
      return invalid('DECIMAL_UNDERFLOW', field);
    }
    if (integer && !Number.isInteger(number)) return invalid('NOT_INTEGER', field);
    if (number < min || number > max) return invalid('OUT_OF_RANGE', field);
    input[field] = number === 0 ? 0 : number;
  }
  const totalSteps = totalStepsForProduct(input.horizonYears * input.stepsPerYear);
  if (!Number.isSafeInteger(totalSteps) || totalSteps > 10000) {
    return fail('BUDGET_EXCEEDED', 'STEP_LIMIT');
  }
  if (input.pathCount * totalSteps > 10000000) {
    return fail('BUDGET_EXCEEDED', 'TOTAL_INCREMENT_LIMIT');
  }
  const dtYears = input.horizonYears / totalSteps;
  const retainedPathCount = Math.min(input.pathCount, 24);
  const float64BufferBytes = 8 * (retainedPathCount * (totalSteps + 1) + 4 * input.pathCount);
  const sigma = input.annualVolatility;
  const driftStep = (input.annualDrift - 0.5 * sigma * sigma) * dtYears;
  const diffusionStep = sigma * Math.sqrt(dtYears);
  if (![driftStep, diffusionStep].every(Number.isFinite)) {
    return fail('NUMERIC_RANGE', 'NONFINITE_COEFFICIENT');
  }
  return ok({ input, derived: { totalSteps, dtYears, retainedPathCount, float64BufferBytes },
    coefficients: { driftStep, diffusionStep } });
}

export function gbmStep(logPrice, driftStep, diffusionStep, shock) {
  return logPrice + (driftStep + diffusionStep * shock);
}

export function drawdownAt(logPrice, peakLog) {
  return logPrice >= peakLog ? 0 : -Math.expm1(logPrice - peakLog);
}

export function quantileType7(sorted, p) {
  const h = (sorted.length - 1) * p;
  const i = Math.floor(h);
  const fraction = h - i;
  return sorted[i] + fraction * (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]);
}

function compensatedSum(values, divisor) {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const term = value / divisor - correction;
    const next = sum + term;
    if (!Number.isFinite(next)) return null;
    correction = (next - sum) - term;
    if (!Number.isFinite(correction)) return null;
    sum = next;
  }
  return sum;
}

export function sampleMean(values, minimum, maximum) {
  if (!values.length || values.some(value =>
    !Number.isFinite(value) || value < minimum || value > maximum || value < 0)) return null;
  const sum = compensatedSum(values, 1);
  const result = sum === null ? compensatedSum(values, values.length) : sum / values.length;
  return Number.isFinite(result) && result >= minimum && result <= maximum ? result : null;
}

export function lossMetrics(initialPrice, p5) {
  const lossP95 = initialPrice - p5;
  const var95 = Math.max(0, lossP95);
  return { lossP95, var95, var95Fraction: var95 / initialPrice };
}

export function analyticTerminal(input) {
  const { initialPrice, annualDrift: mu, annualVolatility: sigma, horizonYears: years } = input;
  const logMean = Math.log(initialPrice) + mu * years;
  const meanPrice = mu === 0 ? initialPrice : Math.exp(logMean);
  if (!Number.isFinite(meanPrice) || meanPrice <= 0) return null;
  if (sigma === 0) {
    return { mean: meanPrice, variance: 0, p5: meanPrice, p50: meanPrice, p95: meanPrice };
  }
  const spread = sigma * Math.sqrt(years);
  const varianceTime = spread * spread;
  const center = logMean - 0.5 * varianceTime;
  const width = 1.6448536269514722 * spread;
  const logX = 2 * Math.log(sigma) + Math.log(years);
  // A representable positive mean implies logMean > -746. At x >= 4096
  // the log variance exceeds 2603 even at that lower bound.
  if (logX >= Math.log(4096)) return null;
  let logVarianceFactor = logX;
  if (logX > -54 * Math.LN2) {
    const x = Math.exp(logX);
    logVarianceFactor = x > 1
      ? x + Math.log1p(-Math.exp(-x))
      : Math.log(Math.expm1(x));
  }
  const logVariance = 2 * logMean + logVarianceFactor;
  const variance = Math.exp(logVariance);
  if (!Number.isFinite(variance) || variance <= 0) return null;
  return {
    mean: meanPrice,
    variance,
    logVariance,
    p5: Math.exp(center - width),
    p50: Math.exp(center),
    p95: Math.exp(center + width),
  };
}

export function createSimulationWithRng(raw, createRng) {
  const prepared = prepareInput(raw);
  if (!prepared.ok) return prepared;
  let { input, derived, coefficients } = prepared.value;
  const { totalSteps, dtYears, retainedPathCount } = derived;
  const { pathCount, initialPrice, annualDrift, annualVolatility } = input;
  const totalIncrements = pathCount * totalSteps;
  const initialLog = Math.log(initialPrice);
  let data;
  try {
    const random = annualVolatility === 0 ? null : createRng(input.seed);
    data = {
      terminal: new Float64Array(pathCount),
      drawdown: new Float64Array(pathCount),
      prices: new Float64Array(retainedPathCount * (totalSteps + 1)),
      normal: random && createNormalSampler(random.nextUint32),
    };
  } catch (error) {
    return fail('EXECUTION_FAILED', error instanceof RangeError ? 'ALLOCATION_FAILED' : 'INTERNAL_FAILURE');
  }

  let state = 'running';
  let terminalError;
  let completedIncrements = 0;
  let logPrice = initialLog;
  let peakLog = initialLog;
  let maxDrawdown = 0;

  function release() {
    data = input = derived = coefficients = null;
  }

  function terminate(code, reason) {
    terminalError = { schemaVersion: 1, code, field: null, reason };
    state = 'failed';
    release();
    return { ok: false, error: { ...terminalError } };
  }

  function terminalStatus() {
    if (state === 'failed') return { ok: false, error: { ...terminalError } };
    if (state === 'succeeded') return fail('EXECUTION_FAILED', 'RESULT_ALREADY_TAKEN');
    return null;
  }

  function advance(maxIncrements) {
    const terminal = terminalStatus();
    if (terminal) return terminal;
    if (!Number.isSafeInteger(maxIncrements) || maxIncrements <= 0) return invalid('INVALID_ADVANCE_LIMIT');
    const advancedIncrements = Math.min(maxIncrements, totalIncrements - completedIncrements);
    const end = completedIncrements + advancedIncrements;
    while (completedIncrements < end) {
      const path = Math.floor(completedIncrements / totalSteps);
      const step = completedIncrements % totalSteps + 1;
      const offset = path * (totalSteps + 1);
      if (step === 1) {
        logPrice = peakLog = initialLog;
        maxDrawdown = 0;
        if (path < retainedPathCount) data.prices[offset] = initialPrice;
      }
      let price;
      if (data.normal) {
        logPrice = gbmStep(logPrice, coefficients.driftStep, coefficients.diffusionStep, data.normal());
        price = Math.exp(logPrice);
      } else {
        const time = step === totalSteps ? input.horizonYears : step * dtYears;
        logPrice = initialLog + annualDrift * time;
        price = annualDrift === 0 ? initialPrice : Math.exp(logPrice);
      }
      if (!Number.isFinite(price)) return terminate('NUMERIC_RANGE', 'PRICE_OVERFLOW');
      if (price === 0) return terminate('NUMERIC_RANGE', 'PRICE_UNDERFLOW');
      maxDrawdown = Math.max(maxDrawdown, drawdownAt(logPrice, peakLog));
      peakLog = Math.max(peakLog, logPrice);
      if (path < retainedPathCount) data.prices[offset + step] = price;
      if (step === totalSteps) {
        data.terminal[path] = price;
        data.drawdown[path] = maxDrawdown;
      }
      completedIncrements++;
    }
    if (completedIncrements === totalIncrements) state = 'ready';
    return ok({ status: state, advancedIncrements, completedIncrements, totalIncrements });
  }

  function finish() {
    const terminal = terminalStatus();
    if (terminal) return terminal;
    if (state !== 'ready') return fail('EXECUTION_FAILED', 'NOT_READY');
    let sortedPrice;
    let sortedDrawdown;
    try {
      sortedPrice = data.terminal.slice().sort();
      sortedDrawdown = data.drawdown.slice().sort();
    } catch (error) {
      return terminate('EXECUTION_FAILED', error instanceof RangeError ? 'ALLOCATION_FAILED' : 'INTERNAL_FAILURE');
    }
    const p5 = quantileType7(sortedPrice, 0.05);
    const summary = {
      mean: sampleMean(data.terminal, Number.MIN_VALUE, Number.MAX_VALUE), p5, p50: quantileType7(sortedPrice, 0.5),
      p95: quantileType7(sortedPrice, 0.95), ...lossMetrics(initialPrice, p5),
      meanMaxDrawdown: sampleMean(data.drawdown, 0, 1), maxDrawdownP50: quantileType7(sortedDrawdown, 0.5),
      maxDrawdownP95: quantileType7(sortedDrawdown, 0.95),
    };
    const statistics = analyticTerminal(input);
    if (!statistics) return terminate('NUMERIC_RANGE', 'NONFINITE_STATISTIC');
    const { logVariance, ...analytic } = statistics;
    if (![...Object.values(summary), ...Object.values(analytic)].every(Number.isFinite) ||
        [analytic.mean, analytic.p5, analytic.p50, analytic.p95].some(price => price <= 0)) {
      return terminate('NUMERIC_RANGE', 'NONFINITE_STATISTIC');
    }
    const result = {
      resultSchemaVersion: 1, algorithmId, input: { ...input }, derived: { ...derived },
      conventions: { quantile: 'type7', var: 'nonnegative-terminal-loss', drawdown: 'discrete-includes-initial' },
      summary, analyticTerminal: analytic,
      pathData: { terminalPrices: data.terminal, maxDrawdowns: data.drawdown },
      plotData: { prices: data.prices },
    };
    release();
    state = 'succeeded';
    return ok(result);
  }

  return ok({ advance, finish });
}

export function createSimulation(raw) {
  return createSimulationWithRng(raw, createMt19937);
}

export function simulate(raw) {
  const simulation = createSimulation(raw);
  if (!simulation.ok) return simulation;
  const progress = simulation.value.advance(Number.MAX_SAFE_INTEGER);
  return progress.ok ? simulation.value.finish() : progress;
}
