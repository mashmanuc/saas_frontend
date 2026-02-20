<template>
  <div class="tutor-analytics-view">
    <div class="header">
      <h1 class="title">{{ t('tutors.analytics.title') }}</h1>
      <p class="subtitle">{{ t('tutors.analytics.subtitle') }}</p>
    </div>

    <!-- Period selector -->
    <div class="period-selector">
      <button
        v-for="option in periodOptions"
        :key="option.value"
        :class="['period-button', { active: selectedPeriod === option.value }]"
        @click="selectPeriod(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" aria-label="Loading analytics"></div>
      <p>{{ t('tutors.analytics.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <AlertCircle class="error-icon" />
      <p class="error-message">{{ error }}</p>
      <Button variant="primary" @click="loadStats">
        {{ t('common.retry') }}
      </Button>
    </div>

    <!-- Stats content -->
    <div v-else-if="stats" class="stats-content">
      <!-- Summary cards -->
      <div class="summary-grid">
        <div class="stat-card">
          <div class="stat-label">{{ t('tutors.analytics.totalInquiries') }}</div>
          <div class="stat-value">{{ stats.summary.total_inquiries }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">{{ t('tutors.analytics.acceptanceRate') }}</div>
          <div class="stat-value">{{ formatPercent(stats.summary.acceptance_rate) }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">{{ t('tutors.analytics.responseRate') }}</div>
          <div class="stat-value">{{ formatPercent(stats.summary.response_rate) }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">{{ t('tutors.analytics.contactsSpent') }}</div>
          <div class="stat-value">{{ stats.summary.contacts_spent }}</div>
        </div>
      </div>

      <!-- Daily breakdown chart -->
      <div v-if="stats.daily_breakdown.length > 0" class="chart-section">
        <h2 class="section-title">{{ t('tutors.analytics.dailyBreakdown') }}</h2>
        <div class="daily-chart">
          <div
            v-for="day in stats.daily_breakdown"
            :key="day.date"
            class="day-bar"
            :style="{ height: `${getBarHeight(day.total)}px` }"
            :title="`${day.date}: ${day.total} inquiries`"
          >
            <div class="bar-segment accepted" :style="{ height: `${getSegmentHeight(day.accepted, day.total)}%` }"></div>
            <div class="bar-segment rejected" :style="{ height: `${getSegmentHeight(day.rejected, day.total)}%` }"></div>
            <div class="bar-segment expired" :style="{ height: `${getSegmentHeight(day.expired, day.total)}%` }"></div>
          </div>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color accepted"></span>
            <span>{{ t('tutors.analytics.accepted') }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-color rejected"></span>
            <span>{{ t('tutors.analytics.rejected') }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-color expired"></span>
            <span>{{ t('tutors.analytics.expired') }}</span>
          </div>
        </div>
      </div>

      <!-- Subject breakdown -->
      <div v-if="stats.subject_breakdown.length > 0" class="chart-section">
        <h2 class="section-title">{{ t('tutors.analytics.subjectBreakdown') }}</h2>
        <div class="subject-list">
          <div
            v-for="subject in stats.subject_breakdown"
            :key="subject.subject__name"
            class="subject-item"
          >
            <span class="subject-name">{{ subject.subject__name }}</span>
            <span class="subject-count">{{ subject.count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { getDetailedStats } from '@/api/tutorStats'
import type { DetailedStatsResponse } from '@/api/tutorStats'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const stats = ref<DetailedStatsResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedPeriod = ref(30)

const periodOptions = computed(() => [
  { value: 7, label: t('tutors.analytics.period7days') },
  { value: 30, label: t('tutors.analytics.period30days') },
  { value: 90, label: t('tutors.analytics.period90days') }
])

/**
 * Завантажити статистику
 */
async function loadStats() {
  isLoading.value = true
  error.value = null
  
  try {
    const data = await getDetailedStats(selectedPeriod.value)
    stats.value = data
    
    // Telemetry
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('tutor.analytics_viewed', {
        period: selectedPeriod.value,
        total_inquiries: data.summary.total_inquiries
      })
    }
  } catch (err: any) {
    const errorMsg = err.response?.data?.detail || err.message || t('tutors.analytics.loadError')
    error.value = errorMsg
    
    // Show toast for user-visible error
    toast.error(errorMsg)
    
    // Telemetry
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('tutor.analytics_error', {
        period: selectedPeriod.value,
        error: errorMsg
      })
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * Вибрати період
 */
function selectPeriod(period: number) {
  selectedPeriod.value = period
  loadStats()
}

/**
 * Форматувати відсоток
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Розрахувати висоту бару (max 200px)
 */
function getBarHeight(total: number): number {
  if (!stats.value) return 0
  const maxTotal = Math.max(...stats.value.daily_breakdown.map(d => d.total), 1)
  return Math.max((total / maxTotal) * 200, 10)
}

/**
 * Розрахувати висоту сегменту в барі
 */
function getSegmentHeight(count: number, total: number): number {
  if (total === 0) return 0
  return (count / total) * 100
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.tutor-analytics-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-secondary, #6b7280);
}

.period-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.period-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #d1d5db);
  background: var(--surface-card, white);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.period-button:hover {
  border-color: var(--accent, #3b82f6);
  background: var(--accent-bg, #eff6ff);
}

.period-button.active {
  background: var(--accent, #3b82f6);
  color: white;
  border-color: var(--accent, #3b82f6);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid var(--border-color, #e5e7eb);
  border-top-color: var(--accent, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.error-icon {
  width: 4rem;
  height: 4rem;
  color: var(--danger, #ef4444);
}

.error-message {
  color: var(--danger, #dc2626);
  text-align: center;
  font-size: 1.125rem;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: var(--surface-card, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.chart-section {
  background: var(--surface-card, white);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin-bottom: 1.5rem;
}

.daily-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 220px;
  padding: 1rem 0;
  overflow-x: auto;
}

.day-bar {
  flex: 1;
  min-width: 20px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px 4px 0 0;
  position: relative;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column-reverse;
}

.day-bar:hover {
  opacity: 0.8;
}

.bar-segment {
  width: 100%;
  transition: height 0.3s;
}

.bar-segment.accepted {
  background: #10b981;
}

.bar-segment.rejected {
  background: #ef4444;
}

.bar-segment.expired {
  background: #f59e0b;
}

.chart-legend {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary, #374151);
}

.legend-color {
  width: 1rem;
  height: 1rem;
  border-radius: 2px;
}

.legend-color.accepted {
  background: #10b981;
}

.legend-color.rejected {
  background: #ef4444;
}

.legend-color.expired {
  background: #f59e0b;
}

.subject-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subject-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 6px;
  transition: background 0.2s;
}

.subject-item:hover {
  background: var(--surface-hover, #f3f4f6);
}

.subject-name {
  font-weight: 500;
  color: var(--text-primary, #374151);
}

.subject-count {
  font-weight: 600;
  color: var(--text-primary, #111827);
  background: var(--surface-card, white);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}
</style>
