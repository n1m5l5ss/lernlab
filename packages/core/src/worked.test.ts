import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKED_RESULT_MAX_LENGTH,
  WORKED_STEPS_MAX,
  checkStep,
  cleanWorkedSteps,
  formatWorkedSteps,
  isWorked,
  parseWorkedSteps,
  rungOf,
  stepHtml,
  workedOutcome,
  workedStepsAsText,
  workedStepsOf,
} from './worked';
import { askedOwnWay } from './explain';
import { cardToItem } from './library';
import { recall, worked } from './exercises';
import { gradeFor } from './game';
import { RECALL_FORMATS } from './types';

const deck = { id: 1, name: 'D', language: null };
const STEPS = 'Subtract 3 from both sides :: 2x = 8|Divide both sides by 2 :: x = 4';
const EQ = { front: 'Solve 2x + 3 = 11', back: 'x = 4', workedSteps: STEPS };

test('steps read as "what you do :: result", separated by |, as plain text, at most eight', () => {
  assert.deepEqual(parseWorkedSteps(STEPS), [
    { label: 'Subtract 3 from both sides', result: '2x = 8' },
    { label: 'Divide both sides by 2', result: 'x = 4' },
  ]);
  assert.deepEqual(parseWorkedSteps('7| |no result ::|Use it :: std::move(x)'), [
    { label: '', result: '7' },
    { label: 'Use it', result: 'std::move(x)' },
  ]);
  assert.deepEqual(parseWorkedSteps(undefined), []);
  assert.equal(parseWorkedSteps('1|2|3|4|5|6|7|8|9|10').length, WORKED_STEPS_MAX);
  assert.deepEqual(parseWorkedSteps('<b>Add</b><script>x</script> :: <i>5</i>'), [{ label: 'Add', result: '5' }]);
  assert.equal(parseWorkedSteps('a :: ' + 'x'.repeat(5000))[0].result.length, WORKED_RESULT_MAX_LENGTH);
});

test('a worked example needs two steps; cleaning is stable and | or :: cannot split a step', () => {
  assert.equal(cleanWorkedSteps('only :: one'), '');
  assert.equal(cleanWorkedSteps(' a::1 |b'), 'a :: 1|b');
  assert.equal(cleanWorkedSteps(cleanWorkedSteps(STEPS)), STEPS);
  const line = formatWorkedSteps([
    { label: 'a|b :: c', result: '|x|' },
    { label: '', result: 'std::move(x)' },
  ]);
  assert.equal(line, 'a/b : c :: /x/|:: std::move(x)');
  assert.deepEqual(parseWorkedSteps(line)[1], { label: '', result: 'std::move(x)' });
  assert.equal(cleanWorkedSteps(line), line);
  assert.equal(formatWorkedSteps([{ label: 'x', result: '1' }]), '');
});

test('a card with steps is a worked example; other types and a single step keep none', () => {
  const item = cardToItem(deck, { ...EQ, type: 'worked' })!;
  assert.equal(item.kind, 'card');
  assert.ok(isWorked(item) && askedOwnWay(item));
  assert.equal(workedStepsOf(item).length, 2);
  assert.ok(isWorked(cardToItem(deck, EQ)!), 'from the steps alone');
  assert.ok(!isWorked(cardToItem(deck, { ...EQ, type: 'basic' })!));
  assert.ok(!isWorked(cardToItem(deck, { ...EQ, workedSteps: 'one :: 1' })!));
  assert.ok(!isWorked(cardToItem(deck, { ...EQ, type: 'worked', workedSteps: '' })!));
  assert.equal(cardToItem(deck, { ...EQ, back: '' })!.meaning, 'x = 4', 'no back: the last result');
  assert.ok(!cardToItem(deck, { ...EQ, variants: 'apply: Solve it' })!.extra.variants, 'no question variants');
  const kept = cardToItem(deck, { front: 'Solve', back: 'x = 4', extra: { workedSteps: STEPS } })!;
  assert.ok(isWorked(kept), 'kept when the editor does not send the field');
});

test('the rung climbs one with each right answer and drops one with each miss', () => {
  assert.equal(rungOf([], 3), 0);
  assert.equal(rungOf([true], 3), 1);
  assert.equal(rungOf([true, true, true, true, true], 3), 3, 'never past the whole problem');
  assert.equal(rungOf([true, true, true, false], 3), 2);
  assert.equal(rungOf([false, false, true], 3), 1, 'never below studying the example');
  assert.equal(rungOf([true, true, true, true], 2), 2, 'steps removed since: still on the ladder');
});

test('the exercise shows the first steps and asks the last ones; only the whole problem is a real recall', () => {
  const item = cardToItem(deck, { ...EQ, type: 'worked' })!;
  const study = worked({ ...item, rung: 0 });
  assert.equal(study.type, 'worked');
  assert.deepEqual([study.blanks, study.steps.length, study.prompt], [0, 2, 'Solve 2x + 3 = 11']);
  assert.equal(study.steps[1].result, 'x = 4');
  assert.equal(worked({ ...item, rung: 1 }).blanks, 1);
  assert.equal(worked({ ...item, rung: 9 }).blanks, 2);
  const whole = recall(item);
  assert.ok(whole.type === 'worked' && whole.blanks === 2, 'without a rung: the whole problem');
  assert.ok(RECALL_FORMATS.includes('worked') && !RECALL_FORMATS.includes('ladder'));
  const base = { responseMs: 500, answerLength: 3, reps: 5 };
  assert.equal(gradeFor({ format: 'worked', ...workedOutcome([{ correct: true, nearMiss: false }]), ...base }), 3);
  assert.equal(
    gradeFor({
      format: 'worked',
      ...workedOutcome([
        { correct: true, nearMiss: true },
        { correct: true, nearMiss: false },
      ]),
      ...base,
    }),
    2,
  );
  assert.equal(
    gradeFor({
      format: 'worked',
      ...workedOutcome([
        { correct: true, nearMiss: false },
        { correct: false, nearMiss: false },
      ]),
      ...base,
    }),
    1,
  );
});

test('steps are checked like typed answers: numbers by value, formulas by their source, text with small slips', () => {
  assert.ok(checkStep('1500 m', '1.5 km').correct);
  assert.ok(checkStep('9,81', '9.81 m/s^2').correct);
  assert.ok(!checkStep('9.9', '9.81 m/s^2').correct);
  assert.ok(checkStep('x=4', 'x = 4').correct);
  assert.ok(!checkStep('2', '2x = 8').correct, 'an equation is not a number');
  assert.ok(!checkStep('3', '3x + 2').correct);
  assert.ok(checkStep('\\frac{1}{2}', '\\( \\frac12 \\)').correct);
  const slip = checkStep('debit cash', 'Debit Cash');
  assert.ok(slip.correct);
  assert.ok(!checkStep('', 'x = 4').correct);
});

test('step text is shown as safe HTML, and as numbered lines for Anki', () => {
  assert.equal(stepHtml('a < b **now**'), 'a &lt; b <b>now</b>');
  assert.equal(workedStepsAsText(parseWorkedSteps('Add :: 5|7')), '1. Add: 5\n2. 7');
});
