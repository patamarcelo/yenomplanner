import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIOSStandaloneHeight } from '../src/hooks/useIOSStandaloneHeight.js';

test('uses the full 874-point iPhone screen independently of stale 812-point viewport', () => {
  assert.equal(getIOSStandaloneHeight(402, 874, 0), 874);
});

test('uses physical orientation rather than the viewport aspect ratio changed by a keyboard', () => {
  assert.equal(getIOSStandaloneHeight(402, 874, 90), 402);
  assert.equal(getIOSStandaloneHeight(874, 402, -90), 402);
  assert.equal(getIOSStandaloneHeight(402, 874, 180), 874);
});

test('invalid screen dimensions leave CSS in control', () => {
  assert.equal(getIOSStandaloneHeight(0, 874, 0), null);
});
