<!--
  MapCardRenderer — універсальна карта подій як WBAsset (H3).

  ОДНА КАРТА НА ВСІ ТЕМИ, як і одна шкала на всі шкали (ТЗ §7, §9.1).

  БЕЗ МЕРЕЖІ. Жодних live tiles: рендер детермінований із `asset.data` плюс
  локально закріплена основа (`board/basemaps.ts`). Картка мусить однаково
  малюватись у класі без інтернету, в реплеї через рік і в PDF.

  ЧЕСНА ОСНОВА. Поки немає затвердженого українського overlay із provenance,
  карта не малює політичних кордонів узагалі — лише нейтральну сітку й місця, —
  і прямо підписується «Сучасна картографічна основа» (ТЗ §7.2). Намальовані
  «приблизні» межі були б гіршими за їх відсутність.

  Масштаб усередині карти НЕ змінює розмір картки, а кнопки карти не
  запускають drag: обидва правила — з §7.3.
-->
<template>
  <div
    ref="rootEl"
    class="map-card"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive }"
    :style="textScaleStyle"
    :data-testid="`map-card-${asset.id}`"
  >
    <header class="map-card__header">
      <span class="map-card__icon">🗺️</span>
      <span class="map-card__title">{{ data.title || labels.untitled }}</span>
      <button
        v-if="!hostWindowControls && !asset.locked && isSelected"
        type="button"
        class="map-card__delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div ref="bodyEl" class="map-card__body">
      <div ref="flowEl" class="map-card__flow">
        <div class="map-card__plot">
          <div class="map-card__zoom" @mousedown.stop @pointerdown.stop>
            <button type="button" :title="labels.zoomOut" :disabled="zoom <= 1" @click.stop="changeZoom(-1)">−</button>
            <button type="button" :title="labels.zoomIn" :disabled="zoom >= 4" @click.stop="changeZoom(1)">+</button>
          </div>
          <svg class="map-card__svg" :viewBox="mapViewBox" preserveAspectRatio="xMidYMid meet">
            <rect class="map-card__bg" x="0" y="0" :width="VB" :height="VBH" />
            <path
              v-for="(path, i) in physicalLand"
              :key="`land-${i}`"
              class="map-card__land"
              :d="path"
              fill-rule="evenodd"
            />
            <line
              v-for="g in gridLines" :key="g.k"
              class="map-card__grid"
              :x1="g.x1" :y1="g.y1" :x2="g.x2" :y2="g.y2"
            />
            <polygon
              v-for="region in regionPolygons"
              :key="region.id"
              class="map-card__region"
              :points="region.points"
            />
            <polyline
              v-for="r in routeLines" :key="r.id"
              class="map-card__route" :points="r.points"
            />
            <g
              v-for="m in placed" :key="m.id"
              class="map-card__marker"
              :class="{ 'is-active': m.id === data.active_marker_id }"
            >
              <circle
                class="map-card__pin" :cx="m.x" :cy="m.y" r="9"
                @click.stop="selectMarker(m.id)" @mousedown.stop @pointerdown.stop
              />
              <line
                v-if="m.ly !== m.y + 7"
                class="map-card__leader" :x1="m.x" :y1="m.y" :x2="m.x + 12" :y2="m.ly - 7"
              />
              <text class="map-card__pinlabel" :x="m.x + 14" :y="m.ly">{{ m.label }}</text>
            </g>
          </svg>
          <!-- Не прикраса: без цього підпису сучасна основа під історичними
               подіями читалась би як карта тієї доби (ТЗ §7.2). -->
          <p class="map-card__basemap-note">{{ labels.modernBasemap }}</p>
        </div>

        <p v-if="!markers.length" class="map-card__empty">{{ labels.empty }}</p>
        <p v-else-if="!placed.length" class="map-card__empty">{{ labels.noCoordinates }}</p>

        <div v-if="activeMarker" class="map-card__detail">
          <p class="map-card__place">
            <strong>{{ activeMarker.label }}</strong>
            <span v-if="activeMarker.date_label" class="map-card__date">{{ activeMarker.date_label }}</span>
          </p>
          <p v-if="activeMarker.description" class="map-card__description">{{ activeMarker.description }}</p>
          <SourceList :sources="activeMarker.sources" :language="materialLanguage" />
        </div>

        <SourceList :sources="data.sources" :language="materialLanguage" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset, MapCardData, WBMapMarker } from '../../../types/winterboard'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { cardTextScaleStyle, presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'
import { MAP_LABELS } from '../../../board/timelinePresentation'
import { BASEMAPS, basemapAspect, basemapSpec, landPaths, project } from '../../../board/basemaps'
import SourceList from './SourceList.vue'

const { t } = useI18n()
const VB = 1000

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean; canFit?: boolean }>(),
  { isSelected: false, interactive: true, canFit: true },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  'activate-linked': [ids: string[]]
  delete: []
  'request-height': [neededPx: number]
}>()

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

const EMPTY: MapCardData = {
  version: 1, title: '', basemap: 'europe', basemap_version: '', projection: 'mercator',
  historical_boundary_mode: 'none', markers: [], routes: [], regions: [],
  active_marker_id: null, sources: [],
}
const data = computed<MapCardData>(() => (props.asset.data as MapCardData) ?? EMPTY)
const markers = computed<WBMapMarker[]>(() =>
  Array.isArray(data.value.markers) ? data.value.markers : [])

const materialLanguage = computed(() => (data.value.content_language === 'en' ? 'en' : 'uk'))
const labels = computed(() => MAP_LABELS[materialLanguage.value])

const spec = computed(() => basemapSpec(data.value.basemap))
const zoom = ref(1)
// Висота полотна — за пропорціями самої основи: однаковий масштаб X/Y (див.
// `basemapAspect`). Було VB × VB — «Україну» тягнуло вгору в ~1.45 раза.
const VBH = computed(() => Math.round(VB * basemapAspect(spec.value)))
const physicalLand = computed(() => landPaths(spec.value, VB, VBH.value))

/** Місця з придатними координатами. Решта не малюється взагалі: marker,
 *  притиснутий до краю, виглядав би як факт про інше місце. */
const placed = computed(() => spreadLabels(markers.value.flatMap((m) => {
  const p = project(m.lat, m.lon, spec.value)
  return p ? [{ id: m.id, label: m.label, x: p.x * VB, y: p.y * VBH.value }] : []
})))

// Підписи близьких місць не мають лягати один на одний (власник 2026-09-22:
// Суботів і Чигирин — ~10 км, на основі «Україна» підписи зливались). Точка
// лишається на своїй координаті; зсувається лише ПІДПИС — нижче, з виноскою.
const LABEL_H = 28
const LABEL_CHAR_W = 12
function spreadLabels(points: Array<{ id: string; label: string; x: number; y: number }>) {
  const boxes: Array<{ x1: number; x2: number; y1: number; y2: number }> = []
  return [...points].sort((a, b) => a.y - b.y || a.x - b.x).map((point) => {
    const x1 = point.x + 14
    const x2 = x1 + Math.max(1, String(point.label || '').length) * LABEL_CHAR_W
    let ly = point.y + 7
    const hits = (y: number) => boxes.some(b => x1 < b.x2 && b.x1 < x2 && y - LABEL_H + 6 < b.y2 && b.y1 < y + 6)
    for (let i = 0; i < 12 && hits(ly); i++) ly += LABEL_H
    boxes.push({ x1, x2, y1: ly - LABEL_H + 6, y2: ly + 6 })
    return { ...point, ly }
  })
}

const gridLines = computed(() => {
  const [west, south, east, north] = spec.value.bounds
  const step = spec.value.grid
  const out: Array<{ k: string; x1: number; y1: number; x2: number; y2: number }> = []
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
    const p = project((south + north) / 2, lon, spec.value)
    if (p) out.push({ k: `v${lon}`, x1: p.x * VB, y1: 0, x2: p.x * VB, y2: VBH.value })
  }
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
    const p = project(lat, (west + east) / 2, spec.value)
    if (p) out.push({ k: `h${lat}`, x1: 0, y1: p.y * VBH.value, x2: VB, y2: p.y * VBH.value })
  }
  return out
})

const routeLines = computed(() => {
  const byId = new Map(placed.value.map(p => [p.id, p]))
  return (Array.isArray(data.value.routes) ? data.value.routes : []).flatMap((r) => {
    const pts = (r.marker_ids || []).map(id => byId.get(id)).filter(Boolean)
    // Маршрут із однієї точки — не маршрут; домальовувати відсутні місця не можна.
    return pts.length >= 2
      ? [{ id: r.id, points: pts.map(p => `${p!.x},${p!.y}`).join(' ') }]
      : []
  })
})

const regionPolygons = computed(() =>
  (Array.isArray(data.value.regions) ? data.value.regions : []).flatMap((region) => {
    const points = (Array.isArray(region.points) ? region.points : [])
      .map(point => project(point?.lat, point?.lon, spec.value))
      .filter(Boolean)
    return points.length >= 3
      ? [{ id: region.id, points: points.map(p => `${p!.x * VB},${p!.y * VBH.value}`).join(' ') }]
      : []
  }),
)

const activeMarker = computed(() =>
  markers.value.find(m => m.id === data.value.active_marker_id) ?? null)

const mapViewBox = computed(() => {
  const width = VB / zoom.value
  const height = VBH.value / zoom.value
  const active = placed.value.find(marker => marker.id === data.value.active_marker_id)
  const centerX = active?.x ?? VB / 2
  const centerY = active?.y ?? VBH.value / 2
  const x = Math.max(0, Math.min(VB - width, centerX - width / 2))
  const y = Math.max(0, Math.min(VBH.value - height, centerY - height / 2))
  return `${x} ${y} ${width} ${height}`
})

function changeZoom(delta: number): void {
  zoom.value = Math.max(1, Math.min(4, zoom.value + delta))
}

/** Вибір місця — один `asset_update` спільним шляхом (§9.3). */
function selectMarker(id: string): void {
  if (!props.interactive) return
  const next = data.value.active_marker_id === id ? null : id
  emit('update:asset', {
    ...props.asset,
    data: { ...data.value, active_marker_id: next },
  } as WBAsset)
  if (next) {
    const marker = markers.value.find(item => item.id === next)
    if (marker?.event_ids?.length) emit('activate-linked', marker.event_ids)
  }
}

const hostWindowControls = useHostWindowControls()
const textScaleStyle = computed(() => cardTextScaleStyle(props.asset))

useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  canMeasure: () => props.canFit && !isMinimizedOnBoard(props.asset),
  sources: [
    () => data.value.title,
    () => data.value.basemap,
    () => JSON.stringify(markers.value),
    () => JSON.stringify(data.value.routes ?? []),
    () => JSON.stringify(data.value.regions ?? []),
    () => data.value.active_marker_id,
    () => JSON.stringify(data.value.sources ?? []),
    () => data.value.content_language,
    () => presentationScaleOf(props.asset),
    () => props.asset.w,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

useExportCapture(() => props.asset?.id, (signal) => snapshotElement(rootEl.value, signal))

defineExpose({ BASEMAPS })
</script>

<style scoped>
.map-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  pointer-events: none; overflow: hidden;
}
.map-card.is-selected { border-color: #059669; }
.map-card__header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #ecfdf5; border-bottom: 1px solid #d1fae5;
}
.map-card__icon { font-size: calc(16px * var(--wb-card-text-scale, 1)); }
.map-card__title {
  flex: 1; font-weight: 600; color: #065f46;
  font-size: calc(14px * var(--wb-card-text-scale, 1));
}
.map-card__delete {
  pointer-events: auto; background: none; border: none; cursor: pointer;
  font-size: 18px; line-height: 1; color: #64748b;
}
.map-card__body { flex: 1; overflow-y: auto; padding: 12px; pointer-events: auto; }
.map-card.is-readonly .map-card__body { pointer-events: none; }
.map-card__flow { display: flow-root; }
.map-card__plot { position: relative; }
.map-card__svg { width: 100%; height: auto; display: block; }
/* Море й суша мусять розрізнятись з першого погляду: було #f8fafc і #e2e8f0 —
   два майже однакові сірі, карта читалась як сіра пляма («обрубок»). */
.map-card__bg { fill: #cfe3f5; }
.map-card__land { fill: #f3efe3; stroke: #8a7f6a; stroke-width: 1.4; stroke-linejoin: round; }
.map-card__grid { stroke: rgba(71, 85, 105, 0.16); stroke-width: 1; }
.map-card__region { fill: rgba(245, 158, 11, 0.22); stroke: #d97706; stroke-width: 2; }
.map-card__route { fill: none; stroke: #0ea5e9; stroke-width: 3; stroke-dasharray: 8 6; }
.map-card__pin { fill: #059669; stroke: #fff; stroke-width: 3; cursor: pointer; pointer-events: auto; }
.map-card__marker.is-active .map-card__pin { fill: #b91c1c; }
.map-card__leader { stroke: #0f172a; stroke-width: 1.5; opacity: 0.55; }
/* Ореол: підпис читається і на суші, і на морі. */
.map-card__pinlabel {
  font-size: 22px; font-weight: 600; fill: #0f172a;
  paint-order: stroke; stroke: rgba(255, 255, 255, 0.92); stroke-width: 5px; stroke-linejoin: round;
}
.map-card__zoom {
  position: absolute; z-index: 2; right: 6px; top: 6px; display: flex; gap: 4px;
  pointer-events: auto;
}
.map-card__zoom button {
  width: 28px; height: 28px; border: 1px solid #cbd5e1; border-radius: 6px;
  background: rgba(255, 255, 255, 0.94); color: #0f172a; cursor: pointer;
}
.map-card__zoom button:disabled { opacity: 0.45; cursor: default; }
.map-card__basemap-note {
  margin: 4px 0 0; font-size: calc(11px * var(--wb-card-text-scale, 1)); color: #64748b;
}
.map-card__empty { color: #64748b; font-size: calc(13px * var(--wb-card-text-scale, 1)); }
.map-card__detail { margin-top: 10px; }
.map-card__place { margin: 0; font-size: calc(13px * var(--wb-card-text-scale, 1)); }
.map-card__date { margin-left: 8px; color: #64748b; }
.map-card__description {
  margin: 4px 0 0; font-size: calc(13px * var(--wb-card-text-scale, 1)); color: #334155;
}
</style>
