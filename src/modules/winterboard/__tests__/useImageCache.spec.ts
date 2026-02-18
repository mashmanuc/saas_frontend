// WB: Unit tests for useImageCache composable (Phase 2: A2.3)
// Tests: cache get/set, LRU eviction, loading states, retry logic, preload, clear

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useImageCache } from '../composables/useImageCache'
import type { WBAsset } from '../types/winterboard'

// ── Mock Image constructor ──────────────────────────────────────────────

let imageInstances: Array<{
  src: string
  crossOrigin: string | null
  onload: (() => void) | null
  onerror: (() => void) | null
}> = []

class MockImage {
  src = ''
  crossOrigin: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 100
  naturalHeight = 100

  constructor() {
    imageInstances.push(this as unknown as typeof imageInstances[0])
  }
}

// ── Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  imageInstances = []
  vi.stubGlobal('Image', MockImage)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ── Helpers ─────────────────────────────────────────────────────────────

function simulateLoad(index: number = 0): void {
  const img = imageInstances[index]
  if (img?.onload) img.onload()
}

function simulateError(index: number = 0): void {
  const img = imageInstances[index]
  if (img?.onerror) img.onerror()
}

function makeAsset(id: string, src: string): WBAsset {
  return { id, type: 'image', src, x: 0, y: 0, w: 100, h: 100, rotation: 0 }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('useImageCache', () => {
  it('returns null for uncached URL and starts loading', () => {
    const cache = useImageCache()
    const result = cache.get('https://cdn.example.com/img.png')

    expect(result).toBeNull()
    expect(cache.getState('https://cdn.example.com/img.png')).toBe('loading')
    expect(imageInstances).toHaveLength(1)
    expect(imageInstances[0].src).toBe('https://cdn.example.com/img.png')
    expect(imageInstances[0].crossOrigin).toBe('anonymous')
  })

  it('returns cached image after successful load', () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/img.png')

    simulateLoad(0)

    const result = cache.get('https://cdn.example.com/img.png')
    expect(result).not.toBeNull()
    expect(result).toBeInstanceOf(MockImage)
    expect(cache.getState('https://cdn.example.com/img.png')).toBe('loaded')
  })

  it('does not create duplicate Image for same URL', () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/img.png')
    cache.get('https://cdn.example.com/img.png')
    cache.get('https://cdn.example.com/img.png')

    expect(imageInstances).toHaveLength(1)
  })

  it('handles data: URLs without crossOrigin', () => {
    const cache = useImageCache()
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    cache.get(dataUrl)

    expect(imageInstances).toHaveLength(1)
    expect(imageInstances[0].crossOrigin).toBeNull()
  })

  it('calls onImageLoaded callback when image loads', () => {
    const callback = vi.fn()
    const cache = useImageCache(callback)
    cache.get('https://cdn.example.com/img.png')

    expect(callback).not.toHaveBeenCalled()
    simulateLoad(0)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('retries on error with exponential backoff', async () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/fail.png')

    expect(cache.getState('https://cdn.example.com/fail.png')).toBe('loading')

    // First failure → retry in 500ms
    simulateError(0)
    expect(cache.getState('https://cdn.example.com/fail.png')).toBe('loading')

    await vi.advanceTimersByTimeAsync(500)
    expect(imageInstances).toHaveLength(2) // retry created new Image

    // Second failure → retry in 1000ms
    simulateError(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(imageInstances).toHaveLength(3)

    // Third failure → error state (max retries exhausted)
    simulateError(2)
    expect(cache.getState('https://cdn.example.com/fail.png')).toBe('error')
    expect(cache.isBroken('https://cdn.example.com/fail.png')).toBe(true)
  })

  it('isLoading returns correct state', () => {
    const cache = useImageCache()
    expect(cache.isLoading('https://cdn.example.com/img.png')).toBe(false)

    cache.get('https://cdn.example.com/img.png')
    expect(cache.isLoading('https://cdn.example.com/img.png')).toBe(true)

    simulateLoad(0)
    expect(cache.isLoading('https://cdn.example.com/img.png')).toBe(false)
  })

  it('isBroken returns false for loaded images', () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/img.png')
    simulateLoad(0)

    expect(cache.isBroken('https://cdn.example.com/img.png')).toBe(false)
  })

  it('preloadPageAssets loads all image assets', () => {
    const cache = useImageCache()
    const assets: WBAsset[] = [
      makeAsset('a1', 'https://cdn.example.com/1.png'),
      makeAsset('a2', 'https://cdn.example.com/2.png'),
      makeAsset('a3', 'https://cdn.example.com/3.png'),
    ]

    cache.preloadPageAssets(assets)

    expect(imageInstances).toHaveLength(3)
    expect(cache.isLoading('https://cdn.example.com/1.png')).toBe(true)
    expect(cache.isLoading('https://cdn.example.com/2.png')).toBe(true)
    expect(cache.isLoading('https://cdn.example.com/3.png')).toBe(true)
  })

  it('retryLoad resets error state and retries', async () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/broken.png')

    // Exhaust retries
    simulateError(0)
    await vi.advanceTimersByTimeAsync(500)
    simulateError(1)
    await vi.advanceTimersByTimeAsync(1000)
    simulateError(2)

    expect(cache.isBroken('https://cdn.example.com/broken.png')).toBe(true)

    // Retry
    cache.retryLoad('https://cdn.example.com/broken.png')
    expect(cache.isLoading('https://cdn.example.com/broken.png')).toBe(true)

    // Simulate success on retry
    const lastIdx = imageInstances.length - 1
    simulateLoad(lastIdx)
    expect(cache.getState('https://cdn.example.com/broken.png')).toBe('loaded')
    expect(cache.isBroken('https://cdn.example.com/broken.png')).toBe(false)
  })

  it('clear removes all entries', () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/1.png')
    cache.get('https://cdn.example.com/2.png')
    simulateLoad(0)
    simulateLoad(1)

    expect(cache.stats().size).toBe(2)

    cache.clear()

    expect(cache.stats().size).toBe(0)
    expect(cache.get('https://cdn.example.com/1.png')).toBeNull()
  })

  it('stats returns correct counts', () => {
    const cache = useImageCache()
    cache.get('https://cdn.example.com/1.png')
    cache.get('https://cdn.example.com/2.png')
    simulateLoad(0)

    const s = cache.stats()
    expect(s.size).toBe(1)
    expect(s.loading).toBe(1)
    expect(s.errors).toBe(0)
  })

  it('version ref increments on load', () => {
    const cache = useImageCache()
    const v0 = cache.version.value

    cache.get('https://cdn.example.com/img.png')
    expect(cache.version.value).toBe(v0) // no change yet

    simulateLoad(0)
    expect(cache.version.value).toBe(v0 + 1)
  })
})
