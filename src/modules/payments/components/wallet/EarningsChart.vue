<script setup lang="ts">
// F20: Earnings Chart Component
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { TrendingUp } from 'lucide-vue-next'
import type { EarningsAnalytics } from '../../api/payments'

const props = defineProps<{
  analytics: EarningsAnalytics
  period: 'week' | 'month' | 'year'
}>()

const emit = defineEmits<{
  'update:period': [value: 'week' | 'month' | 'year']
}>()

const chartRef = ref<HTMLCanvasElement | null>(null)
let chart: any = null

const periodOptions = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

async function renderChart() {
  if (!chartRef.value || !props.analytics.by_period.length) return

  try {
    const { Chart, registerables } = await import('chart.js')
    Chart.register(...registerables)

    if (chart) {
      chart.destroy()
    }

    const ctx = chartRef.value.getContext('2d')
    if (!ctx) return

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: props.analytics.by_period.map((p) => p.label),
        datasets: [
          {
            label: 'Earnings',
            data: props.analytics.by_period.map((p) => p.amount / 100),
            backgroundColor: '#3b82f6',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.raw as number * 100),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency((value as number) * 100),
            },
          },
        },
      },
    })
  } catch (e) {
    console.error('Failed to render chart:', e)
  }
}

onMounted(() => {
  renderChart()
})

onUnmounted(() => {
  if (chart) {
    chart.destroy()
  }
})

watch(
  () => props.analytics,
  () => {
    renderChart()
  }
)
</script>

<template>
  <div class="earnings-chart">
    <div class="chart-header">
      <h3>
        <TrendingUp :size="20" />
        Earnings Overview
      </h3>
      <select
        :value="period"
        @change="emit('update:period', ($event.target as HTMLSelectElement).value as any)"
      >
        <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="chart-container">
      <canvas ref="chartRef" />
    </div>

    <div class="chart-summary">
      <div class="summary-item">
        <span class="summary-label">Total This Period</span>
        <span class="summary-value positive">{{ formatCurrency(analytics.total) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Avg per Lesson</span>
        <span class="summary-value">{{ formatCurrency(analytics.average_per_lesson) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Lessons</span>
        <span class="summary-value">{{ analytics.lessons_count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.earnings-chart {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chart-header h3 svg {
  color: var(--color-primary, #3b82f6);
}

.chart-header select {
  padding: 6px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  background: var(--color-bg-primary, white);
}

.chart-container {
  height: 200px;
}

.chart-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.summary-label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.summary-value.positive {
  color: var(--color-success, #10b981);
}
</style>
