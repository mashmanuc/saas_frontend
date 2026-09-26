/**
 * «Фото з телефона на дошку» (LAW §9 v1.9, 2026-09-26) — логіка без DOM:
 * контракт, розміщення перевіреного зображення, адаптер ноутбука, photo.add у
 * useBoardRemote, підготовка фото (чисті частини), помилки завантаження.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, reactive, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import {
  parseRemotePhoto, readPhotoRequest, newRequestId, photoAssetIdFor, PHOTO_REQUEST_ID_RE,
} from '../remote/photoContract'
import { fitImageSize, buildPlacedImageAsset } from '../board/placeImage'
import { createRemotePhotoAdapter, type RemotePhotoDeps } from '../remote/remotePhotoAdapter'
import { useBoardRemote } from '../composables/useBoardRemote'
import { derivePair } from '../remote/remotePair'
import { targetSize, canPassThrough, PHOTO_MAX_SIDE, PHOTO_PASSTHROUGH_MAX_BYTES } from '../remote/preparePhoto'
import { photoUploadError } from '../remote/photoUploadError'

const RID = '3f2b8c1e-9a4d-4c6b-8e21-5d7a0f9b1c2e'
const RID2 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

// ── Контракт ─────────────────────────────────────────────────────────────────

describe('контракт photo.add / remote.state.photo', () => {
  it('parseRemotePhoto приймає лише закритий набір', () => {
    expect(parseRemotePhoto({ request_id: RID, status: 'placed' })).toEqual({ request_id: RID, status: 'placed' })
    expect(parseRemotePhoto({ request_id: RID, status: 'rejected', reason: 'page_changed' }))
      .toEqual({ request_id: RID, status: 'rejected', reason: 'page_changed' })
    for (const bad of [
      { request_id: RID, status: 'placed', reason: 'frozen' },       // причина лише у відмови
      { request_id: RID, status: 'rejected' },                       // відмова без причини
      { request_id: RID, status: 'rejected', reason: 'boom' },
      { request_id: RID.toUpperCase(), status: 'placed' },
      { request_id: RID, status: 'saved' },
      null, 'x', 42,
    ]) expect(parseRemotePhoto(bad)).toBeUndefined()
  })

  it('readPhotoRequest відсіює все, крім додатного id, UUID і сторінки ≥ 0', () => {
    expect(readPhotoRequest({ library_asset_id: 5, request_id: RID, page_index: 2 }))
      .toEqual({ libraryAssetId: 5, requestId: RID, pageIndex: 2 })
    for (const bad of [
      { library_asset_id: 0, request_id: RID, page_index: 0 },
      { library_asset_id: '5', request_id: RID, page_index: 0 },
      { library_asset_id: 5.5, request_id: RID, page_index: 0 },
      { library_asset_id: 5, request_id: 'nope', page_index: 0 },
      { library_asset_id: 5, request_id: RID, page_index: -1 },
      { library_asset_id: 5, request_id: RID },
    ]) expect(readPhotoRequest(bad as Record<string, unknown>)).toBeNull()
  })

  it('newRequestId — канонічний UUID і без crypto.randomUUID (http у локальній мережі)', () => {
    expect(newRequestId()).toMatch(PHOTO_REQUEST_ID_RE)
    const orig = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const a = newRequestId()
      const b = newRequestId()
      expect(a).toMatch(PHOTO_REQUEST_ID_RE)
      expect(a).not.toBe(b)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: orig, configurable: true })
    }
  })
})

// ── Розміщення ───────────────────────────────────────────────────────────────

describe('розміщення перевіреного зображення (без знання про джерело)', () => {
  it('вписує без спотворення й без збільшення', () => {
    expect(fitImageSize({ src: 'x', naturalWidth: 3000, naturalHeight: 4000 }, { w: 800, h: 600 })).toEqual({ w: 450, h: 600 })
    expect(fitImageSize({ src: 'x', naturalWidth: 4000, naturalHeight: 1000 }, { w: 800, h: 600 })).toEqual({ w: 800, h: 200 })
    expect(fitImageSize({ src: 'x', naturalWidth: 120, naturalHeight: 80 }, { w: 800, h: 600 })).toEqual({ w: 120, h: 80 })
  })

  it('кладе картинку центром у задану точку', () => {
    const a = buildPlacedImageAsset({
      id: 'photo-1', image: { src: 'https://cdn/x.jpg', naturalWidth: 2000, naturalHeight: 1000 },
      center: { x: 500, y: 400 }, maxSize: { w: 600, h: 600 },
    })
    expect(a).toMatchObject({ id: 'photo-1', type: 'image', src: 'https://cdn/x.jpg', w: 600, h: 300, x: 200, y: 250, rotation: 0, locked: false })
  })
})

// ── Адаптер ноутбука ─────────────────────────────────────────────────────────

function deps(over: Partial<RemotePhotoDeps> = {}) {
  const placed = new Set<string>()
  const d = {
    currentPageIndex: vi.fn(() => 1),
    isFrozen: vi.fn(() => false),
    isInputLocked: vi.fn(() => false),
    canAddObject: vi.fn(() => true),
    hasAssetAnywhere: vi.fn((id: string) => placed.has(id)),
    fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'image/jpeg', cdn_url: 'https://cdn/p.jpg' })),
    loadImage: vi.fn(async () => ({ naturalWidth: 3072, naturalHeight: 2304 })),
    place: vi.fn((_img, id: string) => { placed.add(id) }),
    ...over,
  }
  return d
}
const REQ = { libraryAssetId: 9, requestId: RID, pageIndex: 1 }

describe('адаптер photo.add на ноутбуці', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('перевіряє актив від свого акаунта й передає розміщенню розв’язане зображення', async () => {
    const d = deps()
    const out = await createRemotePhotoAdapter(d).add(REQ)
    expect(out).toEqual({ status: 'placed' })
    expect(d.fetchLibraryAsset).toHaveBeenCalledWith(9)
    expect(d.place).toHaveBeenCalledTimes(1)
    expect(d.place).toHaveBeenCalledWith({ src: 'https://cdn/p.jpg', naturalWidth: 3072, naturalHeight: 2304 }, photoAssetIdFor(RID))
  })

  it.each([
    ['page_changed', { currentPageIndex: vi.fn(() => 2) }],
    ['frozen', { isFrozen: vi.fn(() => true) }],
    ['input_locked', { isInputLocked: vi.fn(() => true) }],
    ['limit', { canAddObject: vi.fn(() => false) }],
  ])('%s — відмова ще до запитів', async (reason, over) => {
    const d = deps(over as Partial<RemotePhotoDeps>)
    expect(await createRemotePhotoAdapter(d).add(REQ)).toEqual({ status: 'rejected', reason })
    expect(d.fetchLibraryAsset).not.toHaveBeenCalled()
    expect(d.place).not.toHaveBeenCalled()
  })

  it.each([
    ['not_found', { fetchLibraryAsset: vi.fn(async () => { throw { response: { status: 404 } } }) }],
    ['not_found', { fetchLibraryAsset: vi.fn(async () => ({ status: 'deleted', content_type: 'image/jpeg', cdn_url: 'u' })) }],
    ['not_found', { fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'image/jpeg', cdn_url: '' })) }],
    ['not_image', { fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'image/gif', cdn_url: 'u' })) }],
    ['not_image', { fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'application/pdf', cdn_url: 'u' })) }],
    ['load_failed', { loadImage: vi.fn(async () => { throw new Error('image_load_failed') }) }],
  ])('%s — фото не кладеться', async (reason, over) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = deps(over as Partial<RemotePhotoDeps>)
    expect(await createRemotePhotoAdapter(d).add(REQ)).toEqual({ status: 'rejected', reason })
    expect(d.place).not.toHaveBeenCalled()
  })

  it('інша помилка сервера — error, і вона не тиха', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = deps({ fetchLibraryAsset: vi.fn(async () => { throw { response: { status: 500 } } }) })
    expect(await createRemotePhotoAdapter(d).add(REQ)).toEqual({ status: 'rejected', reason: 'error' })
    expect(warn).toHaveBeenCalled()
  })

  it('ідемпотентність: той самий request_id не кладе фото вдруге', async () => {
    const d = deps()
    const adapter = createRemotePhotoAdapter(d)
    await adapter.add(REQ)
    expect(await adapter.add(REQ)).toEqual({ status: 'placed' })
    expect(d.place).toHaveBeenCalledTimes(1)
    expect(d.fetchLibraryAsset).toHaveBeenCalledTimes(1)
  })

  it('повтор у польоті не запускає другого додавання', async () => {
    const d = deps()
    const adapter = createRemotePhotoAdapter(d)
    const [a, b] = await Promise.all([adapter.add(REQ), adapter.add(REQ)])
    expect(a).toEqual({ status: 'placed' })
    expect(b).toEqual({ status: 'placed' })
    expect(d.fetchLibraryAsset).toHaveBeenCalledTimes(1)
    expect(d.place).toHaveBeenCalledTimes(1)
  })

  it('новий request_id — свідоме повторне додавання того самого фото', async () => {
    const d = deps()
    const adapter = createRemotePhotoAdapter(d)
    await adapter.add(REQ)
    await adapter.add({ ...REQ, requestId: RID2 })
    expect(d.place).toHaveBeenCalledTimes(2)
  })

  it('сторінку перегорнули, поки вантажилось фото, — на іншу сторінку не кладемо', async () => {
    let page = 1
    const d = deps({
      currentPageIndex: vi.fn(() => page),
      loadImage: vi.fn(async () => { page = 2; return { naturalWidth: 10, naturalHeight: 10 } }),
    })
    expect(await createRemotePhotoAdapter(d).add(REQ)).toEqual({ status: 'rejected', reason: 'page_changed' })
    expect(d.place).not.toHaveBeenCalled()
  })

  it('фото лягло іншим шляхом, поки вантажилось, — placed без другої операції', async () => {
    const seen = new Set<string>()
    const d = deps({
      hasAssetAnywhere: vi.fn((id: string) => seen.has(id)),
      loadImage: vi.fn(async () => { seen.add(photoAssetIdFor(RID)); return { naturalWidth: 10, naturalHeight: 10 } }),
    })
    expect(await createRemotePhotoAdapter(d).add(REQ)).toEqual({ status: 'placed' })
    expect(d.place).not.toHaveBeenCalled()
  })
})

// ── photo.add у useBoardRemote ───────────────────────────────────────────────

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const mounted: Array<{ unmount: () => void }> = []

function setupRemote(photo?: { add: ReturnType<typeof vi.fn> }) {
  const store = reactive({ currentPageIndex: 1, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
  const sendMessage = vi.fn()
  const w = mount(defineComponent({
    setup() {
      useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), ...(photo ? { photo } : {}) })
      return () => h('div')
    },
  }))
  mounted.push(w)
  return { sendMessage }
}

function fire(cmd: string, args: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent('wb:remote-command', {
    detail: { userId: '1', pair: derivePair(SID), clientId: 'phone', cmd, args },
  }))
}

function lastState(send: ReturnType<typeof vi.fn>) {
  const states = send.mock.calls.map((c) => c[0]).filter((m) => m.type === 'remote.state')
  return states[states.length - 1]
}

describe('ноутбук: photo.add через адаптер кімнати', () => {
  afterEach(() => {
    while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* вже знято */ } }
    vi.useRealTimers()
  })

  it('адаптер отримує розібраний запит; результат іде в remote.state.photo', async () => {
    vi.useFakeTimers()
    const add = vi.fn(async () => ({ status: 'placed' as const }))
    const { sendMessage } = setupRemote({ add })
    fire('photo.add', { library_asset_id: 9, request_id: RID, page_index: 1 })
    expect(add).toHaveBeenCalledWith({ libraryAssetId: 9, requestId: RID, pageIndex: 1 })
    await flushPromises()
    vi.advanceTimersByTime(200)
    expect(lastState(sendMessage).photo).toEqual({ request_id: RID, status: 'placed' })
  })

  it('без адаптера (класна кімната) — чесне rejected: unsupported, а не мовчанка', async () => {
    vi.useFakeTimers()
    const { sendMessage } = setupRemote()
    fire('photo.add', { library_asset_id: 9, request_id: RID, page_index: 1 })
    vi.advanceTimersByTime(200)
    expect(lastState(sendMessage).photo).toEqual({ request_id: RID, status: 'rejected', reason: 'unsupported' })
  })

  it('зіпсовані аргументи ігноруються — ні виклику, ні результату', async () => {
    vi.useFakeTimers()
    const add = vi.fn()
    const { sendMessage } = setupRemote({ add })
    fire('photo.add', { library_asset_id: 9, request_id: RID.toUpperCase(), page_index: 1 })
    fire('photo.add', { library_asset_id: 9, request_id: RID })
    vi.advanceTimersByTime(200)
    expect(add).not.toHaveBeenCalled()
    expect(sendMessage.mock.calls.some((c) => c[0].photo)).toBe(false)
  })

  it('виняток адаптера → rejected: error (не тихо)', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const add = vi.fn(async () => { throw new Error('boom') })
    const { sendMessage } = setupRemote({ add })
    fire('photo.add', { library_asset_id: 9, request_id: RID, page_index: 1 })
    await flushPromises()
    vi.advanceTimersByTime(200)
    expect(lastState(sendMessage).photo).toEqual({ request_id: RID, status: 'rejected', reason: 'error' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// ── Підготовка фото (чисті частини) і помилки завантаження ───────────────────

describe('підготовка фото на телефоні', () => {
  it('targetSize: довша сторона ≤ межі, пропорції, без збільшення', () => {
    expect(targetSize(4032, 3024, 3072)).toEqual({ width: 3072, height: 2304 })
    expect(targetSize(3024, 4032, 3072)).toEqual({ width: 2304, height: 3072 })
    expect(targetSize(1200, 900, 3072)).toEqual({ width: 1200, height: 900 })
  })

  it('JPEG перекодовуємо завжди (EXIF/GPS), PNG/WebP у межах — як є', () => {
    expect(canPassThrough('image/jpeg', 100_000, 800, 600)).toBe(false)
    expect(canPassThrough('image/png', 100_000, 800, 600)).toBe(true)
    expect(canPassThrough('image/webp', 100_000, 800, 600)).toBe(true)
    expect(canPassThrough('image/png', PHOTO_PASSTHROUGH_MAX_BYTES + 1, 800, 600)).toBe(false)
    expect(canPassThrough('image/png', 100_000, PHOTO_MAX_SIDE + 1, 600)).toBe(false)
    expect(canPassThrough('image/heic', 100_000, 800, 600)).toBe(false)
  })

  it('помилки завантаження — зрозумілий ключ, без повторів', () => {
    expect(photoUploadError(new Error('Network Error')).key).toBe('offline')
    expect(photoUploadError({ response: { status: 400, data: { error: 'unsupported_format' } } }).key).toBe('unsupported_format')
    expect(photoUploadError({ response: { status: 400, data: { error: 'invalid_image' } } }).key).toBe('invalid_image')
    expect(photoUploadError({ response: { status: 400, data: { error: 'file_too_large', limit_mb: 50 } } }))
      .toEqual({ key: 'file_too_large', params: { limit: 50 } })
    expect(photoUploadError({ response: { status: 429, data: {} } }).key).toBe('rate_limited')
    expect(photoUploadError({ response: { status: 507, data: {} } }).key).toBe('quota')
    expect(photoUploadError({ response: { status: 401, data: {} } }).key).toBe('auth')
    expect(photoUploadError({ response: { status: 502, data: {} } }).key).toBe('failed')
  })
})
