/**
 * GraphMASH 3D inspector UI state — bridge між Graphmash3dRenderer та
 * Graphmash3dInspector (sidebar). Дзеркало geomashInspectorState.
 *
 * v1: список 3D-виразів (поверхонь) сцени. NOT persisted, FE UI only.
 */
import { reactive } from 'vue'

export interface Gm3dExprEntry {
  id: number
  /** Індекс src-об'єкта у scene.objects (для персисту style у правильний об'єкт). */
  objIdx: number
  src: string
  color: string
  colorMap: string
  wireframe: boolean
  opacity: number
  resolution: number
  /** Домен = симетрична пів-ширина (движок: x∈[-range,+range]). */
  range: number
  visible: boolean
}

/** Доступні колірні карти (з движка COLOR_MAPS). */
export type Gm3dColorMap = string

export interface Gm3dParamEntry {
  name: string
  value: number
  min: number
  max: number
  step: number
  /** Чи зараз програється авто-анімація (view-only, pingpong min↔max). */
  playing: boolean
}

export interface Graphmash3dInspectorBridge {
  /** Список виразів-поверхонь — renderer синкає reactive. */
  expressions: Gm3dExprEntry[]
  /** Параметри-слайдери (з scene.params) — renderer синкає reactive. */
  params: Gm3dParamEntry[]
  /** Доступні колірні карти (движок COLOR_MAPS). */
  colorMaps: Gm3dColorMap[]
  /** Ортографічна проєкція (view-only, не персиститься). */
  ortho: boolean
  /** Автообертання камери (view-only, не персиститься). */
  autoRotate: boolean
  /** Чи можна додати ще поверхню (не досягнуто ліміту). */
  canAdd: boolean
  /** Слайдер-ввід: engine.setParam + emit asset_update (ops). */
  onParamInput(name: string, value: number): void
  /**
   * Плей/пауза авто-анімації параметра (як ▶ у standalone). Програвання —
   * view-only (движок анімує внутрішньо, нуль ops); на паузу персиститься
   * поточне значення ОДНИМ asset_update.
   */
  onParamPlay(name: string, play: boolean): void
  /** Редагування формули поверхні: src → emit asset_update (движок re-classify). */
  onSrc(objIdx: number, src: string): void
  /** Показати/приховати поверхню: visible → emit asset_update. */
  onVisible(objIdx: number, visible: boolean): void
  /** Колір поверхні (#rrggbb): color → emit asset_update. */
  onColor(objIdx: number, color: string): void
  /** Додати нову поверхню (дефолтна формула) → emit asset_update. */
  onAdd(): void
  /** Дублювати поверхню (копія src/style/domain, новий id) → emit asset_update. */
  onDuplicate(objIdx: number): void
  /** Видалити поверхню зі сцени → emit asset_update. */
  onDelete(objIdx: number): void
  /** Колірна карта поверхні: engine.setColorMap + emit asset_update. */
  onColorMap(objIdx: number, engId: number, cm: string): void
  /** Каркас поверхні: engine.setWireframe + emit asset_update. */
  onWireframe(objIdx: number, engId: number, on: boolean): void
  /** Прозорість поверхні (0..1): engine.setOpacity + emit asset_update. */
  onOpacity(objIdx: number, engId: number, value: number): void
  /** Деталізація поверхні: engine.setResolution + emit asset_update. */
  onResolution(objIdx: number, engId: number, value: number): void
  /** Домен ±range (симетрична пів-ширина): engine.setRange + emit asset_update. */
  onRange(objIdx: number, engId: number, range: number): void
  /** Камера: скинути вид (view-only). */
  onResetView(): void
  /** Камера: вписати у вид (view-only). */
  onFitView(): void
  /** Камера: ортографічна проєкція on/off (view-only). */
  onOrtho(on: boolean): void
  /** Камера: автообертання on/off (view-only, як у редакторі). */
  onAutoRotate(on: boolean): void
}

export const graphmash3dInspectorState = reactive<{
  assetId: string | null
  bridge: Graphmash3dInspectorBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerGraphmash3dInspector(assetId: string, bridge: Graphmash3dInspectorBridge): void {
  graphmash3dInspectorState.assetId = assetId
  graphmash3dInspectorState.bridge = bridge
}

export function unregisterGraphmash3dInspector(assetId: string): void {
  if (graphmash3dInspectorState.assetId === assetId) {
    graphmash3dInspectorState.assetId = null
    graphmash3dInspectorState.bridge = null
  }
}

export function __resetGraphmash3dInspectorForTests(): void {
  graphmash3dInspectorState.assetId = null
  graphmash3dInspectorState.bridge = null
}
