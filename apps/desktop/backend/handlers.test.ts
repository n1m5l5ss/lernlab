// The request table behind the desktop bridge: validation, errors as values, and a round trip.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from '../test/test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-ipc-'));
process.env.LERNLAB_DATA = dir;
const { handle } = await import('./handlers');
after(() => cleanupTempDir(dir));

const ok = async (channel: string, input?: unknown) => {
  const r = await handle(channel, input);
  assert.ok(r.ok, `${channel} failed: ${!r.ok && r.error.message}`);
  return r.value as any;
};

test('unknown channels and bad input come back as errors, never as throws', async () => {
  assert.deepEqual(await handle('fs.readFile', { path: '/etc/passwd' }), {
    ok: false,
    error: { code: 'unknown_channel', message: 'Unknown request' },
  });
  assert.deepEqual(await handle('toString', undefined), {
    ok: false,
    error: { code: 'unknown_channel', message: 'Unknown request' },
  });
  const bad = await handle('decks.delete', { id: '1; DROP TABLE decks' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const empty = await handle('decks.create', { name: '   ' });
  assert.equal(!empty.ok && empty.error.code, 'name_required');
  const notFound = await handle('decks.activate', { id: 999 });
  assert.equal(!notFound.ok && notFound.error.code, 'deck_not_found');
});

test('create a deck, add and edit a card, import a file, plan a session', async () => {
  const deck = await ok('decks.create', { name: 'Capitals', language: null });
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'France', back: 'Paris', tags: 'geo eu' } });
  await ok('cards.update', { id, card: { front: 'France', back: 'Paris', starred: true, unknownField: 'ignored' } });
  const list = await ok('cards.find', { deckId: deck.id });
  assert.equal(list.total, 1);
  assert.equal(list.rows[0].back, 'Paris');
  assert.equal(list.rows[0].starred, true);
  const card = await ok('cards.get', { id });
  assert.equal(card.meaning, 'Paris');
  const csv = new TextEncoder().encode('front,back\nGermany,Berlin\nItaly,Rome\n');
  const imp = await ok('import.file', { name: 'more.csv', data: csv, deckId: deck.id, ankiHistory: false });
  assert.equal(imp.added, 2);
  assert.equal(imp.reviews, 0);
  const notBool = await handle('import.file', { name: 'more.csv', data: csv, ankiHistory: 'yes' });
  assert.equal(!notBool.ok && notBool.error.code, 'invalid_input');
  const exp = await ok('decks.export', { id: deck.id, format: 'csv' });
  assert.ok(exp.data instanceof Uint8Array && new TextDecoder().decode(exp.data).includes('Berlin'));
  const plan = await ok('session.plan', { length: 'mini' });
  assert.ok(plan.blocks.length > 0);
  const state = await ok('state.get');
  assert.equal(state.itemCount, 3);
});

test('the card editor saves, changes and clears an image description', async () => {
  const deck = await ok('decks.create', { name: 'Pictures', language: null });
  const card = { front: 'What is this?', back: 'a heart', image: 'heart.png' };
  const { id } = await ok('cards.add', { deckId: deck.id, card: { ...card, imageAlt: 'A red heart' } });
  assert.equal((await ok('cards.get', { id })).extra.imageAlt, 'A red heart');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.imageAlt, 'A red heart', 'kept when the field is not sent');
  await ok('cards.update', { id, card: { ...card, imageAlt: 'A <i>beating</i> heart' } });
  assert.equal((await ok('cards.get', { id })).extra.imageAlt, 'A beating heart', 'plain text');
  await ok('cards.update', { id, card: { ...card, imageAlt: '' } });
  assert.ok(!('imageAlt' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('import preview saves nothing, and a column mapping reaches the real import', async () => {
  const before = (await ok('state.get')).itemCount;
  const csv = new TextEncoder().encode('Wort;Notiz;Bedeutung\nHund;pet;dog\nKatze;pet;cat\n');
  const auto = await ok('import.preview', { name: 'Tiere.csv', data: csv });
  assert.equal(auto.table.header, false);
  assert.equal(auto.cards[0].front, 'Wort');
  const mapping = { header: true, fields: { front: 0, back: 2, nonsense: 1 } };
  const p = await ok('import.preview', { name: 'Tiere.csv', data: csv, mapping });
  assert.deepEqual(
    p.cards.map((c: { back: string }) => c.back),
    ['dog', 'cat'],
  );
  assert.deepEqual(p.table.fields, { front: 0, back: 2 });
  const pasted = await ok('import.preview', { text: 'a:1\nb:2', fieldSep: ':' });
  assert.equal(pasted.total, 2);
  assert.equal((await ok('state.get')).itemCount, before, 'a preview saves nothing');
  const bad = await handle('import.preview', {
    name: 'x.csv',
    data: csv,
    mapping: { header: true, fields: { front: -1 } },
  });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const res = await ok('import.file', { name: 'Tiere.csv', data: csv, mapping });
  assert.equal(res.added, 2);
  const rows = (await ok('cards.find', { deckId: res.deck.id })).rows;
  assert.deepEqual(rows.map((r: { back: string }) => r.back).sort(), ['cat', 'dog']);
});

test('update settings default to on and stable, and a backup can be taken before an update', async () => {
  const s = await ok('settings.save', { betaUpdates: 'yes', autoUpdate: undefined });
  assert.equal(s.autoUpdate, true);
  assert.equal(s.betaUpdates, false);
  assert.equal((await ok('settings.save', { betaUpdates: true, autoUpdate: false })).betaUpdates, true);
  const { file } = await ok('backup.create');
  assert.match(file, /^lernlab-\d{8}.*\.db$/);
  assert.ok(existsSync(join(dir, 'backups', file)));
});

test('backups: before an update, listed with counts, restored; export and import everything; delete all', async () => {
  const { file } = await ok('backup.create', { reason: 'update' });
  assert.match(file, /-before-update-v\d+\.db$/);
  const listed = (await ok('backup.list')).find((b: { file: string }) => b.file === file);
  const decks = (await ok('state.get')).decks.length;
  assert.equal(listed.counts.decks, decks);
  const zip = await ok('data.export');
  assert.match(zip.name, /^lernlab-data-\d{8}\.zip$/);

  const refused = await handle('data.deleteAll', { confirm: 'yes' });
  assert.equal(!refused.ok && refused.error.code, 'invalid_input', 'deleting everything needs the confirmation');
  assert.deepEqual(await ok('data.deleteAll', { confirm: 'delete-all-data' }), { ok: true });
  assert.equal((await ok('state.get')).decks.length, 0);
  assert.deepEqual(await ok('backup.list'), [], 'backups are deleted too');
  const old = await handle('backup.restore', { file });
  assert.equal(!old.ok && old.error.code, 'backup_not_found');

  assert.equal((await ok('data.import', { data: zip.data })).counts.decks, decks, 'an export still brings it back');
  assert.equal((await ok('state.get')).decks.length, decks);
  const bad = await handle('data.import', { data: new TextEncoder().encode('nope') });
  assert.equal(!bad.ok && bad.error.code, 'not_data_export');
  const missing = await handle('backup.restore', { file: '../lernlab.db' });
  assert.equal(!missing.ok && missing.error.code, 'backup_not_found');
});

test('Home can study every deck at once and shows this week', async () => {
  await ok('decks.activate', { id: null });
  const state = await ok('state.get');
  assert.equal(state.activeDeck, null);
  assert.equal(state.week.length, 7);
  assert.equal(state.week.filter((d: { today: boolean }) => d.today).length, 1);
});

test('the theme follows the system unless light or dark is chosen', async () => {
  assert.equal((await ok('state.get')).settings.theme, 'system');
  assert.equal((await ok('settings.save', { theme: 'dark' })).theme, 'dark');
  assert.equal((await ok('settings.save', { theme: 'purple' })).theme, 'system');
  assert.equal((await ok('settings.save', { theme: 'light' })).theme, 'light');
});

test('text size, reduced motion and new cards per day are checked before they are saved', async () => {
  const d = (await ok('state.get')).settings;
  assert.equal(d.textSize, 'normal');
  assert.equal(d.reducedMotion, false);
  const s = await ok('settings.save', { textSize: 'larger', reducedMotion: true, newPerDay: 250 });
  assert.equal(s.textSize, 'larger');
  assert.equal(s.reducedMotion, true);
  assert.equal(s.newPerDay, 100);
  const bad = await ok('settings.save', { textSize: 'huge', reducedMotion: 'yes', newPerDay: -3 });
  assert.equal(bad.textSize, 'normal');
  assert.equal(bad.reducedMotion, false);
  assert.equal(bad.newPerDay, 0);
});

test('the daily reminder is off by default, its time is checked, and it knows when you studied', async () => {
  const d = (await ok('state.get')).settings;
  assert.equal(d.reminder, false);
  assert.equal(d.reminderTime, '19:00');
  assert.equal(d.launchAtLogin, false);
  const s = await ok('settings.save', { reminder: true, reminderTime: '07:45', launchAtLogin: true });
  assert.deepEqual([s.reminder, s.reminderTime, s.launchAtLogin], [true, '07:45', true]);
  const bad = await ok('settings.save', { reminder: 'yes', reminderTime: '25:99', launchAtLogin: 1 });
  assert.deepEqual([bad.reminder, bad.reminderTime, bad.launchAtLogin], [false, '19:00', false]);
  await ok('settings.save', { reminder: true, reminderTime: '08:30' });
  const before = await ok('reminder.status');
  assert.deepEqual(before, { enabled: true, time: '08:30', launchAtLogin: false, language: 'en', studiedToday: false });
  await ok('session.finish', {
    sessionId: 'reminder-test',
    length: 'mini',
    seconds: 60,
    answers: 0,
    correct: 0,
    bossWon: null,
    bestGenderCombo: 0,
    perfectBlocks: 0,
    startedAt: new Date().toISOString(),
  });
  assert.equal((await ok('reminder.status')).studiedToday, true);
  await ok('settings.save', { reminder: false });
});

test('Settings can show the version, licence and data folder', async () => {
  const info = await ok('app.info');
  assert.match(info.version, /^\d+\.\d+\.\d+/);
  assert.equal(info.licence, 'MIT');
  assert.equal(info.dataDir, dir);
  assert.equal(info.backupsDir, join(dir, 'backups'));
});

test('choose what to study: a tag or starred cards, checked first; picking a deck resets it', async () => {
  const bad = await handle('study.choose', { source: { kind: 'tag', tag: '' } });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const missing = await handle('study.choose', { source: { kind: 'decks', deckIds: [9999] } });
  assert.equal(!missing.ok && missing.error.code, 'deck_not_found');
  const deck = await ok('decks.create', { name: 'Rivers', language: null });
  await ok('cards.add', { deckId: deck.id, card: { front: 'Longest river', back: 'Nile', tags: 'geo' } });
  await ok('study.choose', { source: { kind: 'tag', tag: 'geo' } });
  const state = await ok('state.get');
  assert.deepEqual(state.source, { kind: 'tag', tag: 'geo' });
  assert.ok(state.tags.includes('geo'), JSON.stringify(state.tags));
  const plan = await ok('session.plan', { length: 'mini' });
  assert.ok(Object.values(plan.items).every((i) => (i as { tags: string[] }).tags.includes('geo')));
  await ok('decks.activate', { id: null });
  assert.deepEqual((await ok('state.get')).source, { kind: 'all' });
});

test('a practice session is planned as practice, and its answers are accepted as practice', async () => {
  const plan = await ok('session.plan', { length: 'mini', practice: true });
  assert.equal(plan.practice, true);
  const itemId = Number(Object.keys(plan.items)[0]);
  const r = await ok('attempt.record', {
    sessionId: plan.id,
    itemId,
    format: 'typed',
    correct: true,
    responseMs: 900,
    xp: 5,
    practice: true,
  });
  assert.equal(r.grade, null);
  const bad = await handle('session.plan', { length: 'mini', practice: 'yes' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
});

test('deck settings are checked, and deleting a deck takes a backup first', async () => {
  const deck = await ok('decks.create', {
    name: 'Medicine::Cardio',
    language: null,
    settings: { newPerDay: 7, examDate: '2027-03-15', ankiSource: 'x' },
  });
  assert.deepEqual(deck.settings, { newPerDay: 7, examDate: '2027-03-15' });
  const upd = await ok('decks.update', {
    id: deck.id,
    patch: { settings: { goal: { label: 'Board exam', words: 300 }, examDate: '' } },
  });
  assert.deepEqual(upd.settings, { newPerDay: 7, goal: { label: 'Board exam', words: 300 } });
  const voiced = await ok('decks.update', { id: deck.id, patch: { settings: { voice: 'uri:Anna', rate: 2 } } });
  assert.equal(voiced.settings.voice, 'uri:Anna');
  assert.equal(voiced.settings.rate, 1.5, 'reading speed is clamped');
  const auto = await ok('decks.update', { id: deck.id, patch: { settings: { voice: '', rate: 1 } } });
  assert.equal(auto.settings.voice, undefined, 'an empty voice means the best match again');
  const blank = await handle('decks.update', { id: deck.id, patch: { name: '  ' } });
  assert.equal(!blank.ok && blank.error.code, 'name_required');
  const del = await ok('decks.delete', { id: deck.id });
  assert.ok(existsSync(join(dir, 'backups', del.backup)), 'backup file exists');
  const again = await handle('decks.delete', { id: deck.id });
  assert.equal(!again.ok && again.error.code, 'deck_not_found');
});

test('the card browser filters across decks and changes many cards at once', async () => {
  const a = await ok('decks.create', { name: 'Bulk A', language: null });
  const b = await ok('decks.create', { name: 'Bulk B', language: null });
  const csv = new TextEncoder().encode('front,back,tags\nOne,1,num\nTwo,2,num\nThree,3,num\n');
  await ok('import.file', { name: 'n.csv', data: csv, deckId: a.id });
  const found = await ok('cards.find', { tag: 'num', state: 'new' });
  assert.equal(found.total, 3);
  const ids = found.rows.map((r: { id: number }) => r.id);
  assert.deepEqual(await ok('cards.bulk', { ids, action: { kind: 'tag', tag: 'maths' } }), { count: 3 });
  await ok('cards.bulk', { ids: ids.slice(0, 2), action: { kind: 'move', deckId: b.id } });
  assert.equal((await ok('cards.find', { deckId: b.id, tag: 'maths' })).total, 2);
  await ok('cards.bulk', { ids, action: { kind: 'suspend' } });
  assert.equal((await ok('cards.find', { tag: 'num', state: 'suspended' })).total, 3);
  const del = await ok('cards.bulk', { ids, action: { kind: 'delete' } });
  assert.equal(del.count, 3);
  assert.ok(existsSync(join(dir, 'backups', del.backup)), 'delete takes a backup first');
  assert.equal((await ok('cards.find', { tag: 'num' })).total, 0);
  for (const bad of [
    { ids, action: { kind: 'explode' } },
    { ids, action: { kind: 'tag', tag: '  ' } },
    { ids: ['1'], action: { kind: 'star' } },
  ]) {
    const r = await handle('cards.bulk', bad);
    assert.equal(!r.ok && r.error.code, 'invalid_input', JSON.stringify(bad));
  }
  const badState = await handle('cards.find', { state: 'forgotten' });
  assert.equal(!badState.ok && badState.error.code, 'invalid_input');
  const missing = await handle('cards.bulk', { ids, action: { kind: 'move', deckId: 99999 } });
  assert.equal(!missing.ok && missing.error.code, 'deck_not_found');
});

test('progress lists every deck with learned vs remaining, and the hardest cards can be studied', async () => {
  const p = await ok('progress.get');
  const decks = (await ok('state.get')).decks;
  assert.deepEqual(p.decks.map((d: { id: number }) => d.id).sort(), decks.map((d: { id: number }) => d.id).sort());
  for (const d of p.decks) assert.equal(d.learned + d.remaining, d.cards);
  assert.equal(p.retention.weeks.length, 12);
  assert.ok(Array.isArray(p.studyDays) && Array.isArray(p.hardest));
  await ok('study.choose', { source: { kind: 'hardest' } });
  assert.deepEqual((await ok('state.get')).source, { kind: 'hardest' });
});

test('the card editor warns about a card with the same front in the deck, and saves only safe formatting', async () => {
  const deck = await ok('decks.create', { name: 'Dupes', language: null });
  const { id } = await ok('cards.add', {
    deckId: deck.id,
    card: { front: 'Mitochondrion', back: 'powerhouse', explanation: '<a href="x">see</a> <b onclick="y()">this</b>' },
  });
  const same = await ok('cards.duplicates', { deckId: deck.id, front: '  **mitochondrion** ' });
  assert.deepEqual(same.matches, [{ id, front: 'Mitochondrion', back: 'powerhouse' }]);
  const self = await ok('cards.duplicates', { deckId: deck.id, front: 'Mitochondrion', excludeId: id });
  assert.deepEqual(self.matches, []);
  assert.deepEqual((await ok('cards.duplicates', { deckId: deck.id, front: 'Ribosome' })).matches, []);
  const bad = await handle('cards.duplicates', { deckId: 'x', front: 'a' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  assert.equal((await ok('cards.get', { id })).grammar, 'see <b>this</b>');
});

test('a recording made in the card editor is kept in media/ and plays from the card', async () => {
  const deck = await ok('decks.create', { name: 'Voice', language: 'de' });
  const opus = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);
  const { file } = await ok('media.record', { data: opus });
  assert.match(file, /^recording-.+\.weba$/);
  assert.ok(existsSync(join(dir, 'media', file)));
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'der Hund', back: 'dog', audio: file } });
  assert.equal((await ok('cards.get', { id })).audio, file);
  await ok('cards.update', { id, card: { front: 'der Hund', back: 'dog', audio: '' } });
  assert.equal((await ok('cards.get', { id })).audio, null, 'deleting the recording takes it off the card');

  const notAudio = await handle('media.record', { data: new TextEncoder().encode('<script>alert(1)</script>') });
  assert.equal(!notAudio.ok && notAudio.error.code, 'unsupported_media');
  const big = new Uint8Array(3 * 1024 * 1024);
  big.set(opus);
  const tooLong = await handle('media.record', { data: big });
  assert.equal(!tooLong.ok && tooLong.error.code, 'recording_too_long');
  const huge = await handle('media.record', { data: new Uint8Array(5 * 1024 * 1024) });
  assert.equal(!huge.ok && huge.error.code, 'invalid_input');
  const noBytes = await handle('media.record', { data: 'GkXfow==' });
  assert.equal(!noBytes.ok && noBytes.error.code, 'invalid_input');
});
