import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupKind, confirmed } from './data-logic';

test('a backup shows why it was made; unknown or missing labels count as manual', () => {
  assert.equal(backupKind('daily'), 'daily');
  assert.equal(backupKind('before-update'), 'before-update');
  assert.equal(backupKind(null), 'manual');
  assert.equal(backupKind('toString'), 'manual');
});

test('deleting everything needs the confirmation word typed out', () => {
  assert.equal(confirmed('DELETE', 'DELETE'), true);
  assert.equal(confirmed('  delete ', 'DELETE'), true);
  assert.equal(confirmed('LÖSCHEN', 'löschen', 'de'), true);
  assert.equal(confirmed('DELET', 'DELETE'), false);
  assert.equal(confirmed('', ''), false);
});
