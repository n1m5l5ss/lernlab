// Accepting an AI request (#148): new decks and cards, sanitised like an import, starting as new cards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-airequests-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { applyAiRequest } = await import('../src/airequests');
const { findCards } = await import('../src/browse');
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const id = '00000000-0000-4000-8000-000000000001';
const createdAt = '2026-11-21T10:00:00.000Z';

test('a new deck with cards: text is sanitised and every card starts new', () => {
  const r = applyAiRequest({
    id,
    createdAt,
    kind: 'create_deck',
    deck: { name: 'Biology', language: 'en', description: 'From chapter 3' },
    cards: [
      { front: 'Mitochondria', back: 'Powerhouse <script>alert(1)</script>of the cell', tags: ['cell'] },
      { front: 'Ribosome', back: 'Makes proteins' },
      { front: '  ', back: 'no front' },
    ],
  });
  assert.equal(r.added, 2);
  assert.equal(r.skipped, 1);
  const rows = findCards({ deckId: r.deckId }).rows;
  assert.deepEqual(
    rows.map((c) => c.front),
    ['Mitochondria', 'Ribosome'],
  );
  assert.ok(rows.every((c) => c.state === 'new'));
  assert.ok(!rows[0].back.includes('script') && !rows[0].back.includes('alert'), rows[0].back);
  assert.equal(Number(getDb().prepare('SELECT COUNT(*) AS n FROM srs').get()!.n), 0, 'no schedule');
  assert.throws(
    () => applyAiRequest({ id, createdAt, kind: 'create_deck', deck: { name: 'Biology' }, cards: [] }),
    /already exists/,
  );
});

test('cards for an existing deck; accepting the same request twice adds them once', () => {
  const deckId = findCards({ q: 'Ribosome' }).rows[0].deckId;
  const req = {
    id: '00000000-0000-4000-8000-000000000002',
    createdAt,
    kind: 'add_cards' as const,
    deckId,
    cards: [{ front: 'Nucleus', back: 'Holds DNA' }],
  };
  assert.equal(applyAiRequest(req).added, 1);
  assert.equal(applyAiRequest(req).added, 0);
  assert.equal(findCards({ deckId }).total, 3);
  assert.throws(() => applyAiRequest({ ...req, deckId: 999 }), /Deck not found/);
});
