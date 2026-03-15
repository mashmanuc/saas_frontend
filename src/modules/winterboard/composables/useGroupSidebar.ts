import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import { groupApi as learningGroupApi } from '@/modules/groups/api/groupApi'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import { fetchAssets } from '@/modules/winterboard/api/library'
import type { LibraryAsset } from '@/modules/winterboard/types/library'
import type { AllowedContentItem, AssetCategoryGroup } from '../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../types/boardDrop'

const ALLOWED_UPLOAD_MIMES: Record<string, string> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image',
  'image/webp': 'image', 'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio', 'audio/mp4': 'audio',
  'video/mp4': 'video', 'video/webm': 'video', 'video/ogg': 'video',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/vnd.ms-powerpoint': 'presentation',
}

/** Interval (ms) between status poll cycles while items are processing */
const POLL_INTERVAL_MS = 4000

/**
 * Composable for ContentSidebar in group mode (no lesson required).
 * Loads materials from LearningGroup API and adapts them to AllowedContentItem format.
 * Used by WBSoloRoom when navigated from Knowledge Library with ?groupId=...
 */
export function useGroupSidebar(groupId: Ref<string | null>) {
  const items = ref<AllowedContentItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Processing status polling ──────────────────────────────────────────────
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function hasPendingItems(): boolean {
    return items.value.some(
      i => i.processing_status === 'pending' || i.processing_status === 'processing',
    )
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /**
   * Polls individual pending items via getItemDetail and updates them in-place
   * so the sidebar reflects real-time processing state without a full reload.
   */
  async function pollPendingItems() {
    if (!groupId.value) return

    const pending = items.value.filter(
      i => i.processing_status === 'pending' || i.processing_status === 'processing',
    )
    if (pending.length === 0) {
      stopPolling()
      return
    }

    for (const item of pending) {
      try {
        const res = await learningContentApi.getItemDetail(item.content_item_id)
        const detail = (res as unknown as Record<string, unknown>).data
          ? ((res as unknown as Record<string, unknown>).data as Record<string, unknown>)
          : (res as unknown as Record<string, unknown>)

        const newStatus = (detail.processing_status as string) ?? item.processing_status
        if (newStatus !== item.processing_status) {
          const idx = items.value.findIndex(i => i.content_item_id === item.content_item_id)
          if (idx !== -1) {
            const cj = (detail.content_json as Record<string, unknown>) ?? {}
            items.value.splice(idx, 1, {
              ...items.value[idx],
              processing_status: newStatus,
              thumbnail_url:
                (cj.thumbnail_url as string | null)
                ?? (cj.images as string[] | undefined)?.[0]
                ?? items.value[idx].thumbnail_url,
              pages: (cj.pages as Record<string, { thumbnail_url: string }>) ?? items.value[idx].pages,
              page_count: (cj.page_count as number) ?? items.value[idx].page_count,
              slides: (cj.slides as Record<string, { image_url: string }>) ?? items.value[idx].slides,
              slide_count: (cj.slide_count as number) ?? items.value[idx].slide_count,
            })
          }
        }
      } catch {
        // Non-critical: silently skip failed status checks
      }
    }

    // Stop timer if nothing left to poll
    if (!hasPendingItems()) {
      stopPolling()
    }
  }

  function startPolling() {
    if (pollTimer !== null || !hasPendingItems()) return
    pollTimer = setInterval(pollPendingItems, POLL_INTERVAL_MS)
  }

  // Clean up on composable teardown
  onUnmounted(stopPolling)

  // ── Data loading ───────────────────────────────────────────────────────────

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      if (groupId.value) {
        // Group mode: load materials assigned to this class/group
        const materials = await learningGroupApi.listMaterials(groupId.value) as unknown as Record<string, unknown>[]
        items.value = materials.map((m: Record<string, unknown>) => ({
          id: (m.content_item as number) ?? 0,
          content_item_id: (m.content_item as number) ?? 0,
          content_type: (m.content_type as string) ?? 'image',
          title: (m.content_title as string) ?? 'Untitled',
          asset_category: guessAssetCategory((m.content_type as string) ?? ''),
          thumbnail_url: (m.content_thumbnail_url as string | null) ?? null,
          processing_status: (m.content_processing_status as string) ?? 'ready',
          pages: (m.content_pages as Record<string, { thumbnail_url: string }>) ?? undefined,
          page_count: (m.content_page_count as number) ?? undefined,
          slides: (m.content_slides as Record<string, { image_url: string }>) ?? undefined,
          slide_count: (m.content_slide_count as number) ?? undefined,
        }))
        startPolling()
      } else {
        // Library mode: no group context — show tutor's files from Library
        const res = await fetchAssets({ limit: 100 })
        items.value = (res.results ?? []).map((a: LibraryAsset) => {
          // Phase 9: content_item_id = null для старих активів без ContentItem FK.
          // НЕ підставляємо a.id як fallback — це LibraryAsset.id, не ContentItem.id,
          // і resolve-drop шукав би неправильний ContentItem → 404.
          const ciId = a.content_item_id ?? null
          // Fallback URL для старих активів (cdn_url або /media/ + storage_key)
          const fallbackUrl = a.cdn_url || (a.storage_key ? `/media/${a.storage_key}` : null)
          return {
            id: ciId ?? a.id,
            content_item_id: ciId,
            content_type: mimeToCategory(a.content_type),
            title: a.name,
            asset_category: mimeToCategory(a.content_type),
            thumbnail_url: a.thumbnail_url || a.cdn_url || null,
            processing_status: a.status === 'active' ? 'ready' : 'pending',
            cdn_url: fallbackUrl,
          }
        })
      }
    } catch {
      error.value = 'load_failed'
      items.value = []
    } finally {
      isLoading.value = false
    }
  }

  watch(groupId, () => {
    load()
  }, { immediate: true })

  const grouped = computed(() => {
    const groups: Record<AssetCategoryGroup, AllowedContentItem[]> = {
      problem: [], image: [], pdf: [], audio: [], video: [], presentation: [], youtube: [],
    }
    for (const item of items.value) {
      const cat = item.asset_category
      // UX-2 FIX: Backend повертає 'youtube' (не 'youtube_link')
      if (cat === 'youtube' || cat === 'youtube_link') {
        groups.youtube.push(item)
        continue
      }
      if (cat in groups) {
        groups[cat as AssetCategoryGroup].push(item)
      } else {
        groups.image.push(item)
      }
    }
    return groups
  })

  const totalCount = computed(() => items.value.length)

  function mimeToCategory(mime: string): string {
    if (!mime) return 'image'
    if (mime === 'youtube_link' || mime === 'youtube') return 'youtube'
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime.startsWith('audio/')) return 'audio'
    if (mime.includes('pdf')) return 'pdf'
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation'
    return 'image'
  }

  function guessAssetCategory(contentType: string): string {
    if (!contentType) return 'image'
    if (contentType === 'youtube_link' || contentType === 'youtube') return 'youtube'
    if (contentType === 'pdf') return 'pdf'
    if (contentType === 'video') return 'video'
    if (contentType === 'presentation') return 'presentation'
    if (contentType === 'problem' || contentType === 'test') return 'problem'
    return 'image'
  }

  function guessCategory(file: File): string {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    if (ALLOWED_UPLOAD_MIMES[file.type] === 'presentation') return 'presentation'
    return 'image'
  }

  function guessContentType(file: File): string {
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    if (ALLOWED_UPLOAD_MIMES[file.type] === 'presentation') return 'presentation'
    return 'image'
  }

  function isUploadAllowed(file: File): boolean {
    // Точне співпадіння для image/pdf/presentation
    if (file.type in ALLOWED_UPLOAD_MIMES) return true
    // Prefix-matching для audio/video — браузери повертають різні варіанти:
    // audio/mp3, audio/x-m4a, video/quicktime, video/x-msvideo тощо
    if (file.type.startsWith('audio/')) return true
    if (file.type.startsWith('video/')) return true
    return false
  }

  async function uploadFile(file: File) {
    if (!isUploadAllowed(file)) {
      error.value = 'unsupported_format'
      return
    }

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
      const res = await learningContentApi.uploadFile(formData)
      const uploaded = (res as Record<string, unknown>).data as Record<string, unknown> ?? res as Record<string, unknown>

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

      // Auto-add to group
      if (groupId.value && uploaded.id) {
        try {
          await learningGroupApi.addMaterial(groupId.value, {
            content_item_id: uploaded.id as number,
          })
        } catch (e) {
          console.warn('[useGroupSidebar] Auto-add to group failed:', e)
        }
      }

      // Start polling to detect when processing completes
      startPolling()
    } catch (e: unknown) {
      console.warn('[useGroupSidebar] Upload failed:', e)
      items.value = items.value.filter(i => (i.content_item_id as unknown) !== tempId)
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

  const MAX_PARALLEL_UPLOADS = 3

  async function uploadFiles(files: File[]) {
    for (let i = 0; i < files.length; i += MAX_PARALLEL_UPLOADS) {
      const batch = files.slice(i, i + MAX_PARALLEL_UPLOADS)
      await Promise.all(batch.map(file => uploadFile(file)))
      if (error.value === 'quota_exceeded') break
    }
  }

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
