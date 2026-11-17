import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAppViewport } from '../src/hooks/useAppViewport.js';

const editing = { matches: () => true };
test('uses the initially visible browser height', () => {
  assert.deepEqual(getAppViewport({ height: 740, offsetTop: 0, scale: 1 }, 800, null),
    { height: 740, top: 0, keyboardOpen: false });
});
test('follows keyboard resizing and panning and removes bottom inset', () => {
  assert.deepEqual(getAppViewport({ height: 420, offsetTop: 25, scale: 1 }, 800, editing),
    { height: 420, top: 25, keyboardOpen: true });
});
test('restores the height and safe area when the keyboard closes', () => {
  assert.deepEqual(getAppViewport({ height: 800, offsetTop: 0, scale: 1 }, 800, editing),
    { height: 800, top: 0, keyboardOpen: false });
});
test('pinch zoom and missing Visual Viewport do not trigger keyboard resizing', () => {
  const expected = { height: 800, top: 0, keyboardOpen: false };
  assert.deepEqual(getAppViewport({ height: 400, offsetTop: 20, scale: 2 }, 800, editing), expected);
  assert.deepEqual(getAppViewport(null, 800, editing), expected);
});

test('browser chrome is not treated as a keyboard after focusing a field', () => {
  assert.equal(getAppViewport({ height: 720, offsetTop: 0, scale: 1 }, 844, editing, 720).keyboardOpen, false);
});
