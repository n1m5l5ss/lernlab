import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_SIZES, applyDisplay, motionReduced } from './display';

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
