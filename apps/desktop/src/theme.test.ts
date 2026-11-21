import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme } from './theme';

test('light and dark set the theme; system and unknown values leave it to the computer', () => {
  const root = { dataset: {} as DOMStringMap };
  applyTheme('dark', root);
  assert.equal(root.dataset.theme, 'dark');
  applyTheme('light', root);
  assert.equal(root.dataset.theme, 'light');
  applyTheme('system', root);
  assert.equal(root.dataset.theme, undefined);
  applyTheme('dark', root);
  applyTheme(undefined, root);
  assert.equal(root.dataset.theme, undefined);
});
