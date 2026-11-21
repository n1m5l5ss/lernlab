// The FSRS library (ts-fsrs) must not move anyone's reviews when it is updated (#166). The expected values were
// made with ts-fsrs 5.4.2, which LernLab 1.0 shipped. Answers are at fixed times and include a lapse, cards that
// 1.0 stored in learning, relearning and review, and an Anki history replay (#48). A row is
// [due, interval in days, state, reps, lapses, stability, difficulty] after each answer.
//
// ts-fsrs 6.0 gives exactly the same rows without fuzz (replay, Anki history, intervals under 2.5 days) and the
// same stability and difficulty everywhere. Only the fuzzed rows (newLive, newLive80, newLive95, storedLearning,
// storedReview) differ: 6.0 draws the fuzz with a new random generator (FNV-1a + Mulberry32 instead of Alea), so
// an interval lands on another day inside the same fuzz range. Those rows hold the 6.0 values; the fuzz test below
// checks the range.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { all, run, NEW_CARD, STORED, type Step } from './scheduler-scenarios';
import { liveScheduler, reviveCard, createEmptyCard, recallProbability } from '../src/scheduler';

type Row = [due: string, days: number, state: number, reps: number, lapses: number, s: number, d: number];
const rows = (steps: Step[]): Row[] => steps.map((x) => [x.due, x.days, x.state, x.reps, x.lapses, x.s, x.d]);

const EXPECTED: Record<string, Row[]> = {
  newLive: [
    ['2026-01-08T09:00:00.000Z', 3, 2, 1, 0, 2.3065, 2.1181],
    ['2026-01-20T09:30:00.000Z', 12, 2, 2, 0, 13.8269, 2.1112],
    ['2026-02-26T18:00:00.000Z', 37, 2, 3, 0, 37.0214, 4.7483],
    ['2026-05-11T07:15:00.000Z', 85, 2, 4, 0, 89.561, 4.7388],
    ['2026-04-23T12:00:00.000Z', 3, 2, 5, 1, 3.4834, 8.2559],
    ['2026-04-27T12:00:00.000Z', 6, 2, 6, 1, 5.0139, 8.2429],
    ['2026-05-09T12:00:00.000Z', 14, 2, 7, 1, 14.0497, 7.6409],
    ['2026-05-14T12:00:00.000Z', 17, 2, 8, 1, 17.2114, 7.6285],
    ['2027-06-12T12:00:00.000Z', 103, 2, 9, 1, 95.7874, 7.6161],
  ],
  newReplay: [
    ['2026-01-08T09:00:00.000Z', 3, 2, 1, 0, 2.3065, 2.1181],
    ['2026-01-22T09:30:00.000Z', 14, 2, 2, 0, 13.8269, 2.1112],
    ['2026-02-26T18:00:00.000Z', 37, 2, 3, 0, 37.0214, 4.7483],
    ['2026-05-16T07:15:00.000Z', 90, 2, 4, 0, 89.561, 4.7388],
    ['2026-04-23T12:00:00.000Z', 3, 2, 5, 1, 3.4834, 8.2559],
    ['2026-04-26T12:00:00.000Z', 5, 2, 6, 1, 5.0139, 8.2429],
    ['2026-05-09T12:00:00.000Z', 14, 2, 7, 1, 14.0497, 7.6409],
    ['2026-05-14T12:00:00.000Z', 17, 2, 8, 1, 17.2114, 7.6285],
    ['2027-06-05T12:00:00.000Z', 96, 2, 9, 1, 95.7874, 7.6161],
  ],
  newLive80: [
    ['2026-01-15T09:00:00.000Z', 10, 2, 1, 0, 2.3065, 2.1181],
    ['2026-02-20T09:30:00.000Z', 43, 2, 2, 0, 13.8269, 2.1112],
    ['2026-05-23T18:00:00.000Z', 123, 2, 3, 0, 37.0214, 4.7483],
    ['2026-11-26T07:15:00.000Z', 284, 2, 4, 0, 89.561, 4.7388],
    ['2026-05-01T12:00:00.000Z', 11, 2, 5, 1, 3.4834, 8.2559],
    ['2026-05-10T12:00:00.000Z', 19, 2, 6, 1, 5.0139, 8.2429],
    ['2026-06-11T12:00:00.000Z', 47, 2, 7, 1, 14.0497, 7.6409],
    ['2026-06-23T12:00:00.000Z', 57, 2, 8, 1, 17.2114, 7.6285],
    ['2028-01-30T12:00:00.000Z', 335, 2, 9, 1, 95.7874, 7.6161],
  ],
  newLive95: [
    ['2026-01-08T09:00:00.000Z', 3, 2, 1, 0, 2.3065, 2.1181],
    ['2026-01-13T09:30:00.000Z', 5, 2, 2, 0, 13.8269, 2.1112],
    ['2026-02-04T18:00:00.000Z', 15, 2, 3, 0, 37.0214, 4.7483],
    ['2026-03-20T07:15:00.000Z', 33, 2, 4, 0, 89.561, 4.7388],
    ['2026-04-21T12:00:00.000Z', 1, 2, 5, 1, 3.4834, 8.2559],
    ['2026-04-24T12:00:00.000Z', 3, 2, 6, 1, 5.0139, 8.2429],
    ['2026-05-02T12:00:00.000Z', 7, 2, 7, 1, 14.0497, 7.6409],
    ['2026-05-04T12:00:00.000Z', 7, 2, 8, 1, 17.2114, 7.6285],
    ['2027-04-13T12:00:00.000Z', 43, 2, 9, 1, 95.7874, 7.6161],
  ],
  againLive: [
    ['2026-03-03T10:00:00.000Z', 1, 2, 1, 0, 0.212, 6.4133],
    ['2026-03-04T10:00:00.000Z', 1, 2, 2, 1, 0.1009, 8.8063],
    ['2026-03-08T10:00:00.000Z', 4, 2, 3, 1, 1.1915, 8.3927],
  ],
  storedLearning: [
    ['2026-06-10T08:00:00.000Z', 8, 2, 2, 0, 7.3153, 2.1112],
    ['2026-06-27T08:00:00.000Z', 22, 2, 3, 0, 19.8335, 2.1043],
  ],
  storedRelearning: [
    ['2026-06-05T09:00:00.000Z', 2, 2, 7, 2, 2.3557, 8.3256],
    ['2026-06-14T09:00:00.000Z', 8, 2, 8, 2, 5.8364, 8.3125],
  ],
  storedReview: [
    ['2026-09-01T12:00:00.000Z', 73, 2, 6, 1, 69.5367, 5.0901],
    ['2026-08-01T12:00:00.000Z', 2, 2, 7, 2, 3.0889, 8.3714],
    ['2026-08-04T12:00:00.000Z', 4, 2, 8, 2, 4.5625, 8.3582],
  ],
  storedReviewReplay: [
    ['2026-08-29T12:00:00.000Z', 70, 2, 6, 1, 69.5367, 5.0901],
    ['2026-08-02T12:00:00.000Z', 3, 2, 7, 2, 3.0889, 8.3714],
    ['2026-08-05T12:00:00.000Z', 5, 2, 8, 2, 4.5625, 8.3582],
  ],
  anki: [
    ['2025-09-02T10:00:00.000Z', 1, 2, 1, 0, 0.212, 6.4133],
    ['2025-09-05T11:00:00.000Z', 3, 2, 2, 0, 1.8868, 6.4021],
    ['2025-09-18T11:00:00.000Z', 13, 2, 3, 0, 12.6587, 5.1851],
    ['2025-09-17T11:00:00.000Z', 2, 2, 4, 1, 1.5237, 8.4026],
    ['2025-09-18T11:00:00.000Z', 2, 2, 5, 1, 2.396, 8.9248],
    ['2025-09-26T11:00:00.000Z', 6, 2, 6, 1, 5.6628, 8.9111],
    ['2025-10-14T11:00:00.000Z', 13, 2, 7, 1, 13.0533, 8.8974],
  ],
};

const got = all();

test('a new card answered Good, Hard, Again (a lapse), Easy, early and late keeps its schedule', () => {
  assert.deepEqual(rows(got.newReplay), EXPECTED.newReplay, 'without fuzz');
  assert.deepEqual(rows(got.newLive), EXPECTED.newLive, 'studying (fuzzed)');
  assert.deepEqual(rows(got.newLive80), EXPECTED.newLive80, 'desired retention 80%');
  assert.deepEqual(rows(got.newLive95), EXPECTED.newLive95, 'desired retention 95%');
  assert.deepEqual(rows(got.againLive), EXPECTED.againLive, 'a new card answered Again twice');
});

test('cards stored by LernLab 1.0 in learning, relearning and review keep scheduling the same', () => {
  assert.deepEqual(rows(got.storedLearning), EXPECTED.storedLearning, 'learning');
  assert.deepEqual(rows(got.storedRelearning), EXPECTED.storedRelearning, 'relearning');
  assert.deepEqual(rows(got.storedReviewReplay), EXPECTED.storedReviewReplay, 'review, without fuzz');
  assert.deepEqual(rows(got.storedReview), EXPECTED.storedReview, 'review, with a lapse');
});

test('an Anki review history replays to the same schedule', () => {
  assert.deepEqual(rows(got.anki.steps), EXPECTED.anki);
  assert.deepEqual(got.anki.final, got.anki.steps.at(-1));
});

/** How far FSRS fuzz may move an interval of `days` (the standard FSRS and Anki fuzz ranges). */
const fuzzDelta = (days: number) =>
  Math.round(
    1 +
      0.15 * Math.max(Math.min(days, 7) - 2.5, 0) +
      0.1 * Math.max(Math.min(days, 20) - 7, 0) +
      0.05 * Math.max(days - 20, 0),
  );

test('fuzz moves a date only within its range and never changes what the card remembers', () => {
  const pairs = [
    [got.newLive, got.newReplay],
    [got.storedReview, got.storedReviewReplay],
  ];
  for (const [live, plain] of pairs)
    live.forEach((x, i) => {
      assert.equal(x.s, plain[i].s);
      assert.equal(x.d, plain[i].d);
      assert.ok(Math.abs(x.days - plain[i].days) <= fuzzDelta(plain[i].days), `${x.days} vs ${plain[i].days}`);
    });
  assert.deepEqual(run(NEW_CARD, true), got.newLive, 'the same answers give the same dates');
});

test('the chance of recalling a stored card (shown to an AI assistant) is the same as in 1.0', () => {
  // Values from ts-fsrs 5.4.2's get_retrievability(card, now, false).
  const at = [
    '2026-06-01T09:00:00.000Z',
    '2026-06-03T12:00:00.000Z',
    '2026-06-20T12:00:00.000Z',
    '2026-09-01T12:00:00.000Z',
  ];
  const expected: Record<string, number[]> = {
    learning: [1, 0.90949326, 0.71169669, 0.56596496],
    relearning: [1, 0.91202998, 0.65398849, 0.51352316],
    review: [0.97736619, 0.96263809, 0.9014103, 0.78311734],
  };
  for (const [name, values] of Object.entries(expected))
    assert.deepEqual(
      at.map((iso) => recallProbability(STORED[name], new Date(iso))),
      values,
      name,
    );
  assert.equal(recallProbability({ ...STORED.review, state: 0 }, new Date(at[2])), 0, 'a new card');
  assert.throws(() => recallProbability({ ...STORED.review, last_review: undefined }, new Date(at[2])));
});

test('a card the scheduler returns comes back unchanged from the database', () => {
  const f = liveScheduler(0.9);
  let card = reviveCard(STORED.review);
  for (const [iso, grade] of [
    ['2026-06-20T12:00:00.000Z', 3],
    ['2026-07-30T12:00:00.000Z', 1],
  ] as const) {
    const next = f.next(card, new Date(iso), grade).card;
    const back = reviveCard(JSON.parse(JSON.stringify(next)));
    assert.deepEqual(back, next);
    card = back;
  }
  const fresh = createEmptyCard(new Date('2026-01-01T00:00:00Z'));
  assert.deepEqual([fresh.state, fresh.reps, fresh.stability], [0, 0, 0], 'a new card starts New');
});
