import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERF_GLOBAL, startupMarks, type PerfMarks } from './perf';

const read = () => (globalThis as Record<string, unknown>)[PERF_GLOBAL] as PerfMarks | undefined;

test('startup marks are inert in normal use', () => {
  delete (globalThis as Record<string, unknown>)[PERF_GLOBAL];
  const mark = startupMarks({});
  mark('app-ready');
  assert.equal(read(), undefined);
});

test('with LERNLAB_PERF=1 each mark keeps its first time, in ms since the epoch', () => {
  const before = Date.now();
  const mark = startupMarks({ LERNLAB_PERF: '1' });
  mark('app-ready');
  const first = read()!['app-ready'];
  mark('app-ready');
  assert.equal(read()!['app-ready'], first);
  assert.ok(first >= before - 5 && first <= Date.now() + 5);
  delete (globalThis as Record<string, unknown>)[PERF_GLOBAL];
});
