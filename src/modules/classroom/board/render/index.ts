/**
 * F29-STEALTH: Render utilities for Konva board
 * Exports all render-related functions for stealth autosave
 */

export {
  startRenderGuard,
  stopRenderGuard,
  getExtraDrawsDuringSave,
  isRenderGuardActive,
  resetExtraDrawsCounter,
} from './guards'

export {
  initSnapshotOverlay,
  showSnapshotOverlay,
  hideSnapshotOverlay,
  hideSnapshotOverlayImmediate,
  destroySnapshotOverlay,
  getLastCopyDuration,
  isSnapshotOverlayVisible,
} from './snapshotOverlay'

export {
  initRenderQueue,
  requestRender,
  cancelPendingRender,
  forceRender,
  getRenderMetrics,
  resetRenderMetrics,
  destroyRenderQueue,
  isRenderPending,
} from './renderQueue'
