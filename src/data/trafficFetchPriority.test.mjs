import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rankTrafficFetchCandidates,
  selectTrafficFetchBatch,
  trafficFetchPriorityScore,
} from './trafficFetchPriority.js';

test('nearest visible candidate receives the best score', () => {
  assert.ok(trafficFetchPriorityScore({ distanceKm: 1, visible: true }) < trafficFetchPriorityScore({ distanceKm: 4, visible: true }));
});

test('visible candidates outrank equally distant offscreen candidates', () => {
  const ranked = rankTrafficFetchCandidates([
    { id: 'offscreen', distanceKm: 1, visible: false },
    { id: 'visible', distanceKm: 1, visible: true },
  ]);
  assert.deepEqual(ranked.map((x) => x.id), ['visible', 'offscreen']);
});

test('stale visible coverage gets a modest priority boost', () => {
  const ranked = rankTrafficFetchCandidates([
    { id: 'fresh', distanceKm: 2, ageMs: 0, visible: true },
    { id: 'stale', distanceKm: 2, ageMs: 10 * 60_000, visible: true },
  ]);
  assert.deepEqual(ranked.map((x) => x.id), ['stale', 'fresh']);
});

test('invalid distances are safely placed last', () => {
  const ranked = rankTrafficFetchCandidates([
    { id: 'bad', distanceKm: NaN, visible: true },
    { id: 'good', distanceKm: 0.5, visible: true },
  ]);
  assert.equal(ranked[0].id, 'good');
  assert.equal(ranked[1].id, 'bad');
});

test('ranking is stable for identical scores', () => {
  const ranked = rankTrafficFetchCandidates([
    { id: 'first', distanceKm: 2, visible: true },
    { id: 'second', distanceKm: 2, visible: true },
  ]);
  assert.deepEqual(ranked.map((x) => x.id), ['first', 'second']);
});

test('batch selection is bounded and non-mutating', () => {
  const input = [
    { id: 'far', distanceKm: 9, visible: true },
    { id: 'near', distanceKm: 1, visible: true },
    { id: 'mid', distanceKm: 4, visible: true },
  ];
  const selected = selectTrafficFetchBatch(input, 2);
  assert.deepEqual(selected.map((x) => x.id), ['near', 'mid']);
  assert.deepEqual(input.map((x) => x.id), ['far', 'near', 'mid']);
});

test('negative limits select nothing', () => {
  assert.deepEqual(selectTrafficFetchBatch([{ id: 'x', distanceKm: 1 }], -2), []);
});
