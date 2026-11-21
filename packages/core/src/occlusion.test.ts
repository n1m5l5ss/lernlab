import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBox, formatBox, modeOf, occlusionOf, parseBox } from './occlusion';
import type { Item } from './types';

test('a box is four fractions of the image size, kept inside the image', () => {
  assert.deepEqual(parseBox('0.1, 0.2, 0.3, 0.4'), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(parseBox('0.9,0.9,0.5,0.5'), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 'pushed back inside');
  assert.deepEqual(parseBox('-1,0,2,0.123456'), { x: 0, y: 0, w: 1, h: 0.1235 });
  for (const bad of ['', '1,2,3', '0,0,0,0.5', 'a,b,c,d', '0,0,-1,1']) assert.equal(parseBox(bad), null, bad);
  assert.equal(formatBox({ x: 0.123456, y: 0, w: 0.5, h: 0.25 }), '0.1235,0,0.5,0.25');
  assert.deepEqual(clampBox({ x: 0, y: 0, w: 0, h: 0 }).w > 0, true, 'never empty');
});

test('the mode is "one" unless the card says "all"', () => {
  assert.equal(modeOf('all'), 'all');
  assert.equal(modeOf(' ALL '), 'all');
  assert.equal(modeOf(undefined), 'one');
  assert.equal(modeOf('bogus'), 'one');
});

test('an occlusion card shows its group, with its own box asked', () => {
  const item = {
    id: 2,
    kind: 'occlusion',
    image: 'heart.png',
    meaning: 'Aorta',
    extra: { occlusion: '0.5,0.1,0.2,0.1', occlusionMode: 'all' },
    occlusionBoxes: [
      { id: 1, box: { x: 0, y: 0, w: 0.1, h: 0.1 }, label: 'Vena cava' },
      { id: 2, box: { x: 0.4, y: 0.1, w: 0.2, h: 0.1 }, label: 'old label' },
    ],
  } as unknown as Item;
  const view = occlusionOf(item)!;
  assert.equal(view.mode, 'all');
  assert.equal(view.asked, 1);
  assert.deepEqual(
    view.boxes[1],
    { id: 2, box: { x: 0.5, y: 0.1, w: 0.2, h: 0.1 }, label: 'Aorta' },
    'its own data wins',
  );
  // Alone (no group loaded), it still shows its own box.
  const alone = occlusionOf({ ...item, occlusionBoxes: undefined } as Item)!;
  assert.deepEqual([alone.boxes.length, alone.asked], [1, 0]);
  assert.equal(occlusionOf({ ...item, image: null } as Item), null, 'no image, no occlusion');
  assert.equal(occlusionOf({ ...item, kind: 'card' } as Item), null);
});
