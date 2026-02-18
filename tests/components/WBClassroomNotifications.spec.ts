/**
 * [WB:B3.2] Unit tests — WBClassroomNotifications.vue
 *
 * Tests:
 * 1. Join notification renders
 * 2. Lock notification has warning style
 * 3. Kick triggers redirect
 * 4. Sound toggle persists to localStorage
 * 5. Notification queue (max 3 visible)
 * 6. Connection lost banner renders
 * 7. Saved indicator shows on justSaved
 * 8. Dismiss toast removes it
 * 9. Join/leave toggle suppresses join notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBClassroomNotifications from '@/modules/winterboard/components/classroom/WBClassroomNotifications.vue'

const messages = {
  en: {
    winterboard: {
      a11y: {
        notifications: 'Notifications',
        dismiss: 'Dismiss',
      },
      classroom: {
        notifications: {
          joined: '{name} joined',
          left: '{name} left',
          locked: 'Teacher locked drawing',
          unlocked: 'Drawing unlocked',
          kicked: 'You have been removed from the session',
          ended: 'Session ended by teacher',
          saved: 'Saved',
          exportReady: 'Export ready — Download',
          connectionLost: 'Connection lost — Reconnecting...',
          reconnecting: 'Reconnecting...',
          soundOn: 'Sound on',
          soundOff: 'Sound off',
          joinLeaveOn: 'Join/leave notifications on',
          joinLeaveOff: 'Join/leave notifications off',
        },
      },
    },
  },
}

function createWrapper(props: Record<string, unknown> = {}): VueWrapper {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages,
  })

  return mount(WBClassroomNotifications, {
    props: {
      connectionLost: false,
      justSaved: false,
      showPreferences: true,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

describe('[WB:B3.2] WBClassroomNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Join notification renders ─────────────────────────────────────

  it('renders join notification toast', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { notifyJoin: (name: string) => void }

    vm.notifyJoin('Alice')
    await wrapper.vm.$nextTick()

    const toasts = wrapper.findAll('.wb-notifications__toast')
    expect(toasts.length).toBe(1)
    expect(toasts[0].text()).toContain('Alice joined')
    expect(toasts[0].classes()).toContain('wb-notifications__toast--info')
  })

  // ── 2. Lock notification has warning style ───────────────────────────

  it('renders lock notification with warning style', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { notifyLocked: () => void }

    vm.notifyLocked()
    await wrapper.vm.$nextTick()

    const toast = wrapper.find('.wb-notifications__toast')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toContain('Teacher locked drawing')
    expect(toast.classes()).toContain('wb-notifications__toast--warning')
    expect(toast.attributes('role')).toBe('alert')
    expect(toast.attributes('aria-live')).toBe('assertive')
  })

  // ── 3. Kick triggers redirect ────────────────────────────────────────

  it('emits redirect after kick notification', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { notifyKicked: () => void }

    vm.notifyKicked()
    await wrapper.vm.$nextTick()

    const toast = wrapper.find('.wb-notifications__toast')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toContain('You have been removed from the session')
    expect(toast.classes()).toContain('wb-notifications__toast--error')

    // Advance past redirect delay (2s)
    vi.advanceTimersByTime(2100)
    expect(wrapper.emitted('redirect')).toBeTruthy()
    expect(wrapper.emitted('redirect')![0]).toEqual(['/winterboard'])
  })

  // ── 4. Sound toggle persists to localStorage ─────────────────────────

  it('persists sound preference to localStorage', async () => {
    const wrapper = createWrapper()

    // Default is on
    const vm = wrapper.vm as unknown as { soundEnabled: boolean }
    expect(vm.soundEnabled).toBe(true)

    // Click sound toggle
    const soundBtn = wrapper.findAll('.wb-notifications__pref-btn')[0]
    await soundBtn.trigger('click')

    expect(vm.soundEnabled).toBe(false)
    expect(localStorage.getItem('wb-notif-sound')).toBe('false')

    // Click again
    await soundBtn.trigger('click')
    expect(vm.soundEnabled).toBe(true)
    expect(localStorage.getItem('wb-notif-sound')).toBe('true')
  })

  // ── 5. Notification queue (max 3 visible) ────────────────────────────

  it('limits visible toasts to 3', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as {
      addToast: (opts: { message: string; style?: string }) => string
    }

    vm.addToast({ message: 'Toast 1' })
    vm.addToast({ message: 'Toast 2' })
    vm.addToast({ message: 'Toast 3' })
    vm.addToast({ message: 'Toast 4' })
    vm.addToast({ message: 'Toast 5' })
    await wrapper.vm.$nextTick()

    const visibleToasts = wrapper.findAll('.wb-notifications__toast')
    expect(visibleToasts.length).toBe(3)
  })

  // ── 6. Connection lost banner renders ────────────────────────────────

  it('renders connection lost banner when connectionLost is true', () => {
    const wrapper = createWrapper({ connectionLost: true })

    const banner = wrapper.find('.wb-notifications__banner--error')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Connection lost')
    expect(banner.attributes('role')).toBe('alert')
  })

  it('does not render connection banner when connected', () => {
    const wrapper = createWrapper({ connectionLost: false })
    expect(wrapper.find('.wb-notifications__banner').exists()).toBe(false)
  })

  // ── 7. Saved indicator shows on justSaved ────────────────────────────

  it('shows saved indicator when justSaved becomes true', async () => {
    const wrapper = createWrapper({ justSaved: false })

    expect(wrapper.find('.wb-notifications__saved').exists()).toBe(false)

    await wrapper.setProps({ justSaved: true })
    expect(wrapper.find('.wb-notifications__saved').exists()).toBe(true)
    expect(wrapper.find('.wb-notifications__saved').text()).toContain('Saved')

    // Auto-hides after 2s
    vi.advanceTimersByTime(2100)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // The internal ref is set to false after timer
    const vm2 = wrapper.vm as unknown as { showSavedIndicator: boolean }
    // Timer fired, internal state should be false (Transition may still show element)
    expect(vm2.showSavedIndicator).toBe(false)
  })

  // ── 8. Dismiss toast removes it ──────────────────────────────────────

  it('removes toast when dismiss button clicked', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as {
      addToast: (opts: { message: string }) => string
    }

    vm.addToast({ message: 'Dismissable toast' })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.wb-notifications__toast').length).toBe(1)

    const vm2 = wrapper.vm as unknown as { dismissToast: (id: string) => void }
    // Get toast id from internal state
    const toastsRef = (wrapper.vm as unknown as { toasts: Array<{ id: string }> }).toasts
    expect(toastsRef.length).toBe(1)
    vm2.dismissToast(toastsRef[0].id)
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { toasts: unknown[] }).toasts.length).toBe(0)
  })

  // ── 9. Join/leave toggle suppresses join notifications ───────────────

  it('suppresses join notifications when joinLeave disabled', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as {
      notifyJoin: (name: string) => void
      joinLeaveEnabled: boolean
    }

    // Disable join/leave
    const joinLeaveBtn = wrapper.findAll('.wb-notifications__pref-btn')[1]
    await joinLeaveBtn.trigger('click')
    expect(vm.joinLeaveEnabled).toBe(false)

    // Try to add join notification
    vm.notifyJoin('Bob')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.wb-notifications__toast').length).toBe(0)
  })
})
