/**
 * useBoardClipboard — unified clipboard handler for Winterboard.
 *
 * Handles:
 * - Ctrl+V image → upload-first: presign → S3 PUT → confirm → addAsset з CDN URL
 * - Ctrl+V text  → create StickyNote on canvas center
 * - Ctrl+C selected objects → serialize to internal clipboard
 * - Ctrl+V internal clipboard → deserialize + new IDs + paste with offset
 * - Ctrl+X = copy + delete
 *
 * Architecture: STRICT upload-first.
 *   Інваріант: asset_add op створюється виключно після успішного upload.
 *   На fail asset не з'являється — користувач бачить toast із Retry.
 *   Multi-paste обмежується глобальним semaphore (useUploadQueue) до 3 одночасних
 *   uploads, щоб не тригерити 429 на бекенді.
 *
 * Ref: TASK_BOARD_PHASE_1a_2.md §8, plan lazy-kindling-simon.md
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { WBAsset, WBStroke } from '../types/winterboard'
import { STICKY_DEFAULTS } from '../types/winterboard'
import { parseYouTubeVideoId, getYouTubeThumbnail } from '../utils/youtubeParser'
import {
  validateFile,
  uploadFileToStorage,
  WBUploadError,
  type WBUploadErrorDetails,
} from './useImageUpload'
import { withUploadSlot, UploadAbortedError } from './useUploadQueue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'
import type { useWBStore } from '../board/state/boardStore'

/**
 * Максимум зображень за одну paste-операцію. Захист від accidental paste
 * великого clipboard (drag-folder з 200 файлами, скрипт-вставка тощо) — щоб
 * не флудити BE rate-limit і не лишати orphan'ів у storage.
 */
const MAX_PASTE_BATCH = 50

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

/**
 * Контекст одного paste-batch: shared AbortController для hard stop при quota
 * + прапорець quotaToastShown для singleton-toast (інакше при 16 paste, де
 * 3 паралельні uploads хитнуть quota майже одночасно — користувач отримає
 * 3 ідентичні error toast'и).
 */
interface BatchContext {
  controller: AbortController
  quotaToastShown: boolean
}

function _createBatchContext(): BatchContext {
  return { controller: new AbortController(), quotaToastShown: false }
}

export function useBoardClipboard(options: BoardClipboardOptions) {
  const { store, sessionId, canvasCenter, onAssetAdd, disabled } = options
  const { showToast } = useToast()
  // i18n опціонально — у тестах поза Vue компонентом може не бути активного
  // i18n instance. Fallback на англ. рядки не критичний.
  let _t: ((key: string, params?: Record<string, unknown>) => string) | null = null
  try {
    const { t } = useI18n()
    _t = t
  } catch {
    _t = null
  }
  const tr = (key: string, params?: Record<string, unknown>) => _t ? _t(key, params) : key

  const internalClipboard = ref<InternalClipboard | null>(null)
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  // ─── Paste handler (native 'paste' event) — SINGLE SOURCE OF TRUTH ──
  //
  // All Ctrl+V decisions happen here. useKeyboard no longer calls
  // pasteInternal() directly on Ctrl+V keydown — that created a race where
  // internal objects were pasted even when OS clipboard had fresh external
  // content (user copies from Word after internal copy → Ctrl+V still
  // pastes old board object).
  //
  // Decision tree (OS clipboard is source of truth):
  //   1. OS clipboard has image files → paste image(s), ignore internal
  //   2. OS clipboard has text === WB_CLIPBOARD_MARKER → paste internal
  //      (user copied from board most recently, OS not overwritten since)
  //   3. OS clipboard has real text (not marker) → sticky note, ignore internal
  //   4. OS clipboard empty AND internalClipboard has content → paste internal
  //      (fallback: no OS write perm, or OS cleared on tab focus, etc.)
  async function handlePaste(e: ClipboardEvent): Promise<void> {
    if (disabled?.()) return

    const items = e.clipboardData?.items
    if (!items) {
      // No clipboardData at all — fallback to internal if we have any
      if (internalClipboard.value) {
        e.preventDefault()
        pasteInternal()
      }
      return
    }

    // Collect everything from OS clipboard
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

    // Priority 1: External image wins over everything
    if (imageFiles.length > 0) {
      e.preventDefault()

      // Hard cap: захист від випадкового paste великих clipboard (drag-folder,
      // bulk script). Hard reject — не часткове виконання, бо часткове =
      // непередбачувано (юзер не зрозуміє чому 50 з 76).
      if (imageFiles.length > MAX_PASTE_BATCH) {
        console.warn('[BoardClipboard] paste batch too large:', imageFiles.length)
        showToast(
          tr('winterboard.upload.tooManyImages', {
            count: imageFiles.length,
            max: MAX_PASTE_BATCH,
          }),
          'warning',
          { duration: 8000 },
        )
        return
      }

      // Один BatchContext на весь paste-batch:
      //   - controller.abort() на першому quota_exceeded зупиняє решту pending
      //     (waiting у semaphore + retry-loop активних + реальний fetch у API)
      //   - quotaToastShown гарантує ОДИН error toast навіть якщо кілька
      //     паралельних uploads отримали 429 quota одночасно (race до abort)
      const batch = _createBatchContext()
      // index захоплюємо ЗАРАЗ (не на момент upload completion), щоб offsets
      // були передбачуваними незалежно від того, які upload закінчаться першими.
      imageFiles.forEach((file, index) => {
        void handleImagePaste(file, index, batch)
      })
      return
    }

    // Priority 2: Text — route by marker
    if (textContent !== null) {
      // Marker = internal board copy; paste cloned objects
      if (textContent === WB_CLIPBOARD_MARKER) {
        if (internalClipboard.value) {
          e.preventDefault()
          pasteInternal()
        }
        // else: marker came from another tab but no local state — skip silently
        return
      }

      // Real external text → sticky note (if not in input field)
      if (textContent.trim()) {
        const target = e.target as HTMLElement | null
        const isEditable = target?.tagName === 'INPUT'
          || target?.tagName === 'TEXTAREA'
          || target?.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          handleTextPaste(textContent.trim())
        }
      }
      return
    }

    // Priority 4: OS clipboard had no usable content → fallback to internal
    if (internalClipboard.value) {
      e.preventDefault()
      pasteInternal()
    }
  }

  // ─── Image paste: STRICT upload-first ──────────────────────
  //
  // Інваріант: asset_add op створюється ВИКЛЮЧНО після успішного upload.
  // На fail asset не з'являється; toast пропонує Retry. dataURL у boardStore
  // не потрапляє ніколи — це фундаментально важливо для replay (recorder
  // strip-ить data:URL у '', тож asset з dataURL дав би broken image у replay).
  //
  // batch: shared контекст на цілий paste-batch. Перший quota_exceeded
  // викликає batch.controller.abort() → всі решта uploads негайно припиняються
  // з кодом 'cancelled' (без додаткових toast і без зайвих BE запитів).
  // batch.quotaToastShown — захист від дублювання error toast при race
  // (3 паралельні uploads отримали 429 quota майже одночасно).
  async function handleImagePaste(
    file: File,
    index: number = 0,
    batch?: BatchContext,
  ): Promise<void> {
    const validation = validateFile(file)
    if (!validation.valid) {
      console.warn('[BoardClipboard] Image rejected:', validation.error)
      uploadError.value = validation.error ?? 'Invalid image'
      showToast(validation.error ?? 'Unsupported file format', 'warning')
      return
    }

    const sid = sessionId()
    if (!sid) {
      console.warn('[BoardClipboard] Image paste: no active session, skipping')
      showToast('No active session', 'warning')
      return
    }

    isUploading.value = true
    uploadError.value = null

    const signal = batch?.controller.signal

    try {
      // Concurrency-обмежений upload. До 3 одночасних uploads глобально —
      // решта чекає у черзі. Усередині є retry на 429/network.
      // Signal прокидаємо у обидва шари: queue (skip pending), retry-loop (skip retry).
      const { assetId, assetUrl } = await withUploadSlot(
        () => uploadFileToStorage(sid, file, undefined, signal),
        signal,
      )

      // Preload CDN URL у браузерному кеші ДО створення asset, щоб канвас
      // отримав готовий bitmap і не показав порожнє місце на ~200мс.
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const preload = new Image()
        preload.onload = () => {
          let w = preload.naturalWidth || 300
          let h = preload.naturalHeight || 300
          const maxDim = Math.max(w, h)
          if (maxDim > 300) {
            const scale = 300 / maxDim
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          resolve({ w, h })
        }
        preload.onerror = () => resolve({ w: 300, h: 300 })
        preload.src = assetUrl
      })

      // Multi-paste offset: index захоплено в момент paste, не completion.
      const center = canvasCenter()
      const OFFSET_PER_INDEX = 20
      const asset: WBAsset = {
        id: assetId, // використовуємо backend asset_id — він стабільний для replay
        type: 'image',
        src: assetUrl,
        x: center.x - dims.w / 2 + index * OFFSET_PER_INDEX,
        y: center.y - dims.h / 2 + index * OFFSET_PER_INDEX,
        w: dims.w,
        h: dims.h,
        rotation: 0,
      }

      onAssetAdd(asset)
      console.info('[BoardClipboard] Image pasted (upload-first)', { assetId })

      // Dual-write до learning-content (non-critical, не блокує основний flow).
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('source', 'paste')
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
        // Не блокує — asset уже на дошці, у storage збережений.
        console.warn('[BoardClipboard] Dual-write failed (non-critical):', dualWriteErr)
      }
    } catch (err) {
      // ─── Cancelled (batch abort через quota в одному з паралельних) ────
      // Silent skip: toast про quota вже показано тим, хто ініціював abort.
      if (err instanceof UploadAbortedError) {
        console.info('[BoardClipboard] Upload skipped — batch aborted', { index })
        return
      }
      if (err instanceof WBUploadError && err.code === 'cancelled') {
        console.info('[BoardClipboard] Upload skipped — cancelled', { index })
        return
      }

      console.error('[BoardClipboard] Upload failed:', err)
      const code = err instanceof WBUploadError ? err.code : 'unknown'
      const details = err instanceof WBUploadError ? err.details : undefined

      if (code === 'quota_exceeded') {
        // Permanent: квота вичерпана, retry не допоможе.
        // HARD STOP: скасовуємо весь решту batch — щоб не спамити BE та
        // не лишати orphan-файлів у storage (signal перерве реальні fetch).
        batch?.controller.abort()
        uploadError.value = 'Storage quota exceeded'
        // SINGLETON toast: тільки перший quota-fail у batch показує сповіщення.
        // Решта паралельних, що могли отримати 429 quota одночасно (до того як
        // abort долетів) — silent skip, інакше юзер побачить N однакових toast.
        if (!batch || !batch.quotaToastShown) {
          if (batch) batch.quotaToastShown = true
          showToast(formatQuotaMessage(details), 'error', { duration: 10000 })
        }
      } else if (code === 'unknown_429') {
        // 429 з невідомим body.error — після 1 retry (CDN edge) все ще fail.
        uploadError.value = 'Upload rejected by server'
        showToast(
          details?.detail ?? 'Server rejected the request (429). Try again later.',
          'error',
          { duration: 10000 },
        )
      } else {
        // Transient (rate_limited вичерпав retry) або presign/upload/confirm fail —
        // пропонуємо Retry.
        // FIX: клонуємо File у новий Blob, щоб toast closure не залежав від
        // потенційно GC-нутого реф (особливо коли paste був з clipboard items
        // що вже звільнились).
        const retryFile = new File([file], file.name, { type: file.type })
        uploadError.value = 'Upload failed'
        showToast('Upload failed', 'error', {
          duration: 10000,
          action: {
            label: 'Retry',
            // Новий BatchContext для retry — старий уже міг бути aborted.
            callback: () => { void handleImagePaste(retryFile, index, _createBatchContext()) },
          },
        })
      }
    } finally {
      isUploading.value = false
    }
  }

  /**
   * Формує UX-friendly повідомлення про вичерпану квоту з backend details.
   * Backend повертає:
   *   - max_assets quota: { current, limit }
   *   - storage size quota: { current_bytes, limit_bytes }
   *   - DRF throttle: { detail }
   */
  function formatQuotaMessage(details?: WBUploadErrorDetails): string {
    if (details?.current_bytes != null && details?.limit_bytes != null) {
      const usedMb = (details.current_bytes / (1024 * 1024)).toFixed(1)
      const limitMb = (details.limit_bytes / (1024 * 1024)).toFixed(1)
      return `Storage quota exceeded (${usedMb}/${limitMb} MB). Delete old materials.`
    }
    if (details?.current != null && details?.limit != null) {
      return `Asset limit reached (${details.current}/${details.limit}). Delete old assets.`
    }
    return 'Storage quota exceeded. Delete old materials and try again.'
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
  //
  // Design decision (2026-04-21 fix after recording-clipboard race bug):
  //   We DO NOT write anything to the OS clipboard. Internal state lives
  //   only in the local `internalClipboard` ref.
  //
  // Why the old MARKER approach failed:
  //   Previously copySelected() fired navigator.clipboard.writeText(MARKER)
  //   as fire-and-forget async. When replay recording was ON, the JS event
  //   loop backed up (recording emits ops every few ms + batch POSTs +
  //   snapshots), and the queued writeText executed HUNDREDS of ms later.
  //   If the user copied external content (e.g. text from Word) in the
  //   meantime, our delayed MARKER write overwrote it — user's external
  //   content lost, and Ctrl+V on board pasted internal objects because
  //   MARKER was detected in OS clipboard.
  //
  // Trade-off under new design:
  //   Board Ctrl+V follows OS clipboard first (image/text), falls back to
  //   internal only when OS clipboard is empty. To paste board objects
  //   when OS clipboard has unrelated content, users must use the context
  //   menu "Paste" button (which calls pasteInternal() directly).
  //
  // Legacy marker constant kept for handlePaste reference in case older
  // clipboard state from prior version lingers — we still recognize and
  // route it as internal, just no longer write it.
  const WB_CLIPBOARD_MARKER = '__wb_internal_copy__'

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

    // Intentionally NO writeText to OS clipboard — see design note above.
    // User's external clipboard content is left untouched.

    console.info('[BoardClipboard] Copied', {
      strokes: copiedStrokes.length,
      assets: copiedAssets.length,
    })
  }

  // ─── Internal paste (board objects) ────────────────────────
  // BATCH: all strokes added in ONE store mutation + ONE op.
  // Same for assets. Replay shows all pasted objects appearing together
  // (no "typing" effect — one Vue render per batch).
  function pasteInternal(): void {
    if (!internalClipboard.value) return

    // Called from:
    //   - handlePaste() when OS clipboard has our marker (Ctrl+V path)
    //   - Context-menu "Paste" button (explicit user choice)
    // No flag needed — handlePaste now checks OS clipboard content first
    // and only calls us when internal paste is the correct action.

    const { strokes, assets } = internalClipboard.value
    const OFFSET = 40
    const pastedIds: string[] = []

    // Clone strokes with new IDs + offset (collect, don't add yet)
    const newStrokes: WBStroke[] = strokes.map((stroke) => {
      const newId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      pastedIds.push(newId)
      const cloned: WBStroke = {
        ...JSON.parse(JSON.stringify(stroke)),
        id: newId,
      }
      cloned.points = cloned.points.map((p) => ({ ...p, x: p.x + OFFSET, y: p.y + OFFSET }))
      return cloned
    })

    // Clone assets with new IDs + offset (collect, don't add yet)
    const newAssets: WBAsset[] = assets.map((asset) => {
      const newId = `${asset.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      pastedIds.push(newId)
      const newAsset: WBAsset = {
        ...JSON.parse(JSON.stringify(asset)),
        id: newId,
        x: asset.x + OFFSET,
        y: asset.y + OFFSET,
      }
      // S5: geometry_2d — offset absolute vertices/center (not just asset.x/y)
      if (newAsset.type === 'geometry_2d' && newAsset.geometryParams) {
        if (newAsset.geometryParams.vertices) {
          newAsset.geometryParams.vertices = newAsset.geometryParams.vertices.map(
            (v: { x: number; y: number }) => ({ x: v.x + OFFSET, y: v.y + OFFSET }),
          )
        }
        if (newAsset.geometryParams.cx != null) {
          newAsset.geometryParams.cx += OFFSET
        }
        if (newAsset.geometryParams.cy != null) {
          newAsset.geometryParams.cy += OFFSET
        }
      }
      return newAsset
    })

    // BATCH: single mutation + single op for each kind
    if (newStrokes.length > 0) store.addStrokesBatch(newStrokes)
    if (newAssets.length > 0) store.addAssetsBatch(newAssets)

    // Auto-select all pasted objects so user can move them as a group
    if (pastedIds.length > 0) {
      store.selectedIds = pastedIds
    }

    console.info('[BoardClipboard] Pasted internal (batch)', {
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
