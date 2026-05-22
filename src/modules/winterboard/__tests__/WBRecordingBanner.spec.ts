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

  it('emits start when button clicked in finalized state', async () => {
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    await w.find('button').trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
  })

  it('shows frozen indicator alongside start button in finalized state', () => {
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    expect(w.find('.wb-recording-banner__frozen').exists()).toBe(true)
    expect(w.find('button').exists()).toBe(true)
  })

  it('does NOT show start button in recording state', () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'recording', recordingStartedAt: null },
    })
    const stopBtn = w.find('.wb-recording-banner__btn--stop')
    expect(stopBtn.exists()).toBe(true)
    expect(w.find('.wb-recording-banner__btn--start').exists()).toBe(false)
  })

  it('emits pause when stop button clicked in recording state', async () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'recording', recordingStartedAt: null },
    })
    await w.find('.wb-recording-banner__btn--stop').trigger('click')
    expect(w.emitted('pause')).toHaveLength(1)
  })

  it('disables button when isLoading=true', () => {
    const w = mount(WBRecordingBanner, {
      props: { recordingState: 'finalized', isLoading: true },
    })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })
})
