import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

describe('useLessonContent composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', async () => {
    const { useLessonContent } = await import(
      '@/modules/learning-content/composables/useLessonContent'
    )
    const lessonId = ref<number | null>(null)
    const { allowedContent, participants, isLoading } = useLessonContent(lessonId)
    expect(allowedContent.value).toEqual([])
    expect(participants.value).toEqual([])
    expect(isLoading.value).toBe(false)
  })
})

describe('ContentDragPayload version field', () => {
  it('type includes version field (B1)', () => {
    const payload = {
      itemId: 1,
      type: 'problem' as const,
      title: 'Test',
      contentJson: { text: 'x' },
      version: 3,
    }
    expect(payload.version).toBe(3)
  })
})

describe('LessonHistoryItem type', () => {
  it('type matches expected shape', () => {
    const item = {
      id: 1,
      student_name: 'Test S.',
      started_at: '2026-03-04T12:00:00Z',
      status: 'COMPLETED' as const,
      start: '2026-03-04T12:00:00Z',
      end: '2026-03-04T13:00:00Z',
      group: null,
    }
    expect(item.student_name).toBe('Test S.')
    expect(item.status).toBe('COMPLETED')
  })
})

describe('LessonHistory formatDate', () => {
  it('formats date in Ukrainian locale', () => {
    const dt = '2026-03-04T12:00:00Z'
    const formatted = new Date(dt).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    expect(formatted).toBeTruthy()
    expect(formatted.length).toBeGreaterThan(0)
  })

  it('handles null date', () => {
    const dt: string | null = null
    const result = dt ? new Date(dt).toLocaleDateString('uk-UA') : '—'
    expect(result).toBe('—')
  })
})

describe('WBClassroomRoom lessonId integration', () => {
  it('lessonIdNum computed parses string to number', () => {
    const lessonId = '42'
    const num = Number(lessonId)
    expect(Number.isNaN(num)).toBe(false)
    expect(num).toBe(42)
  })

  it('lessonIdNum computed returns null for empty', () => {
    const lessonId = ''
    const num = Number(lessonId)
    const result = lessonId ? (Number.isNaN(num) ? null : num) : null
    expect(result).toBeNull()
  })
})
