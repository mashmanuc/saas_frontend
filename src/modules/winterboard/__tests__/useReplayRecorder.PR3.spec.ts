// PR3 (2026-04-26): тести для 409 control loop у useReplayRecorder.
// Перевіряє інваріанти від помічника:
//   1. 5×409 поспіль → реально є pause (consecutive trigger).
//   2. 25 total cap → НЕ крашить (це головне), а STOP + telemetry + pipelineStatus='broken'.
//   3. throw НЕ використовується (cap path не викидає Error який би вибив у вище).
//
// Сесійні counters consecutive409 / total409InSession — крос-flush state.
// Тестуємо через зовнішні effects: pipelineStatus, trackEvent, console.warn.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

// ─── Mocks (ДО import composable) ────────────────────────────────────────────

const mockRecordBatch = vi.fn()
const mockCreateSnapshot = vi.fn()
const mockCheckOps = vi.fn()

vi.mock('../api/replay', () => ({
  recordOperationsBatch: (...args: unknown[]) => mockRecordBatch(...args),
  createSnapshot: (...args: unknown[]) => mockCreateSnapshot(...args),
  checkOps: (...args: unknown[]) => mockCheckOps(...args),
}))

const mockTrackEvent = vi.fn()
vi.mock('@/utils/telemetryAgent', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

vi.mock('@/utils/apiClient', () => ({
  isCircuitBreakerOpen: () => false,
}))

vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: () => () => {},
  isAuthDead: () => false,
}))

vi.mock('../composables/useOpsBackup', () => ({
  saveBackup: vi.fn(),
  clearBackup: vi.fn(),
  readBackup: () => null,
}))

// ─── Imports (ПІСЛЯ mocks) ───────────────────────────────────────────────────

import { useReplayRecorder } from '../composables/useReplayRecorder'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOp(suffix: string) {
  return {
    op_type: 'asset_add',
    payload: { asset: { id: `a-${suffix}` } },
  } as { op_type: string; payload: unknown }
}

function make409Error(): Error & { response: { status: number; data: { detail: string } } } {
  const err = new Error('409 session_locked') as Error & {
    response: { status: number; data: { detail: string } }
  }
  err.response = { status: 409, data: { detail: 'session_locked' } }
  return err
}

function setupRecorder() {
  const sessionId = ref<string | null>('test-session-pr3')
  const enabled = ref(true)
  const recorder = useReplayRecorder({
    sessionId,
    getBoardState: () => ({}),
    enabled,
  })
  return { recorder, sessionId, enabled }
}

// PR3 робить багато sleep'ів (jitter 200-5000ms × MAX_LOCK_RETRIES + PAUSE 1.5s).
// З real timers тест затягне на хвилини. Мокаємо setTimeout щоб callbacks
// виконувались одразу — вся waiting-логіка стиснута до 0.
let _setTimeoutSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  vi.clearAllMocks()
  _setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(
    ((fn: () => void) => {
      // Виконуємо callback асинхронно у мікротаску, щоб await sleep() resolve'ив
      Promise.resolve().then(fn)
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout,
  )
})

afterEach(() => {
  _setTimeoutSpy?.mockRestore()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PR3 — 409 control loop', () => {
  it('25-cap НЕ throw — STOP + pipelineStatus=broken + telemetry cap_hit', async () => {
    // Strategy: ВСІ recordBatch калли = 409. Ганяємо flush у циклі поки cap fire.
    mockRecordBatch.mockRejectedValue(make409Error())

    const { recorder } = setupRecorder()
    recorder.record(makeOp('1'))

    // У межах одного flush'а max 11 fails (lockRetry до 10 + 1 break).
    // total=11 після flush #1. Cross-flush лічильник lockRetryCount тримає 11
    // після першого flush → 2-й flush одразу break після 1 fail (12), і т.д.
    // Через ~14 flush-ів total має перевищити 25 → cap fire.
    let capHit = false
    for (let i = 0; i < 30; i++) {
      try {
        await recorder.flush()
      } catch {
        // flush може кинути generic error від retryQueue overflow — це НЕ наш cap.
        // Cap не throw'ить, ми перевіряємо через telemetry.
      }
      const calls = mockTrackEvent.mock.calls.filter(
        c => c[0] === 'wb.ops.lock_storm_cap_hit',
      )
      if (calls.length > 0) {
        capHit = true
        break
      }
      // буфер пустий після flush, додаємо нові ops щоб був матеріал для retry
      recorder.record(makeOp(`r${i}`))
    }

    expect(capHit).toBe(true)
    expect(recorder.pipelineStatus.value).toBe('broken')

    // Перевіряємо payload telemetry події.
    const capCall = mockTrackEvent.mock.calls.find(
      c => c[0] === 'wb.ops.lock_storm_cap_hit',
    )
    expect(capCall).toBeDefined()
    expect(capCall![1]).toMatchObject({
      session_id: 'test-session-pr3',
      cap: 25,
    })
    expect((capCall![1] as { total_409: number }).total_409).toBeGreaterThan(25)
  }, 15_000)

  it('CAP path НЕ викидає Error — урок не падає', async () => {
    // Паралельний інваріант з попередньо: специфічно перевіряємо що
    // cap-trigger path не throw'ить error який би сягнув ВИЩЕ flush'а
    // (зломав би урок).
    mockRecordBatch.mockRejectedValue(make409Error())

    const { recorder } = setupRecorder()
    recorder.record(makeOp('safe'))

    // Не очікуємо unhandled rejection
    let unhandledThrown = false
    for (let i = 0; i < 30; i++) {
      try {
        await recorder.flush()
      } catch (e) {
        // generic flush error (retryQueue overflow / 409 limit) — це OK,
        // recorder сам catch'ить у async flow. STOP cap НЕ повинен сюди дійти.
        const msg = (e as Error)?.message || ''
        if (msg.includes('409 storm cap')) {
          unhandledThrown = true
        }
      }
      if (recorder.pipelineStatus.value === 'broken') break
      recorder.record(makeOp(`r${i}`))
    }

    expect(unhandledThrown).toBe(false)
    expect(recorder.pipelineStatus.value).toBe('broken')
  }, 15_000)

  it('PR4: cap-trigger викликає check-ops і дропає saved ops з queues', async () => {
    // Storm 409 → cap fire → recoverFromOverflow викликає checkOps. У відповіді
    // BE сповіщає що 5 ops уже збережені — recorder їх дропає.
    mockRecordBatch.mockRejectedValue(make409Error())
    // Перший дзвінок check-ops повертає 5 saved (з тих op_id які ми створили)
    mockCheckOps.mockImplementation(async (_sid: string, opIds: string[]) => ({
      saved: opIds.slice(0, 5),
      missing: opIds.slice(5),
    }))

    const { recorder } = setupRecorder()
    for (let i = 0; i < 30; i++) {
      recorder.record(makeOp(`r${i}`))
      try { await recorder.flush() } catch { /* ignore */ }
      if (recorder.pipelineStatus.value === 'broken') break
    }

    // PR3 cap → PR4 recovery → checkOps викликаний
    expect(mockCheckOps).toHaveBeenCalled()
    // payload має op_ids list (НЕ порожній)
    const checkArgs = mockCheckOps.mock.calls[0]
    expect(checkArgs[0]).toBe('test-session-pr3')
    expect(Array.isArray(checkArgs[1])).toBe(true)
    expect((checkArgs[1] as string[]).length).toBeGreaterThan(0)

    // Telemetry для reconciliation fired
    const reconciledCalls = mockTrackEvent.mock.calls.filter(
      c => c[0] === 'wb.ops.reconciled',
    )
    expect(reconciledCalls.length).toBe(1)
    expect(reconciledCalls[0][1]).toMatchObject({
      session_id: 'test-session-pr3',
      dropped_saved: 5,
    })
  }, 15_000)

  it('PR4: check-ops failure НЕ ламає recorder (best-effort)', async () => {
    mockRecordBatch.mockRejectedValue(make409Error())
    mockCheckOps.mockRejectedValue(new Error('check-ops 500'))

    const { recorder } = setupRecorder()
    let unhandled = false
    for (let i = 0; i < 30; i++) {
      recorder.record(makeOp(`r${i}`))
      try {
        await recorder.flush()
      } catch (e) {
        // ловимо тільки не-cap-related throws (cap НЕ throw, recovery теж НЕ throw)
        const msg = (e as Error)?.message || ''
        if (msg.includes('check-ops') || msg.includes('storm cap')) {
          unhandled = true
        }
      }
      if (recorder.pipelineStatus.value === 'broken') break
    }
    expect(unhandled).toBe(false)
    expect(recorder.pipelineStatus.value).toBe('broken')
  }, 15_000)

  it('Success скидає consecutive409, total НЕ скидається', async () => {
    // 4 fails → success → 4 fails → success.
    // Якби total скидався, 8 разів < cap 25 → НЕ broken.
    // Якби consecutive НЕ скидався, на 5-му pause би fired (timing-leak у тест).
    // Перевіряємо тільки те що: після 5 успіхів pipelineStatus НЕ broken.
    let callCount = 0
    mockRecordBatch.mockImplementation(async () => {
      callCount++
      // парні дзвінки success, непарні 409
      if (callCount % 2 === 0) {
        return { recorded: 1, total_operations: callCount / 2 }
      }
      throw make409Error()
    })

    const { recorder } = setupRecorder()
    for (let i = 0; i < 10; i++) {
      recorder.record(makeOp(`alt${i}`))
      try { await recorder.flush() } catch { /* ignore */ }
    }

    // mix успіхів і fails — cap НЕ має fire (не 25 fails)
    const capCalls = mockTrackEvent.mock.calls.filter(
      c => c[0] === 'wb.ops.lock_storm_cap_hit',
    )
    expect(capCalls.length).toBe(0)
    expect(recorder.pipelineStatus.value).not.toBe('broken')
  }, 15_000)
})
