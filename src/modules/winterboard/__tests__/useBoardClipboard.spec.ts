// WB: Unit tests for useBoardClipboard composable — STRICT upload-first flow
// Ref: TASK_BOARD_PHASE_1a_2.md §8, plan lazy-kindling-simon.md
//
// Інваріант що тестуємо: asset_add op створюється ТІЛЬКИ після успішного upload.
// dataURL у asset.src ніколи не потрапляє. На fail asset не з'являється,
// показується toast із Retry callback.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { WBUploadError } from '../composables/useImageUpload'
import { _resetQueue } from '../composables/useUploadQueue'
import type { WBAsset, WBStroke, WBPoint } from '../types/winterboard'

// ─── Mock useImageUpload ─────────────────────────────────────────────────────

const mockUploadFileToStorage = vi.fn()

vi.mock('../composables/useImageUpload', async () => {
  const actual = await vi.importActual<typeof import('../composables/useImageUpload')>(
    '../composables/useImageUpload',
  )
  return {
    ...actual,
    validateFile: vi.fn(() => ({ valid: true })),
    uploadFileToStorage: (...args: unknown[]) => mockUploadFileToStorage(...args),
  }
})

// ─── Mock learningContentApi ────────────────────────────────────────────────

const mockUploadFile = vi.fn().mockResolvedValue({ id: 42, content_item_id: 42 })

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  },
}))

// ─── Mock useToast (singleton, перехоплюємо showToast) ──────────────────────

const mockShowToast = vi.fn().mockReturnValue(1)

vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    toasts: { value: [] },
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

// ─── Mock store factory ──────────────────────────────────────────────────────

function createMockStore(overrides: Record<string, unknown> = {}) {
  const strokes: WBStroke[] = []
  const assets: WBAsset[] = []

  return {
    selectedIds: [] as string[],
    currentPage: {
      id: 'page-1',
      name: 'Page 1',
      strokes,
      assets,
      background: 'white' as const,
    },
    pageWidth: 1920,
    pageHeight: 1080,
    addAsset: vi.fn((a: WBAsset) => { assets.push(a) }),
    addStroke: vi.fn((s: WBStroke) => { strokes.push(s) }),
    addStickyNote: vi.fn((s: WBAsset) => { assets.push(s) }),
    // Batch paths used by pasteInternal (single op per kind for perf)
    addStrokesBatch: vi.fn((arr: WBStroke[]) => { strokes.push(...arr) }),
    addAssetsBatch: vi.fn((arr: WBAsset[]) => { assets.push(...arr) }),
    updateAsset: vi.fn(),
    deleteStroke: vi.fn(),
    deleteAsset: vi.fn(),
    deleteSelected: vi.fn(),
    ...overrides,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeImageClipboardEvent(fileCount: number = 1): ClipboardEvent {
  const items = Array.from({ length: fileCount }, (_, i) => {
    const file = new File([`pixels-${i}`], `screenshot-${i}.png`, { type: 'image/png' })
    return {
      kind: 'file' as const,
      type: 'image/png',
      getAsFile: () => file,
      getAsString: vi.fn(),
    }
  })

  const clipboardData = {
    items: items as unknown as DataTransferItemList,
    getData: vi.fn(() => ''),
    setData: vi.fn(),
    types: ['Files'],
  }

  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', { value: clipboardData, writable: false })
  return event
}

function makeTextClipboardEvent(text: string, target?: HTMLElement): ClipboardEvent {
  const item = {
    kind: 'string' as const,
    type: 'text/plain',
    getAsFile: () => null,
    getAsString: (cb: (s: string) => void) => cb(text),
  }

  const clipboardData = {
    items: [item] as unknown as DataTransferItemList,
    getData: vi.fn(() => text),
    setData: vi.fn(),
    types: ['text/plain'],
  }

  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', { value: clipboardData, writable: false })
  if (target) {
    Object.defineProperty(event, 'target', { value: target, writable: false })
  }
  return event
}

function makeStroke(id: string): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] as WBPoint[],
  }
}

function makeAsset(id: string, type: 'image' | 'sticky' = 'image'): WBAsset {
  return {
    id,
    type,
    src: 'https://cdn.example.com/img.png',
    x: 100,
    y: 200,
    w: 300,
    h: 150,
    rotation: 0,
  }
}

/**
 * Підкласити Image щоб preload.onload спрацьовував синхронно — без цього
 * await preload у handleImagePaste висить навічно (jsdom не вантажить URLs).
 */
function stubImageGlobal(width = 800, height = 600) {
  const orig = globalThis.Image
  globalThis.Image = class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = width
    naturalHeight = height
    set src(_v: string) { queueMicrotask(() => this.onload?.()) }
  } as unknown as typeof Image
  return () => { globalThis.Image = orig }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useBoardClipboard', () => {
  let store: ReturnType<typeof createMockStore>
  let onAssetAdd: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createMockStore()
    onAssetAdd = vi.fn()
    mockUploadFile.mockClear()
    mockUploadFile.mockResolvedValue({ id: 42, content_item_id: 42 })
    mockShowToast.mockClear()
    mockUploadFileToStorage.mockReset()
    _resetQueue() // важливо — semaphore — module-level singleton
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createClipboard(storeOverrides?: Record<string, unknown>) {
    if (storeOverrides) {
      store = createMockStore(storeOverrides)
    }
    return useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
    })
  }

  // ── Test 1: upload success → asset з CDN URL ─────────────────────────────

  it('paste з successful upload — asset додається з CDN URL', async () => {
    mockUploadFileToStorage.mockResolvedValue({
      assetId: 'asset-cdn-1',
      assetUrl: 'https://cdn/img.png',
    })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).toHaveBeenCalledOnce()
    const added = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(added.type).toBe('image')
    expect(added.src).toBe('https://cdn/img.png')
    expect(added.src.startsWith('data:')).toBe(false) // інваріант
    expect(added.id).toBe('asset-cdn-1') // backend asset_id

    restore()
  })

  // ── Test 2: upload fail → asset НЕ додається + toast Retry ───────────────

  it('paste з upload fail — asset НЕ додається, показується toast Retry', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('rate_limited', 'Rate limit reached'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled() // інваріант — нічого на дошці
    expect(clipboard.uploadError.value).toBe('Upload failed')
    expect(mockShowToast).toHaveBeenCalled()
    const toastCall = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(toastCall).toBeDefined()
    expect(toastCall![2]?.action?.label).toBe('Retry')
    expect(typeof toastCall![2]?.action?.callback).toBe('function')

    restore()
  })

  // ── Test 3: quota_exceeded → toast БЕЗ retry ─────────────────────────────

  it('paste з quota_exceeded — toast про квоту БЕЗ retry button', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('quota_exceeded', 'Asset or storage quota exceeded'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(clipboard.uploadError.value).toBe('Storage quota exceeded')
    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast![0]).toContain('quota')
    expect(errorToast![2]?.action).toBeUndefined() // НЕ пропонуємо retry

    restore()
  })

  // ── Test 4: retry callback викликає upload повторно ─────────────────────

  it('retry callback з toast повторно ініціює upload того ж файлу', async () => {
    // Перший виклик fail, другий success
    mockUploadFileToStorage
      .mockRejectedValueOnce(new WBUploadError('rate_limited', 'fail'))
      .mockResolvedValueOnce({ assetId: 'cdn-2', assetUrl: 'https://cdn/2.png' })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    const retryCallback = errorToast?.[2]?.action?.callback as (() => void) | undefined
    expect(retryCallback).toBeDefined()

    // Викликаємо retry
    retryCallback!()
    await new Promise((r) => setTimeout(r, 50))

    expect(mockUploadFileToStorage).toHaveBeenCalledTimes(2)
    expect(onAssetAdd).toHaveBeenCalledOnce() // тепер успішно
    expect((onAssetAdd.mock.calls[0][0] as WBAsset).src).toBe('https://cdn/2.png')

    restore()
  })

  // ── Test 5: multi-paste — кожен файл свій upload з offset за index ──────

  it('paste 3 файли — 3 uploads, asset.x/y зміщені за порядком paste', async () => {
    mockUploadFileToStorage
      .mockResolvedValueOnce({ assetId: 'a-0', assetUrl: 'https://cdn/0.png' })
      .mockResolvedValueOnce({ assetId: 'a-1', assetUrl: 'https://cdn/1.png' })
      .mockResolvedValueOnce({ assetId: 'a-2', assetUrl: 'https://cdn/2.png' })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent(3)

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 100))

    expect(mockUploadFileToStorage).toHaveBeenCalledTimes(3)
    expect(onAssetAdd).toHaveBeenCalledTimes(3)

    // Знаходимо asset за CDN URL (порядок completion може відрізнятись від paste)
    const assets = onAssetAdd.mock.calls.map((c) => c[0] as WBAsset)
    const a0 = assets.find((a) => a.src === 'https://cdn/0.png')!
    const a1 = assets.find((a) => a.src === 'https://cdn/1.png')!
    const a2 = assets.find((a) => a.src === 'https://cdn/2.png')!

    // Offset = index * 20 (індекс — порядок paste, не completion)
    expect(a1.x - a0.x).toBe(20)
    expect(a2.x - a0.x).toBe(40)
    expect(a1.y - a0.y).toBe(20)

    restore()
  })

  // ── Test 6: dual-write call (lesson_id) ──────────────────────────────────

  it('paste з lessonId — викликає learningContentApi.uploadFile з lesson_id', async () => {
    mockUploadFileToStorage.mockResolvedValue({
      assetId: 'a-1',
      assetUrl: 'https://cdn/img.png',
    })

    const restore = stubImageGlobal()
    const onContentUploaded = vi.fn()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      onContentUploaded,
      lessonId: () => 77,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    expect(mockUploadFile).toHaveBeenCalledOnce()
    const formData = mockUploadFile.mock.calls[0][0] as FormData
    expect(formData.get('lesson_id')).toBe('77')
    expect(onContentUploaded).toHaveBeenCalledWith(42)

    restore()
  })

  // ── Test 7: dual-write fail — НЕ блокує (asset уже на дошці) ────────────

  it('dual-write fail після успішного upload — asset уже на дошці', async () => {
    mockUploadFileToStorage.mockResolvedValue({
      assetId: 'a-ok',
      assetUrl: 'https://cdn/ok.png',
    })
    mockUploadFile.mockRejectedValue(new Error('DB error'))

    const restore = stubImageGlobal()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      lessonId: () => 10,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    expect(onAssetAdd).toHaveBeenCalledOnce()
    expect(clipboard.uploadError.value).toBeNull()

    restore()
  })

  // ── Test 8: text paste → sticky note (без змін) ─────────────────────────

  it('text paste створює sticky note', async () => {
    const clipboard = createClipboard()
    const event = makeTextClipboardEvent('Hello Winterboard!')

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).toHaveBeenCalledOnce()
    const sticky = store.addStickyNote.mock.calls[0][0] as WBAsset
    expect(sticky.type).toBe('sticky')
    expect(sticky.text).toBe('Hello Winterboard!')
  })

  // ── Test 9: paste у editable — ігнор ─────────────────────────────────────

  it('paste в input — НЕ робить нічого', async () => {
    const clipboard = createClipboard()
    const input = document.createElement('input')
    const event = makeTextClipboardEvent('text', input)

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(mockUploadFileToStorage).not.toHaveBeenCalled()
  })

  // ── Test 10: internal copy/paste (без змін) ──────────────────────────────

  it('internal copy/paste дублює об\'єкти з offset', () => {
    const stroke1 = makeStroke('s-1')
    const asset1 = makeAsset('a-1')

    store = createMockStore({
      selectedIds: ['s-1', 'a-1'],
      currentPage: {
        id: 'page-1',
        name: 'Page 1',
        strokes: [stroke1],
        assets: [asset1],
        background: 'white',
      },
    })

    const clipboard = createClipboard()
    clipboard.copySelected()
    expect(clipboard.internalClipboard.value).not.toBeNull()

    clipboard.pasteInternal()
    // pasteInternal now uses batch API (single addStrokesBatch/addAssetsBatch
    // call per kind) to produce one mutation + one op instead of N
    expect(store.addStrokesBatch).toHaveBeenCalledOnce()
    expect(store.addAssetsBatch).toHaveBeenCalledOnce()
    const pastedAssets = store.addAssetsBatch.mock.calls[0][0] as WBAsset[]
    expect(pastedAssets).toHaveLength(1)
    const newAsset = pastedAssets[0]
    expect(newAsset.id).not.toBe('a-1')
    // OFFSET = 40 у pasteInternal
    expect(newAsset.x).toBe(asset1.x + 40)
  })

  // ── Test 11: cut = copy + delete ─────────────────────────────────────────

  it('cutSelected копіює та видаляє', () => {
    const stroke1 = makeStroke('s-1')
    const asset1 = makeAsset('a-1')

    store = createMockStore({
      selectedIds: ['s-1', 'a-1'],
      currentPage: {
        id: 'page-1',
        name: 'Page 1',
        strokes: [stroke1],
        assets: [asset1],
        background: 'white',
      },
    })

    const clipboard = createClipboard()
    clipboard.cutSelected()

    expect(clipboard.internalClipboard.value).not.toBeNull()
    expect(store.deleteSelected).toHaveBeenCalledOnce()
  })

  // ── Test: quota з details → UX message з X/Y MB ──────────────────────────

  it('quota_exceeded з details (storage MB) — toast показує X/Y MB', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('quota_exceeded', 'Storage exceeded', {
        current_bytes: 50 * 1024 * 1024,
        limit_bytes: 100 * 1024 * 1024,
      }),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast![0]).toContain('50.0/100.0 MB')

    restore()
  })

  it('quota_exceeded з details (asset count) — toast показує X/Y assets', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('quota_exceeded', 'Asset count exceeded', {
        current: 50,
        limit: 50,
      }),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast![0]).toContain('50/50')
    expect(errorToast![0]).toMatch(/asset/i)

    restore()
  })

  // ── Test: hard stop при quota — рештa pending скасовуються ────────────────

  it('quota в одному з batch — решта pending uploads скасовуються', async () => {
    // Сценарій: 6 файлів, перший fail з quota → batchController.abort() →
    // pending у waiting черзі semaphore відразу cancellaться; активні retry
    // (їх немає бо quota не retry) теж пропускають.
    let callCount = 0
    mockUploadFileToStorage.mockImplementation(async (_sid, _file, _onProgress, signal) => {
      callCount++
      const myIndex = callCount
      // Невелика затримка щоб decentralized abort встиг спрацювати
      await new Promise((r) => setTimeout(r, 5))
      if (signal?.aborted) {
        throw new WBUploadError('cancelled', 'Aborted')
      }
      if (myIndex === 1) {
        throw new WBUploadError('quota_exceeded', 'Quota exceeded', {
          current_bytes: 100,
          limit_bytes: 100,
        })
      }
      return { assetId: `a-${myIndex}`, assetUrl: `https://cdn/${myIndex}.png` }
    })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent(6))
    await new Promise((r) => setTimeout(r, 200))

    // Має бути ОДИН error toast (від першого файлу), решта silent skip
    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(1)
    expect(errorToasts[0][0]).toContain('quota')

    // Жоден asset не доданий (перший fail, решта cancelled)
    expect(onAssetAdd).not.toHaveBeenCalled()

    restore()
  })

  // ── Test: singleton quota toast при race ─────────────────────────────────

  it('3 паралельні файли всі отримують quota — лише ОДИН error toast', async () => {
    // Race: усі 3 паралельні uploads хитнули 429 quota майже одночасно (до
    // того як abort долетів). batch.quotaToastShown гарантує singleton toast.
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('quota_exceeded', 'Quota exceeded', {
        current_bytes: 100,
        limit_bytes: 100,
      }),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent(3))
    await new Promise((r) => setTimeout(r, 100))

    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(1) // SINGLETON, не 3
    expect(errorToasts[0][0]).toContain('quota')

    restore()
  })

  // ── Test: cancelled — silent skip без toast ──────────────────────────────

  it('upload з кодом cancelled — silent skip без error toast', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('cancelled', 'Aborted by batch'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(0) // НЕ показуємо toast — ініціатор abort вже показав

    restore()
  })

  // ── Test: unknown_429 — toast БЕЗ retry ──────────────────────────────────

  it('upload з кодом unknown_429 — toast БЕЗ retry (safe default)', async () => {
    mockUploadFileToStorage.mockRejectedValue(
      new WBUploadError('unknown_429', 'Server rejected (429)', {
        detail: 'Custom server message',
      }),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast![0]).toContain('Custom server message')
    expect(errorToast![2]?.action).toBeUndefined() // НЕ retry button

    restore()
  })

  // ── Test: hard cap paste — >50 images → warning, НЕ upload ───────────────

  it('paste >50 images — hard reject з warning toast, БЕЗ upload', async () => {
    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    // Створюємо clipboard event з 51 файлом
    const event = makeImageClipboardEvent(51)

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(mockUploadFileToStorage).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    const warningToast = mockShowToast.mock.calls.find((c) => c[1] === 'warning')
    expect(warningToast).toBeDefined()
    // Текст містить кількість файлів і ліміт
    expect(warningToast![0]).toMatch(/51|tooMany/)

    restore()
  })

  // ── Test 12: no session → toast warning, НЕ upload ───────────────────────

  it('paste без активної сесії — toast warning, НЕ upload', async () => {
    const restore = stubImageGlobal()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => null,
      canvasCenter: () => ({ x: 0, y: 0 }),
      onAssetAdd,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(mockUploadFileToStorage).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith('No active session', 'warning')

    restore()
  })
})
