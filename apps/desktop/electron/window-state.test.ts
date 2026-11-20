import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SIZE, MIN_SIZE, restoreWindow } from './window-state';

const laptop = { x: 0, y: 0, width: 1440, height: 875 };
const external = { x: 1440, y: 0, width: 2560, height: 1415 };

test('the first start uses the default size, centred', () => {
  assert.deepEqual(restoreWindow(undefined, [laptop]), { ...DEFAULT_SIZE, maximized: false });
  assert.deepEqual(restoreWindow({ bounds: { x: 'a' } }, [laptop]), { ...DEFAULT_SIZE, maximized: false });
});

test('the saved size and position come back', () => {
  const saved = { bounds: { x: 100, y: 50, width: 1000, height: 700 }, maximized: false };
  assert.deepEqual(restoreWindow(saved, [laptop]), { x: 100, y: 50, width: 1000, height: 700, maximized: false });
  assert.equal(restoreWindow({ ...saved, maximized: true }, [laptop]).maximized, true);
});

test('a window on a monitor that was unplugged opens on a remaining screen', () => {
  const saved = { bounds: { x: 2000, y: 100, width: 1600, height: 1000 }, maximized: false };
  assert.deepEqual(restoreWindow(saved, [laptop, external]), {
    x: 2000,
    y: 100,
    width: 1600,
    height: 1000,
    maximized: false,
  });
  const r = restoreWindow(saved, [laptop]);
  assert.equal(r.x, undefined);
  assert.equal(r.y, undefined);
  assert.ok(r.width <= laptop.width && r.height <= laptop.height);
});

test('a window whose title bar is above the screen is moved back', () => {
  const r = restoreWindow({ bounds: { x: 100, y: -500, width: 1000, height: 700 } }, [laptop]);
  assert.equal(r.y, undefined);
});

test('sizes never go below the minimum', () => {
  const r = restoreWindow({ bounds: { x: 10, y: 10, width: 200, height: 100 } }, [laptop]);
  assert.equal(r.width, MIN_SIZE.width);
  assert.equal(r.height, MIN_SIZE.height);
});
