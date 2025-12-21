<template>
  <div class="telemetry-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-controls">
        <select v-model="selectedTimeRange" class="time-range-select">
          <option value="1h">{{ $t('operator.telemetry.last1h') }}</option>
          <option value="6h">{{ $t('operator.telemetry.last6h') }}</option>
          <option value="24h">{{ $t('operator.telemetry.last24h') }}</option>
          <option value="7d">{{ $t('operator.telemetry.last7d') }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="chart-loading">
      <Loader2 :size="24" class="animate-spin" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="chart-error">
      <AlertCircle :size="20" />
      <p>{{ error }}</p>
    </div>

    <div v-else class="chart-container">
      <canvas ref="chartCanvas"></canvas>
      
      <div v-if="hoveredPoint" class="chart-tooltip" :style="tooltipStyle">
        <div class="tooltip-time">{{ formatTime(hoveredPoint.timestamp) }}</div>
        <div class="tooltip-value">{{ formatValue(hoveredPoint.value) }}</div>
      </div>
    </div>

    <div v-if="meta" class="chart-meta">
      <div class="meta-item">
        <span class="meta-label">{{ $t('operator.telemetry.min') }}:</span>
        <span class="meta-value">{{ formatValue(meta.min) }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ $t('operator.telemetry.max') }}:</span>
        <span class="meta-value">{{ formatValue(meta.max) }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ $t('operator.telemetry.p95') }}:</span>
        <span class="meta-value">{{ formatValue(meta.p95) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  domain: {
    type: String,
    required: true,
  },
  metric: {
    type: String,
    required: true,
  },
  onDataPointClick: {
    type: Function,
    default: null,
  },
})

const { t } = useI18n()

const chartCanvas = ref(null)
const loading = ref(false)
const error = ref('')
const series = ref([])
const meta = ref(null)
const selectedTimeRange = ref('24h')
const hoveredPoint = ref(null)
const tooltipStyle = ref({})

let chart = null

const formatValue = (value) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toFixed(2)
  }
  return String(value)
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

async function loadData() {
  loading.value = true
  error.value = ''
  
  try {
    // Mock data - replace with actual API call
    const mockData = generateMockData()
    series.value = mockData.series
    meta.value = mockData.meta
    
    renderChart()
  } catch (err) {
    error.value = err?.message || t('operator.telemetry.loadError')
  } finally {
    loading.value = false
  }
}

function generateMockData() {
  const now = Date.now()
  const points = 50
  const interval = 60000 // 1 minute
  
  const data = []
  for (let i = 0; i < points; i++) {
    data.push({
      ts: now - (points - i) * interval,
      value: Math.random() * 100 + Math.sin(i / 5) * 20,
    })
  }
  
  const values = data.map(d => d.value)
  return {
    series: data,
    meta: {
      min: Math.min(...values),
      max: Math.max(...values),
      p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
    },
  }
}

function renderChart() {
  if (!chartCanvas.value || !series.value.length) return
  
  const ctx = chartCanvas.value.getContext('2d')
  const canvas = chartCanvas.value
  const width = canvas.width = canvas.offsetWidth * 2
  const height = canvas.height = canvas.offsetHeight * 2
  
  ctx.scale(2, 2)
  ctx.clearRect(0, 0, width, height)
  
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }
  const chartWidth = width / 2 - padding.left - padding.right
  const chartHeight = height / 2 - padding.top - padding.bottom
  
  const values = series.value.map(d => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1
  
  // Draw grid
  ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartWidth, y)
    ctx.stroke()
  }
  
  // Draw line
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  series.value.forEach((point, index) => {
    const x = padding.left + (chartWidth / (series.value.length - 1)) * index
    const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // Draw points
  ctx.fillStyle = '#3b82f6'
  series.value.forEach((point, index) => {
    const x = padding.left + (chartWidth / (series.value.length - 1)) * index
    const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

function handleCanvasClick(event) {
  if (!props.onDataPointClick) return
  
  const rect = chartCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Find nearest point
  const padding = { left: 25 }
  const chartWidth = rect.width - 70
  
  let nearestIndex = -1
  let nearestDistance = Infinity
  
  series.value.forEach((point, index) => {
    const pointX = padding.left + (chartWidth / (series.value.length - 1)) * index
    const distance = Math.abs(x - pointX)
    
    if (distance < nearestDistance && distance < 10) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  
  if (nearestIndex >= 0) {
    props.onDataPointClick(series.value[nearestIndex])
  }
}

watch(selectedTimeRange, () => {
  loadData()
})

onMounted(() => {
  loadData()
  if (chartCanvas.value) {
    chartCanvas.value.addEventListener('click', handleCanvasClick)
  }
})

onUnmounted(() => {
  if (chartCanvas.value) {
    chartCanvas.value.removeEventListener('click', handleCanvasClick)
  }
})
</script>

<style scoped>
.telemetry-chart {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.chart-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.chart-controls {
  display: flex;
  gap: 0.5rem;
}

.time-range-select {
  padding: 0.375rem 0.75rem;
  background: var(--surface-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
}

.chart-loading,
.chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.chart-error {
  color: var(--danger, #dc2626);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.chart-container {
  position: relative;
  width: 100%;
  height: 250px;
}

canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.chart-tooltip {
  position: absolute;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  padding: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  z-index: 10;
}

.tooltip-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.tooltip-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-meta {
  display: flex;
  gap: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.meta-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.meta-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-value {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
