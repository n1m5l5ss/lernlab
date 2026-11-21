import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../../../locales/en.json';
import { HIDDEN_ARG, linuxAutostartEntry, reminderPrefsOf, reminderText, startedAtLogin } from './reminder-policy';

test('reminder settings are read from the state and from saved settings', () => {
  const s = { reminder: true, reminderTime: '07:30', launchAtLogin: false };
  assert.deepEqual(reminderPrefsOf('state.get', { settings: s }), {
    enabled: true,
    time: '07:30',
    launchAtLogin: false,
  });
  assert.deepEqual(reminderPrefsOf('settings.save', { ...s, launchAtLogin: true }), {
    enabled: true,
    time: '07:30',
    launchAtLogin: true,
  });
  assert.equal(reminderPrefsOf('decks.list', s), null);
  assert.equal(reminderPrefsOf('state.get', null), null);
  assert.equal(reminderPrefsOf('settings.save', { theme: 'dark' }), null);
});

test('a start at login opens minimised; a normal start does not', () => {
  assert.equal(startedAtLogin(['/opt/LernLab/lernlab', HIDDEN_ARG]), true);
  assert.equal(startedAtLogin(['/opt/LernLab/lernlab']), false);
  assert.equal(startedAtLogin(['LernLab'], true), true); // macOS says so itself
});

test('the Linux autostart entry starts LernLab hidden and quotes the path', () => {
  const entry = linuxAutostartEntry('/home/a b/LernLab "x".AppImage');
  assert.match(entry, /^\[Desktop Entry\]\n/);
  assert.match(entry, /\nExec="\/home\/a b\/LernLab \\"x\\".AppImage" --hidden\n/);
  assert.match(entry, /\nType=Application\n/);
});

test('the notification text comes from the language file and takes turns', () => {
  const n = en.settings.reminders.notification;
  const a = reminderText('en', 0);
  assert.equal(a.title, n.title);
  assert.ok(n.bodies.includes(a.body));
  assert.notEqual(reminderText('en', 1).body, a.body);
  assert.equal(reminderText('xx', n.bodies.length).body, a.body); // unknown language → English
  assert.equal(reminderText(undefined, -1).body, n.bodies[1]);
});

test('with an if-then plan, the notification says your own sentence', () => {
  const plan = { after: 'finish dinner', minutes: 10, backup: '' };
  assert.deepEqual(reminderText('en', 0, plan), {
    title: en.settings.reminders.notification.title,
    body: "After I finish dinner, I'll study for 10 minutes.",
  });
  assert.equal(reminderText('en', 3, plan).body, reminderText('en', 0, plan).body, 'the same sentence every day');
  assert.equal(
    reminderText('xx', 0, { after: 'lunch', minutes: 5, backup: "I'm tired" }).body,
    "After I lunch, I'll study for 5 minutes. If I'm tired, I'll do one 5-minute session.",
  );
  assert.ok(en.settings.reminders.notification.bodies.includes(reminderText('en', 0, null).body), 'no plan: as before');
});

test('reminder wording is friendly: no guilt, loss or pressure', () => {
  const n = en.settings.reminders;
  const words = [n.notification.title, ...n.notification.bodies, n.daily, n.dailyHint].join(' ').toLowerCase();
  for (const bad of ['streak', 'lose', 'lost', 'miss', 'fail', 'behind', "don't forget", 'should', 'must', 'sad'])
    assert.ok(!words.includes(bad), `reminder text should not say "${bad}"`);
});
