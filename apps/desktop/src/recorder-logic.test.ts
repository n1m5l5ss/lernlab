import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIC_ONLY, clock, micProblem, recorderOptions, recordingType, secondsLeft } from './recorder-logic';

test('records Opus in WebM (Chromium, Electron) or Ogg (Firefox), or offers no Record button', () => {
  assert.equal(
    recordingType((t) => t.startsWith('audio/webm')),
    'audio/webm;codecs=opus',
  );
  assert.equal(
    recordingType((t) => t.startsWith('audio/ogg')),
    'audio/ogg;codecs=opus',
  );
  assert.equal(
    recordingType(() => false),
    null,
  );
  assert.equal(recordingType(undefined), null, 'no MediaRecorder at all');
});

test('asks for the microphone only and records compressed audio', () => {
  assert.deepEqual(MIC_ONLY, { audio: true, video: false });
  assert.deepEqual(recorderOptions('audio/webm;codecs=opus'), {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 64_000,
  });
});

test('a recording stops by itself after 60 seconds', () => {
  assert.equal(secondsLeft(1000, 1000), 60);
  assert.equal(secondsLeft(1000, 1000 + 12_400), 48);
  assert.equal(secondsLeft(1000, 1000 + 60_000), 0);
  assert.equal(secondsLeft(1000, 1000 + 90_000), 0);
});

test('says why the microphone could not be used', () => {
  const err = (name: string) => Object.assign(new Error('x'), { name });
  assert.equal(micProblem(err('NotAllowedError')), 'denied');
  assert.equal(micProblem({ name: 'SecurityError' }), 'denied');
  assert.equal(micProblem(err('NotFoundError')), 'noMic');
  assert.equal(micProblem(err('NotReadableError')), 'noMic');
  assert.equal(micProblem(new TypeError('no mediaDevices')), 'failed');
  assert.equal(micProblem('boom'), 'failed');
});

test('a teach-back recording shows how long it has run, as minutes and seconds', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(59), '0:59');
  assert.equal(clock(60), '1:00');
  assert.equal(clock(185.9), '3:05');
  assert.equal(clock(-3), '0:00');
});
