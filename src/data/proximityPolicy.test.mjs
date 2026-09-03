import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROXIMITY_STATUS,
  evaluateProximity,
  normalizeProximityPolicy,
  removeProximityTarget,
  updateProximityState,
} from './proximityPolicy.js';

const POLICY = { enterRadiusM: 10_000, exitRadiusM: 12_000 };

// This suite is deliberately pure Node test coverage: no Cesium, DOM, network,
// or source-specific fixture is needed to verify the alert contract.

test('normalizes valid thresholds and rejects invalid hysteresis', () => {
  assert.deepEqual(normalizeProximityPolicy(POLICY), POLICY);
  assert.deepEqual(normalizeProximityPolicy({ enterRadiusM: 5000 }), { enterRadiusM: 5000, exitRadiusM: 5000 });
  assert.equal(normalizeProximityPolicy({ enterRadiusM: -1, exitRadiusM: 100 }), null);
  assert.equal(normalizeProximityPolicy({ enterRadiusM: 100, exitRadiusM: 90 }), null);
  assert.equal(normalizeProximityPolicy({ enterRadiusM: Infinity, exitRadiusM: Infinity }), null);
});

test('first in-range observation emits ENTER exactly once', () => {
  const first = evaluateProximity({ distanceM: 9000, previousState: PROXIMITY_STATUS.UNKNOWN, policy: POLICY });
  assert.deepEqual(first, { state: PROXIMITY_STATUS.INSIDE, distanceM: 9000, event: PROXIMITY_STATUS.ENTER });
  const steady = evaluateProximity({ distanceM: 8000, previousState: first.state, policy: POLICY });
  assert.deepEqual(steady, { state: PROXIMITY_STATUS.INSIDE, distanceM: 8000, event: null });
});

test('outside observations do not generate false alerts', () => {
  assert.deepEqual(evaluateProximity({
    distanceM: 20_000, previousState: PROXIMITY_STATUS.OUTSIDE, policy: POLICY,
  }), { state: PROXIMITY_STATUS.OUTSIDE, distanceM: 20_000, event: null });
});

test('exact enter and exit boundaries use the documented inclusive comparisons', () => {
  const entered = evaluateProximity({ distanceM: 10_000, previousState: PROXIMITY_STATUS.OUTSIDE, policy: POLICY });
  assert.equal(entered.event, PROXIMITY_STATUS.ENTER);
  const exited = evaluateProximity({ distanceM: 12_000, previousState: PROXIMITY_STATUS.INSIDE, policy: POLICY });
  assert.equal(exited.event, PROXIMITY_STATUS.EXIT);
});

test('hysteresis suppresses chatter between enter and exit radii', () => {
  const entered = evaluateProximity({ distanceM: 9500, previousState: PROXIMITY_STATUS.OUTSIDE, policy: POLICY });
  const stillInside = evaluateProximity({ distanceM: 11_000, previousState: entered.state, policy: POLICY });
  assert.equal(stillInside.event, null);
  assert.equal(stillInside.state, PROXIMITY_STATUS.INSIDE);
  const exited = evaluateProximity({ distanceM: 12_000, previousState: stillInside.state, policy: POLICY });
  assert.equal(exited.event, PROXIMITY_STATUS.EXIT);
  assert.equal(exited.state, PROXIMITY_STATUS.OUTSIDE);
});

test('invalid or unavailable samples stay UNKNOWN and never fabricate edges', () => {
  for (const distanceM of [null, undefined, NaN, Infinity, -1, 'not-a-number']) {
    assert.deepEqual(evaluateProximity({ distanceM, previousState: PROXIMITY_STATUS.INSIDE, policy: POLICY }), {
      state: PROXIMITY_STATUS.UNKNOWN, distanceM: null, event: null,
    });
  }
});

test('invalid observations preserve the last known state in the ledger', () => {
  const seeded = updateProximityState(new Map(), 'aircraft:A', 5000, POLICY).states;
  const update = updateProximityState(seeded, 'aircraft:A', null, POLICY);
  assert.equal(update.result.state, PROXIMITY_STATUS.UNKNOWN);
  assert.equal(update.states.get('aircraft:A'), PROXIMITY_STATUS.INSIDE);
});

test('re-entry after exit emits ENTER again', () => {
  const outside = evaluateProximity({ distanceM: 20_000, previousState: PROXIMITY_STATUS.INSIDE, policy: POLICY });
  assert.equal(outside.event, PROXIMITY_STATUS.EXIT);
  const reentered = evaluateProximity({ distanceM: 5000, previousState: outside.state, policy: POLICY });
  assert.equal(reentered.event, PROXIMITY_STATUS.ENTER);
});

test('multi-target ledger isolates state by stable target id', () => {
  let states = new Map();
  let update = updateProximityState(states, 'aircraft:A', 5000, POLICY);
  states = update.states;
  assert.equal(update.result.event, PROXIMITY_STATUS.ENTER);
  update = updateProximityState(states, 'aircraft:B', 20_000, POLICY);
  states = update.states;
  assert.equal(update.result.event, null);
  assert.equal(states.get('aircraft:A'), PROXIMITY_STATUS.INSIDE);
  assert.equal(states.get('aircraft:B'), PROXIMITY_STATUS.OUTSIDE);
});

test('blank, padded, and non-string IDs are handled deterministically', () => {
  const seeded = new Map([['aircraft:A', PROXIMITY_STATUS.INSIDE]]);
  const blank = updateProximityState(seeded, '   ', 5000, POLICY);
  assert.deepEqual([...blank.states.entries()], [...seeded.entries()]);
  const padded = updateProximityState(seeded, '  aircraft:A  ', 12_000, POLICY);
  assert.equal(padded.result.event, PROXIMITY_STATUS.EXIT);
  const numeric = updateProximityState(new Map(), 42, 5000, POLICY);
  assert.equal(numeric.states.get('42'), PROXIMITY_STATUS.INSIDE);
});

test('state map input is not mutated by updates', () => {
  const original = new Map([['aircraft:A', PROXIMITY_STATUS.OUTSIDE]]);
  const update = updateProximityState(original, 'aircraft:A', 5000, POLICY);
  assert.equal(original.get('aircraft:A'), PROXIMITY_STATUS.OUTSIDE);
  assert.equal(update.states.get('aircraft:A'), PROXIMITY_STATUS.INSIDE);
});

test('unknown previous state is treated like an uninitialized observation', () => {
  const result = evaluateProximity({ distanceM: 9000, previousState: 'bogus-state', policy: POLICY });
  assert.equal(result.event, PROXIMITY_STATUS.ENTER);
  assert.equal(result.state, PROXIMITY_STATUS.INSIDE);
});

test('removed targets do not retain stale proximity state', () => {
  const seeded = new Map([
    ['aircraft:A', PROXIMITY_STATUS.INSIDE],
    ['vessel:B', PROXIMITY_STATUS.OUTSIDE],
  ]);
  const reduced = removeProximityTarget(seeded, 'aircraft:A');
  assert.equal(reduced.has('aircraft:A'), false);
  assert.equal(reduced.get('vessel:B'), PROXIMITY_STATUS.OUTSIDE);
  assert.equal(seeded.has('aircraft:A'), true);
  assert.deepEqual([...removeProximityTarget(seeded, 'missing')], [...seeded]);
});
