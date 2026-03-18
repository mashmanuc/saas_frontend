// Phase 15 B3.3: Tests for LessonRatingWidget
import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LessonRatingWidget from '../components/LessonRatingWidget.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        rating: {
          title: 'Rate this lesson',
          selectScore: 'Select a rating',
          star: '{n} stars',
          placeholder: 'Write a short review...',
          submit: 'Rate',
          submitting: 'Submitting...',
          thankYou: 'Thank you!',
          alreadyRated: 'You have already rated',
          yourRating: 'Your rating: {score} out of 5',
          loginToRate: 'Log in to rate',
          submitError: 'Failed to submit',
        },
      },
    },
  },
})


const defaultProps = {
  lessonId: 'lesson-1',
  tutorSlug: 'tutor-1',
  lessonSlug: 'algebra',
  existingRating: null,
  isAuthenticated: true,
}

function mountWidget(propsOverrides = {}) {
  return mount(LessonRatingWidget, {
    props: { ...defaultProps, ...propsOverrides },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('LessonRatingWidget', () => {
  it('renders interactive mode for authenticated user without existing rating', () => {
    const w = mountWidget()
    expect(w.text()).toContain('Rate this lesson')
  })

  it('shows existing rating in readonly mode', () => {
    const w = mountWidget({ existingRating: { score: 4, comment: 'Great!' } })
    expect(w.text()).toContain('You have already rated')
    expect(w.text()).toContain('Great!')
  })

  it('shows login link for unauthenticated users', () => {
    const w = mountWidget({ isAuthenticated: false })
    expect(w.text()).toContain('Log in to rate')
    // RouterLinkStub renders as <a> with to prop stored internally
    expect(w.html()).toContain('/auth/login')
  })

  it('renders 5 star buttons in radiogroup', () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    expect(stars.length).toBe(5)
  })

  it('updates selectedScore on star click', async () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    await stars[2].trigger('click')
    expect(stars[2].attributes('aria-checked')).toBe('true')
  })

  it('shows textarea after score selected', async () => {
    const w = mountWidget()
    expect(w.find('textarea').exists()).toBe(false)
    const stars = w.findAll('[role="radio"]')
    await stars[3].trigger('click')
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('emits rated on submit', async () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    await stars[4].trigger('click')
    const submitBtn = w.findAll('button').find(b => b.text() === 'Rate')
    await submitBtn!.trigger('click')
    expect(w.emitted('rated')).toBeTruthy()
    expect(w.emitted('rated')![0]).toEqual([5, ''])
  })

  it('shows character count', async () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    await stars[0].trigger('click')
    expect(w.text()).toContain('0/500')
  })

  it('has role=form with aria-label', () => {
    const w = mountWidget()
    const form = w.find('[role="form"]')
    expect(form.exists()).toBe(true)
    expect(form.attributes('aria-label')).toBe('Rate this lesson')
  })

  it('shows readonly stars for existing rating', () => {
    const w = mountWidget({ existingRating: { score: 3, comment: '' } })
    const stars = w.findAll('[role="img"] svg')
    expect(stars.length).toBe(5)
  })

  it('keyboard left decrements star', async () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    await stars[3].trigger('click') // select 4
    await stars[3].trigger('keydown', { key: 'ArrowLeft' })
    // selectedScore should be 3 now
    expect(stars[2].attributes('aria-checked')).toBe('true')
  })

  it('keyboard right increments star', async () => {
    const w = mountWidget()
    const stars = w.findAll('[role="radio"]')
    await stars[1].trigger('click') // select 2
    await stars[1].trigger('keydown', { key: 'ArrowRight' })
    expect(stars[2].attributes('aria-checked')).toBe('true')
  })
})
