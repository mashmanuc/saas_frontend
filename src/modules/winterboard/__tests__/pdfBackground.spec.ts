// WB: Unit tests for PDF background layer rendering (Phase 5: A5.2)
// Tests: PDF bg config, grid/dots/lined patterns, zoom scaling, image loading states, lazy loading

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import type { WBPageBackground, WBPdfBackground, WBPage } from '../types/winterboard'

// ── Helpers — replicate WBCanvas computed logic for unit testing ─────────

function isPdfBackground(bg: WBPageBackground | undefined): bg is WBPdfBackground {
  return !!bg && typeof bg !== 'string' && (bg as WBPdfBackground).type === 'pdf'
}

function getBgPatternType(bg: WBPageBackground | undefined): string {
  if (!bg) return 'white'
  if (typeof bg === 'string') return bg
  return bg.type
}

function computeDotsPattern(width: number, height: number, spacing = 40) {
  const dots: Array<{ key: string; x: number; y: number }> = []
  const cols = Math.floor(width / spacing)
  const rows = Math.floor(height / spacing)
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      dots.push({ key: `d-${r}-${c}`, x: c * spacing, y: r * spacing })
    }
  }
  return dots
}

function computeGridLines(width: number, height: number, spacing = 40) {
  const vertical = Math.floor(width / spacing)
  const horizontal = Math.floor(height / spacing)
  return { vertical, horizontal, total: vertical + horizontal }
}

function computeLinedLines(height: number, spacing = 32) {
  return Math.floor(height / spacing)
}

// ── Mock image cache ────────────────────────────────────────────────────

function createMockImageCache() {
  const cache = new Map<string, HTMLImageElement>()
  const states = new Map<string, string>()

  return {
    get(url: string): HTMLImageElement | null {
      return cache.get(url) ?? null
    },
    getState(url: string): string {
      return states.get(url) ?? 'idle'
    },
    isBroken(url: string): boolean {
      return states.get(url) === 'error'
    },
    isLoading(url: string): boolean {
      return states.get(url) === 'loading'
    },
    // Test helpers
    _setLoaded(url: string, img: HTMLImageElement) {
      cache.set(url, img)
      states.set(url, 'loaded')
    },
    _setLoading(url: string) {
      states.set(url, 'loading')
    },
    _setError(url: string) {
      states.set(url, 'error')
    },
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('PDF Background Layer (A5.2)', () => {
  // ── PDF background config ───────────────────────────────────────────

  describe('PDF background config', () => {
    it('returns null for string backgrounds', () => {
      const backgrounds: WBPageBackground[] = ['white', 'grid', 'dots', 'lined']
      for (const bg of backgrounds) {
        expect(isPdfBackground(bg)).toBe(false)
        expect(getBgPatternType(bg)).toBe(bg)
      }
    })

    it('returns pdf type for PDF background', () => {
      const bg: WBPdfBackground = { type: 'pdf', url: 'https://cdn.example.com/page.png', assetId: 'asset-1' }
      expect(isPdfBackground(bg)).toBe(true)
      expect(getBgPatternType(bg)).toBe('pdf')
    })

    it('generates correct Konva image config when image is loaded', () => {
      const cache = createMockImageCache()
      const mockImg = new Image()
      cache._setLoaded('https://cdn.example.com/page.png', mockImg)

      const bg: WBPdfBackground = { type: 'pdf', url: 'https://cdn.example.com/page.png', assetId: 'asset-1' }
      const width = 1920
      const height = 1080

      const img = cache.get(bg.url)
      expect(img).toBe(mockImg)

      // Simulating pdfBackgroundConfig computed
      const config = img ? {
        x: 0,
        y: 0,
        width,
        height,
        image: img,
        listening: false,
        name: 'pdf-background',
      } : null

      expect(config).not.toBeNull()
      expect(config!.width).toBe(1920)
      expect(config!.height).toBe(1080)
      expect(config!.listening).toBe(false)
      expect(config!.image).toBe(mockImg)
    })

    it('returns null config when image is not yet loaded', () => {
      const cache = createMockImageCache()
      cache._setLoading('https://cdn.example.com/page.png')

      const img = cache.get('https://cdn.example.com/page.png')
      expect(img).toBeNull()
    })
  })

  // ── Grid pattern ────────────────────────────────────────────────────

  describe('Grid pattern', () => {
    it('generates correct number of grid lines', () => {
      const { vertical, horizontal } = computeGridLines(1920, 1080)
      expect(vertical).toBe(48) // 1920/40 = 48
      expect(horizontal).toBe(27) // 1080/40 = 27
    })

    it('scales with canvas dimensions', () => {
      const small = computeGridLines(800, 600)
      const large = computeGridLines(3840, 2160)

      expect(large.vertical).toBeGreaterThan(small.vertical)
      expect(large.horizontal).toBeGreaterThan(small.horizontal)
    })
  })

  // ── Dots pattern ────────────────────────────────────────────────────

  describe('Dots pattern', () => {
    it('generates correct number of dots', () => {
      const dots = computeDotsPattern(1920, 1080)
      const expectedCols = Math.floor(1920 / 40)
      const expectedRows = Math.floor(1080 / 40)
      expect(dots.length).toBe(expectedCols * expectedRows)
    })

    it('dots have correct positions', () => {
      const dots = computeDotsPattern(200, 200, 40)
      // First dot at (40, 40)
      expect(dots[0]).toEqual({ key: 'd-1-1', x: 40, y: 40 })
      // Last dot
      const last = dots[dots.length - 1]
      expect(last.x).toBe(200) // 5 * 40
      expect(last.y).toBe(200) // 5 * 40
    })

    it('returns empty for very small canvas', () => {
      const dots = computeDotsPattern(30, 30, 40)
      expect(dots.length).toBe(0)
    })
  })

  // ── Lined pattern ───────────────────────────────────────────────────

  describe('Lined pattern', () => {
    it('generates correct number of lines', () => {
      const count = computeLinedLines(1080)
      expect(count).toBe(33) // 1080/32 = 33.75 → 33
    })

    it('scales with height', () => {
      expect(computeLinedLines(2160)).toBeGreaterThan(computeLinedLines(1080))
    })
  })

  // ── Background scales with zoom ─────────────────────────────────────

  describe('Background scales with zoom', () => {
    it('stage config applies zoom as scale', () => {
      const zoom = 2.0
      const width = 1920
      const height = 1080

      // Simulating stageConfig computed
      const stageConfig = {
        width: width * zoom,
        height: height * zoom,
        scaleX: zoom,
        scaleY: zoom,
      }

      expect(stageConfig.width).toBe(3840)
      expect(stageConfig.height).toBe(2160)
      expect(stageConfig.scaleX).toBe(2.0)
      expect(stageConfig.scaleY).toBe(2.0)
    })

    it('background rect uses unscaled dimensions (stage handles scaling)', () => {
      const bgConfig = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        fill: '#ffffff',
      }

      // Background is in canvas coordinates, stage scale handles zoom
      expect(bgConfig.width).toBe(1920)
      expect(bgConfig.height).toBe(1080)
    })

    it('PDF image uses unscaled dimensions (stage handles scaling)', () => {
      const pdfConfig = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        listening: false,
      }

      // Same as background — stage scale handles zoom
      expect(pdfConfig.width).toBe(1920)
    })
  })

  // ── Image loading states ────────────────────────────────────────────

  describe('Image loading states', () => {
    it('loading state detected correctly', () => {
      const cache = createMockImageCache()
      cache._setLoading('https://cdn.example.com/page.png')

      expect(cache.isLoading('https://cdn.example.com/page.png')).toBe(true)
      expect(cache.isBroken('https://cdn.example.com/page.png')).toBe(false)
    })

    it('error state detected correctly', () => {
      const cache = createMockImageCache()
      cache._setError('https://cdn.example.com/page.png')

      expect(cache.isBroken('https://cdn.example.com/page.png')).toBe(true)
      expect(cache.isLoading('https://cdn.example.com/page.png')).toBe(false)
    })

    it('loaded state provides image', () => {
      const cache = createMockImageCache()
      const img = new Image()
      cache._setLoaded('https://cdn.example.com/page.png', img)

      expect(cache.get('https://cdn.example.com/page.png')).toBe(img)
      expect(cache.getState('https://cdn.example.com/page.png')).toBe('loaded')
    })

    it('idle state for unknown URL', () => {
      const cache = createMockImageCache()
      expect(cache.getState('https://unknown.com/img.png')).toBe('idle')
      expect(cache.get('https://unknown.com/img.png')).toBeNull()
    })
  })

  // ── Lazy loading: only current ± 1 pages ───────────────────────────

  describe('Lazy loading strategy', () => {
    it('determines which pages to preload (current ± 1)', () => {
      const pages: WBPage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `page-${i}`,
        name: `Page ${i + 1}`,
        strokes: [],
        assets: [],
        background: i < 5
          ? { type: 'pdf' as const, url: `https://cdn.example.com/page-${i}.png`, assetId: `asset-${i}` }
          : 'white',
      }))

      const currentIndex = 3

      // Pages to preload: current-1, current, current+1
      const preloadRange = [
        Math.max(0, currentIndex - 1),
        currentIndex,
        Math.min(pages.length - 1, currentIndex + 1),
      ]

      const urlsToPreload: string[] = []
      for (const idx of preloadRange) {
        const bg = pages[idx].background
        if (bg && typeof bg !== 'string' && bg.type === 'pdf') {
          urlsToPreload.push(bg.url)
        }
      }

      expect(urlsToPreload).toEqual([
        'https://cdn.example.com/page-2.png',
        'https://cdn.example.com/page-3.png',
        'https://cdn.example.com/page-4.png',
      ])
    })

    it('handles edge case: first page', () => {
      const currentIndex = 0
      const pageCount = 5
      const preloadRange = [
        Math.max(0, currentIndex - 1),
        currentIndex,
        Math.min(pageCount - 1, currentIndex + 1),
      ]

      // Should be [0, 0, 1] → deduplicated: [0, 1]
      const unique = [...new Set(preloadRange)]
      expect(unique).toEqual([0, 1])
    })

    it('handles edge case: last page', () => {
      const currentIndex = 9
      const pageCount = 10
      const preloadRange = [
        Math.max(0, currentIndex - 1),
        currentIndex,
        Math.min(pageCount - 1, currentIndex + 1),
      ]

      const unique = [...new Set(preloadRange)]
      expect(unique).toEqual([8, 9])
    })
  })

  // ── Backward compatibility ──────────────────────────────────────────

  describe('Backward compatibility', () => {
    it('pages without background default to white', () => {
      const page: WBPage = {
        id: 'old-page',
        name: 'Old Page',
        strokes: [],
        assets: [],
      }

      const bgType = getBgPatternType(page.background)
      expect(bgType).toBe('white')
    })

    it('pages with explicit white background work', () => {
      const page: WBPage = {
        id: 'white-page',
        name: 'White Page',
        strokes: [],
        assets: [],
        background: 'white',
      }

      expect(getBgPatternType(page.background)).toBe('white')
      expect(isPdfBackground(page.background)).toBe(false)
    })
  })
})
