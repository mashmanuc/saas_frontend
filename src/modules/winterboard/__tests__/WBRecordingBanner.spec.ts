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

  it('finalized: лише бейдж «Запис завершено», без власної кнопки', () => {
    // FIRST USER GATE 2026-09-23, крок 6: кнопка «Новий запис» була і тут, і в
    // WBFrozenBanner — дві однакові поруч. Властивість «з finalized можна
    // перезаписати» (re-record guard 2026-05-19, DIR-хвости-2 §3) жива: її
    // тримає WBFrozenBanner (WBFrozenBanner.spec — кнопка емітить restart),
    // який у WBSoloRoom видно за тієї ж умови, що й цей бейдж.
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    expect(w.find('.wb-recording-banner__frozen').exists()).toBe(true)
    expect(w.find('button').exists()).toBe(false)
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
