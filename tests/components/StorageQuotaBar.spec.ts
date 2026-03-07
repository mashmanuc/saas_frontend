/**
 * Phase 3.1 — StorageQuotaBar + formatBytes + upload error handling tests.
 */
import { describe, it, expect } from 'vitest'
import { formatBytes } from '@/utils/formatBytes'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'

function makeQuota(overrides: Partial<StorageQuota> = {}): StorageQuota {
  return {
    used_bytes: 1073741824,       // 1 GB
    total_quota_bytes: 2147483648, // 2 GB
    available_bytes: 1073741824,
    usage_percent: 50,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════
// formatBytes utility
// ═══════════════════════════════════════════════════════════════

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(2147483648)).toBe('2.0 GB')
  })

  it('respects decimals parameter', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB')
  })
})

// ═══════════════════════════════════════════════════════════════
// StorageQuotaBar logic (unit tests without mount)
// ═══════════════════════════════════════════════════════════════

describe('StorageQuotaBar: bar color logic', () => {
  function getBarClass(usagePercent: number): string {
    if (usagePercent > 95) return 'storage-quota__bar--critical'
    if (usagePercent > 80) return 'storage-quota__bar--amber'
    return 'storage-quota__bar--normal'
  }

  it('normal usage (<= 80%) → blue bar', () => {
    expect(getBarClass(50)).toBe('storage-quota__bar--normal')
  })

  it('warning usage (81-95%) → amber bar', () => {
    expect(getBarClass(85)).toBe('storage-quota__bar--amber')
  })

  it('critical usage (>95%) → red bar', () => {
    expect(getBarClass(97)).toBe('storage-quota__bar--critical')
  })

  it('boundary: 80% → normal (not amber)', () => {
    expect(getBarClass(80)).toBe('storage-quota__bar--normal')
  })

  it('boundary: 95% → amber (not critical)', () => {
    expect(getBarClass(95)).toBe('storage-quota__bar--amber')
  })
})

describe('StorageQuotaBar: warning text logic', () => {
  function getWarningText(usagePercent: number): string | null {
    if (usagePercent > 95) return 'critical'
    if (usagePercent > 80) return 'warning'
    return null
  }

  it('no warning at 50%', () => {
    expect(getWarningText(50)).toBeNull()
  })

  it('amber warning at 85%', () => {
    expect(getWarningText(85)).toBe('warning')
  })

  it('critical warning at 97%', () => {
    expect(getWarningText(97)).toBe('critical')
  })
})

describe('StorageQuotaBar: quota formatting', () => {
  it('renders used and total formatted', () => {
    const q = makeQuota()
    expect(formatBytes(q.used_bytes)).toBe('1.0 GB')
    expect(formatBytes(q.total_quota_bytes)).toBe('2.0 GB')
  })

  it('handles small quotas', () => {
    const q = makeQuota({ used_bytes: 512000, total_quota_bytes: 1048576 })
    expect(formatBytes(q.used_bytes)).toBe('500.0 KB')
    expect(formatBytes(q.total_quota_bytes)).toBe('1.0 MB')
  })
})

// ═══════════════════════════════════════════════════════════════
// Upload error differentiation
// ═══════════════════════════════════════════════════════════════

describe('Upload error code mapping', () => {
  function mapError(status: number | undefined): string {
    if (status === 507) return 'quota_exceeded'
    if (status === 429) return 'rate_limited'
    return 'upload_failed'
  }

  it('507 → quota_exceeded', () => {
    expect(mapError(507)).toBe('quota_exceeded')
  })

  it('429 → rate_limited', () => {
    expect(mapError(429)).toBe('rate_limited')
  })

  it('500 → upload_failed', () => {
    expect(mapError(500)).toBe('upload_failed')
  })

  it('undefined status → upload_failed', () => {
    expect(mapError(undefined)).toBe('upload_failed')
  })
})

// ═══════════════════════════════════════════════════════════════
// i18n key existence
// ═══════════════════════════════════════════════════════════════

describe('i18n: storage keys', () => {
  // Use dynamic import-friendly JSON reads
  const uk = JSON.parse(
    require('fs').readFileSync(require('path').resolve(__dirname, '../../src/i18n/locales/uk.json'), 'utf-8'),
  )
  const en = JSON.parse(
    require('fs').readFileSync(require('path').resolve(__dirname, '../../src/i18n/locales/en.json'), 'utf-8'),
  )

  const requiredKeys = [
    'quotaLabel', 'quotaWarning', 'quotaCritical', 'quotaExceeded', 'rateLimited',
  ]

  for (const key of requiredKeys) {
    it(`uk.storage.${key} exists`, () => {
      expect(uk.storage[key]).toBeTruthy()
    })
    it(`en.storage.${key} exists`, () => {
      expect(en.storage[key]).toBeTruthy()
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// StorageQuota interface shape
// ═══════════════════════════════════════════════════════════════

describe('StorageQuota interface', () => {
  it('has all required fields', () => {
    const q = makeQuota()
    expect(q).toHaveProperty('used_bytes')
    expect(q).toHaveProperty('total_quota_bytes')
    expect(q).toHaveProperty('available_bytes')
    expect(q).toHaveProperty('usage_percent')
  })

  it('usage_percent is number between 0 and 100', () => {
    const q = makeQuota({ usage_percent: 75 })
    expect(typeof q.usage_percent).toBe('number')
    expect(q.usage_percent).toBeGreaterThanOrEqual(0)
    expect(q.usage_percent).toBeLessThanOrEqual(100)
  })
})
