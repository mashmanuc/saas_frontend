import { type Ref } from 'vue'
import { learningContentApi, renderContentToSvgDataUrl } from '@/modules/learning-content'
import type { ContentDragPayload } from '@/modules/learning-content'
import type { WBAsset } from '../types/winterboard'
import {
  SIDEBAR_DRAG_MIME,
  CONTENT_DRAG_MIME,
  DEFAULT_BOARD_SIZES,
  type SidebarDragPayload,
  type ResolveDropResponse,
} from '../types/boardDrop'

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

export function useContentDrop(options: UseContentDropOptions) {
  const { sessionId, lessonId, canDraw, onAssetAdd, screenToCanvas } = options

  async function handleCanvasDrop(event: DragEvent): Promise<void> {
    event.preventDefault()

    if (!canDraw.value) return

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
        // Try again without crossOrigin — some servers don't send CORS headers for media
        const imgNoCors = new Image()
        imgNoCors.onload = () => {
          let w = imgNoCors.naturalWidth
          let h = imgNoCors.naturalHeight
          if (w > MAX_ASSET_W || h > MAX_ASSET_H) {
            const scale = Math.min(MAX_ASSET_W / w, MAX_ASSET_H / h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          if (w < 100) { const s = 100 / w; w = 100; h = Math.round(h * s) }
          resolve({ w, h, loaded: true })
        }
        imgNoCors.onerror = () => {
          console.error('[useContentDrop] Image completely inaccessible:', src)
          resolve({ w: MAX_ASSET_W, h: Math.round(MAX_ASSET_W * 0.6), loaded: false })
        }
        imgNoCors.src = src
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
    try {
      const res = await learningContentApi.resolveDropMode({
        content_item_id: payload.content_item_id,
        extra: payload.extra || {},
      })
      const response: ResolveDropResponse = (res as Record<string, unknown>).data
        ? ((res as Record<string, unknown>).data as ResolveDropResponse)
        : (res as unknown as ResolveDropResponse)

      const { board_object, drop_mode } = response

      if (drop_mode === 'not_droppable') {
        console.warn('[useContentDrop] Content not droppable:', payload.content_type)
        return
      }

      // For render_svg — render SVG locally and build asset inline
      if (drop_mode === 'render_svg') {
        const detail = await learningContentApi.getItemDetail(payload.content_item_id)
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

      // All other modes — backend built the board_object
      const boardType = (board_object.type as string) || 'image'
      let sizes = DEFAULT_BOARD_SIZES[boardType] ?? { w: 400, h: 300 }

      // Content-aware sizing: load actual image dimensions for all visual asset types
      const src = (board_object.src as string) || ''

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

      const asset: WBAsset = {
        id: `content-${board_object.content_ref.content_id}-${Date.now()}`,
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
      trackMaterial(payload.content_item_id, dropPosition)
    } catch (e) {
      console.error('[useContentDrop] Sidebar drop failed:', e)
    }
  }

  return {
    handleCanvasDrop,
    placeItemOnCanvas,
    handleSidebarDrop,  // Phase 3A
  }
}
