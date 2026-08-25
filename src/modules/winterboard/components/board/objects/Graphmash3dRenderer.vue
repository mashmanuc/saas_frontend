<!--
  Graphmash3dRenderer — ЖИВА GraphMASH 3D-поверхня як WBAsset (§3.7.15, B4 2026-07-07).

  Нативний WebGL-рендер вбудованим движком (vendor/graphmash3d: GraphCalculator3D,
  ES-модуль на three.js) — справжня 3D-поверхня z=f(x,y) з orbit, НЕ PNG.
  Дзеркало geo/2D: renderer + правий інспектор (Graphmash3dInspector — список
  виразів + кольормапа).

  v1 = live: WebGL-поверхня рендериться; orbit доступний коли обʼєкт виділений
  (pointer-events auto), інакше board-drag через Konva-proxy. Редагування виразів
  — deep-link «Відкрити у MASH». Незмінна data.scene → нуль ops write → SYSTEM_LAW.
-->
<template>
  <div
    ref="rootEl"
    class="gm3d-card"
    :class="{ 'is-selected': isSelected, 'is-expanded': isExpanded }"
    :data-testid="`graphmash3d-${asset.id}`"
  >
    <header class="gm3d-header">
      <span class="gm3d-badge">GraphMASH 3D</span>
      <!-- Розгорнути на цілу дошку (НЕ виносить із дошки; дзеркало nmt3d) -->
      <button
        type="button"
        class="gm3d-expand-btn"
        :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
        @click.stop="emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="gm3d-delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>
    <!-- INV-OVERLAY-CLICK v2 крок 2 (2026-07-16): тіло ЗАВЖДИ інтерактивне у
         select-режимі (interactive) — orbit одним жестом; wrapper-capture guard
         виділяє картку тим самим дотиком. Pen/readonly (interactive=false) →
         none, ink поверх. Drag картки — лише за header. -->
    <div ref="stageEl" class="gm3d-stage" :class="{ 'gm3d-stage--interactive': interactive }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset, MashSceneData } from '../../../types/winterboard'
import { registerGraphmash3dInspector, unregisterGraphmash3dInspector } from '../../../board/state/graphmash3dInspectorState'
import type { Gm3dExprEntry, Gm3dParamEntry, Graphmash3dInspectorBridge } from '../../../board/state/graphmash3dInspectorState'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { topmostForeignOverlayAssetId } from '../../../utils/overlayTopHit'

const { t } = useI18n()

interface Gm3dEngine {
  setState(state: { expressions: unknown[]; params?: Record<string, number> }): void
  addExpression(src: string, color?: string, opts?: Record<string, unknown>): { id: number }
  setParam(name: string, value: number): void
  setColorMap(id: number, cm: string): void
  setWireframe(id: number, on: boolean): void
  setOpacity(id: number, o: number): void
  setResolution(id: number, n: number): void
  setRange(id: number, r: number): void
  updateExpression(id: number, src: string): void
  setVisible(id: number, v: boolean): void
  startAnimation(name: string, opts?: { min?: number; max?: number; speed?: number; mode?: string }): void
  setAnimationOpts(name: string, opts?: { min?: number; max?: number; speed?: number; mode?: string }): void
  stopAnimation(name: string): void
  stopAllAnimations(): void
  getParam(name: string): number | undefined
  resetView(): void
  autoFit(): void
  setOrtho(on: boolean): void
  setAutoRotate(on: boolean, speed?: number): void
  expressions: Array<{ id: number; src: string; color: string; colorMap?: string; wireframe?: boolean; opacity?: number; resolution?: number; range?: number; visible?: boolean }>
  params: Record<string, number>
  resize?(): void
  destroy(): void
}

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean; isExpanded?: boolean }>(),
  { isSelected: false, interactive: true, isExpanded: false },
)
const emit = defineEmits<{ 'update:asset': [asset: WBAsset]; delete: []; expand: []; 'select-other': [assetId: string] }>()

/**
 * WYSIWYG при перекритті карток: тіло виділеної 3D-картки (pointer-events:auto,
 * двигун ловить drag-orbit) перехоплює кліки навіть там, де ЗВЕРХУ намальована
 * інша картка (невиділені обгортки pointer-events:none — hit-test їх не бачить).
 * Capture-фаза ДО двигуна: чужа картка зверху → перемкнути виділення на неї.
 */
function onStageCapturePointerDown(ev: PointerEvent) {
  if (!props.isSelected || props.isExpanded) return
  const other = topmostForeignOverlayAssetId(ev.clientX, ev.clientY, rootEl.value)
  if (other) {
    ev.stopPropagation() // двигун (orbit) не має отримати цей клік
    ev.preventDefault()
    emit('select-other', other)
  }
}

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let eng: Gm3dEngine | null = null
let ro: ResizeObserver | null = null
let colorMaps: string[] = []
// Параметри, що зараз авто-анімуються (view-only, движок анімує внутрішньо) + poll-таймер
// для живого відображення значення в інспекторі (нуль ops під час програвання).
const _playing = new Set<string>()
let _animPollId: ReturnType<typeof setInterval> | null = null
// Ліміт поверхонь (FE-guard; BE застосовує graphmash_3d generic, без cap) + палітра
// нових поверхонь (дзеркало движка PALETTE3D) + лічильник id для add/duplicate.
const GC_MAX_SURFACES = 12
const NEW_SURFACE_PALETTE = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19', '#cf5283', '#0d9488', '#b45309']
let _idSeq = 0
// Локальне джерело правди для scene між emit і флашем props.asset. Кілька швидких
// емитів підряд (drag / крос-поле) читали б застарілий props.asset (реактивність ще
// не флашнула) і КЛОБЕРили б одне одного. workingScene тримає останню емитнуту версію;
// скидається на null коли приходить ЗОВНІШНЯ зміна (replay/інша вкладка).
let workingScene: Record<string, unknown> | null = null

const scene = computed(() => {
  const d = props.asset.data as unknown as MashSceneData
  return (d?.scene ?? {}) as Record<string, unknown>
})

/** Актуальна scene для читання-під-патч: локальний working (якщо є) інакше props. */
function curScene(): Record<string, unknown> {
  return workingScene ?? scene.value
}

/** funnel-сцена ({objects:[{src,color,style,domain}]}) → engine.setState({expressions}). */
function sceneToEngineState(sc: Record<string, unknown>): { expressions: unknown[]; params?: Record<string, number> } {
  const objs = Array.isArray(sc.objects) ? sc.objects : []
  const expressions = (objs as Array<Record<string, unknown>>)
    .filter(o => typeof o.src === 'string' && o.src)
    .map((o) => {
      const style = (o.style as Record<string, unknown>) ?? {}
      const domain = (o.domain as Record<string, unknown>) ?? {}
      return {
        src: o.src,
        color: typeof o.color === 'string' ? o.color : undefined,
        visible: o.visible !== false,
        colorMap: style.colorMap ?? 'solid',
        wireframe: !!style.wireframe,
        opacity: typeof style.opacity === 'number' ? style.opacity : 1,
        range: domain.range ?? null,
        resolution: domain.resolution ?? null,
        tRange: domain.tRange ?? null, uRange: domain.uRange ?? null, vRange: domain.vRange ?? null,
      }
    })
  // params: {name:{value}} → {name:value}
  const params: Record<string, number> = {}
  const p = sc.params as Record<string, { value?: number } | number> | undefined
  if (p && typeof p === 'object') {
    for (const [k, v] of Object.entries(p)) {
      const val = typeof v === 'number' ? v : (v && typeof v.value === 'number' ? v.value : undefined)
      if (typeof val === 'number' && Number.isFinite(val)) params[k] = val
    }
  }
  return { expressions, params }
}

/** Параметри-слайдери з scene.params (funnel {name:{value,min,max}}). */
function sceneParams(): Gm3dParamEntry[] {
  const p = curScene().params as Record<string, { value?: number; min?: number; max?: number } | number> | undefined
  if (!p || typeof p !== 'object') return []
  const out: Gm3dParamEntry[] = []
  for (const [name, v] of Object.entries(p)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name)) continue
    const value = typeof v === 'number' ? v : (typeof v?.value === 'number' ? v.value : 0)
    const min = typeof v === 'object' && typeof v.min === 'number' ? v.min : Math.min(-10, value - 10)
    const max = typeof v === 'object' && typeof v.max === 'number' ? v.max : Math.max(10, value + 10)
    out.push({ name, value, min, max, step: (max - min) / 100 || 0.1, playing: _playing.has(name) })
  }
  return out
}

/**
 * Спільний емітер: patch scene → emit update:asset (asset_update оп).
 * Движок оновиться реактивно через watch(scene)→applyStateAndParams (SSOT = scene,
 * без крихкої залежності від engine expression-id, який змінюється на setState).
 */
function patchSceneAndEmit(nextScene: Record<string, unknown>) {
  workingScene = nextScene // синхронне джерело правди до флашу props
  const d = props.asset.data as unknown as MashSceneData
  emit('update:asset', { ...props.asset, data: { ...(d as object), scene: nextScene } } as unknown as WBAsset)
}

/** Слайдер параметра → scene.params[name].value → asset_update (движок re-render через watch). */
function onParamInput(name: string, value: number) {
  if (!Number.isFinite(value)) return
  const sc = curScene()
  const params = { ...(sc.params as Record<string, unknown> ?? {}) }
  const prev = params[name]
  params[name] = typeof prev === 'object' && prev !== null ? { ...(prev as object), value } : { value }
  patchSceneAndEmit({ ...sc, params })
}

/** Межі параметра [min,max] → scene.params[name].min/max (слайдер + ▶ діапазон). Персист. */
function onParamRange(name: string, min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return
  const sc = curScene()
  const params = { ...(sc.params as Record<string, unknown> ?? {}) }
  const prev = params[name]
  const base = typeof prev === 'object' && prev !== null ? (prev as Record<string, unknown>) : { value: prev }
  params[name] = { ...base, min, max }
  patchSceneAndEmit({ ...sc, params })
  // якщо параметр зараз анімується — оновити межі в движку наживо
  if (_playing.has(name)) { try { eng?.setAnimationOpts?.(name, { min, max }) } catch { /* noop */ } }
  _bridge.params = sceneParams()
}

/**
 * Плей/пауза авто-анімації параметра (▶ як у standalone). Програвання = view-only:
 * движок анімує this.params[name] у власному RAF-циклі (pingpong min↔max) без emit
 * (onChange не підписаний). На ПАУЗУ читаємо поточне значення й персиститимо ОДНИМ
 * asset_update (onParamInput) → store/replay консистентні; нуль ops-шторму.
 */
function onParamPlay(name: string, play: boolean) {
  if (!eng) return
  const meta = sceneParams().find(p => p.name === name)
  if (play) {
    const min = meta?.min ?? -10
    const max = meta?.max ?? 10
    const speed = Math.max(0.5, (max - min) / 4) // ~4с на прохід
    try { eng.startAnimation(name, { min, max, speed, mode: 'pingpong' }) } catch { /* noop */ }
    _playing.add(name)
    startAnimPoll()
  } else {
    try { eng.stopAnimation(name) } catch { /* noop */ }
    _playing.delete(name)
    if (!_playing.size) stopAnimPoll()
    const cur = eng.getParam(name)
    if (typeof cur === 'number' && Number.isFinite(cur)) {
      onParamInput(name, Math.round(cur * 1000) / 1000) // персист фінального значення (1 op)
    }
  }
  // синк playing-прапорців у інспектор без re-setState
  _bridge.params = sceneParams()
}

/** Живе відображення анімованого значення параметра в інспекторі (view-only, ~8 Гц). */
function startAnimPoll() {
  if (_animPollId != null) return
  _animPollId = setInterval(() => {
    if (!eng || !_playing.size) return
    for (const p of _bridge.params) {
      if (_playing.has(p.name)) {
        const v = eng.getParam(p.name)
        if (typeof v === 'number') p.value = Math.round(v * 1000) / 1000
      }
    }
  }, 120)
}
function stopAnimPoll() {
  if (_animPollId != null) { clearInterval(_animPollId); _animPollId = null }
}

/** Індекси scene.objects, що мають src (порядок = порядок eng.expressions). */
function srcObjectIndices(): number[] {
  const objs = Array.isArray(curScene().objects) ? curScene().objects : []
  const out: number[] = []
  ;(objs as Array<Record<string, unknown>>).forEach((o, i) => { if (typeof o.src === 'string' && o.src) out.push(i) })
  return out
}

/** Патч style/domain-поля поверхні scene.objects[objIdx] + emit (движок re-render через watch). */
function patchObj(objIdx: number, key: 'style' | 'domain', patch: Record<string, unknown>) {
  const sc = curScene()
  const objs = Array.isArray(sc.objects) ? [...(sc.objects as unknown[])] : []
  const obj = objs[objIdx] as Record<string, unknown> | undefined
  if (!obj) return
  objs[objIdx] = { ...obj, [key]: { ...((obj[key] as object) ?? {}), ...patch } }
  patchSceneAndEmit({ ...sc, objects: objs })
}

/** Патч top-level полів об'єкта (src / visible / color) + emit. */
function patchObjField(objIdx: number, patch: Record<string, unknown>) {
  const sc = curScene()
  const objs = Array.isArray(sc.objects) ? [...(sc.objects as unknown[])] : []
  const obj = objs[objIdx] as Record<string, unknown> | undefined
  if (!obj) return
  objs[objIdx] = { ...obj, ...patch }
  patchSceneAndEmit({ ...sc, objects: objs })
}

/** Редагування формули: src → scene.objects[objIdx].src (движок re-classify через watch). */
function onSrc(objIdx: number, src: string) {
  const s = String(src).trim()
  if (!s) return // порожню формулу ігноруємо (видалення — через кнопку delete)
  patchObjField(objIdx, { src: s })
}
/** Око: показати/приховати поверхню → scene.objects[objIdx].visible. */
function onVisible(objIdx: number, visible: boolean) {
  patchObjField(objIdx, { visible })
}
/** Колір поверхні (#rrggbb) → scene.objects[objIdx].color. */
function onColor(objIdx: number, color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
  patchObjField(objIdx, { color })
}
/** Унікальний id для нової/дубльованої поверхні (у component-scope Date.now дозволено). */
function genObjId(): string {
  _idSeq += 1
  return `s${Date.now().toString(36)}${_idSeq}`
}
/** Додати нову поверхню з дефолтною формулою (guard на ліміт). */
function onAdd() {
  const sc = curScene()
  const objs = Array.isArray(sc.objects) ? [...(sc.objects as unknown[])] : []
  if (objs.length >= GC_MAX_SURFACES) return
  const color = NEW_SURFACE_PALETTE[objs.length % NEW_SURFACE_PALETTE.length]
  const newObj = {
    id: genObjId(),
    src: 'z=x*y/4',
    color,
    style: { colorMap: 'viridis', wireframe: false, opacity: 1 },
    domain: { range: 3, resolution: 60 },
    visible: true,
  }
  patchSceneAndEmit({ ...sc, objects: [...objs, newObj] })
}
/** Дублювати поверхню (deep-copy, новий id, вставка одразу після). */
function onDuplicate(objIdx: number) {
  const sc = curScene()
  const objs = Array.isArray(sc.objects) ? [...(sc.objects as unknown[])] : []
  if (objs.length >= GC_MAX_SURFACES) return
  const orig = objs[objIdx] as Record<string, unknown> | undefined
  if (!orig) return
  const copy = JSON.parse(JSON.stringify(orig)) as Record<string, unknown>
  copy.id = genObjId()
  objs.splice(objIdx + 1, 0, copy)
  patchSceneAndEmit({ ...sc, objects: objs })
}
/** Видалити поверхню зі сцени. */
function onDelete(objIdx: number) {
  const sc = curScene()
  const objs = Array.isArray(sc.objects) ? [...(sc.objects as unknown[])] : []
  if (objIdx < 0 || objIdx >= objs.length) return
  objs.splice(objIdx, 1)
  patchSceneAndEmit({ ...sc, objects: objs })
}
/** Камера: автообертання on/off (view-only, як у standalone-редакторі). */
function onAutoRotate(on: boolean) {
  try { eng?.setAutoRotate(on, 1) } catch { /* noop */ }
  _bridge.autoRotate = on
}

/**
 * Style/domain-хендлери: ЛИШЕ патчать scene + emit. Движок оновиться через
 * watch(scene)→applyStateAndParams (engine = чисте дзеркало scene, без крихкої
 * прив'язки до engine expression-id, який змінюється на кожен setState). engId у
 * сигнатурі зберігаємо для сумісності bridge-контракту, але не використовуємо.
 */
function onColorMap(objIdx: number, _engId: number, cm: string) { patchObj(objIdx, 'style', { colorMap: cm }) }
function onWireframe(objIdx: number, _engId: number, on: boolean) { patchObj(objIdx, 'style', { wireframe: on }) }
function onOpacity(objIdx: number, _engId: number, value: number) {
  if (Number.isFinite(value)) patchObj(objIdx, 'style', { opacity: value })
}
function onResolution(objIdx: number, _engId: number, value: number) {
  const n = Math.round(value)
  if (Number.isFinite(n) && n >= 2) patchObj(objIdx, 'domain', { resolution: n })
}
function onRange(objIdx: number, _engId: number, range: number) {
  if (Number.isFinite(range) && range > 0) patchObj(objIdx, 'domain', { range })
}
// ── Камера (view-only, НЕ персиститься як ops — як orbit) ──
function onResetView() { try { eng?.resetView() } catch { /* noop */ } }
function onFitView() { try { eng?.autoFit() } catch { /* noop */ } }
function onOrtho(on: boolean) { try { eng?.setOrtho(on) } catch { /* noop */ }; _bridge.ortho = on }

/** Bridge — вирази + параметри для інспектора; renderer синкає. */
const _bridge = reactive<Graphmash3dInspectorBridge>({
  expressions: [], params: [], colorMaps: [], ortho: false, autoRotate: false, canAdd: true,
  onParamInput, onParamPlay, onParamRange, onSrc, onVisible, onColor, onAdd, onDuplicate, onDelete,
  onColorMap, onWireframe, onOpacity, onResolution, onRange,
  onResetView, onFitView, onOrtho, onAutoRotate,
})
function syncBridge() {
  const idxMap = srcObjectIndices()
  _bridge.expressions = (eng?.expressions ?? []).map((e, k) => ({
    id: e.id, objIdx: idxMap[k] ?? -1, src: e.src, color: e.color,
    colorMap: e.colorMap ?? 'solid', wireframe: !!e.wireframe,
    opacity: typeof e.opacity === 'number' ? e.opacity : 1,
    resolution: typeof e.resolution === 'number' ? e.resolution : 100,
    range: typeof e.range === 'number' ? e.range : 3,
    visible: e.visible !== false,
  }))
  _bridge.params = sceneParams()
  _bridge.colorMaps = colorMaps
  const objs = curScene().objects
  _bridge.canAdd = (Array.isArray(objs) ? objs.length : 0) < GC_MAX_SURFACES
}

/**
 * setState + застосувати scene.params через setParam. КРИТИЧНО: setState re-додає
 * param-вирази (`a=1`) з їхнім ДЕФОЛТНИМ значенням → тому ПІСЛЯ setState накладаємо
 * актуальні scene.params (наші slider-редагування виграють). Інакше reload/replay
 * показував би дефолт замість збереженого значення.
 */
function applyStateAndParams() {
  if (!eng) return
  // setState може кинути на неповній/невалідній формулі (live-edit) — guard, щоб не
  // зламати весь рендер; стан дошки не чіпається (ops-шлях окремий). НЕ silent: логуємо.
  try { eng.setState(sceneToEngineState(curScene())) } catch (err) { console.warn('[graphmash3d] setState', err) }
  for (const p of sceneParams()) {
    try { eng.setParam(p.name, p.value) } catch { /* noop */ }
  }
  syncBridge()
}

async function mount() {
  if (!stageEl.value) return
  // three.js важкий → динамічний імпорт движка (ES-модуль); резолвиться на board-three
  const mod = await import('../../../vendor/graphmash3d/grapher-3d-engine.js') as unknown as {
    GraphCalculator3D: new (el: HTMLElement, opts?: Record<string, unknown>) => Gm3dEngine
    COLOR_MAPS?: string[]
  }
  if (!stageEl.value) return
  colorMaps = Array.isArray(mod.COLOR_MAPS) ? mod.COLOR_MAPS : []
  try {
    eng = new mod.GraphCalculator3D(stageEl.value, {})
    applyStateAndParams()
  } catch (err) {
    console.warn('[graphmash3d] mount failed', err)
    return
  }
  requestAnimationFrame(() => { eng?.resize?.() })
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => eng?.resize?.())
    ro.observe(stageEl.value)
  }
  // capture-фаза ПЕРЕД listeners двигуна (orbit) — WYSIWYG при перекритті карток
  stageEl.value?.addEventListener('pointerdown', onStageCapturePointerDown, { capture: true })
}

onMounted(mount)

// data.scene змінилась (локальний slider-edit АБО replay applier/інша вкладка) →
// engine повністю ре-рендериться зі scene. applyStateAndParams re-накладає scene.params
// ПІСЛЯ setState (setState re-додає param-вирази з дефолтом), тож slider-редагування не
// скидаються. Єдиний шлях engine←scene → нема розсинхрону / stale engId.
watch(() => JSON.stringify(scene.value), (json) => {
  // Наш echo (props флашнув нашу емитнуту версію) → лишаємо workingScene; інакше
  // ЗОВНІШНЯ зміна (replay/інша вкладка) → відкидаємо локальний working, адаптуємо props.
  if (workingScene && JSON.stringify(workingScene) !== json) workingScene = null
  applyStateAndParams()
})

watch(() => props.isSelected, (sel) => {
  if (sel) registerGraphmash3dInspector(props.asset.id, _bridge)
  else unregisterGraphmash3dInspector(props.asset.id)
}, { immediate: true })

// Розгортання на цілу дошку → контейнер росте → resize WebGL (RO теж ловить, але
// форсуємо на випадок таймінгу CSS-класу). ESC — згорнути (дзеркало nmt3d).
watch(() => props.isExpanded, () => {
  requestAnimationFrame(() => { try { eng?.resize?.() } catch { /* noop */ } })
})
function _onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && props.isExpanded) emit('expand') }
if (typeof window !== 'undefined') window.addEventListener('keydown', _onEsc)

onBeforeUnmount(() => {
  unregisterGraphmash3dInspector(props.asset.id)
  if (typeof window !== 'undefined') window.removeEventListener('keydown', _onEsc)
  stageEl.value?.removeEventListener('pointerdown', onStageCapturePointerDown, { capture: true })
  stopAnimPoll()
  try { ro?.disconnect() } catch { /* noop */ }
  ro = null
  try { eng?.stopAllAnimations() } catch { /* noop */ }
  try { eng?.destroy() } catch { /* noop */ }
  eng = null
})

useExportCapture(() => props.asset?.id, (signal) => snapshotElement(rootEl.value, signal))
</script>

<style scoped>
.gm3d-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f8f8;
  border: 1px solid rgba(45, 112, 179, 0.4);
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 2px 10px rgba(45, 112, 179, 0.12);
}
.gm3d-card.is-selected { border-color: #2d70b3; }
.gm3d-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(45, 112, 179, 0.08);
  flex-shrink: 0;
}
.gm3d-badge { font-size: 11px; font-weight: 700; color: #2d70b3; flex: 1; }
.gm3d-expand-btn, .gm3d-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  color: #2d70b3;
}
.gm3d-expand-btn:hover { color: #22597f; }
.gm3d-delete { color: #9ca3af; font-size: 16px; }
.gm3d-delete:hover { color: #ef4444; }
.gm3d-stage { flex: 1; min-height: 0; position: relative; pointer-events: none; }
/* Orbit лише коли виділено (інакше board-drag/select через Konva-proxy).
   touch-action:none — щоб на планшеті перетяг одним пальцем обертав 3D-модель,
   а не запускав нативний скрол/зум браузера (паритет із Geomash/Nmt3d/Solid-рендерерами). */
.gm3d-stage--interactive { pointer-events: auto; touch-action: none; }
.gm3d-stage :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
