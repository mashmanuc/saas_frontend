// WB B21: Unit tests for LessonFilterBar component
// Ref: DAY23_AGENT-B.md

import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import LessonFilterBar from '../components/lessons/LessonFilterBar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      lessons: {
        searchPlaceholder: 'Search lessons...',
        allCategories: 'All',
        filtered: '{count} lessons',
        clearFilters: 'Clear filters',
        noResults: 'No lessons match filters',
        filterLabel: 'Filter lessons',
      },
    },
  },
})

const categories = [
  { id: 1, name: 'Math', slug: 'math' },
  { id: 2, name: 'Physics', slug: 'physics' },
]

function mountBar(props = {}) {
  return mount(LessonFilterBar, {
    global: { plugins: [i18n] },
    props: {
      categories,
      availableTags: [],
      filteredCount: 10,
      ...props,
    },
  })
}

describe('LessonFilterBar (B21)', () => {
  // Test 1
  it('renders search input', () => {
    const w = mountBar()
    expect(w.find('[data-testid="lesson-search"]').exists()).toBe(true)
  })

  // Test 2
  it('renders All chip + category chips', () => {
    const w = mountBar()
    expect(w.get('[data-testid="category-all"]').text()).toBeTruthy()
    expect(w.get('[data-testid="category-math"]').text()).toBe('Math')
    expect(w.get('[data-testid="category-physics"]').text()).toBe('Physics')
  })

  // Test 3
  it('emits update:category with category id on chip click', async () => {
    const w = mountBar()
    await w.get('[data-testid="category-math"]').trigger('click')
    expect(w.emitted('update:category')?.[0]).toEqual([1])
  })

  // Test 4
  it('emits update:category null when All clicked', async () => {
    const w = mountBar()
    await w.get('[data-testid="category-math"]').trigger('click')
    await w.get('[data-testid="category-all"]').trigger('click')
    const emits = w.emitted('update:category')!
    expect(emits[emits.length - 1]).toEqual([null])
  })

  // Test 5
  it('renders tag buttons when availableTags provided', () => {
    const w = mountBar({ categories: [], availableTags: ['algebra', 'calculus'], filteredCount: 2 })
    expect(w.find('[data-testid="tag-algebra"]').exists()).toBe(true)
    expect(w.find('[data-testid="tag-calculus"]').exists()).toBe(true)
  })

  // Test 6
  it('toggles tag: emits selected then deselected', async () => {
    const w = mountBar({ categories: [], availableTags: ['algebra'], filteredCount: 1 })
    await w.get('[data-testid="tag-algebra"]').trigger('click')
    expect(w.emitted('update:tags')?.[0]).toEqual([['algebra']])
    await w.get('[data-testid="tag-algebra"]').trigger('click')
    expect(w.emitted('update:tags')?.[1]).toEqual([[]])
  })

  // Test 7
  it('shows clear button when category filter active', async () => {
    const w = mountBar()
    await w.get('[data-testid="category-math"]').trigger('click')
    expect(w.find('[data-testid="clear-filters"]').exists()).toBe(true)
  })

  // Test 8
  it('emits clear on clear button click', async () => {
    const w = mountBar()
    await w.get('[data-testid="category-math"]').trigger('click')
    await w.get('[data-testid="clear-filters"]').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
  })

  // Test 9
  it('hides clear button when no filters active', () => {
    const w = mountBar({ categories: [], availableTags: [], filteredCount: 5 })
    expect(w.find('[data-testid="clear-filters"]').exists()).toBe(false)
  })

  // Test 10
  it('active chip gets .active class', async () => {
    const w = mountBar()
    await w.get('[data-testid="category-math"]').trigger('click')
    expect(w.get('[data-testid="category-math"]').classes()).toContain('active')
    expect(w.get('[data-testid="category-all"]').classes()).not.toContain('active')
  })

  // Test 11
  it('active tag gets .active class', async () => {
    const w = mountBar({ categories: [], availableTags: ['algebra'], filteredCount: 1 })
    await w.get('[data-testid="tag-algebra"]').trigger('click')
    expect(w.get('[data-testid="tag-algebra"]').classes()).toContain('active')
  })

  // Test 12
  it('does not render tag section when availableTags is empty', () => {
    const w = mountBar({ categories: [], availableTags: [], filteredCount: 0 })
    expect(w.find('.lesson-filter-bar__tags').exists()).toBe(false)
  })
})
