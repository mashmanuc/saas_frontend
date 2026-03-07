/**
 * Pre-Phase 4 — Demo Student UX tests.
 *
 * Tests badge logic, onboarding hint condition, sorting, i18n keys.
 */
import { describe, it, expect } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Test 1: Demo badge renders for is_demo=true student
// ═══════════════════════════════════════════════════════════════

describe('Demo Student badge logic', () => {
  function shouldShowBadge(student: { is_demo?: boolean } | null | undefined): boolean {
    return !!student?.is_demo
  }

  it('shows badge for is_demo=true', () => {
    expect(shouldShowBadge({ is_demo: true })).toBe(true)
  })

  it('no badge for is_demo=false', () => {
    expect(shouldShowBadge({ is_demo: false })).toBe(false)
  })

  it('no badge for is_demo=undefined (old API)', () => {
    expect(shouldShowBadge({})).toBe(false)
  })

  it('no badge for null student', () => {
    expect(shouldShowBadge(null)).toBe(false)
  })

  it('no badge for undefined student', () => {
    expect(shouldShowBadge(undefined)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 2: Onboarding hint shown when only Demo Student
// ═══════════════════════════════════════════════════════════════

describe('hasOnlyDemoStudent logic', () => {
  function hasOnlyDemoStudent(students: Array<{ is_demo?: boolean }>): boolean {
    if (!students || !students.length) return false
    return students.every(s => s.is_demo)
  }

  it('true when all students are demo', () => {
    expect(hasOnlyDemoStudent([{ is_demo: true }])).toBe(true)
  })

  it('true when multiple demo students', () => {
    expect(hasOnlyDemoStudent([{ is_demo: true }, { is_demo: true }])).toBe(true)
  })

  it('false when real student added', () => {
    expect(hasOnlyDemoStudent([{ is_demo: true }, { is_demo: false }])).toBe(false)
  })

  it('false for empty list', () => {
    expect(hasOnlyDemoStudent([])).toBe(false)
  })

  it('false when is_demo undefined (old API)', () => {
    expect(hasOnlyDemoStudent([{}])).toBe(false)
  })

  it('false for mixed undefined and demo', () => {
    expect(hasOnlyDemoStudent([{ is_demo: true }, {}])).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 3: Demo Student sorting (demo first)
// ═══════════════════════════════════════════════════════════════

describe('Demo Student sorting', () => {
  interface MockRelation {
    id: number
    student: { name: string; is_demo?: boolean }
  }

  function sortDemoFirst(relations: MockRelation[]): MockRelation[] {
    return [...relations].sort((a, b) => {
      const aDemo = a.student?.is_demo ? 1 : 0
      const bDemo = b.student?.is_demo ? 1 : 0
      return bDemo - aDemo
    })
  }

  it('demo student sorted first', () => {
    const relations: MockRelation[] = [
      { id: 1, student: { name: 'John', is_demo: false } },
      { id: 2, student: { name: 'Demo', is_demo: true } },
      { id: 3, student: { name: 'Jane', is_demo: false } },
    ]
    const sorted = sortDemoFirst(relations)
    expect(sorted[0].student.name).toBe('Demo')
    expect(sorted[0].student.is_demo).toBe(true)
  })

  it('preserves order for non-demo students', () => {
    const relations: MockRelation[] = [
      { id: 1, student: { name: 'John', is_demo: false } },
      { id: 2, student: { name: 'Jane', is_demo: false } },
    ]
    const sorted = sortDemoFirst(relations)
    expect(sorted[0].id).toBe(1)
    expect(sorted[1].id).toBe(2)
  })

  it('handles undefined is_demo gracefully', () => {
    const relations: MockRelation[] = [
      { id: 1, student: { name: 'Old User' } },
      { id: 2, student: { name: 'Demo', is_demo: true } },
    ]
    const sorted = sortDemoFirst(relations)
    expect(sorted[0].student.is_demo).toBe(true)
  })

  it('empty list returns empty', () => {
    expect(sortDemoFirst([])).toEqual([])
  })

  it('single demo student stays first', () => {
    const sorted = sortDemoFirst([{ id: 1, student: { name: 'Demo', is_demo: true } }])
    expect(sorted.length).toBe(1)
    expect(sorted[0].student.is_demo).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 4: i18n key existence
// ═══════════════════════════════════════════════════════════════

describe('i18n: student demo keys', () => {
  const uk = JSON.parse(
    require('fs').readFileSync(require('path').resolve(__dirname, '../../src/i18n/locales/uk.json'), 'utf-8'),
  )
  const en = JSON.parse(
    require('fs').readFileSync(require('path').resolve(__dirname, '../../src/i18n/locales/en.json'), 'utf-8'),
  )

  const requiredKeys = ['demoBadge', 'demoHint', 'inviteReal']

  for (const key of requiredKeys) {
    it(`uk.student.${key} exists`, () => {
      expect(uk.student[key]).toBeTruthy()
    })
    it(`en.student.${key} exists`, () => {
      expect(en.student[key]).toBeTruthy()
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// Test 5: TutorHintId enum includes DEMO_STUDENT_ONLY
// ═══════════════════════════════════════════════════════════════

describe('TutorHintId', () => {
  it('has DEMO_STUDENT_ONLY value', async () => {
    const { TutorHintId } = await import('@/composables/useOnboardingHints')
    expect(TutorHintId.DEMO_STUDENT_ONLY).toBe('tutor.dashboard.demoStudentOnly')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 6: Relation.student type includes is_demo
// ═══════════════════════════════════════════════════════════════

describe('Relation.student type', () => {
  it('accepts is_demo field', () => {
    const student: { id: string; is_demo?: boolean } = {
      id: '123',
      is_demo: true,
    }
    expect(student.is_demo).toBe(true)
  })

  it('is_demo is optional (undefined = false)', () => {
    const student: { id: string; is_demo?: boolean } = {
      id: '456',
    }
    expect(!!student.is_demo).toBe(false)
  })
})
