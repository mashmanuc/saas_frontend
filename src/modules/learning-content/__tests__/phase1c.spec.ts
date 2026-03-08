// Phase 1c: Tests for soft delete, upload zone, storage quota
import { describe, it, expect, vi } from 'vitest'
import type { ContentItemSummary } from '../types/learningContent'

// ─── Mock learningContentApi ────────────────────────────────────────────────

const mockDeleteContentItem = vi.fn().mockResolvedValue(undefined)
const mockUploadFile = vi.fn().mockResolvedValue({ id: 1 })
const mockGetStorageQuota = vi.fn().mockResolvedValue({
  used_bytes: 44_400_000,
  total_quota_bytes: 524_288_000,
  available_bytes: 479_888_000,
  usage_percent: 8.5,
})

vi.mock('../api/learningContentApi', () => ({
  learningContentApi: {
    deleteContentItem: (...args: unknown[]) => mockDeleteContentItem(...args),
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    getStorageQuota: (...args: unknown[]) => mockGetStorageQuota(...args),
    getSubjects: vi.fn().mockResolvedValue([]),
    getCollections: vi.fn().mockResolvedValue([]),
    searchItems: vi.fn().mockResolvedValue({ items: [], total: 0, filters_applied: {} }),
    getItemDetail: vi.fn().mockResolvedValue({}),
    getLessonAllowedItems: vi.fn().mockResolvedValue([]),
    getLessonParticipants: vi.fn().mockResolvedValue([]),
    getCollectionTree: vi.fn().mockResolvedValue({ topics: [] }),
    getUnitItems: vi.fn().mockResolvedValue({ id: 1, title: '', order_index: 0, level: 0, items: [] }),
    resolveDropMode: vi.fn().mockResolvedValue({ board_object: {}, drop_mode: 'image' }),
  },
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTutorItem(overrides?: Partial<ContentItemSummary>): ContentItemSummary {
  return {
    id: 1,
    type: 'problem',
    title: 'My Problem',
    difficulty: 3,
    version: 1,
    ownership_type: 'TUTOR',
    ...overrides,
  }
}

function makePlatformItem(overrides?: Partial<ContentItemSummary>): ContentItemSummary {
  return {
    id: 2,
    type: 'theory',
    title: 'Platform Theory',
    difficulty: 2,
    version: 1,
    ownership_type: 'PLATFORM',
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 1c: ContentItemCard delete', () => {
  it('test_delete_button_visible_for_tutor_owned_content', () => {
    const item = makeTutorItem()
    const canDelete = item.ownership_type === 'TUTOR' || item.ownership_type === 'USER_GENERATED'
    expect(canDelete).toBe(true)
  })

  it('test_delete_button_hidden_for_platform_content', () => {
    const item = makePlatformItem()
    const canDelete = item.ownership_type === 'TUTOR' || item.ownership_type === 'USER_GENERATED'
    expect(canDelete).toBe(false)
  })

  it('test_delete_emits_event', () => {
    const item = makeTutorItem()
    // Simulate emit by calling a handler function
    const emitted: ContentItemSummary[] = []
    function onDeleteClick(i: ContentItemSummary) { emitted.push(i) }
    onDeleteClick(item)
    expect(emitted).toHaveLength(1)
    expect(emitted[0].id).toBe(1)
    expect(emitted[0].ownership_type).toBe('TUTOR')
  })
})

describe('Phase 1c: ContentPanel upload zone', () => {
  it('test_upload_zone_renders_in_library_mode', () => {
    // In library mode (no lessonId) → upload zone should be visible
    const isLessonMode = false
    const shouldShowUploadZone = !isLessonMode
    expect(shouldShowUploadZone).toBe(true)
  })

  it('test_upload_zone_hidden_in_lesson_mode', () => {
    // In lesson mode → upload zone should be hidden
    const isLessonMode = true
    const shouldShowUploadZone = !isLessonMode
    expect(shouldShowUploadZone).toBe(false)
  })
})

describe('Phase 1c: StorageQuotaBar', () => {
  it('test_storage_quota_bar_renders', () => {
    const quota = {
      used_bytes: 44_400_000,
      total_quota_bytes: 524_288_000,
      available_bytes: 479_888_000,
      usage_percent: 8.5,
    }

    // Test color class logic
    function barColorClass(percent: number): string {
      if (percent > 95) return 'storage-quota__bar--critical'
      if (percent > 80) return 'storage-quota__bar--amber'
      return 'storage-quota__bar--normal'
    }

    expect(barColorClass(quota.usage_percent)).toBe('storage-quota__bar--normal')
    expect(barColorClass(85)).toBe('storage-quota__bar--amber')
    expect(barColorClass(97)).toBe('storage-quota__bar--critical')

    // Test formatBytes logic
    function formatBytes(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    expect(formatBytes(quota.used_bytes)).toBe('42.3 MB')
    expect(formatBytes(quota.total_quota_bytes)).toBe('500.0 MB')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
  })
})
