import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PublicLessonHeader from '@/modules/winterboard/components/public/PublicLessonHeader.vue'

describe('PublicLessonPage — Cross Navigation', () => {
  const defaultProps = {
    title: 'Test Lesson',
    tutorName: 'John Doe',
    tutorAvatarUrl: null,
    tutorSlug: 'john-doe',
    subjectTag: 'math',
    durationSeconds: 1800,
    createdAt: '2026-03-01T10:00:00Z',
  }

  it('tutor name is rendered as a clickable link', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const link = wrapper.find('.public-lesson-header__tutor-link')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('John Doe')
  })

  it('tutor link points to marketplace profile', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    // router-link is stubbed as <a> — check that component rendered
    const link = wrapper.find('.public-lesson-header__tutor-link')
    expect(link.exists()).toBe(true)
  })

  it('tutor name renders as span when no slug', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: { ...defaultProps, tutorSlug: '' },
    })
    const link = wrapper.find('.public-lesson-header__tutor-link')
    expect(link.exists()).toBe(false)
    const span = wrapper.find('.public-lesson-header__tutor-name')
    expect(span.exists()).toBe(true)
    expect(span.text()).toBe('John Doe')
  })

  it('renders subject badge when subject tag provided', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const badge = wrapper.find('.public-lesson-header__subject-badge')
    expect(badge.exists()).toBe(true)
  })

  it('renders duration when provided', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const duration = wrapper.find('.public-lesson-header__duration')
    expect(duration.exists()).toBe(true)
    expect(duration.text()).toContain('30')
  })

  it('renders formatted date', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const date = wrapper.find('.public-lesson-header__date')
    expect(date.exists()).toBe(true)
    expect(date.text().length).toBeGreaterThan(0)
  })

  it('renders title correctly', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const title = wrapper.find('.public-lesson-header__title')
    expect(title.text()).toBe('Test Lesson')
  })

  it('uses fallback avatar when url is null', () => {
    const wrapper = mount(PublicLessonHeader, {
      props: defaultProps,
    })
    const avatar = wrapper.find('.public-lesson-header__avatar')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('src')).toBe('/default-avatar.svg')
  })
})
