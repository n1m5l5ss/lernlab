import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowRemoteMedia, isRemoteMedia, mediaSrc } from './remote-media';

test('internet media is blocked until the learner allows it; deck media always loads', () => {
  assert.equal(isRemoteMedia('https://example.com/a.png'), true);
  assert.equal(isRemoteMedia(' HTTP://example.com/a.mp3'), true);
  assert.equal(isRemoteMedia('map.png'), false);
  assert.equal(isRemoteMedia('https.png'), false);

  allowRemoteMedia(false);
  assert.equal(mediaSrc('https://example.com/a.png'), null);
  assert.match(mediaSrc('map.png')!, /map\.png$/);

  allowRemoteMedia(true);
  assert.equal(mediaSrc('https://example.com/a.png'), 'https://example.com/a.png');
  assert.match(mediaSrc('map.png')!, /map\.png$/);
  allowRemoteMedia(false);
});
