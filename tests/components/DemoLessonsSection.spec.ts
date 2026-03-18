// Phase 13 B3.4: Tests for DemoLessonsSection + DemoLessonCard
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import DemoLessonsSection from '@/modules/knowledge/components/DemoLessonsSection.vue'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({
  default: { get: mockGet },
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        demo: {
          title: 'Demo lessons',
          subtitle: 'See how lessons go with this tutor',
          empty: "This tutor hasn't published demo lessons yet",
          duration: '{minutes} min',
          durationHours: '{hours} h {minutes} min',
        },
      },
      subject: {
        math: 'Mathematics',
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const mockLessons = [
  {
    id: '1',
    title: 'Quadratic Equations',
    slug: 'quadratic-equations',
    tutor_slug: 'john-d',
    subject_tag: 'math',
    duration_seconds: 2700,
    created_at: '2026-03-14T10:00:00Z',
    board_thumbnail_url: null,
  },
  {
    id: '2',
    title: 'Newton Laws',
    slug: 'newton-laws',
    tutor_slug: 'john-d',
    subject_tag: 'physics',
    duration_seconds: 3600,
    created_at: '2026-03-15T10:00:00Z',
    board_thumbnail_url: 'https://example.com/thumb.jpg',
  },
]

function mountSection(slug = 'john-d') {
  return mount(DemoLessonsSection, {
    props: { tutorSlug: slug },
    global: {
      plugins: [i18n],
      stubs: { 'router-link': routerLinkStub },
    },
  })
}

describe('DemoLessonsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders lessons when API returns data', async () => {
    mockGet.mockResolvedValueOnce({ data: mockLessons })
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('.demo-lessons-section__title').text()).toBe('Demo lessons')
    expect(wrapper.findAll('.demo-lesson-card')).toHaveLength(2)
  })

  it('does not render section when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('.demo-lessons-section').exists()).toBe(false)
  })

  it('shows loading skeletons while fetching', async () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = mountSection()
    await nextTick()

    expect(wrapper.findAll('.demo-lessons-section__skeleton').length).toBeGreaterThan(0)
  })

  it('handles API error gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountSection()
    await flushPromises()

    // Should not crash, section should not render
    expect(wrapper.find('.demo-lessons-section').exists()).toBe(false)
  })

  it('calls API with correct URL', async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    mountSection('test-tutor')
    await flushPromises()

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/knowledge/public/tutors/test-tutor/demo-lessons/',
    )
  })

  it('renders lesson card with title and duration', async () => {
    mockGet.mockResolvedValueOnce({ data: [mockLessons[0]] })
    const wrapper = mountSection()
    await flushPromises()

    const card = wrapper.find('.demo-lesson-card')
    expect(card.exists()).toBe(true)
    expect(card.find('.demo-lesson-card__title').text()).toBe('Quadratic Equations')
    expect(card.find('.demo-lesson-card__duration').text()).toContain('45 min')
  })

  it('renders card with thumbnail image when provided', async () => {
    mockGet.mockResolvedValueOnce({ data: [mockLessons[1]] })
    const wrapper = mountSection()
    await flushPromises()

    const img = wrapper.find('.demo-lesson-card__img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/thumb.jpg')
  })

  it('renders placeholder when no thumbnail', async () => {
    mockGet.mockResolvedValueOnce({ data: [mockLessons[0]] })
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('.demo-lesson-card__placeholder').exists()).toBe(true)
  })

  it('lesson card links to correct URL', async () => {
    mockGet.mockResolvedValueOnce({ data: [mockLessons[0]] })
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.html()).toContain('/lesson/john-d/quadratic-equations')
  })
})
