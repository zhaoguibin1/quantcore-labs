import { createTaskController } from './mc-v2-page.mjs';
import { totalStepsForProduct } from './mc-v2-core.mjs';

// Development guards only. Fallback is disabled for this build (D1 = 0):
// a Worker startup failure must surface as a controlled FAILED state.
export const DEV_GUARDS = Object.freeze({
  handshakeMs: 2000,
  executionMs: 30000,
  fallbackMaxIncrements: 0,
});

export const FIELD_IDS = Object.freeze({
  initialPrice: 'initialPrice',
  annualDrift: 'drift',
  annualVolatility: 'volatility',
  horizonYears: 'timeHorizon',
  stepsPerYear: 'timeSteps',
  pathCount: 'numPaths',
  seed: 'seed',
});

const FIELD_LABELS = Object.freeze({
  initialPrice: 'Initial Price',
  annualDrift: 'Annual Drift',
  annualVolatility: 'Annual Volatility',
  horizonYears: 'Time Horizon',
  stepsPerYear: 'Steps per Year',
  pathCount: 'Path Count',
  seed: 'Seed',
  schemaVersion: 'Schema Version',
});

const REASON_TEXT = Object.freeze({
  INVALID_RECORD: 'Input record was rejected.',
  UNSUPPORTED_VERSION: 'Unsupported input version.',
  UNKNOWN_FIELD: 'Unknown input field.',
  MISSING_FIELD: 'A required field is empty.',
  INVALID_NUMBER: 'Enter a finite decimal number.',
  DECIMAL_UNDERFLOW: 'Value is too small: it would become zero after percent conversion.',
  NOT_INTEGER: 'Enter a whole number.',
  OUT_OF_RANGE: 'Value is outside the allowed range.',
  INVALID_ADVANCE_LIMIT: 'Invalid advance limit.',
  STEP_LIMIT: 'Step budget exceeded: reduce the horizon or steps per year.',
  TOTAL_INCREMENT_LIMIT: 'Total increment budget exceeded: reduce paths, horizon or steps.',
  NONFINITE_COEFFICIENT: 'Parameters produce non-finite coefficients.',
  PRICE_OVERFLOW: 'Simulated price overflowed to a non-finite value.',
  PRICE_UNDERFLOW: 'Simulated price underflowed to zero.',
  NONFINITE_STATISTIC: 'Simulated statistics are not finite.',
  ALLOCATION_FAILED: 'Not enough memory for this grid.',
  INTERNAL_FAILURE: 'Internal execution error.',
  NOT_READY: 'Execution was not ready to finish.',
  RESULT_ALREADY_TAKEN: 'Result was already consumed.',
  PROTOCOL: 'Worker protocol violation.',
  WORKER_CRASH: 'The worker stopped unexpectedly.',
  EXECUTION_TIMEOUT: 'Execution timed out.',
  INITIALIZATION_FAILED: 'The worker could not start.',
  FALLBACK_LIMIT: 'Worker unavailable and main-thread fallback is disabled for this build.',
});

const DECIMAL = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

const CANCELLABLE = Object.freeze([
  'VALIDATING', 'STARTING_WORKER', 'RUNNING_WORKER', 'RUNNING_FALLBACK', 'CANCELLING',
]);

export const STAT_IDS = Object.freeze([
  'statMean', 'statP5', 'statMedian', 'statP95', 'statVaR', 'statExact',
  'statMddMean', 'statMddP50', 'statMddP95',
]);

export function errorText(error) {
  if (!error || typeof error !== 'object') return 'Run failed.';
  const reason = typeof error.reason === 'string' && Object.hasOwn(REASON_TEXT, error.reason)
    ? REASON_TEXT[error.reason] : 'Run failed.';
  const field = typeof error.field === 'string' && Object.hasOwn(FIELD_LABELS, error.field)
    ? FIELD_LABELS[error.field] : null;
  return field ? `${reason} (${field})` : reason;
}

export function percentToDecimal(raw) {
  const token = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  if (!DECIMAL.test(token)) {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: null, reason: 'INVALID_NUMBER' } };
  }
  const value = Number(token);
  if (!Number.isFinite(value)) {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: null, reason: 'INVALID_NUMBER' } };
  }
  const converted = value / 100;
  if (!Number.isFinite(converted)) {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: null, reason: 'INVALID_NUMBER' } };
  }
  // A non-zero input that collapses to zero proves underflow, not a real zero sigma.
  if (value !== 0 && converted === 0) {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: null, reason: 'DECIMAL_UNDERFLOW' } };
  }
  return { ok: true, value: converted === 0 ? 0 : converted };
}

export function readForm(form) {
  const value = name => {
    const raw = form ? form[name] : undefined;
    return typeof raw === 'string' ? raw.trim() : raw === undefined ? '' : String(raw);
  };
  const token = {};
  for (const name of Object.keys(FIELD_IDS)) token[name] = value(name);
  return token;
}

export function buildInput(form) {
  const token = readForm(form);
  const drift = percentToDecimal(token.annualDrift);
  if (!drift.ok) {
    return { ok: false, error: { ...drift.error, field: 'annualDrift' } };
  }
  const volatility = percentToDecimal(token.annualVolatility);
  if (!volatility.ok) {
    return { ok: false, error: { ...volatility.error, field: 'annualVolatility' } };
  }
  if (token.seed === '') {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: 'seed', reason: 'MISSING_FIELD' } };
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      initialPrice: token.initialPrice,
      annualDrift: drift.value,
      annualVolatility: volatility.value,
      horizonYears: token.horizonYears,
      stepsPerYear: token.stepsPerYear,
      pathCount: token.pathCount,
      seed: token.seed,
    },
  };
}

export function generateSeed(scope) {
  const source = scope && scope.crypto;
  try {
    if (!source || typeof source.getRandomValues !== 'function') {
      return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: 'seed', reason: 'INVALID_NUMBER' } };
    }
    const buffer = new Uint32Array(1);
    source.getRandomValues(buffer);
    const value = buffer[0];
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: 'seed', reason: 'INVALID_NUMBER' } };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: { schemaVersion: 1, code: 'INVALID_INPUT', field: 'seed', reason: 'INVALID_NUMBER' } };
  }
}

export function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 1e-4 || magnitude >= 1e12)) return value.toExponential(4);
  return value.toFixed(2);
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

// 95% sampling range of the simulated 5th percentile around the exact one: 1.96 * sqrt(p(1-p)/N) / f(q),
// with f the log-normal density at q (exact GBM steps, so the terminal law is exactly log-normal).
export function p5SamplingHalfWidth(result) {
  const N = result?.input?.pathCount, q = result?.analyticTerminal?.p5;
  const s = result?.input?.annualVolatility * Math.sqrt(result?.input?.horizonYears);
  if (!(N > 0) || !(q > 0) || !(s > 0)) return NaN;
  const z = -1.6448536269514722, phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return 1.96 * Math.sqrt(0.05 * 0.95 / N) * q * s / phi;
}

function sampleNote(result) {
  const h = p5SamplingHalfWidth(result);
  if (!Number.isFinite(h)) return '';
  const warn = result.input.pathCount < 5000 ? ' Fewer than 5,000 paths: tail figures are noisy.' : '';
  return `. With ${result.input.pathCount} paths the simulated 5th pct typically lands within ±${formatPrice(h)} of the exact value (95%).${warn}`;
}

export function statRows(result) {
  if (!result || typeof result !== 'object' || !result.summary || !result.analyticTerminal) return [];
  const { summary, analyticTerminal } = result;
  const varText = Number.isFinite(summary.var95) && Number.isFinite(summary.var95Fraction) && summary.var95 > 0
    ? `95% VaR: ${formatPrice(summary.var95)} (${(summary.var95Fraction * 100).toFixed(1)}%)`
    : '95% VaR: none (5th percentile ≥ S₀)';
  return [
    { id: 'statMean', text: formatPrice(summary.mean) },
    { id: 'statP5', text: formatPrice(summary.p5) },
    { id: 'statMedian', text: formatPrice(summary.p50) },
    { id: 'statP95', text: formatPrice(summary.p95) },
    { id: 'statVaR', text: varText },
    {
      id: 'statExact',
      text: `Exact log-normal: mean ${formatPrice(analyticTerminal.mean)} · 5th pct ${formatPrice(analyticTerminal.p5)}`
        + ` · median ${formatPrice(analyticTerminal.p50)} · 95th pct ${formatPrice(analyticTerminal.p95)}`
        + sampleNote(result),
    },
    { id: 'statMddMean', text: formatPercent(summary.meanMaxDrawdown) },
    { id: 'statMddP50', text: formatPercent(summary.maxDrawdownP50) },
    { id: 'statMddP95', text: formatPercent(summary.maxDrawdownP95) },
  ];
}

export function acceptResult(state, currentJobId) {
  return Boolean(state && state.status === 'SUCCEEDED' && state.result && state.jobId === currentJobId);
}

export function isCancellable(state) {
  return Boolean(state && CANCELLABLE.includes(state.status));
}

export function statusText(state) {
  if (!state || !state.status) return 'Idle — press Run';
  const job = state.jobId === null || state.jobId === undefined ? 'No job' : `Job #${state.jobId}`;
  switch (state.status) {
    case 'IDLE':
      return 'Idle — press Run';
    case 'VALIDATING':
      return `${job} · validating input`;
    case 'STARTING_WORKER':
      return `${job} · starting worker`;
    case 'RUNNING_WORKER':
      return `${job} · running ${state.completedIncrements ?? 0}/${state.totalIncrements ?? 0} increments`;
    case 'RUNNING_FALLBACK':
      return `${job} · fallback ${state.completedIncrements ?? 0}/${state.totalIncrements ?? 0} increments`;
    case 'CANCELLING':
      return `${job} · cancelling`;
    case 'CANCELLED':
      return `${job} · cancelled`;
    case 'FAILED':
      return `${job} · failed — ${errorText(state.error)}`;
    case 'SUCCEEDED': {
      const result = state.result;
      if (!result) return `${job} · succeeded`;
      return `${job} · succeeded · N=${result.input.pathCount} · M=${result.derived.totalSteps}`
        + ` · T=${result.input.horizonYears} · ${result.algorithmId}`;
    }
    default:
      return `${job} · ${String(state.status)}`;
  }
}

export function pathScaling(result) {
  if (!result || !result.plotData || !result.derived || !result.input) return null;
  const { prices } = result.plotData;
  const { retainedPathCount, totalSteps } = result.derived;
  if (!(prices instanceof Float64Array) || !Number.isInteger(retainedPathCount) || !Number.isInteger(totalSteps)) return null;
  let min = Infinity;
  let max = -Infinity;
  for (let p = 0; p < retainedPathCount; p++) {
    const offset = p * (totalSteps + 1);
    for (let step = 0; step <= totalSteps; step++) {
      const value = prices[offset + step];
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  const initial = result.input.initialPrice;
  if (Number.isFinite(initial)) {
    if (initial < min) min = initial;
    if (initial > max) max = initial;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) return null;
  if (max === min) {
    const pad = Math.max(Math.abs(min) * 0.05, 1e-12);
    return { min: Math.max(Number.MIN_VALUE, min - pad), max: max + pad, retained: retainedPathCount, steps: totalSteps };
  }
  return { min, max, retained: retainedPathCount, steps: totalSteps };
}

export function sampleColumns(steps, columns) {
  if (!Number.isInteger(steps) || steps < 0 || !Number.isInteger(columns) || columns < 2) {
    throw new RangeError('Invalid column sampling');
  }
  if (columns >= steps + 1) return Array.from({ length: steps + 1 }, (_, index) => index);
  return Array.from({ length: columns }, (_, column) => Math.round((column * steps) / (columns - 1)));
}

function bounded(value, low, high) {
  if (!Number.isFinite(value)) return null;
  return Math.min(high, Math.max(low, value));
}

export function drawPaths(ctx, box, result) {
  const width = box && box.width;
  const height = box && box.height;
  const padding = (box && box.padding) === undefined ? 20 : box.padding;
  if (!ctx || !Number.isFinite(width) || !Number.isFinite(height)) return 0;
  ctx.clearRect(0, 0, width, height);
  const scale = pathScaling(result);
  if (!scale) return 0;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const columns = Math.max(2, Math.min(Math.round(usableWidth), scale.steps + 1));
  const sampled = sampleColumns(scale.steps, columns);
  const span = scale.max - scale.min;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  const initial = result.input.initialPrice;
  if (Number.isFinite(initial)) {
    const baseline = bounded(height - padding - ((initial - scale.min) / span) * usableHeight, padding, height - padding);
    if (baseline !== null) {
      ctx.strokeStyle = '#475569';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, baseline);
      ctx.lineTo(width - padding, baseline);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  let drawn = 0;
  for (let p = 0; p < scale.retained; p++) {
    const offset = p * (scale.steps + 1);
    const terminal = result.plotData.prices[offset + scale.steps];
    ctx.strokeStyle = Number.isFinite(terminal) && terminal >= initial
      ? 'rgba(52, 211, 153, 0.35)'
      : 'rgba(251, 113, 133, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let open = false;
    for (let column = 0; column < sampled.length; column++) {
      const value = result.plotData.prices[offset + sampled[column]];
      if (!Number.isFinite(value)) {
        open = false;
        continue;
      }
      const x = bounded(padding + (column / (sampled.length - 1)) * usableWidth, padding, width - padding);
      const y = bounded(height - padding - ((value - scale.min) / span) * usableHeight, padding, height - padding);
      if (x === null || y === null) {
        open = false;
        continue;
      }
      if (!open) {
        ctx.moveTo(x, y);
        open = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (!open) continue;
    ctx.stroke();
    drawn++;
  }
  return drawn;
}

export function histogramBinCount(length) {
  if (!Number.isInteger(length) || length <= 0) return 12;
  return Math.min(40, Math.max(12, Math.ceil(Math.sqrt(length))));
}

export function buildHistogram(terminals, binCount) {
  if (!terminals || typeof terminals.length !== 'number' || terminals.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const value of terminals) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max === min) {
    const pad = Math.max(Math.abs(min) * 0.05, 1e-12);
    min = Math.max(Number.MIN_VALUE, min - pad);
    max = max + pad;
  }
  const bins = Math.min(64, Math.max(4, binCount === undefined ? histogramBinCount(terminals.length) : binCount));
  const counts = new Array(bins).fill(0);
  const width = (max - min) / bins;
  let counted = 0;
  for (const value of terminals) {
    if (!Number.isFinite(value)) continue;
    let index = Math.floor((value - min) / width);
    if (index < 0) index = 0;
    if (index >= bins) index = bins - 1;
    counts[index]++;
    counted++;
  }
  return { min, max, bins, counts, maxCount: Math.max(...counts), counted };
}

export function drawDistribution(ctx, box, result, histogram) {
  const width = box && box.width;
  const height = box && box.height;
  const padding = (box && box.padding) === undefined ? 20 : box.padding;
  if (!ctx || !Number.isFinite(width) || !Number.isFinite(height)) return 0;
  ctx.clearRect(0, 0, width, height);
  if (!histogram) return 0;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const barWidth = usableWidth / histogram.bins;
  let bars = 0;
  for (let index = 0; index < histogram.bins; index++) {
    const barHeight = histogram.maxCount > 0 ? (histogram.counts[index] / histogram.maxCount) * usableHeight : 0;
    const x = bounded(padding + index * barWidth, padding, width - padding);
    const y = bounded(height - padding - barHeight, padding, height - padding);
    if (x === null || y === null) continue;
    ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
    ctx.fillRect(x, y, Math.max(1, barWidth - 1), Math.max(0, height - padding - y));
    bars++;
  }
  const summary = result && result.summary;
  if (summary) {
    const markers = [[summary.p5, '#fb7185'], [summary.p50, '#fbbf24'], [summary.p95, '#34d399']];
    for (const [value, color] of markers) {
      if (!Number.isFinite(value)) continue;
      const x = bounded(padding + ((value - histogram.min) / (histogram.max - histogram.min)) * usableWidth,
        padding, width - padding);
      if (x === null) continue;
      ctx.strokeStyle = color;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  return bars;
}

export function createRedrawScheduler({ requestFrame, cancelFrame } = {}) {
  const raf = requestFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const caf = cancelFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
  let scheduled = false;
  let frame = null;
  let disposed = false;
  return {
    schedule(task) {
      if (disposed || typeof task !== 'function') return false;
      if (scheduled) return false;
      if (!raf) {
        task();
        return true;
      }
      scheduled = true;
      frame = raf(() => {
        scheduled = false;
        frame = null;
        if (!disposed) task();
      });
      return true;
    },
    dispose() {
      disposed = true;
      if (frame !== null && typeof caf === 'function') caf(frame);
      frame = null;
      scheduled = false;
    },
    get pending() {
      return scheduled;
    },
  };
}

function canvasSurface(element, scope) {
  const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
  const cssWidth = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 640;
  const cssHeight = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 320;
  const ratio = Number.isFinite(scope.devicePixelRatio) && scope.devicePixelRatio > 0 ? scope.devicePixelRatio : 1;
  element.width = Math.max(1, Math.round(cssWidth * ratio));
  element.height = Math.max(1, Math.round(cssHeight * ratio));
  const context = element.getContext('2d');
  if (context && typeof context.setTransform === 'function') context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, box: { width: cssWidth, height: cssHeight } };
}

export function mount({ window: scope, document: doc, controller } = {}) {
  if (!scope || !doc) throw new Error('mount requires window and document');
  const element = id => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`QCL I2 mount: missing element #${id}`);
    return found;
  };
  const nodes = {
    initialPrice: element(FIELD_IDS.initialPrice),
    annualDrift: element(FIELD_IDS.annualDrift),
    annualVolatility: element(FIELD_IDS.annualVolatility),
    horizonYears: element(FIELD_IDS.horizonYears),
    stepsPerYear: element(FIELD_IDS.stepsPerYear),
    pathCount: element(FIELD_IDS.pathCount),
    seed: element(FIELD_IDS.seed),
    run: element('runButton'),
    cancel: element('cancelButton'),
    status: element('simStatus'),
    error: element('errorBox'),
    pathsCanvas: element('simCanvas'),
    distCanvas: element('distCanvas'),
    statN: element('statN'),
    statM: element('statM'),
    statT: element('statT'),
    statAlgo: element('statAlgo'),
    stats: STAT_IDS.map(element),
  };
  const stats = new Map(nodes.stats.map(node => [node.id, node]));
  for (const node of nodes.stats) {
    if (!stats.has(node.id)) stats.set(node.id, node);
  }
  const pathsNote = typeof doc.getElementById === 'function' ? doc.getElementById('pathsNote') : null;
  const controllerInstance = controller || createTaskController(DEV_GUARDS);
  const scheduler = createRedrawScheduler({ requestFrame: scope.requestAnimationFrame?.bind(scope),
    cancelFrame: scope.cancelAnimationFrame?.bind(scope) });
  let currentJobId = null;
  let lastResult = null;

  const formValue = () => {
    const form = {};
    for (const name of Object.keys(FIELD_IDS)) {
      form[name] = nodes[name] ? String(nodes[name].value ?? '') : '';
    }
    return form;
  };

  const clearCanvas = node => {
    const surface = canvasSurface(node, scope);
    if (surface.context) surface.context.clearRect(0, 0, surface.box.width, surface.box.height);
  };

  const clearOutput = () => {
    clearCanvas(nodes.pathsCanvas);
    clearCanvas(nodes.distCanvas);
    for (const node of nodes.stats) node.textContent = '—';
    const note = nodes.pathsCanvas.parentElement;
    if (note) {
      const label = note.getAttribute('data-paths-note');
      if (label !== null) note.setAttribute('data-paths-note', '');
    }
    if (pathsNote) pathsNote.textContent = '–';
  };

  const showError = error => {
    nodes.error.textContent = errorText(error);
    const fieldName = error && typeof error.field === 'string' && Object.hasOwn(FIELD_IDS, error.field)
      ? error.field : null;
    const target = fieldName ? nodes[fieldName] : null;
    if (target && typeof target.focus === 'function') target.focus();
    return target;
  };

  const clearError = () => {
    nodes.error.textContent = '';
  };

  const paint = () => {
    if (!lastResult) return;
    const paths = canvasSurface(nodes.pathsCanvas, scope);
    drawPaths(paths.context, paths.box, lastResult);
    const note = nodes.pathsCanvas.parentElement;
    if (note) {
      const label = `Showing ${lastResult.derived.retainedPathCount} of ${lastResult.input.pathCount} paths`;
      note.setAttribute('data-paths-note', label);
      if (pathsNote) pathsNote.textContent = label;
    }
    const distribution = canvasSurface(nodes.distCanvas, scope);
    const terminals = lastResult.pathData.terminalPrices;
    drawDistribution(distribution.context, distribution.box, lastResult,
      buildHistogram(terminals, histogramBinCount(terminals.length)));
  };

  const writeStats = result => {
    for (const row of statRows(result)) {
      const node = stats.get(row.id);
      if (node) node.textContent = row.text;
    }
  };

  const writeMeta = result => {
    if (result) {
      nodes.statN.textContent = String(result.input.pathCount);
      nodes.statM.textContent = String(result.derived.totalSteps);
      nodes.statT.textContent = String(result.input.horizonYears);
      nodes.statAlgo.textContent = result.algorithmId;
      return;
    }
    const form = formValue();
    const horizon = Number(form.horizonYears);
    const steps = Number(form.stepsPerYear);
    if (Number.isFinite(horizon) && Number.isFinite(steps)) {
      const totalSteps = totalStepsForProduct(horizon * steps);
      nodes.statN.textContent = form.pathCount || '—';
      nodes.statM.textContent = Number.isSafeInteger(totalSteps) ? String(totalSteps) : '—';
      nodes.statT.textContent = form.horizonYears || '—';
    }
  };

  const buttons = state => {
    const cancellable = isCancellable(state);
    nodes.run.disabled = ['VALIDATING', 'STARTING_WORKER', 'RUNNING_WORKER', 'RUNNING_FALLBACK', 'CANCELLING']
      .includes(state && state.status);
    nodes.cancel.disabled = !cancellable;
  };

  const render = state => {
    nodes.status.textContent = statusText(state);
    if (state && state.status === 'FAILED') showError(state.error);
    if (state && state.status === 'SUCCEEDED' && acceptResult(state, currentJobId)) {
      lastResult = state.result;
      writeStats(state.result);
      writeMeta(state.result);
      paint();
    } else if (state && state.status === 'SUCCEEDED') {
      // A result from a superseded job must never reach the page.
      return;
    }
    if (state && state.status === 'IDLE') {
      lastResult = null;
      clearOutput();
      writeMeta(null);
    }
    buttons(state);
  };

  const unsubscribe = controllerInstance.subscribe(render);
  buttons({ status: 'IDLE' });

  const onRun = () => {
    clearError();
    const seedToken = String(nodes.seed.value ?? '').trim();
    if (seedToken === '') {
      const generated = generateSeed(scope);
      if (!generated.ok) {
        showError(generated.error);
        return;
      }
      nodes.seed.value = String(generated.value);
    }
    const built = buildInput(formValue());
    if (!built.ok) {
      showError(built.error);
      return;
    }
    clearOutput();
    lastResult = null;
    const jobId = controllerInstance.start(built.value);
    currentJobId = jobId;
    writeMeta(null);
  };

  const onCancel = () => {
    if (currentJobId === null) return;
    controllerInstance.cancel(currentJobId);
  };

  const onInput = () => {
    clearError();
    currentJobId = null;
    lastResult = null;
    clearOutput();
    controllerInstance.invalidate();
    writeMeta(null);
  };

  const onResize = () => {
    scheduler.schedule(paint);
  };

  nodes.run.addEventListener('click', onRun);
  nodes.cancel.addEventListener('click', onCancel);
  for (const name of Object.keys(FIELD_IDS)) {
    nodes[name].addEventListener('input', onInput);
  }
  scope.addEventListener('resize', onResize);
  let observer = null;
  if (typeof scope.ResizeObserver === 'function' && nodes.pathsCanvas.parentElement) {
    observer = new scope.ResizeObserver(onResize);
    observer.observe(nodes.pathsCanvas.parentElement);
  }

  return {
    controller: controllerInstance,
    render,
    paint,
    get result() {
      return lastResult;
    },
    dispose() {
      unsubscribe();
      scheduler.dispose();
      if (observer && typeof observer.disconnect === 'function') observer.disconnect();
      if (typeof scope.removeEventListener === 'function') scope.removeEventListener('resize', onResize);
      nodes.run.removeEventListener('click', onRun);
      nodes.cancel.removeEventListener('click', onCancel);
      for (const name of Object.keys(FIELD_IDS)) nodes[name].removeEventListener('input', onInput);
      controllerInstance.dispose();
    },
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mount({ window, document });
}
