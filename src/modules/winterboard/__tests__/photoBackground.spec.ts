/**
 * Фото фоном сторінки (власник 2026-09-28, «так, фото фоном — роби»; LAW §9 v1.19).
 *   • помічники фону: лише безпечні адреси, `prev` для «Прибрати фон», кадр «заповнити без спотворення»;
 *   • Replay/учень: `background_update { background }` застосовується (не лише колір);
 *   • ноутбук: адаптер фото ставить фон тими самими перевірками, що й `photo.add`; «Прибрати»;
 *   • useBoardRemote: `photo.background`, `photo.background_clear`, поле стану `bg_photo`;
 *   • телефон: «Зробити фоном сторінки», текст успіху, «Прибрати фон сторінки».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, defineComponent, h, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import {
  coverCrop, isImageBackground, normalizePageBackground, withImageBackground, withoutImageBackground,
} from '../board/pageBackground'
import { applyReplayOperation, type ReplayStoreApi } from '../engine/applyReplayOperation'
import { createRemotePhotoAdapter, type RemotePhotoDeps } from '../remote/remotePhotoAdapter'
import { useBoardRemote } from '../composables/useBoardRemote'
import { derivePair } from '../remote/remotePair'
import type { WBAsset, WBPage, WBPageBackground } from '../types/winterboard'
import { useWBStore, _resetOperationListeners } from '../board/state/boardStore'
import WBPageThumbnails from '../components/pages/WBPageThumbnails.vue'
import soloRoomSource from '../views/WBSoloRoom.vue?raw'
import canvasSource from '../components/canvas/WBCanvas.vue?raw'

const uploadAsset = vi.fn()
vi.mock('../api/library', () => ({ uploadAsset: (...a: unknown[]) => uploadAsset(...a) }))
const preparePhoto = vi.fn()
vi.mock('../remote/preparePhoto', async (orig) => ({
  ...(await orig<typeof import('../remote/preparePhoto')>()),
  preparePhoto: (...a: unknown[]) => preparePhoto(...a),
}))
import RemotePhotoPanel from '../components/remote/RemotePhotoPanel.vue'

const REQ = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'
const PH = uk.winterboard.remote.photo

describe('помічники фону', () => {
  it('фото-фон — лише з адресою, яку побачать учень і Replay (http(s) чи шлях сайту)', () => {
    expect(normalizePageBackground({ type: 'image', url: 'https://cdn/p.jpg' })).toEqual({ type: 'image', url: 'https://cdn/p.jpg' })
    expect(normalizePageBackground({ type: 'image', url: '/media/p.jpg', requestId: REQ, junk: 1 }))
      .toEqual({ type: 'image', url: '/media/p.jpg', requestId: REQ })
    for (const url of ['data:image/png;base64,AAA', 'blob:http://x/1', 'javascript:alert(1)', '//evil/p.jpg', '', 42]) {
      expect(normalizePageBackground({ type: 'image', url })).toBeNull()
    }
    expect(normalizePageBackground({ type: 'video', url: 'https://x' })).toBeNull()
    expect(normalizePageBackground('grid')).toBe('grid')
    expect(normalizePageBackground('neon')).toBeNull()
  })

  it('поставити фото фоном: попередній фон — у prev; друге фото лишає ПЕРШИЙ prev', () => {
    const pdf: WBPageBackground = { type: 'pdf', url: 'https://cdn/page.png', assetId: 'a1' }
    const first = withImageBackground(pdf, { url: 'https://cdn/1.jpg', requestId: REQ })
    expect(first).toEqual({ type: 'image', url: 'https://cdn/1.jpg', requestId: REQ, prev: pdf })
    const second = withImageBackground(first, { url: 'https://cdn/2.jpg' })
    expect(second.prev).toEqual(pdf)
    expect(withImageBackground(undefined, { url: 'https://cdn/1.jpg' }).prev).toBe('white')
  })

  it('прибрати фото-фон — повертається фон, що був до фото; не-фото фон не чіпаємо', () => {
    expect(withoutImageBackground({ type: 'image', url: 'https://cdn/1.jpg', prev: 'grid' })).toBe('grid')
    expect(withoutImageBackground({ type: 'image', url: 'https://cdn/1.jpg' })).toBe('white')
    expect(withoutImageBackground('dots')).toBe('dots')
  })

  it('кадр «заповнити»: пропорції сторінки, по центру, в межах знімка (вертикальне фото на горизонтальній сторінці)', () => {
    const c = coverCrop(900, 1600, 1600, 900)
    expect(c.width).toBe(900)
    expect(c.height / c.width).toBeCloseTo(900 / 1600, 6)
    expect(c.y).toBeCloseTo((1600 - c.height) / 2, 6)
    expect(c.x).toBe(0)
    expect(c.y + c.height).toBeLessThanOrEqual(1600)
  })
})

describe('Replay і учень: background_update з фото', () => {
  function store() {
    const setPageBackground = vi.fn()
    const s = {
      currentPageIndex: 0, pages: [{ id: 'page-1' }],
      setBackgroundColor: vi.fn(), setPageBackground,
    } as unknown as ReplayStoreApi
    return { s, setPageBackground }
  }

  it('фото-фон застосовується на свою сторінку; невідоме значення — ні', () => {
    const { s, setPageBackground } = store()
    applyReplayOperation(s, { op_type: 'background_update', page_id: 'page-1', payload: { background: { type: 'image', url: 'https://cdn/1.jpg', prev: 'white' } } } as never)
    expect(setPageBackground).toHaveBeenCalledWith({ type: 'image', url: 'https://cdn/1.jpg', prev: 'white' }, 'page-1')
    applyReplayOperation(s, { op_type: 'background_update', page_id: 'page-1', payload: { background: { type: 'image', url: 'data:x' } } } as never)
    expect(setPageBackground).toHaveBeenCalledTimes(1)
  })
})

function deps(over: Partial<RemotePhotoDeps> = {}) {
  let bg: WBPageBackground | undefined = 'white'
  const d = {
    supported: vi.fn(() => true),
    boardId: vi.fn((): string | null => 'board-A'),
    currentPageId: vi.fn((): string | null => 'page-1'),
    currentPageIndex: vi.fn(() => 1),
    isInputLocked: vi.fn(() => false),
    canAddObject: vi.fn(() => false),   // стеля об'єктів фону не стосується
    hasAssetAnywhere: vi.fn(() => false),
    fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'image/jpeg', cdn_url: 'https://cdn/p.jpg', content_item_id: 5 })),
    loadImage: vi.fn(async () => ({ naturalWidth: 3072, naturalHeight: 2304 })),
    place: vi.fn(),
    currentBackground: vi.fn(() => bg),
    setBackground: vi.fn((next: WBPageBackground) => { bg = next }),
    ...over,
  }
  return d
}

describe('ноутбук: адаптер фото — фон сторінки', () => {
  it('ті самі перевірки, що в «Додати»; фон — перевірене фото з prev; об\'єкт не кладеться', async () => {
    const d = deps()
    const a = createRemotePhotoAdapter(d)
    await expect(a.setBackground({ libraryAssetId: 7, requestId: REQ, pageIndex: 1 })).resolves.toEqual({ status: 'placed' })
    expect(d.fetchLibraryAsset).toHaveBeenCalledWith(7)
    expect(d.place).not.toHaveBeenCalled()
    expect(d.setBackground).toHaveBeenCalledWith({ type: 'image', url: 'https://cdn/p.jpg', assetId: '7', requestId: REQ, prev: 'white' })
    expect(a.hasBackgroundPhoto()).toBe(true)
    // та сама спроба вдруге — фон уже стоїть, другий запис не йде
    await expect(a.setBackground({ libraryAssetId: 7, requestId: REQ, pageIndex: 1 })).resolves.toEqual({ status: 'placed' })
    expect(d.setBackground).toHaveBeenCalledTimes(1)
  })

  it('відмови: інша сторінка, заблоковане введення, чужий файл, не картинка, без дії фону', async () => {
    const req = { libraryAssetId: 7, requestId: REQ, pageIndex: 1 }
    await expect(createRemotePhotoAdapter(deps({ currentPageIndex: vi.fn(() => 2) })).setBackground(req))
      .resolves.toEqual({ status: 'rejected', reason: 'page_changed' })
    await expect(createRemotePhotoAdapter(deps({ isInputLocked: vi.fn(() => true) })).setBackground(req))
      .resolves.toEqual({ status: 'rejected', reason: 'input_locked' })
    await expect(createRemotePhotoAdapter(deps({ fetchLibraryAsset: vi.fn(async () => { throw { response: { status: 404 } } }) })).setBackground(req))
      .resolves.toEqual({ status: 'rejected', reason: 'not_found' })
    await expect(createRemotePhotoAdapter(deps({ fetchLibraryAsset: vi.fn(async () => ({ status: 'active', content_type: 'application/pdf', cdn_url: 'https://cdn/p.pdf', content_item_id: 5 })) })).setBackground(req))
      .resolves.toEqual({ status: 'rejected', reason: 'not_image' })
    await expect(createRemotePhotoAdapter(deps({ setBackground: undefined })).setBackground(req))
      .resolves.toEqual({ status: 'rejected', reason: 'unsupported' })
  })

  it('«Прибрати фон» — лише на сторінці, яку бачив учитель, і лише фото-фон; повертає prev', () => {
    const d = deps({ currentBackground: vi.fn(() => ({ type: 'image', url: 'https://cdn/p.jpg', prev: 'grid' }) as WBPageBackground) })
    const a = createRemotePhotoAdapter(d)
    expect(a.clearBackground(2)).toBe(false)
    expect(a.clearBackground(1)).toBe(true)
    expect(d.setBackground).toHaveBeenCalledWith('grid')
    const plain = createRemotePhotoAdapter(deps())
    expect(plain.clearBackground(1)).toBe(false)
    expect(plain.hasBackgroundPhoto()).toBe(false)
  })
})

describe('useBoardRemote: photo.background / photo.background_clear / bg_photo', () => {
  const SID = 'board-A'
  const mounted: Array<{ unmount: () => void }> = []
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  function setup(hasPhoto = false) {
    const store = reactive({ currentPageIndex: 1, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
    const sendMessage = vi.fn()
    const bgPhoto = ref(hasPhoto)
    const photo = {
      add: vi.fn(),
      setBackground: vi.fn(async () => ({ status: 'placed' as const })),
      clearBackground: vi.fn(() => { bgPhoto.value = false; return true }),
      hasBackgroundPhoto: vi.fn(() => bgPhoto.value),
    }
    mounted.push(mount(defineComponent({
      setup() {
        useBoardRemote({ sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), photo })
        return () => h('div')
      },
    })))
    const fire = (cmd: string, args: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: derivePair(SID), clientId: 'phone', cmd, args },
    }))
    const states = () => sendMessage.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((m) => m.type === 'remote.state')
    return { photo, fire, states, bgPhoto }
  }

  it('стан несе bg_photo; команда фону — у адаптер, результат — полем photo', async () => {
    const { photo, fire, states } = setup(true)
    fire('hello')
    expect(states()[states().length - 1]).toMatchObject({ bg_photo: true })
    fire('photo.background', { library_asset_id: 7, request_id: REQ, page_index: 1 })
    await flushPromises()
    expect(photo.setBackground).toHaveBeenCalledWith({ libraryAssetId: 7, requestId: REQ, pageIndex: 1 })
    expect(photo.add).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 200))
    expect(states()[states().length - 1]).toMatchObject({ photo: { request_id: REQ, status: 'placed' } })
  })

  it('«Прибрати фон» — сторінка з команди, стан одразу з bg_photo: false', async () => {
    const { photo, fire, states } = setup(true)
    fire('hello')
    fire('photo.background_clear', { page_index: 1 })
    expect(photo.clearBackground).toHaveBeenCalledWith(1)
    await new Promise((r) => setTimeout(r, 200))
    expect(states()[states().length - 1]).toMatchObject({ bg_photo: false })
    fire('photo.background_clear', { page_index: 'x' })
    expect(photo.clearBackground).toHaveBeenCalledTimes(1)
  })
})

describe('телефон: «Зробити фоном сторінки» і «Прибрати фон сторінки»', () => {
  type SendArgs = { library_asset_id: number; request_id: string; page_index: number }
  beforeEach(() => {
    uploadAsset.mockReset(); preparePhoto.mockReset()
    preparePhoto.mockResolvedValue({ file: new File([new Uint8Array(64)], 'p.jpg', { type: 'image/jpeg' }), width: 3072, height: 2304, original: { width: 4032, height: 3024, bytes: 1, type: 'image/jpeg' }, reencoded: true })
    uploadAsset.mockResolvedValue({ id: 77, cdn_url: 'https://cdn/x.jpg', status: 'active', content_type: 'image/jpeg' })
    ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview')
    ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  })

  function mountPanel(over: Record<string, unknown> = {}) {
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const send = vi.fn((_a: SendArgs) => true)
    const sendBackground = vi.fn((_a: SendArgs) => true)
    const w = mount(RemotePhotoPanel, {
      props: { ready: true, pageIndex: 2, result: null, send, sendBackground, ...over },
      global: { plugins: [i18n] },
    })
    return { w, send, sendBackground }
  }
  async function pick(w: ReturnType<typeof mount>) {
    const input = w.find('[data-testid="photo-gallery-input"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })], configurable: true })
    await input.trigger('change')
    await flushPromises()
  }

  it('після прев\'ю — «Зробити фоном сторінки»: те саме завантаження, команда фону, текст успіху про фон', async () => {
    const { w, send, sendBackground } = mountPanel()
    await pick(w)
    const btn = w.find('[data-testid="photo-as-background"]')
    expect(btn.text()).toContain(PH.asBackground)
    await btn.trigger('click')
    await flushPromises()
    expect(uploadAsset).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
    expect(sendBackground).toHaveBeenCalledTimes(1)
    const args = sendBackground.mock.calls[0]![0]
    expect(args).toMatchObject({ library_asset_id: 77, page_index: 2 })
    await w.setProps({ result: { request_id: args.request_id, status: 'placed' } })
    expect(w.find('[data-testid="photo-placed"]').text()).toContain(PH.placedBackground)
  })

  it('без дії фону (старий ноутбук чи клас) кнопки фону немає', async () => {
    const { w } = mountPanel({ sendBackground: undefined })
    await pick(w)
    expect(w.find('[data-testid="photo-as-background"]').exists()).toBe(false)
  })

  it('«Прибрати фон сторінки» — лише коли на сторінці фото-фон', async () => {
    const { w } = mountPanel({ bgPhoto: false })
    expect(w.find('[data-testid="photo-clear-background"]').exists()).toBe(false)
    await w.setProps({ bgPhoto: true })
    const btn = w.find('[data-testid="photo-clear-background"]')
    expect(btn.text()).toContain(PH.clearBackground)
    await btn.trigger('click')
    expect(w.emitted('clear-background')).toHaveLength(1)
  })
})

describe('isImageBackground', () => {
  it('лише фото з безпечною адресою', () => {
    expect(isImageBackground({ type: 'image', url: 'https://cdn/1.jpg' })).toBe(true)
    expect(isImageBackground({ type: 'image', url: 'data:x' })).toBe(false)
    expect(isImageBackground('white')).toBe(false)
  })
})

// Кімната уроку не монтується в тестах — звіряємо, що підключення на місці (kill-проба ламає кожен рядок)
describe('WBSoloRoom: підключення фото-фону', () => {
  it('тулбар: кнопка й обробник; нижня панель: «Прибрати фото-фон»; пульт: дії фону', () => {
    expect(soloRoomSource).toContain(':can-make-background="!!selectedImageForBackground"')
    expect(soloRoomSource).toContain('@make-background="handleMakeBackground"')
    expect(soloRoomSource).toContain('data-testid="clear-photo-background"')
    // ↶/↷ (власник 2026-09-28: «назад не повертається»): «Зробити фоном» — один крок із картинкою,
    // «Прибрати» і фон з пульта — кроком історії, не прямим записом
    expect(soloRoomSource).toContain('store.imageToPageBackground(asset.id, withImageBackground(')
    expect(soloRoomSource).toContain("store.changePageBackgrounds([{ pageId: page.id, background: withoutImageBackground(page.background) }])")
    expect(soloRoomSource).toContain('if (pageId) store.changePageBackgrounds([{ pageId, background: bg }])')
    // колір «BG» теж фон сторінки: фото-фон на тих самих сторінках знімається ДО кольору
    const onChange = soloRoomSource.slice(soloRoomSource.indexOf('function onBgColorChange('))
    expect(onChange.indexOf('.filter((p) => p.id && isImageBackground(p.background))')).toBeGreaterThan(0)
    expect(onChange.indexOf('store.changePageBackgrounds(')).toBeLessThan(onChange.indexOf('store.setBackgroundColor(color'))
    // кнопка з підписом в один рядок (не квадрат 28×28 — текст ламався в три рядки)
    expect(soloRoomSource).toMatch(/\.wb-page-btn\.wb-bg-photo-clear \{[^}]*width: auto;[^}]*white-space: nowrap;/)
  })
})

// Шар фону кешований (cacheBackgroundLayer): лише batchDraw перемальовував старий знімок шару —
// наживо фото було в стані, а на полотні 0 з 15 точок. Живий доказ — піксельна проба стенду.
describe('WBCanvas: фото-фон справді малюється', () => {
  it('завантаження картинки фону і зміна фону скидають кеш шару фону', () => {
    const onLoad = canvasSource.slice(canvasSource.indexOf('const bgImageCache = useImageCache('))
    expect(onLoad.slice(0, 300)).toContain('layer?.clearCache?.()')
    expect(canvasSource).toMatch(/`\$\{bg\.type\}:\$\{bg\.url\}`[\s\S]{0,200}layer\?\.clearCache\?\.\(\)/)
  })
})

// ↶/↷ фону (власник 2026-09-28: «я вручну поставив фон, а назад не повертається»): раніше ↶ повертав
// лише картинку, а фото лишалось фоном. Кожен крок має дійти на сервер (op), інакше F5 поверне старе.
describe('стор: фон сторінки — одним кроком ↶/↷, з op на сервер', () => {
  let store: ReturnType<typeof useWBStore>
  let ops: Array<{ op_type: string; page_id?: string; payload: Record<string, unknown> }>
  const img = { id: 'img-1', type: 'image', src: '/media/a.jpg', x: 10, y: 20, w: 300, h: 200, rotation: 0 } as WBAsset

  beforeEach(() => {
    setActivePinia(createPinia())
    _resetOperationListeners()
    store = useWBStore()
    store.pages = [
      { id: 'p1', name: '1', strokes: [], assets: [{ ...img }], background: 'grid' },
      { id: 'p2', name: '2', strokes: [], assets: [], background: { type: 'image', url: '/media/b.jpg', prev: 'white' } },
    ] as WBPage[]
    store.currentPageIndex = 0
    ops = []
    store.onOperation((op) => ops.push(op as unknown as (typeof ops)[number]))
  })
  afterEach(() => _resetOperationListeners())

  it('«Зробити фоном»: ↶ повертає і фон, що був, і картинку; ↷ — знову фото фоном', () => {
    const photo = withImageBackground('grid', { url: '/media/a.jpg', assetId: 'img-1' })
    store.imageToPageBackground('img-1', photo)
    expect(store.pages[0].background).toEqual(photo)
    expect(store.pages[0].assets).toHaveLength(0)
    expect(ops.map((o) => o.op_type)).toEqual(['background_update', 'asset_delete'])

    ops = []
    store.undo()
    expect(store.pages[0].background).toBe('grid')
    expect(store.pages[0].assets.map((a) => a.id)).toEqual(['img-1'])
    expect(ops.map((o) => o.op_type)).toEqual(['background_update', 'asset_add'])
    expect(ops[0].payload).toEqual({ background: 'grid' })

    ops = []
    store.redo()
    expect(store.pages[0].background).toEqual(photo)
    expect(store.pages[0].assets).toHaveLength(0)
    expect(ops.map((o) => o.op_type)).toEqual(['background_update', 'asset_delete'])
  })

  it('фон кількох сторінок (колір «BG» на всі) — один крок ↶ повертає фото на кожній', () => {
    store.pages[0].background = { type: 'image', url: '/media/a.jpg', prev: 'grid' }
    store.changePageBackgrounds([
      { pageId: 'p1', background: 'grid' },
      { pageId: 'p2', background: 'white' },
    ])
    expect(store.pages.map((pg) => pg.background)).toEqual(['grid', 'white'])
    expect(ops.map((o) => o.page_id)).toEqual(['p1', 'p2'])

    store.undo()
    expect(store.pages[0].background).toEqual({ type: 'image', url: '/media/a.jpg', prev: 'grid' })
    expect(store.pages[1].background).toEqual({ type: 'image', url: '/media/b.jpg', prev: 'white' })
    expect(store.canUndo).toBe(false)
  })
})

// Власник 2026-09-28: «коли вставив з телефона — в ескізах не змінився фон». Мініатюра малює той
// самий кадр «заповнити», що полотно, щойно фото завантажилось.
describe('мініатюри сторінок: фото-фон видно', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function stubThumbnailEnv(draws: unknown[][]) {
    const noop = () => {}
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'drawImage' ? (...a: unknown[]) => { draws.push(a) } : noop),
      set: () => true,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    class FakeImage {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      naturalWidth = 600
      naturalHeight = 800
      set src(_v: string) { Promise.resolve().then(() => this.onload?.()) }
    }
    vi.stubGlobal('Image', FakeImage)
    class FakeObserver {
      constructor(private cb: (e: Array<{ target: Element; isIntersecting: boolean }>) => void) {}
      observe(el: Element) { this.cb([{ target: el, isIntersecting: true }]) }
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.useFakeTimers()
    return FakeImage
  }
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const photoBg = { type: 'image', url: '/media/a.jpg', prev: 'white' } as WBPageBackground

  it('сторінка з фото-фоном — drawImage з кадром «заповнити» на всю сторінку мініатюри', async () => {
    const draws: unknown[][] = []
    const FakeImage = stubThumbnailEnv(draws)
    const page = {
      id: 'p1', name: '1', strokes: [], assets: [], backgroundColor: '#ffc0cb',
      background: { type: 'image', url: '/media/a.jpg', prev: 'white' },
    } as WBPage
    const w = mount(WBPageThumbnails, { props: { pages: [page], currentIndex: 0 }, global: { plugins: [i18n] } })
    await nextTick()
    await nextTick()
    await Promise.resolve()
    expect(draws).toHaveLength(0) // поки фото вантажиться — лише колір
    vi.advanceTimersByTime(600)
    expect(draws).toHaveLength(1)
    const [image, sx, sy, sw, sh, dx, dy, dw, dh] = draws[0]
    expect(image).toBeInstanceOf(FakeImage)
    // сторінка 1920×1080 у мініатюрі 120×67.5; знімок 600×800 — середня смуга по висоті
    expect([sx, sy, sw, sh]).toEqual([0, 231.25, 600, 337.5])
    expect([dx, dy, dw, dh]).toEqual([0, 0, 120, 67.5])
    w.unmount()
  })

  it('фон став фото ВЖЕ після показу мініатюр (фото з телефона) — мініатюра перемальовується', async () => {
    const draws: unknown[][] = []
    stubThumbnailEnv(draws)
    // стор міняє фон НА МІСЦІ (setPageBackground: page.background = …), масив сторінок той самий
    const pages = reactive([
      { id: 'p1', name: '1', strokes: [], assets: [], backgroundColor: '#ffc0cb', background: 'white' },
    ]) as WBPage[]
    const w = mount(WBPageThumbnails, { props: { pages, currentIndex: 0 }, global: { plugins: [i18n] } })
    await nextTick()
    await nextTick()
    pages[0].background = photoBg
    await nextTick()
    vi.advanceTimersByTime(600) // перемальовка за зміною фону → почалось завантаження фото
    await Promise.resolve()
    vi.advanceTimersByTime(600) // фото завантажилось → ще одна перемальовка
    expect(draws).toHaveLength(1)
    w.unmount()
  })
})
