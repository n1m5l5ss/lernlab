import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFinisher } from './finish-logic';

/** Fakes for the three steps that log the order they ran in; each can be held open until released. */
function fakes() {
  const log: string[] = [];
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  return {
    log,
    release,
    deps: {
      saved: async () => {
        await held;
        log.push('saved');
      },
      finish: async (r: { sessionId: string }) => {
        log.push(`finish ${r.sessionId}`);
        return { bonus: 5 };
      },
      reload: async () => {
        log.push('reload');
      },
    },
  };
}

test('waits for every answer to be saved, then records the session, then reloads Home', async () => {
  const f = fakes();
  const end = sessionFinisher(f.deps);
  const done = end({ sessionId: 's1' });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(f.log, [], 'nothing is recorded while answers are still on their way');
  f.release();
  assert.deepEqual(await done, { server: { bonus: 5 } });
  assert.deepEqual(f.log, ['saved', 'finish s1', 'reload']);
});

test('a session is finished once, even if its last answer ends it twice', async () => {
  const f = fakes();
  f.release();
  const end = sessionFinisher(f.deps);
  const [first, second] = await Promise.all([end({ sessionId: 's1' }), end({ sessionId: 's1' })]);
  assert.deepEqual(first, { server: { bonus: 5 } });
  assert.equal(second, null);
  assert.equal(await end({ sessionId: 's1' }), null);
  assert.deepEqual(f.log, ['saved', 'finish s1', 'reload']);
  // The next session finishes as usual.
  assert.ok(await end({ sessionId: 's2' }));
  assert.deepEqual(f.log.slice(3), ['saved', 'finish s2', 'reload']);
});

test('a failed save still shows the summary, without server facts, and still reloads Home', async () => {
  const log: string[] = [];
  const end = sessionFinisher({
    saved: async () => {},
    finish: async () => {
      throw new Error('offline');
    },
    reload: async () => {
      log.push('reload');
    },
  });
  assert.deepEqual(await end({ sessionId: 's1' }), { server: null });
  assert.deepEqual(log, ['reload']);
});
