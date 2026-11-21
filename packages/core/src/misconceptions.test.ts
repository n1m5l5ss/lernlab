import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORRECTION_MAX_LENGTH,
  cleanCorrections,
  correctionHtml,
  correctionsOf,
  formatCorrections,
  parseCorrections,
  pickedCorrections,
} from './misconceptions';
import { cardToItem } from './library';
import { mcq } from './exercises';

const deck = { id: 1, name: 'D', language: null };
const MCQ = { choices: ['EC2', 'Lambda', 'Fargate', 'RDS'], correct: [1, 2] };
const EC2 = 'Many people think EC2 is serverless. In fact you run its servers.';

test('corrections read one per choice, in the order of the choices, separated by |', () => {
  assert.deepEqual(parseCorrections(`${EC2}|||RDS is a database`), [EC2, '', '', 'RDS is a database']);
  assert.deepEqual(parseCorrections(''), ['']);
  assert.deepEqual(parseCorrections(undefined), ['']);
});

test('corrections are plain text with limited markdown, capped in length', () => {
  assert.deepEqual(parseCorrections('<b>Many</b> <script>x</script>think&nbsp;**so**'), ['Many think **so**']);
  assert.equal(parseCorrections('x'.repeat(5000))[0].length, CORRECTION_MAX_LENGTH);
  assert.equal(cleanCorrections('a &lt; b', MCQ), 'a < b');
  assert.equal(cleanCorrections(cleanCorrections('a &amp;lt; b', MCQ), MCQ), cleanCorrections('a &amp;lt; b', MCQ));
  assert.equal(
    correctionHtml('Many **think** <img src=x onerror=alert(1)> *so*'),
    'Many <b>think</b> &lt;img src=x onerror=alert(1)&gt; <i>so</i>',
  );
});

test('cleaning keeps corrections on wrong choices only, and nothing past the last choice', () => {
  assert.equal(
    cleanCorrections(`${EC2}|Lambda is right|Fargate too|RDS is a database|extra`, MCQ),
    `${EC2}|||RDS is a database`,
  );
  assert.equal(cleanCorrections(`${EC2}|||`, MCQ), EC2, 'trailing empty slots are dropped');
  assert.equal(cleanCorrections('|Lambda is right', MCQ), '', 'none left');
  assert.equal(cleanCorrections(EC2, null), '', 'not a multiple-choice card');
});

test('formatting from a list turns a | inside a correction into /', () => {
  assert.equal(formatCorrections(['A or | B', '', '', ''], MCQ), 'A or / B');
  assert.deepEqual(parseCorrections(formatCorrections(['', '', '', 'x|y'], MCQ)), ['', '', '', 'x/y']);
});

test('stored in extra (no migration): kept when not sent, cleared by an empty value, only on mcq cards', () => {
  const card = {
    front: 'Which two are serverless?',
    back: '',
    type: 'mcq',
    choices: 'EC2|Lambda|Fargate|RDS',
    correct: '2|3',
  };
  const item = cardToItem(deck, { ...card, corrections: `<i>${EC2}</i>|no|no|` })!;
  assert.equal(item.extra.corrections, EC2);
  assert.deepEqual(correctionsOf(item), [EC2, '', '', '']);
  const kept = cardToItem(deck, { ...card, extra: { corrections: EC2 } })!;
  assert.equal(kept.extra.corrections, EC2, 'a card saved without the field keeps its corrections');
  const cleared = cardToItem(deck, { ...card, corrections: '', extra: { corrections: EC2 } })!;
  assert.ok(!('corrections' in cleared.extra));
  const basic = cardToItem(deck, { front: 'x', back: 'y', corrections: EC2 })!;
  assert.ok(!('corrections' in basic.extra), 'other card types have no choices to correct');
  assert.deepEqual(correctionsOf(basic), []);
  const byText = cardToItem(deck, { ...card, correct: 'Lambda|Fargate', corrections: `${EC2}|x` })!;
  assert.equal(byText.extra.corrections, EC2, 'correct choices given by text are known too');
});

test('the multiple-choice exercise carries each choice’s correction, shuffled with it', () => {
  const item = cardToItem(deck, {
    front: 'Which two are serverless?',
    back: '',
    type: 'mcq',
    choices: 'EC2|Lambda|Fargate|RDS',
    correct: '2|3',
    corrections: `${EC2}|||RDS is **a database**`,
  })!;
  for (let k = 0; k < 10; k++) {
    const ex = mcq(item);
    assert.ok(ex?.type === 'mcq' && ex.corrections);
    assert.equal(ex.corrections[ex.choices.indexOf('EC2')], EC2);
    assert.equal(ex.corrections[ex.choices.indexOf('RDS')], 'RDS is <b>a database</b>');
    for (const c of ex.correct) assert.equal(ex.corrections[c], '');
  }
  const plain = mcq(cardToItem(deck, { front: 'Q', back: '', type: 'mcq', choices: 'A|B', correct: '1' })!);
  assert.ok(plain?.type === 'mcq' && !('corrections' in plain), 'no corrections, no field');
});

test('an answer shows the corrections of the wrong choices it picked, in the order shown', () => {
  const corrections = ['Not A', '', 'Not C', 'Not D'];
  assert.deepEqual(pickedCorrections(corrections, [0], [1]), ['Not A']);
  assert.deepEqual(pickedCorrections(corrections, [3, 1, 0], [1]), ['Not A', 'Not D'], 'right picks have none');
  assert.deepEqual(pickedCorrections(corrections, [1], [1]), []);
  assert.deepEqual(pickedCorrections(corrections, [2], [1, 2]), [], 'a correct choice never shows a correction');
  assert.deepEqual(pickedCorrections(undefined, [0], [1]), []);
});
