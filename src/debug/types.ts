/**
 * Phase 30: Audit Overlay — Types & Config
 *
 * Central type definitions for the audit overlay system.
 * Used by all debug/ modules: networkTracker, cacheInspector, wsEventTracker, auditCollector.
 */

export interface AuditSnapshot {
  // Network
  requests: number           // Total requests since page load
  duplicates: number         // Dedup reuse count (same URL+params within 5s window)

  // Cache
  cacheTotal: number         // Total queries in cache
  cacheFresh: number         // Fresh (not stale) queries
  cacheStale: number         // Stale queries
  cacheHitRate: number       // 0-1, fresh queries that won't refetch on mount

  // WebSocket
  wsEventsInWindow: number   // Events in last 5 seconds
  wsEventsTotal: number      // Total events since page load

  // Computed
  status: AuditStatus
  timestamp: number          // Date.now()

  // Phase 31: analyzer issues (optional for backward compat)
  issues?: AuditIssue[]
}

export type AuditStatus = 'ok' | 'warn' | 'error'

export interface AuditIssue {
  id: string             // Unique key for v-for: 'duplicate-2', 'cache-hit-45', etc.
  level: 'warn' | 'error'
  message: string        // Human-readable: 'Duplicate requests (2)'
  hint: string           // Actionable: 'Check queryKey dedup or component re-mounts'
}

export interface AuditConfig {
  updateIntervalMs: number   // Default: 2000
  wsWindowMs: number         // Default: 5000
  dedupWindowMs: number      // Default: 5000 — window for duplicate detection
  thresholds: {
    requests: { warn: number; error: number }
    duplicates: { error: number }
    cacheHitRate: { warn: number; error: number }
    wsEventsPerWindow: { warn: number; error: number }
  }
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  updateIntervalMs: 2_000,
  wsWindowMs: 5_000,
  dedupWindowMs: 5_000,
  thresholds: {
    requests: { warn: 20, error: 30 },
    duplicates: { error: 1 },
    cacheHitRate: { warn: 0.7, error: 0.5 },
    wsEventsPerWindow: { warn: 3, error: 6 },
  },
}
