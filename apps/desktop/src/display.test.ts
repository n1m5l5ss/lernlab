import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../../../docs/design/tokens.json';
import { TEXT_SIZES, applyDisplay, motionReduced, textPx } from './display';

test('text size sets a scale on the root; normal and unknown sizes clear it', () => {
  const root = { dataset: {} as DOMStringMap };
  applyDisplay({ textSize: 'large', reducedMotion: false }, root);
  assert.equal(root.dataset.textSize, 'large');
  applyDisplay({ textSize: 'larger', reducedMotion: false }, root);
  assert.equal(root.dataset.textSize, 'larger');
  applyDisplay({ textSize: 'normal', reducedMotion: false }, root);
  assert.equal(root.dataset.textSize, undefined);
  applyDisplay({ textSize: 'huge', reducedMotion: false }, root);
  assert.equal(root.dataset.textSize, undefined);
  assert.deepEqual(TEXT_SIZES, ['normal', 'large', 'larger']);
});

test('reduced motion marks the root, and is on when either the setting or the computer asks for it', () => {
  const root = { dataset: {} as DOMStringMap };
  applyDisplay({ textSize: 'normal', reducedMotion: true }, root);
  assert.equal(root.dataset.motion, 'reduce');
  assert.equal(motionReduced(root, false), true);
  applyDisplay({ textSize: 'normal', reducedMotion: false }, root);
  assert.equal(root.dataset.motion, undefined);
  assert.equal(motionReduced(root, false), false);
  assert.equal(motionReduced(root, true), true);
});

test('every text size has a scale in the design tokens', () => {
  assert.deepEqual(Object.keys(tokens.textSize), [...TEXT_SIZES]);
  assert.equal(tokens.textSize.normal, 1);
});

test('inline font sizes follow the text size setting', () => {
  assert.equal(textPx(22), 'calc(22px * var(--text-scale))');
});
