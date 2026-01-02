<template>
  <div class="analytics-dashboard" data-testid="analytics-dashboard">
    <div class="dashboard-header">
      <h3 class="dashboard-title">{{ t('calendar.analytics.title') }}</h3>
      <div class="date-range-selector">
        <select v-model="selectedPeriod" @change="handlePeriodChange" class="period-select">
          <option value="today">{{ t('calendar.analytics.period.today') }}</option>
          <option value="week">{{ t('calendar.analytics.period.week') }}</option>
          <option value="month">{{ t('calendar.analytics.period.month') }}</option>
          <option value="custom">{{ t('calendar.analytics.period.custom') }}</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <Loader class="spinner" :size="32" />
      <p>{{ t('calendar.analytics.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <AlertCircle :size="32" class="error-icon" />
      <p>{{ error }}</p>
      <button @click="loadAnalytics" class="btn-retry">{{ t('common.retry') }}</button>
    </div>

    <div v-else class="analytics-content">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="stat-card">
          <div class="stat-icon">
            <Calendar :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ t('calendar.analytics.totalSlots') }}</div>
            <div class="stat-value">{{ analytics.totalSlots }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon success">
            <CheckCircle :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ t('calendar.analytics.availableSlots') }}</div>
            <div class="stat-value">{{ analytics.availableSlots }}</div>
            <div class="stat-change positive">{{ analytics.availablePercentage }}%</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon warning">
            <BookOpen :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ t('calendar.analytics.bookedSlots') }}</div>
            <div class="stat-value">{{ analytics.bookedSlots }}</div>
            <div class="stat-change">{{ analytics.bookedPercentage }}%</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon error">
            <XCircle :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ t('calendar.analytics.blockedSlots') }}</div>
            <div class="stat-value">{{ analytics.blockedSlots }}</div>
            <div class="stat-change">{{ analytics.blockedPercentage }}%</div>
          </div>
        </div>
      </div>

      <!-- Edit Operations Stats -->
      <div class="operations-section">
        <h4 class="section-title">{{ t('calendar.analytics.editOperations') }}</h4>
        <div class="operations-grid">
          <div class="operation-stat">
            <Edit :size="20" />
            <div class="operation-content">
              <div class="operation-label">{{ t('calendar.analytics.totalEdits') }}</div>
              <div class="operation-value">{{ analytics.operations.totalEdits }}</div>
            </div>
          </div>

          <div class="operation-stat">
            <CheckCircle :size="20" />
            <div class="operation-content">
              <div class="operation-label">{{ t('calendar.analytics.successfulEdits') }}</div>
              <div class="operation-value">{{ analytics.operations.successfulEdits }}</div>
            </div>
          </div>

          <div class="operation-stat">
            <AlertTriangle :size="20" />
            <div class="operation-content">
              <div class="operation-label">{{ t('calendar.analytics.failedEdits') }}</div>
              <div class="operation-value">{{ analytics.operations.failedEdits }}</div>
            </div>
          </div>

          <div class="operation-stat">
            <Clock :size="20" />
            <div class="operation-content">
              <div class="operation-label">{{ t('calendar.analytics.avgDuration') }}</div>
              <div class="operation-value">{{ analytics.operations.avgDuration }}ms</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Strategy Distribution -->
      <div class="strategy-section">
        <h4 class="section-title">{{ t('calendar.analytics.strategyDistribution') }}</h4>
        <div class="strategy-bars">
          <div 
            v-for="(strategy, index) in analytics.strategies" 
            :key="index"
            class="strategy-bar"
          >
            <div class="strategy-label">{{ t(`availability.slotEditor.strategies.${strategy.name}.title`) }}</div>
            <div class="strategy-progress">
              <div 
                class="strategy-fill" 
                :style="{ width: `${strategy.percentage}%` }"
              />
            </div>
            <div class="strategy-count">{{ strategy.count }} ({{ strategy.percentage }}%)</div>
          </div>
        </div>
      </div>

      <!-- Conflict Analysis -->
      <div class="conflicts-section">
        <h4 class="section-title">{{ t('calendar.analytics.conflictAnalysis') }}</h4>
        <div class="conflicts-grid">
          <div class="conflict-stat">
            <AlertCircle :size="20" />
            <div class="conflict-content">
              <div class="conflict-label">{{ t('calendar.analytics.totalConflicts') }}</div>
              <div class="conflict-value">{{ analytics.conflicts.total }}</div>
            </div>
          </div>

          <div class="conflict-stat">
            <BookOpen :size="20" />
            <div class="conflict-content">
              <div class="conflict-label">{{ t('availability.conflict.types.bookedOverlap') }}</div>
              <div class="conflict-value">{{ analytics.conflicts.bookedOverlap }}</div>
            </div>
          </div>

          <div class="conflict-stat">
            <Clock :size="20" />
            <div class="conflict-content">
              <div class="conflict-label">{{ t('availability.conflict.types.slotOverlap') }}</div>
              <div class="conflict-value">{{ analytics.conflicts.slotOverlap }}</div>
            </div>
          </div>

          <div class="conflict-stat">
            <Calendar :size="20" />
            <div class="conflict-content">
              <div class="conflict-label">{{ t('availability.conflict.types.templateOverlap') }}</div>
              <div class="conflict-value">{{ analytics.conflicts.templateOverlap }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="activity-section">
        <h4 class="section-title">{{ t('calendar.analytics.recentActivity') }}</h4>
        <div class="activity-list">
          <div 
            v-for="(activity, index) in analytics.recentActivity" 
            :key="index"
            class="activity-item"
          >
            <div class="activity-icon" :class="activity.type">
              <component :is="getActivityIcon(activity.type)" :size="16" />
            </div>
            <div class="activity-content">
              <div class="activity-description">{{ activity.description }}</div>
              <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
            </div>
            <div class="activity-status" :class="activity.status">
              {{ t(`calendar.analytics.status.${activity.status}`) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  Loader, 
  AlertCircle, 
  Calendar, 
  CheckCircle, 
  BookOpen, 
  XCircle,
  Edit,
  AlertTriangle,
  Clock
} from 'lucide-vue-next'
import { useSlotStore } from '@/stores/slotStore'

interface Analytics {
  totalSlots: number
  availableSlots: number
  bookedSlots: number
  blockedSlots: number
  availablePercentage: number
  bookedPercentage: number
  blockedPercentage: number
  operations: {
    totalEdits: number
    successfulEdits: number
    failedEdits: number
    avgDuration: number
  }
  strategies: Array<{
    name: string
    count: number
    percentage: number
  }>
  conflicts: {
    total: number
    bookedOverlap: number
    slotOverlap: number
    templateOverlap: number
  }
  recentActivity: Array<{
    type: string
    description: string
    timestamp: number
    status: 'success' | 'error' | 'warning'
  }>
}

const { t } = useI18n()
const slotStore = useSlotStore()

const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedPeriod = ref('week')

const analytics = ref<Analytics>({
  totalSlots: 0,
  availableSlots: 0,
  bookedSlots: 0,
  blockedSlots: 0,
  availablePercentage: 0,
  bookedPercentage: 0,
  blockedPercentage: 0,
  operations: {
    totalEdits: 0,
    successfulEdits: 0,
    failedEdits: 0,
    avgDuration: 0
  },
  strategies: [],
  conflicts: {
    total: 0,
    bookedOverlap: 0,
    slotOverlap: 0,
    templateOverlap: 0
  },
  recentActivity: []
})

onMounted(() => {
  loadAnalytics()
})

async function loadAnalytics() {
  isLoading.value = true
  error.value = null

  try {
    // Load slots data
    await slotStore.loadSlots({ page: 0 })
    
    // Calculate analytics from store data
    const allSlots = slotStore.allSlots
    
    analytics.value.totalSlots = allSlots.length
    analytics.value.availableSlots = allSlots.filter(s => s.status === 'available').length
    analytics.value.bookedSlots = allSlots.filter(s => s.status === 'booked').length
    analytics.value.blockedSlots = allSlots.filter(s => s.status === 'blocked').length
    
    // Calculate percentages
    if (analytics.value.totalSlots > 0) {
      analytics.value.availablePercentage = Math.round((analytics.value.availableSlots / analytics.value.totalSlots) * 100)
      analytics.value.bookedPercentage = Math.round((analytics.value.bookedSlots / analytics.value.totalSlots) * 100)
      analytics.value.blockedPercentage = Math.round((analytics.value.blockedSlots / analytics.value.totalSlots) * 100)
    }
    
    // Mock operations data (would come from telemetry in production)
    analytics.value.operations = {
      totalEdits: 45,
      successfulEdits: 42,
      failedEdits: 3,
      avgDuration: 234
    }
    
    // Mock strategy distribution
    analytics.value.strategies = [
      { name: 'override', count: 25, percentage: 56 },
      { name: 'templateUpdate', count: 15, percentage: 33 },
      { name: 'userChoice', count: 5, percentage: 11 }
    ]
    
    // Mock conflicts data
    analytics.value.conflicts = {
      total: 12,
      bookedOverlap: 7,
      slotOverlap: 3,
      templateOverlap: 2
    }
    
    // Mock recent activity
    analytics.value.recentActivity = [
      {
        type: 'edit',
        description: t('calendar.analytics.activity.slotEdited', { id: '123' }),
        timestamp: Date.now() - 300000,
        status: 'success'
      },
      {
        type: 'batch',
        description: t('calendar.analytics.activity.batchEdit', { count: 5 }),
        timestamp: Date.now() - 600000,
        status: 'success'
      },
      {
        type: 'conflict',
        description: t('calendar.analytics.activity.conflictDetected'),
        timestamp: Date.now() - 900000,
        status: 'warning'
      }
    ]
    
  } catch (err: any) {
    error.value = err.message || 'Failed to load analytics'
  } finally {
    isLoading.value = false
  }
}

function handlePeriodChange() {
  loadAnalytics()
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'edit':
      return Edit
    case 'batch':
      return CheckCircle
    case 'conflict':
      return AlertTriangle
    default:
      return Calendar
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return t('calendar.analytics.time.justNow')
  if (minutes < 60) return t('calendar.analytics.time.minutesAgo', { count: minutes })
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('calendar.analytics.time.hoursAgo', { count: hours })
  
  const days = Math.floor(hours / 24)
  return t('calendar.analytics.time.daysAgo', { count: days })
}
</script>

<style scoped>
.analytics-dashboard {
  padding: 24px;
  background: var(--color-bg-primary);
  border-radius: 12px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.period-select {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  color: var(--color-error);
}

.btn-retry {
  padding: 10px 20px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.analytics-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--color-primary-light, #e0e7ff);
  color: var(--color-primary);
}

.stat-icon.success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success);
}

.stat-icon.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning);
}

.stat-icon.error {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error);
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-change {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.stat-change.positive {
  color: var(--color-success);
}

.operations-section,
.strategy-section,
.conflicts-section,
.activity-section {
  padding: 20px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 16px 0;
}

.operations-grid,
.conflicts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.operation-stat,
.conflict-stat {
  display: flex;
  gap: 12px;
  align-items: center;
}

.operation-content,
.conflict-content {
  flex: 1;
}

.operation-label,
.conflict-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.operation-value,
.conflict-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.strategy-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.strategy-label {
  min-width: 150px;
  font-size: 14px;
  color: var(--color-text-primary);
}

.strategy-progress {
  flex: 1;
  height: 24px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.strategy-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.strategy-count {
  min-width: 80px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--color-bg-tertiary);
}

.activity-icon.edit {
  background: var(--color-primary-light, #e0e7ff);
  color: var(--color-primary);
}

.activity-icon.batch {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success);
}

.activity-icon.conflict {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning);
}

.activity-content {
  flex: 1;
}

.activity-description {
  font-size: 14px;
  color: var(--color-text-primary);
}

.activity-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.activity-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.activity-status.success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success);
}

.activity-status.error {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error);
}

.activity-status.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning);
}

@media (max-width: 768px) {
  .analytics-dashboard {
    padding: 16px;
  }
  
  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .operations-grid,
  .conflicts-grid {
    grid-template-columns: 1fr;
  }
  
  .strategy-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .strategy-label,
  .strategy-count {
    min-width: auto;
  }
}
</style>
