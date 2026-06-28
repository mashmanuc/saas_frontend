<script setup lang="ts">
/**
 * WBOverlayLayer — unified overlay render layer (Z_ORDER_UNIFIED_PLAN v4.0, PR1).
 *
 * ОДИН ordered `v-for` над overlay-assets у порядку `page.assets[]`. Замість
 * 13 per-type блоків WBCanvas (які групували render за типом → DOM order ≠
 * array order → cross-type z-order баг), цей layer рендерить усе в одному
 * потоці. Render order = array order = `assets[]` (INV-RENDER-1).
 *
 * Renderer + props/events резолвляться через `OVERLAY_RENDERERS` (registry).
 * WBCanvas БІЛЬШЕ не знає про конкретні overlay-типи — лише про цей компонент.
 *
 * Z-INDEX: усі wrapper-и нормалізовані до `z-index: 4` (включно з graph_calc,
 * який у старому WBCanvas мав z:5). Однаковий z → DOM order (= array order)
 * вирішує stacking. Це і є фікс. Expanded widget → inline z-index:50.
 *
 * OUT OF SCOPE: media (audio/video/youtube) лишається окремим блоком у WBCanvas
 * (власна positioning-модель, z:5, НЕ Konva-proxy). Тут не обробляється.
 *
 * Pointer-events контракт незмінний: wrapper root = pointer-events:none → Konva
 * proxy під ним catch-ить drag/select; внутрішні interactive елементи renderer-а
 * самі вмикають pointer-events:auto.
 */
import { computed, ref } from 'vue'

import type { WBAsset } from '../../types/winterboard'
import { useWBStore } from '../../board/state/boardStore'
import {
  OVERLAY_RENDERERS,
  isOverlayType,
  type OverlayCtx,
} from './overlayRegistry'

const props = defineProps<{
  /** Overlay-assets у порядку `assets[]` (WBCanvas фільтрує до OVERLAY_ASSET_TYPES). */
  assets: WBAsset[]
  /** Активний інструмент (WBCanvas: currentTool = props.tool). */
  tool: string
  /** Positioning helper з WBCanvas (canvasOffset + liveTransform + zoom). Single-source. */
  getOverlayStyle: (asset: WBAsset) => Record<string, string>
}>()

const emit = defineEmits<{
  'asset-update': [asset: WBAsset]
  'asset-delete': [assetId: string]
  'formula-card-edit': [assetId: string]
  'spawn-companions': [payload: unknown]
}>()

const wbStore = useWBStore()

// Board-expand state — раніше жив у WBCanvas (expandedAssetId). Використовувався
// ВИКЛЮЧНО overlay-блоками (verified grep), тому переноситься сюди без витоку.
const expandedId = ref<string | null>(null)

const EXPANDED_STYLE: Record<string, string> = {
  position: 'absolute',
  left: '0',
  top: '0',
  width: '100%',
  height: '100%',
  zIndex: '50',
}

// Adapter context — reactive snapshot для build* функцій registry.
const ctx = computed<OverlayCtx>(() => ({
  isSelected: (id: string) => wbStore.selectedIds.includes(id),
  interactive: props.tool === 'select' && wbStore.mode === 'edit',
  boardMode: wbStore.mode,
  disableAnimation: wbStore.mode === 'replay',
  expandedId: expandedId.value,
  toggleExpand: (id: string) => {
    const willExpand = expandedId.value !== id
    expandedId.value = willExpand ? id : null
    // Розгортання авто-виділяє об'єкт → реєструється sidebar-інспектор (через
    // перевірений шлях watch(isSelected)→register*). Розгорнутий оверлей покриває
    // лише полотно (EXPANDED_STYLE absolute у canvas-шарі), НЕ сайтбар → інспектор
    // лишається видимим і кліковним. Уніфікує контроли для всіх expandable-типів
    // (graph/nmt3d/helix/trig_circle): раніше розгортання не виділяло → інспектор
    // не з'являвся, а виділити в розгорнутому стані не можна (оверлей ловить кліки).
    if (willExpand) wbStore.selectItems([id])
  },
  onUpdate: (asset: WBAsset) => emit('asset-update', asset),
  onDelete: (id: string) => emit('asset-delete', id),
  onFormulaEdit: (id: string) => emit('formula-card-edit', id),
  onSpawnCompanions: (payload: unknown) => emit('spawn-companions', payload),
  graph: {
    paramSet: (assetId, name, value) => wbStore.graphParamSet(assetId, name, value),
    syncParams: (assetId, names) => wbStore.graphSyncParams(assetId, names),
    setParamRange: (assetId, name, range) => wbStore.graphSetParamRange(assetId, name, range),
    pointAdd: (assetId, id, x, y, mode, curveExprId) =>
      wbStore.graphPointAdd(assetId, id, x, y, mode, curveExprId),
    pointSet: (assetId, id, x, y) => wbStore.graphPointSet(assetId, id, x, y),
    pointDelete: (assetId, id) => wbStore.graphPointDelete(assetId, id),
    pointPromote: (assetId, id, curveExprId) =>
      wbStore.graphPointPromote(assetId, id, curveExprId),
  },
}))

interface RenderItem {
  asset: WBAsset
  entry: (typeof OVERLAY_RENDERERS)[string]
}

// Зберігає ПОРЯДОК assets[] (INV-RENDER-1). Фільтрує лише ті, що мають entry.
const renderList = computed<RenderItem[]>(() =>
  props.assets
    .filter((a) => isOverlayType(a.type))
    .map((asset) => ({ asset, entry: OVERLAY_RENDERERS[asset.type] })),
)

function wrapperClasses(item: RenderItem): Array<string | Record<string, boolean>> {
  const selected = wbStore.selectedIds.includes(item.asset.id)
  return [
    item.entry.wrapperClass,
    {
      [`${item.entry.wrapperClass}--selected`]: selected,
      // Спільний клас — піднімає виділений overlay над іншими (z-index нижче у CSS),
      // щоб у зоні накладання його pointer-events:auto stage вигравав клік.
      'wb-overlay--selected': selected,
      'wb-overlay--board-expanded': item.entry.expandable && expandedId.value === item.asset.id,
    },
  ]
}

function wrapperStyle(item: RenderItem): Record<string, string> {
  if (item.entry.expandable && expandedId.value === item.asset.id) {
    return EXPANDED_STYLE
  }
  return props.getOverlayStyle(item.asset)
}
</script>

<template>
  <template v-for="item in renderList" :key="item.asset.id">
    <div
      :class="wrapperClasses(item)"
      v-bind="{ [item.entry.dataAttr]: item.asset.id }"
      :data-testid="`${item.entry.testidPrefix}-${item.asset.id}`"
      :style="wrapperStyle(item)"
    >
      <component
        :is="item.entry.component"
        v-bind="item.entry.buildProps(item.asset, ctx)"
        v-on="item.entry.buildEvents(item.asset, ctx)"
      />
    </div>
  </template>
</template>

<style scoped>
/* Wrapper CSS відтворено з WBCanvas.vue, з двома змінами:
   1. graph_calculator z-index 5 → 4 (нормалізовано для unified array-order stacking).
   2. border-radius уніфіковано: 8px (більшість) / 12px (nmt_task) / 16px (theory_card).
      Було: 4px/6px/10px/12px/16px без системи. Три чіткі рівні замість п'яти.
   media (z:5) лишається ВИЩЕ у WBCanvas (out of scope PR1, R1 документований). */

.wb-solid-overlay {
  position: absolute;
  z-index: 4;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-solid-overlay--selected {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
}

/* graph_calculator — z:5 → z:4 (нормалізовано для unified array-order stacking). */
.wb-graph-calculator-overlay {
  position: absolute;
  z-index: 4;
  border-radius: 8px;
  overflow: visible;
  pointer-events: none;
}
.wb-graph-calculator-overlay--selected {
  outline: 1px solid var(--gc-accent-2-strong, rgba(59, 123, 155, 0.55));
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--gc-accent-2-faint, rgba(59, 123, 155, 0.12));
}

.wb-geo2dv2-overlay {
  position: absolute;
  z-index: 4;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(59, 130, 246, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-geo2dv2-overlay--selected {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
}

.wb-calculus-overlay {
  position: absolute;
  z-index: 4;
  background: rgba(196, 98, 42, 0.03);
  border: 1px solid rgba(196, 98, 42, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-calculus-overlay--selected {
  border-color: rgba(196, 98, 42, 0.6);
  box-shadow: 0 0 0 1px rgba(196, 98, 42, 0.4);
}

.wb-formula-card-overlay {
  position: absolute;
  z-index: 4;
  background: transparent;
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-formula-card-overlay--selected {
  /* border handled by FormulaCardRenderer.is-selected */
}

.wb-quad-overlay {
  position: absolute;
  z-index: 4;
  background: rgba(59, 123, 155, 0.03);
  border: 1px solid rgba(59, 123, 155, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-quad-overlay--selected {
  border-color: rgba(59, 123, 155, 0.6);
  box-shadow: 0 0 0 1px rgba(59, 123, 155, 0.4);
}

.wb-trig-circle-overlay {
  position: absolute;
  z-index: 4;
  border: 1px solid rgba(168, 58, 91, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-trig-circle-overlay--selected {
  border-color: rgba(168, 58, 91, 0.6);
  box-shadow: 0 0 0 1px rgba(168, 58, 91, 0.4);
}

.wb-helix-overlay {
  position: absolute;
  z-index: 4;
  border: 1px solid rgba(196, 98, 42, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-helix-overlay--selected {
  border-color: rgba(196, 98, 42, 0.6);
  box-shadow: 0 0 0 1px rgba(196, 98, 42, 0.4);
}

/* Виділений overlay піднімається над іншими (база z:4) → його внутрішній
   pointer-events:auto stage стає топ-most і виграє клік у зоні накладання
   (інакше нижній ВИДІЛЕНИЙ ловив клік крізь pointer-events:none верхнього).
   ТРАНЗІЄНТНО — лише поки виділено; логічний z-порядок assets[] не змінюється
   (ручне шарування + replay лишаються чистими). Нижче за expanded (z:50). */
.wb-overlay--selected {
  z-index: 5;
}

/* Board-expand state (shared) — позиція inline, тут скидаємо border/radius. */
.wb-overlay--board-expanded {
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}

.wb-trig-solver-overlay {
  position: absolute;
  z-index: 4;
  border: 1px solid rgba(196, 98, 42, 0.22);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-trig-solver-overlay--selected {
  border-color: rgba(196, 98, 42, 0.6);
  box-shadow: 0 0 0 1px rgba(196, 98, 42, 0.4);
}

.wb-nmt3d-overlay {
  position: absolute;
  z-index: 4;
  border: 1px solid #d6c8b2;
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
}
.wb-nmt3d-overlay--selected {
  border-color: #c4622a;
  box-shadow: 0 0 0 1px rgba(196, 98, 42, 0.4);
}

.wb-nmt-task-overlay {
  position: absolute;
  z-index: 4;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;
}
.wb-nmt-task-overlay--selected {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35);
}

.wb-theory-card-overlay {
  position: absolute;
  z-index: 4;
  border-radius: 16px;
  overflow: hidden;
  pointer-events: none;
}
.wb-theory-card-overlay--selected {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35);
}
</style>
