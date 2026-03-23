/**
 * Phase 30 B6: AuditOverlay Unit Tests
 *
 * Tests overlay rendering, status classes, metric display,
 * toggle visibility, and graceful degradation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import AuditOverlay from '../AuditOverlay.vue'
import type { AuditSnapshot } from '../types'

function makeSnapshot(overrides: Partial<AuditSnapshot> = {}): AuditSnapshot {
  return {
    requests: 5,
    duplicates: 0,
    cacheTotal: 10,
    cacheFresh: 8,
    cacheStale: 2,
    cacheHitRate: 0.8,
    wsEventsInWindow: 1,
    wsEventsTotal: 3,
    status: 'ok',
    timestamp: Date.now(),
    ...overrides,
  }
}

const mockSnapshot = ref<AuditSnapshot | null>(makeSnapshot())
const mockIsVisible = ref(true)
const mockToggle = vi.fn()

vi.mock('../useAuditOverlay', () => ({
  useAuditOverlay: () => ({
    snapshot: readonly(mockSnapshot),
    isVisible: readonly(mockIsVisible),
    toggle: mockToggle,
  }),
}))

function mountOverlay() {
  return mount(AuditOverlay, {
    global: {
      stubs: {
        Teleport: true,
        Transition: true,
      },
    },
  })
}

describe('AuditOverlay', () => {
  beforeEach(() => {
    mockSnapshot.value = makeSnapshot()
    mockIsVisible.value = true
    vi.clearAllMocks()
  })

  it('renders overlay with all metric rows', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="audit-overlay"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audit-requests"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audit-duplicates"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audit-cache"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audit-ws"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audit-status"]').exists()).toBe(true)
  })

  it('does not render when toggle is off', () => {
    mockIsVisible.value = false
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="audit-overlay"]').exists()).toBe(false)
  })

  it('applies audit-overlay--ok class for ok status', () => {
    mockSnapshot.value = makeSnapshot({ status: 'ok' })
    const wrapper = mountOverlay()
    expect(wrapper.find('.audit-overlay--ok').exists()).toBe(true)
  })

  it('applies audit-overlay--warn class for warn status', () => {
    mockSnapshot.value = makeSnapshot({ status: 'warn' })
    const wrapper = mountOverlay()
    expect(wrapper.find('.audit-overlay--warn').exists()).toBe(true)
  })

  it('applies audit-overlay--error class for error status', () => {
    mockSnapshot.value = makeSnapshot({ status: 'error' })
    const wrapper = mountOverlay()
    expect(wrapper.find('.audit-overlay--error').exists()).toBe(true)
  })

  it('shows correct cache percentage', () => {
    mockSnapshot.value = makeSnapshot({ cacheHitRate: 0.85 })
    const wrapper = mountOverlay()
    const cacheRow = wrapper.find('[data-testid="audit-cache"]')
    expect(cacheRow.text()).toContain('85%')
  })

  it('shows correct request count', () => {
    mockSnapshot.value = makeSnapshot({ requests: 12 })
    const wrapper = mountOverlay()
    const requestsRow = wrapper.find('[data-testid="audit-requests"]')
    expect(requestsRow.text()).toContain('12')
  })

  it('shows correct WS events', () => {
    mockSnapshot.value = makeSnapshot({ wsEventsInWindow: 4 })
    const wrapper = mountOverlay()
    const wsRow = wrapper.find('[data-testid="audit-ws"]')
    expect(wsRow.text()).toContain('4/5s')
  })

  it('does not crash when snapshot is null', () => {
    mockSnapshot.value = null
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="audit-overlay"]').exists()).toBe(false)
  })

  it('shows error badge icon for duplicates >= threshold', () => {
    mockSnapshot.value = makeSnapshot({ duplicates: 3, status: 'error' })
    const wrapper = mountOverlay()
    const dupRow = wrapper.find('[data-testid="audit-duplicates"]')
    expect(dupRow.text()).toContain('❌')
  })

  // Phase 31: Issues display tests (B11)
  describe('issues display', () => {
    it('shows issues block when issues present', () => {
      mockSnapshot.value = makeSnapshot({
        status: 'error',
        issues: [
          { id: 'dup-2', level: 'error', message: 'Duplicate requests (2)', hint: 'Check queryKey dedup' },
          { id: 'cache-45', level: 'warn', message: 'Cache hit rate 45%', hint: 'Check staleTime config' },
        ],
      })
      const wrapper = mountOverlay()
      expect(wrapper.find('[data-testid="audit-issues"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-issue-dup-2"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-issue-cache-45"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="audit-issue-dup-2"]').text()).toContain('Duplicate requests (2)')
    })

    it('does not show issues block when issues undefined (backward compat)', () => {
      mockSnapshot.value = makeSnapshot({ status: 'ok' })
      // issues field is undefined by default in makeSnapshot
      const wrapper = mountOverlay()
      expect(wrapper.find('[data-testid="audit-issues"]').exists()).toBe(false)
    })

    it('truncates to 3 visible issues and shows +N more', () => {
      mockSnapshot.value = makeSnapshot({
        status: 'error',
        issues: [
          { id: 'i1', level: 'error', message: 'Issue 1', hint: 'h1' },
          { id: 'i2', level: 'warn', message: 'Issue 2', hint: 'h2' },
          { id: 'i3', level: 'warn', message: 'Issue 3', hint: 'h3' },
          { id: 'i4', level: 'warn', message: 'Issue 4', hint: 'h4' },
          { id: 'i5', level: 'error', message: 'Issue 5', hint: 'h5' },
        ],
      })
      const wrapper = mountOverlay()
      const issues = wrapper.findAll('.audit-overlay__issue')
      expect(issues).toHaveLength(3)
      const more = wrapper.find('[data-testid="audit-issues-more"]')
      expect(more.exists()).toBe(true)
      expect(more.text()).toContain('+2 more')
    })

    it('applies correct color classes per issue level', () => {
      mockSnapshot.value = makeSnapshot({
        status: 'error',
        issues: [
          { id: 'err1', level: 'error', message: 'Error issue', hint: 'fix' },
          { id: 'warn1', level: 'warn', message: 'Warn issue', hint: 'check' },
        ],
      })
      const wrapper = mountOverlay()
      expect(wrapper.find('[data-testid="audit-issue-err1"]').classes()).toContain('audit-overlay__issue--error')
      expect(wrapper.find('[data-testid="audit-issue-warn1"]').classes()).toContain('audit-overlay__issue--warn')
    })
  })
})
