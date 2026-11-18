import { createSimulation, prepareInput } from './mc-v2-core.mjs';
import { chunkSize, message, taskError, validMessage, validResult } from './mc-v2-protocol.mjs';

// Development watchdogs only. Fallback requires an explicit increment limit.
export const devGuards = Object.freeze({ handshakeMs: 2000, executionMs: 30000, fallbackMaxIncrements: 0 });
const browserWorker = () => new Worker(new URL('./mc-v2-worker.mjs', import.meta.url), { type: 'module' });
const executionError = reason => taskError('EXECUTION_FAILED', reason);

export function createTaskController({
  createWorker = browserWorker,
  schedule = setTimeout,
  clear = clearTimeout,
  handshakeMs = devGuards.handshakeMs,
  executionMs = devGuards.executionMs,
  fallbackMaxIncrements = devGuards.fallbackMaxIncrements,
} = {}) {
  if (![handshakeMs, executionMs].every(ms => Number.isInteger(ms) && ms > 0 && ms <= 2147483647) ||
      !Number.isSafeInteger(fallbackMaxIncrements) || fallbackMaxIncrements < 0 || fallbackMaxIncrements > 300000) {
    throw new RangeError('Invalid development guard');
  }
  const listeners = new Set();
  let current;
  let nextJobId = 0;
  let disposed = false;
  let snapshot = { status: 'IDLE', jobId: null };

  function publish(next) {
    snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next || disposed) break;
      if (!listeners.has(listener)) continue;
      try {
        listener(structuredClone(next));
      } catch {
        // A consumer cannot interrupt task processing or other consumers.
      }
    }
  }

  function active(job, attempt) {
    return !disposed && current === job && job.attempt === attempt;
  }

  function release(job) {
    if (!job?.attempt) return;
    const attempt = job.attempt;
    job.attempt = null;
    if (attempt.timeout !== undefined) clear(attempt.timeout);
    if (attempt.pending !== undefined) clear(attempt.pending);
    if (attempt.worker) {
      for (const [type, listener] of attempt.listeners) attempt.worker.removeEventListener(type, listener);
      attempt.worker.terminate();
    }
    attempt.simulation = null;
  }

  function view(job, status, extra = {}) {
    publish({ status, jobId: job.id, attemptId: job.attemptId, ...extra });
  }

  function fail(job, error) {
    release(job);
    view(job, 'FAILED', { error });
  }

  function commit(job, attempt, result) {
    if (!active(job, attempt)) return;
    if (!validResult(result, job.prepared)) return fail(job, executionError('PROTOCOL'));
    release(job);
    view(job, 'SUCCEEDED', { result });
  }

  function fallback(job, oldAttempt) {
    if (!active(job, oldAttempt)) return;
    release(job);
    if (job.total > fallbackMaxIncrements) {
      return fail(job, taskError('WORKER_UNAVAILABLE', 'FALLBACK_LIMIT'));
    }
    const attempt = { mode: 'fallback' };
    job.attemptId++;
    job.attempt = attempt;
    const created = createSimulation(job.prepared.input);
    if (!created.ok) return fail(job, created.error);
    attempt.simulation = created.value;

    function finish() {
      if (!active(job, attempt)) return;
      const result = attempt.simulation.finish();
      if (result.ok) commit(job, attempt, result.value);
      else fail(job, result.error);
    }

    function step() {
      if (!active(job, attempt)) return;
      const progress = attempt.simulation.advance(chunkSize);
      if (!progress.ok) return fail(job, progress.error);
      view(job, 'RUNNING_FALLBACK', {
        completedIncrements: progress.value.completedIncrements, totalIncrements: job.total,
      });
      if (active(job, attempt)) {
        attempt.pending = schedule(progress.value.status === 'ready' ? finish : step, 0);
      }
    }

    view(job, 'RUNNING_FALLBACK', { completedIncrements: 0, totalIncrements: job.total });
    if (active(job, attempt)) {
      attempt.timeout = schedule(() => {
        if (active(job, attempt)) fail(job, executionError('EXECUTION_TIMEOUT'));
      }, executionMs);
      attempt.pending = schedule(step, 0);
    }
  }

  function launch(job) {
    const attempt = { mode: 'starting', seq: 0, completed: 0, listeners: [] };
    job.attemptId++;
    job.attempt = attempt;
    view(job, 'STARTING_WORKER');
    if (!active(job, attempt)) return;
    try {
      attempt.worker = createWorker();
    } catch {
      fallback(job, attempt);
      return;
    }

    function workerError(event) {
      if (!active(job, attempt)) return;
      event.preventDefault?.();
      if (attempt.mode === 'starting') fallback(job, attempt);
      else fail(job, executionError('WORKER_CRASH'));
    }

    function receive({ data }) {
      if (!active(job, attempt)) return;
      const types = attempt.mode === 'starting' ? ['ready', 'error'] : ['progress', 'result', 'error'];
      if (!validMessage(data, types, job.id, job.attemptId, attempt.seq)) {
        return fail(job, executionError('PROTOCOL'));
      }
      attempt.seq++;
      if (data.type === 'error') {
        if (attempt.mode === 'starting' && data.payload.code === 'WORKER_UNAVAILABLE' &&
            data.payload.reason === 'INITIALIZATION_FAILED') return fallback(job, attempt);
        return fail(job, data.payload);
      }
      if (data.type === 'ready') {
        clear(attempt.timeout);
        attempt.mode = 'running';
        view(job, 'RUNNING_WORKER', { completedIncrements: 0, totalIncrements: job.total });
        if (!active(job, attempt)) return;
        attempt.timeout = schedule(() => {
          if (active(job, attempt)) fail(job, executionError('EXECUTION_TIMEOUT'));
        }, executionMs);
        try {
          attempt.worker.postMessage(message(job.id, job.attemptId, 1, 'run', job.prepared.input));
        } catch {
          fail(job, executionError('WORKER_CRASH'));
        }
        return;
      }
      if (data.type === 'result') {
        if (attempt.completed !== job.total) return fail(job, executionError('PROTOCOL'));
        return commit(job, attempt, data.payload);
      }
      const { completedIncrements, totalIncrements } = data.payload;
      if (totalIncrements !== job.total || completedIncrements < attempt.completed) {
        return fail(job, executionError('PROTOCOL'));
      }
      attempt.completed = completedIncrements;
      view(job, 'RUNNING_WORKER', { completedIncrements, totalIncrements });
    }

    attempt.listeners = [['message', receive], ['error', workerError], ['messageerror', () => {
      if (active(job, attempt)) fail(job, executionError('PROTOCOL'));
    }]];
    try {
      for (const [type, listener] of attempt.listeners) attempt.worker.addEventListener(type, listener);
      attempt.timeout = schedule(() => {
        if (active(job, attempt) && attempt.mode === 'starting') fallback(job, attempt);
      }, handshakeMs);
      attempt.worker.postMessage(message(job.id, job.attemptId, 0, 'init'));
    } catch {
      if (active(job, attempt)) {
        if (attempt.mode === 'starting') fallback(job, attempt);
        else fail(job, executionError('WORKER_CRASH'));
      }
    }
  }

  return {
    start(raw) {
      if (disposed) throw new Error('Controller disposed');
      release(current);
      const job = { id: ++nextJobId, attemptId: 0, validating: true };
      current = job;
      const prepared = prepareInput(raw);
      view(job, 'VALIDATING');
      if (current !== job || disposed || !job.validating) return job.id;
      job.validating = false;
      if (!prepared.ok) fail(job, prepared.error);
      else {
        job.prepared = prepared.value;
        job.total = prepared.value.input.pathCount * prepared.value.derived.totalSteps;
        launch(job);
      }
      return job.id;
    },
    cancel(jobId) {
      const job = current;
      if (!job || job.id !== jobId || (!job.attempt && !job.validating)) return false;
      job.validating = false;
      release(job);
      view(job, 'CANCELLING');
      if (current === job && !disposed) view(job, 'CANCELLED');
      return true;
    },
    invalidate() {
      if (disposed) return;
      release(current);
      current = null;
      publish({ status: 'IDLE', jobId: null });
    },
    subscribe(listener) {
      if (disposed) throw new Error('Controller disposed');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      release(current);
      current = null;
      listeners.clear();
      snapshot = { status: 'IDLE', jobId: null };
    },
  };
}
