/**
 * Pure helpers for recovering persisted floating-panel positions after a
 * viewport or layout change. Kept DOM-free so the geometry contract is easy
 * to test and can be shared by any draggable panel.
 */

/**
 * Normalize a stored panel position. Invalid values fall back to the origin.
 * @param {{left?:number, top?:number}|null} position
 * @returns {{left:number, top:number}}
 */
export function normalizePanelPosition(position) {
  const left = Number(position?.left);
  const top = Number(position?.top);
  return {
    left: Number.isFinite(left) ? left : 0,
    top: Number.isFinite(top) ? top : 0,
  };
}

/**
 * Clamp a panel rectangle so at least `minVisiblePx` remains inside the
 * viewport. The result is deterministic and never mutates the input.
 *
 * @param {{left?:number, top?:number}} position
 * @param {{width:number,height:number}} panel
 * @param {{width:number,height:number}} viewport
 * @param {number} [minVisiblePx=24]
 * @returns {{left:number, top:number, changed:boolean}}
 */
export function recoverPanelPosition(position, panel, viewport, minVisiblePx = 24) {
  const normalized = normalizePanelPosition(position);
  const width = Math.max(0, Number(panel?.width) || 0);
  const height = Math.max(0, Number(panel?.height) || 0);
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const visible = Math.max(0, Number(minVisiblePx) || 0);

  const horizontalMin = Math.min(0, viewportWidth - visible);
  const horizontalMax = Math.max(horizontalMin, viewportWidth - Math.min(width, visible));
  const verticalMin = Math.min(0, viewportHeight - visible);
  const verticalMax = Math.max(verticalMin, viewportHeight - Math.min(height, visible));

  const left = Math.min(horizontalMax, Math.max(horizontalMin, normalized.left));
  const top = Math.min(verticalMax, Math.max(verticalMin, normalized.top));
  return { left, top, changed: left !== normalized.left || top !== normalized.top };
}

/**
 * Decide whether a persisted rectangle needs recovery before applying it.
 * @param {{left?:number,top?:number}} position
 * @param {{width:number,height:number}} panel
 * @param {{width:number,height:number}} viewport
 * @param {number} [minVisiblePx=24]
 * @returns {boolean}
 */
export function panelPositionNeedsRecovery(position, panel, viewport, minVisiblePx = 24) {
  return recoverPanelPosition(position, panel, viewport, minVisiblePx).changed;
}
