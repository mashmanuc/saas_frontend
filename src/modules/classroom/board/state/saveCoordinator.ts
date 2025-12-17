import { API_V1_ALT_PREFIX, buildUrl } from '@/config/apiPrefixes'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { telemetry } from '@/services/telemetry'

export type SaveErrorCode = 409 | 412 | 413 | 415 | 422 | 429

export type DiffOpKind = 'stroke' | 'asset' | 'meta'
export type DiffOpType = 'add' | 'update' | 'remove'

export interface DiffOp {
  op: DiffOpType
  kind: DiffOpKind
  id?: string
  page_id?: string
  value?: Record<string, unknown>
  patch?: Record<string, unknown>
}

export interface SaveCoordinatorOptions {
  sessionId: string
  etag: string | null
  rev: number
  ops: DiffOp[]
  state: Record<string, unknown>
  extraDrawsDuringSave?: number
}

export interface SaveCoordinatorResult {
  serverTs: string
  nextRev?: number
  etag?: string
}

export interface ResyncResult {
  state: Record<string, unknown>
  etag: string | null
  rev: number | null
}

type ErrorPayload = {
  error?: string
  limit?: number
  encoding?: string
  endpoint?: string
  request_id?: string
  server_rev?: number
  backoff_ms?: number
  detail?: string
  message?: string
}

const V1_SOLO_BASE = buildUrl(API_V1_ALT_PREFIX, '/solo/sessions')

const DIFF_MAX_BYTES = 512 * 1024
const STREAM_MAX_BYTES = 2 * 1024 * 1024
const BEACON_MAX_BYTES = 64 * 1024

const REV_ETAG_RE = /rev:(\d+)/i

export class SaveCoordinatorError extends Error {
  code: SaveErrorCode
  endpoint: string
  payload: ErrorPayload | null
  constructor(code: SaveErrorCode, endpoint: string, payload: ErrorPayload | null) {
    super(`save_failed:${code}`)
    this.code = code
    this.endpoint = endpoint
    this.payload = payload
  }
}

function getAuthHeaders(): Record<string, string> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}
  if (auth.access) {
    headers.Authorization = `Bearer ${auth.access}`
  }
  return headers
}

function parseEtag(res: Response): string | null {
  return res.headers.get('ETag')
}

function parseRevFromEtag(etag: string | null): number | null {
  if (!etag) return null
  const m = etag.match(REV_ETAG_RE)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function jsonSizeBytes(value: unknown): number {
  const encoder = new TextEncoder()
  return encoder.encode(JSON.stringify(value)).byteLength
}

function jitterMs(): number {
  return 50 + Math.floor(Math.random() * 101)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseBackoffMs(res: Response): number | null {
  const headerMs = res.headers.get('X-Backoff-Ms')
  if (headerMs) {
    const n = Number(headerMs)
    if (Number.isFinite(n) && n > 0) return n
  }

  const retryAfter = res.headers.get('Retry-After')
  if (retryAfter) {
    const n = Number(retryAfter)
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1000)
  }

  return null
}

function ensureErrorMeta(payload: ErrorPayload | null, res: Response): ErrorPayload {
  const next: ErrorPayload = { ...(payload || {}) }
  if (!next.request_id) {
    const rid = res.headers.get('X-Request-ID')
    if (rid) next.request_id = rid
  }
  if (!next.backoff_ms) {
    const backoff = parseBackoffMs(res)
    if (backoff) next.backoff_ms = backoff
  }
  return next
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isOkStatus(status: number): boolean {
  return status === 200 || status === 204
}

async function requestJson(
  url: string,
  init: RequestInit
): Promise<{ res: Response; data: unknown }>
{
  const res = await fetch(url, init)
  const data = await parseJsonSafe(res)
  return { res, data }
}

export const saveCoordinator = {
  _inFlight: null as Promise<SaveCoordinatorResult> | null,
  _queued: null as SaveCoordinatorOptions | null,
  _waiters: [] as Array<{ resolve: (v: SaveCoordinatorResult) => void; reject: (e: unknown) => void }>,

  async resyncSession(sessionId: string): Promise<ResyncResult> {
    const url = `${V1_SOLO_BASE}/${sessionId}/`
    const { res, data } = await requestJson(url, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!res.ok || !data || typeof data !== 'object') {
      throw new Error(`resync_failed:${res.status}`)
    }

    const session = data as { state?: Record<string, unknown> }
    const etag = parseEtag(res)
    return {
      state: (session.state || {}) as Record<string, unknown>,
      etag,
      rev: parseRevFromEtag(etag),
    }
  },

  async save(options: SaveCoordinatorOptions): Promise<SaveCoordinatorResult> {
    // Mutex / in-flight gate: serialize saves; merge burst into single queued options.
    if (this._inFlight) {
      this._queued = options
      return await new Promise<SaveCoordinatorResult>((resolve, reject) => {
        this._waiters.push({ resolve, reject })
      })
    }

    const run = async (opts: SaveCoordinatorOptions): Promise<SaveCoordinatorResult> => {
      const { sessionId, etag, rev, ops, state, extraDrawsDuringSave } = opts

      const diffUrl = `${V1_SOLO_BASE}/${sessionId}/diff/`
      const streamUrl = `${V1_SOLO_BASE}/${sessionId}/save-stream/`

      const diffPayload = {
        rev,
        ops,
        client_ts: new Date().toISOString(),
      }

      const diffBytes = jsonSizeBytes(diffPayload)
      const streamPayload = { state }
      const streamBytes = jsonSizeBytes(streamPayload)

      if (ops.length > 0 && diffBytes <= DIFF_MAX_BYTES) {
        return await this._saveDiffWithResyncRetry({
          url: diffUrl,
          payload: diffPayload,
          etag,
          rev,
          sessionId,
          extraDrawsDuringSave,
        })
      }

      if (streamBytes <= STREAM_MAX_BYTES) {
        return await this._saveStreamWithResyncRetry({
          url: streamUrl,
          state,
          etag,
          rev,
          sessionId,
          extraDrawsDuringSave,
        })
      }

      telemetry.trigger('solo_save', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        endpoint: 'save-stream',
        status: 413,
        limit: STREAM_MAX_BYTES,
        size_bytes: streamBytes,
        extra_draws_during_save: extraDrawsDuringSave ?? 0,
      })

      throw new SaveCoordinatorError(413, 'save-stream', {
        error: 'payload_too_large',
        limit: STREAM_MAX_BYTES,
        endpoint: 'save-stream',
      })
    }

    const finishWaiters = (err: unknown, result: SaveCoordinatorResult | null) => {
      const waiters = this._waiters
      this._waiters = []
      for (const w of waiters) {
        if (result) w.resolve(result)
        else w.reject(err)
      }
    }

    this._inFlight = (async () => {
      try {
        let last = await run(options)

        // Drain queue (latest wins) until empty.
        while (this._queued) {
          const nextOpts = this._queued
          this._queued = null
          last = await run(nextOpts)
        }

        finishWaiters(null, last)
        return last
      } catch (e) {
        finishWaiters(e, null)
        throw e
      } finally {
        this._inFlight = null
      }
    })()

    return await this._inFlight
  },

  async beaconTelemetry(sessionId: string, payload: Record<string, unknown>): Promise<boolean> {
    const url = `${V1_SOLO_BASE}/${sessionId}/beacon/`
    const body = JSON.stringify(payload)
    const bytes = new TextEncoder().encode(body).byteLength
    if (bytes > BEACON_MAX_BYTES) return false

    if (!navigator.sendBeacon) return false
    try {
      telemetry.trigger('solo_beacon_heartbeat', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        size_bytes: bytes,
      })
      return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    } catch {
      return false
    }
  },

  async _saveDiffWithResyncRetry(params: {
    url: string
    payload: Record<string, unknown>
    etag: string | null
    rev: number
    sessionId: string
    extraDrawsDuringSave?: number
  }): Promise<SaveCoordinatorResult> {
    const start = performance.now()
    const first = await this._saveDiff(params.url, params.payload, params.etag, params.rev)

    if (first.ok) {
      telemetry.trigger('solo_save', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        endpoint: 'diff',
        status: 200,
        save_rtt_ms: performance.now() - start,
        extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
      })
      return first.result
    }

    telemetry.trigger('solo_save', {
      version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      endpoint: 'diff',
      status: first.code,
      save_rtt_ms: performance.now() - start,
      extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
      limit: first.payload?.limit,
      request_id: first.payload?.request_id,
      backoff_ms: first.payload?.backoff_ms,
    })

    if (first.code === 413) {
      throw new SaveCoordinatorError(413, 'diff', first.payload)
    }

    if (first.code === 415 || first.code === 422 || first.code === 429) {
      throw new SaveCoordinatorError(first.code, 'diff', first.payload)
    }

    if (first.code === 412 || first.code === 409) {
      const resync = await this.resyncSession(params.sessionId)
      // retry only if etag changed after resync
      if (!resync.etag || resync.etag === params.etag) {
        throw new SaveCoordinatorError(first.code, 'diff', first.payload)
      }

      const nextRev = resync.rev
      if (typeof nextRev !== 'number') {
        throw new SaveCoordinatorError(first.code, 'diff', first.payload)
      }

      await sleep(jitterMs())
      const retryPayload = { ...params.payload, rev: nextRev }
      const retry = await this._saveDiff(params.url, retryPayload, resync.etag, nextRev)
      if (retry.ok) {
        telemetry.trigger('solo_save', {
          version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
          endpoint: 'diff',
          status: 200,
          retried_after_resync: true,
          extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
        })
        return retry.result
      }
      throw new SaveCoordinatorError(retry.code, 'diff', retry.payload)
    }

    throw new SaveCoordinatorError(first.code, 'diff', first.payload)
  },

  async _saveStreamWithResyncRetry(params: {
    url: string
    state: Record<string, unknown>
    etag: string | null
    rev: number
    sessionId: string
    extraDrawsDuringSave?: number
  }): Promise<SaveCoordinatorResult> {
    const start = performance.now()

    const doAttempt = async (
      etag: string | null,
      rev: number,
      state: Record<string, unknown>
    ): Promise<SaveCoordinatorResult> => {
      return await this._saveStream(params.url, state, etag, rev)
    }

    try {
      const result = await doAttempt(params.etag, params.rev, params.state)
      telemetry.trigger('solo_save', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        endpoint: 'save-stream',
        status: 200,
        save_rtt_ms: performance.now() - start,
        extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
      })
      return result
    } catch (e) {
      if (!(e instanceof SaveCoordinatorError)) {
        telemetry.trigger('solo_save', {
          version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
          endpoint: 'save-stream',
          status: 0,
          save_rtt_ms: performance.now() - start,
          extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
        })
        throw e
      }

      telemetry.trigger('solo_save', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        endpoint: 'save-stream',
        status: e.code,
        save_rtt_ms: performance.now() - start,
        extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
        limit: e.payload?.limit,
        request_id: e.payload?.request_id,
        backoff_ms: e.payload?.backoff_ms,
      })

      if (e.code === 412 || e.code === 409) {
        const resync = await this.resyncSession(params.sessionId)
        if (!resync.etag || resync.etag === params.etag) {
          throw e
        }

        await sleep(jitterMs())
        const retry = await doAttempt(resync.etag, resync.rev ?? params.rev, resync.state)
        telemetry.trigger('solo_save', {
          version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
          endpoint: 'save-stream',
          status: 200,
          retried_after_resync: true,
          extra_draws_during_save: params.extraDrawsDuringSave ?? 0,
        })
        return retry
      }

      throw e
    }
  },

  async _saveDiff(
    url: string,
    payload: Record<string, unknown>,
    etag: string | null,
    rev: number
  ): Promise<{ ok: true; result: SaveCoordinatorResult } | { ok: false; code: SaveErrorCode; payload: ErrorPayload | null }>
  {
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    }

    if (etag) {
      headers['If-Match'] = etag
    } else {
      headers['X-Rev'] = String(rev)
    }

    const { res, data } = await requestJson(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    })

    if (isOkStatus(res.status)) {
      const et = parseEtag(res) || undefined
      const d = (data || {}) as Record<string, unknown>
      const serverTs = (d.server_ts as string) || new Date().toISOString()
      const nextRev = typeof d.next_rev === 'number' ? (d.next_rev as number) : undefined
      return { ok: true, result: { serverTs, nextRev, etag: et } }
    }

    const code = res.status as SaveErrorCode
    const payloadMeta = ensureErrorMeta(((data as ErrorPayload) || null), res)
    return { ok: false, code, payload: payloadMeta }
  },

  async _saveStream(
    url: string,
    state: Record<string, unknown>,
    etag: string | null,
    rev: number
  ): Promise<SaveCoordinatorResult>
  {
    const payload = { state }
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    }

    if (etag) {
      headers['If-Match'] = etag
    } else {
      headers['X-Rev'] = String(rev)
    }

    const { res, data } = await requestJson(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
      keepalive: true,
    })

    if (isOkStatus(res.status)) {
      const et = parseEtag(res) || undefined
      const d = (data || {}) as Record<string, unknown>
      const serverTs = (d.server_ts as string) || (d.updated_at as string) || new Date().toISOString()
      const nextRev = typeof d.next_rev === 'number' ? (d.next_rev as number) : undefined
      return { serverTs, nextRev, etag: et }
    }

    const status = res.status as SaveErrorCode
    const payloadMeta = ensureErrorMeta(((data as ErrorPayload) || null), res)

    if (status === 429) {
      telemetry.trigger('solo_save', {
        version: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
        endpoint: 'save-stream',
        status,
        backoff_ms: payloadMeta.backoff_ms,
      })
    }

    throw new SaveCoordinatorError(status, 'save-stream', payloadMeta)
  },
}
