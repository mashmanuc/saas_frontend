// Phase 13 B3.4: Tests for TutorCTACard component
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import TutorCTACard from '@/modules/winterboard/components/public/TutorCTACard.vue'

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
  })),
}))

import { useAuthStore } from '@/modules/auth/store/authStore'
const mockAuth = vi.mocked(useAuthStore)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      publicLesson: {
        cta: {
          priceFrom: 'From {price} UAH/hour',
          book: 'Book a lesson',
          viewProfile: 'View profile',
          hint: 'Watch this lesson and book your first session',
          ariaLabel: 'Tutor card',
        },
      },
      subject: {
        math: 'Mathematics',
        physics: 'Physics',
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  props: ['to'],
}

const defaultProps = {
  tutorName: 'John D.',
  tutorAvatarUrl: 'https://example.com/avatar.jpg',
  tutorSlug: 'john-d',
  subjectTags: ['math', 'physics'],
  ratingAvg: 4.5,
  ratingCount: 12,
  priceFromUah: 350,
  lessonSlug: 'quadratic-equations',
}

function mountCard(propsOverride = {}, authenticated = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  mockAuth.mockReturnValue({ isAuthenticated: authenticated } as any)

  return mount(TutorCTACard, {
    props: { ...defaultProps, ...propsOverride },
    global: {
      plugins: [i18n, pinia],
      stubs: { 'router-link': routerLinkStub },
    },
  })
}

describe('TutorCTACard', () => {
  it('renders tutor name', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.tutor-cta__name').text()).toBe('John D.')
  })

  it('renders subject chips with i18n labels', () => {
    const wrapper = mountCard()
    const chips = wrapper.findAll('.tutor-cta__subject-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].text()).toBe('Mathematics')
    expect(chips[1].text()).toBe('Physics')
  })

  it('renders star rating', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.tutor-cta__rating-value').text()).toBe('4.5')
    expect(wrapper.find('.tutor-cta__rating-count').text()).toBe('(12)')
  })

  it('renders price', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.tutor-cta__price').text()).toContain('350')
  })

  it('hides price when null', () => {
    const wrapper = mountCard({ priceFromUah: null })
    expect(wrapper.find('.tutor-cta__price').exists()).toBe(false)
  })

  it('hides rating when null', () => {
    const wrapper = mountCard({ ratingAvg: null })
    expect(wrapper.find('.tutor-cta__rating').exists()).toBe(false)
  })

  it('book URL redirects to register for unauthenticated users', () => {
    const wrapper = mountCard({}, false)
    const bookBtn = wrapper.find('.tutor-cta__btn--primary')
    const href = bookBtn.attributes('href')
    expect(href).toContain('/auth/register')
    expect(href).toContain('ref=lesson_quadratic-equations')
    expect(href).toContain('redirect=')
  })

  it('book URL points to marketplace for authenticated users', () => {
    const wrapper = mountCard({}, true)
    const bookBtn = wrapper.find('.tutor-cta__btn--primary')
    const href = bookBtn.attributes('href')
    expect(href).toContain('/marketplace/john-d')
    expect(href).toContain('ref=lesson_quadratic-equations')
  })

  it('profile URL points to marketplace', () => {
    const wrapper = mountCard()
    const profileBtn = wrapper.find('.tutor-cta__btn--outline')
    expect(profileBtn.attributes('href')).toBe('/marketplace/john-d')
  })

  it('uses fallback avatar when URL is null', () => {
    const wrapper = mountCard({ tutorAvatarUrl: null })
    const img = wrapper.find('.tutor-cta__avatar')
    expect(img.attributes('src')).toBe('/default-avatar.svg')
  })
})
