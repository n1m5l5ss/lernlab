import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../../../locales/en.json';
import { dataStatusKey } from './data-status-logic';

test('a notice only while the data process reconnects or has failed', () => {
  assert.equal(dataStatusKey('ok'), null);
  assert.equal(dataStatusKey('reconnecting'), 'app.reconnecting');
  assert.equal(dataStatusKey('failed'), 'app.dataFailed');
  for (const odd of [undefined, null, 'down', 3]) assert.equal(dataStatusKey(odd), null);
});

test('both notices and both data process errors have English text', () => {
  assert.ok(en.app.reconnecting && en.app.dataFailed);
  assert.ok(en.errors.data_process_exit && en.errors.data_process_down);
});
