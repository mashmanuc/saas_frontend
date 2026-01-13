/**
 * Feature Mapper Unit Tests (v0.77.0)
 * 
 * Tests for feature code to human-readable label mapping
 */

import { describe, it, expect, vi } from 'vitest'
import { getFeatureName, isKnownFeature, KNOWN_FEATURES } from '../featureMapper'

describe('featureMapper', () => {
  describe('getFeatureName', () => {
    it('returns translated feature name when translation exists', () => {
      const mockT = vi.fn((key: string) => {
        const translations: Record<string, string> = {
          'billing.features.CONTACT_UNLOCK': 'Необмежене розблокування контактів',
          'billing.features.PRIORITY_SUPPORT': 'Пріоритетна підтримка',
          'billing.features.ANALYTICS': 'Аналітика та статистика'
        }
        return translations[key] || key
      })

      expect(getFeatureName('CONTACT_UNLOCK', mockT)).toBe('Необмежене розблокування контактів')
      expect(getFeatureName('PRIORITY_SUPPORT', mockT)).toBe('Пріоритетна підтримка')
      expect(getFeatureName('ANALYTICS', mockT)).toBe('Аналітика та статистика')
    })

    it('returns formatted fallback when translation is missing', () => {
      const mockT = vi.fn((key: string) => key) // Returns key itself (no translation)

      expect(getFeatureName('CUSTOM_FEATURE', mockT)).toBe('Custom Feature')
      expect(getFeatureName('ADVANCED_SCHEDULING', mockT)).toBe('Advanced Scheduling')
      expect(getFeatureName('VIDEO_CALLS', mockT)).toBe('Video Calls')
    })

    it('handles lowercase feature codes', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('contact_unlock', mockT)).toBe('Contact Unlock')
      expect(getFeatureName('priority_support', mockT)).toBe('Priority Support')
    })

    it('handles mixed case feature codes', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('Contact_Unlock', mockT)).toBe('Contact Unlock')
      expect(getFeatureName('Priority_Support', mockT)).toBe('Priority Support')
    })

    it('returns empty string for empty input', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('', mockT)).toBe('')
    })

    it('handles feature codes without underscores', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('ANALYTICS', mockT)).toBe('Analytics')
      expect(getFeatureName('API', mockT)).toBe('Api')
    })

    it('handles feature codes with multiple underscores', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('VERY_LONG_FEATURE_NAME', mockT)).toBe('Very Long Feature Name')
    })

    it('does not show raw i18n keys in output', () => {
      const mockT = vi.fn((key: string) => key) // Simulates missing translation

      const result = getFeatureName('UNKNOWN_FEATURE', mockT)
      
      // Should NOT contain "billing.features."
      expect(result).not.toContain('billing.features.')
      // Should be human-readable
      expect(result).toBe('Unknown Feature')
    })
  })

  describe('isKnownFeature', () => {
    it('returns true for known features', () => {
      expect(isKnownFeature('CONTACT_UNLOCK')).toBe(true)
      expect(isKnownFeature('PRIORITY_SUPPORT')).toBe(true)
      expect(isKnownFeature('ANALYTICS')).toBe(true)
      expect(isKnownFeature('VIDEO_CALLS')).toBe(true)
    })

    it('returns false for unknown features', () => {
      expect(isKnownFeature('UNKNOWN_FEATURE')).toBe(false)
      expect(isKnownFeature('CUSTOM_FEATURE')).toBe(false)
      expect(isKnownFeature('')).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(isKnownFeature('contact_unlock')).toBe(false)
      expect(isKnownFeature('Contact_Unlock')).toBe(false)
    })
  })

  describe('KNOWN_FEATURES', () => {
    it('contains expected feature codes', () => {
      expect(KNOWN_FEATURES).toContain('CONTACT_UNLOCK')
      expect(KNOWN_FEATURES).toContain('PRIORITY_SUPPORT')
      expect(KNOWN_FEATURES).toContain('ANALYTICS')
      expect(KNOWN_FEATURES).toContain('ADVANCED_SCHEDULING')
      expect(KNOWN_FEATURES).toContain('VIDEO_CALLS')
      expect(KNOWN_FEATURES).toContain('UNLIMITED_STUDENTS')
    })

    it('has no duplicates', () => {
      const uniqueFeatures = [...new Set(KNOWN_FEATURES)]
      expect(uniqueFeatures.length).toBe(KNOWN_FEATURES.length)
    })

    it('all features are uppercase with underscores', () => {
      KNOWN_FEATURES.forEach(feature => {
        expect(feature).toMatch(/^[A-Z_]+$/)
      })
    })
  })

  describe('integration with i18n', () => {
    it('works correctly with vue-i18n t function', () => {
      // Simulate real vue-i18n behavior
      const translations: Record<string, string> = {
        'billing.features.CONTACT_UNLOCK': 'Необмежене розблокування контактів',
        'billing.features.PRIORITY_SUPPORT': 'Пріоритетна підтримка'
      }

      const mockT = (key: string) => translations[key] || key

      expect(getFeatureName('CONTACT_UNLOCK', mockT)).toBe('Необмежене розблокування контактів')
      expect(getFeatureName('PRIORITY_SUPPORT', mockT)).toBe('Пріоритетна підтримка')
      
      // Unknown feature should fallback gracefully
      expect(getFeatureName('NEW_FEATURE', mockT)).toBe('New Feature')
      expect(getFeatureName('NEW_FEATURE', mockT)).not.toContain('billing.features.')
    })
  })

  describe('edge cases', () => {
    it('handles null/undefined gracefully', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName(null as any, mockT)).toBe('')
      expect(getFeatureName(undefined as any, mockT)).toBe('')
    })

    it('handles numbers in feature codes', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('FEATURE_2FA', mockT)).toBe('Feature 2fa')
      expect(getFeatureName('API_V2_ACCESS', mockT)).toBe('Api V2 Access')
    })

    it('handles single character codes', () => {
      const mockT = vi.fn((key: string) => key)

      expect(getFeatureName('A', mockT)).toBe('A')
      expect(getFeatureName('X_Y_Z', mockT)).toBe('X Y Z')
    })
  })
})
