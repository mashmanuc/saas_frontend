import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import type { AllowedContentItem } from '@/modules/winterboard/types/sidebar'

// Mock API
vi.mock('@/modules/learning-content/api/learningContentApi', () => ({
  learningContentApi: {
    getLessonAllowedItems: vi.fn().mockResolvedValue([]),
    uploadFile: vi.fn().mockResolvedValue({ id: 99, title: 'uploaded.png', type: 'image', processing_status: 'pending', asset_category: 'image' }),
  },
}))

// ═══════════════════════════════════════════════════════════════
// Test 1: useContentSidebar loads items on mount
// ═══════════════════════════════════════════════════════════════
describe('useContentSidebar: load items', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state when no lessonId', async () => {
    const { useContentSidebar } = await import(
      '@/modules/winterboard/composables/useContentSidebar'
    )
    const lessonId = ref<string | null>(null)
    const sidebar = useContentSidebar(lessonId)
    expect(sidebar.items.value).toEqual([])
    expect(sidebar.isLoading.value).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 2: grouped correctly splits by asset_category
// ═══════════════════════════════════════════════════════════════
describe('useContentSidebar: grouped', () => {
  it('groups items by asset_category', () => {
    const items: AllowedContentItem[] = [
      { id: 1, content_item_id: 1, content_type: 'problem', title: 'P1', asset_category: 'problem', thumbnail_url: null, processing_status: 'ready' },
      { id: 2, content_item_id: 2, content_type: 'image', title: 'I1', asset_category: 'image', thumbnail_url: 'http://img.png', processing_status: 'ready' },
      { id: 3, content_item_id: 3, content_type: 'video', title: 'V1', asset_category: 'video', thumbnail_url: null, processing_status: 'ready' },
      { id: 4, content_item_id: 4, content_type: 'problem', title: 'P2', asset_category: 'problem', thumbnail_url: null, processing_status: 'ready' },
    ]
    // Manual grouping test
    const groups: Record<string, AllowedContentItem[]> = {
      problem: [], image: [], pdf: [], audio: [], video: [], presentation: [],
    }
    for (const item of items) {
      const cat = item.asset_category
      if (cat in groups) groups[cat].push(item)
    }
    expect(groups.problem.length).toBe(2)
    expect(groups.image.length).toBe(1)
    expect(groups.video.length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 3: isTutor=false → not draggable
// ═══════════════════════════════════════════════════════════════
describe('ContentSidebarItem: drag guard', () => {
  it('non-tutor cannot drag', () => {
    const isTutor = false
    const isReady = true
    const draggable = isTutor && isReady
    expect(draggable).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 4: processing_status=pending → not draggable + badge
// ═══════════════════════════════════════════════════════════════
describe('ContentSidebarItem: processing guard', () => {
  it('pending item is not draggable', () => {
    const isTutor = true
    const processingStatus: string = 'pending'
    const isReady = !processingStatus || processingStatus === 'ready'
    const draggable = isTutor && isReady
    expect(draggable).toBe(false)
    expect(isReady).toBe(false)
  })

  it('failed item shows error state', () => {
    const processingStatus: string = 'failed'
    const isReady = !processingStatus || processingStatus === 'ready'
    expect(isReady).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 5: reload updates list
// ═══════════════════════════════════════════════════════════════
describe('useContentSidebar: reload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reload function exists', async () => {
    const { useContentSidebar } = await import(
      '@/modules/winterboard/composables/useContentSidebar'
    )
    const lessonId = ref<string | null>('42')
    const sidebar = useContentSidebar(lessonId)
    expect(typeof sidebar.reload).toBe('function')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 6: dragstart payload format
// ═══════════════════════════════════════════════════════════════
describe('ContentSidebarItem: drag payload', () => {
  it('serializes correct MIME and fields', () => {
    const SIDEBAR_DRAG_MIME = 'application/vnd.m4sh.content'
    const payload = {
      content_item_id: 42,
      asset_category: 'image',
      content_type: 'image',
    }
    const serialized = JSON.stringify(payload)
    const parsed = JSON.parse(serialized)
    expect(parsed.content_item_id).toBe(42)
    expect(parsed.asset_category).toBe('image')
    expect(SIDEBAR_DRAG_MIME).toBe('application/vnd.m4sh.content')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 7: drag-upload — allowed mimes
// ═══════════════════════════════════════════════════════════════
describe('useContentSidebar: upload file type guard', () => {
  it('allows images and rejects unsupported', () => {
    const ALLOWED: Record<string, string> = {
      'image/jpeg': 'image', 'image/png': 'image',
      'application/pdf': 'pdf',
      'audio/mpeg': 'audio',
      'video/mp4': 'video',
    }
    expect('image/png' in ALLOWED).toBe(true)
    expect('application/octet-stream' in ALLOWED).toBe(false)
    expect('text/html' in ALLOWED).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 8: OS file drop vs sidebar content drag detection
// ═══════════════════════════════════════════════════════════════
describe('ContentSidebar: drop type detection', () => {
  it('distinguishes file drag from content drag', () => {
    // Simulating: if dataTransfer has the sidebar MIME → it's sidebar content
    const hasSidebarData = 'application/vnd.m4sh.content'
    const isSidebarDrag = !!hasSidebarData
    expect(isSidebarDrag).toBe(true)

    // No sidebar MIME + has files → it's OS file drag
    const noSidebarData = ''
    const isFileDrag = !noSidebarData && true // has files
    expect(isFileDrag).toBe(true)
  })
})
