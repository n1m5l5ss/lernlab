// Teacher lines and badges are keys into locales/en.json; every key core can produce must exist there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../../../locales/en.json';
import { SLOT_VARIANTS, teacherFor } from '../src/teacher';
import { ACHIEVEMENTS } from '../src/progress';
import { checkAnswer } from '../src/text';

const lookup = (key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
const exists = (key: string) => typeof lookup(key) === 'string' || typeof lookup(`${key}_other`) === 'string';

test('every teacher slot has exactly as many English variants as core picks from', () => {
  for (const [slot, n] of Object.entries(SLOT_VARIANTS)) {
    const variants = lookup(`teacher.${slot}`);
    assert.ok(Array.isArray(variants), `teacher.${slot} missing in en.json`);
    assert.equal(variants.length, n, `teacher.${slot} should have ${n} variants`);
  }
});

test('every line a teacher can say resolves to an en.json key, with German targets for German decks', () => {
  for (const lang of ['de', 'en', null]) {
    for (let i = 0; i < 5; i++) {
      const t = teacherFor(lang, (n) => Math.min(i, n - 1));
      const lines = [
        t.start(),
        t.right(0),
        t.right(4),
        t.right(8),
        t.rightArticle(),
        t.near(),
        t.retry(),
        t.reveal(),
        t.kick(),
        t.idle(),
        t.bossWin(),
        t.bossLose(),
        t.done(),
        t.missedDay(),
        t.timeUp(),
        t.goalMet(),
        t.homework(i),
      ];
      for (const l of lines) {
        assert.ok(exists(l.key), `${l.key} missing in en.json`);
        assert.equal(!!l.target, lang === 'de', `${l.key} target for ${lang}`);
      }
    }
  }
});

test('planner block lines resolve, with counts as parameters', () => {
  const names = ['warm', 'review', 'recall', 'boss', 'sortGender', 'sort', 'match', 'trueFalse', 'lesson'];
  names.push('blitz', 'listen', 'picture', 'cloze', 'speak', 'rain', 'rescue');
  for (const name of names) assert.ok(exists(teacherFor('en').block(name).key), name);
  assert.deepEqual(teacherFor('en').block('newCards', 3), { key: 'teacher.block.newCards', params: { count: 3 } });
  assert.equal(teacherFor('de').block('newCards', 1).target, '1 neues Wort. Hör genau hin.');
  assert.equal(teacherFor('de').block('picture').target, undefined); // no German line: UI shows the translation
});

test('every badge has a title and description in en.json', () => {
  for (const id of ACHIEVEMENTS) {
    assert.equal(typeof lookup(`badges.${id}.title`), 'string', id);
    assert.equal(typeof lookup(`badges.${id}.desc`), 'string', id);
  }
});

test('answer-check notes are en.json keys with their values', () => {
  const notes = [
    checkAnswer('die Mann', ['der Mann'], { requireArticle: true }).note,
    checkAnswer('Mann', ['der Mann'], { requireArticle: true }).note,
    checkAnswer('haus', ['Haus']).note,
    checkAnswer('Maedchen', ['Mädchen']).note,
    checkAnswer('Fenstr', ['Fenster']).note,
  ];
  assert.deepEqual(
    notes.map((n) => n?.key),
    ['check.articleWrong', 'check.articleMissing', 'check.capitals', 'check.spelling', 'check.almost'],
  );
  for (const n of notes) assert.ok(n && exists(n.key), n?.key);
  assert.deepEqual(notes[0]?.params, { right: 'der', given: 'die' });
});
