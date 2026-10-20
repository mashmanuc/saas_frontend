/**
 * «Наочна сцена» — розмір і будівник нового асета. Один будівник на всі шляхи вставки («Інструменти» клік /
 * перетягування). Розмір — під макет сцен (сцена + бічна панель), 16:10.
 */
import { MATH_SCENE_DRAG_MIME, type MathSceneAsset, type MathSceneId } from '../types/mathScene'

export { MATH_SCENE_DRAG_MIME }

export const DEFAULT_MATH_SCENE_W = 1000
export const DEFAULT_MATH_SCENE_H = 640

/** Новий асет з центром у `pos`. */
export function buildMathSceneAsset(
  pos: { x: number; y: number },
  sceneId: MathSceneId,
  id: string = `mscene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
): MathSceneAsset {
  return {
    id,
    type: 'math_scene',
    src: '',
    x: pos.x - DEFAULT_MATH_SCENE_W / 2,
    y: pos.y - DEFAULT_MATH_SCENE_H / 2,
    w: DEFAULT_MATH_SCENE_W,
    h: DEFAULT_MATH_SCENE_H,
    rotation: 0,
    locked: false,
    data: { version: 1, sceneId },
  }
}
