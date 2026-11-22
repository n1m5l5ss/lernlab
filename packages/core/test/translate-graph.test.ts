// Translate cards and graphs (#210): a card whose two sides are two representations of one idea, asked in both
// directions as real recall, and a small graph LernLab draws from a line of text read by its own safe parser.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-translate-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { cardToItem, createDeck, upsertCards } = await import('../src/library');
const { planSession } = await import('../src/session');
const { allItems, recordAttempt } = await import('../src/learn');
const { GRAPH_MAX_LENGTH, cleanGraph, graphOf, graphPoints, hasGraph, parseGraph, plotGraph, ticks } =
  await import('../src/graph');
const { asksOtherWay, isTranslate } = await import('../src/translate');
const { otherWay, recall } = await import('../src/exercises');
const { askedOwnWay } = await import('../src/explain');
const { guessable } = await import('../src/guess');
const { buildExam } = await import('../src/examplan');
const { exportDeck } = await import('../src/exporter');
const { importFile } = await import('../src/importer');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const at = (line: string, x: number) => {
  const g = parseGraph(line);
  assert.ok(g && g.kind === 'function', line);
  return g.f(x);
};

test('a graph line is read by a small parser: operators, brackets, powers, functions, implied multiplication', () => {
  assert.equal(at('y = 2x + 1', 3), 7);
  assert.equal(at('x^2 - 1', -3), 8);
  assert.equal(at('-x^2', 3), -9); // the power binds tighter than the minus
  assert.equal(at('2^3^2', 0), 512);
  assert.equal(at('2^-x', 1), 0.5);
  assert.equal(at('f(x) = 3(x+1)(x-1)', 2), 9);
  assert.equal(at('(x+1)(x-1)', 2), 3);
  assert.equal(at('Y = 6 / 2 / 3 - 1 - 1', 0), -1);
  assert.equal(at('sqrt(x) + abs(-2)', 9), 5);
  assert.equal(at('2 sin(pi x / 2)', 1), 2);
  assert.equal(at('ln(e^x)', 2), 2);
  assert.equal(at('x − 2·x', 3), -3); // a typed minus sign and a middle dot
});

test('a graph line that does not read gives no graph: nothing is ever evaluated as code', () => {
  for (const bad of [
    '',
    '   ',
    'y =',
    '2 +',
    '(x',
    'x)',
    'sin x',
    'alert(1)',
    'x; alert(1)',
    'constructor',
    'x.y',
    'x = 3',
    'y = x; x = 5..1',
    'y = x; x = 1..1',
    'y = x; z = 1..2',
    'y = x; x = 1..9999999',
    'y = sqrt(x - 100)', // nothing to draw between -5 and 5
    '(1,2)',
    '(1,2) (3,',
    '<script>x</script>',
    'x'.repeat(GRAPH_MAX_LENGTH + 1),
    '('.repeat(150) + 'x' + ')'.repeat(149),
  ])
    assert.equal(cleanGraph(bad), '', bad);
  assert.equal(parseGraph(undefined), null);
});

test('the kept line is canonical: it reads back to itself, with ranges only when they are not the default', () => {
  assert.equal(cleanGraph('  Y =  X^2 - 1 '), 'y = x^2 - 1');
  assert.equal(cleanGraph('x^2;x=-3..3'), 'y = x^2; x = -3..3');
  assert.equal(cleanGraph('y = 1/x ; y = -4 .. 4; x = -5..5'), 'y = 1/x; y = -4..4');
  assert.equal(cleanGraph('(0, 1), (1;3) (2,5.50000)'), '(0,1) (1,3) (2,5.5)');
  for (const line of ['y = x^2 - 1; x = -3..3; y = 0..0.5', '(0,1) (1,3) (-2.5,5)', 'y = tan(x)'])
    assert.equal(cleanGraph(cleanGraph(line)), cleanGraph(line));
});

test('a graph is drawn as path data inside its box, broken at gaps and poles, with round ticks and axes', () => {
  const line = plotGraph(parseGraph('y = 2x + 1')!);
  assert.equal(line.paths.length, 1);
  assert.match(line.paths[0], /^M38 [\d.]+ L/);
  assert.deepEqual(line.x, [-5, 5]);
  assert.deepEqual(
    line.xTicks.map((t) => t.value),
    [-4, -2, 0, 2, 4],
  );
  assert.ok(line.xAxis !== null && line.yAxis !== null);
  for (const d of line.paths)
    for (const [, x, y] of d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)) {
      assert.ok(Number(x) >= line.box.left && Number(x) <= line.box.right);
      assert.ok(Number.isFinite(Number(y)));
    }
  // sqrt has no value left of 0: one piece, starting at the y axis.
  const root = plotGraph(parseGraph('sqrt(x)')!);
  assert.equal(root.paths.length, 1);
  assert.ok(root.paths[0].startsWith(`M${root.yAxis} `));
  // 1/x: two pieces, never a line through the pole, and a y range that still shows the curve.
  const pole = plotGraph(parseGraph('1/x')!);
  assert.equal(pole.paths.length, 2);
  assert.ok(pole.y[1] - pole.y[0] < 12);
  assert.equal(plotGraph(parseGraph('tan(x)')!).paths.length >= 3, true);
  // A constant still gets a range.
  assert.deepEqual(plotGraph(parseGraph('y = 3')!).y.map(Math.round), [2, 4]);
  // A point list: dots joined by one line; an asked-for y range is used as given.
  const pts = plotGraph(parseGraph('(0,1) (1,3) (2,5)')!);
  assert.equal(pts.dots.length, 3);
  assert.equal(pts.paths.length, 1);
  assert.deepEqual(plotGraph(parseGraph('x^2; y = 0..10')!).y, [0, 10]);
  assert.deepEqual(ticks([0, 1]), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test('the text alternative lists points a learner could read off, never the formula', () => {
  assert.deepEqual(graphPoints(parseGraph('y = 2x + 1')!), [
    [-5, -9],
    [-2.5, -4],
    [0, 1],
    [2.5, 6],
    [5, 11],
  ]);
  assert.deepEqual(graphPoints(parseGraph('(0,1) (1,3)')!), [
    [0, 1],
    [1, 3],
  ]);
  assert.equal(graphPoints(parseGraph('1/x')!).length, 4); // no value at 0
});

const deck = createDeck('Functions', null);
const filler = ['slope', 'intercept', 'vertex', 'root', 'domain'].map((w, i) => ({ front: w, back: `term ${i}` }));
upsertCards(deck, [
  { front: 'Which function is this?', back: 'y = 2x + 1', graph: 'Y = 2x+1', type: 'translate' },
  { front: 'A parabola that opens upwards and has its lowest point at the origin', back: 'y = x^2', type: 'translate' },
  {
    front: 'Which function is drawn?',
    back: 'y = x^2',
    type: 'mcq',
    choices: 'y = x^2|y = 2x|y = sqrt(x)',
    correct: '1',
    graph: 'x^2; x = -3..3',
  },
  ...filler,
]);
const items = allItems(getDb(), deck.id);
const [line, parabola, quiz] = items;

test('a card keeps a graph that reads, in its canonical form; a translate card is a basic card with a flag', () => {
  assert.deepEqual(
    [line, parabola, quiz].map((i) => [i.kind, graphOf(i), isTranslate(i)]),
    [
      ['card', 'y = 2x+1', true],
      ['card', '', true],
      ['mcq', 'y = x^2; x = -3..3', false],
    ],
  );
  const item = (c: object) => cardToItem(deck, { front: 'Q', back: 'A', ...c })!;
  assert.equal(hasGraph(item({ graph: 'alert(1)' })), false);
  assert.equal(hasGraph(item({ graph: 'x', type: 'cloze', front: 'a {{c1::b}}' })), false);
  assert.equal(hasGraph(item({ graph: 'x', code: 'print(1)' })), false);
  assert.equal(isTranslate(item({ type: 'mcq', choices: 'a|b', correct: '1', extra: { translate: '1' } })), false);
  assert.equal(isTranslate(item({ type: 'myth', extra: { translate: '1' } })), false);
  // Saved again without a type, the card stays what it was; another type or an emptied graph clears it.
  assert.equal(isTranslate(item({ extra: { translate: '1' } })), true);
  assert.equal(isTranslate(item({ type: 'basic', extra: { translate: '1' } })), false);
  assert.equal(graphOf(item({ extra: { graph: 'y = x' } })), 'y = x');
  assert.deepEqual(item({ graph: '', extra: { graph: 'y = x' } }).extra, {});
  // In a language deck a translate card is still a basic card.
  assert.equal(
    cardToItem({ ...deck, language: 'de' }, { front: 'Haus', back: 'house', type: 'translate' })!.kind,
    'card',
  );
});

test('a translate card is asked the usual way first, then the other way round on every second review', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((reps) => asksOtherWay(line, reps)),
    [false, true, false, true],
  );
  assert.equal(asksOtherWay(quiz, 1), false);
  // The line card has a short back: usually front → typed back; the other way shows the formula and flips to the front.
  assert.equal(recall(line).type, 'typed');
  assert.deepEqual(otherWay(line), {
    type: 'flip',
    itemId: line.id,
    prompt: 'y = 2x + 1',
    answer: 'Which function is this?',
    reverse: true,
  });
  // The parabola card too: its back is the short side.
  const back = otherWay(parabola);
  assert.equal(back.type === 'flip' && back.prompt, 'y = x^2');
  // A card whose front is the short side is usually asked from the back, so the other way asks from the front.
  const term = cardToItem(deck, {
    front: 'Parabola',
    back: 'The graph of a quadratic function: a curve that is symmetric about a vertical line through its vertex',
    type: 'translate',
  })!;
  const fwd = otherWay(term);
  assert.deepEqual(fwd.type === 'flip' && [fwd.prompt, fwd.reverse], ['Parabola', false]);
});

test('sessions ask a learned translate card the other way round, as a real recall graded once a day', () => {
  const db = getDb();
  const day1 = new Date(2026, 0, 5, 9);
  const a = { sessionId: 't', format: 'flip' as const, correct: true, responseMs: 5000, xp: 1 };
  for (const i of [line, parabola]) {
    recordAttempt({ ...a, itemId: i.id, format: 'intro' as const }, db, day1);
    recordAttempt({ ...a, itemId: i.id, format: 'typed' as const }, db, day1);
  }
  const reps = () => Number(db.prepare('SELECT reps FROM srs WHERE item_id = ?').get(line.id)!.reps);
  assert.equal(reps(), 1);
  const later = new Date(2026, 0, 20, 9);
  const plan = planSession('long', db, later, deck.id);
  const asked = plan.blocks
    .flatMap((b) => ('exercises' in b ? b.exercises : []))
    .filter((e) => 'itemId' in e && e.itemId === line.id && e.type === 'flip');
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], otherWay(line));
  // The flip the other way is a recall: it moves the schedule once; a second answer that day does not.
  recordAttempt({ ...a, itemId: line.id }, db, later);
  assert.equal(reps(), 2);
  recordAttempt({ ...a, itemId: line.id }, db, later);
  assert.equal(reps(), 2);
});

test('cards with a graph stay out of games and guess rounds; an exam shows the graph with a question from the front', () => {
  assert.equal(askedOwnWay(line), true);
  assert.equal(askedOwnWay(quiz), true);
  assert.equal(askedOwnWay(parabola), false); // no graph: both sides are text, games work
  assert.equal(guessable(line), false);
  for (let n = 0; n < 5; n++) {
    const exam = buildExam(deck.id);
    const byId = new Map(exam.questions.map((q) => [q.itemId, q]));
    assert.equal(byId.get(quiz.id)?.graph, 'y = x^2; x = -3..3');
    assert.equal(byId.get(line.id)?.graph, 'y = 2x+1');
    assert.equal(byId.get(parabola.id)?.graph, undefined);
  }
});

test('graph and type survive .lernpack and CSV; older readers get a basic card', async () => {
  for (const format of ['lernpack', 'csv'] as const) {
    const file = exportDeck(deck.id, format);
    const r = await importFile(file.name, file.data, { deckName: `Copy ${format}` });
    const copy = allItems(getDb(), r.deck.id);
    const shape = (i: (typeof items)[number]) => [i.target, i.meaning, graphOf(i), isTranslate(i), i.kind];
    for (const card of [line, parabola, quiz])
      assert.deepEqual(shape(copy.find((i) => i.target === card.target)!), shape(card), format);
  }
  const csv = new TextDecoder().decode(exportDeck(deck.id, 'csv').data);
  assert.match(csv.split('\n')[0], /(^|,)graph(,|$)/);
  assert.match(csv, /translate/);
});
