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
import {
  DEFAULT_GRAPH_STATE,
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_GRAPH_HEIGHT,
  GRAPH_CALCULATOR_MIME,
} from '../constants/graphCalculatorDefaults'
// Phase G v2 — Geometry 2D v2 drop wiring (bundle-backed).
import {
  GEOMETRY_2D_V2_DRAG_MIME,
  DEFAULT_GEOMETRY_2D_V2_W,
  DEFAULT_GEOMETRY_2D_V2_H,
  buildDefaultGeometry2DV2Data,
  type Geometry2DV2DragPayload,
} from '../constants/geometry2dV2Defaults'
import type { Geometry2DV2Asset } from '../types/geometry2dV2'
// Phase Calculus (2026-05-15) — derivative + integral cards drop wiring.
import {
  CALCULUS_DRAG_MIME,
  CALCULUS_MODE_SET,
  DEFAULT_CALCULUS_W,
  DEFAULT_CALCULUS_H,
  buildDefaultCalculusData,
  type CalculusDragPayload,
} from '../constants/calculusDefaults'
import type { CalculusAsset } from '../types/calculus'
// TrigCircle (2026-05-16) — unit circle ↔ sin/cos/tg/ctg graph widget drop wiring.
import {
  TRIG_CIRCLE_DRAG_MIME,
  DEFAULT_TRIG_CIRCLE_W,
  DEFAULT_TRIG_CIRCLE_H,
  buildDefaultTrigCircleData,
} from '../constants/trigCircleDefaults'
import type { TrigCircleAsset } from '../types/trigCircle'
// Helix (2026-05-17) — 3D helix P=(θ, sin θ, cos θ) visualization widget drop wiring.
import {
  HELIX_DRAG_MIME,
  DEFAULT_HELIX_W,
  DEFAULT_HELIX_H,
  buildDefaultHelixData,
} from '../constants/helixDefaults'
import type { HelixAsset } from '../types/helix'
// TrigSolver (2026-05-19) — §3.7.7 unified trig equation + inequality solver drop wiring.
import {
  TRIG_SOLVER_DRAG_MIME,
  DEFAULT_TRIG_SOLVER_W,
  DEFAULT_TRIG_SOLVER_H,
  buildDefaultTrigSolverData,
  type TrigSolverDragPayload,
} from '../constants/trigSolverDefaults'
import type { TrigSolverAsset } from '../types/trigSolver'
// NMT3D (2026-05-21) — §3.7.8 parametric 3D stereometry widget drop wiring.
import {
  NMT3D_DRAG_MIME,
  DEFAULT_NMT3D_W,
  DEFAULT_NMT3D_H,
  buildDefaultNmt3dData,
  type Nmt3dDragPayload,
} from '../constants/nmt3dDefaults'
import type { Nmt3dAsset } from '../types/nmt3d'
// QuadraticCard (2026-05-28) — §3.7.10 ax²+bx+c discriminant visualizer drop wiring.
import {
  QUAD_DRAG_MIME,
  DEFAULT_QUAD_W,
  DEFAULT_QUAD_H,
  buildDefaultQuadraticData,
} from '../constants/quadDefaults'
import type { QuadraticAsset } from '../types/quad'
// BoardMASH Ф3.1 — graphmash_3d / geomash_scene sidebar-insert (раніше лише funnel).
import {
  GRAPHMASH_3D_DRAG_MIME,
  GEOMASH_DRAG_MIME,
  type Graphmash3dDragPayload,
  buildDefaultGraphmash3dAsset,
  buildDefaultGeomashSceneAsset,
} from '../constants/mashInsertDefaults'

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

    // Phase G (2026-05-06): graph_calculator drag (own MIME, highest priority).
    // Per OPS_SYNC_SSOT.md INV-21 + UX-RULE-1/3/4:
    //   - Pure handler: payload empty, default state hydrated here.
    //   - asset_add includes full state + meta envelope.
    //   - meta.last_snapshot_seq=0 placeholder; BE materialization stamps at apply.
    const graphRaw = event.dataTransfer?.getData(GRAPH_CALCULATOR_MIME)
    if (graphRaw !== undefined && graphRaw !== '' && graphRaw !== null) {
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? `gc-${crypto.randomUUID()}`
        : `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const asset: WBAsset = {
        id,
        type: 'graph_calculator',
        // src field — kept for WBAsset shape compat; graph_calculator не використовує src.
        src: '',
        x: canvasPos.x - DEFAULT_GRAPH_WIDTH / 2,
        y: canvasPos.y - DEFAULT_GRAPH_HEIGHT / 2,
        w: DEFAULT_GRAPH_WIDTH,
        h: DEFAULT_GRAPH_HEIGHT,
        rotation: 0,
        locked: false,
        // UX-RULE-1: full snapshot — version + state (deep-clone DEFAULT) + meta.
        data: {
          version: 1,
          state: {
            expressions: [...DEFAULT_GRAPH_STATE.expressions],
            params: { ...DEFAULT_GRAPH_STATE.params },
            viewport: { ...DEFAULT_GRAPH_STATE.viewport },
          },
          meta: { last_snapshot_seq: 0 },
        } as unknown as WBAsset['data'],
      }
      onAssetAdd(asset)
      return
    }

    // Phase Calculus (2026-05-15) — derivative / integral card drag.
    // Payload {mode}; default state hydrates через buildDefaultCalculusData.
    // 1 drop = 1 asset_add = 1 broadcast (INV-13 ATOMIC-APPLY).
    const calcRaw = event.dataTransfer?.getData(CALCULUS_DRAG_MIME)
    if (calcRaw) {
      let parsed: CalculusDragPayload
      try {
        parsed = JSON.parse(calcRaw) as CalculusDragPayload
      } catch {
        console.warn('[useContentDrop] Invalid calculus drag payload')
        return
      }
      if (!parsed?.mode || !CALCULUS_MODE_SET.has(parsed.mode)) {
        console.warn('[useContentDrop] Unknown calculus mode:', parsed?.mode)
        return
      }
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: CalculusAsset = {
        id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'calculus_card',
        src: '',
        x: canvasPos.x - DEFAULT_CALCULUS_W / 2,
        y: canvasPos.y - DEFAULT_CALCULUS_H / 2,
        w: DEFAULT_CALCULUS_W,
        h: DEFAULT_CALCULUS_H,
        rotation: 0,
        locked: false,
        data: buildDefaultCalculusData(parsed.mode),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // TrigCircle (2026-05-16) — unit circle ↔ sin/cos graph widget drag.
    // Payload {type:'trig_circle'}; default state hydrates через buildDefaultTrigCircleData.
    // 1 drop = 1 asset_add = 1 broadcast (INV-13 ATOMIC-APPLY).
    const trigRaw = event.dataTransfer?.getData(TRIG_CIRCLE_DRAG_MIME)
    if (trigRaw) {
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: TrigCircleAsset = {
        id: `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'trig_circle',
        src: '',
        x: canvasPos.x - DEFAULT_TRIG_CIRCLE_W / 2,
        y: canvasPos.y - DEFAULT_TRIG_CIRCLE_H / 2,
        w: DEFAULT_TRIG_CIRCLE_W,
        h: DEFAULT_TRIG_CIRCLE_H,
        rotation: 0,
        locked: false,
        data: buildDefaultTrigCircleData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // Helix (2026-05-17) — 3D helix P=(θ, sin θ, cos θ) widget drag.
    // Payload {type:'helix'}; default state hydrates через buildDefaultHelixData.
    // 1 drop = 1 asset_add = 1 broadcast (INV-13 ATOMIC-APPLY).
    const helixRaw = event.dataTransfer?.getData(HELIX_DRAG_MIME)
    if (helixRaw) {
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: HelixAsset = {
        id: `helix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'helix',
        src: '',
        x: canvasPos.x - DEFAULT_HELIX_W / 2,
        y: canvasPos.y - DEFAULT_HELIX_H / 2,
        w: DEFAULT_HELIX_W,
        h: DEFAULT_HELIX_H,
        rotation: 0,
        locked: false,
        data: buildDefaultHelixData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // TrigSolver (2026-05-19) — §3.7.7 unified trig eq+ineq drag.
    const tslvRaw = event.dataTransfer?.getData(TRIG_SOLVER_DRAG_MIME)
    if (tslvRaw) {
      let parsed: TrigSolverDragPayload
      try { parsed = JSON.parse(tslvRaw) as TrigSolverDragPayload } catch { return }
      const funcType = parsed?.type
      if (!funcType || !['sin', 'cos', 'tan', 'cot'].includes(funcType)) return
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: TrigSolverAsset = {
        id: `tslv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'trig_solver', src: '',
        x: canvasPos.x - DEFAULT_TRIG_SOLVER_W / 2,
        y: canvasPos.y - DEFAULT_TRIG_SOLVER_H / 2,
        w: DEFAULT_TRIG_SOLVER_W, h: DEFAULT_TRIG_SOLVER_H,
        rotation: 0, locked: false,
        data: buildDefaultTrigSolverData(funcType),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // NMT3D (2026-05-21) — §3.7.8 parametric 3D stereometry widget drag.
    // Payload {templateKey}; default data hydrates via buildDefaultNmt3dData.
    // 1 drop = 1 asset_add = 1 broadcast (INV-13 ATOMIC-APPLY).
    const nmt3dRaw = event.dataTransfer?.getData(NMT3D_DRAG_MIME)
    if (nmt3dRaw) {
      let parsed: Nmt3dDragPayload
      try { parsed = JSON.parse(nmt3dRaw) as Nmt3dDragPayload } catch { return }
      if (!parsed?.templateKey || typeof parsed.templateKey !== 'string') return
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: Nmt3dAsset = {
        id: `nmt3d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'nmt3d', src: '',
        x: canvasPos.x - DEFAULT_NMT3D_W / 2,
        y: canvasPos.y - DEFAULT_NMT3D_H / 2,
        w: DEFAULT_NMT3D_W, h: DEFAULT_NMT3D_H,
        rotation: 0, locked: false,
        data: buildDefaultNmt3dData(parsed.templateKey),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // QuadraticCard (2026-05-28) — §3.7.10 drag handler.
    const quadRaw = event.dataTransfer?.getData(QUAD_DRAG_MIME)
    if (quadRaw) {
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: QuadraticAsset = {
        id: `quad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'quadratic_card', src: '',
        x: canvasPos.x - DEFAULT_QUAD_W / 2,
        y: canvasPos.y - DEFAULT_QUAD_H / 2,
        w: DEFAULT_QUAD_W, h: DEFAULT_QUAD_H,
        rotation: 0, locked: false,
        data: buildDefaultQuadraticData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // Phase G v2 — Geometry 2D v2 drag (MIME 'application/x-geo2d').
    // Payload {preset, name?} — preset валідуємо проти runtime registry
    // (window.Geo2D.PRESETS), щоб додавання нової картки у bundle не потребувало
    // зміни drop handler. Default data hydrate-ється у buildDefaultGeometry2DV2Data.
    // 1 drop = 1 asset_add op = 1 broadcast (INV-13 ATOMIC-APPLY).
    const geo2dV2Raw = event.dataTransfer?.getData(GEOMETRY_2D_V2_DRAG_MIME)
    if (geo2dV2Raw) {
      let parsed: Geometry2DV2DragPayload
      try {
        parsed = JSON.parse(geo2dV2Raw) as Geometry2DV2DragPayload
      } catch {
        console.warn('[useContentDrop] Invalid geometry_2d_v2 drag payload')
        return
      }
      if (!parsed?.preset || typeof parsed.preset !== 'string') {
        console.warn('[useContentDrop] geometry_2d_v2 preset missing:', parsed?.preset)
        return
      }
      // Runtime validation проти Geo2D.PRESETS — extensible (нова картка
      // зареєстрована у bundle автоматично проходить валідацію).
      const W = window as unknown as { Geo2D?: { PRESETS?: Record<string, unknown> } }
      if (W.Geo2D?.PRESETS && !(parsed.preset in W.Geo2D.PRESETS)) {
        console.warn('[useContentDrop] Unknown geometry_2d_v2 preset:', parsed.preset)
        return
      }
      const canvasPos = screenToCanvas(event.clientX, event.clientY)
      const asset: Geometry2DV2Asset = {
        id: `geo2dv2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'geometry_2d_v2',
        src: '',
        x: canvasPos.x - DEFAULT_GEOMETRY_2D_V2_W / 2,
        y: canvasPos.y - DEFAULT_GEOMETRY_2D_V2_H / 2,
        w: DEFAULT_GEOMETRY_2D_V2_W,
        h: DEFAULT_GEOMETRY_2D_V2_H,
        rotation: 0,
        locked: false,
        data: buildDefaultGeometry2DV2Data(parsed.preset),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // BoardMASH Ф3.1 — graphmash_3d / geomash_scene drag (делегуємо в addAtPosition,
    // без дублювання builder-логіки; hoisted function).
    const gm3dRaw = event.dataTransfer?.getData(GRAPHMASH_3D_DRAG_MIME)
    if (gm3dRaw) {
      addAtPosition(GRAPHMASH_3D_DRAG_MIME, gm3dRaw, screenToCanvas(event.clientX, event.clientY))
      return
    }
    const geomashRaw = event.dataTransfer?.getData(GEOMASH_DRAG_MIME)
    if (geomashRaw) {
      addAtPosition(GEOMASH_DRAG_MIME, geomashRaw, screenToCanvas(event.clientX, event.clientY))
      return
    }

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

  /**
   * Place a tool asset at explicit canvas coordinates (used by tray "+" buttons).
   * Same asset-building logic as handleCanvasDrop but without a DragEvent.
   *
   * HARD RULE: Asset creation is here (drop handler), NOT in trays.
   */
  function addAtPosition(mime: string, payloadStr: string, pos: { x: number; y: number }): void {
    if (!canDraw.value) return

    if (mime === GRAPH_CALCULATOR_MIME) {
      const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? `gc-${crypto.randomUUID()}`
        : `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const asset: WBAsset = {
        id,
        type: 'graph_calculator',
        src: '',
        x: pos.x - DEFAULT_GRAPH_WIDTH / 2,
        y: pos.y - DEFAULT_GRAPH_HEIGHT / 2,
        w: DEFAULT_GRAPH_WIDTH,
        h: DEFAULT_GRAPH_HEIGHT,
        rotation: 0,
        locked: false,
        data: {
          version: 1,
          state: {
            expressions: [...DEFAULT_GRAPH_STATE.expressions],
            params: { ...DEFAULT_GRAPH_STATE.params },
            viewport: { ...DEFAULT_GRAPH_STATE.viewport },
          },
          meta: { last_snapshot_seq: 0 },
        } as unknown as WBAsset['data'],
      }
      onAssetAdd(asset)
      return
    }

    if (mime === CALCULUS_DRAG_MIME) {
      let parsed: CalculusDragPayload
      try { parsed = JSON.parse(payloadStr) as CalculusDragPayload } catch { return }
      if (!parsed?.mode || !CALCULUS_MODE_SET.has(parsed.mode)) return
      const asset: CalculusAsset = {
        id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'calculus_card', src: '',
        x: pos.x - DEFAULT_CALCULUS_W / 2, y: pos.y - DEFAULT_CALCULUS_H / 2,
        w: DEFAULT_CALCULUS_W, h: DEFAULT_CALCULUS_H,
        rotation: 0, locked: false,
        data: buildDefaultCalculusData(parsed.mode),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === TRIG_CIRCLE_DRAG_MIME) {
      const asset: TrigCircleAsset = {
        id: `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'trig_circle', src: '',
        x: pos.x - DEFAULT_TRIG_CIRCLE_W / 2, y: pos.y - DEFAULT_TRIG_CIRCLE_H / 2,
        w: DEFAULT_TRIG_CIRCLE_W, h: DEFAULT_TRIG_CIRCLE_H,
        rotation: 0, locked: false,
        data: buildDefaultTrigCircleData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === HELIX_DRAG_MIME) {
      const asset: HelixAsset = {
        id: `helix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'helix', src: '',
        x: pos.x - DEFAULT_HELIX_W / 2, y: pos.y - DEFAULT_HELIX_H / 2,
        w: DEFAULT_HELIX_W, h: DEFAULT_HELIX_H,
        rotation: 0, locked: false,
        data: buildDefaultHelixData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === TRIG_SOLVER_DRAG_MIME) {
      let parsed: TrigSolverDragPayload
      try { parsed = JSON.parse(payloadStr) as TrigSolverDragPayload } catch { return }
      const funcType = parsed?.type
      if (!funcType || !['sin', 'cos', 'tan', 'cot'].includes(funcType)) return
      const asset: TrigSolverAsset = {
        id: `tslv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'trig_solver', src: '',
        x: pos.x - DEFAULT_TRIG_SOLVER_W / 2, y: pos.y - DEFAULT_TRIG_SOLVER_H / 2,
        w: DEFAULT_TRIG_SOLVER_W, h: DEFAULT_TRIG_SOLVER_H,
        rotation: 0, locked: false,
        data: buildDefaultTrigSolverData(funcType),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === NMT3D_DRAG_MIME) {
      let parsed: Nmt3dDragPayload
      try { parsed = JSON.parse(payloadStr) as Nmt3dDragPayload } catch { return }
      if (!parsed?.templateKey || typeof parsed.templateKey !== 'string') return
      const asset: Nmt3dAsset = {
        id: `nmt3d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'nmt3d', src: '',
        x: pos.x - DEFAULT_NMT3D_W / 2, y: pos.y - DEFAULT_NMT3D_H / 2,
        w: DEFAULT_NMT3D_W, h: DEFAULT_NMT3D_H,
        rotation: 0, locked: false,
        data: buildDefaultNmt3dData(parsed.templateKey),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    // QuadraticCard (2026-05-28) — §3.7.10 drop handler.
    if (mime === QUAD_DRAG_MIME) {
      const asset: QuadraticAsset = {
        id: `quad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'quadratic_card', src: '',
        x: pos.x - DEFAULT_QUAD_W / 2, y: pos.y - DEFAULT_QUAD_H / 2,
        w: DEFAULT_QUAD_W, h: DEFAULT_QUAD_H,
        rotation: 0, locked: false,
        data: buildDefaultQuadraticData(),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === GEOMETRY_2D_V2_DRAG_MIME) {
      let parsed: Geometry2DV2DragPayload
      try { parsed = JSON.parse(payloadStr) as Geometry2DV2DragPayload } catch { return }
      if (!parsed?.preset || typeof parsed.preset !== 'string') return
      const asset: Geometry2DV2Asset = {
        id: `geo2dv2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'geometry_2d_v2', src: '',
        x: pos.x - DEFAULT_GEOMETRY_2D_V2_W / 2, y: pos.y - DEFAULT_GEOMETRY_2D_V2_H / 2,
        w: DEFAULT_GEOMETRY_2D_V2_W, h: DEFAULT_GEOMETRY_2D_V2_H,
        rotation: 0, locked: false,
        data: buildDefaultGeometry2DV2Data(parsed.preset),
      }
      onAssetAdd(asset as unknown as WBAsset)
      return
    }

    if (mime === SOLID_DRAG_MIME) {
      let parsed: SolidDragPayload
      try { parsed = JSON.parse(payloadStr) as SolidDragPayload } catch { return }
      if (!parsed?.src || !SOLID_TYPE_SET.has(parsed.src)) return
      const asset: SolidAsset = {
        id: `solid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'geometry_solid', src: parsed.src,
        x: pos.x - DEFAULT_SOLID_W / 2, y: pos.y - DEFAULT_SOLID_H / 2,
        w: DEFAULT_SOLID_W, h: DEFAULT_SOLID_H,
        rotation: 0, locked: false,
        data: { version: 1, state: { ...DEFAULT_SOLID_STATE } },
      }
      onAssetAdd(asset)
      return
    }

    // BoardMASH Ф3.1 — graphmash_3d із сайдбару (раніше лише funnel-import).
    // Дефолт через buildDefaultGraphmash3dAsset (той самий build<Type>Asset, INV-BM-7).
    if (mime === GRAPHMASH_3D_DRAG_MIME) {
      let parsed: Graphmash3dDragPayload = {}
      try { parsed = JSON.parse(payloadStr) as Graphmash3dDragPayload } catch { /* дефолт blank */ }
      const asset = buildDefaultGraphmash3dAsset(parsed?.starterKind)
      asset.x = pos.x - asset.w / 2
      asset.y = pos.y - asset.h / 2
      onAssetAdd(asset)
      return
    }

    // BoardMASH Ф3.1 — geomash_scene із сайдбару (дефолт-порожня; редагування через воронку).
    if (mime === GEOMASH_DRAG_MIME) {
      const asset = buildDefaultGeomashSceneAsset()
      asset.x = pos.x - asset.w / 2
      asset.y = pos.y - asset.h / 2
      onAssetAdd(asset)
      return
    }
  }

  return {
    handleCanvasDrop,
    placeItemOnCanvas,
    handleSidebarDrop,  // Phase 3A
    resolveAsset,       // Used by thumbnail drop
    addAtPosition,      // Used by tray "+" buttons (sidebar quick-add)
  }
}
