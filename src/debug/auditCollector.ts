/**
 * Phase 30: Audit Collector — central aggregation service
 *
 * Combines metrics from networkTracker, cacheInspector, wsEventTracker
 * into a single AuditSnapshot (INV-6: Single Source of State).
 *
 * Provides initAuditCollector/getAuditSnapshot/disposeAuditCollector.
 */
import type { AuditSnapshot, AuditStatus, AuditConfig } from './types'
import { DEFAULT_AUDIT_CONFIG } from './types'
import { getNetworkStats, attachNetworkTracker } from './networkTracker'
import { inspectQueryCache } from './cacheInspector'
import { getWsStats, attachWsTracker, teardownWsTracker } from './wsEventTracker'
import { analyzeAudit } from './auditAnalyzer'

let _config: AuditConfig = DEFAULT_AUDIT_CONFIG

export function initAuditCollector(config?: Partial<AuditConfig>): void {
  if (config) {
    _config = {
      ...DEFAULT_AUDIT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_AUDIT_CONFIG.thresholds,
        ...config.thresholds,
      },
    }
  }
  attachNetworkTracker(_config.dedupWindowMs)
  attachWsTracker()
  _exposeGlobalAccessor()
}

export function getAuditSnapshot(): AuditSnapshot {
  const network = getNetworkStats()
  const cache = inspectQueryCache()
  const ws = getWsStats()

  const snapshot: AuditSnapshot = {
    requests: network.requests,
    duplicates: network.duplicates,
    cacheTotal: cache.total,
    cacheFresh: cache.fresh,
    cacheStale: cache.stale,
    cacheHitRate: cache.hitRate,
    wsEventsInWindow: ws.eventsInWindow,
    wsEventsTotal: ws.totalEvents,
    status: 'ok',
    timestamp: Date.now(),
  }

  snapshot.status = computeStatus(snapshot)
  try { snapshot.issues = analyzeAudit(snapshot, _config) } catch { snapshot.issues = [] }  // Phase 31
  return snapshot
}

function computeStatus(s: AuditSnapshot): AuditStatus {
  const t = _config.thresholds

  // Error conditions
  if (s.duplicates >= t.duplicates.error) return 'error'
  if (s.wsEventsInWindow > t.wsEventsPerWindow.error) return 'error'
  if (s.cacheHitRate < t.cacheHitRate.error && s.cacheTotal > 0) return 'error'
  if (s.requests > t.requests.error) return 'error'

  // Warning conditions
  if (s.requests > t.requests.warn) return 'warn'
  if (s.wsEventsInWindow > t.wsEventsPerWindow.warn) return 'warn'
  if (s.cacheHitRate < t.cacheHitRate.warn && s.cacheTotal > 0) return 'warn'

  return 'ok'
}

export function getAuditConfig(): AuditConfig {
  return _config
}

export function disposeAuditCollector(): void {
  teardownWsTracker()
  _config = DEFAULT_AUDIT_CONFIG
  // Remove global debug accessor
  if (typeof window !== 'undefined') {
    delete (window as any).__audit // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

/**
 * Expose global debug accessor: window.__audit.getSnapshot()
 * Called once during initAuditCollector so devs can inspect audit state from console.
 */
function _exposeGlobalAccessor(): void {
  if (typeof window === 'undefined') return
  ;(window as any).__audit = { // eslint-disable-line @typescript-eslint/no-explicit-any
    getSnapshot: getAuditSnapshot,
    getConfig: getAuditConfig,
  }
}
