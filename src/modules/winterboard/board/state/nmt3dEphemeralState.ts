/**
 * NMT3D ephemeral state cache — module-level Map for vendor-internal state
 * that is NOT serialized into asset.data and must survive Vue component remounts.
 *
 * CONTEXT (2026-05-30, 5th iteration — comprehensive fix):
 *   NMT3D engine has internal state that is NOT in asset.data:
 *     • ws.cam.{yaw, pitch, scale}  — 3D camera rotation + zoom
 *     • ws.strokes                  — SVG path strings drawn in NMT3D's own "draw" mode
 *     • ws.autoOrbit                — auto-rotation flag
 *
 *   When the Vue component remounts (page switch via v-for diffing, deselect→select,
 *   templateKey change, etc.), `destroyWs()` calls `ws.destroy()` and a NEW ws is
 *   created next mount. The vendor constructor resets cam to defaults
 *   (yaw:-0.5, pitch:0.28, scale:110), strokes:[], autoOrbit:false.
 *
 *   Result without this cache: user rotates pyramid → switches to page 2 → comes back →
 *   pyramid is back at default angle → user perceives "state reverted" / "distortion".
 *
 * SCOPE:
 *   - Per-tab, per-asset.id. Memory bounded by # NMT3D assets ever opened in session.
 *   - Lost on full page refresh — acceptable, this is "current view" not "asset content".
 *   - NOT collaborative (camera rotation is per-user, not synced).
 *   - NOT persisted to backend — purely client-side ephemeral.
 *
 * USAGE:
 *   - destroyWs() (Nmt3dRenderer): save cam/strokes/autoOrbit before ws.destroy()
 *   - mount() (Nmt3dRenderer): restore from cache after setParams/setOpt
 *
 * NOT in asset.data because:
 *   - Camera/strokes change at 60fps during interaction → emitting ops per frame
 *     would flood the WS / backend
 *   - These are presentation concerns, not session data
 *   - Replay viewers can use their own default camera (it's a view choice)
 */

export interface Nmt3dEphemeralState {
  cam?: { yaw: number; pitch: number; scale: number }
  /** SVG path strings from NMT3D's own 'draw' mode (NOT board Konva strokes) */
  strokes?: string[]
  autoOrbit?: boolean
}

const _ephemeralStateCache = new Map<string, Nmt3dEphemeralState>()

/** Read cached state for an asset.id; returns undefined if no entry. */
export function getNmt3dEphemeralState(assetId: string): Nmt3dEphemeralState | undefined {
  return _ephemeralStateCache.get(assetId)
}

/** Write cached state for an asset.id (overwrites any prior entry). */
export function setNmt3dEphemeralState(assetId: string, state: Nmt3dEphemeralState): void {
  _ephemeralStateCache.set(assetId, state)
}

/** Test-only reset. Production code should never call this. */
export function __resetNmt3dEphemeralCacheForTests(): void {
  _ephemeralStateCache.clear()
}
