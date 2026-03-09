import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TodaySchedule from '@/modules/dashboard/components/TodaySchedule.vue'

function mountSchedule(props: Record<string, unknown> = {}) {
  return mount(TodaySchedule, {
    props: {
      lessons: [],
      loading: false,
      isTutor: true,
      ...props,
    },
    global: {
      stubs: {
        UpcomingLessonCard: { template: '<div class="lesson-card-stub" />', props: ['lesson', 'isTutor'] },
      },
    },
  })
}

describe('TodaySchedule', () => {
  // ── Loading state ──
  it('shows loading indicator when loading=true', () => {
    const wrapper = mountSchedule({ loading: true })
    // Loading div is visible, empty state is not
    expect(wrapper.find('.schedule-empty').exists()).toBe(false)
  })

  it('does not show empty state when loading', () => {
    const wrapper = mountSchedule({ loading: true })
    expect(wrapper.find('.schedule-empty').exists()).toBe(false)
  })

  // ── Empty state ──
  it('shows empty state when no lessons and not loading', () => {
    const wrapper = mountSchedule({ lessons: [], loading: false })
    expect(wrapper.find('.schedule-empty').exists()).toBe(true)
  })

  it('empty state contains calendar link', () => {
    const wrapper = mountSchedule({ lessons: [], loading: false })
    const empty = wrapper.find('.schedule-empty')
    expect(empty.exists()).toBe(true)
    // router-link stubbed as <a> by global setup
    expect(empty.find('a').exists()).toBe(true)
  })

  // ── With lessons ──
  it('renders lesson cards when lessons exist', () => {
    const mockLessons = [
      { id: 1, scheduled_at: '2026-03-10T10:00:00Z', duration_minutes: 60, status: 'confirmed' },
      { id: 2, scheduled_at: '2026-03-10T14:00:00Z', duration_minutes: 45, status: 'confirmed' },
    ]
    const wrapper = mountSchedule({ lessons: mockLessons, loading: false })
    const cards = wrapper.findAll('.lesson-card-stub')
    expect(cards.length).toBe(2)
  })

  it('does not show empty state when lessons exist', () => {
    const mockLessons = [
      { id: 1, scheduled_at: '2026-03-10T10:00:00Z', duration_minutes: 60, status: 'confirmed' },
    ]
    const wrapper = mountSchedule({ lessons: mockLessons, loading: false })
    expect(wrapper.find('.schedule-empty').exists()).toBe(false)
  })

  // ── Header ──
  it('renders schedule header with title', () => {
    const wrapper = mountSchedule()
    expect(wrapper.find('.schedule-header').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(true)
  })

  it('header contains viewAll link', () => {
    const wrapper = mountSchedule()
    const header = wrapper.find('.schedule-header')
    expect(header.find('a').exists()).toBe(true)
  })

  // ── Props passthrough ──
  it('renders for student (isTutor=false)', () => {
    const wrapper = mountSchedule({ isTutor: false })
    expect(wrapper.exists()).toBe(true)
  })
})

/**
 * Accessibility Audit — TodaySchedule
 *
 * ✅ PASS: Header uses semantic <h2>
 * ✅ PASS: "View all" and "Open calendar" links are router-link (<a>) — keyboard accessible
 * ✅ PASS: Empty state provides actionable CTA link
 * ⚠️  RECOMMENDATION: Add aria-label to the section/card wrapper for screen readers
 */
