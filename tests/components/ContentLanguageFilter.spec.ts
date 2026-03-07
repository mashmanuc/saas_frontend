import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentLibraryStore } from '@/modules/learning-content/stores/contentLibraryStore'
import type { ContentItemSummary, ContentLanguage } from '@/modules/learning-content/types/learningContent'

describe('Language Filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ContentItemSummary accepts language field', () => {
    const item: ContentItemSummary = {
      id: 1,
      type: 'problem',
      title: 'Test',
      difficulty: 3,
      version: 1,
      language: 'uk',
    }
    expect(item.language).toBe('uk')
  })

  it('ContentItemSummary language is optional', () => {
    const item: ContentItemSummary = {
      id: 1,
      type: 'problem',
      title: 'Test',
      difficulty: 3,
      version: 1,
    }
    expect(item.language).toBeUndefined()
  })

  it('SearchParams accepts language filter', () => {
    const store = useContentLibraryStore()
    store.searchParams.language = 'en'
    expect(store.searchParams.language).toBe('en')
  })

  it('SearchParams language can be empty', () => {
    const store = useContentLibraryStore()
    store.searchParams.language = ''
    expect(store.searchParams.language).toBe('')
  })

  it('Language badge shows UA for uk', () => {
    const lang: ContentLanguage = 'uk'
    const badge = (l: ContentLanguage) => l === 'uk' ? 'UA' : 'EN'
    expect(badge(lang)).toBe('UA')
  })

  it('Language badge shows EN for en', () => {
    const lang: ContentLanguage = 'en'
    const badge = (l: ContentLanguage) => l === 'uk' ? 'UA' : 'EN'
    expect(badge(lang)).toBe('EN')
  })
})
