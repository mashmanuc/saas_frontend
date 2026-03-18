// Phase 14 B3.3: Tests for LessonPackCard component
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LessonPackCard from '@/modules/knowledge/components/LessonPackCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        pack: {
          lessonCount: '{count} lessons',
          status: {
            draft: 'Draft',
            public: 'Published',
            hidden: 'Hidden',
          },
        },
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  props: ['to'],
}

function makePack(overrides = {}) {
  return {
    id: 'pack-1',
    title: 'Algebra Course',
    description: 'Complete algebra series',
    slug: 'algebra-course',
    status: 'public' as const,
    lesson_count: 5,
    tutor_name: 'Jane Doe',
    tutor_slug: 'jane-doe',
    created_at: '2026-03-10T10:00:00Z',
    ...overrides,
  }
}

function mountCard(overrides = {}, thumbnails: string[] = []) {
  return mount(LessonPackCard, {
    props: { pack: makePack(overrides), thumbnails },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: routerLinkStub },
    },
  })
}

describe('LessonPackCard', () => {
  it('renders pack title', () => {
    const w = mountCard()
    expect(w.find('h3').text()).toBe('Algebra Course')
  })

  it('links to pack page', () => {
    const w = mountCard()
    expect(w.html()).toContain('/pack/jane-doe/algebra-course')
  })

  it('shows tutor name', () => {
    const w = mountCard()
    expect(w.text()).toContain('Jane Doe')
  })

  it('shows lesson count', () => {
    const w = mountCard({ lesson_count: 5 })
    expect(w.text()).toContain('5 lessons')
  })

  it('shows public status badge', () => {
    const w = mountCard({ status: 'public' })
    expect(w.text()).toContain('Published')
  })

  it('shows draft status badge', () => {
    const w = mountCard({ status: 'draft' })
    expect(w.text()).toContain('Draft')
  })

  it('shows hidden status badge', () => {
    const w = mountCard({ status: 'hidden' })
    expect(w.text()).toContain('Hidden')
  })

  it('renders 2x2 grid with fallback icons when no thumbnails', () => {
    const w = mountCard()
    const gridCells = w.findAll('.grid > div')
    expect(gridCells.length).toBe(4)
    // Each cell should have SVG fallback (LayoutDashboard)
    expect(w.findAll('.grid svg').length).toBe(4)
  })

  it('renders thumbnail images when provided', () => {
    const thumbs = ['https://a.com/1.jpg', 'https://a.com/2.jpg']
    const w = mountCard({}, thumbs)
    const imgs = w.findAll('.grid img')
    expect(imgs.length).toBe(2)
    expect(imgs[0].attributes('src')).toBe('https://a.com/1.jpg')
  })

  it('sets aria-label from title', () => {
    const w = mountCard()
    const link = w.find('a')
    expect(link.attributes('aria-label')).toBe('Algebra Course')
  })
})
