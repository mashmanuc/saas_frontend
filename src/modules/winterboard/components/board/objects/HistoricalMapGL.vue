<template>
  <!-- Закон §9 v1.78: об'ємна історична карта на рушії карт. Лише вигляд цього екрана: камера локальна, рік — з дошки.
       Перетягування й колесо миші в межах карти (зі стрілкою) — рух і наближення карти, а не картки й дошки. -->
  <div class="hgl" :class="{ 'hgl--full': expanded }">
    <div ref="host" class="hgl__host" @pointerdown.stop @wheel="onWheel" @mouseleave="emit('hover', null)" @mouseenter="syncPixelRatio" />
    <div v-if="ready && interactive" class="hgl__ctl" data-export-hide @pointerdown.stop>
      <div class="hgl__seg" role="group">
        <button type="button" :class="{ 'is-on': tilted }" :aria-pressed="tilted" data-testid="map-gl-tilt" @click.stop="setTilt(true)">{{ L.tilt }}</button>
        <button type="button" :class="{ 'is-on': !tilted }" :aria-pressed="!tilted" data-testid="map-gl-flat" @click.stop="setTilt(false)">{{ L.flat }}</button>
      </div>
      <button type="button" class="hgl__btn" data-testid="map-gl-overview" :title="L.overview" @click.stop="overview(true)">⌂</button>
    </div>
    <div v-if="ready && interactive" class="hgl__zoom" data-export-hide @pointerdown.stop>
      <button type="button" class="hgl__btn" data-testid="map-gl-zoom-in" :aria-label="L.zoomIn" @click.stop="zoomBy(1)">+</button>
      <button type="button" class="hgl__btn" data-testid="map-gl-zoom-out" :aria-label="L.zoomOut" @click.stop="zoomBy(-1)">−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Об'ємна історична карта (закон §9 v1.78; ТЗ TZ_HISTORICAL_BORDERS_MAP_2026-10-30 §8). Отримує той самий набір і рік,
 * що пласка карта картки, і малює їх рушієм карт поверх фізичної основи (суша, річки, озера, міста). Нічого не пише:
 * рік змінює картка (`update:asset`), камера — лише цього екрана. Без WebGL чи при збої — `fail`, і картка лишає
 * пласку карту. Набір змінено — старі межі плавно гаснуть, нові проявляються (макет: 0,7 с), змінені коротко
 * підсвічуються (1,6 с).
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { BordersDataset } from '../../../board/historicalBorders'
import { BIG_ENTITIES, ENTITY_SHORT_UK, entityColor, statesAt } from '../../../board/historicalBorders'
import { loadPhysicalBasemap, type PhysicalBasemap } from '../../../board/historicalBasemap'
import { webglSupported } from '../../../board/webglSupport'
import type { BasemapId } from '../../../board/basemaps'
import type { MapEventPin } from '../../../board/evidenceLinkage'

const props = withDefaults(defineProps<{
  dataset: BordersDataset
  basemap: BasemapId
  year: number
  /** Держави, чиї межі змінилися чи які з'явилися з попереднього знімка — коротко підсвічуються. */
  changed: string[]
  hl: string | null
  lang: 'uk' | 'en'
  interactive: boolean
  expanded: boolean
  /** A− / A+ картки (масштаб подання) — підписи карти ростуть разом із рештою тексту картки. */
  textScale?: number
  /** v1.79: події шкал сторінки з місцем — номери; відкрита — більша, з назвою, камера наближається до неї. */
  pins?: MapEventPin[]
  L: { tilt: string; flat: string; overview: string; zoomIn: string; zoomOut: string }
}>(), { textScale: 1, pins: () => [] })
const emit = defineEmits<{
  ready: []
  fail: []
  hover: [tip: { x: number; y: number; entity: string | null } | null]
}>()

const FONT = ['Open Sans Semibold']
const SEA = '#d3e5ee'
const TILT = 45
const FADE_MS = 700
/** Ширина карти в картці за макетом (960 × 62,5 %): підписи задано під неї й ростуть з шириною карти, як `--u`. */
const DESIGN_MAP_WIDTH = 600
const FLASH_MS = 1600

const host = ref<HTMLElement | null>(null)
const ready = ref(false)
const tilted = ref(true)
// Рушій і карта — не реактивні (великі об'єкти рушія), лише посилання
const engine = shallowRef<any>(null)
let map: any = null
let physical: PhysicalBasemap | null = null
let active = 0
let resizeObs: ResizeObserver | null = null
let flashTimer: ReturnType<typeof setTimeout> | null = null
let destroyed = false
let textK = 1
let lastWidth = 0

type Pt = [number, number]
const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features })
const poly = (polygons: Pt[][][], properties: Record<string, unknown> = {}) =>
  ({ type: 'Feature', properties, geometry: { type: 'MultiPolygon', coordinates: polygons } })

function stateName(entity: string, uk: string, en: string): string {
  if (props.lang === 'en') return en
  const name = props.expanded ? uk : ENTITY_SHORT_UK[entity] ?? uk
  return BIG_ENTITIES.has(entity) ? name.toLocaleUpperCase('uk') : name
}

function statesData(year: number) {
  return fc(statesAt(props.dataset, year).map((s) => poly(s.polygons as Pt[][][], { entity: s.entity, color: entityColor(s.entity) })))
}

function labelsData(year: number) {
  return fc(statesAt(props.dataset, year).filter((s) => s.label).map((s) => ({
    type: 'Feature',
    properties: { text: stateName(s.entity, s.name_uk, s.name_en), big: BIG_ENTITIES.has(s.entity) ? 1 : 0 },
    geometry: { type: 'Point', coordinates: s.label },
  })))
}

/** Штриховка «Немає даних» — та сама, що в пласкій карті й легенді (макет «Палітра і стилі»). */
function hatchImage(): { width: number; height: number; data: Uint8ClampedArray } | null {
  const c = document.createElement('canvas')
  c.width = c.height = 12
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#efe9da'
  g.fillRect(0, 0, 12, 12)
  g.strokeStyle = '#d9cfb6'
  g.lineWidth = 1.6
  for (const o of [-12, 0, 12]) { g.beginPath(); g.moveTo(o, 12); g.lineTo(o + 12, 0); g.stroke() }
  return { width: 12, height: 12, data: g.getImageData(0, 0, 12, 12).data }
}

/** Крапка міста: темна з білою облямівкою (24 px, щільність 2 — 12 px на екрані при розмірі 1). */
function dotImage(): { width: number; height: number; data: Uint8ClampedArray } | null {
  const c = document.createElement('canvas')
  c.width = c.height = 24
  const g = c.getContext('2d')
  if (!g) return null
  g.beginPath(); g.arc(12, 12, 8, 0, Math.PI * 2)
  g.fillStyle = '#13261f'; g.fill()
  g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke()
  return { width: 24, height: 24, data: g.getImageData(0, 0, 24, 24).data }
}

/** Розміри підписів (px карти шириною 600) × k: ширина карти / 600 × A−/A+ картки. */
const byZoom = (k: number, prop: string, z3: [number, number], z7: [number, number]) => ['interpolate', ['linear'], ['zoom'],
  3, ['case', ['==', ['get', prop], 1], z3[0] * k, z3[1] * k], 7, ['case', ['==', ['get', prop], 1], z7[0] * k, z7[1] * k]]
const SIZES: Record<string, (k: number) => unknown> = {
  'state-labels': (k) => byZoom(k, 'big', [13, 11], [24, 17]),
  cities: (k) => byZoom(k, 'major', [11, 9.5], [15, 13]),
  'river-labels': (k) => 11 * k,
  seas: (k) => 12 * k,
}
const ICON = (k: number) => byZoom(k, 'major', [0.8, 0.6], [1.3, 1])

function currentTextK(): number {
  const w = host.value?.offsetWidth || DESIGN_MAP_WIDTH
  return Math.min(4, Math.max(0.6, (w / DESIGN_MAP_WIDTH) * (props.textScale || 1)))
}

/** Ширина карти чи A−/A+ змінилися — підписи того ж розміру відносно карти, що в макеті. */
function applyTextScale(): void {
  const k = currentTextK()
  if (!map || Math.abs(k - textK) < 0.03) return
  textK = k
  if (host.value) host.value.dataset.textk = k.toFixed(2)
  for (const [id, size] of Object.entries(SIZES)) if (map.getLayer(id)) map.setLayoutProperty(id, 'text-size', size(k))
  if (map.getLayer('cities')) map.setLayoutProperty('cities', 'icon-size', ICON(k))
}

function fillOpacity() {
  return props.hl ? ['case', ['==', ['get', 'entity'], props.hl], 0.94, 0.3] : 0.94
}

function addLayers(): void {
  const P = physical
  const hatch = hatchImage()
  if (hatch) map.addImage('nd-hatch', hatch)
  if (P) {
    map.addSource('land', { type: 'geojson', data: fc(P.land.map((p) => poly([p]))) })
    map.addSource('lakes', { type: 'geojson', data: fc(P.lakes.map((l) => poly(l.polygons))) })
    map.addSource('rivers', { type: 'geojson', data: fc(P.rivers.map((r) => ({
      type: 'Feature', properties: { rank: r.rank, name: props.lang === 'en' ? r.name_en : r.name_uk },
      geometry: { type: 'MultiLineString', coordinates: r.lines },
    }))) })
    map.addSource('cities', { type: 'geojson', data: fc(P.cities.map((c) => ({
      type: 'Feature', properties: { name: props.lang === 'en' ? c.name_en : c.name_uk, major: c.major ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
    }))) })
    map.addSource('seas', { type: 'geojson', data: fc(P.seas.map((s) => ({
      type: 'Feature', properties: { name: (props.lang === 'en' ? s.name_en : s.name_uk).toLocaleUpperCase('uk') },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    }))) })
    map.addLayer({ id: 'land', type: 'fill', source: 'land', paint: hatch ? { 'fill-pattern': 'nd-hatch' } : { 'fill-color': '#efe9da' } })
    map.addLayer({ id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#cbbf9f', 'line-width': 0.8 } })
  }
  // Межі — два шари по черзі: старі гаснуть, нові проявляються (макет: 0,7 с)
  for (const i of [0, 1]) {
    map.addSource(`st${i}`, { type: 'geojson', data: fc([]) })
    map.addLayer({
      id: `st${i}-fill`, type: 'fill', source: `st${i}`,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0, 'fill-opacity-transition': { duration: FADE_MS, delay: 0 } },
    })
    map.addLayer({
      id: `st${i}-line`, type: 'line', source: `st${i}`, layout: { 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 7, 2.2],
        'line-opacity': 0, 'line-opacity-transition': { duration: FADE_MS, delay: 0 },
      },
    })
  }
  map.addSource('flash', { type: 'geojson', data: fc([]) })
  map.addLayer({
    id: 'flash', type: 'line', source: 'flash', layout: { 'line-join': 'round' },
    paint: { 'line-color': '#fff7d6', 'line-width': 4, 'line-blur': 1, 'line-opacity': 0, 'line-opacity-transition': { duration: FLASH_MS, delay: 0 } },
  })
  if (P) {
    map.addLayer({ id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': SEA, 'fill-outline-color': '#a9c9d6' } })
    // Річка — синя лінія зі світлою облямівкою: видно і на синій Московії, і на штриховці
    const riverWidth = (k: number) => ['interpolate', ['linear'], ['zoom'],
      3, ['case', ['<=', ['get', 'rank'], 5], 1.6 * k, 0.8 * k], 7, ['case', ['<=', ['get', 'rank'], 5], 3.4 * k, 1.8 * k]]
    map.addLayer({
      id: 'river-halo', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': riverWidth(2.2) },
    })
    map.addLayer({
      id: 'rivers', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#3d82a3', 'line-opacity': 0.95, 'line-width': riverWidth(1) },
    })
    map.addLayer({
      id: 'river-labels', type: 'symbol', source: 'rivers', filter: ['!=', ['get', 'name'], ''],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': SIZES['river-labels'](textK), 'symbol-spacing': 320, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': '#2f6f86', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
    })
    map.addLayer({
      id: 'seas', type: 'symbol', source: 'seas',
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': SIZES.seas(textK), 'text-letter-spacing': 0.18, 'text-rotation-alignment': 'map', 'text-pitch-alignment': 'map' },
      paint: { 'text-color': '#5f8fa3' },
    })
  }
  if (P) {
    // Місто — крапка й назва разом: немає місця для назви — немає й крапки (без «німих» крапок)
    const dot = dotImage()
    if (dot) map.addImage('city-dot', dot, { pixelRatio: 2 })
    map.addLayer({
      id: 'cities', type: 'symbol', source: 'cities',
      layout: {
        'icon-image': 'city-dot', 'icon-size': ICON(textK),
        'text-field': ['get', 'name'], 'text-font': FONT, 'text-anchor': 'left', 'text-offset': [0.6, 0], 'text-padding': 3,
        'text-size': SIZES.cities(textK),
        'symbol-sort-key': ['-', 1, ['get', 'major']],
      },
      paint: { 'text-color': '#24332d', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
    })
  }
  // v1.79: події шкали — номери (над межами й містами); відкрита — більша, з назвою
  map.addSource('pins', { type: 'geojson', data: pinsData() })
  map.addLayer({
    id: 'pins', type: 'circle', source: 'pins',
    paint: {
      'circle-color': ['case', ['==', ['get', 'active'], 1], '#b23a22', '#8a2f1d'],
      'circle-radius': ['case', ['==', ['get', 'active'], 1], 13, 9.5], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
      'circle-pitch-alignment': 'viewport',
    },
  })
  map.addLayer({
    id: 'pin-numbers', type: 'symbol', source: 'pins',
    layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': FONT, 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#ffffff' },
  })
  map.addLayer({
    id: 'pin-label', type: 'symbol', source: 'pins', filter: ['==', ['get', 'active'], 1],
    layout: { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 14, 'text-anchor': 'top', 'text-offset': [0, 1.3], 'text-max-width': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#8a2f1d', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 2 },
  })
  // Назви держав — верхній шар: рушій розставляє першими підписи верхніх шарів, міста поступаються
  map.addSource('labels', { type: 'geojson', data: fc([]) })
  map.addLayer({
    id: 'state-labels', type: 'symbol', source: 'labels',
    layout: {
      'text-field': ['get', 'text'], 'text-font': FONT, 'text-max-width': 9, 'text-padding': 4,
      'text-size': SIZES['state-labels'](textK),
      'text-letter-spacing': ['case', ['==', ['get', 'big'], 1], 0.1, 0.01],
      'text-rotation-alignment': 'map', 'text-pitch-alignment': 'map',
      'symbol-sort-key': ['-', 1, ['get', 'big']],
    },
    paint: { 'text-color': '#13261f', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.6 },
  })
}

function pinsData() {
  if (host.value) host.value.dataset.pins = String(props.pins.length)
  return fc(props.pins.map((p) => ({
    type: 'Feature', properties: { n: p.n, label: p.label, active: p.active ? 1 : 0 },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  })))
}

/** Відкрили подію шкали — камера цього екрана наближається до її місця (не ближче, ніж уже є). */
function flyToActive(): void {
  const p = props.pins.find((x) => x.active)
  if (!map || !p) return
  map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 5.2), duration: 900 })
}

/** Новий рік: межі в «сплячий» шар, той проявляється, а поточний гасне; змінені держави — короткий спалах. */
function showYear(year: number, animate: boolean): void {
  const next = 1 - active
  map.getSource(`st${next}`).setData(statesData(year))
  map.getSource('labels').setData(labelsData(year))
  const fade = { duration: animate ? FADE_MS : 0, delay: 0 }
  for (const [i, on] of [[next, true], [active, false]] as const) {
    map.setPaintProperty(`st${i}-fill`, 'fill-opacity-transition', fade)
    map.setPaintProperty(`st${i}-line`, 'line-opacity-transition', fade)
    map.setPaintProperty(`st${i}-fill`, 'fill-opacity', on ? fillOpacity() : 0)
    map.setPaintProperty(`st${i}-line`, 'line-opacity', on ? 0.95 : 0)
  }
  active = next
  if (!animate || !props.changed.length) return
  const changed = new Set(props.changed)
  map.getSource('flash').setData(fc(statesAt(props.dataset, year).filter((s) => changed.has(s.entity)).map((s) => poly(s.polygons as Pt[][][]))))
  map.setPaintProperty('flash', 'line-opacity-transition', { duration: 0, delay: 0 })
  map.setPaintProperty('flash', 'line-opacity', 0.95)
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    if (!map) return
    map.setPaintProperty('flash', 'line-opacity-transition', { duration: FLASH_MS, delay: 0 })
    map.setPaintProperty('flash', 'line-opacity', 0)
  }, 60)
}

function regionBounds(): [[number, number], [number, number]] {
  const [w, s, e, n] = props.dataset.meta.region
  return [[w, s], [e, n]]
}

/** Огляд регіону: зверху вміщує весь регіон; з нахилом — той самий центр, трохи ближче (далеке стискається). */
function overview(animate: boolean): void {
  if (!map) return
  const cam = map.cameraForBounds(regionBounds(), { padding: 8 })
  if (!cam) return
  const target = { center: cam.center, zoom: cam.zoom + (tilted.value ? 0.25 : 0), pitch: tilted.value ? TILT : 0, bearing: 0 }
  if (animate) map.easeTo({ ...target, duration: 600 })
  else map.jumpTo(target)
}

function setTilt(on: boolean): void {
  tilted.value = on
  map?.easeTo({ pitch: on ? TILT : 0, bearing: 0, duration: 600 })
}

function zoomBy(d: number): void {
  map?.easeTo({ zoom: map.getZoom() + d, duration: 300 })
}

/** Картка на дошці масштабується разом із дошкою — полотно карти малюємо в тій щільності, у якій її видно. */
function syncPixelRatio(): void {
  const el = host.value
  if (!map || !el || !el.offsetWidth) return
  const scale = el.getBoundingClientRect().width / el.offsetWidth
  const ratio = Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * scale))
  if (Math.abs(map.getPixelRatio() - ratio) > 0.15) map.setPixelRatio(ratio)
}

function onMove(e: any): void {
  if (!props.interactive) return
  const hit = map.queryRenderedFeatures(e.point, { layers: [`st${active}-fill`] })[0]
  if (hit) { emit('hover', { x: e.point.x, y: e.point.y, entity: String(hit.properties.entity) }); return }
  const land = physical ? map.queryRenderedFeatures(e.point, { layers: ['land'] })[0] : null
  emit('hover', land ? { x: e.point.x, y: e.point.y, entity: null } : null)
}

/** Власник 30.10: «колесо на миші на карті не працює як зум» — над картою зі стрілкою колесо наближає карту і не
 *  доходить до дошки (інакше разом масштабувалась би й дошка); з пером карта прозора — колесо масштабує дошку. */
function onWheel(e: WheelEvent): void {
  if (props.interactive && map) e.stopPropagation()
}

function fail(why: string): void {
  if (destroyed) return
  console.warn('[WB:borders] об\'ємна карта недоступна — пласка', why)
  teardown()
  emit('fail')
}

function teardown(): void {
  resizeObs?.disconnect()
  resizeObs = null
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = null
  if (map) { map.remove(); map = null }
}

onMounted(async () => {
  if (!webglSupported()) { emit('fail'); return }
  try {
    const [mod, base] = await Promise.all([import('../../../board/mapEngine'), loadPhysicalBasemap(props.basemap)])
    if (destroyed || !host.value) return
    engine.value = mod.default
    physical = base
    const [[bw, bs], [be, bn]] = regionBounds()
    map = new engine.value.Map({
      container: host.value,
      style: { version: 8, glyphs: `${window.location.origin}/maps/glyphs/{fontstack}/{range}.pbf`, sources: {}, layers: [{ id: 'sea', type: 'background', paint: { 'background-color': SEA } }] },
      bounds: regionBounds(), fitBoundsOptions: { padding: 8 },
      maxBounds: [[bw - 6, bs - 5], [be + 6, bn + 5]], minZoom: 0.5, maxZoom: 9, maxPitch: 55,
      attributionControl: false, scrollZoom: props.interactive, boxZoom: false, keyboard: false, doubleClickZoom: true,
      dragRotate: true, touchPitch: true, interactive: true,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    map.on('webglcontextlost', () => fail('context_lost'))
    map.once('load', () => {
      if (destroyed) return
      textK = currentTextK()
      lastWidth = host.value?.offsetWidth ?? 0
      if (host.value) host.value.dataset.textk = textK.toFixed(2)
      addLayers()
      showYear(props.year, false)
      overview(false)
      syncPixelRatio()
      map.on('mousemove', onMove)
      // Камера цього екрана — у data-атрибутах (перевірки стенда; у стан дошки не йде)
      map.on('moveend', () => {
        if (!host.value || !map) return
        host.value.dataset.pitch = String(Math.round(map.getPitch()))
        host.value.dataset.zoom = map.getZoom().toFixed(2)
      })
      map.once('idle', () => { if (!destroyed) { ready.value = true; emit('ready') } })
    })
    // Картку на дошці розкладають у розмірі екрана (масштаб дошки, ⛶): карта масштабується цілком — та сама
    // місцевість у кадрі, підписи того ж розміру відносно карти
    resizeObs = new ResizeObserver(() => {
      if (!map || !host.value) return
      const w = host.value.offsetWidth
      map.resize()
      if (lastWidth > 0 && w > 0 && Math.abs(w - lastWidth) > 1) map.setZoom(map.getZoom() + Math.log2(w / lastWidth))
      if (w > 0) lastWidth = w
      syncPixelRatio()
      applyTextScale()
    })
    resizeObs.observe(host.value)
  } catch (err) {
    fail(err instanceof Error ? err.name : 'init_failed')
  }
})

onBeforeUnmount(() => { destroyed = true; teardown() })

watch(() => props.year, (y, old) => { if (map && ready.value) showYear(y, old !== undefined && y !== old) })
watch(() => props.textScale, () => applyTextScale())
watch(() => props.pins, (now, before) => {
  if (!map || !ready.value) return
  map.getSource('pins')?.setData(pinsData())
  const was = before?.find((p) => p.active)?.key
  const is = now.find((p) => p.active)?.key
  if (is && is !== was) flyToActive()
}, { deep: true })
watch(() => props.hl, () => { if (map) map.setPaintProperty(`st${active}-fill`, 'fill-opacity', fillOpacity()) })
// ⛶: інший кадр — огляд регіону наново (масштаб і підписи підлаштує ResizeObserver)
watch(() => props.expanded, () => {
  if (!map) return
  map.getSource('labels')?.setData(labelsData(props.year))
  requestAnimationFrame(() => { if (!map || !host.value) return; map.resize(); lastWidth = host.value.offsetWidth; overview(false) })
})
// З пером карта прозора для малювання — тоді й камера не рухається
watch(() => props.interactive, (on) => {
  if (!map) return
  for (const h of [map.dragPan, map.dragRotate, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.touchPitch]) {
    if (on) h.enable(); else h.disable()
  }
}, { immediate: false })

defineExpose({ overview })
</script>

<style scoped>
.hgl { position: absolute; inset: 0; }
.hgl__host { position: absolute; inset: 0; }
.hgl__host :deep(.maplibregl-canvas) { outline: none; }
.hgl__ctl, .hgl__zoom {
  position: absolute; top: calc(8 * var(--u)); display: flex; gap: calc(6 * var(--u)); z-index: 2;
  font-size: calc(12 * var(--u) * var(--t));
}
.hgl__ctl { left: calc(8 * var(--u)); }
.hgl__zoom { right: calc(8 * var(--u)); flex-direction: column; }
.hgl--full .hgl__ctl, .hgl--full .hgl__zoom { top: calc(16 * var(--u)); font-size: calc(18 * var(--u) * var(--t)); gap: calc(10 * var(--u)); }
.hgl--full .hgl__ctl { left: calc(16 * var(--u)); }
.hgl--full .hgl__zoom { right: calc(16 * var(--u)); }
.hgl__seg {
  display: flex; background: #fff; border-radius: calc(9 * var(--u)); overflow: hidden;
  box-shadow: 0 1px 4px rgba(19, 38, 31, 0.18);
}
.hgl__seg button {
  border: 0; background: none; font: inherit; font-weight: 700; color: #1f6b5a; cursor: pointer;
  padding: calc(5 * var(--u)) calc(11 * var(--u));
}
.hgl--full .hgl__seg button { padding: calc(10 * var(--u)) calc(20 * var(--u)); }
.hgl__seg button.is-on { background: #047857; color: #fff; }
.hgl__btn {
  min-width: calc(28 * var(--u)); height: calc(28 * var(--u)); border: 0; border-radius: calc(8 * var(--u)); background: #fff;
  box-shadow: 0 1px 4px rgba(19, 38, 31, 0.18); font: inherit; font-weight: 700; font-size: 1.25em; line-height: 1;
  color: #1f6b5a; cursor: pointer; padding: 0 calc(6 * var(--u));
}
.hgl--full .hgl__btn { min-width: calc(52 * var(--u)); height: calc(52 * var(--u)); border-radius: calc(12 * var(--u)); }
.hgl__btn:hover, .hgl__seg button:hover:not(.is-on) { background: #e3f5ee; }
</style>
