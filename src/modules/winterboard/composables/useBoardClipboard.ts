/**
 * useBoardClipboard — unified clipboard handler for Winterboard.
 *
 * Handles:
 * - Ctrl+V image → optimistic asset_add з blob URL (status='uploading'),
 *                  background S3 upload, asset_update з final URL (status='ready')
 * - Ctrl+V text  → create StickyNote on canvas center
 * - Ctrl+C selected objects → serialize to internal clipboard
 * - Ctrl+V internal clipboard → deserialize + new IDs + paste with offset
 * - Ctrl+X = copy + delete
 *
 * Architecture: OPTIMISTIC paste (P0 UX 2026-04-28).
 *
 *   Старий "upload-first" інваріант (asset_add ТІЛЬКИ після upload) дав 1-2с
 *   delay на render через S3 round-trip. Тепер:
 *
 *     1. paste → blob URL → asset_add IMMEDIATELY (status='uploading') → render <100мс
 *     2. background presign + S3 PUT + confirm
 *     3. asset_update з final URL (status='ready')
 *     4. revoke blob URL
 *     5. fail → asset_update з status='error' + retry UI
 *
 *   Інваріанти збережені:
 *     - blob URL у boardStore — FE-only TEMP, замінюється до того як op потрапить
 *       у BE. recorder.ts strip-ає blob: prefix у payload (як і data:).
 *     - status='uploading'/'error' — FE-only (recorder strip-ає у payload).
 *     - INV-14 op_id stable: asset.id = backend asset_id (резервується presign
 *       синхронно перед asset_add — див. _reserveAssetId).
 *     - Replay deterministic: BE отримує asset_add з src='' (strip), потім
 *       asset_update з final URL — replay рендерить final state.
 *
 *   Multi-paste обмежується глобальним semaphore (useUploadQueue) до 3 одночасних
 *   uploads, щоб не тригерити 429 на бекенді.
 *
 * Ref: TASK_BOARD_PHASE_1a_2.md §8, plan lazy-kindling-simon.md
 *      P0 UX fix: instant image paste (2026-04-28)
 */

import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { WBAsset, WBStroke } from '../types/winterboard'
import { STICKY_DEFAULTS } from '../types/winterboard'
import { parseYouTubeVideoId, getYouTubeThumbnail } from '../utils/youtubeParser'
import {
  validateFile,
  presignOnly,
  uploadAndConfirm,
  WBUploadError,
  type WBUploadErrorDetails,
  type PresignedAssetMeta,
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
  /**
   * P0 UX (2026-04-28): called когда optimistic image paste завершує upload —
   * замінити blob URL на final S3/CDN URL та зняти status='uploading'.
   *
   * Якщо опція не передана — fallback на store.updateAsset напряму.
   * Caller може override для додаткової логіки (history tracking тощо).
   */
  onAssetUpdate?: (asset: WBAsset) => void
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

  // P0 UX: onAssetUpdate fallback — direct store call якщо caller не передав.
  // store.updateAsset вже emit-ить asset_update op через _emitOperation.
  const onAssetUpdate: (asset: WBAsset) => void = options.onAssetUpdate
    ?? ((asset: WBAsset) => { store.updateAsset(asset) })
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

  // ─── Paste handler (native 'paste' event) ──────────────────
  //
  // Routing за вмістом OS clipboard:
  //   1. text === WB_CLIPBOARD_MARKER → internal paste (board object)
  //   2. image files → upload + asset_add
  //   3. інший text → sticky note (якщо target не editable)
  //
  // MARKER пишеться синхронно у copySelected() через hidden textarea +
  // execCommand('copy'). Це гарантує що між board Ctrl+C та наступним Ctrl+V
  // OS clipboard точно має наш marker (sync write, не race-иться з навантаженим
  // event loop під recording). Якщо юзер переключився і скопіював щось зовні —
  // OS clipboard перезаписаний external'ом, text ≠ marker → йдемо у branch 2/3.
  async function handlePaste(e: ClipboardEvent): Promise<void> {
    if (disabled?.()) return
    const dt = e.clipboardData
    if (!dt) return

    // getData — SYNCHRONOUS, повертає '' якщо text/plain немає.
    const text = dt.getData('text/plain') || ''

    // Priority 1: MARKER → internal paste
    if (text === WB_CLIPBOARD_MARKER && internalClipboard.value) {
      e.preventDefault()
      pasteInternal()
      return
    }

    // Priority 2: image files
    const items = dt.items
    const imageFiles: File[] = []
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
    }

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
      //   - quotaToastShown гарантує ОДИН error toast при race 429
      const batch = _createBatchContext()
      imageFiles.forEach((file, index) => {
        void handleImagePaste(file, index, batch)
      })
      return
    }

    // Priority 3: text (sticky note) — тільки якщо target не editable
    if (text && text.trim()) {
      const target = e.target as HTMLElement | null
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
      if (!isEditable) {
        e.preventDefault()
        handleTextPaste(text.trim())
      }
    }
  }

  // ─── Image paste: OPTIMISTIC (P0 UX 2026-04-28) ───────────────────────
  //
  // Етапи:
  //   1. presign (sync, ~50-200ms) — отримати asset_id + final CDN url від BE
  //   2. emit asset_add IMMEDIATELY з blob URL + status='uploading' → instant render
  //   3. background: S3 PUT + confirm (через global semaphore, до 3 паралельних)
  //   4. confirm OK → asset_update з final src + status='ready' + revoke blob URL
  //   5. confirm fail → asset_update з status='error', toast Retry
  //
  // Інваріанти збережені:
  //   - asset_add у BE не отримує blob URL (recorder strip-ає blob: → src='').
  //     Final CDN url прилітає окремим asset_update після successful confirm.
  //   - INV-14 op_id stable — asset.id = BE asset_id (з presign), той самий
  //     для asset_add і asset_update. Replay deterministic.
  //   - Recorder strip-ає 'status' і 'errorMessage' поля з ops payload —
  //     FE-only optimistic flags не персистимо.
  //   - При presign fail (403/429/quota) — НЕ додаємо asset на дошку взагалі
  //     (немає валідного asset_id) → жодних ghost-объектів.
  //
  // batch: shared контекст на цілий paste-batch. Перший quota_exceeded на
  // presign викликає batch.controller.abort() → всі решта pending presigns
  // негайно припиняються (без додаткових toast і без зайвих BE запитів).
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

    // ─── Stage 1: presign + blob dim preload IN PARALLEL ──────────
    //
    // Bug fix 2026-05-06: попередня версія використовувала hardcoded 300×300
    // для placeholder → Konva.Image розтягувала landscape/portrait картинки
    // у квадрат до завершення upload, потім re-layout у correct ratio →
    // visible "squish then jump" jank.
    //
    // Тепер: blob dim preload (~10-50ms — local file decode) запускається
    // PARALLEL з presign network roundtrip (50-200ms). Effective extra
    // latency = 0 (preload завершується до presign-у). Placeholder одразу
    // має правильні пропорції.
    const blobUrl = URL.createObjectURL(file)
    const dimsPromise = _imageDimsFromBlob(blobUrl).catch(() => ({ w: 300, h: 300 }))

    let meta: PresignedAssetMeta
    try {
      meta = await presignOnly(sid, file, signal)
    } catch (err) {
      try { URL.revokeObjectURL(blobUrl) } catch { /* */ }
      isUploading.value = false
      _handlePresignFailure(err, file, index, batch)
      return
    }

    // Dims зазвичай готові до цього моменту (presign повільніший за local
    // image decode), але await на всякий випадок.
    const dims = await dimsPromise

    // ─── Stage 2: build local placeholder з blob URL → INSTANT render ──
    //
    // blob URL живе тільки у FE memory; BE не побачить його — recorder strip-ає
    // blob: → '' у asset_add op payload. Final CDN url прилетить asset_update'ом
    // після successful confirm.

    const center = canvasCenter()
    const OFFSET_PER_INDEX = 20
    const placeholder: WBAsset = {
      id: meta.assetId,
      type: 'image',
      src: blobUrl, // FE-only blob URL — recorder strip-ає до '' у BE op
      x: center.x - dims.w / 2 + index * OFFSET_PER_INDEX,
      y: center.y - dims.h / 2 + index * OFFSET_PER_INDEX,
      w: dims.w,
      h: dims.h,
      rotation: 0,
      status: 'uploading',
    }

    onAssetAdd(placeholder)
    console.info('[BoardClipboard] Image pasted (optimistic)', { assetId: meta.assetId, w: dims.w, h: dims.h })

    // ─── Stage 3: background S3 PUT + confirm (з semaphore) ───────
    void _backgroundUpload(file, meta, blobUrl, dims, placeholder, sid, index, batch, signal)
  }

  /**
   * Async preload natural dimensions з blob URL.
   *
   * Local blob decode швидкий (~10-50ms typical) — не додає видимої затримки
   * бо запускається parallel з presign (50-200ms network). Scale до 300px max
   * зберігаючи aspect ratio, мінімальний lower bound 1px.
   *
   * Caller має ловити reject (network error на blob URL малоймовірно, але
   * defensive). Fallback до 300×300 на caller-side.
   */
  function _imageDimsFromBlob(blobUrl: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth || 0
        let h = img.naturalHeight || 0
        if (w <= 0 || h <= 0) {
          reject(new Error('[BoardClipboard] Invalid blob image dimensions'))
          return
        }
        const maxDim = Math.max(w, h)
        if (maxDim > 300) {
          const scale = 300 / maxDim
          w = Math.round(w * scale)
          h = Math.round(h * scale)
        }
        resolve({ w, h })
      }
      img.onerror = () => {
        reject(new Error('[BoardClipboard] Failed to load blob for dimensions'))
      }
      img.src = blobUrl
    })
  }

  /**
   * Background stage: S3 PUT + confirm через semaphore.
   * Окремою функцією щоб handleImagePaste повернувся одразу після emit asset_add.
   */
  async function _backgroundUpload(
    file: File,
    meta: PresignedAssetMeta,
    blobUrl: string,
    initialDims: { w: number; h: number },
    placeholder: WBAsset,
    sid: string,
    index: number,
    batch: BatchContext | undefined,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    let blobRevoked = false
    const _revokeOnce = () => {
      if (blobRevoked) return
      blobRevoked = true
      try { URL.revokeObjectURL(blobUrl) } catch { /* */ }
    }

    try {
      await withUploadSlot(
        () => uploadAndConfirm(sid, file, meta, undefined, signal),
        signal,
      )

      // Preload final CDN URL і отримуємо natural dims (можуть відрізнятись
      // від blob — особливо якщо BE re-encode-ить великі картинки).
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const preload = new Image()
        preload.onload = () => {
          let w = preload.naturalWidth || initialDims.w
          let h = preload.naturalHeight || initialDims.h
          const maxDim = Math.max(w, h)
          if (maxDim > 300) {
            const scale = 300 / maxDim
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          resolve({ w, h })
        }
        preload.onerror = () => resolve(initialDims)
        preload.src = meta.assetUrl
      })

      // Stage 4: emit asset_update з final URL + status='ready'.
      // Той самий asset.id → INV-14 stable; recorder strip-ає 'status' з payload.
      //
      // Bug fix 2026-05-06: якщо CDN-side dims === blob-side dims (typical
      // case — BE re-encode не змінює resolution), preserve placeholder w/h
      // У asset_update без зміни. Avoids re-layout flicker (Vue reactivity
      // на same primitive value не ре-рендерить, але defensive — fewer ops
      // payload size теж краще).
      //
      // src + status MUST update завжди (replay invariant: BE asset_add отримує
      // blob: → '' від recorder; final CDN url прилітає тільки через цей
      // asset_update). Тож "skip update entirely" неможливо без порушення
      // replay determinism — мінімум src swap обов'язковий.
      const dimsUnchanged = dims.w === placeholder.w && dims.h === placeholder.h
      const finalAsset: WBAsset = dimsUnchanged
        ? { ...placeholder, src: meta.assetUrl, status: 'ready' }
        : { ...placeholder, src: meta.assetUrl, w: dims.w, h: dims.h, status: 'ready' }
      onAssetUpdate(finalAsset)
      // 2026-05-13: чекаємо Vue tick перед revoke blob URL.
      // onAssetUpdate() оновлює Pinia store синхронно, але DOM commit (canvas re-render)
      // відбувається в наступному tick. Без nextTick: canvas ще читає blob: src,
      // а ми вже revoke → ERR_FILE_NOT_FOUND (спостерігалось у реальній сесії n36).
      await nextTick()
      _revokeOnce()
      console.info('[BoardClipboard] Image upload finalized', {
        assetId: meta.assetId,
        dimsUnchanged,
        finalW: finalAsset.w,
        finalH: finalAsset.h,
      })

      // Dual-write до learning-content (non-critical).
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
        console.warn('[BoardClipboard] Dual-write failed (non-critical):', dualWriteErr)
      }
    } catch (err) {
      _revokeOnce()
      _handleBackgroundUploadFailure(err, file, placeholder, index, batch)
    } finally {
      isUploading.value = false
    }
  }

  /**
   * Presign failure handler — НЕ було emit asset_add, тож просто toast.
   */
  function _handlePresignFailure(
    err: unknown,
    file: File,
    index: number,
    batch: BatchContext | undefined,
  ): void {
    if (err instanceof UploadAbortedError) {
      console.info('[BoardClipboard] Presign skipped — batch aborted', { index })
      return
    }
    if (err instanceof WBUploadError && err.code === 'cancelled') {
      console.info('[BoardClipboard] Presign skipped — cancelled', { index })
      return
    }

    console.error('[BoardClipboard] Presign failed:', err)
    const code = err instanceof WBUploadError ? err.code : 'unknown'
    const details = err instanceof WBUploadError ? err.details : undefined

    if (code === 'quota_exceeded') {
      batch?.controller.abort()
      uploadError.value = 'Storage quota exceeded'
      if (!batch || !batch.quotaToastShown) {
        if (batch) batch.quotaToastShown = true
        showToast(formatQuotaMessage(details), 'error', { duration: 10000 })
      }
    } else if (code === 'unknown_429') {
      uploadError.value = 'Upload rejected by server'
      showToast(
        details?.detail ?? 'Server rejected the request (429). Try again later.',
        'error',
        { duration: 10000 },
      )
    } else {
      // Presign fail (network/rate_limit/etc) → пропонуємо Retry.
      const retryFile = new File([file], file.name, { type: file.type })
      uploadError.value = 'Upload failed'
      showToast('Upload failed', 'error', {
        duration: 10000,
        action: {
          label: 'Retry',
          callback: () => { void handleImagePaste(retryFile, index, _createBatchContext()) },
        },
      })
    }
  }

  /**
   * Background upload failure handler — asset УЖЕ на дошці з blob URL.
   * Позначаємо status='error' через asset_update щоб UI показав retry badge.
   */
  function _handleBackgroundUploadFailure(
    err: unknown,
    file: File,
    placeholder: WBAsset,
    index: number,
    batch: BatchContext | undefined,
  ): void {
    if (err instanceof UploadAbortedError
        || (err instanceof WBUploadError && err.code === 'cancelled')) {
      // Aborted — позначаємо status='error' щоб юзер міг вирішити (retry / delete)
      console.info('[BoardClipboard] Background upload aborted', { id: placeholder.id })
      onAssetUpdate({ ...placeholder, status: 'error', errorMessage: 'Upload cancelled' })
      return
    }

    console.error('[BoardClipboard] Background upload failed:', err)
    const code = err instanceof WBUploadError ? err.code : 'unknown'
    const details = err instanceof WBUploadError ? err.details : undefined
    const message = err instanceof WBUploadError ? err.message : 'Upload failed'

    // Mark asset як failed — UI може показати retry badge / red border.
    onAssetUpdate({
      ...placeholder,
      status: 'error',
      errorMessage: message,
    })

    if (code === 'quota_exceeded') {
      batch?.controller.abort()
      uploadError.value = 'Storage quota exceeded'
      if (!batch || !batch.quotaToastShown) {
        if (batch) batch.quotaToastShown = true
        showToast(formatQuotaMessage(details), 'error', { duration: 10000 })
      }
    } else if (code === 'unknown_429') {
      uploadError.value = 'Upload rejected by server'
      showToast(
        details?.detail ?? 'Server rejected the request (429). Try again later.',
        'error',
        { duration: 10000 },
      )
    } else {
      const retryFile = new File([file], file.name, { type: file.type })
      uploadError.value = 'Upload failed'
      showToast('Upload failed', 'error', {
        duration: 10000,
        action: {
          label: 'Retry',
          // Retry повністю заново — старий placeholder потрібно видалити окремою UI дією.
          // (Або юзер натискає retry → новий paste flow → новий asset.)
          callback: () => { void handleImagePaste(retryFile, index, _createBatchContext()) },
        },
      })
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

  // Marker written to system clipboard so Ctrl+C on board objects
  // doesn't clear user's previous system clipboard content.
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

    // Synchronous marker write — критично: async navigator.clipboard.writeText
    // під navigation recording load резолвиться із затримкою 100-700ms і може
    // перезаписати зовнішній copy що стався у цей проміжок. execCommand
    // синхронний — OS clipboard отримує marker до повернення keydown handler'а.
    _writeMarkerSync()

    console.info('[BoardClipboard] Copied', {
      strokes: copiedStrokes.length,
      assets: copiedAssets.length,
    })
  }

  // Синхронний запис marker у OS clipboard через hidden textarea +
  // document.execCommand('copy'). execCommand deprecated, але у 2026 лишається
  // єдиним sync API запису у clipboard — Clipboard API повністю async.
  // У jsdom execCommand throw/false — silent-fail (тести використовують
  // internalClipboard напряму).
  function _writeMarkerSync(): void {
    const ta = document.createElement('textarea')
    ta.value = WB_CLIPBOARD_MARKER
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    const prev = document.activeElement as HTMLElement | null
    try {
      ta.focus()
      ta.select()
      document.execCommand('copy')
    } catch { /* jsdom / blocked */ }
    finally {
      try { document.body.removeChild(ta) } catch { /* */ }
      try { prev?.focus?.() } catch { /* */ }
    }
  }

  // ─── Internal paste (board objects) ────────────────────────
  // BATCH: all strokes added in ONE store mutation + ONE op.
  // Same for assets. Replay shows all pasted objects appearing together
  // (no "typing" effect — one Vue render per batch).
  function pasteInternal(): void {
    if (!internalClipboard.value) return

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
