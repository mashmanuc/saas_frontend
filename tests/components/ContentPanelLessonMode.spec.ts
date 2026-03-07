import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentLibraryStore } from '@/modules/learning-content/stores/contentLibraryStore'
import type { ContentItemSummary } from '@/modules/learning-content/types/learningContent'

describe('ContentPanel Lesson Mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('enterLessonMode sets lessonId', () => {
    const store = useContentLibraryStore()
    store.enterLessonMode(42)
    expect(store.lessonId).toBe(42)
    expect(store.isLessonMode).toBe(true)
  })

  it('exitLessonMode clears lessonId', () => {
    const store = useContentLibraryStore()
    store.enterLessonMode(42)
    store.exitLessonMode()
    expect(store.lessonId).toBeNull()
    expect(store.isLessonMode).toBe(false)
  })

  it('isLessonMode computed is reactive', () => {
    const store = useContentLibraryStore()
    expect(store.isLessonMode).toBe(false)
    store.enterLessonMode(1)
    expect(store.isLessonMode).toBe(true)
  })

  it('lessonItems initialized as empty array', () => {
    const store = useContentLibraryStore()
    expect(store.lessonItems).toEqual([])
  })

  it('reset clears lesson state', () => {
    const store = useContentLibraryStore()
    store.enterLessonMode(42)
    store.lessonItems = [{ id: 1, type: 'problem', title: 'T', difficulty: 1, version: 1 } as ContentItemSummary]
    store.reset()
    expect(store.lessonId).toBeNull()
    expect(store.lessonItems).toEqual([])
    expect(store.isLessonMode).toBe(false)
  })

  it('SearchParams accepts lesson_id', () => {
    const store = useContentLibraryStore()
    store.searchParams.lesson_id = 42
    expect(store.searchParams.lesson_id).toBe(42)
  })
})
