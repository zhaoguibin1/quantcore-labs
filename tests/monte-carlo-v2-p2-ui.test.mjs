import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareInput, simulate } from '../tools/monte-carlo-asset-sim/mc-v2-core.mjs';
import {
  acceptResult, buildHistogram, buildInput, createRedrawScheduler, drawDistribution, drawPaths,
  errorText, formatPercent, formatPrice, histogramBinCount, isCancellable, mount, pathScaling,
  percentToDecimal, readForm, sampleColumns, statRows, statusText, DEV_GUARDS, FIELD_IDS, STAT_IDS,
} from '../tools/monte-carlo-asset-sim/mc-v2-ui.mjs';

const FIXTURE = {
  schemaVersion: 1, initialPrice: 100, annualDrift: 0.08, annualVolatility: 0.2,
  horizonYears: 1, stepsPerYear: 64, pathCount: 5, seed: 5489,
};
const form = overrides => ({
  initialPrice: '100', annualDrift: '8', annualVolatility: '20',
  horizonYears: '1', stepsPerYear: '64', pathCount: '5', seed: '5489', ...overrides,
});
const reference = simulate(FIXTURE).value;

function recordingContext() {
  const points = [];
  const calls = { strokes: 0, bars: 0, clears: 0, dashes: 0 };
  let last = null;
  return {
    points, calls,
    strokeStyle: '', fillStyle: '', lineWidth: 1,
    clearRect() { calls.clears++; },
    beginPath() { points.push({ type: 'begin' }); },
    moveTo(x, y) { last = { x, y }; points.push({ type: 'move', x, y }); },
    lineTo(x, y) { last = { x, y }; points.push({ type: 'line', x, y }); },
    stroke() { calls.strokes++; },
    fillRect(x, y, w, h) { calls.bars++; points.push({ type: 'rect', x, y, w, h }); },
    setLineDash() { calls.dashes++; },
    setTransform() {},
    get last() { return last; },
  };
}

test('percent inputs convert to decimals across the legal range', () => {
  assert.deepEqual(percentToDecimal('8'), { ok: true, value: 0.08 });
  assert.deepEqual(percentToDecimal(' 0.5 '), { ok: true, value: 0.005 });
  assert.deepEqual(percentToDecimal('-20'), { ok: true, value: -0.2 });
  assert.deepEqual(percentToDecimal('0'), { ok: true, value: 0 });
  assert.deepEqual(percentToDecimal('+1e-2'), { ok: true, value: 0.0001 });
  assert.deepEqual(percentToDecimal('1e-320'), { ok: true, value: 1e-322 });
});

test('percent conversion rejects malformed and underflowing input', () => {
  for (const token of ['', '   ', 'abc', '8%', '1e309', '--1', '.']) {
    const outcome = percentToDecimal(token);
    assert.equal(outcome.ok, false, token);
    assert.equal(outcome.error.code, 'INVALID_INPUT');
    assert.equal(outcome.error.reason, 'INVALID_NUMBER');
  }
  const underflow = percentToDecimal('5e-324');
  assert.equal(underflow.ok, false);
  assert.equal(underflow.error.reason, 'DECIMAL_UNDERFLOW');
});

test('buildInput emits an exact Schema 1 record accepted by P1', () => {
  const built = buildInput(form());
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.value).sort(), [
    'annualDrift', 'annualVolatility', 'horizonYears', 'initialPrice',
    'pathCount', 'schemaVersion', 'seed', 'stepsPerYear',
  ]);
  assert.equal(built.value.schemaVersion, 1);
  assert.equal(built.value.annualDrift, 0.08);
  assert.equal(built.value.annualVolatility, 0.2);
  const prepared = prepareInput(built.value);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.value.derived.totalSteps, 64);
  assert.equal(prepared.value.input.pathCount, 5);
});

test('buildInput refuses an empty seed and reports the field', () => {
  const built = buildInput(form({ seed: '   ' }));
  assert.equal(built.ok, false);
  assert.equal(built.error.code, 'INVALID_INPUT');
  assert.equal(built.error.reason, 'MISSING_FIELD');
  assert.equal(built.error.field, 'seed');
});

test('buildInput surfaces percent underflow and bad drift before P1 sees a number', () => {
  const underflow = buildInput(form({ annualVolatility: '5e-324' }));
  assert.equal(underflow.ok, false);
  assert.equal(underflow.error.reason, 'DECIMAL_UNDERFLOW');
  assert.equal(underflow.error.field, 'annualVolatility');
  const malformed = buildInput(form({ annualDrift: 'abc' }));
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.reason, 'INVALID_NUMBER');
  assert.equal(malformed.error.field, 'annualDrift');
});

test('mapped default input reproduces the seed-independent zero-volatility case', () => {
  const built = buildInput(form({ annualDrift: '0', annualVolatility: '0', seed: '0' }));
  assert.equal(built.ok, true);
  const result = simulate(built.value);
  assert.equal(result.ok, true);
  assert.deepEqual([...result.value.pathData.terminalPrices], [100, 100, 100, 100, 100]);
  assert.equal(result.value.analyticTerminal.variance, 0);
});

test('statRows reads P1 summary and analytic fields verbatim instead of recomputing', () => {
  const clone = structuredClone(reference);
  clone.summary.mean = 777.777;
  clone.summary.p50 = 42.424;
  const rows = statRows(clone);
  assert.equal(rows.length, STAT_IDS.length);
  assert.equal(rows.find(row => row.id === 'statMean').text, formatPrice(777.777));
  assert.equal(rows.find(row => row.id === 'statMedian').text, formatPrice(42.424));
  const untouched = statRows(reference);
  assert.equal(untouched.find(row => row.id === 'statP5').text, formatPrice(reference.summary.p5));
  assert.match(untouched.find(row => row.id === 'statVaR').text, /^95% VaR: /);
  assert.equal(formatPercent(reference.summary.meanMaxDrawdown), `${(reference.summary.meanMaxDrawdown * 100).toFixed(2)}%`);
});

test('VaR label reports absence when the fifth percentile is not below S0', () => {
  const flat = simulate({ ...FIXTURE, annualVolatility: 0, annualDrift: 0 }).value;
  const rows = statRows(flat);
  assert.equal(rows.find(row => row.id === 'statVaR').text, '95% VaR: none (5th percentile ≥ S₀)');
  assert.equal(rows.find(row => row.id === 'statMddP95').text, '0.00%');
});

test('errorText maps controlled fields and never echoes raw text', () => {
  assert.equal(errorText({ code: 'BUDGET_EXCEEDED', reason: 'STEP_LIMIT', field: null }),
    'Step budget exceeded: reduce the horizon or steps per year.');
  assert.equal(errorText({ code: 'BUDGET_EXCEEDED', reason: 'STEP_LIMIT', field: 'horizonYears' }),
    'Step budget exceeded: reduce the horizon or steps per year. (Time Horizon)');
  assert.equal(errorText({ code: 'WORKER_UNAVAILABLE', reason: 'FALLBACK_LIMIT', field: null }),
    'Worker unavailable and main-thread fallback is disabled for this build.');
  assert.equal(errorText({ code: 'INVALID_INPUT', reason: '<script>', field: '<img>' }), 'Run failed.');
  assert.equal(errorText(null), 'Run failed.');
});

test('acceptResult binds rendering to the live job id only', () => {
  const state = { status: 'SUCCEEDED', jobId: 7, result: reference };
  assert.equal(acceptResult(state, 7), true);
  assert.equal(acceptResult(state, 6), false);
  assert.equal(acceptResult({ status: 'SUCCEEDED', jobId: 7 }, 7), false);
  assert.equal(acceptResult({ status: 'FAILED', jobId: 7, result: reference }, 7), false);
  assert.equal(acceptResult(null, 7), false);
});

test('statusText exposes job, N/M/T and algorithm on success', () => {
  const text = statusText({ status: 'SUCCEEDED', jobId: 12, result: reference });
  assert.match(text, /Job #12 · succeeded/);
  assert.match(text, /N=5/);
  assert.match(text, /M=64/);
  assert.match(text, /T=1/);
  assert.match(text, /qcl-mc-v2\/mt19937-bm-v1/);
  assert.equal(statusText({ status: 'RUNNING_WORKER', jobId: 3, completedIncrements: 256, totalIncrements: 320 }),
    'Job #3 · running 256/320 increments');
  assert.equal(statusText({ status: 'IDLE', jobId: null }), 'Idle — press Run');
  assert.equal(isCancellable({ status: 'RUNNING_WORKER' }), true);
  assert.equal(isCancellable({ status: 'SUCCEEDED' }), false);
});

test('pathScaling keeps a flat zero-volatility series visible', () => {
  const flat = simulate({ ...FIXTURE, annualVolatility: 0, annualDrift: 0 }).value;
  const scale = pathScaling(flat);
  assert.ok(scale);
  assert.ok(scale.min < 100 && scale.max > 100);
  assert.ok(Number.isFinite(scale.min) && Number.isFinite(scale.max));
  assert.equal(pathScaling(null), null);
  assert.equal(pathScaling({ plotData: { prices: new Float64Array(0) }, derived: {}, input: {} }), null);
});

test('sampleColumns is monotonic and always ends on the final step', () => {
  const columns = sampleColumns(252, 100);
  assert.equal(columns.length, 100);
  assert.equal(columns[0], 0);
  assert.equal(columns.at(-1), 252);
  for (let index = 1; index < columns.length; index++) assert.ok(columns[index] >= columns[index - 1]);
  assert.equal(sampleColumns(64, 400).length, 65);
  assert.throws(() => sampleColumns(64, 1), RangeError);
});

test('path rendering emits one stroked polyline per retained path with finite coordinates', () => {
  const ctx = recordingContext();
  const drawn = drawPaths(ctx, { width: 640, height: 320 }, reference);
  assert.equal(drawn, reference.derived.retainedPathCount);
  // grid + initial-price baseline + one polyline per retained path
  assert.equal(ctx.calls.strokes, reference.derived.retainedPathCount + 2);
  const coordinates = ctx.points.filter(point => point.type === 'move' || point.type === 'line');
  assert.ok(coordinates.length >= 2);
  for (const point of coordinates) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= 640);
    assert.ok(point.y >= 0 && point.y <= 320);
  }
});

test('path rendering stays finite under extreme magnitudes', () => {
  const synthetic = structuredClone(reference);
  synthetic.plotData.prices = new Float64Array(reference.plotData.prices.length).fill(100);
  synthetic.plotData.prices[0] = 1e-300;
  synthetic.plotData.prices[1] = 1e300;
  synthetic.derived.retainedPathCount = 1;
  const ctx = recordingContext();
  const drawn = drawPaths(ctx, { width: 480, height: 240 }, synthetic);
  assert.equal(drawn, 1);
  for (const point of ctx.points.filter(entry => entry.type === 'move' || entry.type === 'line')) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
});

test('histogram consumes every terminal value and survives a flat distribution', () => {
  const histogram = buildHistogram(reference.pathData.terminalPrices, histogramBinCount(5));
  assert.ok(histogram);
  assert.equal(histogram.counted, 5);
  assert.equal(histogram.counts.reduce((sum, count) => sum + count, 0), 5);
  assert.ok(histogram.maxCount >= 1);
  const flat = buildHistogram(simulate({ ...FIXTURE, annualVolatility: 0, annualDrift: 0 }).value.pathData.terminalPrices, 12);
  assert.equal(flat.counted, 5);
  assert.ok(flat.min < 100 && flat.max > 100);
  assert.equal(buildHistogram(null, 12), null);
});

test('distribution rendering marks quantiles and keeps every coordinate finite', () => {
  const ctx = recordingContext();
  const histogram = buildHistogram(reference.pathData.terminalPrices, 12);
  const bars = drawDistribution(ctx, { width: 640, height: 240 }, reference, histogram);
  assert.equal(bars, 12);
  assert.equal(ctx.calls.bars, 12);
  assert.ok(ctx.calls.dashes >= 3);
  for (const point of ctx.points.filter(entry => entry.type === 'rect')) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.w > 0 && point.h >= 0);
  }
});

test('redraw scheduler coalesces frames and stops after disposal', () => {
  const frames = [];
  let runs = 0;
  const scheduler = createRedrawScheduler({
    requestFrame: callback => { frames.push(callback); return frames.length; },
    cancelFrame: index => { frames[index - 1] = null; },
  });
  const task = () => { runs++; };
  assert.equal(scheduler.schedule(task), true);
  assert.equal(scheduler.schedule(task), false);
  assert.equal(scheduler.schedule(task), false);
  assert.equal(frames.length, 1);
  frames[0]();
  assert.equal(runs, 1);
  assert.equal(scheduler.pending, false);
  scheduler.schedule(task);
  const queued = frames.at(-1);
  scheduler.dispose();
  assert.equal(scheduler.pending, false);
  assert.equal(frames.at(-1), null);
  queued();
  assert.equal(runs, 1);
});

test('mount wires the form, renders committed results and never re-runs on resize', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  assert.equal(view.startCount(), 0);

  view.click('runButton');
  assert.equal(view.startCount(), 1);
  assert.equal(view.input.value, '100');
  assert.equal(view.startInput().seed, '5489');

  view.controller.publish({ status: 'STARTING_WORKER', jobId: 1 });
  view.controller.publish({ status: 'SUCCEEDED', jobId: 1, result: reference });
  assert.equal(view.text('statMean'), formatPrice(reference.summary.mean));
  assert.equal(view.text('statN'), '5');
  assert.equal(view.text('statM'), '64');
  assert.equal(view.text('statAlgo'), reference.algorithmId);
  assert.equal(view.canvas('simCanvas').calls.strokes, reference.derived.retainedPathCount + 2);
  assert.equal(view.canvas('distCanvas').calls.bars, 12);
  assert.equal(view.text('errorBox'), '');
  assert.equal(handle.result.algorithmId, reference.algorithmId);
  assert.deepEqual(handle.result.summary, reference.summary);

  view.dispatch('resize');
  assert.equal(view.frames.length, 1);
  view.frames[0]();
  assert.equal(view.startCount(), 1);
  assert.ok(view.canvas('simCanvas').calls.strokes > reference.derived.retainedPathCount + 2);
  handle.dispose();
});

test('mount clears the page on input change and revokes the committed result', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  view.click('runButton');
  view.controller.publish({ status: 'SUCCEEDED', jobId: 1, result: reference });
  assert.equal(view.text('statMean'), formatPrice(reference.summary.mean));
  view.fire('initialPrice', 'input');
  assert.equal(view.invalidateCount(), 1);
  assert.equal(view.startCount(), 1);
  assert.equal(view.text('statMean'), '—');
  assert.equal(handle.result, null);
  handle.dispose();
});

test('mount ignores a stale success and keeps the page clean until the live job lands', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  view.click('runButton');
  view.controller.publish({ status: 'SUCCEEDED', jobId: 1, result: reference });
  assert.equal(view.text('statMean'), formatPrice(reference.summary.mean));
  view.click('runButton');
  assert.equal(view.startCount(), 2);
  assert.equal(view.text('statMean'), '—');
  const stale = structuredClone(reference);
  stale.summary.mean = 999.999;
  view.controller.publish({ status: 'SUCCEEDED', jobId: 1, result: stale });
  assert.equal(view.text('statMean'), '—');
  const current = structuredClone(reference);
  current.summary.mean = 321.321;
  view.controller.publish({ status: 'SUCCEEDED', jobId: 2, result: current });
  assert.equal(view.text('statMean'), formatPrice(321.321));
  handle.dispose();
});

test('mount reports the controlled worker-unavailable failure and re-enables Run', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  view.click('runButton');
  view.controller.publish({ status: 'STARTING_WORKER', jobId: 1 });
  assert.equal(view.node('cancelButton').disabled, false);
  view.controller.publish({ status: 'FAILED', jobId: 1, error: { schemaVersion: 1, code: 'WORKER_UNAVAILABLE', field: null, reason: 'FALLBACK_LIMIT' } });
  assert.match(view.text('errorBox'), /fallback is disabled for this build/);
  assert.equal(view.node('runButton').disabled, false);
  assert.equal(view.node('cancelButton').disabled, true);
  assert.equal(view.text('statMean'), '—');
  handle.dispose();
});

test('mount generates one seed through crypto when the field is empty', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  view.node('seed').value = '';
  view.click('runButton');
  assert.equal(view.node('seed').value, '42');
  assert.equal(view.startCount(), 1);
  assert.equal(view.startInput().seed, '42');
  handle.dispose();
});

test('mount refuses to start when crypto is unavailable and the seed is empty', () => {
  const view = mountHarness({ crypto: undefined });
  const handle = view.mount({ controller: view.controller });
  view.node('seed').value = '   ';
  view.click('runButton');
  assert.equal(view.startCount(), 0);
  assert.equal(view.node('seed').focused, true);
  assert.match(view.text('errorBox'), /Enter a finite decimal number/);
  handle.dispose();
});

test('mount reports a percent-underflow field without calling the controller', () => {
  const view = mountHarness();
  const handle = view.mount({ controller: view.controller });
  view.node('volatility').value = '5e-324';
  view.click('runButton');
  assert.equal(view.startCount(), 0);
  assert.match(view.text('errorBox'), /too small/);
  assert.equal(view.node('volatility').focused, true);
  handle.dispose();
});

function mountHarness(options = {}) {
  const nodes = new Map();
  const frames = [];
  const windowListeners = new Map();
  let startCalls = 0;
  let cancelCalls = 0;
  let invalidateCalls = 0;
  let lastInput = null;
  let sequence = 0;
  const listeners = new Set();

  const makeNode = id => {
    const node = {
      id, value: '', textContent: '', disabled: false, focused: false,
      parentElement: null, width: 0, height: 0, context: null,
      handler: new Map(),
      addEventListener(type, callback) { node.handler.set(type, callback); },
      removeEventListener(type) { node.handler.delete(type); },
      focus() { node.focused = true; },
      getBoundingClientRect() { return { width: 640, height: 320 }; },
      getContext() { if (!node.context) node.context = recordingContext(); return node.context; },
    };
    nodes.set(id, node);
    return node;
  };

  for (const id of [
    'initialPrice', 'drift', 'volatility', 'timeHorizon', 'timeSteps', 'numPaths', 'seed',
    'runButton', 'cancelButton', 'simStatus', 'errorBox', 'simCanvas', 'distCanvas',
    'statN', 'statM', 'statT', 'statAlgo', ...STAT_IDS,
  ]) makeNode(id);

  nodes.get('initialPrice').value = '100';
  nodes.get('drift').value = '8';
  nodes.get('volatility').value = '20';
  nodes.get('timeHorizon').value = '1';
  nodes.get('timeSteps').value = '64';
  nodes.get('numPaths').value = '5';
  nodes.get('seed').value = '5489';

  const container = {
    note: null,
    getAttribute() { return container.note; },
    setAttribute(name, value) { if (name === 'data-paths-note') container.note = value; },
  };
  nodes.get('simCanvas').parentElement = container;
  nodes.get('distCanvas').parentElement = container;

  const controller = {
    start(raw) { startCalls++; lastInput = raw; return ++sequence; },
    cancel(id) { cancelCalls++; return true; },
    invalidate() { invalidateCalls++; publish({ status: 'IDLE', jobId: null }); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { listeners.clear(); },
  };
  const publish = state => { for (const listener of [...listeners]) listener(structuredClone(state)); };
  controller.publish = publish;

  const defaultCrypto = { getRandomValues(array) { array[0] = 42; return array; } };
  const windowStub = {
    devicePixelRatio: 1,
    crypto: Object.hasOwn(options, 'crypto') ? options.crypto : defaultCrypto,
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame(index) { frames[index - 1] = null; },
    addEventListener(type, callback) { windowListeners.set(type, callback); },
    removeEventListener(type) { windowListeners.delete(type); },
  };

  const documentStub = { getElementById: id => nodes.get(id) ?? null };

  return {
    nodes, frames, controller,
    node: id => nodes.get(id),
    text: id => nodes.get(id).textContent,
    canvas: id => {
      const node = nodes.get(id);
      if (!node.context) node.context = recordingContext();
      return node.context;
    },
    input: nodes.get('initialPrice'),
    startCount: () => startCalls,
    cancelCount: () => cancelCalls,
    invalidateCount: () => invalidateCalls,
    startInput: () => lastInput,
    click: id => nodes.get(id).handler.get('click')?.(),
    fire: (id, type) => nodes.get(id).handler.get(type)?.(),
    dispatch: type => windowListeners.get(type)?.(),
    mount: options => mount({ window: windowStub, document: documentStub, ...options }),
  };
}

test('p5 sampling half-width matches the order-statistic formula', async () => {
  const { p5SamplingHalfWidth } = await import('../tools/monte-carlo-asset-sim/mc-v2-ui.mjs');
  // sigma 0.2, T 1, exact p5 = 100*exp(0.06 - 1.6449*0.2) = 76.42; f(q) = phi(1.6449)/(q*0.2)
  const q = 100 * Math.exp(0.06 - 1.6448536269514722 * 0.2);
  const r = { input: { pathCount: 5000, annualVolatility: 0.2, horizonYears: 1 }, analyticTerminal: { p5: q } };
  const phi = Math.exp(-0.5 * 1.6448536269514722 ** 2) / Math.sqrt(2 * Math.PI);
  const want = 1.96 * Math.sqrt(0.0475 / 5000) * q * 0.2 / phi;
  assert.ok(Math.abs(p5SamplingHalfWidth(r) - want) < 1e-12);
  assert.ok(want > 0.8 && want < 1.0, String(want));
  assert.ok(Number.isNaN(p5SamplingHalfWidth({})));
});
