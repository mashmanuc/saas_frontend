import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardEmptyState from '@/modules/dashboard/components/DashboardEmptyState.vue'

function mountEmpty(props: Record<string, unknown> = {}) {
  return mount(DashboardEmptyState, {
    props: {
      title: 'Welcome!',
      description: 'Get started',
      ...props,
    },
  })
}

describe('DashboardEmptyState', () => {
  // ── Content ──
  it('renders title', () => {
    const wrapper = mountEmpty()
    expect(wrapper.find('.empty-title').text()).toBe('Welcome!')
  })

  it('renders description', () => {
    const wrapper = mountEmpty()
    expect(wrapper.find('.empty-description').text()).toBe('Get started')
  })

  // ── CTA link ──
  it('renders CTA link when ctaTo and ctaLabel provided', () => {
    const wrapper = mountEmpty({
      ctaLabel: 'Go',
      ctaTo: '/marketplace',
    })
    const cta = wrapper.find('.empty-cta')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain('Go')
    expect(cta.attributes('to')).toBe('/marketplace')
  })

  it('hides CTA when ctaTo not provided', () => {
    const wrapper = mountEmpty()
    expect(wrapper.find('.empty-cta').exists()).toBe(false)
  })

  it('hides CTA when ctaLabel not provided', () => {
    const wrapper = mountEmpty({ ctaTo: '/marketplace' })
    expect(wrapper.find('.empty-cta').exists()).toBe(false)
  })

  // ── Icon ──
  it('renders default Search icon when no icon prop', () => {
    const wrapper = mountEmpty()
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders icon from ICON_MAP', () => {
    const wrapper = mountEmpty({ icon: 'calendar' })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('falls back to Search for unknown icon', () => {
    const wrapper = mountEmpty({ icon: 'nonexistent' })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  // ── Container ──
  it('has dashboard-empty-state class', () => {
    const wrapper = mountEmpty()
    expect(wrapper.find('.dashboard-empty-state').exists()).toBe(true)
  })

  // ── Accessibility ──
  it('CTA is a router-link (keyboard accessible)', () => {
    const wrapper = mountEmpty({
      ctaLabel: 'Find tutor',
      ctaTo: '/marketplace',
    })
    const cta = wrapper.find('.empty-cta')
    expect(cta.element.tagName.toLowerCase()).toBe('a')
  })
})
