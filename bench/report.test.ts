import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetRows, compare, kindOf, markdownBudgets, markdownCompare, median, percentile, MARKER } from './report';

test('median and nearest-rank percentile', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.ok(Number.isNaN(median([])));
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(xs, 95), 95);
  assert.equal(percentile(xs, 50), 50);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([5, 1, 3], 100), 5, 'unsorted input is fine');
});

test('database and startup metrics have their own limits', () => {
  assert.equal(kindOf('due-queue 100k'), 'db');
  assert.equal(kindOf('startup home'), 'startup');
  assert.equal(kindOf('session key-to-paint'), 'latency');
});

test('compare: medians of the runs, +15% fails for the database, +25% for startup', () => {
  const rows = compare(
    {
      'due-queue 100k': [1, 1, 1, 1, 1],
      'review-write 100k': [1, 1, 1, 1, 1],
      'startup home': [1000, 1000, 1000, 1000, 1000],
      'session key-to-paint': [10, 10, 10, 10, 10],
    },
    {
      'due-queue 100k': [1.2, 1.2, 9, 1.2, 1.2], // one noisy run doesn't move the median
      'review-write 100k': [1.1, 1.1, 1.1, 1.1, 1.1],
      'startup home': [1200, 1200, 1200, 1200, 1200],
      'session key-to-paint': [30, 30, 30, 30, 30],
      'deck-stats 100k': [3, 3, 3, 3, 3],
    },
  );
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(by['due-queue 100k'].head, 1.2);
  assert.equal(by['due-queue 100k'].status, 'fail', '+20% on a database metric');
  assert.equal(by['review-write 100k'].status, 'ok', '+10% is within 15%');
  assert.equal(by['startup home'].status, 'ok', '+20% is within 25% for startup');
  assert.equal(by['session key-to-paint'].status, 'info', 'latency is reported, not gated');
  assert.equal(by['deck-stats 100k'].status, 'new');
});

test('compare: tiny absolute changes never fail (timer noise)', () => {
  const rows = compare({ 'due-queue 10k': [0.02, 0.02, 0.02] }, { 'due-queue 10k': [0.03, 0.03, 0.03] });
  assert.equal(rows[0].status, 'ok');
});

test('the PR comment is one markdown table with a marker to find and update it', () => {
  const md = markdownCompare(compare({ 'due-queue 100k': [1] }, { 'due-queue 100k': [2] }), { runs: 5 });
  assert.ok(md.startsWith(MARKER));
  assert.match(md, /\| due-queue 100k \| 1\.00 ms \| 2\.00 ms \| \+100% \| ❌/);
});

test('budgets: P50 and P95 against docs/TESTING.md', () => {
  const rows = budgetRows([
    { name: 'due-queue 100k', p50: 2, p95: 20, n: 100 },
    { name: 'review-write 100k', p50: 1, p95: 2, n: 100 },
    { name: 'unknown', p50: 1, p95: 1, n: 1 },
  ]);
  assert.equal(rows.length, 2, 'metrics without a budget are left out');
  assert.equal(rows[0].ok, false, 'P95 20 ms is over 15 ms');
  assert.equal(rows[1].ok, true);
  assert.match(
    markdownBudgets(rows, 'Linux'),
    /\| due-queue 100k \| 2\.00 ms \/ ≤ 5 ms \| 20\.00 ms \/ ≤ 15 ms \| ❌ \|/,
  );
});
