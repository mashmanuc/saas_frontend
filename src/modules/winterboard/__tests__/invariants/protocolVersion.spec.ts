/**
 * Phase 2 Section F (2026-04-27) — INV-20 PROTOCOL-VERSION-ENFORCEMENT.
 *
 * Each test maps до specific behavior + catches production failure mode.
 *
 * Invariants covered:
 *   INV-20 PROTOCOL-VERSION-ENFORCEMENT — 400 PROTOCOL_VERSION_MISMATCH → DESYNC,
 *                                          NO retry, modal trigger via mode watch
 *
 * Production failure prevented:
 *   - FE retry loop on protocol mismatch (would brick app post-deploy version skew)
 *   - Silent contract drift (without modal user keeps clicking, losing data)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
import { useOpsSyncStore, DesyncError } from '../../stores/opsSyncStore'
import { PROTOCOL_VERSION } from '../../api/replay'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op() {
  return {
    op_id: crypto.randomUUID(),
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
  }
}

function _axiosError(status: number, errorCode: string, extra: Record<string, unknown> = {}) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; data: Record<string, unknown> }
  }
  err.response = {
    status,
    data: { error: errorCode, ...extra },
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

describe('INV-20 PROTOCOL-VERSION-ENFORCEMENT', () => {
  it('FE sends X-Protocol-Version: v3 header on /replay/batch/ POST', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    // мок MUST дзеркалити apiClient {data, headers} (recordOperationsBatch
    // читає res.data з meta.fullResponse 2026-05-10) — інакше response=undefined.
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { last_seq: 1, applied_count: 1 },
    })

    await store.flush()

    expect(apiClient.post).toHaveBeenCalledTimes(1)
    const callArgs = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0]
    const config = callArgs[2] as { headers?: Record<string, string> }
    expect(config?.headers?.['X-Protocol-Version']).toBe('v3')
    expect(PROTOCOL_VERSION).toBe('v3')
  })

  it('400 PROTOCOL_VERSION_MISMATCH → mode flips to DESYNC + reason matches', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      _axiosError(400, 'PROTOCOL_VERSION_MISMATCH', {
        client_version: 'v3',
        server_version: 'v4',
      }),
    )

    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)

    expect(store.mode).toBe('DESYNC')
    expect(store.desyncReason).toBe('protocol-version-mismatch')
    // Pending + inFlight cleared (reload-only recovery — old contract incompatible)
    expect(store.pendingOps.length).toBe(0)
    expect(store.inFlightOps.length).toBe(0)
  })

  it('PROTOCOL_VERSION_MISMATCH → NO retry on subsequent flush() calls', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      _axiosError(400, 'PROTOCOL_VERSION_MISMATCH', {
        client_version: 'v3', server_version: 'v4',
      }),
    )
    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)

    // Subsequent flush attempts MUST throw immediately, NOT issue new POST
    apiClient.post = vi.fn() as never  // fresh spy
    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('reason canonical string === "protocol-version-mismatch" (для UI strict equality watch)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      _axiosError(400, 'PROTOCOL_VERSION_MISMATCH', {}),
    )

    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)

    // ProtocolMismatchModal does strict equality check `=== 'protocol-version-mismatch'`.
    // Якщо reason змінюється — modal не fires. Strict equality verified тут.
    expect(store.desyncReason).toBe('protocol-version-mismatch')
    expect(store.desyncReason).not.toMatch(/^protocol-version-mismatch.+/)  // no suffix variants
  })
})
