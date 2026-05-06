// WB: Unit tests for useBoardClipboard composable — OPTIMISTIC paste flow
// Ref: TASK_BOARD_PHASE_1a_2.md §8, plan lazy-kindling-simon.md
//      P0 UX fix: instant image paste (2026-04-28)
//
// Інваріанти що тестуємо:
//   1. paste → asset_add IMMEDIATELY з blob: URL + status='uploading'
//   2. background upload OK → asset_update з final CDN URL + status='ready'
//   3. blob URL revoked після успішного upload
//   4. presign fail → asset НЕ додається, toast Retry
//   5. background upload fail → asset з status='error' + toast Retry
//   6. INV-14 op_id stable: asset.id однаковий між asset_add і asset_update

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { WBUploadError } from '../composables/useImageUpload'
import { _resetQueue } from '../composables/useUploadQueue'
import type { WBAsset, WBStroke, WBPoint } from '../types/winterboard'

// ─── Mock useImageUpload ─────────────────────────────────────────────────────

const mockPresignOnly = vi.fn()
const mockUploadAndConfirm = vi.fn()

vi.mock('../composables/useImageUpload', async () => {
  const actual = await vi.importActual<typeof import('../composables/useImageUpload')>(
    '../composables/useImageUpload',
  )
  return {
    ...actual,
    validateFile: vi.fn(() => ({ valid: true })),
    presignOnly: (...args: unknown[]) => mockPresignOnly(...args),
    uploadAndConfirm: (...args: unknown[]) => mockUploadAndConfirm(...args),
  }
})

// ─── Mock learningContentApi ────────────────────────────────────────────────

const mockUploadFile = vi.fn().mockResolvedValue({ id: 42, content_item_id: 42 })

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  },
}))

// ─── Mock useToast ──────────────────────────────────────────────────────────

const mockShowToast = vi.fn().mockReturnValue(1)

vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    toasts: { value: [] },
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

// ─── Mock URL.createObjectURL / revokeObjectURL ─────────────────────────────

let _blobUrlCounter = 0
const _activeBlobUrls = new Set<string>()

beforeEach(() => {
  _blobUrlCounter = 0
  _activeBlobUrls.clear()
  globalThis.URL.createObjectURL = vi.fn((_blob: Blob) => {
    const url = `blob:test-${++_blobUrlCounter}`
    _activeBlobUrls.add(url)
    return url
  })
  globalThis.URL.revokeObjectURL = vi.fn((url: string) => {
    _activeBlobUrls.delete(url)
  })
})

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
    updateAsset: vi.fn((a: WBAsset) => {
      const i = assets.findIndex((x) => x.id === a.id)
      if (i >= 0) assets[i] = a
    }),
    addStrokesBatch: vi.fn((arr: WBStroke[]) => { strokes.push(...arr) }),
    addAssetsBatch: vi.fn((arr: WBAsset[]) => { assets.push(...arr) }),
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
 * Stub Image для preload final URL (jsdom не вантажить URLs).
 * Resolve миттєво через microtask — синхронні await спрацьовують одразу.
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
  let onAssetUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createMockStore()
    onAssetAdd = vi.fn()
    onAssetUpdate = vi.fn()
    mockUploadFile.mockClear()
    mockUploadFile.mockResolvedValue({ id: 42, content_item_id: 42 })
    mockShowToast.mockClear()
    mockPresignOnly.mockReset()
    mockUploadAndConfirm.mockReset()
    _resetQueue() // semaphore — module-level singleton
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
      onAssetUpdate,
    })
  }

  // ── Test 1: optimistic add — asset з'являється з blob URL ДО completion ──

  it('paste image → asset_add IMMEDIATELY з blob URL + status=uploading', async () => {
    // Хвиля 1: presign швидко
    mockPresignOnly.mockResolvedValue({
      assetId: 'asset-be-1',
      assetUrl: 'https://cdn/final-1.png',
      isLocal: false,
      uploadUrl: 'https://s3/upload-1',
    })
    // Хвиля 2: upload бере час — імітуємо через манульний resolve
    let _resolveUpload: (val: { assetUrl: string }) => void = () => {}
    mockUploadAndConfirm.mockImplementation(() => new Promise((resolve) => {
      _resolveUpload = resolve
    }))

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    await clipboard.handlePaste(event)
    // Дочекатись presign + emit asset_add. Upload ще НЕ resolved.
    await new Promise((r) => setTimeout(r, 50))

    // Інваріант: asset_add емітований ОДРАЗУ після presign
    expect(onAssetAdd).toHaveBeenCalledOnce()
    const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(placeholder.id).toBe('asset-be-1')
    expect(placeholder.src).toMatch(/^blob:/) // blob URL — instant render
    expect(placeholder.status).toBe('uploading')

    // Інваріант: asset_update НЕ викликався (upload pending)
    expect(onAssetUpdate).not.toHaveBeenCalled()

    // Завершуємо upload
    _resolveUpload({ assetUrl: 'https://cdn/final-1.png' })
    await new Promise((r) => setTimeout(r, 100))

    // Тепер asset_update emit-ить final URL + status='ready'
    expect(onAssetUpdate).toHaveBeenCalled()
    const finalAsset = onAssetUpdate.mock.calls[0][0] as WBAsset
    expect(finalAsset.id).toBe('asset-be-1') // INV-14: той самий ID
    expect(finalAsset.src).toBe('https://cdn/final-1.png')
    expect(finalAsset.src.startsWith('blob:')).toBe(false)
    expect(finalAsset.status).toBe('ready')

    restore()
  })

  // ── Test 2: blob URL revoked після успішного upload ──────────────────────

  it('successful upload → revokeObjectURL викликано', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'a-1',
      assetUrl: 'https://cdn/1.png',
      isLocal: false,
      uploadUrl: 'https://s3/1',
    })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/1.png' })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()
    expect(_activeBlobUrls.size).toBe(0) // всі blob URLs звільнені

    restore()
  })

  // ── Test 3: presign fail → asset НЕ додається ────────────────────────────

  it('presign fail (rate_limited) — asset НЕ додається + toast Retry', async () => {
    mockPresignOnly.mockRejectedValue(
      new WBUploadError('rate_limited', 'Rate limit reached'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled() // інваріант — нічого на дошці
    expect(onAssetUpdate).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalled()
    const toastCall = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(toastCall).toBeDefined()
    expect(toastCall![2]?.action?.label).toBe('Retry')

    restore()
  })

  // ── Test 4: presign quota_exceeded → toast БЕЗ retry ────────────────────

  it('presign quota_exceeded — toast про квоту БЕЗ retry button', async () => {
    mockPresignOnly.mockRejectedValue(
      new WBUploadError('quota_exceeded', 'Asset or storage quota exceeded'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast![0]).toContain('quota')
    expect(errorToast![2]?.action).toBeUndefined() // НЕ retry

    restore()
  })

  // ── Test 5: background upload fail → status='error' + toast Retry ───────

  it('background upload fail — asset помічений status=error, toast Retry', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'a-fail',
      assetUrl: 'https://cdn/fail.png',
      isLocal: false,
      uploadUrl: 'https://s3/fail',
    })
    mockUploadAndConfirm.mockRejectedValue(
      new WBUploadError('upload_failed', 'S3 PUT failed'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    // asset_add емітований (presign OK)
    expect(onAssetAdd).toHaveBeenCalledOnce()
    const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(placeholder.status).toBe('uploading')

    // asset_update емітований з status='error'
    expect(onAssetUpdate).toHaveBeenCalled()
    const errorAsset = onAssetUpdate.mock.calls[onAssetUpdate.mock.calls.length - 1][0] as WBAsset
    expect(errorAsset.id).toBe('a-fail') // той самий ID
    expect(errorAsset.status).toBe('error')
    expect(errorAsset.errorMessage).toBeTruthy()

    // Toast Retry показано
    const errorToast = mockShowToast.mock.calls.find((c) => c[1] === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast![2]?.action?.label).toBe('Retry')

    // Blob URL звільнений
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()

    restore()
  })

  // ── Test 6: multi-paste — кожен файл свій upload з offset за index ──────

  it('paste 3 файли — 3 asset_add, x/y зміщені за порядком', async () => {
    mockPresignOnly
      .mockResolvedValueOnce({ assetId: 'a-0', assetUrl: 'https://cdn/0.png', isLocal: false, uploadUrl: 'u' })
      .mockResolvedValueOnce({ assetId: 'a-1', assetUrl: 'https://cdn/1.png', isLocal: false, uploadUrl: 'u' })
      .mockResolvedValueOnce({ assetId: 'a-2', assetUrl: 'https://cdn/2.png', isLocal: false, uploadUrl: 'u' })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/x.png' })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent(3))
    await new Promise((r) => setTimeout(r, 200))

    expect(mockPresignOnly).toHaveBeenCalledTimes(3)
    expect(onAssetAdd).toHaveBeenCalledTimes(3)

    const assets = onAssetAdd.mock.calls.map((c) => c[0] as WBAsset)
    const a0 = assets.find((a) => a.id === 'a-0')!
    const a1 = assets.find((a) => a.id === 'a-1')!
    const a2 = assets.find((a) => a.id === 'a-2')!

    // Offset = index * 20 (порядок paste, не completion)
    expect(a1.x - a0.x).toBe(20)
    expect(a2.x - a0.x).toBe(40)

    restore()
  })

  // ── Test 7: dual-write call (lesson_id) ──────────────────────────────────

  it('paste з lessonId — викликає learningContentApi.uploadFile з lesson_id', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'a-1', assetUrl: 'https://cdn/img.png', isLocal: false, uploadUrl: 'u',
    })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/img.png' })

    const restore = stubImageGlobal()
    const onContentUploaded = vi.fn()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      onAssetUpdate,
      onContentUploaded,
      lessonId: () => 77,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 150))

    expect(mockUploadFile).toHaveBeenCalledOnce()
    const formData = mockUploadFile.mock.calls[0][0] as FormData
    expect(formData.get('lesson_id')).toBe('77')
    expect(onContentUploaded).toHaveBeenCalledWith(42)

    restore()
  })

  // ── Test 8: dual-write fail — НЕ блокує (asset уже на дошці) ────────────

  it('dual-write fail після успішного upload — asset уже на дошці', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'a-ok', assetUrl: 'https://cdn/ok.png', isLocal: false, uploadUrl: 'u',
    })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/ok.png' })
    mockUploadFile.mockRejectedValue(new Error('DB error'))

    const restore = stubImageGlobal()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      onAssetUpdate,
      lessonId: () => 10,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 150))

    expect(onAssetAdd).toHaveBeenCalledOnce()
    expect(onAssetUpdate).toHaveBeenCalled()
    // Не error toast — dual-write fail non-critical
    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(0)

    restore()
  })

  // ── Test 9: text paste → sticky note (без змін) ─────────────────────────

  it('text paste створює sticky note', async () => {
    const clipboard = createClipboard()
    const event = makeTextClipboardEvent('Hello Winterboard!')

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).toHaveBeenCalledOnce()
    const sticky = store.addStickyNote.mock.calls[0][0] as WBAsset
    expect(sticky.type).toBe('sticky')
    expect(sticky.text).toBe('Hello Winterboard!')
  })

  // ── Test 10: paste у editable — ігнор ────────────────────────────────────

  it('paste в input — НЕ робить нічого', async () => {
    const clipboard = createClipboard()
    const input = document.createElement('input')
    const event = makeTextClipboardEvent('text', input)

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(mockPresignOnly).not.toHaveBeenCalled()
  })

  // ── Test 11: internal copy/paste (без змін) ──────────────────────────────

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
    expect(store.addStrokesBatch).toHaveBeenCalledOnce()
    expect(store.addAssetsBatch).toHaveBeenCalledOnce()
    const pastedAssets = store.addAssetsBatch.mock.calls[0][0] as WBAsset[]
    expect(pastedAssets).toHaveLength(1)
    const newAsset = pastedAssets[0]
    expect(newAsset.id).not.toBe('a-1')
    expect(newAsset.x).toBe(asset1.x + 40)
  })

  // ── Test 12: cut = copy + delete ─────────────────────────────────────────

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

  // ── Test 13: presign quota з details (storage MB) ────────────────────────

  it('quota_exceeded з details (storage MB) — toast показує X/Y MB', async () => {
    mockPresignOnly.mockRejectedValue(
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
    mockPresignOnly.mockRejectedValue(
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

  // ── Test 14: presign quota → весь batch скасовується ─────────────────────

  it('quota в одному з batch — решта pending presigns скасовуються', async () => {
    let callCount = 0
    mockPresignOnly.mockImplementation(async (_sid, _file, signal) => {
      callCount++
      const myIndex = callCount
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
      return {
        assetId: `a-${myIndex}`,
        assetUrl: `https://cdn/${myIndex}.png`,
        isLocal: false,
        uploadUrl: 'u',
      }
    })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent(6))
    await new Promise((r) => setTimeout(r, 200))

    // ОДИН error toast (singleton при race)
    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(1)
    expect(errorToasts[0][0]).toContain('quota')

    restore()
  })

  // ── Test 15: singleton quota toast при race ──────────────────────────────

  it('3 паралельні файли всі отримують quota — лише ОДИН error toast', async () => {
    mockPresignOnly.mockRejectedValue(
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
    expect(errorToasts).toHaveLength(1)
    expect(errorToasts[0][0]).toContain('quota')

    restore()
  })

  // ── Test 16: cancelled з presign — silent skip ───────────────────────────

  it('presign з кодом cancelled — silent skip без error toast', async () => {
    mockPresignOnly.mockRejectedValue(
      new WBUploadError('cancelled', 'Aborted'),
    )

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).not.toHaveBeenCalled()
    const errorToasts = mockShowToast.mock.calls.filter((c) => c[1] === 'error')
    expect(errorToasts).toHaveLength(0)

    restore()
  })

  // ── Test 17: unknown_429 з presign — toast БЕЗ retry ─────────────────────

  it('presign з unknown_429 — toast БЕЗ retry (safe default)', async () => {
    mockPresignOnly.mockRejectedValue(
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
    expect(errorToast![2]?.action).toBeUndefined()

    restore()
  })

  // ── Test 18: hard cap >50 → reject ───────────────────────────────────────

  it('paste >50 images — hard reject з warning toast', async () => {
    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    const event = makeImageClipboardEvent(51)

    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 50))

    expect(mockPresignOnly).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    const warningToast = mockShowToast.mock.calls.find((c) => c[1] === 'warning')
    expect(warningToast).toBeDefined()
    expect(warningToast![0]).toMatch(/51|tooMany/)

    restore()
  })

  // ── Test 19: no session → toast warning ──────────────────────────────────

  it('paste без активної сесії — toast warning, НЕ presign', async () => {
    const restore = stubImageGlobal()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => null,
      canvasCenter: () => ({ x: 0, y: 0 }),
      onAssetAdd,
      onAssetUpdate,
    })

    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(mockPresignOnly).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith('No active session', 'warning')

    restore()
  })

  // ── Test 20: INV-14 — asset.id stable між asset_add і asset_update ───────

  it('INV-14: asset.id той самий для asset_add і asset_update', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'stable-id-1',
      assetUrl: 'https://cdn/x.png',
      isLocal: false,
      uploadUrl: 'u',
    })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/x.png' })

    const restore = stubImageGlobal()
    const clipboard = createClipboard()
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    const addedId = (onAssetAdd.mock.calls[0][0] as WBAsset).id
    const updatedId = (onAssetUpdate.mock.calls[0][0] as WBAsset).id
    expect(addedId).toBe('stable-id-1')
    expect(updatedId).toBe('stable-id-1')
    expect(addedId).toBe(updatedId)

    restore()
  })

  // ── Test 21: onAssetUpdate fallback → store.updateAsset ──────────────────

  it('без onAssetUpdate option — fallback на store.updateAsset', async () => {
    mockPresignOnly.mockResolvedValue({
      assetId: 'fallback-1',
      assetUrl: 'https://cdn/fb.png',
      isLocal: false,
      uploadUrl: 'u',
    })
    mockUploadAndConfirm.mockResolvedValue({ assetUrl: 'https://cdn/fb.png' })

    const restore = stubImageGlobal()
    const clipboard = useBoardClipboard({
      store: store as never,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 0, y: 0 }),
      onAssetAdd,
      // onAssetUpdate NOT passed → fallback на store.updateAsset
    })
    await clipboard.handlePaste(makeImageClipboardEvent())
    await new Promise((r) => setTimeout(r, 100))

    expect(store.updateAsset).toHaveBeenCalled()
    const updated = store.updateAsset.mock.calls[store.updateAsset.mock.calls.length - 1][0] as WBAsset
    expect(updated.id).toBe('fallback-1')
    expect(updated.status).toBe('ready')

    restore()
  })

  // ─── Image dimension preload (Bug fix 2026-05-06: squish-then-jump) ─────
  //
  // Before fix: placeholder used hardcoded { w: 300, h: 300 } → landscape /
  // portrait images squished into squares until upload completed and final
  // CDN URL preloaded. After fix: blob URL preload reads naturalWidth /
  // naturalHeight у parallel з presign → placeholder з'являється з
  // correct ratio з першого render.

  describe('image dimension preload — visual jank fix', () => {
    function setupPresignAndUpload(assetUrl = 'https://cdn/final.png') {
      mockPresignOnly.mockResolvedValue({
        assetId: 'asset-dim-1',
        assetUrl,
        isLocal: false,
        uploadUrl: 'https://s3/dim-1',
      })
      mockUploadAndConfirm.mockResolvedValue({ assetUrl })
    }

    it('landscape image (1920×1080) → placeholder з correct ratio (300×169)', async () => {
      setupPresignAndUpload()
      const restore = stubImageGlobal(1920, 1080)
      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 50))

      expect(onAssetAdd).toHaveBeenCalledOnce()
      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      expect(placeholder.w).toBe(300)
      expect(placeholder.h).toBe(169) // 1080/1920*300 ≈ 168.75 → 169
      expect(placeholder.src).toMatch(/^blob:/)
      expect(placeholder.status).toBe('uploading')
      restore()
    })

    it('portrait image (600×1200) → placeholder 150×300', async () => {
      setupPresignAndUpload()
      const restore = stubImageGlobal(600, 1200)
      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 50))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      expect(placeholder.w).toBe(150)
      expect(placeholder.h).toBe(300)
      restore()
    })

    it('square image (800×800) → placeholder 300×300', async () => {
      setupPresignAndUpload()
      const restore = stubImageGlobal(800, 800)
      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 50))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      expect(placeholder.w).toBe(300)
      expect(placeholder.h).toBe(300)
      restore()
    })

    it('tiny image (50×50) → placeholder NOT upscaled (stays 50×50)', async () => {
      setupPresignAndUpload()
      const restore = stubImageGlobal(50, 50)
      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 50))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      expect(placeholder.w).toBe(50)
      expect(placeholder.h).toBe(50)
      restore()
    })

    it('blob preload error → 300×300 fallback (safe default)', async () => {
      setupPresignAndUpload()
      // Mock Image yet that fires onerror instead of onload.
      const orig = globalThis.Image
      globalThis.Image = class FailingImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 0
        naturalHeight = 0
        set src(_v: string) { queueMicrotask(() => this.onerror?.()) }
      } as unknown as typeof Image

      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 50))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      expect(placeholder.w).toBe(300)
      expect(placeholder.h).toBe(300)

      globalThis.Image = orig
    })

    it('CDN dims === placeholder dims → final asset_update preserves w/h без change', async () => {
      // Placeholder + CDN both 1920×1080 → scale to 300×169 once. asset_update
      // має emit src+status зміну, але w/h НЕ повинні змінитись від placeholder.
      setupPresignAndUpload()
      const restore = stubImageGlobal(1920, 1080)
      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 100))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      const finalAsset = onAssetUpdate.mock.calls[0][0] as WBAsset

      // src + status оновились (replay invariant)
      expect(finalAsset.src).toBe('https://cdn/final.png')
      expect(finalAsset.status).toBe('ready')
      // dims preserved — exactly same primitive values як у placeholder
      expect(finalAsset.w).toBe(placeholder.w)
      expect(finalAsset.h).toBe(placeholder.h)
      expect(finalAsset.w).toBe(300)
      expect(finalAsset.h).toBe(169)
      restore()
    })

    it('CDN dims ≠ placeholder dims (BE re-encode) → asset_update передає нові w/h', async () => {
      // Edge case: BE може re-encode і повернути іншу resolution. Тоді
      // asset_update мусить нести нові w/h (no shortcut).
      setupPresignAndUpload()
      // First Image instance (blob preload) returns 1920×1080;
      // second (CDN preload) returns 1280×720 → 300×169 again — same scaled.
      // Щоб симулювати РІЗНІ scaled dims робимо blob 800×600 → 300×225,
      // CDN 400×400 → 300×300.
      let callCount = 0
      const orig = globalThis.Image
      globalThis.Image = class MockImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 0
        naturalHeight = 0
        set src(_v: string) {
          callCount++
          // call 1: blob preload (handleImagePaste) → 800×600
          // call 2: CDN preload (_backgroundUpload) → 400×400
          if (callCount === 1) {
            this.naturalWidth = 800
            this.naturalHeight = 600
          } else {
            this.naturalWidth = 400
            this.naturalHeight = 400
          }
          queueMicrotask(() => this.onload?.())
        }
      } as unknown as typeof Image

      const clipboard = createClipboard()
      await clipboard.handlePaste(makeImageClipboardEvent())
      await new Promise((r) => setTimeout(r, 100))

      const placeholder = onAssetAdd.mock.calls[0][0] as WBAsset
      const finalAsset = onAssetUpdate.mock.calls[0][0] as WBAsset

      expect(placeholder.w).toBe(300) // 800→300
      expect(placeholder.h).toBe(225) // 600→225
      expect(finalAsset.w).toBe(300) // 400→300 (square scale)
      expect(finalAsset.h).toBe(300)
      // dims actually CHANGED — final differs from placeholder
      expect(finalAsset.h).not.toBe(placeholder.h)

      globalThis.Image = orig
    })
  })
})
