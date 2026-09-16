/**
 * V-D3 · реєстр ЛОКАЛЬНИХ прототипів візуальних капсул (FE).
 *
 * ⚠️ Це НЕ production-реєстр. Єдине джерело production-списку — бекенд
 * `apps/lesson_constructor/domain/visual_capsules.py` і згенерований
 * `learning-content/utils/visualCapsules.manifest.json` (V-F1.2). Він лишається порожнім,
 * доки власник не прийме сцену живцем (ТЗ V-D3 §6). Тут — лише прототип для DEV-лабораторії.
 *
 * Невідомий `visual_id` чи версія — явна помилка, а не порожня сцена.
 */
import type { ControlPolicy } from './capsuleControls'
import type { VisualCapsuleAsset, VisualCapsuleAssetData } from '../../../../types/winterboard'
import * as geometry from './trianglesOverlayGeometry'
import { highlightLevel, VERSION, VISUAL_ID, type SceneEnvelope } from './trianglesOverlayMachine'

export interface CapsulePrototype {
  visual_id: string
  version: number
  /** Пресет наявного `Geometry2DRenderer`; нового рендерера немає. */
  preset: string
  /** Одна геометрія на обидва режими — recall не має власної копії. */
  geometry: typeof geometry
  modes: ReadonlyArray<'full' | 'recall'>
  /** Які дії контролера видно вчителю — політика цієї капсули (V-D3.1). */
  controls: Readonly<ControlPolicy>
  status: 'prototype'
}

const TRIANGLES_OVERLAY: CapsulePrototype = Object.freeze({
  visual_id: VISUAL_ID,
  version: VERSION,
  preset: 'triangles_overlay',
  geometry,
  modes: Object.freeze(['full', 'recall'] as const),
  // Дослівно з відгуку власника (19_V-D3_OWNER_REVIEW §Масштабування).
  controls: Object.freeze({
    prediction: 'visible',
    play_pause: 'visible',
    step: 'hidden',
    restart: 'shown_as_repeat_after_completion',
    mode_switch: 'outside_scene',
    diagnostics: 'dev_only',
  } as const),
  status: 'prototype',
})

const PROTOTYPES: ReadonlyArray<CapsulePrototype> = Object.freeze([TRIANGLES_OVERLAY])

export class UnknownVisualCapsuleError extends Error {
  constructor(readonly visualId: string, readonly version: number) {
    super(`невідома візуальна капсула ${visualId} v${version}`)
    this.name = 'UnknownVisualCapsuleError'
  }
}

export function resolveCapsule(visualId: string, version: number): CapsulePrototype {
  const found = PROTOTYPES.find((c) => c.visual_id === visualId && c.version === version)
  if (!found) throw new UnknownVisualCapsuleError(visualId, version)
  return found
}

/**
 * Ключ пресета для поточного кадру: базовий до `correspondence`, далі — рівень підсвітки
 * `<preset>_pairs_<k>` (vendor geo2d-presets.js). Підсвітка не йде в `data.toggles` (ТЗ §3.2).
 */
export function presetFor(capsule: CapsulePrototype, envelope: SceneEnvelope): string {
  const level = highlightLevel(envelope)
  return level === 0 ? capsule.preset : `${capsule.preset}_pairs_${level}`
}

/** Розмір картки капсули — як у маніфесті уроку TLV2-03 (`p1-capsule`, 800×700). */
export const VISUAL_CAPSULE_CARD_W = 800
export const VISUAL_CAPSULE_CARD_H = 700

/**
 * TLV2-06R.1 · ЄДИНИЙ FE-конструктор картки `visual_capsule`.
 * Адреса капсули валідується цим реєстром: невідома капсула — `UnknownVisualCapsuleError`,
 * режим поза `capsule.modes` — помилка. Жодної картки з неіснуючою адресою.
 * `center` — центр картки в координатах сторінки.
 */
export function buildVisualCapsuleAsset(
  center: { x: number; y: number },
  address: Pick<VisualCapsuleAssetData, 'visual_id' | 'capsule_version' | 'mode'>,
): VisualCapsuleAsset {
  const capsule = resolveCapsule(address.visual_id, address.capsule_version)
  if (!capsule.modes.includes(address.mode)) {
    throw new Error(`капсула ${address.visual_id} v${address.capsule_version} не має режиму ${address.mode}`)
  }
  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? `vcap-${crypto.randomUUID()}`
    : `vcap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    type: 'visual_capsule',
    src: '',
    x: center.x - VISUAL_CAPSULE_CARD_W / 2,
    y: center.y - VISUAL_CAPSULE_CARD_H / 2,
    w: VISUAL_CAPSULE_CARD_W,
    h: VISUAL_CAPSULE_CARD_H,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      visual_id: address.visual_id,
      capsule_version: address.capsule_version,
      mode: address.mode,
    },
  } as VisualCapsuleAsset
}
