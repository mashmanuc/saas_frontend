// Phase 13 B3.4: Tests for PublicLessonHeader component
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PublicLessonHeader from '@/modules/winterboard/components/public/PublicLessonHeader.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      publicLesson: {
        header: { hourShort: 'h', minShort: 'min' },
      },
      subject: {
        math: 'Mathematics',
        physics: 'Physics',
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const defaultProps = {
  title: 'Quadratic Equations',
  tutorName: 'John D.',
  tutorAvatarUrl: 'https://example.com/avatar.jpg',
  tutorSlug: 'john-d',
  subjectTag: 'math',
  durationSeconds: 2700, // 45 min
  createdAt: '2026-03-14T10:00:00Z',
}

function mountHeader(propsOverride = {}) {
  return mount(PublicLessonHeader, {
    props: { ...defaultProps, ...propsOverride },
    global: {
      plugins: [i18n],
      stubs: { 'router-link': routerLinkStub },
    },
  })
}

describe('PublicLessonHeader', () => {
  it('renders title', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('.public-lesson-header__title').text()).toBe('Quadratic Equations')
  })

  it('renders tutor name as link to marketplace profile', () => {
    const wrapper = mountHeader()
    const link = wrapper.find('.public-lesson-header__tutor-link')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('John D.')
    expect(link.attributes('href')).toBe('/marketplace/john-d')
  })

  it('renders subject badge with i18n label', () => {
    const wrapper = mountHeader()
    const badge = wrapper.find('.public-lesson-header__subject-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Mathematics')
  })

  it('renders unknown subject tag as-is', () => {
    const wrapper = mountHeader({ subjectTag: 'robotics' })
    expect(wrapper.find('.public-lesson-header__subject-badge').text()).toBe('robotics')
  })

  it('formats duration correctly — minutes only', () => {
    const wrapper = mountHeader({ durationSeconds: 2700 })
    expect(wrapper.find('.public-lesson-header__duration').text()).toContain('45 min')
  })

  it('formats duration with seconds', () => {
    const wrapper = mountHeader({ durationSeconds: 323 }) // 5:23
    expect(wrapper.find('.public-lesson-header__duration').text()).toContain('5:23')
  })

  it('formats duration — hours and minutes', () => {
    const wrapper = mountHeader({ durationSeconds: 4500 }) // 1h 15min
    const text = wrapper.find('.public-lesson-header__duration').text()
    expect(text).toContain('1')
    expect(text).toContain('h')
    expect(text).toContain('15')
    expect(text).toContain('min')
  })

  it('uses fallback avatar when tutorAvatarUrl is null', () => {
    const wrapper = mountHeader({ tutorAvatarUrl: null })
    const img = wrapper.find('.public-lesson-header__avatar')
    expect(img.attributes('src')).toBe('/default-avatar.svg')
  })

  it('renders localized date', () => {
    const wrapper = mountHeader()
    const dateEl = wrapper.find('.public-lesson-header__date')
    expect(dateEl.exists()).toBe(true)
    // Just check it renders something (locale-dependent)
    expect(dateEl.text().length).toBeGreaterThan(0)
  })

  it('renders tutor name as plain span when tutorSlug is empty', () => {
    const wrapper = mountHeader({ tutorSlug: '' })
    expect(wrapper.find('.public-lesson-header__tutor-link').exists()).toBe(false)
    expect(wrapper.find('.public-lesson-header__tutor-name').text()).toBe('John D.')
  })
})
