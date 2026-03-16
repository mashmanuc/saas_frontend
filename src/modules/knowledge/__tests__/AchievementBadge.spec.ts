// Phase 15 B3.3: Tests for AchievementBadge
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AchievementBadge from '../components/AchievementBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        achievement: {
          earned: 'Earned',
          locked: 'Locked',
        },
      },
    },
  },
})

function makeAchievement(overrides = {}) {
  return {
    achievement_type: 'first_lesson_published',
    display_name: 'First Lesson',
    description: 'Publish your first lesson',
    icon: 'trophy',
    earned_at: '2026-03-16T10:00:00Z',
    progress: null,
    metadata: {},
    ...overrides,
  }
}

function mountBadge(overrides = {}) {
  return mount(AchievementBadge, {
    props: { achievement: makeAchievement(overrides) },
    global: { plugins: [i18n] },
  })
}

describe('AchievementBadge', () => {
  it('renders earned state with colored styling', () => {
    const w = mountBadge()
    expect(w.find('.border-primary-200').exists()).toBe(true)
    expect(w.text()).toContain('First Lesson')
  })

  it('renders locked state with greyed styling', () => {
    const w = mountBadge({ earned_at: null, progress: 30 })
    expect(w.find('.border-gray-200').exists()).toBe(true)
    expect(w.find('.opacity-60').exists()).toBe(true)
  })

  it('shows earned date', () => {
    const w = mountBadge()
    // Date formatted by toLocaleDateString
    expect(w.text()).toMatch(/Mar|2026/)
  })

  it('shows progress bar for locked with progress', () => {
    const w = mountBadge({ earned_at: null, progress: 60 })
    const bar = w.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuenow')).toBe('60')
    expect(w.text()).toContain('60%')
  })

  it('shows tooltip on hover', async () => {
    const w = mountBadge()
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
    await w.find('.achievement-badge').trigger('mouseenter')
    expect(w.find('[role="tooltip"]').exists()).toBe(true)
    expect(w.find('[role="tooltip"]').text()).toContain('Publish your first lesson')
  })

  it('hides tooltip on mouseleave', async () => {
    const w = mountBadge()
    await w.find('.achievement-badge').trigger('mouseenter')
    expect(w.find('[role="tooltip"]').exists()).toBe(true)
    await w.find('.achievement-badge').trigger('mouseleave')
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('maps trophy icon correctly', () => {
    const w = mountBadge({ icon: 'trophy' })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('falls back to Award icon for unknown icon', () => {
    const w = mountBadge({ icon: 'unknown-icon' })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('has aria-label with earned/locked status', () => {
    const earned = mountBadge()
    expect(earned.find('.achievement-badge').attributes('aria-label')).toContain('Earned')

    const locked = mountBadge({ earned_at: null })
    expect(locked.find('.achievement-badge').attributes('aria-label')).toContain('Locked')
  })

  it('has aria-describedby pointing to tooltip', () => {
    const w = mountBadge()
    expect(w.find('.achievement-badge').attributes('aria-describedby')).toBe(
      'achievement-tooltip-first_lesson_published'
    )
  })
})
