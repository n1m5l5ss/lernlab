import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY,
  addVariant,
  canAddVariant,
  choiceRows,
  editCorrection,
  editVariant,
  fieldsToSave,
  formFor,
  keyPointRows,
  workedRows,
  previewOf,
  removeVariant,
  showImageAlt,
  showVariants,
  sortDrop,
  type Form,
} from './card-editor-logic';
import { VARIANTS_MAX } from '@lernlab/core/variants';

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

test('question variants: added, changed and removed in the form, saved as one line, only on written-question cards', () => {
  let f = form({ front: 'Beta blocker', back: 'slows the heart' });
  assert.deepEqual(f.variants, []);
  f = { ...f, variants: addVariant(f.variants) };
  assert.deepEqual(f.variants, [{ prompt: '', level: 'apply' }], 'a new question starts as apply');
  f = { ...f, variants: editVariant(f.variants, 0, { prompt: 'A patient with angina | asthma?' }) };
  f = { ...f, variants: addVariant(f.variants) };
  f = { ...f, variants: editVariant(f.variants, 1, { prompt: 'What if the dose doubles?', level: 'analyse' }) };
  f = { ...f, variants: addVariant(f.variants) }; // left empty
  assert.equal(
    fieldsToSave(f).variants,
    'apply: A patient with angina / asthma? | analyse: What if the dose doubles?',
    'empty questions are not saved; a | cannot split a question',
  );
  assert.equal(previewOf(f, deck)!.item.extra.variants, fieldsToSave(f).variants);
  assert.deepEqual(
    removeVariant(f.variants, 0).map((v) => v.prompt),
    ['What if the dose doubles?', ''],
  );
  const card = { ...previewOf(f, deck)!.item, suspended: false, starred: false };
  assert.deepEqual(formFor(card).variants, [
    { prompt: 'A patient with angina / asthma?', level: 'apply' },
    { prompt: 'What if the dose doubles?', level: 'analyse' },
  ]);
  assert.equal(fieldsToSave(form({ front: 'x' })).variants, '', 'no questions clears stored ones');

  assert.ok(showVariants(form({ type: 'basic' })) && showVariants(form({ type: 'numeric' })));
  for (const type of ['cloze', 'mcq', 'order', 'code', 'occlusion'] as const) {
    assert.equal(showVariants(form({ type })), false, type);
    assert.equal(fieldsToSave({ ...f, type }).variants, '', `${type} cards ask in their own way`);
  }
  const full = Array.from({ length: VARIANTS_MAX }, () => ({ prompt: 'q', level: 'apply' as const }));
  assert.equal(canAddVariant(full), false);
  assert.equal(addVariant(full).length, VARIANTS_MAX);
});

test('corrections: one per wrong choice, written in the form and saved as one line in the order of the choices', () => {
  let f = form({
    type: 'mcq',
    front: 'Which two are serverless?',
    choices: 'EC2|Lambda|<b>Fargate</b>|RDS',
    correct: '2|3',
  });
  assert.deepEqual(choiceRows(f), [
    { choice: 'EC2', correct: false },
    { choice: 'Lambda', correct: true },
    { choice: 'Fargate', correct: true },
    { choice: 'RDS', correct: false },
  ]);
  assert.deepEqual(f.corrections, []);
  f = { ...f, corrections: editCorrection(f.corrections, 3, 'RDS is a database | not compute') };
  assert.deepEqual(f.corrections, ['', '', '', 'RDS is a database | not compute']);
  f = { ...f, corrections: editCorrection(f.corrections, 0, 'Many people think EC2 is serverless.') };
  assert.equal(fieldsToSave(f).corrections, 'Many people think EC2 is serverless.|||RDS is a database / not compute');
  assert.equal(previewOf(f, deck)!.item.extra.corrections, fieldsToSave(f).corrections);
  const card = { ...previewOf(f, deck)!.item, suspended: false, starred: false };
  assert.deepEqual(formFor(card).corrections, [
    'Many people think EC2 is serverless.',
    '',
    '',
    'RDS is a database / not compute',
  ]);
  assert.equal(
    fieldsToSave({ ...f, correct: '1|2|3' }).corrections,
    '|||RDS is a database / not compute',
    'a choice marked correct loses its correction',
  );
  assert.equal(fieldsToSave({ ...f, type: 'basic' }).corrections, '', 'other card types have no choices');
  assert.deepEqual(choiceRows(form({ type: 'mcq', choices: 'A|B' })), [
    { choice: 'A', correct: false },
    { choice: 'B', correct: false },
  ]);
});

test('a myth card: saved as type myth, read back as one, previewed as true-or-myth, without other questions', () => {
  const f = form({
    type: 'myth',
    front: 'We only use 10% of our brains.',
    back: 'Scans show activity everywhere.',
    variants: [{ prompt: 'Why?', level: 'apply' }],
  });
  assert.equal(showVariants(f), false);
  assert.equal(fieldsToSave(f).type, 'myth');
  assert.equal(fieldsToSave(f).variants, '');
  const p = previewOf(f, deck)!;
  assert.equal(p.item.extra.myth, '1');
  assert.deepEqual(p.view, {
    type: 'myth',
    prompt: 'We only use 10% of our brains.',
    answer: 'Scans show activity everywhere.',
  });
  assert.equal(formFor({ ...p.item, suspended: false, starred: false }).type, 'myth');
  assert.equal(formFor({ ...p.item, extra: {}, suspended: false, starred: false }).type, 'basic');
});

test('an explain card: key points written in rows, saved as one line, previewed with its points, without other questions', () => {
  assert.deepEqual(keyPointRows([]), ['', ''], 'two rows to start');
  assert.deepEqual(keyPointRows(['a', 'b', 'c']), ['a', 'b', 'c']);
  const f = form({
    type: 'explain',
    front: 'Why do we have seasons?',
    back: '',
    keyPoints: ['Earth is **tilted**', '', 'Not the distance|to the sun'],
    variants: [{ prompt: 'Why?', level: 'apply' }],
  });
  assert.equal(showVariants(f), false);
  assert.equal(fieldsToSave(f).type, 'explain');
  assert.equal(fieldsToSave(f).keyPoints, 'Earth is **tilted**|Not the distance/to the sun');
  assert.equal(fieldsToSave(f).variants, '');
  assert.equal(fieldsToSave({ ...f, type: 'basic' }).keyPoints, '', 'other types save none');
  const p = previewOf(f, deck)!;
  assert.deepEqual(p.view, {
    type: 'explain',
    prompt: 'Why do we have seasons?',
    answer: '',
    points: ['Earth is <b>tilted</b>', 'Not the distance/to the sun'],
  });
  const card = { ...p.item, suspended: false, starred: false };
  assert.equal(formFor(card).type, 'explain');
  assert.deepEqual(formFor(card).keyPoints, ['Earth is **tilted**', 'Not the distance/to the sun']);
  assert.deepEqual(previewOf({ ...f, keyPoints: ['one'] }, deck)!.view, { type: 'problem', problem: 'keyPoints' });
});

test('key terms: ==term== shows highlighted in the preview answer and comes back as written when the card is edited', () => {
  const p = previewOf(
    form({
      front: 'What does the mitochondrion do in a cell, and why does it matter?',
      back: 'It makes ==ATP== for the cell, which powers nearly everything',
    }),
    deck,
  )!;
  assert.equal(p.view.type, 'flip');
  assert.equal(
    p.view.type === 'flip' && p.view.answer,
    'It makes <mark>ATP</mark> for the cell, which powers nearly everything',
  );
  const saved = { ...p.item, tags: [], suspended: false, starred: false } as unknown as Parameters<typeof formFor>[0];
  assert.equal(formFor(saved).back, 'It makes ==ATP== for the cell, which powers nearly everything');
});

test('the preview carries card-quality hints, and none while the card has a problem to fix first', () => {
  const long = Array.from({ length: 45 }, (_, i) => `w${i}`).join(' ');
  assert.deepEqual(previewOf(form({ front: 'Capital of France?', back: 'Paris' }), deck)!.hints, []);
  assert.deepEqual(previewOf(form({ front: 'Q?', back: long }), deck)!.hints, ['split', 'diagram']);
  assert.deepEqual(previewOf(form({ front: 'Q?', back: 'A', image: 'a.png' }), deck)!.hints, ['decorativeImage']);
  assert.deepEqual(previewOf(form({ front: 'Q?', back: 'A', image: 'a.png', imageAlt: 'A leaf' }), deck)!.hints, []);
  assert.deepEqual(
    previewOf(form({ front: 'der Hund', back: 'dog', audio: 'a.mp3' }), { id: 2, language: 'de' })!.hints,
    [],
  );
  assert.deepEqual(previewOf(form({ type: 'cloze', front: 'No gap', back: long }), deck)!.hints, []);
});

test('a worked example: steps written in rows, saved as one line, previewed as the full example, without other questions', () => {
  assert.deepEqual(workedRows([]), [
    { label: '', result: '' },
    { label: '', result: '' },
  ]);
  const f = form({
    type: 'worked',
    front: 'Solve 2x + 3 = 11',
    back: '',
    workedSteps: [
      { label: 'Subtract 3 | both sides', result: '2x = 8' },
      { label: 'no result yet', result: '' },
      { label: '', result: 'x = **4**' },
    ],
    variants: [{ prompt: 'Solve it', level: 'apply' }],
  });
  assert.equal(showVariants(f), false);
  assert.equal(fieldsToSave(f).type, 'worked');
  assert.equal(fieldsToSave(f).workedSteps, 'Subtract 3 / both sides :: 2x = 8|x = **4**');
  assert.equal(fieldsToSave(f).variants, '');
  assert.equal(fieldsToSave({ ...f, type: 'basic' }).workedSteps, '', 'other types save none');
  const p = previewOf(f, deck)!;
  assert.deepEqual(p.view, {
    type: 'worked',
    prompt: 'Solve 2x + 3 = 11',
    answer: 'x = **4**',
    steps: [
      { label: 'Subtract 3 / both sides', result: '2x = 8' },
      { label: '', result: 'x = <b>4</b>' },
    ],
  });
  const card = { ...p.item, suspended: false, starred: false };
  assert.equal(formFor(card).type, 'worked');
  assert.deepEqual(formFor(card).workedSteps[0], { label: 'Subtract 3 / both sides', result: '2x = 8' });
  assert.deepEqual(previewOf({ ...f, workedSteps: [{ label: '', result: '1' }] }, deck)!.view, {
    type: 'problem',
    problem: 'workedSteps',
  });
});

test('the mnemonic is a field of every card type, saved as written and never part of the preview', () => {
  const f = form({
    front: 'Order of the planets?',
    back: 'Mercury, Venus, Earth',
    mnemonic: 'My Very Educated Mother',
  });
  assert.equal(fieldsToSave(f).mnemonic, 'My Very Educated Mother');
  assert.equal(fieldsToSave({ ...f, type: 'cloze' }).mnemonic, 'My Very Educated Mother');
  const p = previewOf(f, deck)!;
  assert.equal(p.item.extra.mnemonic, 'My Very Educated Mother');
  assert.ok(!JSON.stringify(p.view).includes('Educated'), 'it only shows in a session, after a miss or a hint');
  const saved = { ...p.item, tags: [], suspended: false, starred: false } as unknown as Parameters<typeof formFor>[0];
  assert.equal(formFor(saved).mnemonic, 'My Very Educated Mother');
});
