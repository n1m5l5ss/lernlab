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
  const anki = await ok('decks.export', { id: deck.id, format: 'apkg' });
  assert.equal(anki.name.endsWith('.apkg') && anki.data[0], 0x50, 'an Anki package is a zip');
  const badFormat = await handle('decks.export', { id: deck.id, format: 'docx' });
  assert.equal(!badFormat.ok && badFormat.error.code, 'invalid_input');
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

test('the card editor saves a numeric card with its tolerance, and turning it basic drops the tolerance', async () => {
  const deck = await ok('decks.create', { name: 'Physics', language: null });
  const card = { front: 'g on Earth?', back: '9.81 m/s^2', type: 'numeric', tolerance: '0.05' };
  const { id } = await ok('cards.add', { deckId: deck.id, card });
  const saved = await ok('cards.get', { id });
  assert.equal(saved.kind, 'numeric');
  assert.equal(saved.extra.tolerance, '0.05');
  await ok('cards.update', { id, card: { ...card, tolerance: '1%' } });
  assert.equal((await ok('cards.get', { id })).extra.tolerance, '1%');
  await ok('cards.update', { id, card: { ...card, type: 'basic', tolerance: '' } });
  const basic = await ok('cards.get', { id });
  assert.equal(basic.kind, 'card');
  assert.ok(!('tolerance' in basic.extra));
});

test('the card editor saves a code card with its code and language, and turning it basic drops them', async () => {
  const deck = await ok('decks.create', { name: 'Python', language: null });
  const card = { front: 'Output?', back: '3', type: 'code', code: 'print(1 + 2)\n', codeLang: 'python' };
  const { id } = await ok('cards.add', { deckId: deck.id, card });
  const saved = await ok('cards.get', { id });
  assert.equal(saved.kind, 'code');
  assert.deepEqual([saved.extra.code, saved.extra.codeLang, saved.meaning], ['print(1 + 2)', 'python', '3']);
  await ok('cards.update', { id, card: { ...card, type: 'basic', code: '', codeLang: '' } });
  const basic = await ok('cards.get', { id });
  assert.equal(basic.kind, 'card');
  assert.ok(!('code' in basic.extra) && !('codeLang' in basic.extra));
});

test('the card editor saves one occlusion card per box; editing one keeps its siblings, the mode is shared', async () => {
  const deck = await ok('decks.create', { name: 'Anatomy', language: null });
  const base = { front: 'Label the heart', type: 'occlusion', image: 'heart.png', occlusionGroup: 'g1' };
  const boxes = [
    ['Aorta', '0.4,0.05,0.2,0.1'],
    ['Left ventricle', '0.55,0.6,0.25,0.2'],
  ];
  const ids: number[] = [];
  for (const [back, occlusion] of boxes)
    ids.push((await ok('cards.add', { deckId: deck.id, card: { ...base, back, occlusion, occlusionMode: 'one' } })).id);
  const first = await ok('cards.get', { id: ids[0] });
  assert.equal(first.kind, 'occlusion');
  assert.deepEqual(
    first.occlusionBoxes.map((b: { label: string }) => b.label),
    ['Aorta', 'Left ventricle'],
  );
  await ok('cards.update', {
    id: ids[0],
    card: { ...base, back: 'Aortic arch', occlusion: '0.3,0.05,0.3,0.1', occlusionMode: 'all' },
  });
  const second = await ok('cards.get', { id: ids[1] });
  assert.deepEqual([second.meaning, second.extra.occlusion], ['Left ventricle', '0.55,0.6,0.25,0.2'], 'untouched');
  assert.equal(second.extra.occlusionMode, 'all', 'the mode is set for the whole group');
  assert.equal(second.occlusionBoxes[0].label, 'Aortic arch');
});

test('the card editor saves, keeps and clears question variants', async () => {
  const deck = await ok('decks.create', { name: 'Pharmacology', language: null });
  const card = { front: 'Beta blocker', back: 'slows the heart' };
  const { id } = await ok('cards.add', { deckId: deck.id, card: { ...card, variants: 'apply: A <b>patient</b>?' } });
  assert.equal((await ok('cards.get', { id })).extra.variants, 'apply: A patient?');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.variants, 'apply: A patient?', 'kept when the field is not sent');
  await ok('cards.update', { id, card: { ...card, variants: '' } });
  assert.ok(!('variants' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('the card editor saves, keeps and clears what a card requires', async () => {
  const deck = await ok('decks.create', { name: 'Calculus', language: null });
  const card = { front: 'Chain rule', back: 'outer times inner' };
  const { id } = await ok('cards.add', {
    deckId: deck.id,
    card: { ...card, requires: '<b>Derivative</b>|#functions|' },
  });
  assert.equal((await ok('cards.get', { id })).extra.requires, 'Derivative|#functions');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal(
    (await ok('cards.get', { id })).extra.requires,
    'Derivative|#functions',
    'kept when the field is not sent',
  );
  await ok('cards.update', { id, card: { ...card, requires: '' } });
  assert.ok(!('requires' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('the card editor saves, keeps and clears corrections for wrong choices', async () => {
  const deck = await ok('decks.create', { name: 'Cloud quiz', language: null });
  const card = { front: 'Serverless?', back: '', type: 'mcq', choices: 'EC2|Lambda', correct: '2' };
  const { id } = await ok('cards.add', { deckId: deck.id, card: { ...card, corrections: 'Many think <b>so</b>|x' } });
  assert.equal((await ok('cards.get', { id })).extra.corrections, 'Many think so');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.corrections, 'Many think so', 'kept when the field is not sent');
  await ok('cards.update', { id, card: { ...card, corrections: '' } });
  assert.ok(!('corrections' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('the card editor saves, keeps and clears a mnemonic, and a studied card carries its run', async () => {
  const deck = await ok('decks.create', { name: 'Planets', language: null });
  const card = { front: 'Order of the planets?', back: 'Mercury, Venus, Earth' };
  const { id } = await ok('cards.add', {
    deckId: deck.id,
    card: { ...card, mnemonic: '<b>My Very</b> Educated Mother' },
  });
  assert.equal((await ok('cards.get', { id })).extra.mnemonic, 'My Very Educated Mother');
  await ok('cards.update', { id, card });
  assert.equal((await ok('cards.get', { id })).extra.mnemonic, 'My Very Educated Mother', 'kept when not sent');
  await ok('cards.update', { id, card: { ...card, mnemonic: '' } });
  assert.ok(!('mnemonic' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('the card editor saves key terms from ==term== in the back and clears them with the marks', async () => {
  const deck = await ok('decks.create', { name: 'Cells', language: null });
  const card = { front: 'What makes ATP?', back: 'The ==mitochondrion== does' };
  const { id } = await ok('cards.add', { deckId: deck.id, card });
  const saved = await ok('cards.get', { id });
  assert.deepEqual([saved.meaning, saved.extra.keyTerms], ['The mitochondrion does', 'mitochondrion']);
  await ok('cards.update', { id, card: { starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.keyTerms, 'mitochondrion', 'kept when the card is not edited');
  await ok('cards.update', { id, card: { ...card, back: 'The mitochondrion does' } });
  assert.ok(!('keyTerms' in (await ok('cards.get', { id })).extra), 'cleared');
});

test('the card editor saves, keeps and clears key points; attempts may say "easy"', async () => {
  const deck = await ok('decks.create', { name: 'Why', language: null });
  const card = { front: 'Why seasons?', back: 'Tilt', type: 'explain' };
  const { id } = await ok('cards.add', { deckId: deck.id, card: { ...card, keyPoints: '<b>Tilt</b>|Angle' } });
  assert.equal((await ok('cards.get', { id })).extra.keyPoints, 'Tilt|Angle');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.keyPoints, 'Tilt|Angle', 'kept when the field is not sent');
  await ok('cards.update', { id, card: { ...card, type: 'basic' } });
  assert.ok(!('keyPoints' in (await ok('cards.get', { id })).extra), 'a basic card has none');
  const attempt = { sessionId: 's', itemId: id, format: 'flip', correct: true, responseMs: 1, xp: 1 };
  const wrong = await handle('attempt.record', { ...attempt, easy: 'yes' }); // recording one would study today
  assert.equal(!wrong.ok && wrong.error.code, 'invalid_input');
});

test('the card editor saves, keeps and clears worked steps', async () => {
  const deck = await ok('decks.create', { name: 'Algebra', language: null });
  const card = { front: 'Solve 2x + 3 = 11', back: 'x = 4', type: 'worked' };
  const steps = 'Subtract 3 :: <b>2x = 8</b>|x = 4';
  const { id } = await ok('cards.add', { deckId: deck.id, card: { ...card, workedSteps: steps } });
  assert.equal((await ok('cards.get', { id })).extra.workedSteps, 'Subtract 3 :: 2x = 8|x = 4');
  await ok('cards.update', { id, card: { ...card, starred: true } });
  assert.equal((await ok('cards.get', { id })).extra.workedSteps, 'Subtract 3 :: 2x = 8|x = 4', 'kept');
  await ok('cards.update', { id, card: { ...card, type: 'basic' } });
  assert.ok(!('workedSteps' in (await ok('cards.get', { id })).extra), 'a basic card has none');
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

test('internet media in decks is off until the learner turns it on (#177)', async () => {
  assert.equal((await ok('state.get')).settings.remoteMedia, false);
  assert.equal((await ok('settings.save', { remoteMedia: 'yes' })).remoteMedia, false);
  assert.equal((await ok('settings.save', { remoteMedia: true })).remoteMedia, true);
  assert.equal((await ok('settings.save', { remoteMedia: false })).remoteMedia, false);
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
  assert.deepEqual(before, {
    enabled: true,
    time: '08:30',
    launchAtLogin: false,
    language: 'en',
    plan: null,
    studiedToday: false,
    morning: null,
  });
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
  // The sleep rhythm (#217) is off by default; on, the reminder knows when to offer the morning check.
  const sleepy = await ok('settings.save', { sleepBridge: true, morningTime: '9 am' });
  assert.deepEqual([sleepy.sleepBridge, sleepy.morningTime], [true, '08:00']);
  assert.deepEqual((await ok('reminder.status')).morning, { time: '08:00', cards: 0 });
  assert.equal((await ok('settings.save', { sleepBridge: 'yes' })).sleepBridge, false);
  assert.equal((await ok('reminder.status')).studiedToday, true);
  await ok('settings.save', { reminder: false });
});

test('the if-then study plan is plain text, checked, and goes into the reminder', async () => {
  const d = (await ok('state.get')).settings;
  assert.deepEqual([d.planAfter, d.planMinutes, d.planBackup, d.habitNote], ['', 5, '', true]);
  const s = await ok('settings.save', {
    planAfter: '  <b>finish dinner</b>. ',
    planMinutes: '10',
    planBackup: "I'm tired\n" + 'x'.repeat(300),
    habitNote: false,
  });
  assert.equal(s.planAfter, 'bfinish dinner/b');
  assert.equal(s.planMinutes, 10);
  assert.ok(s.planBackup.startsWith("I'm tired x") && s.planBackup.length <= 80);
  assert.equal(s.habitNote, false);
  const bad = await ok('settings.save', { planAfter: { evil: 1 }, planMinutes: 7, planBackup: 3, habitNote: 'no' });
  assert.deepEqual([bad.planAfter, bad.planMinutes, bad.planBackup, bad.habitNote], ['', 5, '', true]);
  await ok('settings.save', { planAfter: 'lunch', planMinutes: 20, planBackup: '' });
  assert.deepEqual((await ok('reminder.status')).plan, { after: 'lunch', minutes: 20, backup: '' });
  await ok('settings.save', { planAfter: '', planMinutes: 5 });
});

test('LernLab suggests the hour you usually study, from local sessions only', async () => {
  assert.deepEqual(await ok('plan.suggestTime'), { time: null });
  for (const [i, h] of [19, 19, 19].entries()) {
    const start = new Date(2026, 10, 2 + i, h, 5);
    await ok('session.finish', {
      sessionId: `usual-${i}`,
      length: 'mini',
      seconds: 60,
      answers: 0,
      correct: 0,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: start.toISOString(),
    });
  }
  assert.equal((await ok('plan.suggestTime')).time, '19:00');
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

test('an exam is drawn from a deck with its settings, handed in once, and scored by topic', async () => {
  const deck = await ok('decks.create', { name: 'Exam deck', language: null });
  for (const [front, back] of [
    ['Object storage', 'S3'],
    ['Block storage', 'EBS'],
    ['Users', 'IAM'],
    ['Functions', 'Lambda'],
  ])
    await ok('cards.add', { deckId: deck.id, card: { front, back, tags: front === 'Users' ? 'security' : 'storage' } });
  const saved = await ok('decks.update', {
    id: deck.id,
    patch: { settings: { exam: { questions: 3, minutes: 0, passMark: '60', junk: 1 } } },
  });
  assert.deepEqual(saved.settings.exam, { questions: 3, minutes: 1, passMark: 60 }, 'checked and clamped');
  const exam = await ok('exam.start', { deckId: deck.id });
  assert.equal(exam.questions.length, 3);
  assert.equal(exam.settings.passMark, 60);
  const answers = exam.questions.map((q: { itemId: number; correct: number[] }) => ({
    itemId: q.itemId,
    chosen: q.correct,
    ms: 2000,
  }));
  const score = await ok('exam.submit', { examId: exam.id, mode: 'timed', answers });
  assert.equal(score.correct, 3);
  assert.equal(score.passed, true);
  assert.equal(score.reviewed, 0, 'timed mode is practice');
  assert.ok(score.topics.length >= 1);
  const twice = await handle('exam.submit', { examId: exam.id, mode: 'timed', answers });
  assert.equal(!twice.ok && twice.error.code, 'exam_not_found', 'an exam is handed in once');
  const missing = await handle('exam.start', { deckId: 9999 });
  assert.equal(!missing.ok && missing.error.code, 'deck_not_found');
  const bad = await handle('exam.submit', {
    examId: 'x',
    mode: 'timed',
    answers: [{ itemId: 1, chosen: ['a'], ms: 1 }],
  });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const noMode = await handle('exam.submit', { examId: 'x', mode: 'cram', answers: [] });
  assert.equal(!noMode.ok && noMode.error.code, 'invalid_input');
});

test('a tutor-mode exam counts toward your reviews; question cards are graded like a session', async () => {
  const deck = await ok('decks.create', { name: 'Tutor deck', language: null });
  await ok('cards.add', {
    deckId: deck.id,
    card: { type: 'mcq', front: 'Which is object storage?', choices: 'S3|EBS|EFS', correct: '1' },
  });
  const exam = await ok('exam.start', { deckId: deck.id });
  assert.equal(exam.questions.length, 1);
  const [q] = exam.questions;
  const score = await ok('exam.submit', {
    examId: exam.id,
    mode: 'tutor',
    answers: [{ itemId: q.itemId, chosen: q.correct, ms: 3000 }],
  });
  assert.equal(score.reviewed, 1, 'the answer scheduled the card');
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
  // This week's goal (#214): the decks' card goals added up, and 3 to 7 sessions.
  assert.equal(
    p.week.cards.target,
    p.decks.reduce((n: number, d: { week: { target: number } }) => n + d.week.target, 0),
  );
  assert.ok(p.week.sessions.target >= 3 && p.week.sessions.target <= 7);
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

test('an answer carries the level of the question asked, and only a known level', async () => {
  const deck = await ok('decks.create', { name: 'Levels', language: null });
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'Statin', back: 'atorvastatin' } });
  const answer = { sessionId: 'lv', itemId: id, format: 'typed', correct: true, responseMs: 900, xp: 1 };
  await ok('attempt.record', { ...answer, level: 'apply' });
  const bad = await handle('attempt.record', { ...answer, level: 'synthesis' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
});

test('calm mode is off by default, saved as a plain yes or no, and XP is still counted while it is on (#216)', async () => {
  assert.equal((await ok('state.get')).settings.calm, false);
  assert.equal((await ok('settings.save', { calm: 'yes' })).calm, false);
  assert.equal((await ok('settings.save', { calm: true })).calm, true);
  const deck = await ok('decks.create', { name: 'Calm', language: null });
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'Calm?', back: 'Yes' } });
  const before = (await ok('state.get')).totalXp;
  await ok('attempt.record', {
    sessionId: 'calm',
    itemId: id,
    format: 'typed',
    correct: true,
    responseMs: 900,
    xp: 15,
  });
  assert.equal((await ok('state.get')).totalXp, before + 15);
  assert.equal((await ok('settings.save', { calm: false })).calm, false);
});

test('how sure you were is saved with your answer, 1 to 5 only, and the rating can be turned off (#205)', async () => {
  assert.equal((await ok('state.get')).settings.confidence, true, 'on by default');
  assert.equal((await ok('settings.save', { confidence: false })).confidence, false);
  assert.equal((await ok('settings.save', { confidence: 'no' })).confidence, true);
  const deck = await ok('decks.create', { name: 'Sure', language: null });
  const { id } = await ok('cards.add', { deckId: deck.id, card: { front: 'Mitosis', back: 'cell division' } });
  await ok('attempt.record', { sessionId: 'cf', itemId: id, format: 'typed', correct: false, responseMs: 900, xp: 1 });
  assert.deepEqual(await ok('attempt.confidence', { sessionId: 'cf', itemId: id, confidence: 5 }), { ok: true });
  for (const confidence of [0, 6, 2.5, '5', null]) {
    const bad = await handle('attempt.confidence', { sessionId: 'cf', itemId: id, confidence });
    assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  }
});

test('"Will you know this tomorrow?" answers are yes, unsure or no for known cards (#205)', async () => {
  const deck = await ok('decks.create', { name: 'Tomorrow', language: null });
  const { id } = await ok('cards.add', {
    deckId: deck.id,
    card: { front: 'Osmosis', back: 'water through a membrane' },
  });
  assert.deepEqual(await ok('tomorrow.save', { answers: [{ itemId: id, answer: 'unsure' }] }), { cards: 1 });
  for (const answers of [[{ itemId: id, answer: 'maybe' }], [{ itemId: 'x', answer: 'yes' }], 'yes']) {
    const bad = await handle('tomorrow.save', { answers });
    assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  }
  const tooMany = Array.from({ length: 101 }, () => ({ itemId: id, answer: 'yes' }));
  assert.equal((await handle('tomorrow.save', { answers: tooMany })).ok, false);
  const fin = await ok('session.finish', {
    sessionId: 'tm',
    length: 'mini',
    seconds: 60,
    answers: 1,
    correct: 1,
    bossWon: null,
    bestGenderCombo: 0,
    perfectBlocks: 0,
    startedAt: new Date().toISOString(),
  });
  assert.equal(fin.tomorrowCheck, null, 'nothing to report on the day of the check');
  assert.deepEqual(fin.patterns, { lines: [], next: null }, 'an ordinary session has no patterns to name (#213)');
});

test('three mix-ups of two cards bring a compare-card offer; the card is added once and survives an edit', async () => {
  const deck = await ok('decks.create', { name: 'Mix-ups', language: null });
  const a = await ok('cards.add', { deckId: deck.id, card: { front: 'affect', back: 'to influence' } });
  const b = await ok('cards.add', { deckId: deck.id, card: { front: 'effect', back: 'a result' } });
  const finish = () =>
    ok('session.finish', {
      sessionId: 'mx',
      length: 'mini',
      seconds: 60,
      answers: 3,
      correct: 0,
      bossWon: null,
      bestGenderCombo: 0,
      perfectBlocks: 0,
      startedAt: new Date().toISOString(),
    });
  const wrong = { sessionId: 'mx', itemId: a.id, format: 'mc', correct: false, responseMs: 1, xp: 0, practice: true };
  for (let k = 0; k < 2; k++) await ok('attempt.record', { ...wrong, given: 'a result' });
  assert.equal((await finish()).twinOffer, null);
  await ok('attempt.record', { ...wrong, given: 'a result' });
  const offer = (await finish()).twinOffer;
  // The pair is stored by card id, so which card is `a` depends on the random ids.
  assert.deepEqual([offer?.count, ...[offer?.a.front, offer?.b.front].sort()], [3, 'affect', 'effect']);
  const bad = await handle('confusions.twin', { a: a.id, b: a.id, answer: '' });
  assert.equal(!bad.ok && bad.error.code, 'invalid_input');
  const { id } = await ok('confusions.twin', { a: a.id, b: b.id, answer: 'Both are about change.' });
  assert.equal((await ok('confusions.twin', { a: b.id, b: a.id, answer: 'x' })).id, id);
  assert.equal((await finish()).twinOffer, null, 'offered once');
  const card = await ok('cards.get', { id });
  assert.deepEqual([card.target, card.extra.twin].sort(), ['affect: to influence', 'effect: a result']);
  await ok('cards.update', { id, card: { front: card.target, back: 'Both change things.', type: 'basic' } });
  assert.equal((await ok('cards.get', { id })).extra.twin, card.extra.twin, 'kept by the card editor');
  assert.deepEqual(await ok('confusions.dismiss', { a: a.id, b: b.id }), { ok: true });
});

test('teach-back: a mastered tag is offered, gives its key points, and its missed cards make a practice session', async () => {
  const deck = await ok('decks.create', { name: 'Teach', language: null });
  const ids: number[] = [];
  for (const [front, back] of [
    ['What makes ATP?', 'The mitochondrion'],
    ['What builds proteins?', 'The ribosome'],
    ['What holds DNA?', 'The nucleus'],
  ])
    ids.push((await ok('cards.add', { deckId: deck.id, card: { front, back, tags: 'organelles' } })).id);
  assert.deepEqual(await ok('teachback.topics'), [], 'not mastered yet');
  for (const itemId of ids)
    await ok('attempt.record', { sessionId: 'tb', itemId, format: 'typed', correct: true, responseMs: 1, xp: 0 });
  assert.deepEqual(await ok('teachback.topics'), [{ tag: 'organelles', cards: 3 }]);
  const points = await ok('teachback.points', { tag: 'organelles' });
  assert.deepEqual(
    points.map((p: { text: string }) => p.text),
    ['The mitochondrion', 'The ribosome', 'The nucleus'],
  );
  const plan = await ok('teachback.practice', { ids: [ids[1]] });
  assert.equal(plan.practice, true);
  assert.deepEqual(Object.keys(plan.items).map(Number), [ids[1]]);
  const none = await handle('teachback.practice', { ids: [] });
  assert.equal(!none.ok && none.error.code, 'invalid_input');
});

test('"say a few answers aloud" is on by default and can be turned off', async () => {
  assert.equal((await ok('state.get')).settings.sayAloud, true);
  assert.equal((await ok('settings.save', { sayAloud: false })).sayAloud, false);
  assert.equal((await ok('settings.save', { sayAloud: 'yes' })).sayAloud, true);
  assert.equal((await ok('state.get')).settings.actOut, true, '"act it out" too');
  assert.equal((await ok('settings.save', { actOut: false })).actOut, false);
});
