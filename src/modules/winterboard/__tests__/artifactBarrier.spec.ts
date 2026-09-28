// Бар'єр артефакту (ТЗ TZ_SAVE_FROM_LIVE_LESSON_AS_TEMPLATE §2; LAW §4–§5): урок чи шаблон —
// лише коли всі дії на сервері й синхронізація в SYNC; інакше — причина, яку бачить учитель.
import { describe, it, expect } from 'vitest'
import { artifactBarrierReason, type ArtifactBarrierInput } from '../composables/artifactBarrier'

const ok: ArtifactBarrierInput = { flushFailed: false, mode: 'SYNC', pendingCount: 0, online: true }

describe('artifactBarrierReason', () => {
  it('усе на сервері й SYNC — бар’єр пропускає', () => {
    expect(artifactBarrierReason(ok)).toBeNull()
  })

  it.each([
    ['SAVE_BLOCKED', 'save_blocked'],
    ['DESYNC', 'desync'],       // record() — no-op: порожня черга нічого не доводить
    ['BOOTSTRAP', 'bootstrap'],
    ['PAUSED', 'paused'],
  ] as const)('стан %s — відмова «%s», навіть із порожньою чергою', (mode, reason) => {
    expect(artifactBarrierReason({ ...ok, mode })).toBe(reason)
  })

  it('flushAll() кинув — відмова, а не «лог і далі»', () => {
    expect(artifactBarrierReason({ ...ok, flushFailed: true })).toBe('unconfirmed')
  })

  it('черга не порожня — відмова', () => {
    expect(artifactBarrierReason({ ...ok, pendingCount: 51 })).toBe('queue')
  })

  it('без мережі — відмова', () => {
    expect(artifactBarrierReason({ ...ok, online: false })).toBe('offline')
  })

  it('стан синхронізації важливіший за чергу й виняток (учитель бачить справжню причину)', () => {
    expect(artifactBarrierReason({ flushFailed: true, mode: 'SAVE_BLOCKED', pendingCount: 3, online: false })).toBe('save_blocked')
    expect(artifactBarrierReason({ flushFailed: true, mode: 'PAUSED', pendingCount: 3, online: true })).toBe('paused')
  })
})
