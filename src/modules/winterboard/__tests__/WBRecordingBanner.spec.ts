// WBRecordingBanner — re-record guard fix (2026-05-19)
//
// Bug: WBSoloRoom.handleStartRecording had `isReplayFrozen.value` guard that
// silently blocked API call in FINALIZED state. Fix: guard removed. This test
// verifies WBRecordingBanner renders the clickable start button in 'finalized'
// state (which would be meaningless if the click was blocked upstream).

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WBRecordingBanner from '../components/replay/WBRecordingBanner.vue'

describe('WBRecordingBanner', () => {
  it('renders start button in idle state', () => {
    const w = mount(WBRecordingBanner, { props: { recordingState: 'idle' } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('finalized: та сама кнопка «Записати урок», що й в idle — емітить start', async () => {
    // INV-23 v3 (рішення власника 2026-09-27): завершений запис дошку не блокує;
    // новий запис — лише добровільно, звичайною кнопкою запису, з поточного стану.
    // Бейджа «Запис завершено» і вікна «Як продовжити?» більше немає.
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    const btn = w.find('button.wb-recording-banner__btn--start')
    expect(btn.exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(1)
    await btn.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
    expect(w.emitted('restart')).toBeUndefined()
  })

  it('does NOT show start button in recording state', () => {
    // Контракт recording-стану: pause + finalize (класу --stop більше немає).
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'recording', recordingStartedAt: null },
    })
    expect(w.find('.wb-recording-banner__btn--pause').exists()).toBe(true)
    expect(w.find('.wb-recording-banner__btn--finalize').exists()).toBe(true)
    expect(w.find('.wb-recording-banner__btn--start').exists()).toBe(false)
  })

  it('emits pause when pause button clicked in recording state', async () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'recording', recordingStartedAt: null },
    })
    await w.find('.wb-recording-banner__btn--pause').trigger('click')
    expect(w.emitted('pause')).toHaveLength(1)
  })

  it('emits finalize when finalize button clicked in recording state', async () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'recording', recordingStartedAt: null },
    })
    await w.find('.wb-recording-banner__btn--finalize').trigger('click')
    expect(w.emitted('finalize')).toHaveLength(1)
  })

  it('disables button when isLoading=true', () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'idle', isLoading: true },
    })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })
})
