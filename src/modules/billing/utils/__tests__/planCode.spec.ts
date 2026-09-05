/**
 * PR-1 білінгу, інваріант 4: коди планів порівнюються канонічно й лише тут.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizePlanCode,
  isSamePlan,
  isFreePlanCode,
  isProFamilyPlanCode,
  isBusinessPlanCode,
  planTier,
  isSameTier,
} from '../planCode'

describe('planCode', () => {
  it('normalizePlanCode: trim + uppercase; не-рядок → порожньо', () => {
    expect(normalizePlanCode(' Free ')).toBe('FREE')
    expect(normalizePlanCode('pro')).toBe('PRO')
    expect(normalizePlanCode('PRO-USD')).toBe('PRO-USD')
    expect(normalizePlanCode(null)).toBe('')
    expect(normalizePlanCode(undefined)).toBe('')
    expect(normalizePlanCode(42)).toBe('')
    expect(normalizePlanCode('')).toBe('')
  })

  it('isSamePlan: free / FREE / " Free " — один план', () => {
    expect(isSamePlan('free', 'FREE')).toBe(true)
    expect(isSamePlan(' Free ', 'free')).toBe(true)
    expect(isSamePlan('PRO', 'pro')).toBe(true)
  })

  it('isSamePlan: різні плани — не той самий', () => {
    expect(isSamePlan('FREE', 'PRO')).toBe(false)
    expect(isSamePlan('PRO', 'PRO-USD')).toBe(false)
  })

  it('isSamePlan: порожній або відсутній код ніколи не «той самий»', () => {
    expect(isSamePlan('', '')).toBe(false)
    expect(isSamePlan(null, null)).toBe(false)
    expect(isSamePlan(undefined, 'FREE')).toBe(false)
    expect(isSamePlan('FREE', null)).toBe(false)
  })

  it('planTier: PRO-USD і PRO — один tier; FREE/BUSINESS — свої', () => {
    expect(planTier('pro-usd')).toBe('PRO')
    expect(planTier('PRO')).toBe('PRO')
    expect(planTier(' free ')).toBe('FREE')
    expect(planTier('BUSINESS')).toBe('BUSINESS')
    expect(planTier(null)).toBe('')
  })

  it('isSameTier: PRO ~ PRO-USD, але не PRO ~ BUSINESS; порожнє ніколи не збігається', () => {
    expect(isSameTier('PRO', 'pro-usd')).toBe(true)
    expect(isSameTier('PRO-USD', 'PRO')).toBe(true)
    expect(isSameTier('PRO', 'BUSINESS')).toBe(false)
    expect(isSameTier('FREE', 'free')).toBe(true)
    expect(isSameTier('', '')).toBe(false)
    expect(isSameTier(null, 'PRO')).toBe(false)
  })

  it('предикати родин планів', () => {
    expect(isFreePlanCode('free')).toBe(true)
    expect(isFreePlanCode('PRO')).toBe(false)
    expect(isProFamilyPlanCode('pro')).toBe(true)
    expect(isProFamilyPlanCode('PRO-USD')).toBe(true)
    expect(isProFamilyPlanCode('BUSINESS')).toBe(false)
    expect(isBusinessPlanCode('business')).toBe(true)
    expect(isBusinessPlanCode(null)).toBe(false)
  })
})
