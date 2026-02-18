/**
 * [WB:B6.1] Unit tests — Collaboration UX
 *
 * Tests:
 * 1. Presence panel renders online users (you first, then alphabetical)
 * 2. Follow button toggles follow mode
 * 3. Connection status indicators (connected/syncing/disconnected)
 * 4. Selection lock icon on locked strokes
 * 5. Area highlight around remote cursor
 * 6. Concurrent edit toast
 * 7. Remote cursor rendering with correct color
 * 8. Accessibility: aria-labels present
 * 9. Collapse/expand panel
 * 10. User join/leave screen reader announcements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import WBPresencePanel from '@/modules/winterboard/components/collaboration/WBPresencePanel.vue'
import WBConflictIndicators from '@/modules/winterboard/components/collaboration/WBConflictIndicators.vue'
import WBRemoteCursorsOverlay from '@/modules/winterboard/components/collaboration/WBRemoteCursorsOverlay.vue'

// ── i18n setup ──────────────────────────────────────────────────────────────

const messages = {
  en: {
    winterboard: {
      collaboration: {
        onlineUsers: 'Online users',
        you: 'You',
        follow: 'Follow',
        unfollow: 'Unfollow',
        following: 'Following',
        connected: 'Connected',
        syncing: 'Syncing...',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...',
        lockedBy: 'Being edited by {name}',
        editingThisArea: '{name} is editing this area',
        concurrentEditors: '{count} people editing this page',
        userJoined: '{name} joined',
        userLeft: '{name} left',
        nowFollowing: 'Now following {name}',
        unfollowed: 'Stopped following',
        page: 'Page',
        expandPanel: 'Expand users panel',
        collapsePanel: 'Collapse users panel',
      },
    },
  },
}

function createTestI18n() {
  return createI18n({ legacy: false, locale: 'en', messages })
}

// ── Test data ───────────────────────────────────────────────────────────────

const ONLINE_USERS = [
  { userId: 'user-2', displayName: 'Bob', color: '#ef4444', tool: 'pen' as const, pageIndex: 0 },
  { userId: 'user-3', displayName: 'Alice', color: '#22c55e', tool: 'eraser' as const, pageIndex: 1 },
]

const REMOTE_CURSORS = [
  {
    userId: 'user-2',
    displayName: 'Bob',
    color: '#ef4444',
    x: 100,
    y: 200,
    pageId: '0',
    tool: 'pen' as const,
    lastUpdate: Date.now(),
    isFaded: false,
  },
  {
    userId: 'user-3',
    displayName: 'Alice',
    color: '#22c55e',
    x: 300,
    y: 400,
    pageId: '1',
    tool: 'eraser' as const,
    lastUpdate: Date.now() - 10_000,
    isFaded: true,
  },
]

const REMOTE_SELECTIONS = [
  {
    userId: 'user-2',
    displayName: 'Bob',
    color: '#ef4444',
    strokeIds: ['stroke-1', 'stroke-2'],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function mountPresencePanel(overrides: Record<string, unknown> = {}) {
  return mount(WBPresencePanel, {
    props: {
      currentUserId: 'user-1',
      currentUserName: 'Me',
      currentUserColor: '#0066FF',
      onlineUsers: ONLINE_USERS,
      isConnected: true,
      isSynced: true,
      ...overrides,
    },
    global: {
      plugins: [createTestI18n()],
      stubs: { Transition: false },
    },
  })
}

function mountConflictIndicators(overrides: Record<string, unknown> = {}) {
  return mount(WBConflictIndicators, {
    props: {
      remoteCursors: REMOTE_CURSORS,
      remoteSelections: REMOTE_SELECTIONS,
      currentPageIndex: 0,
      strokePositions: new Map([
        ['stroke-1', { x: 50, y: 60 }],
        ['stroke-2', { x: 150, y: 160 }],
      ]),
      ...overrides,
    },
    global: {
      plugins: [createTestI18n()],
      stubs: { Teleport: true, Transition: false },
    },
  })
}

function mountRemoteCursors(overrides: Record<string, unknown> = {}) {
  return mount(WBRemoteCursorsOverlay, {
    props: {
      remoteCursors: REMOTE_CURSORS,
      remoteSelections: REMOTE_SELECTIONS,
      currentPageIndex: 0,
      ...overrides,
    },
    global: {
      plugins: [createTestI18n()],
    },
  })
}

describe('[WB:B6.1] Collaboration UX', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  // ── 1. Presence panel renders online users ───────────────────────

  it('renders online users with "you" first, then alphabetical', () => {
    const wrapper = mountPresencePanel()

    const users = wrapper.findAll('.wb-presence-panel__user')
    expect(users.length).toBe(3) // Me + Bob + Alice

    // First user should be "Me" (you)
    expect(users[0].text()).toContain('Me')
    expect(users[0].text()).toContain('You')

    // Then alphabetical: Alice before Bob
    expect(users[1].text()).toContain('Alice')
    expect(users[2].text()).toContain('Bob')
  })

  // ── 2. Follow button toggles follow mode ─────────────────────────

  it('toggles follow mode on button click', async () => {
    const wrapper = mountPresencePanel()

    const followBtns = wrapper.findAll('.wb-presence-panel__follow-btn')
    expect(followBtns.length).toBe(2) // 2 remote users

    // Click follow on first remote user (Alice)
    await followBtns[0].trigger('click')

    expect(wrapper.emitted('follow')).toBeTruthy()
    expect(wrapper.emitted('follow')![0]).toEqual(['user-3']) // Alice

    // Click again to unfollow
    await followBtns[0].trigger('click')

    expect(wrapper.emitted('unfollow')).toBeTruthy()
  })

  // ── 3. Connection status indicators ──────────────────────────────

  it('shows green dot when connected and synced', () => {
    const wrapper = mountPresencePanel({ isConnected: true, isSynced: true })

    const dot = wrapper.find('.wb-presence-panel__status-dot')
    expect(dot.classes()).toContain('wb-presence-panel__status-dot--connected')
  })

  it('shows yellow dot when connected but not synced', () => {
    const wrapper = mountPresencePanel({ isConnected: true, isSynced: false })

    const dot = wrapper.find('.wb-presence-panel__status-dot')
    expect(dot.classes()).toContain('wb-presence-panel__status-dot--syncing')
  })

  it('shows red dot when disconnected', () => {
    const wrapper = mountPresencePanel({ isConnected: false, isSynced: false })

    const dot = wrapper.find('.wb-presence-panel__status-dot')
    expect(dot.classes()).toContain('wb-presence-panel__status-dot--disconnected')
  })

  // ── 4. Selection lock icon on locked strokes ─────────────────────

  it('renders lock icons for remote selections', () => {
    const wrapper = mountConflictIndicators()

    const locks = wrapper.findAll('.wb-conflict-indicators__lock')
    expect(locks.length).toBe(2) // stroke-1 and stroke-2

    // Check tooltip
    expect(locks[0].attributes('title')).toBe('Being edited by Bob')
  })

  // ── 5. Area highlight around remote cursor ───────────────────────

  it('renders area highlight for active cursors on current page', () => {
    const wrapper = mountConflictIndicators()

    const areas = wrapper.findAll('.wb-conflict-indicators__area')
    // Only Bob's cursor is on page 0 and not faded
    expect(areas.length).toBe(1)
  })

  // ── 6. Concurrent edit toast ─────────────────────────────────────

  it('shows concurrent edit toast when multiple users on same page after page switch', async () => {
    const cursorsOnPage1 = [
      { ...REMOTE_CURSORS[0], pageId: '1', isFaded: false },
      { ...REMOTE_CURSORS[1], pageId: '1', isFaded: false, lastUpdate: Date.now() },
    ]

    // Start on page 0 (no remote cursors there)
    const wrapper = mountConflictIndicators({
      remoteCursors: cursorsOnPage1,
      currentPageIndex: 0,
    })

    await nextTick()

    // Switch to page 1 where 2 remote cursors are active
    await wrapper.setProps({ currentPageIndex: 1 })
    await nextTick()

    const vm = wrapper.vm as unknown as { showConcurrentToast: boolean; concurrentEditorCount: number }
    expect(vm.showConcurrentToast).toBe(true)
    expect(vm.concurrentEditorCount).toBe(3) // 2 remote + 1 local
  })

  // ── 7. Remote cursor rendering with correct color ────────────────

  it('renders remote cursors on current page with correct color', () => {
    const wrapper = mountRemoteCursors({ currentPageIndex: 0 })

    const cursors = wrapper.findAll('.wb-remote-cursors__cursor')
    // Only Bob is on page 0
    expect(cursors.length).toBe(1)

    // Check color via SVG fill
    const path = cursors[0].find('path')
    expect(path.attributes('fill')).toBe('#ef4444')

    // Check name label
    expect(cursors[0].text()).toContain('Bob')
  })

  it('does not render cursors from other pages', () => {
    const wrapper = mountRemoteCursors({ currentPageIndex: 2 })

    const cursors = wrapper.findAll('.wb-remote-cursors__cursor')
    expect(cursors.length).toBe(0)
  })

  // ── 8. Accessibility: aria-labels present ────────────────────────

  it('has aria-label on presence panel', () => {
    const wrapper = mountPresencePanel()

    const panel = wrapper.find('.wb-presence-panel')
    expect(panel.attributes('role')).toBe('region')
    expect(panel.attributes('aria-label')).toBe('Online users')
  })

  it('has aria-expanded on toggle button', () => {
    const wrapper = mountPresencePanel()

    const toggle = wrapper.find('.wb-presence-panel__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('has follow button with aria-label', () => {
    const wrapper = mountPresencePanel()

    const followBtns = wrapper.findAll('.wb-presence-panel__follow-btn')
    expect(followBtns[0].attributes('aria-label')).toContain('Follow')
    expect(followBtns[0].attributes('aria-label')).toContain('Alice')
  })

  // ── 9. Collapse/expand panel ─────────────────────────────────────

  it('collapses panel and shows badge count', async () => {
    const wrapper = mountPresencePanel()

    // Initially expanded
    expect(wrapper.find('.wb-presence-panel__list').exists()).toBe(true)

    // Click toggle to collapse
    await wrapper.find('.wb-presence-panel__toggle').trigger('click')

    expect(wrapper.find('.wb-presence-panel__badge').exists()).toBe(true)
    expect(wrapper.find('.wb-presence-panel__badge').text()).toBe('3')
  })

  // ── 10. User join screen reader announcement ─────────────────────

  it('announces user join via screen reader', async () => {
    const wrapper = mountPresencePanel({ onlineUsers: [] })

    // Simulate user joining
    await wrapper.setProps({
      onlineUsers: [{ userId: 'user-4', displayName: 'Charlie', color: '#8b5cf6', tool: null, pageIndex: 0 }],
    })

    await nextTick()

    const vm = wrapper.vm as unknown as { srAnnouncement: string }
    expect(vm.srAnnouncement).toContain('Charlie joined')
  })

  // ── 11. Faded cursor has reduced opacity class ───────────────────

  it('applies faded class to inactive cursors', () => {
    const wrapper = mountRemoteCursors({ currentPageIndex: 1 })

    const cursors = wrapper.findAll('.wb-remote-cursors__cursor')
    // Alice is on page 1 and faded
    expect(cursors.length).toBe(1)
    expect(cursors[0].classes()).toContain('wb-remote-cursors__cursor--faded')
  })
})
