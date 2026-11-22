import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_DECKS,
  CARD_WIDTH,
  cardFacts,
  cardFileName,
  cardSvg,
  clip,
  goalShare,
  xml,
  type CardText,
} from './progress-card';

const deck = (id: number, learned: number, cards: number, examDate: string | null = null) => ({
  id,
  name: `Deck ${id}`,
  learned,
  cards,
  examDate,
});
const journey = {
  today: '2026-11-25',
  decks: [deck(1, 2, 10), deck(2, 30, 40, '2026-12-20'), deck(3, 0, 0), deck(4, 9, 9), deck(5, 5, 50)],
  totals: { learned: 46, remaining: 63 },
  week: {
    start: '2026-11-23',
    cards: { target: 40, done: 12 },
    sessions: { target: 5, done: 2 },
    days: 2,
    minutes: 25,
    exam: { deck: 'Deck 2', date: '2026-12-20', days: 25 },
  },
  retention: { reviews: 50, recalled: 45 },
};

test('the card shows the week, the totals and the decks you have learned most of', () => {
  const f = cardFacts(journey);
  assert.equal(f.week, '2026-11-23');
  assert.deepEqual([f.learned, f.days, f.minutes, f.recalled], [46, 2, 25, 0.9]);
  assert.deepEqual(f.cards, { target: 40, done: 12 });
  assert.deepEqual(f.sessions, { target: 5, done: 2 });
  assert.deepEqual(
    f.decks.map((d) => d.id),
    [2, 4, 5],
  );
  assert.equal(f.decks.length, CARD_DECKS);
  assert.equal(f.moreDecks, 1, 'empty decks are not counted');
  assert.equal(cardFacts({ ...journey, retention: { reviews: 0, recalled: 0 } }).recalled, null);
});

test('a goal bar fills to its share and stops at full', () => {
  assert.equal(goalShare(12, 40), 0.3);
  assert.equal(goalShare(50, 40), 1);
  assert.equal(goalShare(0, 0), 0);
});

test('long text is cut with an ellipsis, by whole characters', () => {
  assert.equal(clip('short', 10), 'short');
  assert.equal(clip('abcdefghijkl', 6), 'abcde…');
  assert.equal(clip('😀😀😀😀', 3), '😀😀…');
});

const text: CardText = {
  title: 'My progress',
  subtitle: 'Week of 23 November 2026',
  stats: [
    { value: '46', label: 'cards learned' },
    { value: '2 of 7', label: 'days this week' },
  ],
  goalsTitle: 'This week’s goal',
  goals: [{ label: 'New cards', value: '12 of 40', share: 0.3 }],
  note: 'Next exam: Deck 2',
  decksTitle: 'Decks',
  decks: [{ name: '<script>alert(1)</script> & "Bio"', detail: '30 of 40', share: 0.75 }],
  footer: 'Made with LernLab',
};
const colors = { bg: '#fff', surface: '#fafafa', text: '#111', muted: '#555', accent: '#24a', border: '#ddd' };

test('the picture is a self-contained SVG: deck names are escaped and nothing in it can run or load', () => {
  const { svg, width, height } = cardSvg(text, colors);
  assert.equal(width, CARD_WIDTH);
  assert.ok(height > 300);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(svg.includes(`viewBox="0 0 ${width} ${height}"`));
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Bio&quot;'));
  assert.ok(!/href|url\(|<image|<foreignObject|on\w+=/.test(svg));
  for (const s of ['My progress', 'Week of 23 November 2026', '12 of 40', 'cards learned', 'Made with LernLab'])
    assert.ok(svg.includes(s), s);
  assert.equal(xml(`a<b>&"c'`), 'a&lt;b&gt;&amp;&quot;c&#39;');
});

test('hostile colours cannot break out of the picture, and RTL text is anchored to the right', () => {
  const { svg } = cardSvg(text, { ...colors, accent: '"/><script>x</script>' }, { rtl: true });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('direction="rtl"'));
});

test('the file is named after the day', () => {
  assert.equal(cardFileName('2026-11-25'), 'lernlab-progress-2026-11-25.png');
});
