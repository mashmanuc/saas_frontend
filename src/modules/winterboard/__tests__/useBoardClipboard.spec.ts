// WB: Unit tests for useBoardClipboard composable
// Ref: TASK_BOARD_PHASE_1a_2.md §8 — unified clipboard handler

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import type { WBAsset, WBStroke, WBPoint } from '../types/winterboard'

// ─── Mock useImageUpload exports ─────────────────────────────────────────────

vi.mock('../composables/useImageUpload', () => ({
  validateFile: vi.fn(() => ({ valid: true })),
  fileToDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')),
  uploadFileToStorage: vi.fn(() => Promise.resolve({ assetId: 'cdn-1', assetUrl: 'https://cdn/img.png' })),
}))

// ─── Mock learningContentApi ────────────────────────────────────────────────

const mockUploadFile = vi.fn().mockResolvedValue({ id: 42, content_item_id: 42 })

vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  },
}))

// ─── Mock useToast ──────────────────────────────────────────────────────────

const mockShowToast = vi.fn()

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
    updateAsset: vi.fn(),
    deleteStroke: vi.fn(),
    deleteAsset: vi.fn(),
    deleteSelected: vi.fn(),
    ...overrides,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeImageClipboardEvent(): ClipboardEvent {
  const file = new File(['pixels'], 'screenshot.png', { type: 'image/png' })

  const item = {
    kind: 'file' as const,
    type: 'image/png',
    getAsFile: () => file,
    getAsString: vi.fn(),
  }

  const clipboardData = {
    items: [item] as unknown as DataTransferItemList,
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
    src: 'data:image/png;base64,test',
    x: 100,
    y: 200,
    w: 300,
    h: 150,
    rotation: 0,
  }
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
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function createClipboard(storeOverrides?: Record<string, unknown>) {
    if (storeOverrides) {
      store = createMockStore(storeOverrides)
    }
    // Call outside component lifecycle — manually manage listeners
    const clipboard = useBoardClipboard({
      store: store as any,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
    })
    return clipboard
  }

  // ── Test 1: Image paste creates asset ─────────────────────────────────

  it('test_image_paste_creates_asset', async () => {
    // Use real timers for this async test — fake timers break Image mock
    vi.useRealTimers()

    const clipboard = createClipboard()
    const event = makeImageClipboardEvent()

    // Mock Image constructor for dimensions — trigger onload synchronously via microtask
    const origImage = globalThis.Image
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 800
      naturalHeight = 600
      set src(_: string) {
        // Use queueMicrotask for immediate async resolution
        queueMicrotask(() => this.onload?.())
      }
    } as any

    await clipboard.handlePaste(event)

    // Allow microtasks + upload promise to settle
    await new Promise((r) => setTimeout(r, 50))

    expect(onAssetAdd).toHaveBeenCalledOnce()
    const addedAsset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(addedAsset.type).toBe('image')
    expect(addedAsset.src).toBe('data:image/png;base64,AAAA')
    // Should be scaled down (max 300)
    expect(addedAsset.w).toBeLessThanOrEqual(300)
    expect(addedAsset.h).toBeLessThanOrEqual(300)

    globalThis.Image = origImage
  })

  // ── Test 2: Text paste creates sticky note ────────────────────────────

  it('test_text_paste_creates_sticky_note', async () => {
    const clipboard = createClipboard()
    const event = makeTextClipboardEvent('Hello Winterboard!')

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).toHaveBeenCalledOnce()
    const sticky = store.addStickyNote.mock.calls[0][0] as WBAsset
    expect(sticky.type).toBe('sticky')
    expect(sticky.text).toBe('Hello Winterboard!')
    expect(sticky.bgColor).toBeDefined()
    expect(sticky.fontSize).toBeDefined()
  })

  // ── Test 3: Paste in editable field is ignored ────────────────────────

  it('test_paste_in_editable_field_ignored', async () => {
    const clipboard = createClipboard()
    const input = document.createElement('input')
    const event = makeTextClipboardEvent('some text', input)

    await clipboard.handlePaste(event)

    expect(store.addStickyNote).not.toHaveBeenCalled()
    expect(onAssetAdd).not.toHaveBeenCalled()
  })

  // ── Test 4: Internal copy/paste ───────────────────────────────────────

  it('test_internal_copy_paste', () => {
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

    // Copy
    clipboard.copySelected()
    expect(clipboard.internalClipboard.value).not.toBeNull()
    expect(clipboard.internalClipboard.value!.strokes).toHaveLength(1)
    expect(clipboard.internalClipboard.value!.assets).toHaveLength(1)

    // Paste
    clipboard.pasteInternal()

    // New stroke added with offset
    expect(store.addStroke).toHaveBeenCalledOnce()
    const newStroke = store.addStroke.mock.calls[0][0] as WBStroke
    expect(newStroke.id).not.toBe('s-1')
    expect(newStroke.points[0].x).toBe(stroke1.points[0].x + 20)
    expect(newStroke.points[0].y).toBe(stroke1.points[0].y + 20)

    // New asset added with offset
    expect(onAssetAdd).toHaveBeenCalledOnce()
    const newAsset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(newAsset.id).not.toBe('a-1')
    expect(newAsset.x).toBe(asset1.x + 20)
    expect(newAsset.y).toBe(asset1.y + 20)
  })

  // ── Test 5: Cut copies and deletes ────────────────────────────────────

  it('test_cut_copies_and_deletes', () => {
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

    // Internal clipboard should be filled
    expect(clipboard.internalClipboard.value).not.toBeNull()
    expect(clipboard.internalClipboard.value!.strokes).toHaveLength(1)
    expect(clipboard.internalClipboard.value!.assets).toHaveLength(1)

    // deleteSelected should have been called
    expect(store.deleteSelected).toHaveBeenCalledOnce()
  })

  // ── Test 6: Image paste triggers dual-write upload ──────────────────────

  it('test_image_paste_triggers_dual_write_upload', async () => {
    vi.useRealTimers()

    const onContentUploaded = vi.fn()
    const clipboard = useBoardClipboard({
      store: store as any,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      onContentUploaded,
      lessonId: () => 77,
      groupId: () => null,
    })

    const origImage = globalThis.Image
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 200
      naturalHeight = 100
      set src(_: string) { queueMicrotask(() => this.onload?.()) }
    } as any

    const event = makeImageClipboardEvent()
    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 100))

    // learningContentApi.uploadFile should have been called with FormData containing lesson_id
    expect(mockUploadFile).toHaveBeenCalledOnce()
    const formData = mockUploadFile.mock.calls[0][0] as FormData
    expect(formData.get('lesson_id')).toBe('77')

    // onContentUploaded should have been called with the content_item_id
    expect(onContentUploaded).toHaveBeenCalledWith(42)

    globalThis.Image = origImage
  })

  // ── Test 7: Dual-write failure does not break paste ─────────────────────

  it('test_dual_write_failure_does_not_break_paste', async () => {
    vi.useRealTimers()
    mockUploadFile.mockRejectedValue(new Error('DB error'))

    const clipboard = useBoardClipboard({
      store: store as any,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
      lessonId: () => 10,
    })

    const origImage = globalThis.Image
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 200
      naturalHeight = 100
      set src(_: string) { queueMicrotask(() => this.onload?.()) }
    } as any

    const event = makeImageClipboardEvent()
    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 100))

    // Asset should still be on the board (onAssetAdd was called)
    expect(onAssetAdd).toHaveBeenCalledOnce()
    // Upload error should be null (dual-write failure is non-critical)
    expect(clipboard.uploadError.value).toBeNull()

    globalThis.Image = origImage
  })

  // ── Test 8: Upload error sets uploadError ref ───────────────────────────

  it('test_upload_error_sets_uploadError_ref', async () => {
    vi.useRealTimers()

    // Make the CDN upload fail
    const { uploadFileToStorage } = await import('../composables/useImageUpload')
    ;(uploadFileToStorage as any).mockRejectedValueOnce(new Error('CDN down'))

    const clipboard = useBoardClipboard({
      store: store as any,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
    })

    const origImage = globalThis.Image
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 200
      naturalHeight = 100
      set src(_: string) { queueMicrotask(() => this.onload?.()) }
    } as any

    const event = makeImageClipboardEvent()
    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 100))

    expect(clipboard.uploadError.value).not.toBeNull()
    expect(clipboard.uploadError.value).toContain('Upload failed')

    globalThis.Image = origImage
  })

  // ── Test 9: Upload success clears error ─────────────────────────────────

  it('test_upload_success_clears_error', async () => {
    vi.useRealTimers()

    const clipboard = useBoardClipboard({
      store: store as any,
      sessionId: () => 'session-1',
      canvasCenter: () => ({ x: 960, y: 540 }),
      onAssetAdd,
    })

    // Set a prior error
    clipboard.uploadError.value = 'Previous error'

    const origImage = globalThis.Image
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 200
      naturalHeight = 100
      set src(_: string) { queueMicrotask(() => this.onload?.()) }
    } as any

    const event = makeImageClipboardEvent()
    await clipboard.handlePaste(event)
    await new Promise((r) => setTimeout(r, 100))

    // After successful upload, error should be cleared
    expect(clipboard.uploadError.value).toBeNull()

    globalThis.Image = origImage
  })
})
