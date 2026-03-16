// Phase 16 B Day 2: Tests for KnowledgeTermsHint
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import KnowledgeTermsHint from '../components/KnowledgeTermsHint.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        terms: {
          title: 'Tips',
          lesson: 'Lesson — a recording of a conducted class.',
          template: 'Template — a lesson that can be reused.',
          pack: 'Series (Pack) — a sequence of lessons.',
          fork: 'Fork — a copy of a template with your changes.',
          hide: 'Hide',
        },
      },
    },
  },
})

const STORAGE_KEY = 'kb:terms-hint-dismissed'

function mountComponent() {
  return mount(KnowledgeTermsHint, {
    global: { plugins: [i18n] },
  })
}

describe('KnowledgeTermsHint', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders when not dismissed', () => {
    const w = mountComponent()
    expect(w.find('[role="complementary"]').exists()).toBe(true)
    expect(w.text()).toContain('Tips')
  })

  it('renders all 4 term definitions', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Lesson — a recording')
    expect(w.text()).toContain('Template — a lesson')
    expect(w.text()).toContain('Series (Pack)')
    expect(w.text()).toContain('Fork — a copy')
  })

  it('hides on dismiss click', async () => {
    const w = mountComponent()
    expect(w.find('[role="complementary"]').exists()).toBe(true)
    await w.find('button').trigger('click')
    expect(w.find('[role="complementary"]').exists()).toBe(false)
  })

  it('sets localStorage on dismiss', async () => {
    const w = mountComponent()
    await w.find('button').trigger('click')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('stays hidden after remount if dismissed', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const w = mountComponent()
    expect(w.find('[role="complementary"]').exists()).toBe(false)
  })

  it('dismiss button has aria-label', () => {
    const w = mountComponent()
    expect(w.find('button').attributes('aria-label')).toBe('Hide')
  })

  it('has role=complementary with aria-label', () => {
    const w = mountComponent()
    const el = w.find('[role="complementary"]')
    expect(el.attributes('aria-label')).toBe('Tips')
  })
})
