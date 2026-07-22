<template>
  <div class="cascade-health" data-testid="cascade-health">
    <div class="page-header">
      <div class="page-header__top">
        <h1 class="page-title">Realtime Health</h1>
        <div class="time-selector">
          <button
            v-for="h in [1, 6, 24]"
            :key="h"
            class="time-btn"
            :class="{ active: hours === h }"
            @click="hours = h"
          >
            {{ h }}h
          </button>
        </div>
      </div>
      <div class="status-banner" :class="statusClass">
        <span class="status-dot" />
        <span>{{ statusLabel }}</span>
        <span class="status-time">{{ lastUpdated }}</span>
      </div>
    </div>

    <div v-if="loading && !data" class="loading-state">
      <LoadingSpinner />
    </div>

    <div v-else-if="data" class="charts-grid">
      <!-- 1. Auth Health -->
      <Card class="chart-card">
        <div class="chart-header">
          <h3>Auth Health</h3>
          <div class="chart-stats">
            <span class="stat-ok">{{ data.metrics.auth_refresh.success }} ok</span>
            <span class="stat-fail">{{ data.metrics.auth_refresh.fail }} fail</span>
          </div>
        </div>
        <div class="chart-body">
          <div class="chart-wrap"><canvas ref="authChart" /></div>
          <div class="chart-hint">
            <p class="chart-hint__title">Що показує:</p>
            <p>% невдалих refresh токенів. Коли access token протухає, браузер автоматично запитує новий.</p>
            <p class="chart-hint__rule"><span class="dot dot--green" /> &lt; 5% — норма</p>
            <p class="chart-hint__rule"><span class="dot dot--yellow" /> 5–20% — деградація</p>
            <p class="chart-hint__rule"><span class="dot dot--red" /> &gt; 20% — cascade failure</p>
          </div>
        </div>
      </Card>

      <!-- 2. WS Reconnects -->
      <Card class="chart-card">
        <div class="chart-header">
          <h3>WS Reconnects</h3>
          <div class="chart-stats">
            <span>{{ data.metrics.ws_reconnect.total }} total</span>
            <span class="stat-muted">{{ data.metrics.ws_reconnect.unique_sessions }} sessions</span>
          </div>
        </div>
        <div class="chart-body">
          <div class="chart-wrap"><canvas ref="wsChart" /></div>
          <div class="chart-hint">
            <p class="chart-hint__title">Що показує:</p>
            <p>Спроби WebSocket перепідключення (дошка + gateway). Spike = мережева проблема або auth cascade.</p>
            <p class="chart-hint__rule"><span class="dot dot--green" /> 1 user, 3 reconnect — нормально</p>
            <p class="chart-hint__rule"><span class="dot dot--red" /> 1 user, 50+ — storm (баг)</p>
          </div>
        </div>
      </Card>

      <!-- 3. Auth Death Events -->
      <Card class="chart-card">
        <div class="chart-header">
          <h3>Auth Death</h3>
          <span :class="data.metrics.auth_death.count > 0 ? 'stat-fail' : 'stat-ok'">
            {{ data.metrics.auth_death.count }}
          </span>
        </div>
        <div class="chart-body">
          <div class="chart-wrap"><canvas ref="deathChart" /></div>
          <div class="chart-hint">
            <p class="chart-hint__title">Що показує:</p>
            <p>Кількість спрацювань onAuthDeath() — повне відключення всіх підсистем (WS, recorder, API).</p>
            <p class="chart-hint__rule"><span class="dot dot--green" /> 0 — ідеально</p>
            <p class="chart-hint__rule"><span class="dot dot--red" /> &gt; 3/хв — системна проблема</p>
          </div>
        </div>
      </Card>

      <!-- 4. Recording Failures -->
      <Card class="chart-card">
        <div class="chart-header">
          <h3>Recording Failures</h3>
          <div class="chart-stats">
            <span>{{ data.metrics.recording_stop_failed.count }} failed</span>
            <span class="stat-muted">{{ data.metrics.recording_stop_failed.fallback_used }} fallback</span>
          </div>
        </div>
        <div class="chart-body">
          <div class="chart-wrap"><canvas ref="recFailChart" /></div>
          <div class="chart-hint">
            <p class="chart-hint__title">Що показує:</p>
            <p>Невдалі спроби зупинити запис уроку. Причини: CORS, auth dead, мережа. Fallback = UI зупинив локально.</p>
            <p class="chart-hint__rule"><span class="dot dot--green" /> 0 — ідеально</p>
            <p class="chart-hint__rule"><span class="dot dot--yellow" /> fallback росте — CORS/auth issue</p>
          </div>
        </div>
      </Card>

      <!-- 5. Auto-Stop (TTL) -->
      <Card class="chart-card chart-card--full">
        <div class="chart-header">
          <h3>Auto-Stop (TTL)</h3>
          <span :class="data.metrics.recording_auto_stopped.count > 2 ? 'stat-fail' : 'stat-ok'">
            {{ data.metrics.recording_auto_stopped.count }}
          </span>
        </div>
        <div class="chart-body">
          <div class="chart-wrap"><canvas ref="ttlChart" /></div>
          <div class="chart-hint">
            <p class="chart-hint__title">Що показує:</p>
            <p>Записи автоматично зупинені сервером (TTL 2 години). Це safety net — значить stop-recording не дійшов до бекенду.</p>
            <p class="chart-hint__rule"><span class="dot dot--green" /> 0–2 — норма</p>
            <p class="chart-hint__rule"><span class="dot dot--red" /> spike — zombie recordings</p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { getCascadeMetrics, type CascadeMetrics } from '../api/staffHealthApi'
import { activeLocale } from '@/utils/i18nDate'

const hours = ref(1)
const data = ref<CascadeMetrics | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Chart refs
const authChart = ref<HTMLCanvasElement | null>(null)
const wsChart = ref<HTMLCanvasElement | null>(null)
const deathChart = ref<HTMLCanvasElement | null>(null)
const recFailChart = ref<HTMLCanvasElement | null>(null)
const ttlChart = ref<HTMLCanvasElement | null>(null)

// Chart.js instances
let charts: any[] = []

// Request cancellation
let currentRequestId = 0

// Status
const statusClass = computed(() => {
  if (!data.value) return ''
  return `status-${data.value.status}`
})
const statusLabel = computed(() => {
  if (!data.value) return 'Loading...'
  const labels: Record<string, string> = {
    healthy: 'System Healthy',
    degraded: 'Issues Detected',
    critical: 'Critical Issues',
  }
  return labels[data.value.status] || data.value.status
})
const lastUpdated = computed(() => {
  if (!data.value) return ''
  return new Date(data.value.timestamp).toLocaleTimeString(activeLocale())
})

import { computed } from 'vue'

async function fetchData() {
  const id = ++currentRequestId
  loading.value = true
  try {
    const result = await getCascadeMetrics(hours.value)
    if (id !== currentRequestId) return // stale response
    data.value = result
    error.value = null
    await nextTick()
    renderCharts()
  } catch (e) {
    if (id !== currentRequestId) return
    error.value = String(e)
  } finally {
    if (id === currentRequestId) loading.value = false
  }
}

// ── Chart.js rendering ──

let ChartJS: any = null

async function ensureChartJS() {
  if (ChartJS) return
  const mod = await import('chart.js')
  ChartJS = mod.Chart
  ChartJS.register(...mod.registerables)
}

function destroyCharts() {
  charts.forEach(c => c?.destroy())
  charts = []
}

function formatTs(ts: number, bucketSec: number): string {
  const d = new Date(ts * 1000)
  if (bucketSec <= 60) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (bucketSec <= 300) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function renderCharts() {
  await ensureChartJS()
  destroyCharts()
  if (!data.value) return

  const bucket = data.value.bucket_seconds
  const s = data.value.series

  // Common options
  const baseOpts = (yLabel = '') => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: { display: true, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
      y: { beginAtZero: true, title: yLabel ? { display: true, text: yLabel, font: { size: 10 } } : undefined },
    },
    plugins: { legend: { display: false } },
  })

  // 1. Auth fail rate
  if (authChart.value) {
    charts.push(new ChartJS(authChart.value, {
      type: 'line',
      data: {
        labels: s.auth_refresh_fail_rate.map(p => formatTs(p.ts, bucket)),
        datasets: [{
          label: 'Fail Rate',
          data: s.auth_refresh_fail_rate.map(p => +(p.value * 100).toFixed(1)),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        }],
      },
      options: baseOpts('Fail %'),
    }))
  }

  // 2. WS reconnects
  if (wsChart.value) {
    charts.push(new ChartJS(wsChart.value, {
      type: 'bar',
      data: {
        labels: s.ws_reconnect.map(p => formatTs(p.ts, bucket)),
        datasets: [{
          label: 'Reconnects',
          data: s.ws_reconnect.map(p => p.value),
          backgroundColor: '#f59e0b',
        }],
      },
      options: baseOpts('Count'),
    }))
  }

  // 3. Auth death
  if (deathChart.value) {
    charts.push(new ChartJS(deathChart.value, {
      type: 'bar',
      data: {
        labels: s.auth_death.map(p => formatTs(p.ts, bucket)),
        datasets: [{
          label: 'Death Events',
          data: s.auth_death.map(p => p.value),
          backgroundColor: '#ef4444',
        }],
      },
      options: baseOpts(),
    }))
  }

  // 4. Recording failures
  if (recFailChart.value) {
    charts.push(new ChartJS(recFailChart.value, {
      type: 'bar',
      data: {
        labels: s.recording_failures.map(p => formatTs(p.ts, bucket)),
        datasets: [{
          label: 'Failures',
          data: s.recording_failures.map(p => p.value),
          backgroundColor: '#f97316',
        }],
      },
      options: baseOpts(),
    }))
  }

  // 5. TTL auto-stop (single number, minimal chart)
  if (ttlChart.value) {
    const ttlData = s.recording_auto_stopped
    charts.push(new ChartJS(ttlChart.value, {
      type: 'bar',
      data: {
        labels: ttlData.length ? ttlData.map(p => formatTs(p.ts, bucket)) : ['No data'],
        datasets: [{
          label: 'Auto-stopped',
          data: ttlData.length ? ttlData.map(p => p.value) : [0],
          backgroundColor: '#eab308',
        }],
      },
      options: baseOpts(),
    }))
  }
}

// ── Lifecycle ──

let refreshTimer: ReturnType<typeof setInterval> | null = null

watch(hours, () => { fetchData() })

onMounted(() => {
  fetchData()
  refreshTimer = setInterval(fetchData, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  destroyCharts()
})
</script>

<style scoped>
.cascade-health {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.page-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.time-selector {
  display: flex;
  gap: var(--space-1);
}

.time-btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.time-btn.active {
  background: var(--bg-brand);
  color: #fff;
  border-color: var(--bg-brand);
}

.status-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
  margin-bottom: var(--space-4);
}

.status-banner.status-healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-banner.status-degraded {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.status-banner.status-critical {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
}

.status-time {
  margin-left: auto;
  font-weight: 400;
  font-size: 0.8rem;
  opacity: 0.7;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-10);
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.chart-card--full {
  grid-column: 1 / -1;
}

.chart-body {
  display: flex;
  gap: var(--space-3);
}

.chart-wrap {
  position: relative;
  height: 160px;
  flex: 1;
  min-width: 0;
}

.chart-wrap--short {
  height: 100px;
}

.chart-hint {
  width: 180px;
  flex-shrink: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-secondary);
  border-left: 1px solid var(--border-secondary);
  padding-left: var(--space-3);
}

.chart-hint p {
  margin: 0 0 4px;
}

.chart-hint__title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px !important;
}

.chart-hint__rule {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--green { background: #22c55e; }
.dot--yellow { background: #eab308; }
.dot--red { background: #ef4444; }

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.chart-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.chart-stats {
  display: flex;
  gap: var(--space-2);
  font-size: 0.8rem;
}

.stat-ok { color: #16a34a; font-weight: 600; }
.stat-fail { color: #dc2626; font-weight: 600; }
.stat-muted { color: var(--text-tertiary); }

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
