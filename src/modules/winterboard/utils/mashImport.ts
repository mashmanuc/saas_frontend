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
