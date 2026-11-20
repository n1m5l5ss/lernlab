import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, fieldsToSave, previewOf, sortDrop, type Form } from './card-editor-logic';

const deck = { id: 1, language: null };
const form = (f: Partial<Form>): Form => ({ ...EMPTY, ...f });

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
