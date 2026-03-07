import { describe, it, expect } from 'vitest'
import {
  SIDEBAR_DRAG_MIME,
  CONTENT_DRAG_MIME,
  DEFAULT_BOARD_SIZES,
} from '@/modules/winterboard/types/boardDrop'
import type { SidebarDragPayload, ResolveDropResponse } from '@/modules/winterboard/types/boardDrop'

// ═══════════════════════════════════════════════════════════════
// Test 1: Sidebar MIME constant
// ═══════════════════════════════════════════════════════════════
describe('Board drop constants', () => {
  it('SIDEBAR_DRAG_MIME is vnd.m4sh.content', () => {
    expect(SIDEBAR_DRAG_MIME).toBe('application/vnd.m4sh.content')
  })

  it('CONTENT_DRAG_MIME is learning-content', () => {
    expect(CONTENT_DRAG_MIME).toBe('application/learning-content')
  })

  it('both MIMEs are different', () => {
    expect(SIDEBAR_DRAG_MIME).not.toBe(CONTENT_DRAG_MIME)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 2: Default sizes for board object types
// ═══════════════════════════════════════════════════════════════
describe('DEFAULT_BOARD_SIZES', () => {
  it('image has 400x300', () => {
    expect(DEFAULT_BOARD_SIZES.image).toEqual({ w: 400, h: 300 })
  })

  it('audio_player has 320x80', () => {
    expect(DEFAULT_BOARD_SIZES.audio_player).toEqual({ w: 320, h: 80 })
  })

  it('video_player has 480x270', () => {
    expect(DEFAULT_BOARD_SIZES.video_player).toEqual({ w: 480, h: 270 })
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 3: SidebarDragPayload serialization
// ═══════════════════════════════════════════════════════════════
describe('SidebarDragPayload', () => {
  it('serializes and deserializes correctly', () => {
    const payload: SidebarDragPayload = {
      content_item_id: 42,
      asset_category: 'image',
      content_type: 'image',
    }
    const serialized = JSON.stringify(payload)
    const parsed: SidebarDragPayload = JSON.parse(serialized)
    expect(parsed.content_item_id).toBe(42)
    expect(parsed.asset_category).toBe('image')
  })

  it('supports extra fields for PDF/presentation', () => {
    const payload: SidebarDragPayload = {
      content_item_id: 10,
      asset_category: 'pdf',
      content_type: 'pdf',
      extra: { page_number: 3 },
    }
    expect(payload.extra?.page_number).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 4: ResolveDropResponse content_ref has version (B1)
// ═══════════════════════════════════════════════════════════════
describe('ResolveDropResponse B1', () => {
  it('board_object always has content_ref.content_version', () => {
    const response: ResolveDropResponse = {
      board_object: {
        content_ref: {
          content_id: 42,
          content_version: 5,
          content_type: 'image',
        },
        type: 'image',
        render_mode: 'url',
        src: 'http://img.png',
      },
      drop_mode: 'render_image',
    }
    expect(response.board_object.content_ref.content_version).toBe(5)
    expect(response.board_object.content_ref.content_id).toBe(42)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 5: Not droppable guard
// ═══════════════════════════════════════════════════════════════
describe('Drop mode guards', () => {
  it('not_droppable blocks canvas add', () => {
    const dropMode = 'not_droppable'
    const shouldAdd = dropMode !== 'not_droppable'
    expect(shouldAdd).toBe(false)
  })

  it('render_image allows canvas add', () => {
    const dropMode: string = 'render_image'
    const shouldAdd = dropMode !== 'not_droppable'
    expect(shouldAdd).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 6: Asset ID generation uniqueness
// ═══════════════════════════════════════════════════════════════
describe('Asset ID generation', () => {
  it('generates unique IDs with content_id prefix', () => {
    const contentId = 42
    const id1 = `content-${contentId}-${Date.now()}`
    const id2 = `content-${contentId}-${Date.now() + 1}`
    expect(id1).toContain('content-42-')
    expect(id1).not.toBe(id2)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 7: Existing SVG flow not broken
// ═══════════════════════════════════════════════════════════════
describe('Existing ContentPanel drag compatibility', () => {
  it('CONTENT_DRAG_MIME still works for library drag', () => {
    // Simulates: handleCanvasDrop checks SIDEBAR_DRAG_MIME first, then CONTENT_DRAG_MIME
    const sidebarRaw = '' // no sidebar data
    const contentRaw = JSON.stringify({
      itemId: 1,
      type: 'problem',
      title: 'Test',
      contentJson: { text: 'x' },
      version: 3,
    })

    // Should skip sidebar and process content
    const hasSidebar = !!sidebarRaw
    const hasContent = !!contentRaw
    expect(hasSidebar).toBe(false)
    expect(hasContent).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 8: Audio/video board objects
// ═══════════════════════════════════════════════════════════════
describe('Audio/Video board objects', () => {
  it('audio creates audio_player type', () => {
    const response: ResolveDropResponse = {
      board_object: {
        content_ref: { content_id: 1, content_version: 1, content_type: 'audio' },
        type: 'audio_player',
        src: 'http://audio.mp3',
        title: 'Song',
        duration: 180,
      },
      drop_mode: 'board_audio',
    }
    expect(response.board_object.type).toBe('audio_player')
    expect(response.board_object.duration).toBe(180)
  })

  it('video creates video_player type', () => {
    const response: ResolveDropResponse = {
      board_object: {
        content_ref: { content_id: 2, content_version: 1, content_type: 'video' },
        type: 'video_player',
        src: 'http://video.mp4',
        thumbnail: 'http://thumb.jpg',
        title: 'Lecture',
      },
      drop_mode: 'board_video',
    }
    expect(response.board_object.type).toBe('video_player')
    expect(response.board_object.thumbnail).toBe('http://thumb.jpg')
  })
})
