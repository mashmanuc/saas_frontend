<!--
  Бібліотека шкал тем (власник 2026-10-30: «зберігати це як бібліотеку. Якщо хтось колись робить запит, ми його
  беремо вже готового»). Теми, які вже зібрав Інтегралик, — найуживаніші спершу; натиск ставить шкалу на дошку тим
  самим планом, що дає Інтегралик (`runBoardAction`), без моделі. Пілоту історичної карти — і карту праворуч від
  шкали (та сама плитка «Історична карта», регіон і роки — з цієї шкали).
-->
<template>
  <div class="tl-lib" data-testid="timeline-library">
    <input
      v-model="query"
      class="tl-lib__search"
      type="search"
      :placeholder="t('winterboard.timelineLibrary.search')"
      :aria-label="t('winterboard.timelineLibrary.search')"
      data-testid="timeline-library-search"
    />
    <p v-if="state === 'loading'" class="tl-lib__status">{{ t('winterboard.timelineLibrary.loading') }}</p>
    <div v-else-if="state === 'failed'" class="tl-lib__status">
      <p>{{ t('winterboard.timelineLibrary.failed') }}</p>
      <button type="button" class="tl-lib__retry" @click="load">{{ t('winterboard.timelineLibrary.retry') }}</button>
    </div>
    <p v-else-if="!items.length" class="tl-lib__status" data-testid="timeline-library-empty">
      {{ query.trim() ? t('winterboard.timelineLibrary.nothingFound') : t('winterboard.timelineLibrary.empty') }}
    </p>
    <div v-else class="tl-lib__list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="tl-lib__item"
        :disabled="adding !== null"
        :data-testid="`timeline-library-item-${item.id}`"
        @click="add(item)"
      >
        <span class="tl-lib__title">{{ item.title }}</span>
        <span class="tl-lib__meta">{{ years(item) }} · {{ t('winterboard.timelineLibrary.events', { n: item.events }, item.events) }}</span>
        <span v-if="adding === item.id" class="tl-lib__state">{{ t('winterboard.timelineLibrary.adding') }}</span>
        <span v-else-if="failedId === item.id" class="tl-lib__state tl-lib__state--bad">{{ t('winterboard.timelineLibrary.addFailed') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { HISTORICAL_MAP_DRAG_MIME } from '../../constants/evidenceCardDefaults'
import { fetchTimelineLibrary, fetchTimelineLibraryItem } from '@/modules/intent/corridors/corridorApi'
import { openPageForPlan, planFitsCurrentPage, runBoardAction } from '@/modules/intent/boardActions'

interface LibraryItem {
  id: string
  title: string
  years: [number | null, number | null]
  events: number
}

const props = defineProps<{ withMap?: boolean }>()

const { t, locale } = useI18n()
const addTool = useAddToolToBoard()

const query = ref('')
const items = ref<LibraryItem[]>([])
const state = ref<'loading' | 'ready' | 'failed'>('loading')
const adding = ref<string | null>(null)
const failedId = ref<string | null>(null)
const language = () => (locale.value === 'en' ? 'en' : 'uk')
let asked = 0

async function load(): Promise<void> {
  const mine = ++asked
  state.value = 'loading'
  try {
    const r = await fetchTimelineLibrary({ language: language(), q: query.value.trim() })
    if (mine !== asked) return   // поки чекали — учитель дописав пошук
    items.value = Array.isArray(r?.items) ? r.items : []
    state.value = 'ready'
  } catch (err) {
    console.warn('[WB:timeline-library] list failed', err)
    if (mine === asked) state.value = 'failed'
  }
}

// Пошук — і серед назв, якими тему просили (на сервері); застарілу відповідь відкидає `asked`
watch(query, load)
onMounted(load)

function years(item: LibraryItem): string {
  const fmt = (y: number) => (y < 0 ? t('winterboard.timelineLibrary.bc', { y: -y }) : String(y))
  const [from, to] = item.years
  if (from == null || to == null) return ''
  return from === to ? fmt(from) : `${fmt(from)}–${fmt(to)}`
}

async function add(item: LibraryItem): Promise<void> {
  if (adding.value) return
  adding.value = item.id
  failedId.value = null
  try {
    const plan = await fetchTimelineLibraryItem(item.id)
    const action = plan?.actions?.[0]
    if (action?.kind !== 'add_timeline') throw new Error('library: not a timeline plan')
    // Як у Інтегралика: на поточній сторінці не вміщається — нова сторінка одразу після поточної
    if (!(await planFitsCurrentPage([action]))) await openPageForPlan(item.title)
    const { assetId } = await runBoardAction(action)
    // Карта — праворуч від цієї шкали, щоб рік на карті йшов за подією шкали (одна сторінка)
    if (props.withMap) addTool(HISTORICAL_MAP_DRAG_MIME, JSON.stringify({ nextTo: assetId }))
  } catch (err) {
    console.warn('[WB:timeline-library] insert failed', err)
    failedId.value = item.id
  } finally {
    adding.value = null
  }
}
</script>

<style scoped>
.tl-lib { display: flex; flex-direction: column; gap: 6px; padding: 0 8px 12px; }
.tl-lib__search {
  width: 100%; height: 30px; padding: 0 10px; font-size: 12px; color: #1e293b;
  border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;
}
.tl-lib__search:focus { outline: none; border-color: #7dd3fc; }
.tl-lib__status { margin: 4px 4px; font-size: 12px; line-height: 1.45; color: #64748b; }
.tl-lib__status p { margin: 0 0 6px; }
.tl-lib__retry {
  border: 1px solid #c7d2fe; background: #f5f3ff; color: #4338ca; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.tl-lib__list { display: flex; flex-direction: column; gap: 2px; }
.tl-lib__item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; text-align: left;
  padding: 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer;
}
.tl-lib__item:hover:not(:disabled) { background: #e0f2fe; border-color: #7dd3fc; }
.tl-lib__item:disabled { cursor: wait; opacity: 0.7; }
.tl-lib__title { font-size: 13px; font-weight: 600; color: #1e293b; }
.tl-lib__meta { font-size: 11px; color: #64748b; }
.tl-lib__state { font-size: 11px; color: #2563eb; }
.tl-lib__state--bad { color: #b91c1c; }

[data-theme="dark"] .tl-lib__search { background: #1e293b; border-color: #334155; color: #e2e8f0; }
[data-theme="dark"] .tl-lib__item:hover:not(:disabled) { background: #1e3a5f; border-color: #2563eb; }
[data-theme="dark"] .tl-lib__title { color: #e2e8f0; }
[data-theme="dark"] .tl-lib__meta,
[data-theme="dark"] .tl-lib__status { color: #94a3b8; }
</style>
