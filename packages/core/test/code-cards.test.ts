// Code cards (#46): imported from CSV and .lernpack, asked three ways, graded as recall, exported unchanged.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-code-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { importFile } = await import('../src/importer');
const { exportDeck } = await import('../src/exporter');
const { recall } = await import('../src/exercises');
const { checkCode } = await import('../src/code');
const { recordAttempt } = await import('../src/learn');
const { planSession } = await import('../src/session');
const { getDb } = await import('../src/db');
const { rowToItem } = await import('../src/learn');
after(() => cleanupTempDir(dir));

const CSV = `front,back,type,code,code_lang
What does this print?,"0
1
2",code,"# count to two
for i in range(3):
    print(i)",python
Fill in the keyword,,code,"{{c1::def}} f():
    return 1",py
Put the lines in order,,code,"<b>x</b> = 1
if x > 0:
    print(""<script>"")",python
Not code,plain back,,,
`;
const enc = (s: string) => new TextEncoder().encode(s);
const items = (deckId: number) =>
  getDb()
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r) => rowToItem(r));

test('code cards keep their code as plain text with its indentation, even # lines in a quoted CSV cell', () => {
  const r = importFile('code.csv', enc(CSV), { deckName: 'Python' });
  assert.equal(r.added, 4);
  const [out, fill, order, basic] = items(r.deck.id);
  assert.deepEqual([out.kind, fill.kind, order.kind, basic.kind], ['code', 'code', 'code', 'card']);
  assert.equal(out.extra.code, '# count to two\nfor i in range(3):\n    print(i)');
  assert.equal(out.extra.codeLang, 'python');
  assert.equal(out.meaning, '0\n1\n2', 'the expected output keeps its lines');
  assert.equal(order.extra.code, '<b>x</b> = 1\nif x > 0:\n    print("<script>")', 'code is never cleaned as HTML');
  assert.equal(basic.extra.code, undefined);
});

test('each code card is asked its own way, and typed answers follow the code rules', () => {
  const [out, fill, order] = items(importFile('c.csv', enc(CSV), { deckName: 'Python 2' }).deck.id);
  const o = recall(out);
  assert.ok(o.type === 'typed' && o.code === out.extra.code && o.codeLang === 'python');
  assert.equal(checkCode('0 1 2', o.accepted).correct, true);
  const f = recall(fill);
  assert.ok(f.type === 'cloze' && f.codeLang === 'py');
  assert.deepEqual([f.before, f.after, f.accepted], ['', ' f():\n    return 1', ['def']]);
  const p = recall(order);
  assert.ok(p.type === 'order' && p.codeLang === 'python');
  assert.deepEqual(p.steps, ['<b>x</b> = 1', 'if x > 0:', '    print("<script>")']);
});

test('a code card is a question card: answering it introduces it and grades it once a day', () => {
  const [out] = items(importFile('c.csv', enc(CSV), { deckName: 'Python 3' }).deck.id);
  const base = { itemId: out.id, format: 'typed' as const, correct: true, sessionId: 's', responseMs: 3000, xp: 5 };
  assert.ok(recordAttempt(base).grade, 'graded on the first try');
  assert.equal(recordAttempt(base).grade, null, 'once a day');
});

test('a session asks code cards with their own exercise, never in pair or choice games', () => {
  const deck = importFile('c.csv', enc(CSV), { deckName: 'Python 4' }).deck;
  const plan = planSession('long', getDb(), new Date(), deck.id);
  const codeIds = new Set(
    items(deck.id)
      .filter((i) => i.kind === 'code')
      .map((i) => i.id),
  );
  for (const b of plan.blocks) {
    if ('itemIds' in b && b.kind !== 'boss') assert.ok(!b.itemIds.some((id) => codeIds.has(id)), b.kind);
    if ('exercises' in b)
      for (const e of b.exercises)
        if ('itemId' in e && codeIds.has(e.itemId)) assert.ok(['typed', 'cloze', 'order'].includes(e.type), e.type);
  }
});

test('CSV and .lernpack exports keep the code, its language and the output, and import back the same', () => {
  const r = importFile('code.csv', enc(CSV), { deckName: 'Python export' });
  const csv = strFromU8(exportDeck(r.deck.id, 'csv').data);
  const back = importFile('again.csv', enc(csv), { deckName: 'Python from CSV' });
  const pack = exportDeck(r.deck.id, 'lernpack');
  const first = JSON.parse(strFromU8(unzipSync(pack.data)['cards.jsonl']).split('\n')[0]);
  assert.equal(first.type, 'code');
  assert.equal(first.codeLang, 'python');
  assert.ok(first.code.startsWith('# count'));
  const fromPack = importFile(pack.name, pack.data, { deckName: 'Python from pack' });
  const strip = (i: ReturnType<typeof rowToItem>) => ({ ...i, id: 0, deckId: 0, deck: '' });
  assert.deepEqual(items(back.deck.id).map(strip), items(r.deck.id).map(strip));
  assert.deepEqual(items(fromPack.deck.id).map(strip), items(r.deck.id).map(strip));
});
