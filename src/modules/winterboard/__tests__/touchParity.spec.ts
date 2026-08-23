// A10: Touch Parity — unit tests
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A10
// Coverage:
//   - useTouchGestures A10 extensions (pinch-object, rotate, hapticDouble, onObjectLongPress)
//   - boardStore A10 actions (resizeSelectedObject, rotateSelectedObject, clipboard, bringToFront, sendToBack)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import {
  useTouchGestures,
  getAdaptiveThresholds,
  type GestureCallbacks,
} from '../components/gestures/useTouchGestures'
import type { WBAsset } from '../types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: 'asset-1',
    type: 'image',
    src: '',
    x: 100, y: 100,
    w: 200, h: 150,
    rotation: 0,
    ...overrides,
  }
}

function makeStore() {
  const store = useWBStore()
  store.$patch({
    workspaceId: 'ws-test',
    pages: [{
      id: 'p1', name: 'Page 1',
      strokes: [],
      assets: [makeAsset({ id: 'asset-1' }), makeAsset({ id: 'asset-2', x: 300 })],
    }],
    currentPageIndex: 0,
    selectedIds: ['asset-1'],
  })
  return store
}

function makeContainer() {
  const el = document.createElement('div')
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  })
  document.body.appendChild(el)
  return el
}

function makePointerEvent(
  type: string,
  opts: Partial<PointerEventInit> & { pointerId?: number } = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 100,
    clientY: opts.clientY ?? 100,
    ...opts,
  })
}

// DIR-хвости-2 §3 (2026-08-24): «expected 200 to be 400» — це ПІКСЕЛІ
// resize, а не HTTP-коди: підозра ТЗ про «послаблення 400 на BE» знята
// виміром (boardStore.resizeSelectedObject, жодного запиту). Корінь п'яти
// падінь один: updateAsset став асинхронним (Layer B RAF-coalesce,
// assetUpdateBatcher.ts:75 — flush на наступному кадрі), а тести асертили
// синхронно. Жест-математика жива; тестам потрібен синхронний rAF.
// Батчер тримає module-scoped _rafHandles: «хвіст» rAF із СУСІДНЬОГО тесту
// блокує новий schedule (has(id) → лише buffer.set, без flush) і застосовує
// оновлення в чужий store. Тому перед кожним boardStore-тестом скасовуємо
// хвости явно.
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'

const _origRaf = globalThis.requestAnimationFrame
function syncRaf() {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }
}
function restoreRaf() {
  ;(globalThis as any).requestAnimationFrame = _origRaf
}

// ─── boardStore A10 actions ──────────────────────────────────────────────────

describe('boardStore — resizeSelectedObject', () => {
  beforeEach(() => { setActivePinia(createPinia()); cancelPendingUpdates(); syncRaf() })
  afterEach(restoreRaf)

  it('scales asset w and h by factor', () => {
    const store = makeStore()
    store.resizeSelectedObject('asset-1', 2, 2)
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    expect(asset.w).toBe(400)
    expect(asset.h).toBe(300)
  })

  it('clamps minimum size to 20x20', () => {
    const store = makeStore()
    store.resizeSelectedObject('asset-1', 0.001, 0.001)
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    expect(asset.w).toBe(20)
    expect(asset.h).toBe(20)
  })

  it('does nothing when asset is locked', () => {
    const store = makeStore()
    store.pages[0].assets[0].locked = true
    store.resizeSelectedObject('asset-1', 2, 2)
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    expect(asset.w).toBe(200) // unchanged
  })

  it('does nothing for unknown assetId', () => {
    const store = makeStore()
    expect(() => store.resizeSelectedObject('no-such-id', 2, 2)).not.toThrow()
  })
})

describe('boardStore — rotateSelectedObject', () => {
  beforeEach(() => { setActivePinia(createPinia()); cancelPendingUpdates(); syncRaf() })
  afterEach(restoreRaf)

  it('converts radians to degrees and applies rotation', () => {
    const store = makeStore()
    store.rotateSelectedObject('asset-1', Math.PI / 2)  // 90 degrees
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    expect(asset.rotation).toBeCloseTo(90, 1)
  })

  it('wraps rotation to 0-360 range', () => {
    const store = makeStore()
    // Patch initial rotation to 350 degrees
    store.$patch(s => { s.pages[0].assets[0].rotation = 350 })
    store.rotateSelectedObject('asset-1', Math.PI / 2)  // +90 deg = 440 → 80
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    expect(asset.rotation).toBeCloseTo(80, 1)
  })

  it('handles negative delta (counter-clockwise)', () => {
    const store = makeStore()
    store.$patch(s => { s.pages[0].assets[0].rotation = 10 })
    store.rotateSelectedObject('asset-1', -Math.PI / 4)  // -45 deg
    const asset = store.currentPage!.assets.find(a => a.id === 'asset-1')!
    // 10 - 45 = -35 → normalized to 325
    expect(asset.rotation).toBeCloseTo(325, 1)
  })
})

describe('boardStore — copySelectedToClipboard + pasteFromClipboard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('copies selected assets to clipboard', () => {
    const store = makeStore()
    store.copySelectedToClipboard()
    expect(store.clipboardAssets).toHaveLength(1)
    expect(store.clipboardAssets[0].id).toBe('asset-1')
  })

  it('clipboard is a shallow clone (not same reference)', () => {
    const store = makeStore()
    store.copySelectedToClipboard()
    expect(store.clipboardAssets[0]).not.toBe(store.currentPage!.assets[0])
  })

  it('paste creates new asset with offset and new id', () => {
    const store = makeStore()
    store.copySelectedToClipboard()
    const beforeCount = store.currentPage!.assets.length
    store.pasteFromClipboard()
    const page = store.currentPage!
    expect(page.assets.length).toBe(beforeCount + 1)
    const pasted = page.assets[page.assets.length - 1]
    expect(pasted.id).not.toBe('asset-1')
    expect(pasted.x).toBe(120)  // 100 + 20
    expect(pasted.y).toBe(120)  // 100 + 20
  })

  it('paste does nothing when clipboard is empty', () => {
    const store = makeStore()
    store.$patch({ clipboardAssets: [] })
    const beforeCount = store.currentPage!.assets.length
    store.pasteFromClipboard()
    expect(store.currentPage!.assets.length).toBe(beforeCount)
  })
})

describe('boardStore — bringToFront + sendToBack', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('bringToFront moves asset to last position', () => {
    const store = makeStore()
    store.bringToFront('asset-1')
    const assets = store.currentPage!.assets
    expect(assets[assets.length - 1].id).toBe('asset-1')
  })

  it('bringToFront does nothing if already at front', () => {
    const store = makeStore()
    store.bringToFront('asset-2')  // already last
    const assets = store.currentPage!.assets
    expect(assets[assets.length - 1].id).toBe('asset-2')
  })

  it('sendToBack moves asset to first position', () => {
    const store = makeStore()
    store.sendToBack('asset-2')
    expect(store.currentPage!.assets[0].id).toBe('asset-2')
  })

  it('sendToBack does nothing if already at back', () => {
    const store = makeStore()
    store.sendToBack('asset-1')  // already first
    expect(store.currentPage!.assets[0].id).toBe('asset-1')
  })
})

// ─── useTouchGestures A10 extensions ────────────────────────────────────────

describe('useTouchGestures — A10 pinch-object routing', () => {
  let el: HTMLElement

  beforeEach(() => {
    setActivePinia(createPinia())
    el = makeContainer()
  })

  afterEach(() => {
    el.remove()
    vi.restoreAllMocks()
  })

  it('routes to pinch-object when hasSelection returns true', () => {
    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onLongPress: vi.fn(), onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
    }
    const containerRef = ref(el)
    const { state, attach } = useTouchGestures(containerRef, callbacks, {
      hasSelection: () => true,
    })
    attach()

    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 250 }))

    expect(state.activeGesture.value).toBe('pinch-object')
  })

  it('routes to pinch (canvas) when hasSelection returns false', () => {
    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onLongPress: vi.fn(), onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
    }
    const containerRef = ref(el)
    const { state, attach } = useTouchGestures(containerRef, callbacks, {
      hasSelection: () => false,
    })
    attach()

    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 250 }))

    expect(state.activeGesture.value).toBe('pinch')
  })

  it('fires onObjectPinch callback when scaleDelta > 1% threshold', () => {
    const onObjectPinch = vi.fn()
    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onLongPress: vi.fn(), onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
      onObjectPinch,
    }
    const containerRef = ref(el)
    const { attach } = useTouchGestures(containerRef, callbacks, {
      hasSelection: () => true,
    })
    attach()

    // Place two fingers
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 }))
    // Move one finger significantly farther apart (spread = zoom in)
    el.dispatchEvent(makePointerEvent('pointermove', { pointerId: 2, clientX: 250, clientY: 100 }))

    expect(onObjectPinch).toHaveBeenCalled()
    const scale = onObjectPinch.mock.calls[0][0]
    expect(scale).toBeGreaterThan(1)
  })

  it('fires onObjectRotate when angle change exceeds threshold', () => {
    const onObjectRotate = vi.fn()
    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onLongPress: vi.fn(), onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
      onObjectRotate,
    }
    const containerRef = ref(el)
    const { attach } = useTouchGestures(containerRef, callbacks, {
      hasSelection: () => true,
    })
    attach()

    // Place two fingers horizontally
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 }))
    // Rotate: move finger 2 diagonally (large angle change)
    el.dispatchEvent(makePointerEvent('pointermove', { pointerId: 2, clientX: 180, clientY: 150 }))

    expect(onObjectRotate).toHaveBeenCalled()
  })
})

describe('useTouchGestures — A10 hapticDouble + onObjectLongPress', () => {
  let el: HTMLElement

  beforeEach(() => {
    setActivePinia(createPinia())
    el = makeContainer()
    vi.useFakeTimers()
  })

  afterEach(() => {
    el.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fires onObjectLongPress after longPressMs', () => {
    const onObjectLongPress = vi.fn()
    const onLongPress = vi.fn()
    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
      onLongPress, onObjectLongPress,
    }
    const containerRef = ref(el)
    const { attach } = useTouchGestures(containerRef, callbacks)
    attach()

    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    vi.advanceTimersByTime(600)

    expect(onObjectLongPress).toHaveBeenCalledOnce()
    // onLongPress is also called (both fire together)
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('calls navigator.vibrate with [50,30,50] pattern on long-press when onObjectLongPress provided', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })

    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
      onLongPress: vi.fn(),
      onObjectLongPress: vi.fn(),
    }
    const containerRef = ref(el)
    const { attach } = useTouchGestures(containerRef, callbacks)
    attach()

    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    vi.advanceTimersByTime(600)

    expect(vibrateMock).toHaveBeenCalledWith([50, 30, 50])
  })

  it('uses single haptic (not double) when onObjectLongPress is NOT provided', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })
    const thresholds = getAdaptiveThresholds('tablet')

    const callbacks: GestureCallbacks = {
      onPan: vi.fn(), onPanEnd: vi.fn(), onZoom: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onDoubleTap: vi.fn(),
      onEdgeSwipeLeft: vi.fn(), onEdgeSwipeRight: vi.fn(),
      onLongPress: vi.fn(),
      // No onObjectLongPress
    }
    const containerRef = ref(el)
    const { attach } = useTouchGestures(containerRef, callbacks)
    attach()

    el.dispatchEvent(makePointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    vi.advanceTimersByTime(600)

    // Should be a single number, not the double pattern
    expect(vibrateMock).toHaveBeenCalledWith(thresholds.hapticMs)
  })
})

describe('ActiveGesture type — pinch-object included', () => {
  it('pinch-object is a valid ActiveGesture value', () => {
    // This test validates the type extension is additive
    const gesture = 'pinch-object'
    // Type assertion — will fail TS compile if 'pinch-object' is not in union
    const _: import('../components/gestures/useTouchGestures').ActiveGesture = gesture
    expect(gesture).toBe('pinch-object')
  })
})
