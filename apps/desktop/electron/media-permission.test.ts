import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowPermission } from './media-permission';

const APP = 'file:///opt/LernLab/resources/app/dist/index.html';
const isApp = (url: string) => url.split('#')[0] === APP;

test('the app page may use the microphone', () => {
  assert.equal(allowPermission('media', { mediaTypes: ['audio'], requestingUrl: `${APP}#/browse` }, isApp), true);
});

test('never the camera, never another page, never another permission', () => {
  assert.equal(allowPermission('media', { mediaTypes: ['video'], requestingUrl: APP }, isApp), false);
  assert.equal(allowPermission('media', { mediaTypes: ['audio', 'video'], requestingUrl: APP }, isApp), false);
  assert.equal(allowPermission('media', { mediaTypes: [], requestingUrl: APP }, isApp), false);
  assert.equal(
    allowPermission('media', { mediaTypes: ['audio'], requestingUrl: 'https://example.com/' }, isApp),
    false,
  );
  assert.equal(allowPermission('media', { mediaTypes: ['audio'] }, isApp), false);
  for (const p of ['geolocation', 'notifications', 'display-capture', 'clipboard-read', 'openExternal'])
    assert.equal(allowPermission(p, { mediaTypes: ['audio'], requestingUrl: APP }, isApp), false, p);
});
