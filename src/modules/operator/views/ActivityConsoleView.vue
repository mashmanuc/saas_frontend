<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, AlertCircle, TrendingUp, Loader2 } from 'lucide-vue-next'
import operatorApi, { type ActivityFeedItem } from '../api/operatorApi'
import Button from '@/ui/Button.vue'

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const items = ref<ActivityFeedItem[]>([])

const domainFilter = ref('')
const severityFilter = ref('')

const domains = ['auth', 'marketplace', 'classroom']
const severities = ['info', 'warning', 'critical']

const selectedDataPoint = ref<{ ts: number; value: number } | null>(null)

const filteredItems = computed(() => {
  if (!selectedDataPoint.value) return items.value
  
  // Filter items by timestamp range around selected data point
  const pointTime = selectedDataPoint.value.ts
  const timeWindow = 300000 // 5 minutes
  
  return items.value.filter(item => {
    const itemTime = item.ts
    return Math.abs(itemTime - pointTime) <= timeWindow
  })
})

function handleChartDataPointClick(dataPoint: { ts: number; value: number }) {
  selectedDataPoint.value = dataPoint
}

async function loadFeed() {
  loading.value = true
  error.value = ''
  try {
    const res = await operatorApi.getActivityFeed(
      domainFilter.value || undefined,
      severityFilter.value || undefined
    )
    items.value = res.items || []
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('operator.feed.loadError')
  } finally {
    loading.value = false
  }
}

async function executeAction(action: string, payload: Record<string, any>) {
  try {
    await operatorApi.executeAction(action, payload)
    await loadFeed()
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('operator.actions.executeError')
  }
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

function getSeverityColor(severity?: string): string {
  switch (severity) {
    case 'critical':
      return 'var(--danger, #dc2626)'
    case 'warning':
      return 'var(--warning, #f59e0b)'
    default:
      return 'var(--info, #3b82f6)'
  }
}

onMounted(() => {
  loadFeed()
})
</script>

<template>
  <div class="console-container">
    <div class="console-header">
      <div class="header-content">
        <div class="header-icon">
          <Activity :size="32" />
        </div>
        <div>
          <h1 class="header-title">{{ t('operator.console.title') }}</h1>
          <p class="header-subtitle">{{ t('operator.console.subtitle') }}</p>
        </div>
      </div>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">{{ t('operator.filters.domain') }}</label>
        <select v-model="domainFilter" class="filter-select" @change="loadFeed">
          <option value="">{{ t('operator.filters.allDomains') }}</option>
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label class="filter-label">{{ t('operator.filters.severity') }}</label>
        <select v-model="severityFilter" class="filter-select" @change="loadFeed">
          <option value="">{{ t('operator.filters.allSeverities') }}</option>
          <option v-for="s in severities" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <Button variant="primary" :disabled="loading" @click="loadFeed">
        <Loader2 v-if="loading" :size="16" class="animate-spin" />
        {{ t('operator.actions.refresh') }}
      </Button>
    </div>

    <div v-if="error" class="error-banner">
      <AlertCircle :size="18" />
      <p>{{ error }}</p>
    </div>

    <div v-if="loading && items.length === 0" class="loading-state">
      <Loader2 :size="32" class="animate-spin" />
      <p>{{ t('operator.feed.loading') }}</p>
    </div>

    <div v-else-if="items.length === 0" class="empty-state">
      <Activity :size="48" />
      <p>{{ t('operator.feed.empty') }}</p>
    </div>

    <div v-else class="feed-list">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="feed-item"
        :style="{ borderLeftColor: getSeverityColor(item.severity) }"
      >
        <div class="item-header">
          <span class="item-timestamp">{{ formatTimestamp(item.ts) }}</span>
          <span v-if="item.severity" class="item-severity" :style="{ color: getSeverityColor(item.severity) }">
            {{ item.severity }}
          </span>
        </div>
        <p class="item-message">{{ item.message }}</p>
        <div v-if="item.action_link" class="item-actions">
          <Button variant="outline" size="sm">
            {{ t('operator.actions.view') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.console-header {
  padding: 1.5rem;
  background: var(--surface-card);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-color);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--primary-bg, #e0f2fe);
  color: var(--primary);
  border-radius: var(--radius-md, 8px);
}

.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.header-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0 0;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 150px;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--danger-border, #fca5a5);
}

.error-banner p {
  margin: 0;
  flex: 1;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  background: var(--surface-card);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feed-item {
  padding: 1rem;
  background: var(--surface-card);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
  border-left-width: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.item-timestamp {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.item-severity {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.item-message {
  font-size: 0.9375rem;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.5;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
