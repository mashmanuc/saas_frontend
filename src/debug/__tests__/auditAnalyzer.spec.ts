import { describe, it, expect } from 'vitest'
import type { AuditSnapshot } from '../types'
import { DEFAULT_AUDIT_CONFIG } from '../types'
import { analyzeAudit } from '../auditAnalyzer'

function createSnapshot(overrides: Partial<AuditSnapshot>): AuditSnapshot {
  return {
    requests: 5,
    duplicates: 0,
    cacheTotal: 10,
    cacheFresh: 8,
    cacheStale: 2,
    cacheHitRate: 0.8,
    wsEventsInWindow: 1,
    wsEventsTotal: 5,
    status: 'ok',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('analyzeAudit', () => {
  // 1. All metrics OK → empty issues
  it('returns empty array when all metrics within thresholds', () => {
    const snapshot = createSnapshot({ requests: 5, duplicates: 0, cacheHitRate: 0.9, wsEventsInWindow: 1 })
    expect(analyzeAudit(snapshot)).toEqual([])
  })

  // 2. Duplicates → error issue
  it('returns error issue when duplicates > 0', () => {
    const snapshot = createSnapshot({ duplicates: 2 })
    const issues = analyzeAudit(snapshot)
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('Duplicate')
    expect(issues[0].hint).toBeTruthy()
  })

  // 3. Cache low → warn issue
  it('returns warn issue when cache 50-70%', () => {
    const snapshot = createSnapshot({ cacheHitRate: 0.6, cacheTotal: 10 })
    const issues = analyzeAudit(snapshot)
    expect(issues[0].level).toBe('warn')
    expect(issues[0].message).toContain('Cache')
  })

  // 4. Cache very low → error issue
  it('returns error issue when cache < 50%', () => {
    const snapshot = createSnapshot({ cacheHitRate: 0.3, cacheTotal: 10 })
    const issues = analyzeAudit(snapshot)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('Cache')
    expect(issues[0].hint).toContain('staleTime')
  })

  // 5. Multiple issues → sorted errors first
  it('returns multiple issues sorted by severity', () => {
    const snapshot = createSnapshot({ duplicates: 3, requests: 20, wsEventsInWindow: 4 })
    const issues = analyzeAudit(snapshot)
    expect(issues.length).toBeGreaterThan(1)
    // Errors before warnings
    const firstWarnIdx = issues.findIndex(i => i.level === 'warn')
    const lastErrorIdx = issues.filter(i => i.level === 'error').length - 1
    if (firstWarnIdx !== -1 && lastErrorIdx !== -1) {
      expect(lastErrorIdx).toBeLessThan(firstWarnIdx)
    }
  })

  // 6. WS storm → error
  it('returns error issue on WS storm (>6 events/5s)', () => {
    const snapshot = createSnapshot({ wsEventsInWindow: 8 })
    const issues = analyzeAudit(snapshot)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('storm')
  })

  // 7. High request count → warn
  // Значення беруться З КОНФІГУ, а не числами в тесті: пороги вже змінювали
  // (15/25 → 20/30), і тест мовчки червонів, поки хтось не поліз. Тепер він
  // перевіряє ПОВЕДІНКУ порогу, а не конкретне число.
  it('returns warn issue on elevated requests (above warn threshold)', () => {
    const t = DEFAULT_AUDIT_CONFIG.thresholds.requests
    const snapshot = createSnapshot({ requests: t.warn + 1 })
    const issues = analyzeAudit(snapshot)
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('warn')
    expect(issues[0].message).toContain('Elevated')
  })

  it('does not fire exactly AT the warn threshold (поріг — строго «більше»)', () => {
    const t = DEFAULT_AUDIT_CONFIG.thresholds.requests
    expect(analyzeAudit(createSnapshot({ requests: t.warn }))).toEqual([])
  })

  // 8. Very high request count → error
  it('returns error issue on high requests (above error threshold)', () => {
    const t = DEFAULT_AUDIT_CONFIG.thresholds.requests
    const snapshot = createSnapshot({ requests: t.error + 1 })
    const issues = analyzeAudit(snapshot)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('High request')
  })

  // 9. No cache queries → no cache issue even if hitRate=0
  it('skips cache issue when cacheTotal is 0', () => {
    const snapshot = createSnapshot({ cacheTotal: 0, cacheHitRate: 0 })
    const issues = analyzeAudit(snapshot)
    expect(issues).toEqual([])
  })

  // 10. Stable IDs for Vue key reconciliation
  it('generates stable unique IDs', () => {
    const snapshot = createSnapshot({ duplicates: 2, wsEventsInWindow: 8 })
    const issues = analyzeAudit(snapshot)
    expect(issues[0].id).toBe('duplicate-2')
    expect(issues[1].id).toBe('ws-storm-8')
  })
})
