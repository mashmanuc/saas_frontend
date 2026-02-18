/**
 * [WB:B3.1] Unit tests — WBFollowMode.vue
 *
 * Tests:
 * 1. Auto-join: banner renders when following
 * 2. Viewport sync: stop following emits event
 * 3. Stop following → manual mode (return button visible)
 * 4. Return to teacher button emits start-following
 * 5. Teacher disconnect → disconnected banner
 * 6. Teacher reconnect → auto-resume follow
 * 7. Page change → toast notification
 * 8. Escape key stops following
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBFollowMode from '@/modules/winterboard/components/classroom/WBFollowMode.vue'

const messages = {
  en: {
    winterboard: {
      classroom: {
        follow: {
          following: 'Following {name}',
          stopFollowing: 'Stop following',
          returnToTeacher: 'Return to teacher',
          teacherDisconnected: 'Teacher disconnected',
          teacherReconnected: 'Teacher reconnected',
          movedToPage: 'Teacher moved to page {page}',
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

  return mount(WBFollowMode, {
    props: {
      isFollowing: false,
      followTarget: null,
      teacherPresent: true,
      isStudent: true,
      teacherPageIndex: 0,
      pageCount: 5,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  })
}

describe('[WB:B3.1] WBFollowMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Auto-join: banner renders when following ──────────────────────

  it('renders follow banner when isFollowing with followTarget', () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
    })

    const banner = wrapper.find('.wb-follow-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Following Mr. Smith')
    expect(banner.attributes('role')).toBe('status')
    expect(banner.attributes('aria-live')).toBe('polite')
  })

  it('does not render follow banner when not following', () => {
    const wrapper = createWrapper({ isFollowing: false })
    expect(wrapper.find('.wb-follow-banner').exists()).toBe(false)
  })

  // ── 2. Stop following emits event ────────────────────────────────────

  it('emits stop-following when stop button clicked', async () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
    })

    await wrapper.find('.wb-follow-banner__stop').trigger('click')
    expect(wrapper.emitted('stop-following')).toHaveLength(1)
  })

  // ── 3. Stop following → manual mode (return button visible) ──────────

  it('shows return button when not following but teacher present and is student', () => {
    const wrapper = createWrapper({
      isFollowing: false,
      followTarget: null,
      teacherPresent: true,
      isStudent: true,
    })

    expect(wrapper.find('.wb-follow-return').exists()).toBe(true)
    expect(wrapper.find('.wb-follow-return').text()).toContain('Return to teacher')
  })

  it('hides return button when teacher not present', () => {
    const wrapper = createWrapper({
      isFollowing: false,
      teacherPresent: false,
      isStudent: true,
    })

    expect(wrapper.find('.wb-follow-return').exists()).toBe(false)
  })

  // ── 4. Return to teacher button emits start-following ────────────────

  it('emits start-following when return button clicked', async () => {
    const wrapper = createWrapper({
      isFollowing: false,
      followTarget: null,
      teacherPresent: true,
      isStudent: true,
    })

    await wrapper.find('.wb-follow-return').trigger('click')
    expect(wrapper.emitted('start-following')).toHaveLength(1)
  })

  // ── 5. Teacher disconnect → disconnected banner ──────────────────────

  it('shows disconnected banner when teacher disconnects', async () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
      teacherPresent: true,
    })

    // Teacher disconnects
    await wrapper.setProps({ teacherPresent: false })

    const disconnectedBanner = wrapper.find('.wb-follow-banner--disconnected')
    expect(disconnectedBanner.exists()).toBe(true)
    expect(disconnectedBanner.text()).toContain('Teacher disconnected')
    expect(disconnectedBanner.attributes('role')).toBe('alert')
    expect(disconnectedBanner.attributes('aria-live')).toBe('assertive')
  })

  // ── 6. Teacher reconnect → auto-resume follow ───────────────────────

  it('emits start-following when teacher reconnects after disconnect', async () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
      teacherPresent: true,
      isStudent: true,
    })

    // Teacher disconnects
    await wrapper.setProps({ teacherPresent: false })
    // Teacher reconnects
    await wrapper.setProps({ teacherPresent: true })

    expect(wrapper.emitted('start-following')).toHaveLength(1)
  })

  // ── 7. Page change → toast notification ──────────────────────────────

  it('shows page change toast when teacher changes page while following', async () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
      teacherPageIndex: 0,
    })

    // Teacher moves to page 3 (index 2)
    await wrapper.setProps({ teacherPageIndex: 2 })

    const toast = wrapper.find('.wb-follow-toast')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toContain('Teacher moved to page 3')
  })

  it('does not show page change toast when not following', async () => {
    const wrapper = createWrapper({
      isFollowing: false,
      teacherPageIndex: 0,
    })

    await wrapper.setProps({ teacherPageIndex: 2 })
    expect(wrapper.find('.wb-follow-toast').exists()).toBe(false)
  })

  // ── 8. Escape key stops following ────────────────────────────────────

  it('emits stop-following on Escape key press', async () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('stop-following')).toHaveLength(1)
  })

  it('does not emit stop-following on Escape when not following', async () => {
    const wrapper = createWrapper({ isFollowing: false })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('stop-following')).toBeUndefined()
  })

  // ── 9. Avatar initial ────────────────────────────────────────────────

  it('renders avatar initial from teacher display name', () => {
    const wrapper = createWrapper({
      isFollowing: true,
      followTarget: { userId: 'teacher-1', displayName: 'Mr. Smith', color: '#2563eb' },
    })

    const avatar = wrapper.find('.wb-follow-banner__avatar')
    expect(avatar.text()).toBe('M')
    expect(avatar.attributes('style')).toContain('#2563eb')
  })
})
