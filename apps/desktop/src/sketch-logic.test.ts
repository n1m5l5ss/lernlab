// The sketch pad's rules (#220): where a pointer lands on the canvas, undo and clear, and how strokes are drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_POINTS, addPoint, canSaveSketch, drawStrokes, padPoint, startStroke, undoStroke } from './sketch-logic';

const rect = { left: 100, top: 50, width: 240, height: 160 };

test('a pointer position maps to the drawing, whatever size the pad is shown at', () => {
  assert.deepEqual(padPoint(100, 50, rect, 480, 320), [0, 0]);
  assert.deepEqual(padPoint(220, 130, rect, 480, 320), [240, 160]);
  assert.deepEqual(padPoint(340, 210, rect, 480, 320), [480, 320]);
});

test('a pointer outside the pad is held at its edge; a pad with no size gives the corner', () => {
  assert.deepEqual(padPoint(0, 0, rect, 480, 320), [0, 0]);
  assert.deepEqual(padPoint(999, 999, rect, 480, 320), [480, 320]);
  assert.deepEqual(padPoint(5, 5, { left: 0, top: 0, width: 0, height: 0 }, 480, 320), [0, 0]);
});

test('strokes grow point by point, and undo takes back the last one', () => {
  let s = startStroke([], [1, 2]);
  s = addPoint(s, [3, 4]);
  s = startStroke(s, [9, 9]);
  assert.deepEqual(s, [
    [
      [1, 2],
      [3, 4],
    ],
    [[9, 9]],
  ]);
  assert.deepEqual(undoStroke(s), [
    [
      [1, 2],
      [3, 4],
    ],
  ]);
  assert.deepEqual(undoStroke([]), []);
  assert.deepEqual(addPoint([], [1, 1]), []); // no stroke begun
});

test('a point on the same spot is not added twice, and a drawing stops growing at its cap', () => {
  const s = addPoint(startStroke([], [1, 2]), [1, 2]);
  assert.equal(s[0].length, 1);
  const full = [Array.from({ length: MAX_POINTS }, (_, i) => [i, i] as [number, number])];
  assert.equal(addPoint(full, [0, 0]), full);
  assert.equal(startStroke(full, [0, 0]), full);
});

test('there is something to save once there is a stroke or a description', () => {
  assert.equal(canSaveSketch([], '   '), false);
  assert.equal(canSaveSketch([[[1, 1]]], ''), true);
  assert.equal(canSaveSketch([], ' a cat '), true);
});

test('strokes are drawn as round lines; a single point is a dot', () => {
  const calls: string[] = [];
  const ctx = {
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    strokeStyle: '',
    fillStyle: '',
    clearRect: (...a: number[]) => calls.push(`clear ${a.join(',')}`),
    fillRect: (...a: number[]) => calls.push(`fill ${a.join(',')}`),
    beginPath: () => calls.push('begin'),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    stroke: () => calls.push('stroke'),
  };
  drawStrokes(
    ctx,
    [
      [
        [1, 2],
        [3, 4],
      ],
      [[9, 9]],
    ],
    { width: 480, height: 320, ink: 'ink' },
  );
  assert.deepEqual(calls, [
    'clear 0,0,480,320',
    'begin',
    'move 1,2',
    'line 3,4',
    'stroke',
    'begin',
    'move 9,9',
    'line 9,9',
    'stroke',
  ]);
  assert.equal(ctx.strokeStyle, 'ink');
  assert.equal(ctx.lineCap, 'round');

  calls.length = 0;
  drawStrokes(ctx, [], { width: 480, height: 320, ink: 'ink', paper: 'paper' });
  assert.deepEqual(calls, ['fill 0,0,480,320']); // the saved picture has a background, so it reads in any theme
  assert.equal(ctx.fillStyle, 'paper');
});
