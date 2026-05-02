/**
 * PR-2 (Knowledge plan 2026-05-02) — folder route helpers tests.
 *
 * Covers INV-KNOW-1 strict-parse contract + fallback predicate.
 */
import { describe, it, expect } from 'vitest'
import { parseFolderQuery, isFolderUnavailableError } from '../utils/folderRoute'

describe('parseFolderQuery', () => {
  it('returns positive integer for valid string id', () => {
    expect(parseFolderQuery('5')).toBe(5)
    expect(parseFolderQuery('1')).toBe(1)
    expect(parseFolderQuery('999')).toBe(999)
  })

  it('returns null for missing/undefined', () => {
    expect(parseFolderQuery(undefined)).toBeNull()
    expect(parseFolderQuery(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseFolderQuery('')).toBeNull()
  })

  it('returns null for non-string types (Vue Router array case)', () => {
    expect(parseFolderQuery(['1', '2'])).toBeNull()
    expect(parseFolderQuery(5)).toBeNull() // raw number — not a query string
    expect(parseFolderQuery({ id: 5 })).toBeNull()
  })

  it('returns null for zero (folder ids start at 1)', () => {
    expect(parseFolderQuery('0')).toBeNull()
  })

  it('returns null for negative numbers', () => {
    expect(parseFolderQuery('-1')).toBeNull()
    expect(parseFolderQuery('-99')).toBeNull()
  })

  it('returns null for non-integer / fractional', () => {
    expect(parseFolderQuery('1.5')).toBeNull()
    expect(parseFolderQuery('3.14')).toBeNull()
  })

  it('returns null for NaN-yielding strings', () => {
    expect(parseFolderQuery('abc')).toBeNull()
    expect(parseFolderQuery('1abc')).toBeNull()
    expect(parseFolderQuery('NaN')).toBeNull()
    expect(parseFolderQuery('Infinity')).toBeNull()
  })

  it('returns null for whitespace-only', () => {
    // Number(' ') === 0, but '   '.length > 0 — Number(' 5') === 5 — accept this?
    // We treat whitespace-padded as accepted because Number() parses; this matches
    // Vue Router behavior of ?folder=%205 → ' 5' which parse cleanly to 5.
    // But pure whitespace → 0 → rejected by n > 0 guard.
    expect(parseFolderQuery('   ')).toBeNull()
  })

  it('NEVER throws for any input', () => {
    const evil = [
      Symbol('folder'), () => 5, BigInt(5), true, false,
      new Date(), /5/, [], {}, Buffer.from('5'),
    ]
    for (const v of evil) {
      expect(() => parseFolderQuery(v)).not.toThrow()
    }
  })
})

describe('isFolderUnavailableError', () => {
  it('returns true for DRF 400 with folder field error', () => {
    const err = {
      response: {
        status: 400,
        data: { folder: ['Folder must belong to you'] },
      },
    }
    expect(isFolderUnavailableError(err)).toBe(true)
  })

  it('returns false for 400 with non-folder field error', () => {
    const err = {
      response: {
        status: 400,
        data: { name: ['too long'] },
      },
    }
    expect(isFolderUnavailableError(err)).toBe(false)
  })

  it('returns false for non-400 errors', () => {
    expect(isFolderUnavailableError({ response: { status: 500 } })).toBe(false)
    expect(isFolderUnavailableError({ response: { status: 401 } })).toBe(false)
  })

  it('returns false for null / undefined / non-objects', () => {
    expect(isFolderUnavailableError(null)).toBe(false)
    expect(isFolderUnavailableError(undefined)).toBe(false)
    expect(isFolderUnavailableError('string error')).toBe(false)
    expect(isFolderUnavailableError(42)).toBe(false)
  })

  it('returns false for missing response', () => {
    expect(isFolderUnavailableError(new Error('network'))).toBe(false)
  })
})
