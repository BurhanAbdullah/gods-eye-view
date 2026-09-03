/**
 * Pure prioritization helpers for viewport-scoped traffic fetches.
 *
 * The traffic layer can use this policy to prefer road tiles nearest the
 * active camera look-at before spending its request/dot budget elsewhere.
 * No Cesium, DOM, network, or source-specific dependency.
 */

const DEFAULT_DISTANCE_WEIGHT = 1;
const DEFAULT_AGE_WEIGHT = 0.25;

/**
 * Score one candidate tile. Lower score means higher fetch priority.
 *
 * @param {{distanceKm?:number, ageMs?:number, visible?:boolean}} candidate
 * @param {{distanceWeight?:number, ageWeight?:number}} [weights]
 * @returns {number} Sortable priority score.
 */
export function trafficFetchPriorityScore(candidate = {}, weights = {}) {
  const distanceKm = Number(candidate.distanceKm);
  const ageMs = Number(candidate.ageMs);
  const distance = Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : Infinity;
  const age = Number.isFinite(ageMs) && ageMs >= 0 ? ageMs / 60_000 : 0;
  const distanceWeight = Number.isFinite(Number(weights.distanceWeight))
    ? Math.max(0, Number(weights.distanceWeight)) : DEFAULT_DISTANCE_WEIGHT;
  const ageWeight = Number.isFinite(Number(weights.ageWeight))
    ? Math.max(0, Number(weights.ageWeight)) : DEFAULT_AGE_WEIGHT;
  const visibilityPenalty = candidate.visible === false ? 10_000 : 0;
  return distance * distanceWeight - age * ageWeight + visibilityPenalty;
}

/**
 * Rank candidate tiles without mutating the caller's array.
 *
 * Visible tiles nearest to the current look-at point win; stale visible tiles
 * receive a modest boost so a cache does not remain permanently preferred over
 * fresh coverage. Invalid distances are always placed last.
 */
export function rankTrafficFetchCandidates(candidates = [], weights = {}) {
  return [...candidates]
    .map((candidate, index) => ({ candidate, index, score: trafficFetchPriorityScore(candidate, weights) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ candidate }) => candidate);
}

/**
 * Select a bounded request batch while preserving priority order.
 *
 * @param {Array<Object>} candidates - Candidate fetch records.
 * @param {number} limit - Maximum number to return.
 * @returns {Array<Object>} Highest-priority candidates.
 */
export function selectTrafficFetchBatch(candidates = [], limit = 1, weights = {}) {
  const count = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 0;
  return rankTrafficFetchCandidates(candidates, weights).slice(0, count);
}
