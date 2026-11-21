import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '@lernlab/core/learn';
import { COMBO_CAP, MAX_GAIN, SOUND, SOUNDS, createSfx, type SoundName, type Tone } from './sound-logic';

const names = Object.keys(SOUNDS) as SoundName[];
const tonesOf = (name: SoundName, combo?: number): Tone[] => (SOUNDS[name] as (c?: number) => Tone[])(combo);

test('there is a sound for right, wrong, combo and level up', () => {
  for (const name of ['right', 'wrong', 'levelUp'] as const) assert.ok(tonesOf(name).length > 0, name);
  // The combo raises the pitch of the right-answer sound, up to a cap.
  const pitch = (combo: number) => tonesOf('right', combo)[0].freq;
  assert.ok(pitch(2) > pitch(1));
  assert.ok(pitch(COMBO_CAP) > pitch(COMBO_CAP - 1));
  assert.equal(pitch(COMBO_CAP + 20), pitch(COMBO_CAP));
  assert.notDeepEqual(tonesOf('levelUp'), tonesOf('win'), 'a new level sounds different from the end of a block');
});

test('every tone is short and soft, within the sound tokens', () => {
  for (const name of names)
    for (const t of tonesOf(name, 99)) {
      assert.ok(t.ms > 0 && t.ms <= SOUND.maxMs, `${name}: ${t.ms} ms is longer than ${SOUND.maxMs} ms`);
      assert.ok(t.gain > 0 && t.gain <= MAX_GAIN, `${name}: gain ${t.gain} is louder than ${SOUND.levelDbfs} dBFS`);
      assert.ok(t.at >= 0 && t.freq > 0, name);
    }
});

test('a wrong answer is never a buzzer', () => {
  assert.ok(tonesOf('wrong').every((t) => t.wave === 'sine' || t.wave === 'triangle'));
  assert.ok(tonesOf('wrong')[1].freq < tonesOf('wrong')[0].freq, 'it falls gently');
});

test('the Sound setting mutes every sound', () => {
  let on = false;
  const played: Tone[][] = [];
  const sfx = createSfx(
    (tones) => played.push(tones),
    () => on,
  );
  for (const name of names) (sfx[name] as (c?: number) => void)(3);
  assert.equal(played.length, 0, 'muted: nothing plays');
  on = true;
  for (const name of names) (sfx[name] as (c?: number) => void)(3);
  assert.equal(played.length, names.length, 'on: each sound plays');
  assert.deepEqual(played[names.indexOf('right')], tonesOf('right', 3), 'the combo reaches the tones');
});

test('sound is off by default, as the design says', () => {
  assert.equal(SOUND.defaultOn, false);
  assert.equal(DEFAULT_SETTINGS.sound, SOUND.defaultOn);
});
