<!--
  HistoricalMapCard — карта з кордонами держав у часі (ТЗ saas_docs/plans/TZ_HISTORICAL_BORDERS_MAP_2026-10-30.md),
  вигляд — макет дизайнера 30.10 (`DATA/ПОЛА/Karta1.zip`: «Картка на дошці», «На весь екран», «Палітра і стилі»).

  ЛИШЕ ДАНІ. Межі — з закріпленого набору цієї версії (`board/historicalBorders.ts`), у стані дошки — тільки
  `{dataset, version, year}`. Рік змінює один `asset_update` (◀ ▶, крапки років, «По черзі»); підсвітка з легенди,
  підказки й спалах змінених держав — лише вигляд цього екрана, не ops.

  ЧЕСНІСТЬ. Суша без держави — штриховка «Немає даних»; чого немає в наборі, не домальовуємо; підпис джерела
  (умова CC BY 4.0) — на самій карті.
-->
<template>
  <div class="hmap" :class="{ 'hmap--full': isExpanded, 'is-readonly': !interactive, 'hmap--hl': !!hl }">
    <header class="hmap__hd" :class="{ 'hmap__hd--host': hostWindowControls }">
      <span aria-hidden="true">🗺</span>
      <b class="hmap__title">{{ title }}</b>
      <span v-if="dataset" class="hmap__range">{{ dataset.meta.years[0] }} — {{ dataset.meta.years[1] }}</span>
    </header>
    <div class="hmap__bd">
      <div ref="mapEl" class="hmap__map" @mouseleave="tip = null">
        <!-- v1.78: об'ємна карта на рушії карт; поки вантажиться, без WebGL чи при збої — пласка нижче -->
        <HistoricalMapGL
          v-if="dataset && gl !== 'off'"
          :dataset="dataset" :basemap="data.basemap" :year="year" :changed="flashEntities" :hl="hl" :lang="lang"
          :interactive="interactive" :expanded="isExpanded" :L="L" :text-scale="textScale" :pins="pins"
          @ready="gl = 'on'" @fail="gl = 'off'" @hover="onGlHover"
        />
        <svg v-show="gl !== 'on'" class="hmap__svg" :viewBox="`0 0 ${VB} ${VBH}`" preserveAspectRatio="xMidYMid meet">
          <defs>
            <!-- «Немає даних»: суша без держави — світла штриховка (макет «Палітра і стилі») -->
            <pattern :id="`${uid}-nd`" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="#efe9da" />
              <rect width="1.6" height="9" fill="#d9cfb6" />
            </pattern>
          </defs>
          <rect x="0" y="0" :width="VB" :height="VBH" fill="#d3e5ee" />
          <line
            v-for="g in gridLines" :key="g.k" class="hmap__grat"
            :x1="g.x1" :y1="g.y1" :x2="g.x2" :y2="g.y2"
          />
          <path
            v-for="(d, i) in land" :key="`land-${i}`" class="hmap__land" :d="d"
            :fill="`url(#${uid}-nd)`" fill-rule="evenodd" @mousemove="showTip($event, L.noDataTip, L.noDataTip2)"
          />
          <TransitionGroup tag="g" name="hmap-fade">
            <path
              v-for="s in shapes" :key="s.id"
              class="hmap__state" :class="{ 'is-flash': flash && s.flash, 'is-hot': hl === s.entity }"
              :d="s.d" :fill="s.color" fill-rule="evenodd" :data-entity="s.entity"
              @mousemove="showTip($event, s.name, s.tip)"
            />
          </TransitionGroup>
          <text
            v-for="l in labels" :key="`lb-${l.id}`"
            class="hmap__lb" :class="{ 'hmap__lb--big': l.big }"
            :x="l.x" :y="l.y" :font-size="l.fs" :stroke-width="l.fs * 0.28" text-anchor="middle"
          >{{ l.text }}</text>
          <!-- v1.79: події шкали сторінки з місцем із джерела — номери (відкрита — більша, з назвою) -->
          <g v-for="p in svgPins" :key="p.key" class="hmap__pin" :class="{ 'is-on': p.active }">
            <circle :cx="p.x" :cy="p.y" :r="p.active ? 15 : 11" />
            <text :x="p.x" :y="p.y + 4.5" text-anchor="middle">{{ p.n }}</text>
            <text v-if="p.active" class="hmap__pin-lb" :x="p.x" :y="p.y + 34" text-anchor="middle">{{ p.label }}</text>
          </g>
        </svg>
        <p class="hmap__attr" data-testid="map-card-borders-note">{{ attribution }}</p>
        <div v-if="tip" class="hmap__tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
          <b>{{ tip.title }}</b><span>{{ tip.text }}</span>
        </div>
      </div>

      <aside class="hmap__side" @mousedown.stop @pointerdown.stop>
        <p v-if="missing" class="hmap__gap" data-testid="map-card-borders-missing">{{ L.unavailable }}</p>
        <template v-if="dataset">
          <div class="hmap__yr">
            <div>
              <small>{{ isExpanded ? L.bordersAtFull : L.bordersAt }}</small>
              <div :key="year" class="hmap__n" data-testid="map-card-year">{{ year }}</div>
            </div>
            <div class="hmap__arrows">
              <button type="button" :title="L.prev" :aria-label="L.prev" :disabled="!interactive || year <= years[0]"
                data-testid="map-card-year-prev" @click.stop="step(-1)">←</button>
              <button type="button" :title="L.next" :aria-label="L.next" :disabled="!interactive || year >= lastYear"
                data-testid="map-card-year-next" @click.stop="step(1)">→</button>
            </div>
          </div>
          <p v-if="isExpanded" class="hmap__chg" data-testid="map-card-change">{{ changeText }}</p>
          <div class="hmap__scrub" data-testid="map-card-scrub">
            <div class="hmap__rail" />
            <div class="hmap__fill" :style="{ width: `${pos(snapshot)}%` }" />
            <button
              v-for="y in years" :key="y" type="button"
              :class="{ 'is-on': y === snapshot, 'is-past': y < snapshot }" :style="{ left: `${pos(y)}%` }"
              :disabled="!interactive" :title="String(y)" @click.stop="go(y)"
            ><i /><span v-if="y === snapshot || y === years[0] || y === lastYear">{{ y }}</span></button>
          </div>
          <div>
            <button type="button" class="hmap__play" :class="{ 'is-on': playing }" :disabled="!interactive"
              data-testid="map-card-play" @click.stop="togglePlay"
            ><i aria-hidden="true">{{ playing ? '❚❚' : '▶' }}</i>{{ playing ? L.pause : L.play }}</button>
          </div>
          <div class="hmap__leg" data-testid="map-card-legend">
            <h4>{{ L.onMap.replace('{y}', String(year)) }}</h4>
            <button
              v-for="s in legend" :key="s.entity" type="button" class="hmap__it"
              @mouseenter="hl = s.entity" @mouseleave="hl = null" @focus="hl = s.entity" @blur="hl = null"
            >
              <span class="hmap__sw" :style="{ background: s.color }" />
              <span class="hmap__nm">{{ s.name }}</span>
              <em v-if="s.added" class="is-new">{{ L.added }}</em>
              <em v-else-if="s.changed">{{ L.changed }}</em>
            </button>
            <div class="hmap__sep" />
            <div class="hmap__it is-dim"><span class="hmap__sw hmap__sw--nd" /><span class="hmap__nm">{{ L.noData }}</span></div>
            <div class="hmap__it is-dim"><span class="hmap__sw hmap__sw--dp" /><span class="hmap__nm">{{ L.disputed }}</span></div>
            <p v-if="!isExpanded && note" class="hmap__gap">{{ note }}</p>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { MapCardData, WBAsset } from '../../../types/winterboard'
import { basemapAspect, basemapSpec, landPaths, polygonsPath, project } from '../../../board/basemaps'
import {
  BIG_ENTITIES, BORDER_DATASETS, ENTITY_SHORT_UK, bordersDiff, changeYears, clampYear, entityColor, loadBorders,
  snapshotYears, statesAt, stepYear, type BordersDataset,
} from '../../../board/historicalBorders'
import { HISTORICAL_MAP_LABELS } from '../../../board/timelinePresentation'
import { isTimelinePlaying, setTimelinePlaying } from '../../../board/timelinePlayback'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { webglSupported } from '../../../board/webglSupport'
import { presentationScaleOf } from '../../../board/cardPresentation'
import type { MapEventPin } from '../../../board/evidenceLinkage'
import HistoricalMapGL from './HistoricalMapGL.vue'

const props = withDefaults(
  defineProps<{ asset: WBAsset; interactive?: boolean; isExpanded?: boolean; navigable?: boolean; events?: MapEventPin[] }>(),
  { interactive: true, isExpanded: false, navigable: false, events: () => [] },
)
const emit = defineEmits<{ 'update:asset': [asset: WBAsset]; 'borders-ready': [] }>()

const VB = 1000
const uid = `hmap-${Math.random().toString(36).slice(2, 8)}`
const hostWindowControls = useHostWindowControls()

const data = computed(() => props.asset.data as MapCardData)
const lang = computed<'uk' | 'en'>(() => (data.value.content_language === 'en' ? 'en' : 'uk'))
const L = computed(() => HISTORICAL_MAP_LABELS[lang.value])
const entry = computed(() => BORDER_DATASETS[data.value.borders?.dataset ?? ''])
const title = computed(() => data.value.title || entry.value?.title[lang.value] || '')
const note = computed(() => entry.value?.note[lang.value] ?? '')

const spec = computed(() => basemapSpec(data.value.basemap))
const VBH = computed(() => Math.round(VB * basemapAspect(spec.value)))
const land = computed(() => landPaths(spec.value, VB, VBH.value))
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

// ── Набір цієї версії ────────────────────────────────────────────────────────────────────────────────────
const dataset = shallowRef<BordersDataset | null>(null)
const missing = ref(false)
// Два джерела, а не масив з одного: інакше кожен новий рік (новий asset) перезапускав би набір — карта на мить
// порожня, усі держави проявлялися б наново, а «по черзі» скидалося
watch([() => data.value.borders?.dataset, () => data.value.borders?.version], ([id, version]) => {
  dataset.value = null
  missing.value = false
  void loadBorders(id, version).then((loaded) => {
    if (data.value.borders?.dataset !== id || data.value.borders?.version !== version) return
    dataset.value = loaded
    missing.value = !loaded
    emit('borders-ready')
  })
}, { immediate: true })

const year = computed(() => (dataset.value ? clampYear(dataset.value, data.value.borders?.year) : 0))
const years = computed(() => (dataset.value ? changeYears(dataset.value) : []))
const lastYear = computed(() => years.value[years.value.length - 1] ?? 0)
const snapshot = computed(() => (dataset.value ? snapshotYears(dataset.value, year.value).snapshot : 0))
const previous = computed(() => (dataset.value ? snapshotYears(dataset.value, year.value).previous : null))
const diff = computed(() => (dataset.value ? bordersDiff(dataset.value, year.value) : { changed: [], added: [], gone: [] }))
const pos = (y: number) => {
  const a = years.value[0] ?? 0
  return lastYear.value > a ? ((y - a) / (lastYear.value - a)) * 100 : 0
}

const nameOf = (entity: string, uk: string, en: string, short: boolean) =>
  lang.value === 'en' ? en : (short ? ENTITY_SHORT_UK[entity] ?? uk : uk)

function bboxArea(polygons: Array<Array<Array<[number, number]>>>): number {
  let w = 180, s = 90, e = -180, n = -90
  for (const polygon of polygons) for (const [lon, lat] of polygon[0] ?? []) {
    w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat)
  }
  return Math.max(0, e - w) * Math.max(0, n - s)
}
const current = computed(() => (dataset.value
  ? [...statesAt(dataset.value, year.value)].map((s) => ({ s, size: bboxArea(s.polygons) })).sort((a, b) => b.size - a.size)
  : []))

const shapes = computed(() => current.value.map(({ s }) => {
  const added = diff.value.added.includes(s.entity)
  const changed = diff.value.changed.includes(s.entity)
  const tipText = added ? L.value.tipAdded.replace('{y}', String(snapshot.value))
    : changed ? L.value.tipChanged.replace('{y}', String(previous.value))
      : L.value.tipAt.replace('{y}', String(year.value))
  return {
    id: s.id, entity: s.entity, color: entityColor(s.entity), flash: added || changed,
    d: polygonsPath(s.polygons, spec.value, VB, VBH.value),
    name: nameOf(s.entity, s.name_uk, s.name_en, false), tip: tipText,
  }
}))

/** Підписи: імперії першими й великими літерами; той, що налазить на вже поставлений, — ховається. */
const labels = computed(() => {
  const fs = props.isExpanded ? 22 : 26
  const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = []
  const items = current.value
    .filter(({ s }) => s.label)
    .map(({ s, size }) => ({ s, pr: (BIG_ENTITIES.has(s.entity) ? 1e6 : 0) + size }))
    .sort((a, b) => b.pr - a.pr)
  const out: Array<{ id: string; text: string; x: number; y: number; fs: number; big: boolean }> = []
  for (const { s } of items) {
    const p = project(s.label![1], s.label![0], spec.value)
    if (!p) continue
    const big = BIG_ENTITIES.has(s.entity)
    const size = big ? fs * 1.08 : fs
    const text = nameOf(s.entity, s.name_uk, s.name_en, !props.isExpanded)
    const w = text.length * size * (big ? 0.78 : 0.6)
    const pad = size * 0.2
    // Держава біля краю карти (Швеція, Габсбурги) — підпис підсуваємо всередину, щоб не обрізався краєм
    const x = Math.min(Math.max(p.x * VB, w / 2 + pad), VB - w / 2 - pad)
    const y = Math.min(Math.max(p.y * VBH.value, size + pad), VBH.value - pad)
    const box = { x1: x - w / 2 - pad, x2: x + w / 2 + pad, y1: y - size - pad, y2: y + pad }
    if (placed.some((b) => box.x1 < b.x2 && b.x1 < box.x2 && box.y1 < b.y2 && b.y1 < box.y2)) continue
    placed.push(box)
    out.push({ id: s.id, text: big && lang.value === 'uk' ? text.toLocaleUpperCase('uk') : text, x, y, fs: size, big })
  }
  return out
})

const legend = computed(() => current.value
  .map(({ s }) => ({
    entity: s.entity, color: entityColor(s.entity), name: nameOf(s.entity, s.name_uk, s.name_en, false),
    added: diff.value.added.includes(s.entity), changed: diff.value.changed.includes(s.entity),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, lang.value)))

const changeText = computed(() => {
  if (previous.value === null) return L.value.first
  const names = (ids: string[]) => ids.map((e) => {
    const s = dataset.value?.states.find((x) => x.entity === e)
    return s ? nameOf(e, s.name_uk, s.name_en, false) : e
  }).join(', ')
  const parts: string[] = []
  if (diff.value.changed.length) parts.push(L.value.changedList + names(diff.value.changed))
  if (diff.value.added.length) parts.push(L.value.addedList + names(diff.value.added))
  if (diff.value.gone.length) parts.push(L.value.goneList + names(diff.value.gone))
  return L.value.since.replace('{y}', String(previous.value)) + (parts.join('; ') || L.value.none) + '.'
})

const attribution = computed(() => {
  const src = dataset.value?.meta.source
  return src ? L.value.attribution.replace('{source}', src.title).replace('{license}', src.license) : ''
})

// ── Рік: один asset_update ───────────────────────────────────────────────────────────────────────────────
function writeYear(y: number, allowed = props.interactive): void {
  const borders = data.value.borders
  if (!allowed || !borders || y === borders.year) return
  emit('update:asset', { ...props.asset, data: { ...data.value, borders: { ...borders, year: y } } } as WBAsset)
}
function go(y: number): void { stopPlay(); writeYear(y) }
function step(dir: 1 | -1): void {
  stopPlay()
  if (dataset.value) writeYear(stepYear(dataset.value, snapshot.value, dir))
}
// «По черзі» — макет: крок раз на 2,4 с до останньої зміни; з останнього року — з першого.
// «Грає» — спільний стан екрана (`board/timelinePlayback`): ▶ на пульті вмикає саме цей таймер (LAW §9 v1.77).
// Таймер пише за `navigable` (учитель, редагування), а не за інструментом: з пульта крокує й тоді, коли в руці перо.
const playing = computed(() => isTimelinePlaying(props.asset.id))
let playTimer: ReturnType<typeof setInterval> | null = null
function clearPlayTimer(): void {
  if (playTimer) clearInterval(playTimer)
  playTimer = null
}
function stopPlay(): void {
  setTimelinePlaying(props.asset.id, false)
}
function togglePlay(): void {
  setTimelinePlaying(props.asset.id, !playing.value)
}
function startPlayTimer(): void {
  clearPlayTimer()
  const canWrite = props.navigable || props.interactive
  const next = () => {
    if (!dataset.value || snapshot.value >= lastYear.value) { stopPlay(); return }
    writeYear(stepYear(dataset.value, snapshot.value, 1), canWrite)
  }
  if (snapshot.value >= lastYear.value) writeYear(years.value[0], canWrite)
  else next()
  playTimer = setInterval(next, 2400)
}
watch(() => playing.value && !!dataset.value, (on) => (on ? startPlayTimer() : clearPlayTimer()), { immediate: true })

// ── Лише вигляд: спалах змінених, підсвітка, підказка ────────────────────────────────────────────────────
const flash = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | null = null
watch(year, (y, old) => {
  if (!old || y === old) return
  flash.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = false }, 1600)
})
const hl = ref<string | null>(null)
const mapEl = ref<HTMLElement | null>(null)
const tip = ref<{ x: number; y: number; title: string; text: string } | null>(null)
// v1.78: об'ємна карта — 'pending' (вантажиться, видно пласку), 'on', 'off' (без WebGL чи збій — пласка назавжди)
const gl = ref<'pending' | 'on' | 'off'>(webglSupported() ? 'pending' : 'off')
const flashEntities = computed(() => [...diff.value.changed, ...diff.value.added])
const textScale = computed(() => presentationScaleOf(props.asset))
/** v1.79: події шкал сторінки, що в роках набору (поза ними карта цих меж не показує). */
const pins = computed(() => {
  const ys = dataset.value?.meta.years
  return ys ? props.events.filter((p) => p.year >= ys[0] && p.year <= ys[1]) : []
})
const svgPins = computed(() => pins.value.flatMap((p) => {
  const at = project(p.lat, p.lon, spec.value)
  return at ? [{ ...p, x: at.x * VB, y: at.y * VBH.value }] : []
}))
/** Підказка над об'ємною картою — той самий текст, що над пласкою (держава й її межі, або «Немає даних»). */
function onGlHover(at: { x: number; y: number; entity: string | null } | null): void {
  if (!at || !props.interactive) { tip.value = null; return }
  const shape = at.entity ? shapes.value.find((s) => s.entity === at.entity) : null
  tip.value = shape
    ? { x: at.x, y: at.y, title: shape.name, text: shape.tip }
    : { x: at.x, y: at.y, title: L.value.noDataTip, text: L.value.noDataTip2 }
}
function showTip(e: MouseEvent, title: string, text: string): void {
  const el = mapEl.value
  if (!el || !props.interactive) return
  const r = el.getBoundingClientRect()
  const scale = el.offsetWidth ? r.width / el.offsetWidth : 1
  tip.value = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, title, text }
}

onBeforeUnmount(() => {
  clearPlayTimer()
  stopPlay()
  if (flashTimer) clearTimeout(flashTimer)
})

defineExpose({ ready: () => loadBorders(data.value.borders?.dataset, data.value.borders?.version) })
</script>

<style scoped>
/* Розміри — у «пікселях макета»: --u = 1/960 ширини картки (макет «Картка на дошці» 960×600) або 1/1920 на весь
   екран (макет «На весь екран» 1920×1080). Картка на дошці масштабується разом із дошкою — вигляд як у макеті на
   будь-якому масштабі, нічого не обрізається. Текст ще множиться на A−/A+ картки (--wb-card-text-scale). */
.hmap {
  position: absolute; inset: 0; display: flex; flex-direction: column; color: #0d4a3e; background: #fff;
  container-type: size; --t: var(--wb-card-text-scale, 1);
}
.hmap__hd, .hmap__bd { --u: calc(100cqw / 960); }
.hmap--full .hmap__hd, .hmap--full .hmap__bd { --u: calc(100cqw / 1920); }
.hmap__hd {
  height: calc(40 * var(--u)); flex: 0 0 calc(40 * var(--u)); display: flex; align-items: center; gap: calc(8 * var(--u));
  padding: 0 calc(12 * var(--u)); background: #eff6ff; border-bottom: 1px solid #dbeafe;
  font-size: calc(14 * var(--u) * var(--t));
}
.hmap__hd--host { padding-right: calc(170 * var(--u)); }
.hmap--full .hmap__hd--host { padding-right: calc(240 * var(--u)); }
.hmap__title { flex: 1; min-width: 0; font-weight: 600; color: #1e3a5f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hmap__range { color: #5f8379; font-size: 0.93em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hmap__bd { flex: 1; min-height: 0; display: grid; grid-template-columns: 62.5% minmax(0, 1fr); }
.hmap--full .hmap__bd { grid-template-columns: 66.5% minmax(0, 1fr); }
.hmap__map { position: relative; overflow: hidden; background: #d3e5ee; border-right: 1px solid rgba(5, 150, 105, 0.16); pointer-events: auto; }
.hmap.is-readonly .hmap__map, .hmap.is-readonly .hmap__side { pointer-events: none; }
.hmap__svg { display: block; width: 100%; height: 100%; }
.hmap__grat { stroke: #fff; stroke-opacity: 0.55; stroke-width: 1; }
.hmap__land { stroke: #cbbf9f; stroke-width: 1; }
.hmap__state { stroke: #fff; stroke-width: 1.4; stroke-linejoin: round; transition: opacity 0.25s, filter 0.25s; }
.hmap--hl .hmap__state:not(.is-hot) { opacity: 0.28; }
.hmap__state.is-flash { animation: hmap-chg 1.6s ease 1; }
@keyframes hmap-chg { 0% { filter: brightness(1); } 30% { filter: brightness(1.18) saturate(1.2); } 100% { filter: none; } }
.hmap-fade-enter-active, .hmap-fade-leave-active { transition: opacity 0.7s ease; }
.hmap-fade-enter-from, .hmap-fade-leave-to { opacity: 0; }
.hmap__lb {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-weight: 700; fill: #13261f;
  stroke: rgba(255, 255, 255, 0.92); paint-order: stroke; stroke-linejoin: round; pointer-events: none; letter-spacing: 0.01em;
}
.hmap__lb--big { letter-spacing: 0.08em; }
.hmap__pin circle { fill: #8a2f1d; stroke: #fff; stroke-width: 2.5; }
.hmap__pin text { fill: #fff; font: 700 14px system-ui, -apple-system, "Segoe UI", sans-serif; pointer-events: none; }
.hmap__pin.is-on circle { fill: #b23a22; }
.hmap__pin .hmap__pin-lb { fill: #8a2f1d; font-size: 17px; stroke: rgba(255, 255, 255, 0.92); stroke-width: 5px; paint-order: stroke; }
.hmap__attr {
  position: absolute; left: calc(8 * var(--u)); bottom: calc(6 * var(--u)); margin: 0; max-width: calc(100% - 16 * var(--u));
  font-size: calc(10 * var(--u) * var(--t)); color: #3d5a52; line-height: 1.35;
  background: rgba(255, 255, 255, 0.75); padding: calc(2 * var(--u)) calc(6 * var(--u)); border-radius: calc(5 * var(--u));
  pointer-events: none;
}
.hmap--full .hmap__attr { font-size: calc(13 * var(--u) * var(--t)); left: calc(14 * var(--u)); bottom: calc(12 * var(--u)); }
.hmap__tip {
  position: absolute; z-index: 5; pointer-events: none; background: #13261f; color: #fff; border-radius: 8px;
  padding: 6px 10px; font-size: 12px; line-height: 1.35; white-space: nowrap; transform: translate(-50%, calc(-100% - 12px));
}
.hmap__tip b { display: block; font-size: 13px; }
.hmap__tip span { color: #b7d3ca; }
.hmap__side {
  display: flex; flex-direction: column; min-height: 0; min-width: 0; pointer-events: auto;
  padding: calc(14 * var(--u)) calc(16 * var(--u)) calc(12 * var(--u)); gap: calc(12 * var(--u));
  font-size: calc(13 * var(--u) * var(--t));
}
.hmap--full .hmap__side { padding: calc(44 * var(--u)) calc(48 * var(--u)) calc(36 * var(--u)); gap: calc(28 * var(--u)); font-size: calc(24 * var(--u) * var(--t)); }
.hmap__yr { display: flex; align-items: flex-end; justify-content: space-between; gap: calc(8 * var(--u)); }
.hmap__yr small { display: block; font-size: calc(12 * var(--u) * var(--t)); color: #5f8379; font-weight: 600; margin-bottom: calc(4 * var(--u)); }
.hmap--full .hmap__yr small { font-size: calc(22 * var(--u) * var(--t)); margin-bottom: calc(12 * var(--u)); }
.hmap__n {
  font-size: calc(64 * var(--u) * var(--t)); font-weight: 800; letter-spacing: -0.04em; line-height: 0.85; font-variant-numeric: tabular-nums;
  animation: hmap-flip 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.hmap--full .hmap__n { font-size: calc(200 * var(--u) * var(--t)); }
@keyframes hmap-flip { from { opacity: 0; transform: translateY(8px); } }
.hmap__arrows { display: flex; gap: calc(6 * var(--u)); flex: none; }
.hmap__arrows button {
  width: calc(38 * var(--u)); height: calc(38 * var(--u)); border-radius: 50%; border: 1.5px solid rgba(5, 150, 105, 0.16);
  background: #fff; display: grid; place-items: center; font-size: calc(16 * var(--u)); color: #1f6b5a; cursor: pointer; padding: 0;
}
.hmap--full .hmap__arrows button { width: calc(72 * var(--u)); height: calc(72 * var(--u)); font-size: calc(30 * var(--u)); border-width: 2px; }
.hmap__arrows button:hover:not(:disabled) { border-color: #047857; color: #047857; }
.hmap__arrows button:disabled { opacity: 0.35; cursor: default; }
.hmap__chg { margin: 0; color: #1f6b5a; line-height: 1.35; }
.hmap__scrub { position: relative; height: calc(34 * var(--u)); margin: 0 calc(14 * var(--u)); }
.hmap--full .hmap__scrub { height: calc(52 * var(--u)); }
.hmap__rail, .hmap__fill { position: absolute; left: 0; top: calc(13 * var(--u)); height: calc(4 * var(--u)); border-radius: 2px; }
.hmap--full .hmap__rail, .hmap--full .hmap__fill { top: calc(18 * var(--u)); height: calc(6 * var(--u)); }
.hmap__rail { right: 0; background: #e3ebe8; }
.hmap__fill { background: #047857; transition: width 0.5s; }
.hmap__scrub button {
  position: absolute; top: calc(6 * var(--u)); transform: translateX(-50%); border: 0; background: none; padding: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: calc(3 * var(--u));
}
.hmap__scrub button i {
  width: calc(18 * var(--u)); height: calc(18 * var(--u)); border-radius: 50%; background: #fff;
  border: calc(2.5 * var(--u)) solid #c9d6d1; transition: border-color 0.2s, transform 0.2s;
}
.hmap--full .hmap__scrub button i { width: calc(26 * var(--u)); height: calc(26 * var(--u)); border-width: calc(3.5 * var(--u)); }
.hmap__scrub button span { font-size: calc(11 * var(--u) * var(--t)); font-weight: 700; color: #5f8379; font-variant-numeric: tabular-nums; }
.hmap--full .hmap__scrub button span { font-size: calc(18 * var(--u) * var(--t)); }
.hmap__scrub button.is-past i { border-color: #047857; }
.hmap__scrub button.is-on i { background: #047857; border-color: #047857; transform: scale(1.15); }
.hmap__scrub button.is-on span { color: #0d4a3e; }
.hmap__play {
  display: inline-flex; align-items: center; gap: calc(8 * var(--u)); border: 0; border-radius: calc(10 * var(--u));
  padding: calc(8 * var(--u)) calc(14 * var(--u)); font: inherit; font-weight: 700; background: #e3f5ee; color: #047857;
  cursor: pointer; white-space: nowrap;
}
.hmap--full .hmap__play { font-size: calc(22 * var(--u) * var(--t)); padding: calc(18 * var(--u)) calc(28 * var(--u)); border-radius: calc(16 * var(--u)); }
.hmap__play:hover:not(:disabled), .hmap__play.is-on { background: #047857; color: #fff; }
.hmap__play i { font-style: normal; font-size: 0.85em; }
.hmap__leg { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 1px; margin: 0 calc(-6 * var(--u)); scrollbar-width: thin; }
.hmap--full .hmap__leg { gap: calc(4 * var(--u)); }
.hmap__leg h4 {
  font-size: calc(11 * var(--u) * var(--t)); font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #5f8379;
  margin: 0 calc(6 * var(--u)) calc(4 * var(--u));
}
.hmap--full .hmap__leg h4 { font-size: calc(16 * var(--u) * var(--t)); margin-bottom: calc(8 * var(--u)); }
.hmap__it {
  display: flex; align-items: center; gap: calc(8 * var(--u)); padding: calc(4 * var(--u)) calc(6 * var(--u));
  border-radius: calc(7 * var(--u)); font: inherit; font-weight: 600; border: 0; background: none; text-align: left; width: 100%; color: inherit;
}
.hmap--full .hmap__it { gap: calc(14 * var(--u)); padding: calc(6 * var(--u)) calc(8 * var(--u)); }
button.hmap__it { cursor: default; }
button.hmap__it:hover { background: #f3f7f6; }
.hmap__it.is-dim { color: #5f8379; font-weight: 500; }
.hmap__nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hmap__it em {
  font-style: normal; font-size: 0.8em; font-weight: 700; color: #b45309; background: #fef3c7; border-radius: 999px;
  padding: calc(1 * var(--u)) calc(7 * var(--u)); white-space: nowrap;
}
.hmap--full .hmap__it em { font-size: calc(15 * var(--u) * var(--t)); padding: calc(2 * var(--u)) calc(10 * var(--u)); }
.hmap__it em.is-new { color: #1d4ed8; background: #dbeafe; }
.hmap__sw { display: inline-block; width: calc(12 * var(--u)); height: calc(12 * var(--u)); border-radius: calc(3 * var(--u)); flex: 0 0 calc(12 * var(--u)); }
.hmap--full .hmap__sw { width: calc(22 * var(--u)); height: calc(22 * var(--u)); flex-basis: calc(22 * var(--u)); border-radius: calc(5 * var(--u)); }
.hmap__sw--nd { background: repeating-linear-gradient(135deg, #efe9da 0 3px, #d6ccb3 3px 4px); border: 1px solid #cfc4a9; }
.hmap__sw--dp { background: repeating-linear-gradient(135deg, #e07a5f 0 3px, #f5c9bc 3px 6px); outline: 1.5px dashed #13261f; outline-offset: -1.5px; }
.hmap__sep { height: 1px; background: rgba(5, 150, 105, 0.16); margin: calc(6 * var(--u)); }
.hmap__gap { margin: calc(8 * var(--u)) calc(6 * var(--u)) 0; font-size: calc(12 * var(--u) * var(--t)); color: #5f8379; line-height: 1.4; }
</style>
