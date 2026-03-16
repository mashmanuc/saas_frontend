// Phase 15 B3.3: Tests for RatingSummary
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RatingSummary from '../components/RatingSummary.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        rating: {
          summaryAria: 'Rating {score} out of 5, {count} ratings',
        },
      },
    },
  },
})

function mountSummary(props = {}) {
  return mount(RatingSummary, {
    props: { averageRating: 4.5, ratingCount: 32, ...props },
    global: { plugins: [i18n] },
  })
}

describe('RatingSummary', () => {
  it('renders formatted score with 1 decimal', () => {
    const w = mountSummary({ averageRating: 4.5 })
    expect(w.text()).toContain('4.5')
  })

  it('renders rating count in parentheses', () => {
    const w = mountSummary({ ratingCount: 32 })
    expect(w.text()).toContain('(32)')
  })

  it('is hidden when ratingCount is 0', () => {
    const w = mountSummary({ ratingCount: 0 })
    expect(w.find('.rating-summary').exists()).toBe(false)
  })

  it('renders star icon', () => {
    const w = mountSummary()
    expect(w.find('svg').exists()).toBe(true)
  })

  it('uses sm size class when size=sm', () => {
    const w = mountSummary({ size: 'sm' })
    expect(w.find('.text-xs').exists()).toBe(true)
  })

  it('uses md size class by default', () => {
    const w = mountSummary()
    expect(w.find('.text-sm').exists()).toBe(true)
  })

  it('has role=img with correct aria-label', () => {
    const w = mountSummary()
    const el = w.find('[role="img"]')
    expect(el.exists()).toBe(true)
    expect(el.attributes('aria-label')).toBe('Rating 4.5 out of 5, 32 ratings')
  })

  it('shows dash when averageRating is null', () => {
    const w = mountSummary({ averageRating: null, ratingCount: 5 })
    expect(w.text()).toContain('—')
  })
})
