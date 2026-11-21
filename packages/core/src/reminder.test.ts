// The daily reminder's timing, in a time zone with daylight saving.
process.env.TZ = 'Europe/Berlin';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanReminderTime, localDate, reminderDue, reminderMoment, DEFAULT_REMINDER_TIME } from './reminder';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);
const on = { enabled: true, time: '19:00' };

test('a reminder time must be HH:MM in 24-hour time', () => {
  assert.equal(cleanReminderTime('07:30'), '07:30');
  assert.equal(cleanReminderTime('23:59'), '23:59');
  for (const bad of ['24:00', '7:30', '19:60', '', 'soon', 1900, null, undefined])
    assert.equal(cleanReminderTime(bad), DEFAULT_REMINDER_TIME);
});

test('the reminder is off by default and shows only when its time has come', () => {
  assert.equal(reminderDue({ ...on, enabled: false }, at(2026, 11, 20, 19, 0)), false);
  assert.equal(reminderDue(on, at(2026, 11, 20, 18, 59)), false);
  assert.equal(reminderDue(on, at(2026, 11, 20, 19, 0)), true);
  assert.equal(reminderDue(on, at(2026, 11, 20, 19, 59)), true);
});

test('it shows once per day, and not hours late after the computer slept', () => {
  assert.equal(reminderDue({ ...on, lastShown: '2026-11-20' }, at(2026, 11, 20, 19, 5)), false);
  assert.equal(reminderDue({ ...on, lastShown: '2026-11-19' }, at(2026, 11, 20, 19, 5)), true);
  assert.equal(reminderDue(on, at(2026, 11, 20, 20, 0)), false);
  assert.equal(reminderDue(on, at(2026, 11, 20, 23, 0)), false);
});

test('late-night and early-morning times use the calendar date', () => {
  assert.equal(reminderDue({ enabled: true, time: '00:15' }, at(2026, 11, 21, 0, 20)), true);
  assert.equal(localDate(at(2026, 11, 21, 0, 20)), '2026-11-21');
  assert.equal(reminderDue({ enabled: true, time: '23:30' }, at(2026, 11, 21, 0, 10)), false);
});

test('daylight saving: a time in the spring gap moves forward, the autumn repeat shows once', () => {
  // 29 March 2026: 02:00 becomes 03:00 in Berlin. 02:30 does not exist, so it fires at 03:30.
  const spring = reminderMoment('02:30', at(2026, 3, 29, 12));
  assert.equal(spring.getHours(), 3);
  assert.equal(spring.getMinutes(), 30);
  assert.equal(reminderDue({ enabled: true, time: '02:30' }, at(2026, 3, 29, 3, 35)), true);
  // An ordinary evening time is unaffected and the moment is in summer time.
  assert.equal(reminderMoment('19:00', at(2026, 3, 29, 12)).toISOString(), '2026-03-29T17:00:00.000Z');
  // 25 October 2026: 03:00 goes back to 02:00, so 02:30 happens twice; the first one counts.
  const autumn = reminderMoment('02:30', at(2026, 10, 25, 12));
  assert.equal(autumn.toISOString(), '2026-10-25T00:30:00.000Z');
  const second = new Date('2026-10-25T01:30:00.000Z'); // the second 02:30
  assert.equal(reminderDue({ enabled: true, time: '02:30', lastShown: localDate(autumn) }, second), false);
  assert.equal(reminderMoment('19:00', at(2026, 10, 25, 12)).toISOString(), '2026-10-25T18:00:00.000Z');
});
