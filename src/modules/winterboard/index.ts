// WB: Public API for Winterboard module
// Ref: ARCHITECTURE.md §2

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  WBPoint,
  WBToolType,
  WBStroke,
  WBShape,
  WBTextElement,
  WBAsset,
  WBPage,
  WBPageBackground,
  WBWorkspaceState,
  WBHistoryActionType,
  WBHistoryEntry,
  WBSyncStatus,
  WBRemoteCursor,
  WBSession,
  WBExportFormat,
  WBExportStatus,
  WBExport,
  WBShareToken,
} from './types/winterboard'

// ─── Store ──────────────────────────────────────────────────────────────────
export { useWBStore } from './board/state/boardStore'

// ─── Composables (AGENT-B) ──────────────────────────────────────────────────
export { useHistory } from './composables/useHistory'
export { useKeyboard } from './composables/useKeyboard'
export { useToast } from './composables/useToast'
export { useSelection } from './composables/useSelection'
export { useAnnouncer } from './composables/useAnnouncer'
export { useReducedMotion } from './composables/useReducedMotion'

// ─── Composables (AGENT-A) ──────────────────────────────────────────────────
export { useImageUpload } from './composables/useImageUpload'
export { usePresence } from './composables/usePresence'
export { useFollowMode } from './composables/useFollowMode'

// ─── Engine (AGENT-A) ──────────────────────────────────────────────────────
export { catmullRomInterpolate, getSmoothedPoints, clearSmoothedCache } from './engine/smoothing'
export {
  snapZoom, zoomLevelUp, zoomLevelDown, zoomToCursor,
  fitToPage, pinchDistance, pinchCenter, ZOOM_LEVELS,
} from './engine/zoomPan'
export { loadKonva, getKonva, isKonvaLoaded } from './engine/konvaLoader'
export { WBSpatialIndex, getStrokeBBox } from './engine/spatialIndex'

// ─── Composables (AGENT-C) ──────────────────────────────────────────────────
export { useAutosave } from './composables/useAutosave'
export { useOfflineQueue } from './composables/useOfflineQueue'
export { useTelemetry } from './composables/useTelemetry'

// ─── API (AGENT-C) ─────────────────────────────────────────────────────────
export { winterboardApi } from './api/winterboardApi'

// ─── Components (AGENT-B) ───────────────────────────────────────────────────
export { default as WBToolbar } from './components/toolbar/WBToolbar.vue'
export { default as WBPageNav } from './components/pages/WBPageNav.vue'
export { default as WBSaveStatus } from './components/status/WBSaveStatus.vue'
export { default as WBToast } from './components/status/WBToast.vue'
export { default as WBErrorBoundary } from './components/WBErrorBoundary.vue'
export { default as WBCanvasLoader } from './components/loading/WBCanvasLoader.vue'
export { default as WBColorPicker } from './components/toolbar/WBColorPicker.vue'
export { default as WBSizeSlider } from './components/toolbar/WBSizeSlider.vue'
export { default as WBShareDialog } from './components/sharing/WBShareDialog.vue'
export { default as WBExportDialog } from './components/export/WBExportDialog.vue'

// ─── Router ─────────────────────────────────────────────────────────────────
export { default as winterboardRoutes } from './router'
