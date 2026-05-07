// INV-22 PR-1b — WBFinalizeBarrierModal component tests
//
// Per FIRST_FIX_SPRINT_PROPOSAL §1 + INV-22 §22.7:
//   - 'closed' state hides modal
//   - 'waiting' state shows spinner, NO buttons (blocking)
//   - 'timeout' state shows seq diagnostics + retry button enabled
//   - 'contention' state shows retry button DISABLED with countdown hint
//   - emit('retry') fires EXACTLY ONCE per click (no auto-emit)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WBFinalizeBarrierModal from '../components/replay/WBFinalizeBarrierModal.vue'

describe('INV-22 PR-1b — WBFinalizeBarrierModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides modal when state="closed"', () => {
    const wrapper = mount(WBFinalizeBarrierModal, { props: { state: 'closed' } })
    expect(wrapper.find('[data-testid="wb-finalize-barrier-modal"]').exists()).toBe(false)
  })

  it('hides modal when state=null', () => {
    const wrapper = mount(WBFinalizeBarrierModal, { props: { state: null } })
    expect(wrapper.find('[data-testid="wb-finalize-barrier-modal"]').exists()).toBe(false)
  })

  it('waiting state shows spinner, NO retry button', () => {
    const wrapper = mount(WBFinalizeBarrierModal, { props: { state: 'waiting' } })
    expect(wrapper.find('[data-testid="wb-finalize-barrier-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wb-finalize-barrier-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wb-finalize-barrier-retry"]').exists()).toBe(false)
  })

  it('timeout state shows seq diagnostics + enabled retry button', () => {
    const wrapper = mount(WBFinalizeBarrierModal, {
      props: { state: 'timeout', expectedSeq: 100, currentSeq: 87 },
    })
    expect(wrapper.find('[data-testid="wb-finalize-barrier-modal"]').exists()).toBe(true)
    const diagnostic = wrapper.find('[data-testid="wb-finalize-barrier-diagnostic"]')
    expect(diagnostic.exists()).toBe(true)
    expect(diagnostic.text()).toContain('100')
    expect(diagnostic.text()).toContain('87')
    const retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    expect(retry.exists()).toBe(true)
    expect((retry.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('contention state shows DISABLED retry button initially з countdown hint', () => {
    const wrapper = mount(WBFinalizeBarrierModal, {
      props: { state: 'contention', retryAfterMs: 5000 },
    })
    const retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    expect(retry.exists()).toBe(true)
    expect((retry.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.find('[data-testid="wb-finalize-barrier-contention-hint"]').exists()).toBe(true)
  })

  it('contention state ENABLES retry button after retryAfterMs elapsed', async () => {
    const wrapper = mount(WBFinalizeBarrierModal, {
      props: { state: 'contention', retryAfterMs: 1000 },
    })
    let retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    expect((retry.element as HTMLButtonElement).disabled).toBe(true)

    // Advance fake timers past the deadline.
    vi.advanceTimersByTime(1100)
    await flushPromises()
    await wrapper.vm.$nextTick()

    retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    expect((retry.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('emits retry exactly once per click (no auto-retry, no double-fire)', async () => {
    const wrapper = mount(WBFinalizeBarrierModal, {
      props: { state: 'timeout', expectedSeq: 50, currentSeq: 30 },
    })
    const retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    // Programmer trying to wait expecting auto-emit MUST NOT see additional events.
    vi.advanceTimersByTime(10_000)
    await flushPromises()
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('does NOT emit retry when button disabled (contention path)', async () => {
    const wrapper = mount(WBFinalizeBarrierModal, {
      props: { state: 'contention', retryAfterMs: 5000 },
    })
    const retry = wrapper.find('[data-testid="wb-finalize-barrier-retry"]')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toBeUndefined()
  })
})
