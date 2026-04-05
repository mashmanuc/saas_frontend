import { describe, it, expect } from 'vitest'
import { normalizeSlides, normalizePages, buildViewerItems } from '../utils/normalizeViewerItems'

describe('normalizeSlides', () => {
  it('повертає порожній масив для null/undefined', () => {
    expect(normalizeSlides(null)).toEqual([])
    expect(normalizeSlides(undefined)).toEqual([])
  })

  it('конвертує 1-based ключі у 0-based index', () => {
    const raw = {
      '1': { image_url: 'http://cdn/slide1.png' },
      '2': { image_url: 'http://cdn/slide2.png' },
      '3': { image_url: 'http://cdn/slide3.png' },
    }
    const result = normalizeSlides(raw)
    expect(result).toEqual([
      { index: 0, url: 'http://cdn/slide1.png' },
      { index: 1, url: 'http://cdn/slide2.png' },
      { index: 2, url: 'http://cdn/slide3.png' },
    ])
  })

  it('відфільтровує слайди без url', () => {
    const raw = {
      '1': { image_url: 'http://cdn/slide1.png' },
      '2': { image_url: '' },
      '3': {},
    }
    const result = normalizeSlides(raw)
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(0)
  })

  it('сортує за index', () => {
    const raw = {
      '3': { image_url: 'http://cdn/s3.png' },
      '1': { image_url: 'http://cdn/s1.png' },
      '2': { image_url: 'http://cdn/s2.png' },
    }
    const result = normalizeSlides(raw)
    expect(result.map(s => s.index)).toEqual([0, 1, 2])
  })
})

describe('normalizePages', () => {
  it('повертає порожній масив для null/undefined', () => {
    expect(normalizePages(null)).toEqual([])
    expect(normalizePages(undefined)).toEqual([])
  })

  it('конвертує 1-based ключі у 0-based index', () => {
    const raw = {
      '1': { thumbnail_url: 'http://cdn/page1.png' },
      '2': { thumbnail_url: 'http://cdn/page2.png' },
    }
    const result = normalizePages(raw)
    expect(result).toEqual([
      { index: 0, url: 'http://cdn/page1.png' },
      { index: 1, url: 'http://cdn/page2.png' },
    ])
  })

  it('відфільтровує сторінки без thumbnail_url', () => {
    const raw = {
      '1': { thumbnail_url: 'http://cdn/page1.png' },
      '2': {},
    }
    const result = normalizePages(raw)
    expect(result).toHaveLength(1)
  })
})

describe('buildViewerItems', () => {
  it('використовує normalizeSlides для presentation', () => {
    const detail = {
      type: 'presentation',
      content_json: {
        slides: {
          '1': { image_url: 'http://cdn/s1.png' },
          '2': { image_url: 'http://cdn/s2.png' },
        },
      },
    } as any
    const result = buildViewerItems(detail)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ index: 0, url: 'http://cdn/s1.png' })
  })

  it('використовує normalizePages для pdf', () => {
    const detail = {
      type: 'pdf',
      content_json: {
        pages: {
          '1': { thumbnail_url: 'http://cdn/p1.png' },
        },
      },
    } as any
    const result = buildViewerItems(detail)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ index: 0, url: 'http://cdn/p1.png' })
  })

  it('використовує normalizePages для document (DOCX)', () => {
    const detail = {
      type: 'document',
      content_json: {
        pages: {
          '1': { thumbnail_url: 'http://cdn/doc1.png' },
          '2': { thumbnail_url: 'http://cdn/doc2.png' },
        },
      },
    } as any
    const result = buildViewerItems(detail)
    expect(result).toHaveLength(2)
  })

  it('повертає [] для невідомого типу', () => {
    const detail = { type: 'audio', content_json: {} } as any
    expect(buildViewerItems(detail)).toEqual([])
  })
})
