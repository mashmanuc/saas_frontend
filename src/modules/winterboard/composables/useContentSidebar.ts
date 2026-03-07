import { ref, computed, onMounted, type Ref } from 'vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import type { AllowedContentItem, AssetCategoryGroup } from '../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../types/boardDrop'

// ── Allowed MIME types for drag-upload ──
const ALLOWED_UPLOAD_MIMES: Record<string, string> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image',
  'image/webp': 'image', 'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio', 'audio/mp4': 'audio',
  'video/mp4': 'video', 'video/webm': 'video', 'video/ogg': 'video',
}

/**
 * Composable for ContentSidebar: lesson-specific material list + drag-upload.
 *
 * Items loaded from GET /lessons/{id}/allowed-content/.
 * Grouped by asset_category for sidebar sections.
 * Drag-upload: files dropped onto sidebar → POST /content-items/upload/.
 */
export function useContentSidebar(lessonId: Ref<string | null>) {
  const items = ref<AllowedContentItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (!lessonId.value) return
    isLoading.value = true
    error.value = null
    try {
      const id = Number(lessonId.value)
      if (Number.isNaN(id)) return
      const res = await learningContentApi.getLessonAllowedItems(id)
      // Handle both array and paginated response
      const data = Array.isArray(res) ? res : (res as Record<string, unknown>).results as unknown[] ?? []
      // Map to AllowedContentItem (adapt from Phase 2 response + Phase 3A extensions)
      items.value = data.map((item: Record<string, unknown>) => {
        const ci = item.content_item as Record<string, unknown> | undefined
        return {
          id: item.id as number,
          content_item_id: ci?.id as number ?? item.content_item_id as number ?? item.id as number,
          content_type: ci?.type as string ?? item.content_type as string ?? 'problem',
          title: ci?.title as string ?? item.title as string ?? '',
          asset_category: item.asset_category as string ?? 'image',
          thumbnail_url: item.thumbnail_url as string | null ?? ci?.thumbnail_url as string | null ?? null,
          processing_status: item.processing_status as string ?? 'ready',
        }
      })
    } catch (e) {
      console.warn('[useContentSidebar] Load failed:', e)
      error.value = 'load_failed'
      items.value = []
    } finally {
      isLoading.value = false
    }
  }

  const grouped = computed(() => {
    const groups: Record<AssetCategoryGroup, AllowedContentItem[]> = {
      problem: [], image: [], pdf: [], audio: [], video: [], presentation: [],
    }
    for (const item of items.value) {
      const cat = item.asset_category as AssetCategoryGroup
      if (cat in groups) {
        groups[cat].push(item)
      } else {
        groups.image.push(item) // fallback
      }
    }
    return groups
  })

  const totalCount = computed(() => items.value.length)

  // ── Drag-upload ──────────────────────────────────────

  function guessCategory(file: File): string {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return 'image'
  }

  function guessContentType(file: File): string {
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return 'image'
  }

  function isUploadAllowed(file: File): boolean {
    return file.type in ALLOWED_UPLOAD_MIMES
  }

  async function uploadFile(file: File) {
    if (!isUploadAllowed(file)) {
      error.value = 'unsupported_format'
      return
    }

    // 1. Optimistic: add temp item
    const tempId = `temp-${Date.now()}`
    const tempItem: AllowedContentItem = {
      id: 0,
      content_item_id: tempId as unknown as number,
      title: file.name,
      asset_category: guessCategory(file),
      content_type: guessContentType(file),
      processing_status: 'pending',
      thumbnail_url: null,
    }
    items.value.unshift(tempItem)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (lessonId.value) {
        formData.append('lesson_id', lessonId.value)
      }
      // POST /api/v1/learning-content/content-items/upload/
      const res = await learningContentApi.uploadFile(formData)
      const uploaded = (res as Record<string, unknown>).data as Record<string, unknown> ?? res as Record<string, unknown>

      // 2. Replace temp with real item
      const idx = items.value.findIndex(i => (i.content_item_id as unknown) === tempId)
      if (idx !== -1) {
        items.value.splice(idx, 1, {
          id: uploaded.id as number,
          content_item_id: uploaded.id as number,
          title: uploaded.title as string,
          asset_category: uploaded.asset_category as string ?? guessCategory(file),
          content_type: uploaded.type as string ?? guessContentType(file),
          processing_status: uploaded.processing_status as string ?? 'pending',
          thumbnail_url: null,
        })
      }
    } catch (e: unknown) {
      console.warn('[useContentSidebar] Upload failed:', e)
      // Remove temp item on error
      items.value = items.value.filter(i => (i.content_item_id as unknown) !== tempId)

      // Phase 3.1: Differentiate error codes
      const axiosErr = e as { response?: { status?: number } }
      const status = axiosErr?.response?.status
      if (status === 507) {
        error.value = 'quota_exceeded'
      } else if (status === 429) {
        error.value = 'rate_limited'
      } else {
        error.value = 'upload_failed'
      }
    }
  }

  // Phase 3.1: Batched parallel upload
  const MAX_PARALLEL_UPLOADS = 3

  async function uploadFiles(files: File[]) {
    for (let i = 0; i < files.length; i += MAX_PARALLEL_UPLOADS) {
      const batch = files.slice(i, i + MAX_PARALLEL_UPLOADS)
      await Promise.all(batch.map(file => uploadFile(file)))
      // Stop on quota error — no point uploading more
      if (error.value === 'quota_exceeded') break
    }
  }

  onMounted(load)

  return {
    items,
    grouped,
    totalCount,
    isLoading,
    error,
    reload: load,
    uploadFile,
    uploadFiles,
    isUploadAllowed,
    SIDEBAR_DRAG_MIME,
  }
}
