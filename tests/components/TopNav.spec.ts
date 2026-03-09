import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TopNav from '@/ui/TopNav.vue'

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
    user: { role: 'tutor', first_name: 'Test', email: 'test@example.com' },
  })),
}))

describe('TopNav (R3 simplified)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders without errors', () => {
    const wrapper = mount(TopNav, { shallow: true })
    expect(wrapper.exists()).toBe(true)
  })

  it('contains AvatarDropdown', () => {
    const wrapper = mount(TopNav, { shallow: true })
    // Shallow mode: check for stubbed AvatarDropdown
    expect(wrapper.html()).toContain('avatar-dropdown')
  })

  it('does NOT contain standalone logout button', () => {
    const wrapper = mount(TopNav, { shallow: true })
    // No direct logout button in TopNav template
    const buttons = wrapper.findAll('button')
    const logoutBtn = buttons.filter(b => b.text().includes('Logout') || b.text().includes('Вихід'))
    expect(logoutBtn.length).toBe(0)
  })

  it('does NOT contain theme toggle', () => {
    const wrapper = mount(TopNav, { shallow: true })
    // No emoji theme buttons
    expect(wrapper.text()).not.toContain('🌿')
    expect(wrapper.text()).not.toContain('🌙')
    expect(wrapper.text()).not.toContain('🎓')
  })

  it('does NOT contain language switch', () => {
    const wrapper = mount(TopNav, { shallow: true })
    expect(wrapper.text()).not.toContain('UK')
    expect(wrapper.text()).not.toContain('EN')
    expect(wrapper.text()).not.toContain('RU')
  })

  it('does NOT contain role badge', () => {
    const wrapper = mount(TopNav, { shallow: true })
    // No role badge span
    const roleSpans = wrapper.findAll('span').filter(s =>
      s.text() === 'Tutor' || s.text() === 'Student'
    )
    expect(roleSpans.length).toBe(0)
  })

  it('contains hamburger button for mobile', () => {
    const wrapper = mount(TopNav, { shallow: true })
    // Menu icon from Lucide
    expect(wrapper.html()).toContain('menu')
  })

  it('contains logo SVG', () => {
    const wrapper = mount(TopNav, { shallow: true })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
