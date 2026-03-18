import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickActions from '@/modules/dashboard/components/QuickActions.vue'

function mountQuickActions() {
  return mount(QuickActions)
}

describe('QuickActions', () => {
  it('renders without errors', () => {
    const wrapper = mountQuickActions()
    expect(wrapper.exists()).toBe(true)
  })

  it('renders title heading', () => {
    const wrapper = mountQuickActions()
    expect(wrapper.find('h2').exists()).toBe(true)
  })

  it('renders quick-actions-grid', () => {
    const wrapper = mountQuickActions()
    expect(wrapper.find('.quick-actions-grid').exists()).toBe(true)
  })

  it('renders 5 action buttons (all shown when lessonsCount not provided)', () => {
    const wrapper = mountQuickActions()
    const btns = wrapper.findAll('.quick-action-btn')
    expect(btns.length).toBe(5)
  })

  it('action buttons are router-links (rendered as <a>)', () => {
    const wrapper = mountQuickActions()
    const links = wrapper.findAll('.quick-action-btn')
    links.forEach(link => {
      expect(link.element.tagName.toLowerCase()).toBe('a')
    })
  })

  it('contains link to /tutor/schedule (create lesson)', () => {
    const wrapper = mountQuickActions()
    const html = wrapper.html()
    expect(html).toContain('/tutor/schedule')
  })

  it('contains link to /knowledge', () => {
    const wrapper = mountQuickActions()
    const html = wrapper.html()
    expect(html).toContain('/knowledge')
  })

  it('contains link to /tutor/students', () => {
    const wrapper = mountQuickActions()
    const html = wrapper.html()
    expect(html).toContain('/tutor/students')
  })

  it('each action has an icon (Lucide SVG)', () => {
    const wrapper = mountQuickActions()
    const btns = wrapper.findAll('.quick-action-btn')
    btns.forEach(btn => {
      expect(btn.find('svg').exists()).toBe(true)
    })
  })

  it('each action has label text', () => {
    const wrapper = mountQuickActions()
    const btns = wrapper.findAll('.quick-action-btn')
    btns.forEach(btn => {
      expect(btn.find('span').exists()).toBe(true)
      expect(btn.find('span').text()).toBeTruthy()
    })
  })
})
