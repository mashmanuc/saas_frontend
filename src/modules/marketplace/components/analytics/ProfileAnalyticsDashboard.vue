<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { telemetry } from '@/services/telemetry'

export interface ProfileAnalytics {
  profileViews: {
    daily: number
    weekly: number
    total: number
  }
  inquiryConversion: {
    views: number
    inquiries: number
    rate: number
  }
  responseRate: number
  averageRating: number
  featuredSpend?: number
  viewsOverTime: Array<{ date: string; views: number }>
  topSubjects: Array<{ subject: string; demand: number }>
  zeroResultQueries: Array<{ query: string; count: number }>
}

const { t } = useI18n()

const analytics = ref<ProfileAnalytics | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const dateRange = ref<'7d' | '30d' | '90d'>('30d')

const conversionPercent = computed(() => {
  if (!analytics.value) return 0
  return Math.round(analytics.value.inquiryConversion.rate * 100)
})

onMounted(async () => {
  await loadAnalytics()
})

async function loadAnalytics() {
  isLoading.value = true
  error.value = null
  
  try {
    // Mock API call - replace with actual analytics endpoint
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    analytics.value = {
      profileViews: {
        daily: 45,
        weekly: 287,
        total: 1523
      },
      inquiryConversion: {
        views: 287,
        inquiries: 23,
        rate: 0.08
      },
      responseRate: 92,
      averageRating: 4.8,
      viewsOverTime: generateMockViewsData(),
      topSubjects: [
        { subject: 'Mathematics', demand: 45 },
        { subject: 'Physics', demand: 32 },
        { subject: 'Chemistry', demand: 18 }
      ],
      zeroResultQueries: [
        { query: 'advanced calculus tutor', count: 12 },
        { query: 'organic chemistry online', count: 8 }
      ]
    }
    
    telemetry.trigger('marketplace_analytics_viewed', {
      date_range: dateRange.value
    })
  } catch (err) {
    error.value = t('marketplace.analytics.loadError')
    console.error('[ProfileAnalyticsDashboard] Load error:', err)
  } finally {
    isLoading.value = false
  }
}

function generateMockViewsData() {
  const days = dateRange.value === '7d' ? 7 : dateRange.value === '30d' ? 30 : 90
  const data = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(Math.random() * 50) + 10
    })
  }
  
  return data
}

async function handleDateRangeChange(range: '7d' | '30d' | '90d') {
  dateRange.value = range
  await loadAnalytics()
}

function exportCSV() {
  if (!analytics.value) return
  
  const csvContent = [
    ['Metric', 'Value'],
    ['Daily Views', analytics.value.profileViews.daily],
    ['Weekly Views', analytics.value.profileViews.weekly],
    ['Total Views', analytics.value.profileViews.total],
    ['Inquiry Conversion Rate', `${conversionPercent.value}%`],
    ['Response Rate', `${analytics.value.responseRate}%`],
    ['Average Rating', analytics.value.averageRating]
  ].map(row => row.join(',')).join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `profile-analytics-${dateRange.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
  
  telemetry.trigger('marketplace_analytics_exported', {
    date_range: dateRange.value
  })
}
</script>

<template>
  <div class="analytics-dashboard" data-test="profile-analytics-dashboard">
    <div class="dashboard-header">
      <h2>{{ t('marketplace.analytics.title') }}</h2>
      <div class="header-actions">
        <div class="date-range-selector">
          <button
            v-for="range in ['7d', '30d', '90d']"
            :key="range"
            class="range-btn"
            :class="{ active: dateRange === range }"
            @click="handleDateRangeChange(range as any)"
          >
            {{ t(`marketplace.analytics.range.${range}`) }}
          </button>
        </div>
        <button class="btn btn-secondary" @click="exportCSV" :disabled="!analytics">
          {{ t('marketplace.analytics.exportCSV') }}
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="isLoading" />

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadAnalytics">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-else-if="analytics" class="analytics-content">
      <!-- Key Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">{{ t('marketplace.analytics.profileViews.daily') }}</div>
          <div class="metric-value">{{ analytics.profileViews.daily }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">{{ t('marketplace.analytics.profileViews.weekly') }}</div>
          <div class="metric-value">{{ analytics.profileViews.weekly }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">{{ t('marketplace.analytics.inquiryConversion') }}</div>
          <div class="metric-value">{{ conversionPercent }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">{{ t('marketplace.analytics.responseRate') }}</div>
          <div class="metric-value">{{ analytics.responseRate }}%</div>
        </div>
      </div>

      <!-- Views Chart -->
      <div class="chart-section">
        <h3>{{ t('marketplace.analytics.viewsOverTime') }}</h3>
        <div class="simple-chart">
          <div
            v-for="(point, index) in analytics.viewsOverTime"
            :key="index"
            class="chart-bar"
            :style="{ height: `${(point.views / 60) * 100}%` }"
            :title="`${point.date}: ${point.views} views`"
          />
        </div>
      </div>

      <!-- Top Subjects -->
      <div class="subjects-section">
        <h3>{{ t('marketplace.analytics.topSubjects') }}</h3>
        <div class="subjects-list">
          <div v-for="subject in analytics.topSubjects" :key="subject.subject" class="subject-item">
            <span class="subject-name">{{ subject.subject }}</span>
            <div class="subject-bar-container">
              <div class="subject-bar" :style="{ width: `${subject.demand}%` }" />
            </div>
            <span class="subject-value">{{ subject.demand }}</span>
          </div>
        </div>
      </div>

      <!-- Zero Result Queries -->
      <div v-if="analytics.zeroResultQueries.length > 0" class="zero-results-section">
        <h3>{{ t('marketplace.analytics.zeroResults.title') }}</h3>
        <p class="section-description">{{ t('marketplace.analytics.zeroResults.description') }}</p>
        <div class="queries-list">
          <div v-for="query in analytics.zeroResultQueries" :key="query.query" class="query-item">
            <span class="query-text">{{ query.query }}</span>
            <span class="query-count">{{ query.count }} {{ t('marketplace.analytics.zeroResults.searches') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-dashboard {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.dashboard-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.date-range-selector {
  display: flex;
  gap: 0.5rem;
  background: var(--surface-hover);
  padding: 0.25rem;
  border-radius: var(--radius-md);
}

.range-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.range-btn:hover {
  color: var(--text-primary);
}

.range-btn.active {
  background: var(--accent);
  color: white;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: var(--surface-hover);
  padding: 1.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.metric-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-section,
.subjects-section,
.zero-results-section {
  margin-bottom: 2rem;
}

.chart-section h3,
.subjects-section h3,
.zero-results-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.simple-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 200px;
  padding: 1rem;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
}

.chart-bar {
  flex: 1;
  background: var(--accent);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: all 0.2s;
  cursor: pointer;
}

.chart-bar:hover {
  background: color-mix(in srgb, var(--accent) 80%, black);
}

.subjects-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.subject-item {
  display: grid;
  grid-template-columns: 150px 1fr 60px;
  align-items: center;
  gap: 1rem;
}

.subject-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.subject-bar-container {
  height: 24px;
  background: var(--surface-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.subject-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

.subject-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
}

.section-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.queries-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.query-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.query-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.query-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.error-state {
  text-align: center;
  padding: 3rem 1rem;
}

.error-state p {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .subject-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .subject-value {
    text-align: left;
  }
}
</style>
