import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AvatarDropdown from '@/ui/AvatarDropdown.vue'

// Mock stores
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { first_name: 'Олена', last_name: 'Коваль', email: 'olena@example.com', role: 'tutor' },
    isAuthenticated: true,
    logout: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/stores/themeStore', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
  })),
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({
    locale: 'uk',
    setLocale: vi.fn(),
  })),
}))

function mountAvatar() {
  return mount(AvatarDropdown, {
    attachTo: document.body,
  })
}

async function mountAndOpen() {
  const wrapper = mountAvatar()
  await wrapper.find('.avatar-trigger').trigger('click')
  return wrapper
}

describe('AvatarDropdown', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders avatar with user initials', () => {
    const wrapper = mountAvatar()
    expect(wrapper.text()).toContain('ОК')
  })

  it('renders user name on desktop', () => {
    const wrapper = mountAvatar()
    expect(wrapper.text()).toContain('Олена')
  })

  it('dropdown is closed by default', () => {
    const wrapper = mountAvatar()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('opens dropdown on click', async () => {
    const wrapper = await mountAndOpen()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('has aria-expanded on trigger', () => {
    const wrapper = mountAvatar()
    const trigger = wrapper.find('.avatar-trigger')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('has aria-haspopup on trigger', () => {
    const wrapper = mountAvatar()
    const trigger = wrapper.find('.avatar-trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('true')
  })

  it('dropdown contains Settings link', async () => {
    const wrapper = await mountAndOpen()
    const items = wrapper.findAll('[role="menuitem"]')
    expect(items.length).toBeGreaterThanOrEqual(2) // settings + logout
  })

  it('dropdown contains theme options', async () => {
    const wrapper = await mountAndOpen()
    const radios = wrapper.findAll('[role="menuitemradio"]')
    expect(radios.length).toBeGreaterThanOrEqual(3) // 3 themes + 2 langs = 5
  })

  it('dropdown contains logout button', async () => {
    const wrapper = await mountAndOpen()
    expect(wrapper.find('.dropdown-item--danger').exists()).toBe(true)
  })

  it('shows user email in dropdown header', async () => {
    const wrapper = await mountAndOpen()
    expect(wrapper.text()).toContain('olena@example.com')
  })

  it('no emoji in theme options (Lucide only)', async () => {
    const wrapper = await mountAndOpen()
    const html = wrapper.html()
    expect(html).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u) // No emoji unicode
  })
})
