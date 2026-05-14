// Phase B: Unit tests for fetchPublicNearestSnapshot + PublicSnapshotProvider.
//
// Key invariants under test:
//   INV-V2-PUB-1: provider receives only publicToken + seq (no sessionId)
//   INV-V2-PUB-3: raw fetch() + credentials:'omit' → CF cache friendly
//   INV-V2-PUB-6: ANY error (network, 404, 429, malformed) → null → fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPublicNearestSnapshot } from '../api/replay'
import { PublicSnapshotProvider } from '../engine/snapshot/PublicSnapshotProvider'

// ─── global.fetch mock ───────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  // Stub import.meta.env.DEV = false → getApiBase() returns VITE_API_BASE_URL or fallback
  vi.stubEnv('DEV', false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response
}

const SAMPLE_SNAPSHOT = {
  operation_index: 100,
  seq: 150,
  ops_schema_version: 1,
  state_schema_version: 1,
  board_state: { pages: [] },
}

// ─── fetchPublicNearestSnapshot ───────────────────────────────────────────────

describe('fetchPublicNearestSnapshot — INV-V2-PUB-3: credentials:omit', () => {
  it('calls fetch() with credentials:omit (NOT apiClient)', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    await fetchPublicNearestSnapshot('test-token', 150)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, options] = fetchSpy.mock.calls[0]
    expect(options.credentials).toBe('omit')
  })

  it('sends Accept:application/json header', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    await fetchPublicNearestSnapshot('test-token', 150)
    const [, options] = fetchSpy.mock.calls[0]
    expect(options.headers?.Accept).toBe('application/json')
  })

  it('URL contains token and seq param', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    await fetchPublicNearestSnapshot('my-token-abc', 42)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain('my-token-abc')
    expect(url).toContain('seq=42')
    expect(url).toContain('/snapshots/nearest/')
  })

  it('encodes special chars in token', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    await fetchPublicNearestSnapshot('tok/en+special=foo', 10)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).not.toContain('tok/en+special=foo') // raw form
    expect(url).toContain(encodeURIComponent('tok/en+special=foo'))
  })
})

describe('fetchPublicNearestSnapshot — happy path', () => {
  it('returns parsed snapshot on 200', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    const result = await fetchPublicNearestSnapshot('token', 150)
    expect(result).toEqual(SAMPLE_SNAPSHOT)
  })

  it('returns null on 404 (INV-V2-PUB-6)', async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(404))
    const result = await fetchPublicNearestSnapshot('token', 150)
    expect(result).toBeNull()
  })

  it('returns null on 429 rate-limit (INV-V2-PUB-6)', async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(429))
    const result = await fetchPublicNearestSnapshot('token', 150)
    expect(result).toBeNull()
  })

  it('returns null on 400 bad seq (INV-V2-PUB-6)', async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(400))
    const result = await fetchPublicNearestSnapshot('token', -1)
    expect(result).toBeNull()
  })

  it('returns null on 500 (INV-V2-PUB-6)', async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(500))
    const result = await fetchPublicNearestSnapshot('token', 100)
    expect(result).toBeNull()
  })

  it('returns null on network error (INV-V2-PUB-6)', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const result = await fetchPublicNearestSnapshot('token', 100)
    expect(result).toBeNull()
  })

  it('returns null on timeout (AbortError) (INV-V2-PUB-6)', async () => {
    const abortErr = new DOMException('The user aborted a request.', 'AbortError')
    fetchSpy.mockRejectedValueOnce(abortErr)
    const result = await fetchPublicNearestSnapshot('token', 100)
    expect(result).toBeNull()
  })
})

// ─── PublicSnapshotProvider ───────────────────────────────────────────────────

describe('PublicSnapshotProvider — INV-V2-PUB-1: token-only, no sessionId', () => {
  it('delegates fetchNearest to fetchPublicNearestSnapshot', async () => {
    fetchSpy.mockResolvedValueOnce(makeOkResponse(SAMPLE_SNAPSHOT))
    const provider = new PublicSnapshotProvider('my-public-token')
    const result = await provider.fetchNearest(150)
    expect(result).toEqual(SAMPLE_SNAPSHOT)
    // Verify token was in the URL (INV-V2-PUB-1: no sessionId leak)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain('my-public-token')
    expect(url).not.toContain('session')
  })

  it('returns null when snapshot not found (INV-V2-PUB-6)', async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(404))
    const provider = new PublicSnapshotProvider('some-token')
    const result = await provider.fetchNearest(999)
    expect(result).toBeNull()
  })

  it('does not throw on network error — returns null (INV-V2-PUB-6)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'))
    const provider = new PublicSnapshotProvider('some-token')
    await expect(provider.fetchNearest(50)).resolves.toBeNull()
  })
})
