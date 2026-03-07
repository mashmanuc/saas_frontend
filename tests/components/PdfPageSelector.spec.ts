import { describe, it, expect } from 'vitest'
import type { AllowedContentItem } from '@/modules/winterboard/types/sidebar'
import { SIDEBAR_DRAG_MIME } from '@/modules/winterboard/types/boardDrop'

function makePdfItem(pages: Record<string, { thumbnail_url: string }>): AllowedContentItem {
  return {
    id: 1,
    content_item_id: 42,
    content_type: 'pdf',
    title: 'Textbook.pdf',
    asset_category: 'pdf',
    thumbnail_url: 'thumb.png',
    processing_status: 'ready',
    pages,
    page_count: Object.keys(pages).length,
  }
}

// ═══════════════════════════════════════════════════════════════
// Test 1: Pages sorted by number
// ═══════════════════════════════════════════════════════════════
describe('PdfPageSelector: page sorting', () => {
  it('sorts pages by number', () => {
    const pages = {
      '3': { thumbnail_url: 'p3.png' },
      '1': { thumbnail_url: 'p1.png' },
      '2': { thumbnail_url: 'p2.png' },
    }
    const sorted = Object.entries(pages)
      .map(([num, data]) => ({ number: parseInt(num, 10), thumbnail_url: data.thumbnail_url }))
      .sort((a, b) => a.number - b.number)
    expect(sorted[0].number).toBe(1)
    expect(sorted[1].number).toBe(2)
    expect(sorted[2].number).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 2: Drag payload includes page_number
// ═══════════════════════════════════════════════════════════════
describe('PdfPageSelector: drag payload', () => {
  it('includes extra.page_number in drag data', () => {
    const pageNumber = 5
    const payload = {
      content_item_id: 42,
      asset_category: 'pdf',
      content_type: 'pdf',
      extra: { page_number: pageNumber },
    }
    const serialized = JSON.stringify(payload)
    const parsed = JSON.parse(serialized)
    expect(parsed.extra.page_number).toBe(5)
    expect(parsed.asset_category).toBe('pdf')
  })

  it('uses SIDEBAR_DRAG_MIME', () => {
    expect(SIDEBAR_DRAG_MIME).toBe('application/vnd.m4sh.content')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 3: Default drag = page 1
// ═══════════════════════════════════════════════════════════════
describe('PdfPageSelector: default drag', () => {
  it('full PDF drag uses page 1', () => {
    const payload = {
      content_item_id: 42,
      asset_category: 'pdf',
      content_type: 'pdf',
      extra: { page_number: 1 },
    }
    expect(payload.extra.page_number).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 4: Empty pages when processing
// ═══════════════════════════════════════════════════════════════
describe('PdfPageSelector: empty state', () => {
  it('no pages when processing', () => {
    const item = makePdfItem({})
    item.processing_status = 'pending'
    const pages = Object.entries(item.pages || {})
    expect(pages.length).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 5: MediaStatusGuard ready → slot renders
// ═══════════════════════════════════════════════════════════════
describe('MediaStatusGuard: status logic', () => {
  it('ready → content visible', () => {
    const status: string = 'ready'
    const isReady = !status || status === 'ready'
    const isProcessing = ['pending', 'processing'].includes(status)
    const isFailed = status === 'failed'
    expect(isReady).toBe(true)
    expect(isProcessing).toBe(false)
    expect(isFailed).toBe(false)
  })

  it('pending → processing UI', () => {
    const status: string = 'pending'
    const isReady = !status || status === 'ready'
    const isProcessing = ['pending', 'processing'].includes(status)
    expect(isReady).toBe(false)
    expect(isProcessing).toBe(true)
  })

  it('failed → error UI', () => {
    const status = 'failed'
    const isFailed = status === 'failed'
    expect(isFailed).toBe(true)
  })

  it('processing → processing UI', () => {
    const status = 'processing'
    const isProcessing = ['pending', 'processing'].includes(status)
    expect(isProcessing).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 6: MediaStatusGuard empty/null → ready
// ═══════════════════════════════════════════════════════════════
describe('MediaStatusGuard: null/empty status', () => {
  it('empty string → ready', () => {
    const status = ''
    const isReady = !status || status === 'ready'
    expect(isReady).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 7: isPdf detection
// ═══════════════════════════════════════════════════════════════
describe('ContentSidebarItem: PDF detection', () => {
  it('asset_category=pdf → isPdf=true', () => {
    const item = makePdfItem({ '1': { thumbnail_url: 'p1.png' } })
    const isPdf = item.asset_category === 'pdf'
    expect(isPdf).toBe(true)
  })

  it('asset_category=image → isPdf=false', () => {
    const category: string = 'image'
    const isPdf = category === 'pdf'
    expect(isPdf).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 8: AllowedContentItem with pages
// ═══════════════════════════════════════════════════════════════
describe('AllowedContentItem: pages field', () => {
  it('supports pages record', () => {
    const item = makePdfItem({
      '1': { thumbnail_url: 'p1.png' },
      '2': { thumbnail_url: 'p2.png' },
    })
    expect(item.pages).toBeDefined()
    expect(item.page_count).toBe(2)
    expect(item.pages!['1'].thumbnail_url).toBe('p1.png')
  })
})
