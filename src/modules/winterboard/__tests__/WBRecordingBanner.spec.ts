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

  it('finalized: бейдж «Запис завершено» — єдина кнопка, емітить restart', async () => {
    // Історія: 2026-09-23 (FIRST USER GATE, крок 6) кнопку «Новий запис» звідси
    // прибрали, бо поруч була жовта смуга WBFrozenBanner з тією самою кнопкою.
    // 2026-09-24 (рішення власника) смуги в соло немає — властивість «з
    // finalized можна перезаписати» (re-record guard 2026-05-19) тепер тримає
    // сам бейдж: клік → restart → вікно «Запис завершено. Як продовжити?».
    const w = mount(WBRecordingBanner, { props: { recordingState: 'finalized' } })
    const badge = w.find('button.wb-recording-banner__frozen')
    expect(badge.exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(1)
    await badge.trigger('click')
    expect(w.emitted('restart')).toHaveLength(1)
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
