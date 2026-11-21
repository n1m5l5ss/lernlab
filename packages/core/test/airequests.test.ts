// Accepting an AI request (#148): new decks and cards, sanitised like an import, starting as new cards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';
import type { OrganiseAction } from '../src/airequests';

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

const { recordAttempt } = await import('../src/learn');
const { cardSnapshots, requestCardIds } = await import('../src/airequests');
const cardId = (front: string) => findCards({ q: front }).rows[0].id;
const schedule = (itemId: number) => getDb().prepare('SELECT reps, due FROM srs WHERE item_id = ?').get(itemId);

test('a fix changes only the given fields and keeps the card, its tags and its progress', () => {
  const card = cardId('Mitochondria');
  recordAttempt({ sessionId: 's1', itemId: card, format: 'intro', correct: true, responseMs: 1000, xp: 5 }, getDb());
  const before = schedule(card);
  assert.ok(before, 'scheduled');
  const r = applyAiRequest({
    id: '00000000-0000-4000-8000-000000000003',
    createdAt,
    kind: 'edit_card',
    cardId: card,
    changes: { back: 'Makes ATP <img src=x onerror=alert(1)>', explanation: 'Cell respiration happens here.' },
  });
  assert.deepEqual(r, { deckId: findCards({ q: 'Mitochondria' }).rows[0].deckId, added: 0, updated: 1, skipped: 0 });
  const [now] = cardSnapshots([card]);
  assert.equal(now.front, 'Mitochondria');
  assert.equal(now.back.trim(), 'Makes ATP');
  assert.equal(now.explanation, 'Cell respiration happens here.');
  assert.deepEqual(now.tags, ['cell']);
  assert.deepEqual(schedule(card), before, 'progress kept');
  const stored = getDb().prepare('SELECT meaning FROM items WHERE id = ?').get(card);
  assert.ok(!String(stored?.meaning).includes('onerror'));
  assert.throws(
    () => applyAiRequest({ id, createdAt, kind: 'edit_card', cardId: 999999, changes: { back: 'x' } }),
    /Card not found/,
  );
});

test('a merge keeps one card and suspends and tags the others; nothing is deleted', () => {
  const deckId = findCards({ q: 'Ribosome' }).rows[0].deckId;
  applyAiRequest({
    id: '00000000-0000-4000-8000-000000000004',
    createdAt,
    kind: 'add_cards',
    deckId,
    cards: [{ front: 'ribosome', back: 'Protein factory' }],
  });
  const [keep, dup] = findCards({ q: 'ribosome' }).rows.map((c) => c.id);
  const total = findCards({}).total;
  const req = {
    id: '00000000-0000-4000-8000-000000000005',
    createdAt,
    kind: 'merge_cards' as const,
    keepId: keep,
    mergeIds: [dup, keep],
    changes: { back: 'Makes proteins (the protein factory)' },
  };
  assert.deepEqual(requestCardIds(req), [keep, dup]);
  assert.equal(applyAiRequest(req).updated, 2);
  const [k, m] = cardSnapshots([keep, dup]);
  assert.equal(k.back, 'Makes proteins (the protein factory)');
  assert.equal(k.suspended, false);
  assert.equal(m.suspended, true);
  assert.ok(m.tags.includes('merged'));
  assert.equal(findCards({}).total, total, 'nothing deleted');
  assert.throws(() => applyAiRequest({ ...req, mergeIds: [999999] }), /Card not found/);
});

test('organising tags, stars, suspends and moves cards, but never deletes them', () => {
  const ids = findCards({ q: 'Nucleus' }).rows.map((c) => c.id);
  const ask = (action: OrganiseAction) =>
    applyAiRequest({ id, createdAt, kind: 'organise_cards', cardIds: [...ids, 999999], action });
  assert.deepEqual(ask({ kind: 'tag', tag: 'exam' }), { deckId: null, added: 0, updated: 1, skipped: 1 });
  ask({ kind: 'star' });
  const [c] = cardSnapshots(ids);
  assert.ok(c.tags.includes('exam') && c.starred);
  const target = applyAiRequest({
    id: '00000000-0000-4000-8000-000000000006',
    createdAt,
    kind: 'create_deck',
    deck: { name: 'Exam' },
    cards: [{ front: 'Golgi', back: 'Packs proteins' }],
  }).deckId!;
  assert.equal(ask({ kind: 'move', deckId: target }).deckId, target);
  assert.equal(cardSnapshots(ids)[0].deckId, target);
  const total = findCards({}).total;
  const del = { kind: 'delete' } as unknown as OrganiseAction;
  assert.throws(
    () => applyAiRequest({ id, createdAt, kind: 'organise_cards', cardIds: ids, action: del }),
    /not allowed/,
  );
  assert.equal(findCards({}).total, total);
});
