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
import {
  saveBackup, readBackup, clearBackup, readAllBackups, setOpsOwner, setOpsTab,
} from '../composables/useOpsBackup'

const SID = 'test-session-uuid-abc'

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
  setOpsOwner(null)
  setOpsTab('tab-default')
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
      `wb_ops_backup_v2_${SID}_anon_tab-default`,
      JSON.stringify({ pending: [{ id: 'old' }], inFlight: [], savedAt: oldIso }),
    )

    // TTL guard kicks in on restore read → no records + clears
    expect(readAllBackups(SID).records).toHaveLength(0)
    expect(localStorage.getItem(`wb_ops_backup_v2_${SID}_anon_tab-default`)).toBeNull()
  })

  it('returns null for corrupt JSON without crashing', () => {
    localStorage.setItem(`wb_ops_backup_v2_${SID}_anon_tab-default`, '{not-valid-json}')
    expect(readBackup(SID)).toBeNull()
  })

  it('returns null for missing arrays', () => {
    localStorage.setItem(
      `wb_ops_backup_v2_${SID}_anon_tab-default`,
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

describe('opsBackup · ключ = дошка + акаунт + вкладка (рев’ю P0 2026-09-24)', () => {
  it('порожня вкладка того ж учителя НЕ стирає копію незбережених дій іншої вкладки', () => {
    setOpsOwner('7')
    setOpsTab('tab-A')
    expect(saveBackup(SID, [{ op_id: 'a1' }], [])).toBe(true)
    setOpsTab('tab-B')
    expect(saveBackup(SID, [], [])).toBe(true)  // порожня черга вкладки Б
    const all = readAllBackups<{ op_id: string }>(SID)
    expect(all.records).toHaveLength(1)
    expect(all.records[0].backup.pending.map(o => o.op_id)).toEqual(['a1'])
  })

  it('readAllBackups бачить лише свої вкладки свого акаунта; пошкоджену — як нечитабельну', () => {
    setOpsOwner('7')
    setOpsTab('tab-A')
    saveBackup(SID, [{ op_id: 'a1' }], [])
    localStorage.setItem(`wb_ops_backup_v2_${SID}_u7_tab-C`, '{"pending":[{"op_id":"c')
    localStorage.setItem(`wb_ops_backup_v2_${SID}_u77_tab-X`, JSON.stringify({ pending: [{ op_id: 'x' }], inFlight: [], savedAt: new Date().toISOString() }))
    const all = readAllBackups<{ op_id: string }>(SID)
    expect(all.records.map(r => r.key)).toEqual([`wb_ops_backup_v2_${SID}_u7_tab-A`])
    expect(all.unreadable.map(u => u.key)).toEqual([`wb_ops_backup_v2_${SID}_u7_tab-C`])
  })
})
