// G4 (2026-04-21, переписано 2026-08-24 — DIR-хвости-2 §1):
// властивість G4 «isDirty НЕ тригерить мережу» жива, але сторожі змінились.
//
// Що сталося з архітектурою (виміряно по коду, не по пам'яті):
//   - власний write-шлях useAutosave ВИДАЛЕНО (Phase 2 cleanup): немає
//     streamSave-callsite, немає beaconSave×3, немає слухачів
//     visibilitychange/beforeunload — composable став тонким proxy над
//     opsSyncStore.flush() (single-writer, LAW §9). Джерело:
//     useAutosave.ts:1-24 (шапка) + тіло без жодного з цих викликів.
//   - beacon скасовано НАЗАВЖДИ (Variant A locked 2026-04-27):
//     navigator.sendBeacon не може нести X-Protocol-Version (LAW §10) →
//     opsSyncStore.sendBeacon() ЗАВЖДИ кидає BeaconUnsupportedError
//     (useReplayRecorder.ts:394-406).
//
// Тому зі старої п'ятірки:
//   - 3 beacon-тести ВИДАЛЕНО — стерегли властивість, якої в новій
//     архітектурі немає ЗА ПОБУДОВОЮ (не «зламалась», а скасована рішенням);
//   - «saveNow → streamSave once» ПЕРЕПИСАНО: saveNow → рівно один
//     POST /replay/batch/ через store;
//   - «isDirty не тригерить» ПЕРЕПИСАНО під новий контракт + kill-тест
//     джерела, який не дасть G4-класу повернутись тихо.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setActivePinia, createPinia } from 'pinia'

// ─── Mocks (до імпорту store) ────────────────────────────────────────────
const recordOperationsBatchMock = vi.fn()

vi.mock('../api/replay', () => ({
  recordOperationsBatch: (...args: unknown[]) => recordOperationsBatchMock(...args),
  createSnapshot: vi.fn(),
  PROTOCOL_VERSION: 'v3',
}))

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  isCircuitBreakerOpen: () => false,
}))

import { ref } from 'vue'
import { useAutosave } from '../composables/useAutosave'
import { useOpsSyncStore } from '../stores/opsSyncStore'

function _op(n = 0) {
  return {
    op_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
  }
}

/** Канонічний прелюд (як у invariants/opsSync.spec.ts): стан напряму. */
function syncedStore(sid = 'sess-g4') {
  const store = useOpsSyncStore()
  store.sessionId = sid
  store.mode = 'SYNC'
  store.serverSeq = 0
  store.localSeq = 0
  return store
}

describe('G4: useAutosave — proxy над opsSyncStore, без власної мережі', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    recordOperationsBatchMock.mockReset()
    recordOperationsBatchMock.mockImplementation(
      async (_sid: string, seq: number, ops: unknown[]) => ({
        last_seq: (seq as number) + (ops as unknown[]).length,
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('монтування + 20с простою → НУЛЬ мережевих викликів (спадок G4)', async () => {
    vi.useFakeTimers()
    syncedStore()
    const autosave = useAutosave(ref<string | null>('sess-g4'))

    vi.advanceTimersByTime(20_000)

    expect(recordOperationsBatchMock).not.toHaveBeenCalled()
    autosave.destroy()
  })

  it('saveNow() з 1 pending op → рівно один POST /replay/batch/', async () => {
    const store = syncedStore()
    const autosave = useAutosave(ref<string | null>('sess-g4'))

    store.record(_op(1))
    await autosave.saveNow()

    expect(recordOperationsBatchMock).toHaveBeenCalledTimes(1)
    const [sid, seq, ops] = recordOperationsBatchMock.mock.calls[0]
    expect(sid).toBe('sess-g4')
    expect(seq).toBe(0)
    expect((ops as unknown[]).length).toBe(1)
    expect(autosave.saveCount.value).toBe(1)
    expect(autosave.status.value).toBe('saved')
    autosave.destroy()
  })

  it('saveNow() при DESYNC не кидає — статус error, UI живе', async () => {
    const store = syncedStore()
    store.mode = 'DESYNC'
    store.desyncReason = 'protocol-version-mismatch'
    const autosave = useAutosave(ref<string | null>('sess-g4'))

    await expect(autosave.saveNow()).resolves.toBeUndefined()

    expect(autosave.status.value).toBe('error')
    expect(autosave.lastError.value).toBeTruthy()
    expect(recordOperationsBatchMock).not.toHaveBeenCalled()
    autosave.destroy()
  })

  it('kill-тест джерела: G4-клас не повертається (dual-writer видалено)', () => {
    // Прибрали proxy і повернули власний write-шлях — цей тест падає.
    const raw = readFileSync(
      resolve(__dirname, '../composables/useAutosave.ts'),
      'utf8',
    )
    // Шапка-коментар чесно перелічує «чого більше немає» тими самими
    // словами — тому коментарі зрізаємо і міряємо лише КОД.
    const code = raw
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/winterboardApi\s*\.\s*(streamSave|beaconSave)/)
    expect(code).not.toMatch(/addEventListener\(\s*['"](visibilitychange|beforeunload)/)
    expect(code).not.toMatch(/watch\([^)]*isDirty/s)
    // І позитивний бік: єдиний write-шлях — flush store.
    expect(code).toMatch(/opsSync\.flush\(\)/)
  })
})
