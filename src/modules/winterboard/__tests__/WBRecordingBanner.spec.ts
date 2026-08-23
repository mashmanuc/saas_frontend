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

  it('renders start button in finalized state (re-record enabled)', async () => {
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('emits restart when button clicked in finalized state', async () => {
    // DIR-хвости-2 §3 (2026-08-24): у finalized кнопка тепер емить 'restart'
    // (btn--restart, WBRecordingBanner.vue:101-110) — це і Є re-record-флоу,
    // який стеріг цей файл; 'start' лишився лише для idle. Тест приведено до
    // чинного контракту, а не видалено: властивість «з finalized можна
    // перезаписати» жива.
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    await w.find('.wb-recording-banner__btn--restart').trigger('click')
    expect(w.emitted('restart')).toHaveLength(1)
  })

  it('shows frozen indicator alongside start button in finalized state', () => {
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    expect(w.find('.wb-recording-banner__frozen').exists()).toBe(true)
    expect(w.find('button').exists()).toBe(true)
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
      props: { recordingState: 'finalized', isLoading: true },
    })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })
})
