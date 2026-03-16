// Phase 16 B Day 2: Tests for Breadcrumbs
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Breadcrumbs from '@/ui/Breadcrumbs.vue'

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

function mountBreadcrumbs(items: Array<{ label: string; to?: string }>) {
  return mount(Breadcrumbs, {
    props: { items },
    global: { stubs: { RouterLink: routerLinkStub } },
  })
}

describe('Breadcrumbs', () => {
  it('renders nothing when items is empty', () => {
    const w = mountBreadcrumbs([])
    expect(w.find('nav').exists()).toBe(false)
  })

  it('renders nav with aria-label', () => {
    const w = mountBreadcrumbs([{ label: 'Home', to: '/' }])
    expect(w.find('nav').attributes('aria-label')).toBe('Breadcrumb')
  })

  it('renders ordered list', () => {
    const w = mountBreadcrumbs([{ label: 'Home', to: '/' }, { label: 'Page' }])
    expect(w.find('ol').exists()).toBe(true)
  })

  it('renders links for items with to', () => {
    const w = mountBreadcrumbs([
      { label: 'Home', to: '/' },
      { label: 'Catalog', to: '/catalog' },
      { label: 'Current' },
    ])
    const links = w.findAll('a')
    expect(links.length).toBe(2)
    expect(links[0].attributes('href')).toBe('/')
    expect(links[0].text()).toBe('Home')
    expect(links[1].attributes('href')).toBe('/catalog')
    expect(links[1].text()).toBe('Catalog')
  })

  it('renders last item as span without link', () => {
    const w = mountBreadcrumbs([
      { label: 'Home', to: '/' },
      { label: 'Current Page' },
    ])
    const span = w.find('span[aria-current="page"]')
    expect(span.exists()).toBe(true)
    expect(span.text()).toBe('Current Page')
  })

  it('renders chevron separators between items', () => {
    const w = mountBreadcrumbs([
      { label: 'Home', to: '/' },
      { label: 'Middle', to: '/mid' },
      { label: 'Current' },
    ])
    const svgs = w.findAll('svg')
    expect(svgs.length).toBe(2)
  })

  it('does not render chevron before first item', () => {
    const w = mountBreadcrumbs([{ label: 'Only' }])
    expect(w.findAll('svg').length).toBe(0)
  })

  it('renders single item as current page', () => {
    const w = mountBreadcrumbs([{ label: 'Home' }])
    expect(w.find('span[aria-current="page"]').text()).toBe('Home')
    expect(w.findAll('a').length).toBe(0)
  })

  it('last item has font-medium class', () => {
    const w = mountBreadcrumbs([{ label: 'Home', to: '/' }, { label: 'End' }])
    const span = w.find('span[aria-current="page"]')
    expect(span.classes()).toContain('font-medium')
  })
})
