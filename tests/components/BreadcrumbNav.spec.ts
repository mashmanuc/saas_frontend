import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BreadcrumbNav from '@/components/ui/BreadcrumbNav.vue'

describe('BreadcrumbNav', () => {
  it('renders nothing when items has less than 2 elements', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: { items: [{ label: 'Home' }] },
    })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders nothing when items is empty', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: { items: [] },
    })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders breadcrumbs with 2 items', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Каталог' },
        ],
      },
    })
    expect(wrapper.find('nav').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(2)
  })

  it('renders breadcrumbs with 3 items', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Каталог', to: '/knowledge/catalog' },
          { label: 'Математика' },
        ],
      },
    })
    expect(wrapper.findAll('li')).toHaveLength(3)
  })

  it('renders router-link for non-last items with to', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Каталог', to: '/knowledge/catalog' },
          { label: 'Математика' },
        ],
      },
    })
    // router-link is stubbed as <a> in setup.js
    const links = wrapper.findAll('.breadcrumb-nav__link')
    expect(links).toHaveLength(2)
  })

  it('renders text (not link) for last item', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Current Page' },
        ],
      },
    })
    const allItems = wrapper.findAll('li')
    const lastItem = allItems[allItems.length - 1]
    expect(lastItem?.find('span[aria-current="page"]').exists()).toBe(true)
  })

  it('renders separators between items', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'A', to: '/a' },
          { label: 'B', to: '/b' },
          { label: 'C' },
        ],
      },
    })
    const separators = wrapper.findAll('.breadcrumb-nav__separator')
    expect(separators).toHaveLength(2)
  })

  it('has correct aria-label on nav element', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Page' },
        ],
      },
    })
    expect(wrapper.find('nav').attributes('aria-label')).toBeTruthy()
  })

  it('uses <ol> for semantic ordered list', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'A', to: '/a' },
          { label: 'B' },
        ],
      },
    })
    expect(wrapper.find('ol.breadcrumb-nav__list').exists()).toBe(true)
  })

  it('does not render aria-current on non-last items', () => {
    const wrapper = mount(BreadcrumbNav, {
      props: {
        items: [
          { label: 'Hub', to: '/knowledge' },
          { label: 'Catalog', to: '/catalog' },
          { label: 'Page' },
        ],
      },
    })
    const firstItem = wrapper.findAll('li')[0]
    expect(firstItem?.find('[aria-current]').exists()).toBe(false)
  })
})
