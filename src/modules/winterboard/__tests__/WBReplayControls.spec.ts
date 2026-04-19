// A12 Part 2: Unit tests for WBReplayControls.vue
// Ref: DAY18_AGENT-A.md — мінімум 6 тестів

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBReplayControls from '../components/replay/WBReplayControls.vue'

// ── Mock useReplay composable ─────────────────────────────────────────────────
const mockPlay = vi.fn()
const mockPause = vi.fn()
const mockStop = vi.fn()
const mockSetSpeed = vi.fn()
const mockSeekTo = vi.fn()
const mockDestroy = vi.fn()
const mockLoadTimeline = vi.fn().mockResolvedValue(undefined)

import { ref, readonly } from 'vue'

const stateRef = ref<'idle' | 'playing' | 'paused' | 'ended'>('idle')
const currentIndexRef = ref(0)
const totalOperationsRef = ref(5)
const isLoadingRef = ref(false)
const errorRef = ref<string | null>(null)
const loadedOperationsRef = ref(5)
const timelineIncompleteRef = ref(false)
const markersRef = ref<Array<{ id: string; operation_index: number; title: string }>>([])
const activeMarkerIdRef = ref<string | null>(null)

const mockRetryLoad = vi.fn()
const mockSeekToWithSnapshot = vi.fn()
const mockStepForward = vi.fn()
const mockStepBackward = vi.fn()
const mockLoadMarkers = vi.fn().mockResolvedValue(undefined)

vi.mock('../composables/useReplay', () => ({
  useReplay: () => ({
    state: readonly(stateRef),
    currentIndex: readonly(currentIndexRef),
    totalOperations: readonly(totalOperationsRef),
    isLoading: readonly(isLoadingRef),
    error: readonly(errorRef),
    progress: readonly(ref(0)),
    loadedOperations: readonly(loadedOperationsRef),
    timelineIncomplete: readonly(timelineIncompleteRef),
    markers: readonly(markersRef),
    activeMarkerId: readonly(activeMarkerIdRef),
    loadTimeline: mockLoadTimeline,
    retryLoad: mockRetryLoad,
    loadMarkers: mockLoadMarkers,
    play: mockPlay,
    pause: mockPause,
    stop: mockStop,
    setSpeed: mockSetSpeed,
    seekTo: mockSeekTo,
    seekToWithSnapshot: mockSeekToWithSnapshot,
    stepForward: mockStepForward,
    stepBackward: mockStepBackward,
    destroy: mockDestroy,
  }),
}))

// ── i18n stub ─────────────────────────────────────────────────────────────────

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      replay: {
        timeline: 'Replay timeline',
        play: 'Play',
        pause: 'Pause',
        stop: 'Stop',
        speed: 'Playback speed',
        exit: 'Exit replay',
        exitReplay: 'Exit replay',
        viewReplay: 'View replay',
        replayEnded: 'Replay ended',
        loading: 'Loading replay…',
      },
    },
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountControls() {
  return mount(WBReplayControls, {
    props: { sessionId: 'test-uuid' },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stateRef.value = 'idle'
  currentIndexRef.value = 0
  totalOperationsRef.value = 5
  isLoadingRef.value = false
  errorRef.value = null
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WBReplayControls — renders', () => {
  it('renders controls container', async () => {
    const wrapper = mountControls()
    await flushPromises()
    expect(wrapper.find('.wb-replay-controls').exists()).toBe(true)
  })

  it('calls loadTimeline on mount', async () => {
    mountControls()
    await flushPromises()
    expect(mockLoadTimeline).toHaveBeenCalledOnce()
  })

  it('shows play button (▶) when idle', async () => {
    const wrapper = mountControls()
    await flushPromises()
    const btn = wrapper.find('[data-testid="replay-play-pause"]')
    expect(btn.text()).toContain('▶')
  })

  it('shows pause button (⏸) when playing', async () => {
    stateRef.value = 'playing'
    const wrapper = mountControls()
    await flushPromises()
    const btn = wrapper.find('[data-testid="replay-play-pause"]')
    expect(btn.text()).toContain('⏸')
  })

  it('shows replayEnded text when state is ended', async () => {
    stateRef.value = 'ended'
    const wrapper = mountControls()
    await flushPromises()
    expect(wrapper.html()).toContain('Replay ended')
  })

  it('shows error when error is set', async () => {
    errorRef.value = 'Network error'
    const wrapper = mountControls()
    await flushPromises()
    expect(wrapper.find('[data-testid="replay-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="replay-error"]').text()).toContain('Network error')
  })
})

describe('WBReplayControls — play/pause toggle', () => {
  it('calls play() when clicking play button in idle state', async () => {
    const wrapper = mountControls()
    await flushPromises()
    await wrapper.find('[data-testid="replay-play-pause"]').trigger('click')
    expect(mockPlay).toHaveBeenCalledOnce()
  })

  it('calls pause() when clicking play/pause button in playing state', async () => {
    stateRef.value = 'playing'
    const wrapper = mountControls()
    await flushPromises()
    await wrapper.find('[data-testid="replay-play-pause"]').trigger('click')
    expect(mockPause).toHaveBeenCalledOnce()
  })

  // Removed 2026-04-20: separate "stop" button eliminated from UI.
  // Stop is now invoked internally via state transitions (play/pause toggle).
  // useReplay.stop() still exists but isn't exposed as a dedicated button.
})

describe('WBReplayControls — seek', () => {
  it('calls seekTo with parsed slider value on input', async () => {
    const wrapper = mountControls()
    await flushPromises()
    const slider = wrapper.find('[data-testid="replay-slider"]')
    // Set value directly on DOM element, then trigger event
    ;(slider.element as HTMLInputElement).value = '3'
    await slider.trigger('input')
    expect(mockSeekTo).toHaveBeenCalledWith(3)
  })
})

describe('WBReplayControls — speed', () => {
  it('calls setSpeed with parsed value on change', async () => {
    const wrapper = mountControls()
    await flushPromises()
    const select = wrapper.find('[data-testid="replay-speed"]')
    // Set value directly on DOM element, then trigger event
    ;(select.element as HTMLSelectElement).value = '2'
    await select.trigger('change')
    expect(mockSetSpeed).toHaveBeenCalledWith(2)
  })
})

describe('WBReplayControls — exit emit', () => {
  it('emits exit when exit button is clicked', async () => {
    const wrapper = mountControls()
    await flushPromises()
    await wrapper.find('[data-testid="replay-exit"]').trigger('click')
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })
})

describe('WBReplayControls — destroy on unmount', () => {
  it('calls destroy() on unmount', async () => {
    const wrapper = mountControls()
    await flushPromises()
    wrapper.unmount()
    expect(mockDestroy).toHaveBeenCalledOnce()
  })
})
