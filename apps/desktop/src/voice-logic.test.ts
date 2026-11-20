import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampRate, localeFor, pickVoice, prefFor, voicesFor, type VoiceLike } from './voice-logic';

const v = (name: string, lang: string): VoiceLike => ({ name, lang, voiceURI: `uri:${name}` });
const VOICES = [
  v('Samantha', 'en-US'),
  v('Markus', 'de-DE'),
  v('Anna', 'de-DE'),
  v('Swiss Hans', 'de-CH'),
  v('Thomas', 'fr_FR'),
  v('Amélie', 'fr-CA'),
];

test('a bare language code asks for its usual region', () => {
  assert.equal(localeFor('de'), 'de-DE');
  assert.equal(localeFor('pt'), 'pt-BR');
  assert.equal(localeFor('de-AT'), 'de-AT');
  assert.equal(localeFor('xx'), 'xx');
});

test('voices for a language: exact locale first, then other regions, underscores and case ignored', () => {
  assert.deepEqual(
    voicesFor('de', VOICES).map((x) => x.name),
    ['Markus', 'Anna', 'Swiss Hans'],
  );
  assert.deepEqual(
    voicesFor('fr', VOICES).map((x) => x.name),
    ['Thomas', 'Amélie'],
  );
  assert.deepEqual(voicesFor('ja', VOICES), []);
  assert.deepEqual(voicesFor(null, VOICES), []);
  assert.deepEqual(voicesFor('', VOICES), []);
});

test("the deck's chosen voice wins when it is installed and speaks the language", () => {
  assert.equal(pickVoice('de', VOICES, 'uri:Swiss Hans')?.name, 'Swiss Hans');
  assert.equal(pickVoice('de', VOICES, 'Markus')?.name, 'Markus', 'a voice name works too');
});

test('a chosen voice that is gone or speaks another language falls back to the best match', () => {
  assert.equal(pickVoice('de', VOICES, 'uri:Removed')?.name, 'Anna', 'natural-sounding voice in de-DE');
  assert.equal(pickVoice('de', VOICES, 'uri:Samantha')?.name, 'Anna');
  assert.equal(pickVoice('de', [v('Markus', 'de-DE')])?.name, 'Markus');
});

test('no voice in the exact region: any voice for the language', () => {
  assert.equal(pickVoice('de', [v('Swiss Hans', 'de-CH'), v('Samantha', 'en-US')])?.name, 'Swiss Hans');
  assert.equal(pickVoice('fr-BE', VOICES)?.name, 'Thomas');
});

test('no voice for the language at all: none, never a voice in another language', () => {
  assert.equal(pickVoice('ja', VOICES), null);
  assert.equal(pickVoice('ja', VOICES, 'uri:Samantha'), null);
  assert.equal(pickVoice('de', []), null);
  assert.equal(pickVoice(null, VOICES), null);
});

test('speed stays between 0.5 and 1.5, odd values become normal speed', () => {
  assert.equal(clampRate(0.1), 0.5);
  assert.equal(clampRate(3), 1.5);
  assert.equal(clampRate('0.8'), 0.8);
  assert.equal(clampRate(undefined), 1);
  assert.equal(clampRate('fast'), 1);
  assert.equal(clampRate(-1), 1);
});

test("a card uses its own deck's choices; other lines use the first deck that chose any", () => {
  const prefs = { 1: {}, 2: { voice: 'uri:Anna', rate: 0.8 }, 3: { rate: 1.2 } };
  assert.deepEqual(prefFor(prefs, 3), { rate: 1.2 });
  assert.deepEqual(prefFor(prefs, 1), {});
  assert.deepEqual(prefFor(prefs, null), { voice: 'uri:Anna', rate: 0.8 });
  assert.deepEqual(prefFor(prefs, 9), { voice: 'uri:Anna', rate: 0.8 });
  assert.deepEqual(prefFor({}), {});
});
