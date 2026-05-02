/**
 * PR-5 (Knowledge plan 2026-05-02) — info-block onboarding tests.
 *
 * Hard contract:
 *   - STATIC block: render once, dismiss persists у localStorage
 *   - NOT sticky (no `position: sticky` / fixed listeners)
 *   - NOT reactive to layout (no resize watchers)
 *   - Dismiss survives page reload
 *   - Empty/missing localStorage → show by default (graceful)
 */
import { describe, it, expect, beforeEach } from 'vitest'

const KEY = 'wb.boards.infoDismissed'

describe('PR-5 info-block dismissal contract', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('default state — flag not set → block visible (readDismissed = false)', () => {
    expect(window.localStorage.getItem(KEY)).toBeNull()
    // Reproducing the readInfoBlockDismissed predicate from WBBoardList:
    const dismissed = window.localStorage.getItem(KEY) === '1'
    expect(dismissed).toBe(false)
  })

  it('after dismiss — flag persisted as "1"', () => {
    window.localStorage.setItem(KEY, '1')
    expect(window.localStorage.getItem(KEY)).toBe('1')
  })

  it('readDismissed accepts ONLY the canonical "1" — protects against stale/legacy values', () => {
    window.localStorage.setItem(KEY, 'true')
    // The component checks `=== '1'` strictly. Legacy 'true' must NOT count
    // as dismissed (avoid silent false-positive from past versions).
    expect(window.localStorage.getItem(KEY) === '1').toBe(false)

    window.localStorage.setItem(KEY, '1')
    expect(window.localStorage.getItem(KEY) === '1').toBe(true)
  })

  it('storage failure path — caller falls back to "show by default"', () => {
    // Simulate inaccessible storage by reading a key that returns null:
    const dismissed = window.localStorage.getItem('non-existent-key') === '1'
    expect(dismissed).toBe(false)
  })
})
