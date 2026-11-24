// Sketch checks (#220): only a small PNG is kept as a card's picture cue, and the description is plain text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKETCH, cleanSketchText, sketchProblem } from './sketch';
import { fakePng } from './sketch-samples';

test('a small PNG passes', () => {
  assert.equal(sketchProblem(fakePng(480, 320)), null);
});

test('anything that is not a PNG is refused', () => {
  assert.equal(sketchProblem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])), 'unsupported_media');
  assert.equal(sketchProblem(new TextEncoder().encode('<svg onload="x()"></svg>')), 'unsupported_media');
  assert.equal(sketchProblem(fakePng(480, 320).slice(0, 20)), 'unsupported_media'); // cut short
  const noEnd = fakePng(480, 320);
  noEnd[noEnd.length - 6] = 0x58; // no IEND chunk at the end
  assert.equal(sketchProblem(noEnd), 'unsupported_media');
});

test('a picture that is too big, in bytes or in pixels, is refused', () => {
  assert.equal(sketchProblem(fakePng(480, 320, SKETCH.maxBytes)), 'sketch_too_big');
  assert.equal(sketchProblem(fakePng(SKETCH.maxSide + 1, 320)), 'sketch_too_big');
  assert.equal(sketchProblem(fakePng(480, 0)), 'sketch_too_big');
  assert.equal(sketchProblem(fakePng(SKETCH.maxSide, SKETCH.maxSide)), null);
});

test('the description is one line of plain text, capped', () => {
  assert.equal(cleanSketchText('  a  cat\n on a\tmat '), 'a cat on a mat');
  assert.equal(cleanSketchText('<b>bold</b>'), '<b>bold</b>'); // kept as text; the screen never renders it as HTML
  assert.equal(cleanSketchText('x'.repeat(500)).length, SKETCH.maxText);
  assert.equal(cleanSketchText(undefined), '');
});
