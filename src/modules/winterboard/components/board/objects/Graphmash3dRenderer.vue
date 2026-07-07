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
    :class="{ 'is-selected': isSelected }"
    :data-testid="`graphmash3d-${asset.id}`"
  >
    <header class="gm3d-header">
      <span class="gm3d-badge">GraphMASH 3D</span>
      <a
        class="gm3d-open"
        href="/mash/grapher-3d/index.html"
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
        class="gm3d-delete"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>
    <!-- orbit доступний лише коли виділено (інакше board-drag) -->
    <div ref="stageEl" class="gm3d-stage" :class="{ 'gm3d-stage--interactive': isSelected }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { WBAsset, MashSceneData } from '../../../types/winterboard'
import { registerGraphmash3dInspector, unregisterGraphmash3dInspector } from '../../../board/state/graphmash3dInspectorState'
import type { Gm3dExprEntry } from '../../../board/state/graphmash3dInspectorState'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

interface Gm3dEngine {
  setState(state: { expressions: unknown[]; params?: Record<string, number> }): void
  addExpression(src: string, color?: string, opts?: Record<string, unknown>): { id: number }
  expressions: Array<{ id: number; src: string; color: string; colorMap?: string; visible?: boolean }>
  resize?(): void
  destroy(): void
}

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean }>(),
  { isSelected: false, interactive: true },
)
const emit = defineEmits<{ 'update:asset': [asset: WBAsset]; delete: [] }>()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let eng: Gm3dEngine | null = null
let ro: ResizeObserver | null = null

const scene = computed(() => {
  const d = props.asset.data as unknown as MashSceneData
  return (d?.scene ?? {}) as Record<string, unknown>
})

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

/** Bridge — список виразів для інспектора. */
const _bridge = reactive<{ expressions: Gm3dExprEntry[] }>({ expressions: [] })
function syncBridge() {
  _bridge.expressions = (eng?.expressions ?? []).map(e => ({
    id: e.id, src: e.src, color: e.color, colorMap: e.colorMap ?? 'solid', visible: e.visible !== false,
  }))
}

async function mount() {
  if (!stageEl.value) return
  // three.js важкий → динамічний імпорт движка (ES-модуль); резолвиться на board-three
  const mod = await import('../../../vendor/graphmash3d/grapher-3d-engine.js') as unknown as {
    GraphCalculator3D: new (el: HTMLElement, opts?: Record<string, unknown>) => Gm3dEngine
  }
  if (!stageEl.value) return
  try {
    eng = new mod.GraphCalculator3D(stageEl.value, {})
    eng.setState(sceneToEngineState(scene.value))
    syncBridge()
  } catch (err) {
    console.warn('[graphmash3d] mount failed', err)
    return
  }
  requestAnimationFrame(() => { eng?.resize?.() })
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => eng?.resize?.())
    ro.observe(stageEl.value)
  }
}

onMounted(mount)

watch(() => JSON.stringify(scene.value), () => {
  if (eng) { try { eng.setState(sceneToEngineState(scene.value)); syncBridge() } catch { /* noop */ } }
})

watch(() => props.isSelected, (sel) => {
  if (sel) registerGraphmash3dInspector(props.asset.id, _bridge)
  else unregisterGraphmash3dInspector(props.asset.id)
}, { immediate: true })

onBeforeUnmount(() => {
  unregisterGraphmash3dInspector(props.asset.id)
  try { ro?.disconnect() } catch { /* noop */ }
  ro = null
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
.gm3d-open, .gm3d-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  color: #2d70b3;
}
.gm3d-delete { color: #9ca3af; font-size: 16px; }
.gm3d-delete:hover { color: #ef4444; }
.gm3d-stage { flex: 1; min-height: 0; position: relative; pointer-events: none; }
/* Orbit лише коли виділено (інакше board-drag/select через Konva-proxy) */
.gm3d-stage--interactive { pointer-events: auto; }
.gm3d-stage :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
