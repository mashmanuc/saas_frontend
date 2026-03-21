/**
 * useBoardClipboard — unified clipboard handler for Winterboard.
 *
 * Handles:
 * - Ctrl+V image → create WBAsset{type:'image'} + background upload
 * - Ctrl+V text  → create StickyNote on canvas center
 * - Ctrl+C selected objects → serialize to internal clipboard
 * - Ctrl+V internal clipboard → deserialize + new IDs + paste with offset
 * - Ctrl+X = copy + delete
 *
 * Architecture: local-first (instant preview) + background upload.
 * Ref: TASK_BOARD_PHASE_1a_2.md §8
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { WBAsset, WBStroke } from '../types/winterboard'
import { STICKY_DEFAULTS } from '../types/winterboard'
import { parseYouTubeVideoId, getYouTubeThumbnail } from '../utils/youtubeParser'
import { validateFile, fileToDataUrl, uploadFileToStorage } from './useImageUpload'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import { useToast } from './useToast'
import type { useWBStore } from '../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

interface BoardClipboardOptions {
  store: WBStore
  sessionId: () => string | null
  canvasCenter: () => { x: number; y: number }
  onAssetAdd: (asset: WBAsset) => void
  disabled?: () => boolean
  /** Phase 2: Called after successful upload — used for dual-write to lesson + library */
  onContentUploaded?: (contentItemId: number) => void
  /** Phase 3: lesson context for dual-write (pass only in ClassroomRoom) */
  lessonId?: () => number | null
  /** Phase 3: group context for dual-write (pass in SoloRoom for group boards) */
  groupId?: () => string | null
}

// Internal clipboard for board objects (strokes + assets)
interface InternalClipboard {
  strokes: WBStroke[]
  assets: WBAsset[]
  copiedAt: number
}

export function useBoardClipboard(options: BoardClipboardOptions) {
  const { store, sessionId, canvasCenter, onAssetAdd, disabled } = options
  const { showToast } = useToast()

  const internalClipboard = ref<InternalClipboard | null>(null)
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  // FIX: Flag to skip system clipboard when internal paste already handled Ctrl+V.
  // Without this, Ctrl+V pastes BOTH the internal board object AND the system
  // clipboard image simultaneously (double-paste bug).
  let _skipNextSystemPaste = false

  // ─── Paste handler (native 'paste' event) ──────────────────
  async function handlePaste(e: ClipboardEvent): Promise<void> {
    if (disabled?.()) return

    // If pasteInternal() already handled this Ctrl+V, skip system clipboard
    if (_skipNextSystemPaste) {
      _skipNextSystemPaste = false
      e.preventDefault()
      return
    }

    const items = e.clipboardData?.items
    if (!items) return

    // Priority 1: Image files (screenshot, copied image)
    const imageFiles: File[] = []
    let textContent: string | null = null

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        textContent = await new Promise<string>((resolve) => item.getAsString(resolve))
      }
    }

    // Handle image paste
    if (imageFiles.length > 0) {
      e.preventDefault()
      await handleImagePaste(imageFiles[0])
      return
    }

    // Handle text paste (only if NOT in an editable element)
    if (textContent && textContent.trim()) {
      const target = e.target as HTMLElement | null
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
      if (!isEditable) {
        e.preventDefault()
        handleTextPaste(textContent.trim())
        return
      }
    }
  }

  // ─── Image paste: instant preview + background upload ──────
  async function handleImagePaste(file: File): Promise<void> {
    const validation = validateFile(file)
    if (!validation.valid) {
      console.warn('[BoardClipboard] Image rejected:', validation.error)
      uploadError.value = validation.error ?? 'Invalid image'
      showToast(validation.error ?? 'Unsupported file format', 'warning')
      return
    }

    const center = canvasCenter()

    // Step 1: Instant preview with data:URL (local-first)
    try {
      const dataUrl = await fileToDataUrl(file)
      const img = new Image()
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        img.onload = () => {
          let w = img.naturalWidth
          let h = img.naturalHeight
          const maxDim = Math.max(w, h)
          if (maxDim > 300) {
            const scale = 300 / maxDim
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          resolve({ w, h })
        }
        img.onerror = () => resolve({ w: 300, h: 300 })
        img.src = dataUrl
      })

      const asset: WBAsset = {
        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        src: dataUrl,
        x: center.x - dims.w / 2,
        y: center.y - dims.h / 2,
        w: dims.w,
        h: dims.h,
        rotation: 0,
      }

      onAssetAdd(asset)
      console.info('[BoardClipboard] Image pasted (data:URL preview)')

      // Step 2: Background upload to storage (non-blocking)
      const sid = sessionId()
      if (sid) {
        isUploading.value = true
        uploadError.value = null
        try {
          const { assetUrl } = await uploadFileToStorage(sid, file)
          // Update asset src from data:URL to CDN URL via store.updateAsset
          const page = store.currentPage
          if (page) {
            const existing = page.assets.find((a) => a.id === asset.id)
            if (existing) {
              store.updateAsset({ ...existing, src: assetUrl }, { skipHistory: true })
            }
          }
          console.info('[BoardClipboard] Image uploaded to CDN')

          // Phase 3: Dual-write — create ContentItem in DB + auto-add to group/lesson
          try {
            const formData = new FormData()
            formData.append('file', file)
            const lid = options.lessonId?.()
            const gid = options.groupId?.()
            if (lid) formData.append('lesson_id', String(lid))
            if (gid) formData.append('group_id', gid)

            const uploadRes = await learningContentApi.uploadFile(formData)
            const contentItemId = (uploadRes as { id?: number; content_item_id?: number })?.content_item_id
              ?? (uploadRes as { id?: number })?.id

            if (contentItemId && options.onContentUploaded) {
              options.onContentUploaded(contentItemId)
            }
            console.info('[BoardClipboard] ContentItem created:', contentItemId)
            showToast('Saved to library', 'success', { duration: 3000 })
          } catch (dualWriteErr) {
            // Dual-write failure is non-critical — asset is already on the board
            console.warn('[BoardClipboard] Dual-write failed (non-critical):', dualWriteErr)
          }
        } catch (err) {
          console.error('[BoardClipboard] Background upload failed:', err)
          uploadError.value = 'Upload failed — image saved locally only'
          if ((err as any)?.response?.status === 507) {
            showToast('Storage quota exceeded. Delete old materials.', 'error', { duration: 10000 })
          } else {
            showToast('Upload failed — image saved to board only', 'error')
          }
          // Asset stays with data:URL — still visible on board
        } finally {
          isUploading.value = false
        }
      }
    } catch (err) {
      console.error('[BoardClipboard] Image paste failed:', err)
    }
  }

  // ─── Text paste: YouTube URL → player, otherwise StickyNote ─
  function handleTextPaste(text: string): void {
    const center = canvasCenter()

    // Phase 11 P2.2: Detect YouTube URL and create youtube_player asset
    const videoId = parseYouTubeVideoId(text)
    if (videoId) {
      const ytAsset: WBAsset = {
        id: `yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'youtube_player',
        src: text,
        youtubeUrl: text,
        x: center.x - 320,
        y: center.y - 180,
        w: 640,
        h: 360,
        rotation: 0,
        title: '',
        thumbnail: getYouTubeThumbnail(videoId),
      }
      onAssetAdd(ytAsset)
      console.info('[BoardClipboard] YouTube URL pasted as player', { videoId })
      return
    }

    // Truncate to 500 chars (matches store.updateStickyText limit)
    const truncated = text.length > 500 ? text.slice(0, 500) + '…' : text

    const sticky: WBAsset = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'sticky',
      src: '',
      x: center.x - STICKY_DEFAULTS.width / 2,
      y: center.y - STICKY_DEFAULTS.height / 2,
      w: STICKY_DEFAULTS.width,
      h: STICKY_DEFAULTS.height,
      rotation: 0,
      text: truncated,
      bgColor: STICKY_DEFAULTS.bgColor,
      textColor: STICKY_DEFAULTS.textColor,
      fontSize: STICKY_DEFAULTS.fontSize,
    }

    store.addStickyNote(sticky)
    console.info('[BoardClipboard] Text pasted as sticky note', { length: text.length })
  }

  // ─── Internal copy (board objects) ─────────────────────────
  function copySelected(): void {
    const selectedIds = store.selectedIds
    if (!selectedIds || selectedIds.length === 0) return

    const page = store.currentPage
    if (!page) return

    const copiedStrokes = page.strokes.filter((s) => selectedIds.includes(s.id))
    const copiedAssets = page.assets.filter((a) => selectedIds.includes(a.id))

    if (copiedStrokes.length === 0 && copiedAssets.length === 0) return

    internalClipboard.value = {
      strokes: JSON.parse(JSON.stringify(copiedStrokes)),
      assets: JSON.parse(JSON.stringify(copiedAssets)),
      copiedAt: Date.now(),
    }

    console.info('[BoardClipboard] Copied', {
      strokes: copiedStrokes.length,
      assets: copiedAssets.length,
    })
  }

  // ─── Internal paste (board objects) ────────────────────────
  function pasteInternal(): void {
    if (!internalClipboard.value) return

    // Signal handlePaste() to skip system clipboard for this Ctrl+V
    _skipNextSystemPaste = true

    const { strokes, assets } = internalClipboard.value
    const OFFSET = 20

    // Clone strokes with new IDs + offset
    for (const stroke of strokes) {
      const newStroke: WBStroke = {
        ...JSON.parse(JSON.stringify(stroke)),
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }
      // WBPoint has {x, y, ...} — offset each point
      newStroke.points = newStroke.points.map((p) => ({ ...p, x: p.x + OFFSET, y: p.y + OFFSET }))
      store.addStroke(newStroke)
    }

    // Clone assets with new IDs + offset
    for (const asset of assets) {
      const newAsset: WBAsset = {
        ...JSON.parse(JSON.stringify(asset)),
        id: `${asset.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: asset.x + OFFSET,
        y: asset.y + OFFSET,
      }
      onAssetAdd(newAsset)
    }

    console.info('[BoardClipboard] Pasted internal', {
      strokes: strokes.length,
      assets: assets.length,
    })
  }

  // ─── Cut = copy + delete ───────────────────────────────────
  function cutSelected(): void {
    copySelected()
    // Delete selected objects via store.deleteSelected (handles undo)
    store.deleteSelected()
  }

  // ─── Lifecycle ─────────────────────────────────────────────
  onMounted(() => {
    document.addEventListener('paste', handlePaste as EventListener)
  })

  onUnmounted(() => {
    document.removeEventListener('paste', handlePaste as EventListener)
  })

  return {
    // State
    isUploading,
    uploadError,
    internalClipboard,

    // Methods
    copySelected,
    pasteInternal,
    cutSelected,
    handlePaste,
  }
}
