// Messages between main and the data process are checked on arrival (#56).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConnect, isDataStatus, parseDataMessage, parseRequest } from './data-protocol';

test('a request needs a positive id and a channel name', () => {
  assert.deepEqual(parseRequest({ id: 1, channel: 'state.get' }), { id: 1, channel: 'state.get', input: undefined });
  const bytes = new Uint8Array([1, 2]);
  assert.deepEqual(parseRequest({ id: 7, channel: 'import.file', input: { data: bytes } }), {
    id: 7,
    channel: 'import.file',
    input: { data: bytes },
  });
  for (const bad of [null, 'x', {}, { id: 0, channel: 'a' }, { id: 1.5, channel: 'a' }, { id: 1, channel: 2 }])
    assert.equal(parseRequest(bad), null, JSON.stringify(bad));
});

test('replies, ready and fatal messages are recognised; anything else is dropped', () => {
  assert.deepEqual(parseDataMessage({ type: 'ready' }), { type: 'ready' });
  assert.deepEqual(parseDataMessage({ type: 'fatal', message: 'no' }), { type: 'fatal', message: 'no' });
  const ok = { type: 'reply', id: 3, result: { ok: true, value: null } };
  assert.deepEqual(parseDataMessage(ok), ok);
  const err = {
    type: 'reply',
    id: 4,
    result: { ok: false, error: { code: 'failed', message: 'm', params: { n: 1 } } },
  };
  assert.deepEqual(parseDataMessage(err), err);
  for (const bad of [
    undefined,
    { type: 'reply', id: 3 },
    { type: 'reply', id: 3, result: { ok: true } },
    { type: 'reply', id: -1, result: { ok: true, value: 1 } },
    { type: 'reply', id: 3, result: { ok: false, error: { code: 1, message: 'm' } } },
    { type: 'fatal' },
    { type: 'other' },
    { id: 1, result: { ok: true, value: 1 } },
  ])
    assert.equal(parseDataMessage(bad), null, JSON.stringify(bad));
});

test('connect and status values', () => {
  assert.ok(isConnect({ type: 'connect' }));
  assert.ok(!isConnect({ type: 'ready' }));
  for (const s of ['ok', 'reconnecting', 'failed']) assert.ok(isDataStatus(s));
  assert.ok(!isDataStatus('down'));
});
