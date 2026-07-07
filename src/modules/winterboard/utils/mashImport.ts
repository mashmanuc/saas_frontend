/**
 * MASH → дошка: імпорт envelope з публічної воронки (/mash/*).
 *
 * Контракт envelope (shared/use-on-board.js воронки, Proposal §8 «MASH Live Asset»):
 *   { app: 'g2d'|'g3d'|'geo'|'stereo', version: 1, scene: object, preview?: string }
 * Передача — localStorage[MASH_HANDOFF_KEY] (same-origin: воронка і SPA живуть на m4sh.org).
 *
 * v1: stereo → НАТИВНИЙ nmt3d-ассет (дошка вже рендерить цей тип). Створення сесії —
 * generator-патерн (INV-STABLE-2): state сіється ОДИН раз у createSession, далі ops-pipeline.
 * Жодних нових write-шляхів (SYSTEM_LAW §2).
 */
import type { WBAsset, WBPage, WBWorkspaceState } from '../types/winterboard'
import { DEFAULT_NMT3D_W, DEFAULT_NMT3D_H } from '../constants/nmt3dDefaults'

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

/**
 * g2d/g3d/geo → mash_scene-ассет (A3, §3.7.13): envelope-сцена їде на дошку ЗАВЖДИ
 * (Proposal §8 Board-first rule), рендер v1 — картка з deep-link. preview НЕ зберігаємо
 * (ops-recorder стрипає data:-URLs; state-bloat freeze).
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
 * g2d → НАТИВНИЙ `graphmash_2d`-ассет (B2, §3.7.14): живий графік движком на дошці,
 * не картка. data = MashSceneData (той самий envelope-shape). previewUrl не потрібен
 * (рендер живий), тому не кладемо.
 */
export function buildGraphmash2dAsset(envelope: MashEnvelope): WBAsset | null {
  if (envelope.app !== 'g2d') return null
  const scene = envelope.scene
  const sceneFormat = typeof scene.format === 'string' ? scene.format : ''
  const title =
    (typeof scene.title === 'string' && scene.title) ||
    (typeof scene.name === 'string' && scene.name) ||
    undefined
  return {
    id: `gm2d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'graphmash_2d',
    src: '',
    x: 140,
    y: 100,
    w: 460,
    h: 340,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      app: 'g2d',
      sceneFormat,
      scene,
      ...(title ? { title } : {}),
    },
  } as unknown as WBAsset
}

/** Seed-state для createSession: одна сторінка (дзеркало createEmptyPage) з ассетом. */
export function buildSeedState(asset: WBAsset): WBWorkspaceState {
  const page: WBPage = {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Page 1',
    strokes: [],
    assets: [asset],
    background: 'white' as WBPage['background'],
    backgroundColor: '#ffffff',
  }
  return { pages: [page], currentPageIndex: 0 }
}
