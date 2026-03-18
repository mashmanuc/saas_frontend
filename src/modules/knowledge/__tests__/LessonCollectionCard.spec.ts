// Phase 15 B3.3: Tests for LessonCollectionCard
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LessonCollectionCard from '../components/LessonCollectionCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        collection: {
          featured: 'Featured',
          lessonCount: '{count} lessons',
        },
      },
    },
  },
})

function makeCollection(overrides = {}) {
  return {
    id: 'col-1',
    title: 'Top Math Lessons',
    description: 'Best math lessons from the community',
    slug: 'top-math',
    is_featured: true,
    lesson_count: 10,
    ...overrides,
  }
}

function mountCard(overrides = {}, thumbnails: string[] = []) {
  return mount(LessonCollectionCard, {
    props: { collection: makeCollection(overrides), thumbnails },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('LessonCollectionCard', () => {
  it('renders collection title', () => {
    const w = mountCard()
    expect(w.find('h3').text()).toBe('Top Math Lessons')
  })

  it('links to /knowledge/collections/{slug}', () => {
    const w = mountCard()
    expect(w.html()).toContain('/knowledge/collections/top-math')
  })

  it('shows featured badge', () => {
    const w = mountCard({ is_featured: true })
    expect(w.text()).toContain('Featured')
  })

  it('hides featured badge when not featured', () => {
    const w = mountCard({ is_featured: false })
    expect(w.text()).not.toContain('Featured')
  })

  it('shows lesson count', () => {
    const w = mountCard({ lesson_count: 10 })
    expect(w.text()).toContain('10 lessons')
  })

  it('shows description', () => {
    const w = mountCard()
    expect(w.text()).toContain('Best math lessons from the community')
  })

  it('renders 2×2 grid with fallback icons when no thumbnails', () => {
    const w = mountCard()
    const gridCells = w.findAll('.grid > div')
    expect(gridCells.length).toBe(4)
    expect(w.findAll('.grid svg').length).toBe(4)
  })

  it('renders thumbnail images when provided', () => {
    const thumbs = ['https://a.com/1.jpg', 'https://a.com/2.jpg']
    const w = mountCard({}, thumbs)
    const imgs = w.findAll('.grid img')
    expect(imgs.length).toBe(2)
  })

  it('sets aria-label from title', () => {
    const w = mountCard()
    expect(w.find('a').attributes('aria-label')).toBe('Top Math Lessons')
  })
})
