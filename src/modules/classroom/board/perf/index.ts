/**
 * F29-STEALTH: Performance monitoring utilities
 */

export {
  startSaveWindow,
  endSaveWindow,
  recordExtraDraw,
  recordMainThreadBlock,
  recordPointerEvent,
  recordRafFlush,
  recordOverlayCopy,
  recordSaveRtt,
  getMetricsSnapshot,
  isSaveWindowActive,
  subscribeToMetrics,
  resetMetrics,
  getMetricsBuffer,
  type SaveWindowMetrics,
} from './saveWindowMetrics'
