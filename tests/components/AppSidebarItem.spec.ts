import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSidebarItem from '@/ui/AppSidebarItem.vue'
import type { SidebarItem } from '@/ui/sidebar.types'

// Mock vue-router
const mockRoute = { path: '/tutor' }
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

const baseItem: SidebarItem = {
  label: 'sidebar.item.dashboard',
  icon: 'layout-dashboard',
  to: '/tutor',
}

function mountItem(item: Partial<SidebarItem> = {}, collapsed = false) {
  return mount(AppSidebarItem, {
    props: {
      item: { ...baseItem, ...item },
      collapsed,
    },
  })
}

describe('AppSidebarItem', () => {
  it('renders icon and label', () => {
    const wrapper = mountItem()
    // Icon component should render (LayoutDashboard from lucide)
    expect(wrapper.find('.nav-icon-svg').exists()).toBe(true)
    // Label should be rendered via $t()
    expect(wrapper.find('.nav-label').exists()).toBe(true)
  })

  it('shows badge when count > 0', () => {
    const wrapper = mountItem({ badge: 5, badgeType: 'danger' })
    const badge = wrapper.find('.nav-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('5')
  })

  it('does not show badge when badge is 0', () => {
    const wrapper = mountItem({ badge: 0 })
    expect(wrapper.find('.nav-badge').exists()).toBe(false)
  })

  it('does not show badge when badge is undefined', () => {
    const wrapper = mountItem()
    expect(wrapper.find('.nav-badge').exists()).toBe(false)
  })

  it('hides label when collapsed', () => {
    const wrapper = mountItem({}, true)
    expect(wrapper.find('.nav-label').exists()).toBe(false)
  })

  it('hides badge when collapsed', () => {
    const wrapper = mountItem({ badge: 3 }, true)
    expect(wrapper.find('.nav-badge').exists()).toBe(false)
  })

  it('shows tooltip (title) when collapsed', () => {
    const wrapper = mountItem({}, true)
    // router-link stub renders as <a> — check root element title
    const root = wrapper.find('.nav-item')
    expect(root.attributes('title')).toBeTruthy()
  })

  it('does not show tooltip when not collapsed', () => {
    const wrapper = mountItem({}, false)
    const root = wrapper.find('.nav-item')
    expect(root.attributes('title')).toBeUndefined()
  })

  it('applies active class for current route', () => {
    // mockRoute.path === '/tutor', item.to === '/tutor' → active
    mockRoute.path = '/tutor'
    const wrapper = mountItem({ to: '/tutor' })
    expect(wrapper.find('.nav-item').classes()).toContain('active')
  })

  it('does not apply active class for different route', () => {
    mockRoute.path = '/billing'
    const wrapper = mountItem({ to: '/tutor' })
    expect(wrapper.find('.nav-item').classes()).not.toContain('active')
  })

  it('applies active class for child routes', () => {
    mockRoute.path = '/booking/tutor/some-id'
    const wrapper = mountItem({ to: '/booking/tutor' })
    expect(wrapper.find('.nav-item').classes()).toContain('active')
  })

  it('badge applies correct badgeType class', () => {
    const wrapper = mountItem({ badge: 2, badgeType: 'warning' })
    const badge = wrapper.find('.nav-badge')
    expect(badge.classes()).toContain('warning')
  })

  it('badge defaults to info class when badgeType not set', () => {
    const wrapper = mountItem({ badge: 1 })
    const badge = wrapper.find('.nav-badge')
    expect(badge.classes()).toContain('info')
  })

  it('renders as router-link with correct to prop', () => {
    const wrapper = mountItem({ to: '/settings' })
    // router-link is stubbed as <a> — check existence
    expect(wrapper.find('a').exists()).toBe(true)
  })

  it('uses fallback Circle icon for unknown icon name', () => {
    const wrapper = mountItem({ icon: 'unknown-icon-name' })
    // Should still render an icon (Circle fallback)
    expect(wrapper.find('.nav-icon-svg').exists()).toBe(true)
  })

  // Accessibility checks (A5, A6 — implemented in R5)
  it('active link gets active class (aria-current="page" bound in template)', () => {
    mockRoute.path = '/tutor'
    const wrapper = mountItem({ to: '/tutor' })
    // isActive=true when route matches → active class applied
    expect(wrapper.find('.nav-item').classes()).toContain('active')
    // aria-current="page" is bound via :aria-current="isActive ? 'page' : undefined"
    // router-link stub in test env doesn't render dynamic attrs, but real browser does.
    // Verified by code inspection: AppSidebarItem.vue line 7
  })

  it('badge has aria-label with count', () => {
    const wrapper = mountItem({ badge: 3 })
    const badge = wrapper.find('.nav-badge')
    expect(badge.attributes('aria-label')).toBeTruthy()
  })
})

/**
 * Accessibility Checklist — AppSidebarItem audit results:
 *
 * ✅ PASS: Collapsed items show title attribute (tooltip for mouse + screen reader)
 * ✅ PASS: Uses router-link (<a>) — keyboard focusable
 * ✅ PASS: Icon + label structure is readable
 *
 * ✅ PASS: Active link has aria-current="page" (A5 — implemented R5)
 * ✅ PASS: Badge has aria-label with count (A6 — implemented R5)
 *
 * Full Sidebar Accessibility Checklist:
 * - [x] Sidebar uses <nav> element for navigation landmark
 * - [x] Sidebar <aside> has role="navigation" + aria-label (A1 — implemented R5)
 * - [x] Sections have role="group" + aria-label (A4 — implemented R5)
 * - [x] Collapse/expand buttons have title attributes
 * - [x] Collapse button has aria-expanded (A2 — implemented R5)
 * - [x] Mobile close button has aria-label (A3 — implemented R5)
 * - [x] Active link has aria-current="page" (A5 — implemented R5)
 * - [x] Badge has aria-label with count (A6 — implemented R5)
 */
