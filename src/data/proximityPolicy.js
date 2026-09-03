/**
 * Pure proximity-threshold state machine for live awareness alerts.
 *
 * Source-agnostic: aircraft, vessels, satellites, fires, installations, or
 * user-supplied observations can share the same enter/exit semantics.
 *
 * Hysteresis prevents boundary chatter:
 *   enter when distance <= enterRadiusM
 *   exit when distance >= exitRadiusM
 * where exitRadiusM >= enterRadiusM.
 */

export const PROXIMITY_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  OUTSIDE: 'OUTSIDE',
  ENTER: 'ENTER',
  INSIDE: 'INSIDE',
  EXIT: 'EXIT',
});

const VALID_STATES = new Set([
  PROXIMITY_STATUS.UNKNOWN,
  PROXIMITY_STATUS.OUTSIDE,
  PROXIMITY_STATUS.INSIDE,
]);

const UNKNOWN_RESULT = Object.freeze({
  state: PROXIMITY_STATUS.UNKNOWN,
  distanceM: null,
  event: null,
});

/** Normalize and validate a proximity policy. */
export function normalizeProximityPolicy({ enterRadiusM, exitRadiusM = enterRadiusM } = {}) {
  const enter = Number(enterRadiusM);
  const exit = Number(exitRadiusM);
  if (!Number.isFinite(enter) || enter < 0) return null;
  if (!Number.isFinite(exit) || exit < enter) return null;
  return { enterRadiusM: enter, exitRadiusM: exit };
}

/**
 * Classify one distance sample against a proximity policy and prior state.
 * Unknown input is silent: unavailable data is not evidence of an edge.
 */
export function evaluateProximity({
  distanceM,
  previousState = PROXIMITY_STATUS.UNKNOWN,
  policy,
} = {}) {
  const normalizedPolicy = normalizeProximityPolicy(policy);
  if (!normalizedPolicy) return { ...UNKNOWN_RESULT };

  const distance = Number(distanceM);
  if (!Number.isFinite(distance) || distance < 0) return { ...UNKNOWN_RESULT };

  const previous = VALID_STATES.has(previousState)
    ? previousState
    : PROXIMITY_STATUS.UNKNOWN;

  if (previous === PROXIMITY_STATUS.INSIDE) {
    if (distance >= normalizedPolicy.exitRadiusM) {
      return {
        state: PROXIMITY_STATUS.OUTSIDE,
        distanceM: distance,
        event: PROXIMITY_STATUS.EXIT,
      };
    }
    return { state: PROXIMITY_STATUS.INSIDE, distanceM: distance, event: null };
  }

  if (distance <= normalizedPolicy.enterRadiusM) {
    return {
      state: PROXIMITY_STATUS.INSIDE,
      distanceM: distance,
      event: PROXIMITY_STATUS.ENTER,
    };
  }

  return { state: PROXIMITY_STATUS.OUTSIDE, distanceM: distance, event: null };
}

/**
 * Update a multi-target ledger without sharing state between IDs.
 *
 * The input map is treated as immutable; callers receive a fresh map so a
 * rejected/unknown observation cannot partially mutate shared state.
 */
export function updateProximityState(states, targetId, distanceM, policy) {
  const ledger = states instanceof Map ? new Map(states) : new Map();
  const key = typeof targetId === 'string' ? targetId.trim() : String(targetId ?? '').trim();
  if (!key) return { states: ledger, result: { ...UNKNOWN_RESULT } };

  const result = evaluateProximity({
    distanceM,
    previousState: ledger.get(key) ?? PROXIMITY_STATUS.UNKNOWN,
    policy,
  });
  if (result.state !== PROXIMITY_STATUS.UNKNOWN) ledger.set(key, result.state);
  return { states: ledger, result };
}

/** Remove a target's state when its source adapter permanently drops it. */
export function removeProximityTarget(states, targetId) {
  const ledger = states instanceof Map ? new Map(states) : new Map();
  const key = typeof targetId === 'string' ? targetId.trim() : String(targetId ?? '').trim();
  if (key) ledger.delete(key);
  return ledger;
}
