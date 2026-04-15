/**
 * Phase ops-only: opsBackup (localStorage) invariant tests.
 *
 * Critical для TEST 5 (crash/reload) радника:
 *  1. Saves both pending + inFlight (не тільки buffer)
 *  2. Read повертає null при відсутності / expired / corrupt
 *  3. Clear працює
 *  4. TTL 7 днів поважається
 *  5. Порожні буфери очищають backup замість зберігати {pending:[], inFlight:[]}
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveBackup, readBackup, clearBackup } from '../composables/useOpsBackup'

const SID = 'test-session-uuid-abc'

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('opsBackup', () => {
  it('saves and reads both pending and inFlight', () => {
    const pending = [{ id: 'p1' }, { id: 'p2' }]
    const inFlight = [{ id: 'i1' }]
    saveBackup(SID, pending, inFlight)

    const restored = readBackup<{ id: string }>(SID)
    expect(restored).not.toBeNull()
    expect(restored!.pending).toEqual(pending)
    expect(restored!.inFlight).toEqual(inFlight)
    expect(typeof restored!.savedAt).toBe('string')
  })

  it('returns null for missing session', () => {
    expect(readBackup('nonexistent')).toBeNull()
  })

  it('clears backup on empty pending+inFlight', () => {
    saveBackup(SID, [{ id: 'x' }], [])
    expect(readBackup(SID)).not.toBeNull()

    // Now save empty → should clear
    saveBackup(SID, [], [])
    expect(readBackup(SID)).toBeNull()
  })

  it('clearBackup removes the entry', () => {
    saveBackup(SID, [{ id: 'x' }], [])
    clearBackup(SID)
    expect(readBackup(SID)).toBeNull()
  })

  it('ignores backup older than 7 days (TTL)', () => {
    // Save a backup with a manually-aged savedAt
    const oldIso = new Date(Date.now() - 8 * 24 * 3_600 * 1_000).toISOString()
    localStorage.setItem(
      `wb_ops_backup_${SID}`,
      JSON.stringify({ pending: [{ id: 'old' }], inFlight: [], savedAt: oldIso }),
    )

    // TTL guard kicks in on read → returns null + clears
    expect(readBackup(SID)).toBeNull()
    expect(localStorage.getItem(`wb_ops_backup_${SID}`)).toBeNull()
  })

  it('returns null for corrupt JSON without crashing', () => {
    localStorage.setItem(`wb_ops_backup_${SID}`, '{not-valid-json}')
    expect(readBackup(SID)).toBeNull()
  })

  it('returns null for missing arrays', () => {
    localStorage.setItem(
      `wb_ops_backup_${SID}`,
      JSON.stringify({ savedAt: new Date().toISOString() }),
    )
    expect(readBackup(SID)).toBeNull()
  })

  it('survives quota-exceeded gracefully (no throw)', () => {
    // Mock a quota error on setItem
    const originalSet = Storage.prototype.setItem
    Storage.prototype.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    try {
      // Should NOT throw
      expect(() =>
        saveBackup(SID, [{ id: 'x' }], []),
      ).not.toThrow()
    } finally {
      Storage.prototype.setItem = originalSet
    }
  })

  it('noop on empty sessionId', () => {
    saveBackup('', [{ id: 'x' }], [])
    expect(localStorage.length).toBe(0)
    expect(readBackup('')).toBeNull()
  })
})
