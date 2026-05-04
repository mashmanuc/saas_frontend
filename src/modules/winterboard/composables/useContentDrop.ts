import { type Ref } from 'vue'
import { learningContentApi, renderContentToSvgDataUrl } from '@/modules/learning-content'
import type { ContentDragPayload } from '@/modules/learning-content'
import type { WBAsset, SolidAsset, SolidType } from '../types/winterboard'
import {
  SIDEBAR_DRAG_MIME,
  CONTENT_DRAG_MIME,
  DEFAULT_BOARD_SIZES,
  type SidebarDragPayload,
  type ResolveDropResponse,
} from '../types/boardDrop'
import {
  DEFAULT_SOLID_STATE,
  DEFAULT_SOLID_W,
  DEFAULT_SOLID_H,
  SOLID_DRAG_MIME,
  type SolidDragPayload,
} from '../constants/solidDefaults'

// Phase O PR-O4: 10 fixed solid types — must match SolidType union exactly.
const SOLID_TYPE_SET: ReadonlySet<SolidType> = new Set([
  'cube', 'cuboid', 'sphere', 'cylinder', 'cone',
  'tetrahedron', 'pyramid3', 'pyramid4', 'prism3', 'prism6',
])

/**
 * Options for useContentDrop composable.
 *
 * screenToCanvas converts DragEvent screen coordinates to canvas-space coordinates.
 * The conversion must match the existing WBCanvas.vue handleDrop logic:
 *   canvasX = (clientX - rect.left) / zoom
 * where rect = canvasContainer.getBoundingClientRect()
 *
 * Ref: WBCanvas.vue lines 1598-1606 (A4.3 image drop handler)
 */
export interface UseContentDropOptions {
  sessionId: Ref<string | null>
  /** Optional lesson ID — if provided, material tracking is enabled. Without it (solo board), tracking is skipped to avoid 404s. */
  lessonId?: Ref<string | null>
  canDraw: Ref<boolean>
  onAssetAdd: (asset: WBAsset) => void
  /** Convert screen (clientX, clientY) → canvas coordinates using container rect + zoom */
  screenToCanvas: (x: number, y: number) => { x: number; y: number }
}

const MAX_ASSET_W = 500
const MAX_ASSET_H = 500

const _PROXY_HOSTS = ['images.m4sh.org']
const _apiBase = (() => {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined
  return env || '/api'
})()
function _buildMediaProxyUrl(src: string): string | null {
  try {
    const u = new URL(src, window.location.origin)
    if (!_PROXY_HOSTS.includes(u.hostname)) return null
    return `${_apiBase}/v1/uploads/media-proxy/?url=${encodeURIComponent(src)}`
  } catch { return null }
}

export function useContentDrop(options: UseContentDropOptions) {
  const { sessionId, lessonId, canDraw, onAssetAdd, screenToCanvas } = options

  async function handleCanvasDrop(event: DragEvent): Promise<void> {
    event.preventDefault()

    if (!canDraw.value) return

    // Phase O PR-O4: Geometry solid drag (highest priority — own MIME).
    // Tray sets 'application/x-solid' з payload {src}. Drop handler сам
    // hydrates default state — payload містить ТІЛЬКИ src per CHECKPOINT 4.
    const solidRaw = event.dataTransfer?.getData(SOLID_DRAG_MIME)
    if (solidRaw) {
      let parsed: SolidDragPayload
      try {
        parsed = JSON.parse(solidRaw) as SolidDragPayload
      } catch {
        console.warn('[useContentDrop] Invalid solid drag payload')
        return
      }
      if (!parsed?.src || !SOLID_TYPE_SET.has(parsed.src)) {
        console.warn('[useContentDrop] Unknown solid src:', parsed?.src)
        return
      }
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      // PR4 (2026-05-04) — INV-13 ATOMIC-APPLY invariant verified:
      //   1 drop = 1 asset_add op = 1 broadcast.
      //   `data.state` тут заповнюється повністю через DEFAULT_SOLID_STATE spread
      //   (single source of truth — constants/solidDefaults.ts CHECKPOINT 4).
      //   SolidCardRenderer.vue:456 watch не має `immediate: true` → жодного
      //   redundant emit('update:asset') на mount. Тобто chain
      //   addAsset → updateAsset×N (3 broadcasts на drop, як було підозрюється
      //   у користувацьких логах) не існує — multiple updateAsset broadcasts
      //   приходять від user actions ПІСЛЯ drop (drag/resize).
      const asset: SolidAsset = {
        id: `solid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'geometry_solid',
        src: parsed.src,
        x: canvasPos.x - DEFAULT_SOLID_W / 2,
        y: canvasPos.y - DEFAULT_SOLID_H / 2,
        w: DEFAULT_SOLID_W,
        h: DEFAULT_SOLID_H,
        rotation: 0,
        locked: false,
        data: {
          version: 1,
          // Spread DEFAULT_SOLID_STATE — produces NEW mutable object so що
          // Vue reactivity може tracking field changes у store/asset_update ops.
          state: { ...DEFAULT_SOLID_STATE },
        },
      }
      onAssetAdd(asset)
      return
    }

    // Phase 3A: Check sidebar MIME first
    const sidebarRaw = event.dataTransfer?.getData(SIDEBAR_DRAG_MIME)
    if (sidebarRaw) {
      let sidebarPayload: SidebarDragPayload
      try {
        sidebarPayload = JSON.parse(sidebarRaw)
      } catch {
        console.warn('[useContentDrop] Invalid sidebar drag payload')
        return
      }
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      await handleSidebarDrop(sidebarPayload, canvasPos)
      return
    }

    // Existing: ContentPanel library drag
    const raw = event.dataTransfer?.getData(CONTENT_DRAG_MIME)
    if (!raw) return

    let payload: ContentDragPayload
    try {
      payload = JSON.parse(raw)
    } catch {
      console.warn('[useContentDrop] Invalid drag payload')
      return
    }

    // Convert screen → canvas using the same approach as WBCanvas.vue handleDrop
    const canvasPos = screenToCanvas(event.clientX, event.clientY)

    await placeItemOnCanvas(payload, canvasPos.x, canvasPos.y)
  }

  /** @deprecated Legacy path for CONTENT_DRAG_MIME (ContentPanel library drag). Sidebar drops use handleSidebarDrop exclusively. */
  async function placeItemOnCanvas(
    payload: ContentDragPayload,
    canvasX: number,
    canvasY: number,
  ): Promise<void> {
    // 1. Fetch full ContentItemDetail (contains content_json for rendering)
    let detail
    try {
      detail = await learningContentApi.getItemDetail(payload.itemId)
    } catch (e) {
      console.error('[useContentDrop] Failed to load item detail:', e)
      return
    }

    // 2. Check if content has images — use image URL directly
    const cj = detail.content_json as Record<string, unknown>
    const images = cj?.images as string[] | undefined
    let dataUrl: string

    if (images && Array.isArray(images) && images.length > 0) {
      // Use image URL directly (from Cloudinary or other source)
      dataUrl = images[0]
    } else {
      // Fallback: render text content → SVG
      try {
        dataUrl = await renderContentToSvgDataUrl(detail)
      } catch (e) {
        console.error('[useContentDrop] Render failed, using fallback:', e)
        dataUrl = generateFallbackSvg(detail.title)
      }
    }

    // 3. Determine image dimensions (load image to get natural size)
    const { w, h } = await getImageDimensions(dataUrl)

    // 4. Build WBAsset matching the real type from winterboard/types/winterboard.ts
    const asset: WBAsset = {
      id: `content-${detail.id}-${Date.now()}`,
      type: 'image',
      src: dataUrl,
      x: canvasX - w / 2,
      y: canvasY - h / 2,
      w,
      h,
      rotation: 0,
      locked: false,
    }

    // 5. Add asset to canvas
    onAssetAdd(asset)

    // 5. Tracking: POST lesson-material (fire-and-forget, don't block UI)
    if (sessionId.value) {
      learningContentApi.createLessonMaterial({
        session_uuid: sessionId.value,
        content_item: detail.id,
        position_json: { x: canvasX, y: canvasY },
      }).catch(err => console.warn('[useContentDrop] Tracking failed:', err))
    }
  }

  function getImageDimensions(src: string): Promise<{ w: number; h: number; loaded: boolean }> {
    return new Promise((resolve) => {
      // For data URLs or SVGs, use default size
      if (src.startsWith('data:')) {
        resolve({ w: MAX_ASSET_W, h: MAX_ASSET_H, loaded: true })
        return
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        let w = img.naturalWidth
        let h = img.naturalHeight
        // Scale down proportionally if too large
        if (w > MAX_ASSET_W || h > MAX_ASSET_H) {
          const scale = Math.min(MAX_ASSET_W / w, MAX_ASSET_H / h)
          w = Math.round(w * scale)
          h = Math.round(h * scale)
        }
        // Ensure minimum size
        if (w < 100) { const s = 100 / w; w = 100; h = Math.round(h * s) }
        resolve({ w, h, loaded: true })
      }
      img.onerror = () => {
        console.warn('[useContentDrop] Image failed to load (crossOrigin=anonymous):', src)
        const _resolveFromImg = (i: HTMLImageElement) => {
          let w = i.naturalWidth
          let h = i.naturalHeight
          if (w > MAX_ASSET_W || h > MAX_ASSET_H) {
            const scale = Math.min(MAX_ASSET_W / w, MAX_ASSET_H / h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          if (w < 100) { const s = 100 / w; w = 100; h = Math.round(h * s) }
          resolve({ w, h, loaded: true })
        }
        // Try through backend media proxy (preserves CORS)
        const proxyUrl = _buildMediaProxyUrl(src)
        if (proxyUrl) {
          const imgProxy = new Image()
          imgProxy.crossOrigin = 'anonymous'
          imgProxy.onload = () => { _resolveFromImg(imgProxy) }
          imgProxy.onerror = () => {
            // Proxy failed — last resort: no-CORS
            const imgNoCors = new Image()
            imgNoCors.onload = () => { _resolveFromImg(imgNoCors) }
            imgNoCors.onerror = () => {
              console.error('[useContentDrop] Image completely inaccessible:', src)
              resolve({ w: MAX_ASSET_W, h: Math.round(MAX_ASSET_W * 0.6), loaded: false })
            }
            imgNoCors.src = src
          }
          imgProxy.src = proxyUrl
        } else {
          // Not proxyable — direct no-CORS fallback
          const imgNoCors = new Image()
          imgNoCors.onload = () => { _resolveFromImg(imgNoCors) }
          imgNoCors.onerror = () => {
            console.error('[useContentDrop] Image completely inaccessible:', src)
            resolve({ w: MAX_ASSET_W, h: Math.round(MAX_ASSET_W * 0.6), loaded: false })
          }
          imgNoCors.src = src
        }
      }
      img.src = src
    })
  }

  function generateFallbackSvg(title: string): string {
    const escaped = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .slice(0, 60)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">
      <rect width="400" height="80" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>
      <text x="16" y="36" font-size="14" font-weight="bold" fill="#1e293b" font-family="sans-serif">${escaped}</text>
      <text x="16" y="58" font-size="12" fill="#64748b" font-family="sans-serif">Перетягнуто з бібліотеки</text>
    </svg>`
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  }

  /** Fire-and-forget: track material usage on the board. Skipped for solo boards without lessonId. */
  function trackMaterial(contentItemId: number, pos: { x: number; y: number }) {
    if (!sessionId.value) return
    if (lessonId && !lessonId.value) return
    learningContentApi.createLessonMaterial({
      session_uuid: sessionId.value,
      content_item: contentItemId,
      position_json: { x: pos.x, y: pos.y },
    }).catch(err => console.warn('[useContentDrop] Tracking failed:', err))
  }

  /**
   * Handle drop from ContentSidebar (Phase 3A).
   *
   * Calls POST /board/resolve-drop/ to get board_object + drop_mode.
   * Builds WBAsset and adds to canvas via onAssetAdd.
   *
   * B1: content_ref.content_version set by backend.
   */
  async function handleSidebarDrop(
    payload: SidebarDragPayload,
    dropPosition: { x: number; y: number },
  ): Promise<void> {
    // Phase 9 fallback: старі LibraryAsset не мають ContentItem FK.
    // Якщо content_item_id = null — використовуємо cdn_url напряму, без resolve-drop.
    if (!payload.content_item_id) {
      await handleLegacyAssetDrop(payload, dropPosition)
      return
    }

    try {
      // Retry on 429 (rate limit) — drag-and-drop can trigger burst requests
      let res: any
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await learningContentApi.resolveDropMode({
            content_item_id: payload.content_item_id,
            extra: payload.extra || {},
          })
          break
        } catch (err: any) {
          if (err?.response?.status === 429 && attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }
      }
      const response: ResolveDropResponse = (res as Record<string, unknown>).data
        ? ((res as Record<string, unknown>).data as ResolveDropResponse)
        : (res as unknown as ResolveDropResponse)

      const { board_object, drop_mode } = response

      console.info('[WB:Drop] resolve-drop response: drop_mode=%s board_object.type=%s payload.extra=%o',
        drop_mode, board_object.type, payload.extra)

      if (drop_mode === 'not_droppable') {
        console.warn('[useContentDrop] Content not droppable:', payload.content_type)
        return
      }

      // Phase 10 P3: YouTube embed — create youtube_player asset
      if (drop_mode === 'youtube_embed') {
        const sizes = DEFAULT_BOARD_SIZES['youtube_player'] ?? { w: 640, h: 360 }
        const youtubeUrl = (board_object.youtubeUrl as string) || (board_object.src as string) || ''
        const asset: WBAsset = {
          id: `yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'youtube_player',
          src: youtubeUrl,
          youtubeUrl,
          x: dropPosition.x - sizes.w / 2,
          y: dropPosition.y - sizes.h / 2,
          w: sizes.w,
          h: sizes.h,
          rotation: 0,
          locked: false,
          title: (board_object.title as string) || '',
          thumbnail: (board_object.thumbnail as string) || '',
        }
        onAssetAdd(asset)
        if (payload.content_item_id) trackMaterial(payload.content_item_id, dropPosition)
        return
      }

      // For render_svg — render SVG locally and build asset inline
      if (drop_mode === 'render_svg') {
        const detail = await learningContentApi.getItemDetail(payload.content_item_id!)
        let dataUrl: string
        try {
          dataUrl = await renderContentToSvgDataUrl(detail)
        } catch (e) {
          console.error('[useContentDrop] SVG render failed, using fallback:', e)
          dataUrl = generateFallbackSvg(detail.title)
        }
        const svgAsset: WBAsset = {
          id: `content-${detail.id}-${Date.now()}`,
          type: 'image',
          src: dataUrl,
          x: dropPosition.x - MAX_ASSET_W / 2,
          y: dropPosition.y - MAX_ASSET_H / 2,
          w: MAX_ASSET_W,
          h: MAX_ASSET_H,
          rotation: 0,
          locked: false,
        }
        onAssetAdd(svgAsset)
        trackMaterial(payload.content_item_id, dropPosition)
        return
      }

      // PLAN_v4: Document Viewer — interactive asset on canvas with page navigation
      const boardType = (board_object.type as string) || 'image'

      // Normalize src (shared between document_viewer and generic path)
      const rawSrc = (board_object.src as string) || ''
      const src = rawSrc.replace(/^\/media\/\/media\//, '/media/')

      if (boardType === 'document_viewer') {
        const contentRef = board_object.content_ref
        // Presentation = landscape (4:3), PDF/document = portrait (A4)
        const isPresentation = contentRef?.content_type === 'presentation'
          || payload.asset_category === 'presentation'
        const sizes = isPresentation
          ? { w: 640, h: 480 }
          : (DEFAULT_BOARD_SIZES['document_viewer'] ?? { w: 420, h: 594 })

        if (!src) {
          console.warn('[WB:Drop] document_viewer has no src — skipping')
          return
        }

        const asset: WBAsset = {
          id: `docviewer-${contentRef?.content_id ?? 0}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'document_viewer',
          src,
          x: dropPosition.x - sizes.w / 2,
          y: dropPosition.y - sizes.h / 2,
          w: sizes.w,
          h: sizes.h,
          rotation: 0,
          locked: false,
          // PLAN_v4 fields — pages[] is local state, NOT synced via WS
          content_ref: contentRef ? {
            content_id: contentRef.content_id,
            content_type: contentRef.content_type as 'pdf' | 'document' | 'presentation',
          } : undefined,
          currentPage: board_object.currentPage ?? 0,
          totalPages: board_object.totalPages ?? 0,
          // pages[] NOT stored in asset — DocumentViewerAsset fetches on demand
          viewerMode: 'compact',
        }

        console.info('[WB:Drop] document_viewer: pages=%d src=%s', asset.totalPages, src)
        onAssetAdd(asset)
        if (payload.content_item_id) trackMaterial(payload.content_item_id, dropPosition)
        return
      }

      // All other modes — backend built the board_object
      let sizes = DEFAULT_BOARD_SIZES[boardType] ?? { w: 400, h: 300 }

      console.info('[WB:Drop] drop_mode=%s boardType=%s src=%s', drop_mode, boardType, src || '(empty)')

      // Guard: skip if visual asset has no src (prevents invisible ghost rectangles on canvas)
      const isVisualType = boardType === 'image' || boardType === 'presentation' || boardType === 'pdf'
      if (isVisualType && !src) {
        console.warn('[WB:Drop] Visual asset has no src — skipping (ghost prevention):', boardType, payload.content_item_id)
        return
      }

      if (isVisualType && src && !src.startsWith('data:')) {
        const dims = await getImageDimensions(src)
        sizes = { w: dims.w, h: dims.h }
        if (!dims.loaded) {
          console.warn('[WB:Drop] Slide/PDF image failed to load — skipping ghost:', src)
          return
        }
      }

      // Safe content_ref access (optional after PLAN_v4)
      const contentId = board_object.content_ref?.content_id ?? payload.content_item_id ?? 0
      const asset: WBAsset = {
        id: `content-${contentId}-${Date.now()}`,
        type: boardType as WBAsset['type'],
        src,
        x: dropPosition.x - sizes.w / 2,
        y: dropPosition.y - sizes.h / 2,
        w: sizes.w,
        h: sizes.h,
        rotation: 0,
        locked: false,
        // Media-specific fields (audio_player / video_player)
        ...(boardType === 'audio_player' && {
          title: board_object.title as string | undefined,
          duration: board_object.duration as number | undefined,
        }),
        ...(boardType === 'video_player' && {
          title: board_object.title as string | undefined,
          duration: board_object.duration as number | undefined,
          thumbnail: board_object.thumbnail as string | undefined,
        }),
      }

      onAssetAdd(asset)
      if (payload.content_item_id) trackMaterial(payload.content_item_id, dropPosition)
    } catch (e) {
      console.error('[useContentDrop] Sidebar drop failed:', e)
    }
  }

  /**
   * Phase 9 fallback: обробляє drag для старих LibraryAsset без ContentItem FK.
   * Замість resolve-drop — використовує cdn_url напряму з drag payload.
   *
   * Відображення за asset_category:
   *   image → type='image' (якщо URL завантажується)
   *   audio → type='audio_player' (завжди; плеєр покаже помилку якщо файл відсутній)
   *   video → type='video_player'
   *   pdf/presentation → не підтримується без ContentItem (пропускаємо з попередженням)
   */
  async function handleLegacyAssetDrop(
    payload: SidebarDragPayload,
    dropPosition: { x: number; y: number },
  ): Promise<void> {
    const src = payload.cdn_url || ''
    const category = payload.asset_category
    const assetId = `legacy-${category}-${Date.now()}`

    console.info('[WB:Drop] legacy asset fallback: category=%s src=%s', category, src || '(empty)')

    if (category === 'audio') {
      const sizes = DEFAULT_BOARD_SIZES['audio_player']
      const asset: WBAsset = {
        id: assetId,
        type: 'audio_player',
        src,
        x: dropPosition.x - sizes.w / 2,
        y: dropPosition.y - sizes.h / 2,
        w: sizes.w,
        h: sizes.h,
        rotation: 0,
        locked: false,
        title: payload.title,
      }
      onAssetAdd(asset)
      return
    }

    if (category === 'video') {
      const sizes = DEFAULT_BOARD_SIZES['video_player']
      const asset: WBAsset = {
        id: assetId,
        type: 'video_player',
        src,
        x: dropPosition.x - sizes.w / 2,
        y: dropPosition.y - sizes.h / 2,
        w: sizes.w,
        h: sizes.h,
        rotation: 0,
        locked: false,
        title: payload.title,
      }
      onAssetAdd(asset)
      return
    }

    if (category === 'image') {
      if (!src) {
        console.warn('[WB:Drop] Legacy image has no cdn_url — skipping')
        return
      }
      const dims = await getImageDimensions(src)
      if (!dims.loaded) {
        console.warn('[WB:Drop] Legacy image failed to load (file missing?):', src)
        return
      }
      const asset: WBAsset = {
        id: assetId,
        type: 'image',
        src,
        x: dropPosition.x - dims.w / 2,
        y: dropPosition.y - dims.h / 2,
        w: dims.w,
        h: dims.h,
        rotation: 0,
        locked: false,
      }
      onAssetAdd(asset)
      return
    }

    // pdf, presentation — без ContentItem не підтримується
    console.warn('[WB:Drop] Legacy asset category not supported without ContentItem:', category)
  }

  /**
   * Resolve sidebar drag payload → WBAsset (positioned at 0,0).
   * Caller is responsible for positioning and adding to store.
   * Used by: handleSidebarDrop (canvas drop) and thumbnail drop.
   */
  async function resolveAsset(payload: SidebarDragPayload): Promise<WBAsset | null> {
    // Legacy fallback (no ContentItem FK)
    if (!payload.content_item_id) {
      const category = payload.asset_category
      const src = payload.cdn_url || ''
      const assetId = `legacy-${category}-${Date.now()}`

      if (category === 'audio') {
        const sizes = DEFAULT_BOARD_SIZES['audio_player']
        return { id: assetId, type: 'audio_player', src, x: 0, y: 0, w: sizes.w, h: sizes.h, rotation: 0, locked: false, title: payload.title }
      }
      if (category === 'video') {
        const sizes = DEFAULT_BOARD_SIZES['video_player']
        return { id: assetId, type: 'video_player', src, x: 0, y: 0, w: sizes.w, h: sizes.h, rotation: 0, locked: false, title: payload.title }
      }
      if (category === 'image' && src) {
        const dims = await getImageDimensions(src)
        if (!dims.loaded) return null
        return { id: assetId, type: 'image', src, x: 0, y: 0, w: dims.w, h: dims.h, rotation: 0, locked: false }
      }
      return null
    }

    try {
      let res: any
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await learningContentApi.resolveDropMode({
            content_item_id: payload.content_item_id,
            extra: payload.extra || {},
          })
          break
        } catch (err: any) {
          if (err?.response?.status === 429 && attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }
      }
      const response: ResolveDropResponse = (res as Record<string, unknown>).data
        ? ((res as Record<string, unknown>).data as ResolveDropResponse)
        : (res as unknown as ResolveDropResponse)

      const { board_object, drop_mode } = response
      if (drop_mode === 'not_droppable') return null

      const boardType = (board_object.type as string) || 'image'
      const rawSrc = (board_object.src as string) || ''
      const src = rawSrc.replace(/^\/media\/\/media\//, '/media/')

      // YouTube
      if (drop_mode === 'youtube_embed') {
        const sizes = DEFAULT_BOARD_SIZES['youtube_player'] ?? { w: 640, h: 360 }
        return {
          id: `yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'youtube_player', src: (board_object.youtubeUrl as string) || src,
          youtubeUrl: (board_object.youtubeUrl as string) || src,
          x: 0, y: 0, w: sizes.w, h: sizes.h, rotation: 0, locked: false,
          title: (board_object.title as string) || '',
          thumbnail: (board_object.thumbnail as string) || '',
        }
      }

      // SVG render
      if (drop_mode === 'render_svg') {
        const detail = await learningContentApi.getItemDetail(payload.content_item_id!)
        let dataUrl: string
        try { dataUrl = await renderContentToSvgDataUrl(detail) }
        catch { dataUrl = generateFallbackSvg(detail.title) }
        return {
          id: `content-${detail.id}-${Date.now()}`, type: 'image', src: dataUrl,
          x: 0, y: 0, w: MAX_ASSET_W, h: MAX_ASSET_H, rotation: 0, locked: false,
        }
      }

      // Document viewer
      if (boardType === 'document_viewer') {
        const contentRef = board_object.content_ref
        // Presentation = landscape (4:3), PDF/document = portrait (A4)
        const isPresentation = contentRef?.content_type === 'presentation'
          || payload.asset_category === 'presentation'
        const sizes = isPresentation
          ? { w: 640, h: 480 }
          : (DEFAULT_BOARD_SIZES['document_viewer'] ?? { w: 420, h: 594 })
        if (!src) return null
        return {
          id: `docviewer-${contentRef?.content_id ?? 0}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'document_viewer', src, x: 0, y: 0, w: sizes.w, h: sizes.h, rotation: 0, locked: false,
          content_ref: contentRef ? { content_id: contentRef.content_id, content_type: contentRef.content_type as 'pdf' | 'document' | 'presentation' } : undefined,
          currentPage: board_object.currentPage ?? 0, totalPages: board_object.totalPages ?? 0, viewerMode: 'compact',
        }
      }

      // Generic (image/audio/video/pdf/presentation)
      let sizes = DEFAULT_BOARD_SIZES[boardType] ?? { w: 400, h: 300 }
      const isVisualType = boardType === 'image' || boardType === 'presentation' || boardType === 'pdf'
      if (isVisualType && !src) return null
      if (isVisualType && src && !src.startsWith('data:')) {
        const dims = await getImageDimensions(src)
        if (!dims.loaded) return null
        sizes = { w: dims.w, h: dims.h }
      }

      const contentId = board_object.content_ref?.content_id ?? payload.content_item_id ?? 0
      return {
        id: `content-${contentId}-${Date.now()}`,
        type: boardType as WBAsset['type'], src, x: 0, y: 0, w: sizes.w, h: sizes.h, rotation: 0, locked: false,
        ...(boardType === 'audio_player' && { title: board_object.title as string | undefined, duration: board_object.duration as number | undefined }),
        ...(boardType === 'video_player' && { title: board_object.title as string | undefined, duration: board_object.duration as number | undefined, thumbnail: board_object.thumbnail as string | undefined }),
      }
    } catch (e) {
      console.error('[useContentDrop] resolveAsset failed:', e)
      return null
    }
  }

  return {
    handleCanvasDrop,
    placeItemOnCanvas,
    handleSidebarDrop,  // Phase 3A
    resolveAsset,       // Used by thumbnail drop
  }
}
