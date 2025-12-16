/**
 * F29-STEALTH: Save Window Metrics
 * Isolated metrics collection for autosave performance
 * Does NOT affect render path - uses event/log buffer pattern
 */

// Save window state
interface SaveWindowState {
  isActive: boolean
  sessionId: string | null
  rev: number
  startTime: number
  // Metrics collected during save window
  extraDrawsDuringSave: number
  mainThreadBlockMs: number
  inputLatencyMs: number
  overlayCopyMs: number
  saveRttMs: number
}

// Current save window
let currentWindow: SaveWindowState | null = null

// Historical metrics buffer (last 10 saves)
const metricsBuffer: SaveWindowState[] = []
const MAX_BUFFER_SIZE = 10

// Input latency tracking
let lastPointerTimestamp = 0
let lastRafFlushTimestamp = 0

// Main thread block tracking
let frameStartTime = 0
let maxBlockDuringWindow = 0

// Listeners for metrics updates
type MetricsListener = (metrics: SaveWindowMetrics) => void
const listeners: Set<MetricsListener> = new Set()

export interface SaveWindowMetrics {
  fps: number
  drawCallsPerSec: number
  extraDrawsDuringSave: number
  mainThreadBlockMsDuringSave: number
  inputLatencyMsDuringSave: number
  overlayCopyMs: number
  saveRttMs: number
  // Aggregates
  lastSaveSuccess: boolean
  pendingSaves: number
}

/**
 * Start a save window - call when autosave begins
 */
export function startSaveWindow(sessionId: string, rev: number): void {
  // End previous window if still active
  if (currentWindow?.isActive) {
    endSaveWindow('error')
  }

  currentWindow = {
    isActive: true,
    sessionId,
    rev,
    startTime: performance.now(),
    extraDrawsDuringSave: 0,
    mainThreadBlockMs: 0,
    inputLatencyMs: 0,
    overlayCopyMs: 0,
    saveRttMs: 0,
  }

  maxBlockDuringWindow = 0

  logDebug('saveWindow.start', { sessionId, rev })
}

/**
 * End save window - call when autosave completes
 */
export function endSaveWindow(result: 'success' | 'queued' | 'error'): void {
  if (!currentWindow) return

  currentWindow.isActive = false
  currentWindow.mainThreadBlockMs = maxBlockDuringWindow

  // Add to buffer
  metricsBuffer.push({ ...currentWindow })
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift()
  }

  logDebug('saveWindow.end', {
    result,
    durationMs: performance.now() - currentWindow.startTime,
    extraDraws: currentWindow.extraDrawsDuringSave,
    mainThreadBlockMs: currentWindow.mainThreadBlockMs,
    inputLatencyMs: currentWindow.inputLatencyMs,
    overlayCopyMs: currentWindow.overlayCopyMs,
    saveRttMs: currentWindow.saveRttMs,
  })

  // Notify listeners
  notifyListeners()

  currentWindow = null
}

/**
 * Record extra draw call during save (should be 0)
 */
export function recordExtraDraw(): void {
  if (currentWindow?.isActive) {
    currentWindow.extraDrawsDuringSave++
  }
}

/**
 * Record main thread block duration
 */
export function recordMainThreadBlock(durationMs: number): void {
  if (currentWindow?.isActive && durationMs > maxBlockDuringWindow) {
    maxBlockDuringWindow = durationMs
  }
}

/**
 * Record pointer event timestamp (for input latency)
 */
export function recordPointerEvent(timestamp: number): void {
  lastPointerTimestamp = timestamp
}

/**
 * Record rAF flush timestamp (for input latency calculation)
 */
export function recordRafFlush(): void {
  lastRafFlushTimestamp = performance.now()
  
  if (currentWindow?.isActive && lastPointerTimestamp > 0) {
    const latency = lastRafFlushTimestamp - lastPointerTimestamp
    if (latency > currentWindow.inputLatencyMs) {
      currentWindow.inputLatencyMs = latency
    }
  }
}

/**
 * Record overlay copy duration
 */
export function recordOverlayCopy(durationMs: number): void {
  if (currentWindow?.isActive) {
    currentWindow.overlayCopyMs = durationMs
  }
}

/**
 * Record save RTT from worker ACK
 */
export function recordSaveRtt(rttMs: number): void {
  if (currentWindow?.isActive) {
    currentWindow.saveRttMs = rttMs
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetricsSnapshot(): SaveWindowMetrics {
  const lastSave = metricsBuffer[metricsBuffer.length - 1]
  
  return {
    fps: 0, // Will be filled by PerfHUD
    drawCallsPerSec: 0, // Will be filled by PerfHUD
    extraDrawsDuringSave: lastSave?.extraDrawsDuringSave ?? 0,
    mainThreadBlockMsDuringSave: lastSave?.mainThreadBlockMs ?? 0,
    inputLatencyMsDuringSave: lastSave?.inputLatencyMs ?? 0,
    overlayCopyMs: lastSave?.overlayCopyMs ?? 0,
    saveRttMs: lastSave?.saveRttMs ?? 0,
    lastSaveSuccess: true,
    pendingSaves: currentWindow?.isActive ? 1 : 0,
  }
}

/**
 * Check if save window is currently active
 */
export function isSaveWindowActive(): boolean {
  return currentWindow?.isActive ?? false
}

/**
 * Subscribe to metrics updates
 */
export function subscribeToMetrics(listener: MetricsListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Notify all listeners of metrics update
 */
function notifyListeners(): void {
  const metrics = getMetricsSnapshot()
  listeners.forEach(listener => {
    try {
      listener(metrics)
    } catch (e) {
      console.error('[saveWindowMetrics] Listener error:', e)
    }
  })
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  currentWindow = null
  metricsBuffer.length = 0
  maxBlockDuringWindow = 0
  lastPointerTimestamp = 0
  lastRafFlushTimestamp = 0
}

/**
 * Get metrics buffer for analysis
 */
export function getMetricsBuffer(): readonly SaveWindowState[] {
  return metricsBuffer
}

// Debug logging
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV
function logDebug(event: string, payload: Record<string, unknown>): void {
  if (!IS_DEV) return
  console.log('[autosave.perf]', { event, ...payload })
}
