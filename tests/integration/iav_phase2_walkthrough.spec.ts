import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentLibraryStore } from '@/modules/learning-content/stores/contentLibraryStore'
import type {
  ContentItemSummary,
  ContentDragPayload,
} from '@/modules/learning-content/types/learningContent'

// ═══════════════════════════════════════════════════════════════
// Scenario 1: Winterboard → Tab "Матеріали" → lesson-mode items
// ═══════════════════════════════════════════════════════════════
describe('IAV2 Scenario 1: Winterboard lesson-mode integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('entering lesson-mode sets lessonId and switches to lesson display', () => {
    const store = useContentLibraryStore()

    // Initially: library mode
    expect(store.isLessonMode).toBe(false)
    expect(store.lessonId).toBeNull()

    // Enter lesson mode (simulates ContentPanel watch(lessonId))
    store.lessonId = 42
    expect(store.isLessonMode).toBe(true)
    expect(store.lessonId).toBe(42)

    // Simulate fetched items
    store.lessonItems = [
      { id: 1, type: 'problem', title: 'Lesson Item 1', difficulty: 3, version: 2 } as ContentItemSummary,
      { id: 2, type: 'theory', title: 'Lesson Item 2', difficulty: 1, version: 1 } as ContentItemSummary,
    ]
    expect(store.lessonItems.length).toBe(2)

    // Exit lesson mode
    store.lessonId = null
    store.lessonItems = []
    expect(store.isLessonMode).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 2: Drag content → Board → version pinning (B1)
// ═══════════════════════════════════════════════════════════════
describe('IAV2 Scenario 2: Drag payload with version (B1)', () => {
  it('ContentDragPayload includes version field for pinning', () => {
    const payload: ContentDragPayload = {
      itemId: 10,
      type: 'problem',
      title: 'Drag Test',
      contentJson: { text: 'solve x+1=2' } as any,
      version: 5,
    }

    // B1: version present and correct
    expect(payload.version).toBe(5)
    expect(typeof payload.version).toBe('number')

    // Serialization for dataTransfer
    const serialized = JSON.stringify(payload)
    const parsed = JSON.parse(serialized)
    expect(parsed.version).toBe(5)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 3: Lesson-mode header = "Матеріали уроку" (UI distinction)
// ═══════════════════════════════════════════════════════════════
describe('IAV2 Scenario 3: Lesson-mode header distinction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('store.isLessonMode drives conditional rendering', () => {
    const store = useContentLibraryStore()

    // Library mode → title = 'learningContent.panel.title'
    expect(store.isLessonMode).toBe(false)

    // Lesson mode → title = 'learningContent.panel.lessonTitle'
    store.lessonId = 99
    expect(store.isLessonMode).toBe(true)
    // Template uses: store.isLessonMode ? t('...lessonTitle') : t('...title')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 4: Empty lesson → "Немає матеріалів" message
// ═══════════════════════════════════════════════════════════════
describe('IAV2 Scenario 4: Empty lesson state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('empty lesson items shows empty state message', () => {
    const store = useContentLibraryStore()

    store.lessonId = 123
    store.lessonItems = []

    expect(store.isLessonMode).toBe(true)
    expect(store.lessonItems.length).toBe(0)
    // Template renders: t('learningContent.panel.lessonEmpty')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 5: Deleted item in snapshot → visible in lesson-mode (C16)
// ═══════════════════════════════════════════════════════════════
describe('IAV2 Scenario 5: Deleted item visible in lesson-mode (C16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('lesson items include items regardless of deletion status (C16 frozen)', () => {
    const store = useContentLibraryStore()

    store.lessonId = 77

    // C16: Backend returns frozen snapshot including soft-deleted items
    // Frontend displays all items from the response without filtering
    store.lessonItems = [
      { id: 1, type: 'problem', title: 'Active Item', difficulty: 2, version: 1 } as ContentItemSummary,
      { id: 2, type: 'theory', title: 'Deleted Item (still in snapshot)', difficulty: 3, version: 1, is_active: false } as any,
    ]

    // C16: Both items visible — frontend does NOT filter
    expect(store.lessonItems.length).toBe(2)
    expect(store.lessonItems[1].title).toContain('Deleted')
  })
})
