import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragBox, newGroupId, nudge, occlusionCards, shapesFor, shapesReady, spanBox } from './occlusion-logic';
import type { Item } from '@lernlab/core/types';

const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

test('arrow keys move the box one step; with Shift they resize it; it stays inside the image', () => {
  assert.deepEqual(nudge(box, 'ArrowRight', false), { x: 0.11, y: 0.1, w: 0.2, h: 0.2 });
  assert.deepEqual(nudge(box, 'ArrowUp', false), { x: 0.1, y: 0.09, w: 0.2, h: 0.2 });
  assert.deepEqual(nudge(box, 'ArrowDown', true), { x: 0.1, y: 0.1, w: 0.2, h: 0.21 });
  assert.deepEqual(nudge({ ...box, x: 0 }, 'ArrowLeft', false), { ...box, x: 0 }, 'stops at the edge');
  assert.equal(nudge(box, 'Enter', false), null);
});

test('drawing works in any direction, and dragging moves or resizes', () => {
  assert.deepEqual(spanBox({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.4 }), { x: 0.2, y: 0.4, w: 0.3, h: 0.2 });
  assert.deepEqual(dragBox(box, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.45 }, 'move'), { x: 0.2, y: 0.05, w: 0.2, h: 0.2 });
  assert.deepEqual(dragBox(box, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.45 }, 'resize'), {
    x: 0.1,
    y: 0.1,
    w: 0.3,
    h: 0.15,
  });
});

test('a new picture saves one card per box in one group; a saved card saves only itself', () => {
  const shapes = [
    { box, label: ' Aorta ' },
    { box: { ...box, x: 0.5 }, label: 'Left ventricle' },
  ];
  const fields = { front: 'Label the heart', type: 'occlusion', occlusionMode: 'all' };
  const cards = occlusionCards(fields, shapes, undefined, 'g1');
  assert.deepEqual(
    cards.map((c) => [c.back, c.occlusion, c.occlusionGroup, c.occlusionMode]),
    [
      ['Aorta', '0.1,0.1,0.2,0.2', 'g1', 'all'],
      ['Left ventricle', '0.5,0.1,0.2,0.2', 'g1', 'all'],
    ],
  );
  const saved = occlusionCards(
    fields,
    [
      { id: 7, ...shapes[0] },
      { id: 8, ...shapes[1] },
    ],
    8,
    'unused',
  );
  assert.equal(saved.length, 1);
  assert.equal(saved[0].back, 'Left ventricle');
  assert.equal(saved[0].occlusionGroup, undefined, 'its group stays as saved');
  assert.ok(shapesReady('heart.png', shapes));
  assert.ok(!shapesReady('', shapes), 'needs an image');
  assert.ok(!shapesReady('heart.png', []), 'needs a box');
  assert.ok(!shapesReady('heart.png', [{ box, label: ' ' }]), 'every box needs a label');
  assert.notEqual(newGroupId(), newGroupId());
});

test('editing a saved card starts from its group, with its own box and label from the card', () => {
  const item = {
    id: 2,
    kind: 'occlusion',
    meaning: 'Aorta',
    extra: { occlusion: '0.5,0.1,0.2,0.1' },
    occlusionBoxes: [
      { id: 1, box, label: 'Vena cava' },
      { id: 2, box, label: 'stale' },
    ],
  } as unknown as Item;
  assert.deepEqual(shapesFor(item), [
    { id: 1, box, label: 'Vena cava' },
    { id: 2, box: { x: 0.5, y: 0.1, w: 0.2, h: 0.1 }, label: 'Aorta' },
  ]);
  assert.deepEqual(shapesFor(undefined), []);
});
