<!--
  GeomashRenderer — ЖИВА GeoMASH-геометрія як WBAsset (§3.7.14, B3 2026-07-07).

  Нативний рендер вбудованим headless-движком (vendor/geomash: GeoEngine +
  GeoRenderer за контрактом Guide §4) — справжні вектор-об'єкти (точки/прямі/
  кола/кути), не PNG. Дзеркало nmt3d/graph_calculator: renderer + правий
  інспектор (GeomashInspector — список об'єктів) при виділенні.

  v1 = display-live: рендер+навігація (правий сайдбар список об'єктів);
  редагування (додавання/рух точок) — deep-link «Відкрити у MASH». Незмінна
  data.scene → нуль ops write → SYSTEM_LAW чисто.

  POINTER-EVENTS: root none (Konva-proxy drag/select), кнопки auto+stop, canvas none.
-->
<template>
  <div
    ref="rootEl"
    class="geomash-card"
    :class="{ 'is-selected': isSelected }"
    :data-testid="`geomash-${asset.id}`"
  >
    <header class="gm-header">
      <span class="gm-badge">GeoMASH</span>
      <a
        class="gm-open"
        href="/mash/geomash/GeoMASH.html"
        target="_blank"
        rel="noopener"
        title="Відкрити у MASH"
        @mousedown.stop
        @pointerdown.stop
        @click.stop
      >↗</a>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="gm-delete"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>
    <div ref="stageEl" class="gm-stage">
      <canvas ref="canvasEl" class="gm-canvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { WBAsset } from '../../../types/winterboard'
import type { GeoObject, GeoRendererInstance, GeoView } from '../../../vendor/geomash'
import { registerGeomashInspector, unregisterGeomashInspector } from '../../../board/state/geomashInspectorState'
import type { GeomashInspectorBridge } from '../../../board/state/geomashInspectorState'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean }>(),
  { isSelected: false, interactive: true },
)
const emit = defineEmits<{ 'update:asset': [asset: WBAsset]; delete: [] }>()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let rr: GeoRendererInstance | null = null
let ro: ResizeObserver | null = null
let objects: Map<string, GeoObject> = new Map()

/** scene = data.scene (envelope від воронки: {objects[], cs}). */
const scene = computed(() => {
  const d = props.asset.data as unknown as { scene?: { objects?: GeoObject[]; cs?: { ox: number; oy: number; sc: number } } }
  return d?.scene ?? { objects: [], cs: undefined }
})

/** Список об'єктів для інспектора (реактивний). */
const objectList = computed<GeoObject[]>(() => (Array.isArray(scene.value.objects) ? scene.value.objects : []))

/** Bridge — renderer синкає objects (дзеркало graphCalc _gcBridge-патерну). */
const _bridge = reactive<GeomashInspectorBridge>({ objects: [] })
watch(objectList, (v) => { _bridge.objects = v }, { immediate: true })

function currentView(): GeoView {
  const cv = canvasEl.value
  const w = cv?.width || 400
  const h = cv?.height || 300
  const cs = scene.value.cs
  // v1: використовуємо cs сцени, але центруємо origin у канві дошки (розмір інший, ніж у воронці)
  const sc = cs && cs.sc > 0 ? cs.sc : 40
  return { ox: w / 2, oy: h / 2, sc, w, h, dpr: 1 }
}

function redraw() {
  if (!rr || !canvasEl.value) return
  try {
    rr.draw({ objects }, currentView(), { showGrid: true, gridMode: 'lines' })
  } catch (err) {
    console.warn('[geomash] draw failed', err)
  }
}

function sizeCanvas() {
  const cv = canvasEl.value
  const st = stageEl.value
  if (!cv || !st) return
  const w = Math.max(40, Math.round(st.clientWidth))
  const h = Math.max(40, Math.round(st.clientHeight))
  if (cv.width !== w || cv.height !== h) {
    cv.width = w
    cv.height = h
    rr?.resize?.(w, h, 1)
  }
  redraw()
}

async function mount() {
  await import('../../../vendor/geomash') // side-effect: window.GeoEngine + createGeoRenderer
  const engine = window.GeoEngine
  const make = window.createGeoRenderer
  if (!canvasEl.value || !engine || !make) return
  objects = engine.deserialize(scene.value as never).objects
  rr = make(canvasEl.value, { engine })
  requestAnimationFrame(() => { sizeCanvas(); requestAnimationFrame(sizeCanvas) })
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(stageEl.value)
  }
}

onMounted(mount)

// data.scene змінилась (replay/update) → перечитати об'єкти + перемалювати
watch(() => JSON.stringify(scene.value), () => {
  const engine = window.GeoEngine
  if (engine) objects = engine.deserialize(scene.value as never).objects
  redraw()
})

// Правий інспектор — bridge при виділенні (дзеркало graph_calculator)
watch(() => props.isSelected, (sel) => {
  if (sel) registerGeomashInspector(props.asset.id, _bridge)
  else unregisterGeomashInspector(props.asset.id)
}, { immediate: true })

onBeforeUnmount(() => {
  unregisterGeomashInspector(props.asset.id)
  try { ro?.disconnect() } catch { /* noop */ }
  ro = null
  try { rr?.destroy?.() } catch { /* noop */ }
  rr = null
})

useExportCapture(() => props.asset?.id, (signal) => snapshotElement(rootEl.value, signal))
</script>

<style scoped>
.geomash-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid rgba(26, 92, 56, 0.4);
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 2px 10px rgba(26, 92, 56, 0.12);
}
.geomash-card.is-selected { border-color: #1a5c38; }
.gm-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(26, 92, 56, 0.08);
  flex-shrink: 0;
}
.gm-badge { font-size: 11px; font-weight: 700; color: #1a5c38; flex: 1; }
.gm-open, .gm-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  color: #1a5c38;
}
.gm-delete { color: #9ca3af; font-size: 16px; }
.gm-delete:hover { color: #ef4444; }
.gm-stage { flex: 1; min-height: 0; position: relative; pointer-events: none; }
.gm-canvas { display: block; width: 100%; height: 100%; }
</style>
