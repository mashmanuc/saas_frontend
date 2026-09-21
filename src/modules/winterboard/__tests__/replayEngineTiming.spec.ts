/**
 * Коли саме рушій показує кожну op відносно її запису.
 * Ops записані в t = 0, 1000, 1500, 6500 мс (пауза 5 с стискається до 2 с).
 * Очікування «як на уроці»: op0 одразу, op1 через 1000, op2 ще через 500,
 * op3 ще через 2000 (стиснута пауза).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WBReplayEngineV2 } from '../engine/WBReplayEngineV2'

const T = [0, 1000, 1500, 6500]
function engine() {
  const t0 = Date.UTC(2026, 0, 1)
  const ops = T.map((t, i) => ({ id: i + 1, seq: i + 1, op_type: 'stroke_add', page_id: 'p', payload: { i }, user: 1, created_at: new Date(t0 + t).toISOString() }))
  return new WBReplayEngineV2({ session_id: 's', total_operations: ops.length, operations: ops, start_state: null })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('WBReplayEngineV2 — таймінг показу ops', () => {
  it('з початку: кожна op у свій момент', async () => {
    const e = engine(); const fired: number[] = []; const start = Date.now()
    e.on('onOperation', () => { fired.push(Date.now() - start) })
    e.play()
    await vi.advanceTimersByTimeAsync(5000)
    console.log('[timing] from start:', fired.join(', '))
    expect(fired[0]).toBeLessThanOrEqual(20)
    expect(fired[1] - fired[0]).toBe(1000)
    expect(fired[2] - fired[1]).toBe(500)
    expect(fired[3] - fired[2]).toBe(2000)
  })

  it('після seek на op2: op2 одразу, далі у свій момент', async () => {
    const e = engine(); const fired: Array<[number, number]> = []
    e.on('onOperation', (_op, i) => { fired.push([i, Date.now()]) })
    e.seekTo(2)
    const start = Date.now(); e.play()
    await vi.advanceTimersByTimeAsync(4000)
    const rel = fired.map(([i, t]) => `${i}@${t - start}`)
    console.log('[timing] after seek(2):', rel.join(', '))
    expect(fired[0][0]).toBe(2)
    expect(fired[0][1] - start).toBeLessThanOrEqual(20)
    expect(fired[1][1] - fired[0][1]).toBe(2000)
  })
})
