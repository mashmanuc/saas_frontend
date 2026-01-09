import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { ContactLockedReason } from '@/types/inquiries'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('ContactLockedPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountPanel(reason: ContactLockedReason) {
    const { default: ContactLockedPanel } = await import('@/components/inquiries/ContactLockedPanel.vue')
    return mount(ContactLockedPanel, {
      props: { lockedReason: reason },
      global: {
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  it('renders locked title and icon', async () => {
    const wrapper = await mountPanel('inquiry_required')
    expect(wrapper.find('[data-testid="contact-locked-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('contact.locked.title')
  })

  it('shows correct reason text for inquiry_required', async () => {
    const wrapper = await mountPanel('inquiry_required')
    expect(wrapper.find('[data-testid="locked-reason-text"]').text()).toBe(
      'contact.locked.reasons.inquiry_required'
    )
  })

  it('shows "Request contact" button for inquiry_required', async () => {
    const wrapper = await mountPanel('inquiry_required')
    const button = wrapper.find('[data-testid="request-contact-button"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('contact.locked.actions.requestContact')
  })

  it('emits requestContact when button clicked', async () => {
    const wrapper = await mountPanel('inquiry_required')
    await wrapper.find('[data-testid="request-contact-button"]').trigger('click')
    expect(wrapper.emitted('requestContact')).toBeTruthy()
  })

  it('shows waiting text for inquiry_pending', async () => {
    const wrapper = await mountPanel('inquiry_pending')
    const waitingText = wrapper.find('[data-testid="waiting-text"]')
    expect(waitingText.exists()).toBe(true)
    expect(waitingText.text()).toBe('contact.locked.actions.waiting')
  })

  it('shows "Book lesson" button for no_active_lesson', async () => {
    const wrapper = await mountPanel('no_active_lesson')
    const button = wrapper.find('[data-testid="book-lesson-button"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('contact.locked.actions.bookLesson')
  })

  it('emits bookLesson when button clicked', async () => {
    const wrapper = await mountPanel('no_active_lesson')
    await wrapper.find('[data-testid="book-lesson-button"]').trigger('click')
    expect(wrapper.emitted('bookLesson')).toBeTruthy()
  })

  it('shows "Upgrade" button for subscription_required', async () => {
    const wrapper = await mountPanel('subscription_required')
    const button = wrapper.find('[data-testid="upgrade-button"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('contact.locked.actions.upgrade')
  })

  it('emits upgrade when button clicked', async () => {
    const wrapper = await mountPanel('subscription_required')
    await wrapper.find('[data-testid="upgrade-button"]').trigger('click')
    expect(wrapper.emitted('upgrade')).toBeTruthy()
  })

  it('renders correct reason text for all locked reasons', async () => {
    const reasons: ContactLockedReason[] = [
      'no_relation',
      'inquiry_required',
      'inquiry_pending',
      'inquiry_rejected',
      'inquiry_expired',
      'no_active_lesson',
      'subscription_required',
      'forbidden'
    ]

    for (const reason of reasons) {
      const wrapper = await mountPanel(reason)
      expect(wrapper.find('[data-testid="locked-reason-text"]').text()).toBe(
        `contact.locked.reasons.${reason}`
      )
    }
  })
})
