<template>
  <!-- LAW §9 v1.77: історична карта на пульті за макетом дизайнера (вкладка «Пульт»): рік, ← / → з роком, куди перейде,
       «По черзі», «На весь екран», які держави змінили межі, доріжка років, мінікарта без підписів. Порядок інший,
       ніж у макеті: на пульті під об'єкт лишається смуга ~285 px між сторінками й нижньою панеллю — рік і всі кнопки
       мають бути в ній без гортання за будь-якої кількості змін; плашки, доріжка й мінікарта — нижче.
       Лише показ і намір: рік пише ноутбук (П4); роки й зміни телефон рахує з того самого набору, що дошка. -->
  <div class="wb-hmap" :data-testid="`${idPrefix}-map`">
    <div class="wb-hmap__yr">
      <small>{{ t('winterboard.remote.scenario.mapBordersAt') }}</small>
      <b :data-testid="`${idPrefix}-map-year`">{{ year }}</b>
    </div>

    <div class="wb-hmap__pn">
      <button
        type="button" :data-testid="`${idPrefix}-map-prev`" :disabled="!ready || (!!data && prevYear === null)"
        @click="emit('send', 'map.step', { object_id: item.objectId, dir: -1 })"
      ><small>{{ t('winterboard.remote.scenario.mapPrev') }}</small><b>{{ prevYear ?? '—' }}</b></button>
      <button
        type="button" :data-testid="`${idPrefix}-map-next`" :disabled="!ready || (!!data && nextYear === null)"
        @click="emit('send', 'map.step', { object_id: item.objectId, dir: 1 })"
      ><small>{{ t('winterboard.remote.scenario.mapNext') }}</small><b>{{ nextYear ?? '—' }}</b></button>
    </div>

    <div class="wb-hmap__row">
      <button
        type="button" class="wb-hmap__play" :class="{ 'is-on': item.playing }" :aria-pressed="item.playing === true"
        :data-testid="`${idPrefix}-map-play`" :disabled="!ready"
        @click="emit('send', item.playing ? 'map.pause' : 'map.play', { object_id: item.objectId })"
      >{{ item.playing ? `❚❚ ${t('winterboard.remote.scenario.mapPause')}` : `▶ ${t('winterboard.remote.scenario.tell')}` }}</button>
      <button
        v-if="focusId === item.objectId" type="button" class="wb-hmap__fs" :data-testid="`${idPrefix}-whole-page`"
        :disabled="!ready" @click="emit('send', 'view.page', {})"
      >▭ {{ t('winterboard.remote.fitPage') }}</button>
      <button
        v-else type="button" class="wb-hmap__fs" :data-testid="`${idPrefix}-focus`" :disabled="!ready"
        @click="emit('send', 'view.focus', { object_id: item.objectId })"
      >⛶ {{ t('winterboard.remote.scenario.fullscreen') }}</button>
    </div>

    <div v-if="data" class="wb-hmap__chips" :data-testid="`${idPrefix}-map-changes`">
      <span v-if="!chips.length" class="wb-hmap__none">{{ previous === null ? t('winterboard.remote.scenario.mapFirst') : t('winterboard.remote.scenario.mapUnchanged') }}</span>
      <span v-for="c in chips" :key="c.entity"><i :style="{ background: c.color }" />{{ c.name }}</span>
    </div>

    <div v-if="data && years.length > 1" class="wb-hmap__scrub" aria-hidden="true">
      <div class="wb-hmap__rail" /><div class="wb-hmap__fill" :style="{ width: `${pos(snapshot)}%` }" />
      <span
        v-for="y in years" :key="y" class="wb-hmap__dot"
        :class="{ 'is-on': y === snapshot, 'is-past': y < snapshot }" :style="{ left: `${pos(y)}%` }"
      ><i /><em v-if="y === snapshot || y === years[0] || y === years[years.length - 1]">{{ y }}</em></span>
    </div>

    <div v-if="data" class="wb-hmap__mini" aria-hidden="true">
      <svg :viewBox="`0 0 ${VB} ${VBH}`" preserveAspectRatio="xMidYMid slice">
        <rect x="0" y="0" :width="VB" :height="VBH" fill="#d3e5ee" />
        <path v-for="(d, i) in land" :key="`l${i}`" :d="d" fill="#efe9da" stroke="#cbbf9f" stroke-width="1" fill-rule="evenodd" />
        <path v-for="s in shapes" :key="s.id" :d="s.d" :fill="s.color" stroke="#fff" stroke-width="1" fill-rule="evenodd" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Історична карта на пульті (LAW §9 v1.77). Від ноутбука — лише наш id набору, версія й рік; решту телефон рахує тим
 * самим кодом, що картка на дошці (`board/historicalBorders`), з того самого версіонованого файла. Набору цієї версії
 * телефон не знає — лише рік і кнопки (крок на межі ноутбук просто не зробить). Нічого не пише й не повторює (§12).
 */
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemoteScenarioItem } from '../../composables/useRemoteChannel'
import { basemapAspect, basemapSpec, landPaths, polygonsPath } from '../../board/basemaps'
import {
  BORDER_DATASETS, ENTITY_SHORT_UK, bordersDiff, changeYears, clampYear, entityColor, loadBorders, snapshotYears,
  statesAt, stepYear, type BordersDataset,
} from '../../board/historicalBorders'

const props = withDefaults(defineProps<{
  item: RemoteScenarioItem
  focusId: string | null
  ready: boolean
  idPrefix?: string
}>(), { idPrefix: 'scenario' })
const emit = defineEmits<{ send: [cmd: string, args: Record<string, unknown>] }>()
const { t, locale } = useI18n()

const data = shallowRef<BordersDataset | null>(null)
// Два джерела: новий рік у стані пульта не перезапускає набір (мінікарта не блимає)
watch([() => props.item.mapDataset, () => props.item.mapVersion], ([id, version]) => {
  data.value = null
  void loadBorders(id, version).then((loaded) => {
    if (props.item.mapDataset === id && props.item.mapVersion === version) data.value = loaded
  })
}, { immediate: true })

const year = computed(() => (data.value ? clampYear(data.value, props.item.mapYear) : props.item.mapYear ?? 0))
const years = computed(() => (data.value ? changeYears(data.value) : []))
const snapshot = computed(() => (data.value ? snapshotYears(data.value, year.value).snapshot : year.value))
const previous = computed(() => (data.value ? snapshotYears(data.value, year.value).previous : null))
const neighbour = (dir: 1 | -1) => {
  if (!data.value) return null
  const y = stepYear(data.value, snapshot.value, dir)
  return y === snapshot.value ? null : y
}
const prevYear = computed(() => neighbour(-1))
const nextYear = computed(() => neighbour(1))
const pos = (y: number) => {
  const a = years.value[0] ?? 0
  const z = years.value[years.value.length - 1] ?? 0
  return z > a ? ((y - a) / (z - a)) * 100 : 0
}

const spec = computed(() => basemapSpec(BORDER_DATASETS[props.item.mapDataset ?? '']?.basemap ?? 'east_europe'))
const VB = 1000
const VBH = computed(() => Math.round(VB * basemapAspect(spec.value)))
const land = computed(() => (data.value ? landPaths(spec.value, VB, VBH.value) : []))
const shapes = computed(() => (data.value
  ? statesAt(data.value, year.value).map((s) => ({
    id: s.id, color: entityColor(s.entity), d: polygonsPath(s.polygons, spec.value, VB, VBH.value),
  }))
  : []))

/** Плашки: які держави змінили межі чи з'явилися з попереднього знімка (макет: колір + коротка назва). */
const chips = computed(() => {
  if (!data.value || previous.value === null) return []
  const diff = bordersDiff(data.value, year.value)
  const en = String(locale.value).startsWith('en')
  return [...diff.changed, ...diff.added].map((entity) => {
    const s = data.value!.states.find((x) => x.entity === entity)
    return { entity, color: entityColor(entity), name: en ? s?.name_en ?? entity : ENTITY_SHORT_UK[entity] ?? s?.name_uk ?? entity }
  })
})
</script>

<style scoped>
/* Макет «Пульт» (Karta1): рік крупно, плашки, ← / → з роком, «По черзі» зелена, мінікарта. Кольори — пульта. */
.wb-hmap { display: flex; flex-direction: column; gap: 12px; }
.wb-hmap__mini { height: 180px; border-radius: 18px; overflow: hidden; background: #d3e5ee; }
.wb-hmap__mini svg { display: block; width: 100%; height: 100%; }
.wb-hmap__yr { display: flex; align-items: baseline; gap: 10px; }
.wb-hmap__yr small { font-size: 13px; color: #8fb3a8; font-weight: 600; }
.wb-hmap__yr b { font-size: 56px; font-weight: 800; line-height: 0.95; letter-spacing: -0.04em; color: #fff; font-variant-numeric: tabular-nums; }
.wb-hmap__chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; }
.wb-hmap__chips span {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 6px; border-radius: 999px;
  background: #172b26; color: var(--text); font-size: 12.5px; font-weight: 600; white-space: nowrap;
}
.wb-hmap__chips span i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.wb-hmap__chips .wb-hmap__none { background: none; color: #8fb3a8; font-weight: 500; padding-left: 0; }
.wb-hmap__scrub { position: relative; height: 34px; margin: 0 12px; }
.wb-hmap__rail, .wb-hmap__fill { position: absolute; left: 0; top: 7px; height: 4px; border-radius: 2px; }
.wb-hmap__rail { right: 0; background: #24423a; }
.wb-hmap__fill { background: #34d399; transition: width 0.5s; }
.wb-hmap__dot { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 3px; }
.wb-hmap__dot i { width: 18px; height: 18px; border-radius: 50%; background: #0d1a17; border: 2.5px solid #35574e; box-sizing: border-box; }
.wb-hmap__dot.is-past i { border-color: #34d399; }
.wb-hmap__dot.is-on i { background: #34d399; border-color: #34d399; }
.wb-hmap__dot em { font-style: normal; font-size: 11px; font-weight: 700; color: #8fb3a8; font-variant-numeric: tabular-nums; }
.wb-hmap__dot.is-on em { color: #fff; }
.wb-hmap__pn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.wb-hmap__pn button {
  min-height: 72px; border: 1.5px solid #24423a; background: #132621; color: var(--text); border-radius: 18px;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 10px 16px; gap: 2px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-hmap__pn button + button { align-items: flex-end; }
.wb-hmap__pn small { font-size: 12px; color: #8fb3a8; font-weight: 600; }
.wb-hmap__pn b { font-size: 24px; font-variant-numeric: tabular-nums; }
.wb-hmap__row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; }
.wb-hmap__row button {
  min-height: 56px; border-radius: 16px; border: 0; font-weight: 700; font-size: 16px; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.wb-hmap__play { background: #34d399; color: #06281f; }
.wb-hmap__play.is-on { background: #fbbf24; }
.wb-hmap__fs { background: #1d3530; color: var(--text); }
.wb-hmap button:disabled { opacity: 0.35; pointer-events: none; }
</style>
