<template>
  <section class="pu">
    <header class="pu__head">
      <h2 class="pu__title">{{ t('staff.presence.title') }}</h2>
      <div class="pu__periods" role="group" :aria-label="t('staff.presence.period')">
        <button v-for="d in PERIODS" :key="d" type="button" class="pu__period"
                :class="{ 'pu__period--on': d === days }" :aria-pressed="d === days" @click="setDays(d)">
          {{ t(`staff.presence.periods.d${d}`) }}
        </button>
      </div>
    </header>

    <!-- Присутність у часі -->
    <div class="pu__card">
      <h3>{{ t('staff.presence.timeline.title') }}</h3>
      <p v-if="timelineFailed" class="pu__error" role="alert">{{ t('staff.presence.loadFailed') }}</p>
      <p v-else-if="timeline && !timeline.sampling_enabled && !timeline.since" class="pu__warn">
        {{ t('staff.presence.timeline.disabled') }}
      </p>
      <p v-else-if="timeline && !timeline.since" class="pu__note">{{ t('staff.presence.timeline.noHistory') }}</p>
      <template v-else-if="timeline">
        <p v-if="!timeline.sampling_enabled" class="pu__warn">{{ t('staff.presence.timeline.disabledSince') }}</p>
        <p class="pu__note">{{ t('staff.presence.timeline.since', { date: fmtDate(timeline.since) }) }}</p>
        <div class="pu__chart"><canvas ref="chartEl" /></div>
        <h4>{{ t('staff.presence.heatmap.title') }}</h4>
        <p class="pu__note">{{ t('staff.presence.heatmap.hint') }}</p>
        <div class="pu__heatmap" role="table">
          <div class="pu__hm-row" role="row">
            <span class="pu__hm-label" />
            <span v-for="h in 24" :key="h" class="pu__hm-hour" role="columnheader">{{ h - 1 }}</span>
          </div>
          <div v-for="(row, d) in timeline.heatmap" :key="d" class="pu__hm-row" role="row">
            <span class="pu__hm-label" role="rowheader">{{ t(`staff.presence.weekdays.${d}`) }}</span>
            <span v-for="(v, h) in row" :key="h" class="pu__hm-cell" role="cell"
                  :style="{ background: heatColor(v) }" :title="heatLabel(d, h, v)" :aria-label="heatLabel(d, h, v)" />
          </div>
        </div>
      </template>
      <p v-else class="pu__note">{{ t('staff.presence.loading') }}</p>
    </div>

    <!-- Хто скільки споживає -->
    <div class="pu__card">
      <div class="pu__card-head">
        <h3>{{ t('staff.presence.top.title') }}</h3>
        <label class="pu__sort">
          {{ t('staff.presence.top.sortBy') }}
          <select v-model="sort" @change="loadTop">
            <option v-for="k in SORTS" :key="k" :value="k">{{ t(`staff.presence.top.cols.${k}`) }}</option>
          </select>
        </label>
      </div>
      <p v-if="topFailed" class="pu__error" role="alert">{{ t('staff.presence.loadFailed') }}</p>
      <p v-else-if="top && !top.sampling_enabled" class="pu__warn">{{ t('staff.presence.top.samplingOff') }}</p>
      <p v-if="!topFailed && top && !top.results.length" class="pu__note">{{ t('staff.presence.top.empty') }}</p>
      <div v-if="!topFailed && top && top.results.length" class="pu__table-wrap">
        <table class="pu__table">
          <thead>
            <tr>
              <th>{{ t('staff.presence.top.user') }}</th>
              <th v-for="k in SORTS" :key="k" :class="{ 'pu__th--on': k === sort }">{{ t(`staff.presence.top.cols.${k}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in top.results" :key="r.user_id">
              <td>
                <router-link :to="`/staff/users/${r.user_id}`">{{ r.name || r.email }}</router-link>
                <small class="pu__role">{{ r.role }}</small>
                <small v-if="r.is_staff" class="pu__staff">{{ t('staff.presence.top.staff') }}</small>
              </td>
              <td>{{ fmtMinutes(r.online_minutes) }}</td>
              <td>{{ fmtMinutes(r.board_minutes) }}</td>
              <td>{{ fmtNum(r.ai_requests) }}</td>
              <td>{{ fmtNum(r.ai_month) }}</td>
              <td>{{ fmtBytes(r.storage_bytes) }}</td>
              <td>{{ fmtNum(r.boards) }}</td>
              <td>{{ fmtNum(r.replays) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="pu__note">{{ t('staff.presence.top.aiNote') }}</p>
      </div>
      <p v-if="!topFailed && !top" class="pu__note">{{ t('staff.presence.loading') }}</p>
    </div>

    <!-- Що цінне -->
    <div class="pu__card">
      <h3>{{ t('staff.presence.features.title') }}</h3>
      <p v-if="featuresFailed" class="pu__error" role="alert">{{ t('staff.presence.loadFailed') }}</p>
      <template v-else-if="features">
        <p v-if="!features.aggregation_enabled" class="pu__warn">{{ t('staff.presence.features.aggregationDisabled') }}</p>
        <p v-else-if="opsLogStale" class="pu__warn">{{ t('staff.presence.features.opsLogStale') }}</p>
        <div class="pu__cols">
          <div>
            <h4>{{ t('staff.presence.features.objects') }}</h4>
            <p v-if="!features.objects.length" class="pu__note">{{ t('staff.presence.features.noObjects') }}</p>
            <ul class="pu__bars">
              <li v-for="o in features.objects" :key="o.object_type">
                <span class="pu__bar-label">{{ objectLabel(o.object_type) }}</span>
                <span class="pu__bar"><span :style="{ width: barWidth(o.total, maxObjects) }" /></span>
                <span class="pu__bar-num">{{ o.total }} · {{ t('staff.presence.features.people', { n: o.users }) }}</span>
              </li>
            </ul>
            <p v-if="features.objects_until" class="pu__note">
              {{ t('staff.presence.features.until', { date: fmtDate(features.objects_until) }) }}
            </p>
          </div>
          <div>
            <h4>{{ t('staff.presence.features.tools') }}</h4>
            <p v-if="!features.integralyk_tools.length" class="pu__note">{{ t('staff.presence.features.noTools') }}</p>
            <ul class="pu__bars">
              <li v-for="tool in features.integralyk_tools" :key="tool.tool">
                <span class="pu__bar-label mono">{{ tool.tool || t('staff.presence.features.noTool') }}</span>
                <span class="pu__bar"><span :style="{ width: barWidth(tool.total, maxTools) }" /></span>
                <span class="pu__bar-num">{{ tool.total }} · {{ t('staff.presence.features.people', { n: tool.users }) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
      <p v-else class="pu__note">{{ t('staff.presence.loading') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * «Присутність і споживання» на сторінці аналітики staff (2026-09-26).
 * Власник: графік присутності; хто найбільше споживає; що найцінніше для людей.
 * Джерела й межі — apps/analytics/services/usage.py (грошей за AI там немає).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getFeatureUsage, getPresenceTimeline, getUsageTop,
  type FeatureUsage, type PresenceTimeline, type UsageSort, type UsageTop,
} from '@/modules/staff/api/staffPresenceApi'
import { activeLocale } from '@/utils/i18nDate'

const PERIODS = [1, 7, 30, 90] as const
const SORTS: UsageSort[] = ['online_minutes', 'board_minutes', 'ai_requests', 'ai_month', 'storage_bytes', 'boards', 'replays']
const OPS_LOG_STALE_MS = 2 * 24 * 3600 * 1000

const { t, te } = useI18n()
const days = ref<number>(7)
const sort = ref<UsageSort>('online_minutes')
const timeline = ref<PresenceTimeline | null>(null)
const top = ref<UsageTop | null>(null)
const features = ref<FeatureUsage | null>(null)
const timelineFailed = ref(false)
const topFailed = ref(false)
const featuresFailed = ref(false)
const chartEl = ref<HTMLCanvasElement | null>(null)
let chart: any = null
let ChartJS: any = null
let alive = true
// Номер останнього запиту кожного блоку: повільна відповідь за 90 днів не має
// перезаписати швидку за тиждень, коли кнопку вже перемкнули (рев'ю 2026-09-26).
const seq = { timeline: 0, top: 0, features: 0 }

const maxObjects = computed(() => Math.max(1, ...(features.value?.objects ?? []).map(o => o.total)))
const maxTools = computed(() => Math.max(1, ...(features.value?.integralyk_tools ?? []).map(o => o.total)))
const maxHeat = computed(() => Math.max(0, ...(timeline.value?.heatmap ?? []).flat().map(v => v ?? 0)))
const opsLogStale = computed(() => {
  const last = features.value?.ops_log_last_write
  return !last || Date.now() - new Date(last).getTime() > OPS_LOG_STALE_MS
})

function objectLabel(type: string): string {
  const key = `staff.presence.objects.${type}`
  return te(key) ? t(key) : type
}

function fmtNum(n: number): string {
  return n ? n.toLocaleString(activeLocale()) : '0'
}

function heatLabel(day: number, hour: number, v: number | null): string {
  return t('staff.presence.heatmap.cell', {
    day: t(`staff.presence.weekdays.${day}`), hour, value: v === null ? '—' : v.toLocaleString(activeLocale()),
  })
}

function barWidth(value: number, max: number): string {
  return `${Math.max(2, Math.round((value / max) * 100))}%`
}

function heatColor(v: number | null): string {
  if (v === null) return 'var(--surface-card-muted, #f1f5f9)'
  if (maxHeat.value <= 0) return 'rgba(13, 148, 136, 0.08)'
  return `rgba(13, 148, 136, ${(0.12 + 0.88 * (v / maxHeat.value)).toFixed(2)})`
}

function fmtMinutes(min: number): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? t('staff.presence.hoursMinutes', { h, m }) : t('staff.presence.minutes', { m })
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.1) return t('staff.presence.units.tiny')
  const one = (n: number) => n.toLocaleString(activeLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return mb >= 1024 ? t('staff.presence.units.gb', { n: one(mb / 1024) }) : t('staff.presence.units.mb', { n: one(mb) })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtPoint(iso: string, bucket: string): string {
  const d = new Date(iso)
  if (bucket === 'sample') return d.toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' })
  if (bucket === 'day') return d.toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short' })
  return d.toLocaleString(activeLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function renderChart(): Promise<void> {
  await nextTick()
  // Порожній період — прибрати графік попереднього, а не лишати його під новою кнопкою.
  if (!timeline.value?.points.length) {
    chart?.destroy()
    chart = null
    return
  }
  if (!ChartJS) {
    const mod = await import('chart.js')
    ChartJS = mod.Chart
    ChartJS.register(...mod.registerables)
  }
  // Після await сторінку могли закрити або період — змінити.
  if (!alive || !chartEl.value || !timeline.value?.points.length) return
  chart?.destroy()
  const pts = timeline.value.points
  const bucket = timeline.value.bucket
  chart = new ChartJS(chartEl.value, {
    type: 'line',
    data: {
      labels: pts.map(p => fmtPoint(p.t, bucket)),
      datasets: [
        { label: t('staff.presence.timeline.people'), data: pts.map(p => p.total),
          borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.12)', fill: true, tension: 0.25, pointRadius: 0 },
        { label: t('staff.presence.timeline.onBoards'), data: pts.map(p => p.on_boards),
          borderColor: '#6366f1', backgroundColor: 'transparent', tension: 0.25, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: 'bottom' } },
    },
  })
}

async function loadTimeline(): Promise<void> {
  const my = ++seq.timeline
  try {
    const res = await getPresenceTimeline(days.value)
    if (my !== seq.timeline || !alive) return
    timeline.value = res
    timelineFailed.value = false
    await renderChart()
  } catch (e) {
    if (my !== seq.timeline || !alive) return
    console.error('[staff] presence timeline load failed', e)
    timelineFailed.value = true
  }
}

async function loadTop(): Promise<void> {
  const my = ++seq.top
  try {
    const res = await getUsageTop(days.value, sort.value)
    if (my !== seq.top || !alive) return
    top.value = res
    topFailed.value = false
  } catch (e) {
    if (my !== seq.top || !alive) return
    console.error('[staff] usage top load failed', e)
    topFailed.value = true
  }
}

async function loadFeatures(): Promise<void> {
  const my = ++seq.features
  try {
    const res = await getFeatureUsage(days.value)
    if (my !== seq.features || !alive) return
    features.value = res
    featuresFailed.value = false
  } catch (e) {
    if (my !== seq.features || !alive) return
    console.error('[staff] feature usage load failed', e)
    featuresFailed.value = true
  }
}

function setDays(d: number): void {
  if (d === days.value) return
  days.value = d
  loadTimeline()
  loadTop()
  loadFeatures()
}

onMounted(() => {
  loadTimeline()
  loadTop()
  loadFeatures()
})
onBeforeUnmount(() => {
  alive = false
  chart?.destroy()
})
</script>

<style scoped>
.pu { display: grid; gap: 16px; margin-bottom: 24px; }
.pu__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.pu__title { margin: 0; font-size: 20px; }
.pu__periods { display: flex; gap: 4px; }
.pu__period { border: 1px solid var(--border-color, #e2e8f0); background: transparent; color: inherit; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
.pu__period--on { background: #0d9488; color: #fff; border-color: #0d9488; }
.pu__card { border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 16px; background: var(--surface-card, #fff); }
.pu__card h3 { margin: 0 0 8px; font-size: 16px; }
.pu__card h4 { margin: 16px 0 6px; font-size: 13px; }
.pu__card-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
.pu__note { margin: 4px 0; font-size: 12px; color: var(--text-secondary, #64748b); }
.pu__error { color: var(--danger, #dc2626); font-size: 14px; }
.pu__warn { color: #b45309; font-size: 13px; background: #fffbeb; border-radius: 8px; padding: 6px 10px; }
.pu__chart { position: relative; height: 240px; }
.pu__heatmap { display: grid; gap: 2px; overflow-x: auto; }
.pu__hm-row { display: grid; grid-template-columns: 28px repeat(24, minmax(14px, 1fr)); gap: 2px; align-items: center; }
.pu__hm-label, .pu__hm-hour { font-size: 10px; color: var(--text-secondary, #64748b); text-align: center; }
.pu__hm-cell { height: 16px; border-radius: 3px; }
.pu__sort { font-size: 13px; display: flex; gap: 6px; align-items: center; }
.pu__table-wrap { overflow-x: auto; }
.pu__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pu__table th, .pu__table td { padding: 6px 8px; border-bottom: 1px solid var(--border-color, #e2e8f0); text-align: right; white-space: nowrap; }
.pu__table th:first-child, .pu__table td:first-child { text-align: left; }
.pu__th--on { color: #0d9488; }
.pu__role, .pu__staff { margin-left: 6px; color: var(--text-secondary, #64748b); }
.pu__staff { color: #b45309; }
.pu__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.pu__bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.pu__bars li { display: grid; grid-template-columns: 170px 1fr auto; gap: 8px; align-items: center; font-size: 13px; }
.pu__bar { height: 10px; background: var(--surface-card-muted, #f1f5f9); border-radius: 5px; overflow: hidden; }
.pu__bar > span { display: block; height: 100%; background: #0d9488; border-radius: 5px; }
.pu__bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pu__bar-num { color: var(--text-secondary, #64748b); font-size: 12px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
