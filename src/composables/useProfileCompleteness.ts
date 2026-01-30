/**
 * useProfileCompleteness composable
 * Обчислює повноту профілю тьютора на основі заповнених полів
 */

import { computed, type Ref } from 'vue'
import type { TutorProfile } from '@/api/users'

export interface ProfileCompletenessResult {
  score: number
  percentage: number
  missingFields: string[]
  filledFields: string[]
  totalFields: number
}

const REQUIRED_FIELDS = [
  { key: 'bio', weight: 20, label: 'Bio' },
  { key: 'headline', weight: 15, label: 'Headline' },
  { key: 'experience', weight: 10, label: 'Experience' },
  { key: 'hourly_rate', weight: 15, label: 'Hourly Rate' },
  { key: 'subjects', weight: 20, label: 'Subjects', isArray: true },
  { key: 'certifications', weight: 10, label: 'Certifications', isArray: true },
  { key: 'avatar_url', weight: 10, label: 'Avatar' }
]

function isFieldFilled(value: any, isArray = false): boolean {
  if (value === null || value === undefined) return false
  if (isArray) return Array.isArray(value) && value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return value > 0
  return Boolean(value)
}

export function useProfileCompleteness(profile: Ref<TutorProfile | null>) {
  const completeness = computed<ProfileCompletenessResult>(() => {
    if (!profile.value) {
      return {
        score: 0,
        percentage: 0,
        missingFields: REQUIRED_FIELDS.map(f => f.label),
        filledFields: [],
        totalFields: REQUIRED_FIELDS.length
      }
    }

    let totalScore = 0
    const missingFields: string[] = []
    const filledFields: string[] = []

    REQUIRED_FIELDS.forEach(field => {
      const value = (profile.value as any)?.[field.key]
      const isFilled = isFieldFilled(value, field.isArray)

      if (isFilled) {
        totalScore += field.weight
        filledFields.push(field.label)
      } else {
        missingFields.push(field.label)
      }
    })

    return {
      score: totalScore,
      percentage: totalScore,
      missingFields,
      filledFields,
      totalFields: REQUIRED_FIELDS.length
    }
  })

  const isComplete = computed(() => completeness.value.percentage === 100)
  
  const nextMissingField = computed(() => {
    return completeness.value.missingFields[0] || null
  })

  return {
    completeness,
    isComplete,
    nextMissingField
  }
}
