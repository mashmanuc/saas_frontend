// Phase 14 B3.3: Tests for LessonTemplateCard component
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LessonTemplateCard from '@/modules/knowledge/components/LessonTemplateCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        template: {
          useButton: 'Use',
          usedCount: 'Used {count} times',
          community: 'Community',
          difficultyLabel: 'Difficulty level',
        },
        fork: {
          badge: 'Fork from {author}',
        },
      },
      subject: {
        math: 'Mathematics',
        physics: 'Physics',
        other: 'Other',
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  props: ['to'],
}

function makeTemplate(overrides = {}) {
  return {
    id: 'tpl-1',
    source_lesson_title: 'Algebra Basics',
    source_lesson_slug: 'algebra-basics',
    tutor_name: 'Jane Doe',
    tutor_slug: 'jane-doe',
    tutor_avatar_url: null,
    is_community: true,
    used_count: 42,
    subject_tag: 'math',
    difficulty_level: 3,
    board_thumbnail_url: null,
    created_at: '2026-03-10T10:00:00Z',
    parent_lesson: null,
    ...overrides,
  }
}

function mountCard(overrides = {}) {
  return mount(LessonTemplateCard, {
    props: { template: makeTemplate(overrides) },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: routerLinkStub },
    },
  })
}

describe('LessonTemplateCard', () => {
  it('renders lesson title', () => {
    const w = mountCard()
    expect(w.find('h3').text()).toBe('Algebra Basics')
  })

  it('shows subject badge with i18n', () => {
    const w = mountCard()
    expect(w.text()).toContain('Mathematics')
  })

  it('shows community badge when is_community', () => {
    const w = mountCard({ is_community: true })
    expect(w.text()).toContain('Community')
  })

  it('hides community badge when not community', () => {
    const w = mountCard({ is_community: false })
    expect(w.text()).not.toContain('Community')
  })

  it('shows used count', () => {
    const w = mountCard({ used_count: 42 })
    expect(w.text()).toContain('Used 42 times')
  })

  it('renders tutor name as link', () => {
    const w = mountCard()
    const link = w.find('a[href="/marketplace/jane-doe"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Jane Doe')
  })

  it('emits clone when CTA button clicked', async () => {
    const w = mountCard()
    await w.find('button').trigger('click')
    expect(w.emitted('clone')).toBeTruthy()
    expect(w.emitted('clone')![0]).toEqual(['tpl-1'])
  })

  it('shows fallback icon when no thumbnail', () => {
    const w = mountCard({ board_thumbnail_url: null })
    // LayoutDashboard lucide icon renders as svg
    expect(w.find('.aspect-video svg').exists()).toBe(true)
  })

  it('shows thumbnail image when URL provided', () => {
    const w = mountCard({ board_thumbnail_url: 'https://example.com/thumb.jpg' })
    const img = w.find('.aspect-video img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/thumb.jpg')
  })

  it('sets aria-label from title', () => {
    const w = mountCard()
    expect(w.find('article').attributes('aria-label')).toBe('Algebra Basics')
  })

  it('renders difficulty stars', () => {
    const w = mountCard({ difficulty_level: 4 })
    // DifficultyStars renders 5 SVGs (Star icons)
    const starContainer = w.find('.difficulty-stars')
    expect(starContainer.exists()).toBe(true)
  })

  it('renders fork badge when parent_lesson exists', () => {
    const w = mountCard({
      parent_lesson: { tutor_name: 'Bob', tutor_slug: 'bob', slug: 'orig-lesson' },
    })
    expect(w.text()).toContain('Fork from Bob')
  })

  it('hides fork badge when parent_lesson is null', () => {
    const w = mountCard({ parent_lesson: null })
    expect(w.text()).not.toContain('Fork from')
  })
})
