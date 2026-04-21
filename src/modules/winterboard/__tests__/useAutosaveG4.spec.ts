// G4 (2026-04-21): Tests for useAutosave — isDirty-watcher no longer triggers
// /save-stream/ under the 3s debounce cycle; beacon suffices on tab-hide.
//
// Background:
// Prior to G4 fix, useAutosave watched `store.isDirty` and auto-triggered
// `performStreamSave()` → POST /save-stream/ every 3s. This competed with
// /replay/batch/ (ops-log writer) for the WBSession row lock → 409 session_locked
// cascade (G3 in saas_docs/domains/winterboard/REPLAY_PIPELINE_SSOT.md §6).
//
// After G4:
//   - isDirty changes are ignored (no streamSave auto-trigger)
//   - handleVisibilityChange sends beacon only (no performSave race)
//   - Manual saveNow() still calls streamSave (for record-start, template save,
//     nav-away use cases — see WBSoloRoom.vue:1041, 2598, 2631)
//   - beforeunload still sends beacon

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ─── Mocks ───────────────────────────────────────────────────────────────

const mockStreamSave = vi.fn()
const mockBeaconSave = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    streamSave: (...args: unknown[]) => mockStreamSave(...args),
    beaconSave: (...args: unknown[]) => mockBeaconSave(...args),
  },
}))

vi.mock('@/utils/apiClient', () => ({
  default: {},
  isCircuitBreakerOpen: () => false,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// Minimal store mock — not using real pinia store to avoid full setup.
const makeStoreMock = () => ({
  isDirty: false,
  rev: 1,
  mode: 'edit' as const,
  serializedState: { pages: [{ id: 'page-1', strokes: [], assets: [] }] },
  serializedStateForSave: { pages: [{ id: 'page-1', strokes: [], assets: [] }] },
  setSyncStatus: vi.fn(),
  setSyncError: vi.fn(),
  setLastSaved: vi.fn(),
})

let storeMock = makeStoreMock()
vi.mock('../board/state/boardStore', () => ({
  useWBStore: () => storeMock,
}))

// ─── Import AFTER mocks defined ──────────────────────────────────────────

import { useAutosave } from '../composables/useAutosave'

// ─── Helpers ─────────────────────────────────────────────────────────────

function mountAutosave(sessionId = 'test-session-uuid') {
  const sid = ref<string | null>(sessionId)
  const autosave = useAutosave(sid)
  return { autosave, sid }
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('G4: useAutosave does not auto-stream on isDirty', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStreamSave.mockReset()
    mockBeaconSave.mockReset()
    mockStreamSave.mockResolvedValue({ rev: 2 })
    storeMock = makeStoreMock()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('isDirty=true does NOT trigger streamSave within 10s', async () => {
    const { autosave } = mountAutosave()

    storeMock.isDirty = true
    await nextTick()

    // Advance well past the old 3s DEBOUNCE_MS and 15s MAX_WAIT_MS:
    vi.advanceTimersByTime(20_000)
    await nextTick()

    expect(mockStreamSave).not.toHaveBeenCalled()

    autosave.destroy()
  })

  it('saveNow() still triggers streamSave exactly once', async () => {
    const { autosave } = mountAutosave()

    storeMock.isDirty = true
    await autosave.saveNow()

    expect(mockStreamSave).toHaveBeenCalledTimes(1)

    autosave.destroy()
  })

  it('visibilitychange→hidden sends beacon only, not streamSave', async () => {
    const { autosave } = mountAutosave()

    storeMock.isDirty = true
    // Simulate tab hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()

    expect(mockBeaconSave).toHaveBeenCalledTimes(1)
    expect(mockStreamSave).not.toHaveBeenCalled()

    autosave.destroy()
  })

  it('beforeunload sends beacon', async () => {
    const { autosave } = mountAutosave()

    storeMock.isDirty = true
    window.dispatchEvent(new Event('beforeunload'))
    await nextTick()

    expect(mockBeaconSave).toHaveBeenCalledTimes(1)

    autosave.destroy()
  })

  it('destroy() with isDirty=true sends final beacon', async () => {
    const { autosave } = mountAutosave()

    storeMock.isDirty = true
    autosave.destroy()

    expect(mockBeaconSave).toHaveBeenCalledTimes(1)
    expect(mockStreamSave).not.toHaveBeenCalled()
  })
})
