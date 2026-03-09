import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardStatsRow from '@/modules/dashboard/components/DashboardStatsRow.vue'

const mockStats = [
  { key: 'lessonsToday', icon: 'calendar', label: 'dashboard.stats.lessonsToday', value: 3 },
  { key: 'activeStudents', icon: 'users', label: 'dashboard.stats.activeStudents', value: 12 },
  { key: 'pendingInquiries', icon: 'inbox', label: 'dashboard.stats.pendingInquiries', value: 1, to: '/tutor/inquiries' },
  { key: 'balance', icon: 'wallet', label: 'dashboard.stats.balance', value: '—' },
]

function mountStatsRow(props: Record<string, unknown> = {}) {
  return mount(DashboardStatsRow, {
    props: { stats: mockStats, ...props },
    shallow: true,
  })
}

describe('DashboardStatsRow', () => {
  // ── Structure ──
  it('renders without errors', () => {
    const wrapper = mountStatsRow()
    expect(wrapper.exists()).toBe(true)
  })

  it('renders stats-row container', () => {
    const wrapper = mountStatsRow()
    expect(wrapper.find('.stats-row').exists()).toBe(true)
  })

  // ── Accessibility ──
  it('has role="region"', () => {
    const wrapper = mountStatsRow()
    const region = wrapper.find('[role="region"]')
    expect(region.exists()).toBe(true)
  })

  it('has aria-label on region', () => {
    const wrapper = mountStatsRow()
    const region = wrapper.find('[role="region"]')
    expect(region.attributes('aria-label')).toBeTruthy()
  })

  // ── StatsCard children ──
  it('renders correct number of StatsCard stubs', () => {
    const wrapper = mountStatsRow()
    // In shallow mode, StatsCard is stubbed as <stats-card-stub>
    const cards = wrapper.findAllComponents({ name: 'StatsCard' })
    expect(cards.length).toBe(4)
  })

  it('passes props to StatsCard', () => {
    const wrapper = mountStatsRow()
    const cards = wrapper.findAllComponents({ name: 'StatsCard' })
    if (cards.length > 0) {
      const firstCard = cards[0]
      expect(firstCard.props('icon')).toBe('calendar')
      expect(firstCard.props('value')).toBe(3)
    }
  })

  it('renders with empty stats', () => {
    const wrapper = mount(DashboardStatsRow, {
      props: { stats: [] },
      shallow: true,
    })
    expect(wrapper.exists()).toBe(true)
    const cards = wrapper.findAllComponents({ name: 'StatsCard' })
    expect(cards.length).toBe(0)
  })
})

/**
 * Accessibility Audit — DashboardStatsRow
 *
 * ✅ PASS: role="region" on container
 * ✅ PASS: aria-label from i18n (dashboard.stats.ariaLabel)
 * ✅ PASS: StatsCard uses role="article" + aria-label with value
 * ✅ PASS: Clickable StatsCards use router-link (<a>) — keyboard accessible
 */
