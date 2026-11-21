import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, fieldsToSave, formFor, previewOf, showImageAlt, sortDrop, type Form } from './card-editor-logic';

const deck = { id: 1, language: null };
const form = (f: Partial<Form>): Form => ({ ...EMPTY, ...f });

test('an occlusion preview asks the selected box over its group, and says what is missing', () => {
  const shapes = [
    { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, label: 'Aorta' },
    { box: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 }, label: 'Left ventricle' },
  ];
  const f = form({ type: 'occlusion', front: 'Label the heart', image: 'heart.png', occlusionMode: 'all' });
  const p = previewOf(f, deck, shapes, 1)!;
  assert.deepEqual(p.view, { type: 'occlusion', prompt: 'Label the heart', answer: 'Left ventricle' });
  assert.deepEqual(
    p.item.occlusionBoxes?.map((b) => b.label),
    ['Aorta', 'Left ventricle'],
  );
  assert.equal(p.item.extra.occlusionMode, 'all');
  assert.equal(previewOf({ ...f, image: '' }, deck, shapes, 0)!.view.type, 'problem', 'needs an image');
  assert.equal(previewOf(f, deck, [], 0)!.view.type, 'problem', 'needs a box');
  assert.deepEqual(
    Object.entries(fieldsToSave({ ...f, type: 'basic', occlusion: '0,0,1,1' })).filter(([k]) => k.startsWith('occl')),
    [
      ['occlusion', ''],
      ['occlusionGroup', ''],
      ['occlusionMode', ''],
    ],
    'a basic card drops the box',
  );
});

test('no preview until the front has text', () => {
  assert.equal(previewOf(form({ front: '  ' }), deck), null);
});

test('a basic card with a short back is asked as typing, with formatting cleaned like the saved card', () => {
  const p = previewOf(
    form({ front: '**Capital** of France', back: 'Paris', alt: 'paris city', explanation: '<a>why</a> *so*' }),
    deck,
  )!;
  assert.deepEqual(p.view, {
    type: 'typed',
    prompt: 'Capital of France',
    answer: 'Paris',
    also: ['paris city'],
    mediaFirst: true,
  });
  assert.equal(p.explanation, 'why <i>so</i>');
});

test('a short front and a long back is asked the other way round; two long sides flip', () => {
  const back = 'the organelle that makes most of the cell energy as ATP';
  const reverse = previewOf(form({ front: 'Mitochondrion', back }), deck)!;
  assert.equal(reverse.view.type, 'typed');
  assert.equal(reverse.view.type === 'typed' && reverse.view.prompt, back);
  assert.equal(reverse.view.type === 'typed' && reverse.view.mediaFirst, false);
  const flip = previewOf(form({ front: 'Explain why the sky looks blue on a clear day at noon', back }), deck)!;
  assert.equal(flip.view.type, 'flip');
});

test('cloze, multiple choice and ordering previews, and what is missing when they are incomplete', () => {
  const c = previewOf(
    form({ type: 'cloze', front: 'The {{c1::nucleus::organelle}} holds DNA', back: 'Biology' }),
    deck,
  )!;
  assert.deepEqual(c.view, {
    type: 'cloze',
    before: 'The',
    after: 'holds DNA',
    answer: 'nucleus',
    hint: 'organelle',
    extra: 'Biology',
  });
  assert.deepEqual(previewOf(form({ type: 'cloze', front: 'No gap here' }), deck)!.view, {
    type: 'problem',
    problem: 'noGap',
  });
  const m = previewOf(
    form({ type: 'mcq', front: 'Serverless?', choices: 'EC2|Lambda|Fargate', correct: '2|3' }),
    deck,
  )!;
  assert.deepEqual(m.view, {
    type: 'mcq',
    stem: 'Serverless?',
    choices: ['EC2', 'Lambda', 'Fargate'],
    correct: [1, 2],
  });
  assert.equal(previewOf(form({ type: 'mcq', front: 'Q', choices: 'only one' }), deck)!.view.type, 'problem');
  const o = previewOf(form({ type: 'order', front: 'Handshake', steps: 'SYN|SYN-ACK|ACK' }), deck)!;
  assert.deepEqual(o.view, { type: 'order', prompt: 'Handshake', steps: ['SYN', 'SYN-ACK', 'ACK'] });
  assert.equal(previewOf(form({ type: 'order', front: 'Handshake', steps: 'SYN' }), deck)!.view.type, 'problem');
});

test('only the fields of the chosen type are saved', () => {
  const f = form({ id: 4, type: 'basic', front: 'Q', back: 'A', choices: 'x|y', correct: '1', steps: 'a|b' });
  const saved = fieldsToSave(f);
  assert.equal(saved.choices, '');
  assert.equal(saved.steps, '');
  assert.equal('id' in saved, false);
  assert.equal(previewOf(f, deck)!.view.type, 'typed', 'leftover choices do not make a quiz');
  assert.equal(fieldsToSave({ ...f, type: 'mcq' }).choices, 'x|y');
});

test('a numeric card previews as typing; a back that is not a number or a bad tolerance is named', () => {
  const n = previewOf(form({ type: 'numeric', front: 'g on Earth?', back: '9.81 m/s^2', tolerance: '1%' }), deck)!;
  assert.equal(n.item.kind, 'numeric');
  assert.equal(n.item.extra.tolerance, '1%');
  assert.deepEqual(n.view.type === 'typed' && [n.view.prompt, n.view.answer], ['g on Earth?', '9.81 m/s^2']);
  const bad = (f: Partial<Form>) => previewOf(form({ type: 'numeric', front: 'Q', ...f }), deck)!.view;
  assert.deepEqual(bad({ back: 'about ten' }), { type: 'problem', problem: 'number' });
  assert.deepEqual(bad({ back: '10', tolerance: 'some' }), { type: 'problem', problem: 'tolerance' });
  assert.equal(fieldsToSave(form({ type: 'basic', tolerance: '1%' })).tolerance, '', 'only numeric cards keep it');
  assert.equal(fieldsToSave(form({ type: 'numeric', tolerance: '1%' })).tolerance, '1%');
});

test('a stored numeric card opens as a numeric card with its tolerance', () => {
  const f = formFor({
    ...previewOf(form({ type: 'numeric', front: 'Q', back: '42', tolerance: '0.5' }), deck)!.item,
    suspended: false,
    starred: false,
  });
  assert.equal(f.type, 'numeric');
  assert.equal(f.tolerance, '0.5');
});

test('a code card previews the way it is asked; one with nothing to ask is named; it reopens as code', () => {
  const code = (f: Partial<Form>) =>
    previewOf(form({ type: 'code', front: 'What does it print?', codeLang: 'Python', ...f }), deck)!;
  const out = code({ code: '  print(1)\n', back: '1' });
  assert.equal(out.item.kind, 'code');
  assert.deepEqual(out.view, {
    type: 'code',
    prompt: 'What does it print?',
    task: { mode: 'output', lang: 'python', code: '  print(1)', answer: '1' },
  });
  assert.deepEqual(code({ code: 'a\nb' }).view, {
    type: 'code',
    prompt: 'What does it print?',
    task: { mode: 'order', lang: 'python', lines: ['a', 'b'] },
  });
  assert.deepEqual(code({ code: 'print(1)' }).view, { type: 'problem', problem: 'code' });
  assert.deepEqual(code({ code: '' }).view, { type: 'problem', problem: 'code' });
  assert.equal(fieldsToSave(form({ type: 'basic', code: 'x' })).code, '', 'only code cards keep their code');
  const f = formFor({ ...out.item, suspended: false, starred: false });
  assert.deepEqual([f.type, f.code, f.codeLang, f.back], ['code', '  print(1)', 'python', '1']);
});

test('dropped files go to the image, audio or video slot; GIFs are images; others are named', () => {
  const r = sortDrop([
    { name: 'cell.png' },
    { name: 'say.mp3' },
    { name: 'anim.gif' },
    { name: 'notes.pdf' },
    { name: 'c.webm' },
  ]);
  assert.deepEqual(r.slots, { image: 2, audio: 1, video: 4 });
  assert.deepEqual(r.rejected, ['notes.pdf']);
});

test('the image description is asked for only when the card has an image, and is saved with it', () => {
  assert.equal(showImageAlt(form({ front: 'x' })), false);
  assert.equal(showImageAlt(form({ front: 'x', image: 'heart.png' })), true);
  const f = form({ front: 'What is this?', back: 'heart', image: 'heart.png', imageAlt: 'A red heart' });
  assert.equal(fieldsToSave(f).imageAlt, 'A red heart');
  assert.equal(previewOf(f, deck)!.item.extra.imageAlt, 'A red heart', 'the preview picture has the alt text');
  const removed = previewOf({ ...f, image: '' }, deck)!;
  assert.ok(!('imageAlt' in removed.item.extra), 'removing the image drops its description');
  const card = { ...previewOf(f, deck)!.item, suspended: false, starred: false };
  assert.equal(formFor(card).imageAlt, 'A red heart', 'an existing description fills the field');
  assert.equal(formFor({ ...card, extra: {} }).imageAlt, '');
});
