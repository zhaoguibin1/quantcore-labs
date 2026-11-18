import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareInput, simulate } from '../tools/monte-carlo-asset-sim/mc-v2-core.mjs';
import { createTaskController } from '../tools/monte-carlo-asset-sim/mc-v2-page.mjs';
import { message, resultArrays, taskError, validMessage, validResult } from '../tools/monte-carlo-asset-sim/mc-v2-protocol.mjs';
import { bindWorker } from '../tools/monte-carlo-asset-sim/mc-v2-worker.mjs';

const input = {
  schemaVersion: 1, initialPrice: 100, annualDrift: 0.08, annualVolatility: 0.2,
  horizonYears: 1, stepsPerYear: 64, pathCount: 5, seed: 5489,
};
const total = 320;
const reference = simulate(input).value;

function harness(kind = 'manual', fallbackMaxIncrements = total) {
  let clock = 0;
  let next = 0;
  const timers = new Map();
  const schedule = (callback, delay) => {
    timers.set(++next, { callback, time: clock + delay });
    return next;
  };
  const clear = id => timers.delete(id);
  const workers = [];
  const transfers = [];
  const controller = createTaskController({
    schedule, clear, handshakeMs: 2, executionMs: 30, fallbackMaxIncrements,
    createWorker() {
      if (kind === 'absent') throw new ReferenceError('No Worker');
      const listeners = new Map();
      const sent = [];
      let receive;
      const worker = {
        sent, listeners, terminated: 0,
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type) { listeners.delete(type); },
        terminate() { this.terminated++; },
        postMessage(data) {
          sent.push(structuredClone(data));
          if (receive) schedule(() => {
            if (!worker.terminated) receive({ data: structuredClone(data) });
          }, 0);
        },
        emit(data) { listeners.get('message')?.({ data }); },
        crash() { listeners.get('error')?.({ preventDefault() {} }); },
      };
      if (kind === 'bound') bindWorker({
        addEventListener(type, callback) { assert.equal(type, 'message'); receive = callback; },
        postMessage(data, transfer) {
          const clone = structuredClone(data, { transfer });
          if (transfer) transfers.push(transfer);
          schedule(() => worker.emit(clone), 0);
        },
      }, schedule);
      workers.push(worker);
      return worker;
    },
  });
  const states = [];
  controller.subscribe(state => states.push(state));
  return {
    controller, states, workers, transfers, timers,
    last: () => states.at(-1),
    tick() {
      const entry = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
      assert.ok(entry, 'expected a scheduled task');
      timers.delete(entry[0]);
      clock = entry[1].time;
      entry[1].callback();
    },
    drain() {
      for (let steps = 0; timers.size; steps++) {
        assert.ok(steps < 100, 'unexpected unbounded schedule');
        this.tick();
      }
    },
  };
}

const ready = job => message(job, 1, 0, 'ready');
const progress = (job, seq, completed = total, amount = total) =>
  message(job, 1, seq, 'progress', { completedIncrements: completed, totalIncrements: amount });
const result = (job, seq) => message(job, 1, seq, 'result', structuredClone(reference));

test('envelope rejects illegal versions, IDs, types, sequences and payloads', () => {
  const base = ready(1);
  assert.ok(validMessage(base, ['ready'], 1, 1, 0));
  for (const change of [
    { protocolVersion: 2 }, { jobId: 0 }, { jobId: 2 }, { attemptId: 0 }, { attemptId: 2 },
    { seq: -1 }, { seq: 1 }, { type: 'unknown' }, { payload: {} }, { extra: true },
  ]) assert.equal(validMessage({ ...base, ...change }, ['ready'], 1, 1, 0), false);
  assert.equal(validMessage(message(1, 1, 0, 'error', {
    ...taskError('EXECUTION_FAILED', 'INTERNAL_FAILURE'), field: '<unsafe>',
  }), ['error'], 1, 1, 0), false);
});

test('result validation rejects incompatible shape, buffers and numeric fields', () => {
  const prepared = prepareInput(input).value;
  assert.ok(validResult(reference, prepared));
  for (const mutate of [
    r => { r.resultSchemaVersion = 2; },
    r => { r.input.seed++; },
    r => { r.extra = 1; },
    r => { r.plotData.prices = new Float32Array(r.plotData.prices); },
    r => { r.plotData.prices = r.plotData.prices.slice(1); },
    r => { r.pathData.maxDrawdowns = r.pathData.terminalPrices; },
    r => { r.pathData.terminalPrices[0] = NaN; },
    r => { r.summary.mean = Infinity; },
    r => { r.analyticTerminal.variance = 0; },
    r => { r.pathData.maxDrawdowns[0] = 1.5; },
  ]) {
    const candidate = structuredClone(reference);
    mutate(candidate);
    assert.equal(validResult(candidate, prepared), false);
  }
});

for (const [name, messages] of [
  ['duplicate sequence', id => [progress(id, 1, 1), progress(id, 1, 2)]],
  ['sequence jump', id => [progress(id, 2)]],
  ['out of order', id => [progress(id, 1, 1), progress(id, 0)]],
  ['regressing progress', id => [progress(id, 1, 2), progress(id, 2, 1)]],
  ['incorrect progress total', id => [progress(id, 1, 1, 321)]],
  ['wrong attempt', id => [{ ...progress(id, 1), attemptId: 2 }]],
  ['wrong version', id => [{ ...progress(id, 1), protocolVersion: 0 }]],
  ['result before terminal progress', id => [result(id, 1)]],
  ['nonfinite result', id => {
    const packet = result(id, 2);
    packet.payload.plotData.prices[0] = Infinity;
    return [progress(id, 1), packet];
  }],
]) {
  test(`active Worker fails closed on ${name}`, () => {
    const h = harness();
    const id = h.controller.start(input);
    const worker = h.workers[0];
    worker.emit(ready(id));
    for (const data of messages(id)) worker.emit(data);
    assert.equal(h.last().status, 'FAILED');
    assert.equal(h.last().error.reason, 'PROTOCOL');
    assert.equal(worker.terminated, 1);
    assert.equal(h.timers.size, 0);
    assert.ok(!h.states.some(state => state.status === 'RUNNING_FALLBACK'));
  });
}

for (const startup of ['absent', 'crash', 'timeout', 'init-error']) {
  test(`startup ${startup} permits one fallback without input changes`, () => {
    const h = harness(startup === 'absent' ? 'absent' : 'manual');
    const raw = { ...input };
    const id = h.controller.start(raw);
    raw.seed = 0;
    if (startup === 'crash') h.workers[0].crash();
    if (startup === 'init-error') h.workers[0].emit(message(id, 1, 0, 'error',
      taskError('WORKER_UNAVAILABLE', 'INITIALIZATION_FAILED')));
    h.drain();
    const slices = h.states.filter(state => state.status === 'RUNNING_FALLBACK');
    assert.deepEqual(slices.map(state => state.completedIncrements), [0, 256, 320]);
    assert.ok(slices.every(state => state.attemptId === 2));
    assert.deepEqual(h.last().result, reference);
    assert.equal(h.states.filter(state => state.status === 'SUCCEEDED').length, 1);
    if (startup !== 'absent') assert.equal(h.workers[0].terminated, 1);
  });
}

test('fallback refuses loads beyond its explicit guard and does not resize the request', () => {
  const h = harness('absent', 0);
  h.controller.start(input);
  assert.equal(h.last().status, 'FAILED');
  assert.equal(h.last().error.reason, 'FALLBACK_LIMIT');
  assert.equal(h.timers.size, 0);
});

for (const reason of ['WORKER_CRASH', 'EXECUTION_TIMEOUT']) {
  test(`running Worker ${reason} never triggers fallback`, () => {
    const h = harness();
    const id = h.controller.start(input);
    h.workers[0].emit(ready(id));
    if (reason === 'WORKER_CRASH') h.workers[0].crash();
    else h.drain();
    assert.equal(h.last().error.reason, reason);
    assert.equal(h.last().status, 'FAILED');
    assert.ok(!h.states.some(state => state.status === 'RUNNING_FALLBACK'));
  });
}

test('actual Worker entry on a simulated endpoint transfers three buffers and agrees with fallback', () => {
  const h = harness('bound');
  h.controller.start(input);
  h.drain();
  const f = harness('absent');
  f.controller.start(input);
  f.drain();
  assert.equal(h.last().status, 'SUCCEEDED');
  assert.deepEqual(h.last().result, f.last().result);
  assert.deepEqual(h.last().result, reference);
  assert.equal(h.transfers.length, 1);
  assert.equal(new Set(h.transfers[0]).size, 3);
  assert.deepEqual(h.transfers[0].map(buffer => buffer.byteLength), [0, 0, 0]);
  assert.ok(resultArrays(h.last().result).every(array => array.byteLength > 0));
  assert.deepEqual(h.workers[0].sent.map(packet => [packet.type, packet.seq]), [['init', 0], ['run', 1]]);
  h.controller.start(input);
  h.drain();
  assert.deepEqual(h.last().result, reference);
});

test('cancel and replacement discard late progress, errors and results', () => {
  const h = harness();
  const id = h.controller.start(input);
  const worker = h.workers[0];
  worker.emit(ready(id));
  worker.emit(progress(id, 1));
  const late = worker.listeners.get('message');
  assert.equal(h.controller.cancel(id), true);
  late({ data: result(id, 2) });
  assert.equal(h.last().status, 'CANCELLED');
  const second = h.controller.start(input);
  const staleWorker = h.workers[1];
  const stale = staleWorker.listeners.get('message');
  const third = h.controller.start(input);
  stale({ data: progress(second, 1) });
  stale({ data: message(second, 1, 2, 'error', taskError('EXECUTION_FAILED', 'INTERNAL_FAILURE')) });
  stale({ data: result(second, 3) });
  assert.equal(staleWorker.terminated, 1);
  assert.equal(h.last().jobId, third);
  const active = h.workers[2];
  active.emit(ready(third));
  active.emit(progress(third, 1));
  const duplicate = active.listeners.get('message');
  active.emit(result(third, 2));
  duplicate({ data: result(third, 2) });
  assert.equal(h.controller.cancel(third), false);
  assert.equal(h.last().status, 'SUCCEEDED');
  assert.equal(h.states.filter(state => state.status === 'SUCCEEDED').length, 1);
});

test('fallback cancellation before finish and disposal remove pending tasks', () => {
  const h = harness('absent');
  const id = h.controller.start(input);
  h.tick();
  h.tick();
  assert.equal(h.last().completedIncrements, total);
  assert.equal(h.controller.cancel(id), true);
  assert.equal(h.last().status, 'CANCELLED');
  assert.equal(h.timers.size, 0);
  const w = harness();
  w.controller.start(input);
  w.controller.dispose();
  assert.equal(w.workers[0].terminated, 1);
  assert.equal(w.workers[0].listeners.size, 0);
  assert.equal(w.timers.size, 0);
  assert.throws(() => w.controller.start(input), /disposed/);
});

test('subscriber mutations are isolated, and invalidation revokes the current result', () => {
  const h = harness('bound');
  h.controller.subscribe(state => {
    if (state.status !== 'SUCCEEDED') return;
    state.result.input.seed = 0;
    for (const array of resultArrays(state.result)) array.fill(-1);
  });
  let observed;
  h.controller.subscribe(state => { observed = state; });
  h.controller.start(input);
  h.drain();
  assert.deepEqual(observed.result, reference);
  h.controller.invalidate();
  assert.deepEqual(h.last(), { status: 'IDLE', jobId: null });
});

test('P1 input errors and budget errors never create a Worker', () => {
  const h = harness();
  for (const [raw, reason] of [
    [{ ...input, seed: undefined }, 'INVALID_NUMBER'],
    [{ ...input, horizonYears: 100, stepsPerYear: 1000 }, 'STEP_LIMIT'],
    [{ ...input, horizonYears: 10, stepsPerYear: 1000, pathCount: 1001 }, 'TOTAL_INCREMENT_LIMIT'],
  ]) {
    h.controller.start(raw);
    assert.equal(h.last().status, 'FAILED');
    assert.equal(h.last().error.reason, reason);
  }
  assert.equal(h.workers.length, 0);
});

test('zero volatility is seed-independent in both modes; P1 tests separately check zero RNG construction', () => {
  for (const kind of ['bound', 'absent']) {
    const h = harness(kind);
    const runs = [0, 4294967295].map(seed => {
      h.controller.start({ ...input, annualVolatility: 0, annualDrift: 0, seed });
      h.drain();
      assert.equal(h.last().status, 'SUCCEEDED');
      return h.last().result;
    });
    assert.ok(runs.every(run => run.analyticTerminal.variance === 0));
    assert.deepEqual(runs.map(run => [...run.pathData.terminalPrices]), [Array(5).fill(100), Array(5).fill(100)]);
  }
});

test('extreme finite input surfaces P1 numeric errors in both modes', () => {
  for (const kind of ['bound', 'absent']) {
    const h = harness(kind);
    h.controller.start({ ...input, annualVolatility: 0, annualDrift: 1e308 });
    h.drain();
    assert.equal(h.last().status, 'FAILED');
    assert.equal(h.last().error.code, 'NUMERIC_RANGE');
    assert.equal(h.last().error.reason, 'PRICE_OVERFLOW');
  }
});
