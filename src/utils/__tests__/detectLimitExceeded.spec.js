import { describe, it, expect } from 'vitest'
import { detectLimitExceeded } from '../apiClient'

describe('Ф3 detectLimitExceeded (403 LIMIT_EXCEEDED → paywall key)', () => {
  it('flat 403 LIMIT_EXCEEDED → повертає key', () => {
    expect(detectLimitExceeded(403, { error: 'LIMIT_EXCEEDED', key: 'monthly_ai_requests' }))
      .toBe('monthly_ai_requests')
    expect(detectLimitExceeded(403, { error: 'LIMIT_EXCEEDED', key: 'monthly_exports' }))
      .toBe('monthly_exports')
  })

  it('вкладена форма error-response (dual-shape)', () => {
    expect(detectLimitExceeded(403, { error: { code: 'LIMIT_EXCEEDED', key: 'monthly_imports' } }))
      .toBe('monthly_imports')
  })

  it('403 без key → generic', () => {
    expect(detectLimitExceeded(403, { error: 'LIMIT_EXCEEDED' })).toBe('generic')
  })

  it('НЕ спрацьовує на 409 (точка №3 student-limit — інший UX)', () => {
    expect(detectLimitExceeded(409, { code: 'STUDENT_LIMIT_EXCEEDED' })).toBeNull()
  })

  it('НЕ спрацьовує на звичайний 403 (доступ заборонено)', () => {
    expect(detectLimitExceeded(403, { error: 'FORBIDDEN' })).toBeNull()
    expect(detectLimitExceeded(403, { detail: 'no access' })).toBeNull()
  })

  it('НЕ спрацьовує на інші статуси / порожнє тіло', () => {
    expect(detectLimitExceeded(500, { error: 'LIMIT_EXCEEDED' })).toBeNull()
    expect(detectLimitExceeded(403, null)).toBeNull()
    expect(detectLimitExceeded(403, 'string body')).toBeNull()
  })
})
