/**
 * Phase 2 Section F (2026-04-27) — Real invariant tests per OPS_SYNC_SSOT + SYSTEM_LAW.
 *
 * Each test maps до specific invariant + catches production failure mode.
 * Tests drive ACTUAL opsSyncStore + mocked apiClient (NOT mock-only stubs).
 *
 * Invariants covered:
 *   INV-16 STATE-MACHINE-HARD     — DESYNC: record() NO-OP, flush() throws, sendBeacon() throws
 *   INV-15 CLIENT-SEQ-FILTER       — applyServerOp filters op.seq <= localSeq
 *   INV-19 MULTI-TAB-SAFETY        — independent localSeq per tab, mode coordinated
 *   INV-CONVERGENCE / SSOT §6      — state transitions: SYNC → 409 → DESYNC → resync → SYNC
 *   INV-NO-STALE-OPS               — DESYNC blocks input (record returns false, pendingOps unchanged)
 *
 * Production failure modes prevented:
 *   - 409 storm regression (mode→DESYNC stops all writes)
 *   - Stale ops corruption (echo broadcasts ignored)
 *   - Cross-tab contamination (one tab DESYNC propagates only mode, не localSeq)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock apiClient ДО importing store/replay api
vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

import apiClient from '@/utils/apiClient'
import { useOpsSyncStore, DesyncError, SeqResyncError } from '../../stores/opsSyncStore'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op(overrides: Record<string, unknown> = {}) {
  return {
    op_id: crypto.randomUUID(),
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
    ...overrides,
  }
}

function _axiosError(status: number, errorCode?: string, extra: Record<string, unknown> = {}) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; data: Record<string, unknown> }
  }
  err.response = {
    status,
    data: errorCode ? { error: errorCode, ...extra } : extra,
  }
  return err
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────
// GROUP 1: SEQ / 409 → DESYNC + resync (CRITICAL — 409 storm prevention)
// ─────────────────────────────────────────────────────────────────────

describe('INV-CONVERGENCE / SSOT §6 — 409 SEQ_MISMATCH → AUTO-RESYNC (Def-1, LAW §5 amended 2026-06-13)', () => {
  it('flush() with wrong seq → 409 → AUTO-RESYNC (SeqResyncError, stays SYNCED)', async () => {
    // LAW §5 amendment 2026-06-13 (Def-1 fix, прод d6fe9c6): SEQ_MISMATCH 409 більше
    // НЕ тригерить DESYNC — auto-resync (correct seq з expected_seq, KEEP pendingOps,
    // stay SYNC, SeqResyncError). Уникає втрати ops при transient 409 (network drop/WS 1006).
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 5
    store.localSeq = 5

    store.record(_op())
    expect(store.pendingOps.length).toBe(1)

    // BE responds 409 SEQ_MISMATCH (client.seq=5 stale; server expects 12)
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      _axiosError(409, 'SEQ_MISMATCH', { expected_seq: 12 }),
    )

    // Auto-resync throws SeqResyncError (caller логує, NOT DESYNC escalation)
    await expect(store.flush()).rejects.toBeInstanceOf(SeqResyncError)

    // Mode STAYS SYNCED (НЕ DESYNC — Def-1)
    expect(store.mode).toBe('SYNC')
    // serverSeq/localSeq corrected з body.expected_seq
    expect(store.serverSeq).toBe(12)
    expect(store.localSeq).toBe(12)
    // inFlightOps dropped (stale — server already processed/rejected)
    expect(store.inFlightOps.length).toBe(0)
  })

  // INV-16 DESYNC-state behavior (DESYNC тригериться protocol-mismatch/cross-tab,
  // НЕ 409 після Def-1 amendment). Поведінка стану DESYNC незмінна.
  it('in DESYNC state: record() returns false + pendingOps stays empty', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'DESYNC'
    store.desyncReason = 'protocol-version-mismatch'

    const accepted = store.record(_op())

    expect(accepted).toBe(false)
    expect(store.pendingOps.length).toBe(0)
  })

  it('in DESYNC state: flush() throws DesyncError (NO silent retry)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'DESYNC'
    store.desyncReason = 'protocol-version-mismatch'

    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)
    expect(apiClient.post).not.toHaveBeenCalled()  // CRITICAL: no network call у DESYNC
  })

  it('resync() → GET /state/ → mode=SYNC, seq updated from server', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'DESYNC'
    store.desyncReason = 'seq-mismatch'
    // Stale buffers від pre-DESYNC
    store.pendingOps.push(_op() as never)
    store.inFlightOps.push(_op() as never)

    ;(apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { pages: [] },
      last_seq: 42,  // server moved past пока ми були desync
    })

    await store.resync(FAKE_SID)

    expect(store.mode).toBe('SYNC')
    expect(store.localSeq).toBe(42)
    expect(store.serverSeq).toBe(42)
    expect(store.desyncReason).toBeNull()
    // Stale buffers dropped (per SSOT §4 — resync re-bootstraps clean)
    expect(store.pendingOps.length).toBe(0)
    expect(store.inFlightOps.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────
// GROUP 4: CLIENT SEQ FILTER (stale ops corruption prevention)
// ─────────────────────────────────────────────────────────────────────

describe('INV-15 CLIENT-SEQ-FILTER — applyServerOp guards stale broadcasts', () => {
  it('rejects op з seq <= localSeq (echo from own write)', () => {
    const store = useOpsSyncStore()
    store.mode = 'SYNC'
    store.localSeq = 10
    store.serverSeq = 10

    // Echo: BE broadcast op we already applied (seq=8 < localSeq=10)
    const applied = store.applyServerOp({ seq: 8 })

    expect(applied).toBe(false)
    expect(store.localSeq).toBe(10)  // unchanged
  })

  it('rejects op з seq === localSeq (boundary — already applied)', () => {
    const store = useOpsSyncStore()
    store.mode = 'SYNC'
    store.localSeq = 10
    store.serverSeq = 10

    const applied = store.applyServerOp({ seq: 10 })

    expect(applied).toBe(false)
    expect(store.localSeq).toBe(10)
  })

  it('accepts op з seq > localSeq + advances localSeq', () => {
    const store = useOpsSyncStore()
    store.mode = 'SYNC'
    store.localSeq = 10
    store.serverSeq = 10

    const applied = store.applyServerOp({ seq: 11 })

    expect(applied).toBe(true)
    expect(store.localSeq).toBe(11)
    expect(store.serverSeq).toBe(11)
  })

  it('rejects op без seq field (no ordering info)', () => {
    const store = useOpsSyncStore()
    store.mode = 'SYNC'
    store.localSeq = 10

    const applied = store.applyServerOp({})

    expect(applied).toBe(false)
    expect(store.localSeq).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────
// GROUP 5: DESYNC INPUT BLOCK (INV-NO-STALE-OPS)
// ─────────────────────────────────────────────────────────────────────

describe('INV-NO-STALE-OPS — DESYNC mode blocks ALL local writes', () => {
  it('record() in DESYNC: returns false, pendingOps NOT increased', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'DESYNC'
    store.desyncReason = 'protocol-version-mismatch'

    const before = store.pendingOps.length
    const r1 = store.record(_op())
    const r2 = store.record(_op())
    const r3 = store.record(_op())

    expect(r1).toBe(false)
    expect(r2).toBe(false)
    expect(r3).toBe(false)
    expect(store.pendingOps.length).toBe(before)  // exactly 0 ops accepted
  })

  it('record() in BOOTSTRAP: returns false (pre-bootstrap NO-OP)', () => {
    const store = useOpsSyncStore()
    // Default mode after fresh setActivePinia — BOOTSTRAP
    expect(store.mode).toBe('BOOTSTRAP')

    const accepted = store.record(_op())

    expect(accepted).toBe(false)
    expect(store.pendingOps.length).toBe(0)
  })

  it('sendBeacon() in DESYNC: throws DesyncError (NOT BeaconUnsupportedError) — DESYNC takes precedence', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'DESYNC'
    store.desyncReason = 'seq-mismatch'

    expect(() => store.sendBeacon()).toThrow(DesyncError)
  })
})

// ─────────────────────────────────────────────────────────────────────
// GROUP 7: MULTI-TAB ISOLATION (INV-19)
// ─────────────────────────────────────────────────────────────────────

describe('INV-19 MULTI-TAB-SAFETY — independent state per Pinia instance', () => {
  it('two independent Pinia instances: tab A DESYNC does NOT mutate tab B mode/localSeq', () => {
    // Tab A — own Pinia
    const piniaA = createPinia()
    setActivePinia(piniaA)
    const storeA = useOpsSyncStore()
    storeA.sessionId = FAKE_SID
    storeA.mode = 'SYNC'
    storeA.localSeq = 10

    // Tab B — different Pinia instance (simulates different tab)
    const piniaB = createPinia()
    setActivePinia(piniaB)
    const storeB = useOpsSyncStore()
    storeB.sessionId = FAKE_SID
    storeB.mode = 'SYNC'
    storeB.localSeq = 10

    // Tab A enters DESYNC via local 409 (without BroadcastChannel — happy-dom env)
    setActivePinia(piniaA)
    const storeAref = useOpsSyncStore()
    storeAref.enterDesync('seq-mismatch')

    // Tab A — DESYNC, localSeq frozen
    expect(storeAref.mode).toBe('DESYNC')
    expect(storeAref.localSeq).toBe(10)

    // Tab B — INDEPENDENT state (different Pinia instance ⇒ different refs)
    setActivePinia(piniaB)
    const storeBref = useOpsSyncStore()
    expect(storeBref.mode).toBe('SYNC')
    expect(storeBref.localSeq).toBe(10)
    // Tab B can still record ops
    expect(storeBref.record(_op())).toBe(true)
    expect(storeBref.pendingOps.length).toBe(1)
  })

  it('each store instance has unique tabId (origin filter for BroadcastChannel)', () => {
    const piniaA = createPinia()
    setActivePinia(piniaA)
    const tabIdA = useOpsSyncStore().tabId

    const piniaB = createPinia()
    setActivePinia(piniaB)
    const tabIdB = useOpsSyncStore().tabId

    expect(tabIdA).not.toBe(tabIdB)
    expect(tabIdA).toMatch(/^tab-/)
    expect(tabIdB).toMatch(/^tab-/)
  })
})

// ─────────────────────────────────────────────────────────────────────
// SSOT §6 STATE MACHINE TRANSITIONS — bootstrap path
// ─────────────────────────────────────────────────────────────────────

describe('SSOT §6 state machine — bootstrap → SYNC', () => {
  it('bootstrap() with last_seq=0 (new session, INV-18): mode → SYNC, seq=0', async () => {
    const store = useOpsSyncStore()
    expect(store.mode).toBe('BOOTSTRAP')

    ;(apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: {},
      last_seq: 0,
    })

    await store.bootstrap(FAKE_SID)

    expect(store.mode).toBe('SYNC')
    expect(store.localSeq).toBe(0)
    expect(store.serverSeq).toBe(0)
    expect(store.sessionId).toBe(FAKE_SID)
  })

  it('bootstrap() with last_seq=N (existing session): mode → SYNC, seq=N', async () => {
    const store = useOpsSyncStore()
    ;(apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { pages: [{ id: 'p1' }] },
      last_seq: 156,
      snapshot_seq: 100,
    })

    await store.bootstrap(FAKE_SID)

    expect(store.mode).toBe('SYNC')
    expect(store.localSeq).toBe(156)
    expect(store.serverSeq).toBe(156)
  })
})
