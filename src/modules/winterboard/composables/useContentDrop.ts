import { type Ref } from 'vue'
import { learningContentApi, renderContentToSvgDataUrl } from '@/modules/learning-content'
import type { ContentDragPayload } from '@/modules/learning-content'
import type { WBAsset } from '../types/winterboard'

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
  canDraw: Ref<boolean>
  onAssetAdd: (asset: WBAsset) => void
  /** Convert screen (clientX, clientY) → canvas coordinates using container rect + zoom */
  screenToCanvas: (x: number, y: number) => { x: number; y: number }
}

const CONTENT_DRAG_MIME = 'application/learning-content'
const MAX_ASSET_W = 500
const MAX_ASSET_H = 500

export function useContentDrop(options: UseContentDropOptions) {
  const { sessionId, canDraw, onAssetAdd, screenToCanvas } = options

  async function handleCanvasDrop(event: DragEvent): Promise<void> {
    event.preventDefault()

    if (!canDraw.value) return

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

  function getImageDimensions(src: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      // For data URLs or SVGs, use default size
      if (src.startsWith('data:')) {
        resolve({ w: MAX_ASSET_W, h: MAX_ASSET_H })
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
        resolve({ w, h })
      }
      img.onerror = () => {
        resolve({ w: MAX_ASSET_W, h: Math.round(MAX_ASSET_W * 0.6) })
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

  return {
    handleCanvasDrop,
    placeItemOnCanvas,
  }
}
