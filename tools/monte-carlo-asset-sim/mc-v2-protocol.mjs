export const protocolVersion = 1;
export const chunkSize = 256;            // main-thread fallback: small steps keep the page responsive
export const workerChunkSize = 131072;  // worker: large steps, since each tick waits on timer clamping (~4 ms)
export const algorithmId = 'qcl-mc-v2/mt19937-bm-v1';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => record(value) && Object.keys(value).length === names.length &&
  names.every(name => Object.hasOwn(value, name));
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const between = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const same = (actual, expected) => keys(actual, Object.keys(expected)) &&
  Object.entries(expected).every(([key, value]) => Object.is(actual[key], value));

export function message(jobId, attemptId, seq, type, payload = null) {
  return { protocolVersion, jobId, attemptId, seq, type, payload };
}

const reasons = {
  INVALID_INPUT: ['INVALID_RECORD', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD', 'MISSING_FIELD',
    'INVALID_NUMBER', 'DECIMAL_UNDERFLOW', 'NOT_INTEGER', 'OUT_OF_RANGE', 'INVALID_ADVANCE_LIMIT'],
  BUDGET_EXCEEDED: ['STEP_LIMIT', 'TOTAL_INCREMENT_LIMIT'],
  NUMERIC_RANGE: ['NONFINITE_COEFFICIENT', 'PRICE_OVERFLOW', 'PRICE_UNDERFLOW', 'NONFINITE_STATISTIC'],
  EXECUTION_FAILED: ['ALLOCATION_FAILED', 'INTERNAL_FAILURE', 'NOT_READY', 'RESULT_ALREADY_TAKEN',
    'PROTOCOL', 'WORKER_CRASH', 'EXECUTION_TIMEOUT'],
  WORKER_UNAVAILABLE: ['INITIALIZATION_FAILED', 'FALLBACK_LIMIT'],
};
const fields = ['schemaVersion', 'initialPrice', 'annualDrift', 'annualVolatility',
  'horizonYears', 'stepsPerYear', 'pathCount', 'seed'];

export function taskError(code, reason) {
  return { schemaVersion: 1, code, field: null, reason };
}

export function validError(value) {
  return keys(value, ['schemaVersion', 'code', 'field', 'reason']) && value.schemaVersion === 1 &&
    typeof value.code === 'string' && Object.hasOwn(reasons, value.code) && reasons[value.code].includes(value.reason) &&
    (value.field === null || fields.includes(value.field));
}

export function validMessage(value, types, jobId, attemptId, seq) {
  if (!keys(value, ['protocolVersion', 'jobId', 'attemptId', 'seq', 'type', 'payload']) ||
      value.protocolVersion !== protocolVersion || !positiveId(value.jobId) || !positiveId(value.attemptId) ||
      !count(value.seq) || value.jobId !== jobId || value.attemptId !== attemptId || value.seq !== seq ||
      !types.includes(value.type)) return false;
  const payload = value.payload;
  switch (value.type) {
    case 'init':
    case 'ready':
      return payload === null;
    case 'run':
      return keys(payload, fields) && payload.schemaVersion === 1 &&
        fields.every(field => Number.isFinite(payload[field]));
    case 'progress':
      return keys(payload, ['completedIncrements', 'totalIncrements']) &&
        count(payload.completedIncrements) && positiveId(payload.totalIncrements) &&
        payload.completedIncrements <= payload.totalIncrements;
    case 'result':
      return record(payload);
    case 'error':
      return validError(payload);
    default:
      return false;
  }
}

export function resultArrays(result) {
  return [result.pathData.terminalPrices, result.pathData.maxDrawdowns, result.plotData.prices];
}

const prices = ['mean', 'p5', 'p50', 'p95'];
const draws = ['meanMaxDrawdown', 'maxDrawdownP50', 'maxDrawdownP95'];
const loss = ['lossP95', 'var95', 'var95Fraction'];
const isPrice = value => Number.isFinite(value) && value > 0;
const isDrawdown = value => between(value, 0, 1);

export function validResult(result, prepared) {
  const { input, derived } = prepared;
  if (!keys(result, ['resultSchemaVersion', 'algorithmId', 'input', 'derived', 'conventions',
    'summary', 'analyticTerminal', 'pathData', 'plotData']) ||
      result.resultSchemaVersion !== 1 || result.algorithmId !== algorithmId ||
      !same(result.input, input) || !same(result.derived, derived) ||
      !same(result.conventions, { quantile: 'type7', var: 'nonnegative-terminal-loss',
        drawdown: 'discrete-includes-initial' }) ||
      !keys(result.pathData, ['terminalPrices', 'maxDrawdowns']) ||
      !keys(result.plotData, ['prices'])) return false;
  const { summary, analyticTerminal } = result;
  if (!keys(summary, [...prices, ...draws, ...loss]) ||
      !prices.every(key => isPrice(summary[key])) ||
      !draws.every(key => isDrawdown(summary[key])) ||
      !Number.isFinite(summary.lossP95) || !between(summary.var95, 0, input.initialPrice) ||
      !isDrawdown(summary.var95Fraction) ||
      !keys(analyticTerminal, [...prices, 'variance']) ||
      !prices.every(key => isPrice(analyticTerminal[key])) ||
      !Number.isFinite(analyticTerminal.variance) ||
      (input.annualVolatility === 0 ? !Object.is(analyticTerminal.variance, 0) : analyticTerminal.variance <= 0)) return false;
  const arrays = resultArrays(result);
  const lengths = [input.pathCount, input.pathCount, derived.retainedPathCount * (derived.totalSteps + 1)];
  return arrays.every((array, i) => array instanceof Float64Array && array.length === lengths[i] &&
    array.buffer instanceof ArrayBuffer && !array.buffer.resizable && array.byteOffset === 0 &&
    array.byteLength === array.buffer.byteLength && array.every(i === 1 ? isDrawdown : isPrice)) &&
    new Set(arrays.map(array => array.buffer)).size === arrays.length;
}
