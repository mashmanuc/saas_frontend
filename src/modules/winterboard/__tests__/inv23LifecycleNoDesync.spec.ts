// INV-23 PR-2a — FE stub test: 4 new 409 lifecycle codes do NOT trigger DESYNC
//
// Per OPS_SYNC_SSOT.md INV-23 §23.8 (FE stub) + §23.12 status table:
//   New 409 enum codes (SESSION_ARCHIVED, REPLAY_FROZEN_NO_WRITE,
//   PAUSED_RECORDING_READ_ONLY, HEARTBEAT_NOT_APPLICABLE) belong to Taxonomy B
//   per TRANSPORT_ERROR_SEMANTICS — they are entity-conflict / operational
//   states, NOT consistency corruption. They MUST NOT trigger
//   `opsSyncStore.enterDesync()`.
//
// This stub ensures opsSyncStore.flush() does NOT route these codes through
// the SEQ_MISMATCH → DESYNC path. Full UI handling for the new codes lands
// у PR-2d (separate FE PR).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock apiClient ДО importing store (pattern matches existing opsSync.spec.ts).
vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

// Partial mock for replay api — keep всі інші exports live
// (FinalizeBarrierTimeoutError class, finalizeWithBarrier helper, etc.).
vi.mock('../api/replay', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    recordOperationsBatch: vi.fn(),
  }
})

import { recordOperationsBatch } from '../api/replay'
import { useOpsSyncStore, DesyncError } from '../stores/opsSyncStore'

const mockBatch = recordOperationsBatch as unknown as ReturnType<typeof vi.fn>
const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function makeAxiosErrorLike(status: number, data: any) {
  const err = new Error(`Request failed with status code ${status}`) as any
  err.response = { status, data }
  err.isAxiosError = true
  return err
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('INV-23 PR-2a — lifecycle 409 codes do NOT trigger DESYNC', () => {
  // 4 new 409 enums per §23.12 status table.
  const lifecycleErrorCodes = [
    'SESSION_ARCHIVED',
    'REPLAY_FROZEN_NO_WRITE',
    'PAUSED_RECORDING_READ_ONLY',
    'HEARTBEAT_NOT_APPLICABLE',
  ] as const

  for (const code of lifecycleErrorCodes) {
    it(`409 ${code} does NOT trigger DESYNC у opsSyncStore.flush()`, async () => {
      const store = useOpsSyncStore()
      // Skip real bootstrap() — set state directly per existing opsSync.spec.ts pattern.
      store.sessionId = FAKE_SID
      store.mode = 'SYNC'
      store.serverSeq = 5
      store.localSeq = 5

      // Queue an op so flush() actually fires (record() pushes to pendingOps).
      const queued = store.record({
        op_id: crypto.randomUUID(),
        op_type: 'stroke_add',
        page_id: 'page-1',
        payload: {},
      } as any)
      expect(queued).toBe(true)

      // BE returns 409 with new lifecycle enum (NOT SEQ_MISMATCH).
      mockBatch.mockRejectedValueOnce(makeAxiosErrorLike(409, { error: code }))

      // flush() may or may not throw — important: NO DesyncError, NO mode flip.
      try {
        await store.flush()
      } catch (err) {
        // Permitted: generic error / network error passthrough.
        // FORBIDDEN: DesyncError (would mean ops 409 routed wrong).
        expect(err).not.toBeInstanceOf(DesyncError)
      }

      // Hard check: store mode must NOT be DESYNC.
      expect(store.mode).not.toBe('DESYNC')
      expect(store.desyncReason).toBeNull()
    })
  }
})
