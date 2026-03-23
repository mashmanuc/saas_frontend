/**
 * Phase 31: Audit Analyzer — converts snapshot metrics to actionable issues
 *
 * Pure sync function. No side effects. No API calls.
 * Uses thresholds from DEFAULT_AUDIT_CONFIG.
 */
import type { AuditSnapshot, AuditIssue, AuditConfig } from './types'
import { DEFAULT_AUDIT_CONFIG } from './types'

export function analyzeAudit(
  snapshot: AuditSnapshot,
  config: AuditConfig = DEFAULT_AUDIT_CONFIG,
): AuditIssue[] {
  const issues: AuditIssue[] = []
  const t = config.thresholds

  // 1. Duplicates (always error)
  if (snapshot.duplicates >= t.duplicates.error) {
    issues.push({
      id: `duplicate-${snapshot.duplicates}`,
      level: 'error',
      message: `Duplicate requests (${snapshot.duplicates})`,
      hint: 'Check queryKey dedup or component re-mounts',
    })
  }

  // 2. Cache hit rate
  if (snapshot.cacheTotal > 0) {
    const pct = Math.round(snapshot.cacheHitRate * 100)
    if (snapshot.cacheHitRate < t.cacheHitRate.error) {
      issues.push({
        id: `cache-hit-${pct}`,
        level: 'error',
        message: `Cache hit rate ${pct}%`,
        hint: 'Queries refetching — check staleTime config',
      })
    } else if (snapshot.cacheHitRate < t.cacheHitRate.warn) {
      issues.push({
        id: `cache-hit-${pct}`,
        level: 'warn',
        message: `Cache hit rate ${pct}%`,
        hint: 'Some queries are stale — verify cache invalidation',
      })
    }
  }

  // 3. Request count
  if (snapshot.requests > t.requests.error) {
    issues.push({
      id: `requests-${snapshot.requests}`,
      level: 'error',
      message: `High request count (${snapshot.requests})`,
      hint: 'Reduce mount fetches or increase staleTime',
    })
  } else if (snapshot.requests > t.requests.warn) {
    issues.push({
      id: `requests-${snapshot.requests}`,
      level: 'warn',
      message: `Elevated request count (${snapshot.requests})`,
      hint: 'Consider query consolidation',
    })
  }

  // 4. WS storm
  if (snapshot.wsEventsInWindow > t.wsEventsPerWindow.error) {
    issues.push({
      id: `ws-storm-${snapshot.wsEventsInWindow}`,
      level: 'error',
      message: `WS event storm (${snapshot.wsEventsInWindow}/5s)`,
      hint: 'Check queryBridge invalidation cascade',
    })
  } else if (snapshot.wsEventsInWindow > t.wsEventsPerWindow.warn) {
    issues.push({
      id: `ws-storm-${snapshot.wsEventsInWindow}`,
      level: 'warn',
      message: `Elevated WS events (${snapshot.wsEventsInWindow}/5s)`,
      hint: 'Monitor invalidation frequency',
    })
  }

  // Sort: errors first, then warnings
  issues.sort((a, b) => {
    if (a.level === b.level) return 0
    return a.level === 'error' ? -1 : 1
  })

  return issues
}
