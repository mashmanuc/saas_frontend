/**
 * Публічна сторінка запису не шле owner-only запитів (власник, 2026-09-22:
 * «виправляй тост 403»). Раніше: маркери з /sessions/{id}/markers/ → чужому
 * 403 «Доступ заборонено», анонімові 401 «Сесію завершено»; статуси ресурсів
 * /sessions/{id}/assets/ → анонімові 401 і той самий тост.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const { calls } = vi.hoisted(() => ({ calls: { owner: 0, pub: 0 } }))

vi.mock('../api/replay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/replay')>()
  return {
    ...actual,
    fetchReplayTimeline: async () => ({ session_id: 's', total_operations: 0, operations: [], start_state: null }),
    fetchLessonMarkers: async () => { calls.owner++; return { markers: [] } },
    fetchPublicLessonMarkers: async () => { calls.pub++; return { markers: [{ id: 'm1' }] } },
  }
})

import { useReplayV2 } from '../composables/useReplayV2'

beforeEach(() => { calls.owner = 0; calls.pub = 0 })

describe('useReplayV2.loadMarkers — який ендпоінт', () => {
  it('публічний токен → публічні маркери, owner-ендпоінт не чіпається', async () => {
    const r = useReplayV2('sess', 'tok')
    await r.loadMarkers()
    expect(calls).toEqual({ owner: 0, pub: 1 })
    expect(r.markers.value.map((m) => m.id)).toEqual(['m1'])
  })

  it('власник (ownerReplayId) → owner-ендпоінт', async () => {
    const r = useReplayV2('sess', undefined, { ownerReplayId: 'rep' })
    await r.loadMarkers()
    expect(calls).toEqual({ owner: 1, pub: 0 })
  })

  it('без токена (автентифікований шлях) → owner-ендпоінт', async () => {
    const r = useReplayV2('sess')
    await r.loadMarkers()
    expect(calls).toEqual({ owner: 1, pub: 0 })
  })
})

describe('fetchPublicLessonMarkers', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  async function load() {
    const mod = await vi.importActual<typeof import('../api/replay')>('../api/replay')
    return mod.fetchPublicLessonMarkers
  }

  it('без cookie (credentials: omit) — повз apiClient і його тости', async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ markers: [{ id: 'x' }] }), { status: 200 }))
    globalThis.fetch = spy as never
    const res = await (await load())('abc')
    expect(res.markers).toEqual([{ id: 'x' }])
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/v1/winterboard/replay/public/abc/markers/')
    expect(init.credentials).toBe('omit')
  })

  it('404 або мережева помилка → порожній список, без винятку', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as never
    expect((await (await load())('abc')).markers).toEqual([])
    globalThis.fetch = vi.fn(async () => { throw new TypeError('offline') }) as never
    expect((await (await load())('abc')).markers).toEqual([])
  })
})

describe('WBCanvas — статуси ресурсів лише для того, хто увійшов', () => {
  it('assetStatus.load стоїть під isAuthenticated', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
    const call = src.indexOf('void assetStatus.load(')
    expect(call).toBeGreaterThan(-1)
    const guard = src.slice(src.lastIndexOf('if (', call), call)
    expect(guard).toContain('isAuthenticated')
  })
})
