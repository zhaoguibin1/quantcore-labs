import { createSimulation, prepareInput } from './mc-v2-core.mjs';
import { workerChunkSize, message, resultArrays, taskError, validMessage, validResult } from './mc-v2-protocol.mjs';

export function bindWorker(endpoint, schedule = setTimeout) {
  let phase = 'initial';
  let jobId;
  let attemptId;
  let seq = 0;
  let simulation;
  let prepared;

  function send(type, payload, transfer) {
    endpoint.postMessage(message(jobId, attemptId, seq, type, payload), transfer);
    seq++;
  }

  function fail(error = taskError('EXECUTION_FAILED', 'INTERNAL_FAILURE')) {
    phase = 'terminal';
    simulation = prepared = null;
    send('error', error);
  }

  function step() {
    if (phase !== 'running') return;
    try {
      const progress = simulation.advance(workerChunkSize);
      if (!progress.ok) return fail(progress.error);
      const { status, completedIncrements, totalIncrements } = progress.value;
      send('progress', { completedIncrements, totalIncrements });
      if (status !== 'ready') {
        schedule(step, 0);
        return;
      }
      const result = simulation.finish();
      if (!result.ok) return fail(result.error);
      if (!validResult(result.value, prepared)) return fail(taskError('EXECUTION_FAILED', 'PROTOCOL'));
      phase = 'terminal';
      simulation = prepared = null;
      send('result', result.value, resultArrays(result.value).map(array => array.buffer));
    } catch {
      fail();
    }
  }

  endpoint.addEventListener('message', ({ data }) => {
    if (phase === 'terminal') return;
    try {
      if (phase === 'initial') {
        jobId = data?.jobId;
        attemptId = data?.attemptId;
        if (!validMessage(data, ['init'], jobId, attemptId, 0)) {
          return fail(taskError('EXECUTION_FAILED', 'PROTOCOL'));
        }
        phase = 'ready';
        send('ready');
        return;
      }
      if (phase !== 'ready' || !validMessage(data, ['run'], jobId, attemptId, 1)) {
        return fail(taskError('EXECUTION_FAILED', 'PROTOCOL'));
      }
      const checked = prepareInput(data.payload);
      if (!checked.ok) return fail(checked.error);
      const created = createSimulation(data.payload);
      if (!created.ok) return fail(created.error);
      prepared = checked.value;
      simulation = created.value;
      phase = 'running';
      schedule(step, 0);
    } catch {
      fail();
    }
  });
}

if (typeof DedicatedWorkerGlobalScope !== 'undefined' && globalThis instanceof DedicatedWorkerGlobalScope) {
  bindWorker(globalThis);
}
