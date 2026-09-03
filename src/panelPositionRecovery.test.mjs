import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePanelPosition,
  panelPositionNeedsRecovery,
  recoverPanelPosition,
} from './panelPositionRecovery.js';

test('normalizes invalid persisted coordinates', () => {
  assert.deepEqual(normalizePanelPosition({ left: NaN, top: Infinity }), { left: 0, top: 0 });
  assert.deepEqual(normalizePanelPosition(null), { left: 0, top: 0 });
});

test('keeps a normally placed panel unchanged', () => {
  const result = recoverPanelPosition(
    { left: 100, top: 80 },
    { width: 300, height: 200 },
    { width: 1200, height: 800 },
  );
  assert.deepEqual(result, { left: 100, top: 80, changed: false });
});

test('recovers a panel restored far off the right edge', () => {
  const result = recoverPanelPosition(
    { left: 1500, top: 100 },
    { width: 300, height: 200 },
    { width: 1200, height: 800 },
  );
  assert.equal(result.changed, true);
  assert.equal(result.left, 1176);
  assert.equal(result.top, 100);
});

test('recovers a panel restored above the viewport while preserving a grab area', () => {
  const result = recoverPanelPosition(
    { left: 100, top: -400 },
    { width: 300, height: 200 },
    { width: 1200, height: 800 },
    32,
  );
  assert.equal(result.changed, true);
  assert.equal(result.left, 100);
  assert.equal(result.top, -168);
});

test('handles a panel larger than the viewport deterministically', () => {
  const result = recoverPanelPosition(
    { left: 900, top: 700 },
    { width: 1600, height: 1000 },
    { width: 1200, height: 800 },
  );
  assert.equal(result.left, 1176);
  assert.equal(result.top, 776);
  assert.equal(result.changed, true);
});

test('recovery predicate matches the geometry result', () => {
  const position = { left: -500, top: 20 };
  const panel = { width: 300, height: 200 };
  const viewport = { width: 1200, height: 800 };
  assert.equal(panelPositionNeedsRecovery(position, panel, viewport), true);
  assert.equal(panelPositionNeedsRecovery({ left: 100, top: 20 }, panel, viewport), false);
});
