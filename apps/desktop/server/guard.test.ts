// Web dev mode must not be usable by other websites (see guard.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowRequest, isLocalHost } from './guard';

const PORT = 5179;
const req = (headers: Record<string, string>, method = 'POST') => ({ method, url: '/api/invoke/x', headers });
const json = { host: 'localhost:5179', 'content-type': 'application/json' };

test('the page itself gets through', () => {
  assert.ok(allowRequest(req(json), PORT));
  assert.ok(allowRequest(req({ ...json, origin: 'http://localhost:5179' }), PORT));
  assert.ok(allowRequest(req({ host: '127.0.0.1:5179' }, 'GET'), PORT));
});

test('another website cannot send commands (cross-site POST)', () => {
  assert.ok(!allowRequest(req({ ...json, origin: 'https://evil.example' }), PORT));
  // A no-cors fetch can only send text/plain, form or multipart bodies.
  assert.ok(!allowRequest(req({ host: 'localhost:5179', 'content-type': 'text/plain;charset=UTF-8' }), PORT));
  assert.ok(!allowRequest(req({ host: 'localhost:5179' }), PORT));
});

test('DNS rebinding: a request for another host name is refused, reads included', () => {
  assert.ok(!allowRequest(req({ ...json, host: 'evil.example:5179' }), PORT));
  assert.ok(!allowRequest(req({ host: 'evil.example:5179' }, 'GET'), PORT));
  assert.ok(!allowRequest(req({}, 'GET'), PORT));
  assert.ok(!isLocalHost('localhost:1234', PORT));
  assert.ok(isLocalHost('[::1]:5179', PORT));
});
