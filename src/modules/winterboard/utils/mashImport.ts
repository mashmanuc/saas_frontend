/**
 * MASH → дошка: імпорт envelope з публічної воронки (/mash/*).
 *
 * Контракт envelope (shared/use-on-board.js воронки, Proposal §8 «MASH Live Asset»):
 *   { app: 'g2d'|'g3d'|'geo'|'stereo', version: 1, scene: object, preview?: string }
 * Передача — localStorage[MASH_HANDOFF_KEY] (same-origin: воронка і SPA живуть на m4sh.org).
 *
 * v1: stereo → НАТИВНИЙ nmt3d-ассет (дошка вже рендерить цей тип). Створення сесії —
 * ПОРОЖНІЙ initial state (SYSTEM_LAW §2, Plan v4 Phase I), а сам об'єкт сіється
 * через ops-pipeline: page_add + asset_add у POST /replay/batch/. Так об'єкт стає
 * seq-1..2 операціями, а не сидить у базовому снапшоті → replay чистий (INV #9
 * SOURCE OF TRUTH) і не залежить від WB_ENFORCE_EMPTY_INITIAL_STATE.
 */
import type { WBAsset, WBWorkspaceState } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'
import { DEFAULT_NMT3D_W, DEFAULT_NMT3D_H } from '../constants/nmt3dDefaults'
import { DEFAULT_GRAPH_WIDTH, DEFAULT_GRAPH_HEIGHT } from '../constants/graphCalculatorDefaults'

export const MASH_HANDOFF_KEY = 'mash:handoff'

export interface MashEnvelope {
  app: 'g2d' | 'g3d' | 'geo' | 'stereo'
  version: number
  scene: Record<string, unknown>
  preview?: string | null
}

const MASH_APPS = new Set(['g2d', 'g3d', 'geo', 'stereo'])

/** Прочитати і зняти handoff зі сховища. Невалідний JSON/форма → null (сховище чиститься). */
export function takeMashHandoff(storage: Pick<Storage, 'getItem' | 'removeItem'>): MashEnvelope | null {
  const raw = storage.getItem(MASH_HANDOFF_KEY)
  if (raw == null) return null
  storage.removeItem(MASH_HANDOFF_KEY)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const env = parsed as Record<string, unknown>
  if (typeof env.app !== 'string' || !MASH_APPS.has(env.app)) return null
  if (typeof env.scene !== 'object' || env.scene === null) return null
  return {
    app: env.app as MashEnvelope['app'],
    version: typeof env.version === 'number' ? env.version : 1,
    scene: env.scene as Record<string, unknown>,
    preview: typeof env.preview === 'string' ? env.preview : null,
  }
}

/** Санітизація params: лише скінченні числа (двигун кидає на сміття в setParams). */
function cleanNumbers(src: unknown): Record<string, number> | undefined {
  if (typeof src !== 'object' || src === null) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

function cleanBooleans(src: unknown): Record<string, boolean> | undefined {
  if (typeof src !== 'object' || src === null) return undefined
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * stereo-сцена → нативний nmt3d WBAsset.
 * Форма data дзеркалить buildDefaultNmt3dData + поля сцени (templateKey/params/opts/mode).
 * Невалідна сцена (нема templateKey) → null.
 */
export function buildNmt3dAssetFromStereoScene(scene: Record<string, unknown>): WBAsset | null {
  const templateKey = scene.templateKey
  if (typeof templateKey !== 'string' || !templateKey) return null
  const params = cleanNumbers(scene.params)
  const opts = cleanBooleans(scene.opts)
  const mode = scene.mode === 'draw' ? 'draw' : 'adapt'
  return {
    id: `nmt3d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'nmt3d',
    src: '',
    x: 120,
    y: 80,
    w: DEFAULT_NMT3D_W,
    h: DEFAULT_NMT3D_H,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      templateKey,
      mode,
      ...(params ? { params } : {}),
      ...(opts ? { opts } : {}),
    },
  } as unknown as WBAsset
}

/** Проста rand-id для виразів graph_calculator (inv-21: id REQUIRED). */
function exprId(i: number): string {
  return `expr-${i}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Нормалізація кольору у BE-строгий `#rrggbb` (WBGraphExpressionSerializer regex).
 * Розгортає `#rgb`→`#rrggbb`; невалідне (rgb()/назва/порожнє) → дефолт.
 */
function normalizeHex(c: unknown, fallback = '#2d70b3'): string {
  if (typeof c !== 'string') return fallback
  const s = c.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  const m = /^#([0-9a-fA-F]{3})$/.exec(s)
  if (m) return ('#' + m[1].split('').map(ch => ch + ch).join('')).toLowerCase()
  return fallback
}

// BE-межі (apps/winterboard/api/serializers.py) — конвертер МУСИТЬ їх дотримати,
// інакше asset_update (move) впаде на строгому graph_calculator-серіалізаторі.
const GC_MAX_EXPRESSIONS = 32
const GC_EXPR_SRC_MAX = 256
const GC_SCALE_MIN = 1.0
const GC_SCALE_MAX = 1000.0

/**
 * B2 (2026-07-07) — g2d-сцена → НАШ НАТИВНИЙ `graph_calculator` ассет.
 * Board-graph_calculator = той самий двигун-форк, що GraphMASH (Phase G); має живий
 * рендер + правий інспектор (GraphCalcInspector) + редагування + replay. Тому НЕ окремий
 * віджет — конвертуємо сцену в його state (inv-21: кожен вираз з id).
 * Таблиці/фрактали GraphMASH тут дропаємо (board-формат інший) — рідкість, лог не потрібен.
 * Невалідна сцена (0 придатних виразів) → null (fallback на mash_scene-картку у викликачі).
 */
export function buildGraphCalcAssetFromG2dScene(scene: Record<string, unknown>): WBAsset | null {
  const rawExprs = Array.isArray(scene.expressions) ? scene.expressions : []
  const expressions: Array<{ id: string; src: string; color: string; hidden: boolean }> = []
  let i = 0
  for (const raw of rawExprs as Array<Record<string, unknown>>) {
    if (expressions.length >= GC_MAX_EXPRESSIONS) break // BE cap 32
    if (raw.isTable) continue // board graph_calculator не має табличного формату GraphMASH
    const src = typeof raw.src === 'string' ? raw.src.trim() : ''
    if (!src || src.length > GC_EXPR_SRC_MAX) continue // BE src ≤256 (довше — дропаємо, не ламаємо формулу truncate)
    expressions.push({
      id: exprId(i++),
      src,
      color: normalizeHex(raw.color),
      hidden: !!raw.hidden,
    })
  }
  if (!expressions.length) return null

  // params: {name: value} → {name: {value,min,max,step}} (діапазон навколо значення)
  const params: Record<string, { value: number; min: number; max: number; step: number }> = {}
  const sceneParams = cleanNumbers(scene.params)
  if (sceneParams) {
    for (const [name, value] of Object.entries(sceneParams)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name)) continue
      const span = Math.max(10, Math.abs(value) * 2)
      params[name] = {
        value,
        min: Math.round((value - span) * 100) / 100,
        max: Math.round((value + span) * 100) / 100,
        step: Math.abs(value) > 10 ? 1 : 0.1,
      }
    }
  }

  const vp = scene.viewport as { cx?: number; cy?: number; scale?: number } | undefined
  const rawScale = typeof vp?.scale === 'number' && vp.scale > 0 ? vp.scale : 38
  const viewport = {
    cx: typeof vp?.cx === 'number' && Number.isFinite(vp.cx) ? vp.cx : 0,
    cy: typeof vp?.cy === 'number' && Number.isFinite(vp.cy) ? vp.cy : 0,
    scale: Math.min(GC_SCALE_MAX, Math.max(GC_SCALE_MIN, rawScale)), // BE clamp [1,1000]
  }

  return {
    id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'graph_calculator',
    src: '',
    x: 120,
    y: 80,
    w: DEFAULT_GRAPH_WIDTH,
    h: DEFAULT_GRAPH_HEIGHT,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: { expressions, params, viewport },
      meta: { last_snapshot_seq: 0 },
    },
  } as unknown as WBAsset
}

/**
 * B3 (2026-07-07) — geo-сцена → НАТИВНИЙ `geomash_scene` ассет.
 * Жива GeoMASH-геометрія движком (vendor/geomash) + правий інспектор. Не картка.
 * Невалідна сцена (нема масиву objects) → null (fallback на mash_scene-картку).
 */
export function buildGeomashSceneAsset(scene: Record<string, unknown>): WBAsset | null {
  const objects = scene.objects
  if (!Array.isArray(objects)) return null
  const cs = scene.cs as { ox: number; oy: number; sc: number } | undefined
  const title = typeof scene.title === 'string' ? scene.title : undefined
  return {
    id: `geo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'geomash_scene',
    src: '',
    x: 120,
    y: 80,
    w: 460,
    h: 360,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      scene: {
        format: typeof scene.format === 'string' ? scene.format : 'geomash-scene',
        version: typeof scene.version === 'number' ? scene.version : 1,
        objects: objects as Array<Record<string, unknown>>,
        ...(cs ? { cs } : {}),
      },
      ...(title ? { title } : {}),
    },
  } as unknown as WBAsset
}

/**
 * B4 (2026-07-07) — g3d-сцена → НАТИВНИЙ `graphmash_3d` ассет.
 * Жива WebGL-поверхня движком (vendor/graphmash3d) + інспектор. data = MashSceneData
 * (app:'g3d', scene). Невалідна сцена (нема objects[]) → null (fallback картка).
 */
export function buildGraphmash3dAsset(scene: Record<string, unknown>): WBAsset | null {
  if (!Array.isArray(scene.objects)) return null
  const title = typeof scene.title === 'string' ? scene.title : undefined
  return {
    id: `gm3d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'graphmash_3d',
    src: '',
    x: 120,
    y: 80,
    w: 480,
    h: 380,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      app: 'g3d',
      sceneFormat: typeof scene.format === 'string' ? scene.format : 'graphmash-scene',
      scene,
      ...(title ? { title } : {}),
    },
  } as unknown as WBAsset
}

/**
 * (deprecated для g2d/geo/g3d — усі нативні) mash_scene-ассет-картка з thumbnail.
 * Лишається як fallback, коли нативна конвертація неможлива (сцена без придатних даних).
 */
export function buildMashSceneAsset(envelope: MashEnvelope, previewUrl?: string | null): WBAsset | null {
  if (envelope.app === 'stereo') return null // stereo → нативний nmt3d, інша гілка
  const scene = envelope.scene
  const sceneFormat = typeof scene.format === 'string' ? scene.format : ''
  const title =
    (typeof scene.title === 'string' && scene.title) ||
    (typeof scene.name === 'string' && scene.name) ||
    undefined
  return {
    id: `mashsc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'mash_scene',
    src: '',
    x: 140,
    y: 100,
    w: 360,
    h: 240,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      app: envelope.app,
      sceneFormat,
      scene,
      ...(title ? { title } : {}),
      // previewUrl — стиснутий thumbnail (data.* НЕ стрипається, лише src). Кап у view.
      ...(previewUrl ? { previewUrl } : {}),
    },
  } as unknown as WBAsset
}

/**
 * Стиснути прев'ю-конверта (повнорозмірний PNG data-URL) у маленький JPEG-thumbnail,
 * щоб показати обʼєкт на картці БЕЗ роздування стану (уникаємо 413 на save-stream).
 * DOM-залежне (Image+canvas) → живе в browser-контексті. Повертає null, якщо джерело
 * порожнє/криве або результат все одно завеликий (blank WebGL → чорний кадр теж null).
 */
export function downscalePreview(
  src: string | null | undefined,
  maxW = 480,
  maxKB = 90,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!src || !src.startsWith('data:image')) return resolve(null)
    const img = new Image()
    img.onload = () => {
      try {
        if (!img.width || !img.height) return resolve(null)
        const scale = Math.min(1, maxW / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        const ctx = cv.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.fillStyle = '#ffffff' // JPEG без альфи — білий фон замість чорного
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        const out = cv.toDataURL('image/jpeg', 0.7)
        // кап: захист від роздування стану (чорний WebGL-кадр стискається у ~кб — теж пройде,
        // але це прийнятно: покаже темний прямокутник, не зламає збереження)
        if (out.length > maxKB * 1024) return resolve(null)
        resolve(out)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Порожній initial state для createSession (SYSTEM_LAW §2, Plan v4 Phase I):
 * сесія створюється БЕЗ сторінок/ассетів — уся геометрія додається через
 * ops-pipeline (page_add + asset_add), не прямим write у state.
 */
export function buildEmptyInitialState(): WBWorkspaceState {
  return { pages: [], currentPageIndex: 0 }
}

/** op_id (REPLAY-INV-8): UUID, стабільний ідентифікатор операції для ідемпотентності. */
function genOpId(): string {
  return crypto.randomUUID()
}

/**
 * Ops для посіву імпортованого MASH-об'єкта у ПОРОЖНЮ сесію (SYSTEM_LAW §2):
 *   1. page_add — метадані сторінки (дзеркало createEmptyPage-дефолтів), БЕЗ assets
 *   2. asset_add — сам об'єкт, привʼязаний до page_id
 *
 * Обидва оп-и шлються ОДНИМ batch через POST /replay/batch/ зі свіжої сесії
 * (seq=0, бо last_op_seq=0). BE призначить seq 1 (page_add) та 2 (asset_add) —
 * об'єкт стає першою операцією, а не частиною базового снапшоту.
 */
export function buildMashImportOps(asset: WBAsset): RecordOperationRequest[] {
  const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return [
    {
      op_id: genOpId(),
      op_type: 'page_add',
      page_id: pageId,
      payload: {
        page: {
          id: pageId,
          name: 'Page 1',
          background: 'white',
          backgroundColor: '#ffffff',
        },
      },
    },
    {
      op_id: genOpId(),
      op_type: 'asset_add',
      page_id: pageId,
      payload: { asset },
    },
  ]
}
