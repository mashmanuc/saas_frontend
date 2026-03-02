<template>
  <div class="alerts-panel" data-testid="alerts-panel">
    <div class="alerts-header">
      <h2 class="section-title">
        {{ $t('staff.analytics.alerts.title') }}
        <span v-if="activeCount > 0" class="active-badge">{{ activeCount }}</span>
      </h2>
      <div class="alerts-filters">
        <select v-model="statusFilter" class="filter-select" @change="loadAlerts">
          <option value="">{{ $t('staff.analytics.alerts.allStatuses') }}</option>
          <option value="active">{{ $t('staff.analytics.alerts.statusActive') }}</option>
          <option value="acknowledged">{{ $t('staff.analytics.alerts.statusAck') }}</option>
          <option value="resolved">{{ $t('staff.analytics.alerts.statusResolved') }}</option>
        </select>
        <select v-model="severityFilter" class="filter-select" @change="loadAlerts">
          <option value="">{{ $t('staff.analytics.alerts.allSeverities') }}</option>
          <option value="critical">{{ $t('staff.analytics.alerts.critical') }}</option>
          <option value="warning">{{ $t('staff.analytics.alerts.warning') }}</option>
          <option value="info">{{ $t('staff.analytics.alerts.info') }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="alerts-loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="alerts-error">
      <Alert variant="danger">{{ error }}</Alert>
    </div>

    <div v-else-if="alerts.length === 0" class="alerts-empty">
      <EmptyState :text="$t('staff.analytics.alerts.noAlerts')" />
    </div>

    <div v-else class="alerts-list">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="alert-item"
        :class="[`severity-${alert.severity}`, `status-${alert.status}`]"
      >
        <div class="alert-left">
          <span class="severity-indicator" :class="alert.severity" />
          <div class="alert-content">
            <div class="alert-title-row">
              <span class="alert-title">{{ alert.title }}</span>
              <span class="alert-status-badge" :class="alert.status">
                {{ $t(`staff.analytics.alerts.status${capitalize(alert.status)}`) }}
              </span>
            </div>
            <p class="alert-description">{{ alert.description }}</p>
            <div class="alert-meta">
              <span v-if="alert.funnel_step" class="alert-meta-item">
                {{ $t('staff.analytics.alerts.step') }}: {{ alert.funnel_step }}
              </span>
              <span class="alert-meta-item">
                {{ formatDate(alert.created_at) }}
              </span>
              <span v-if="alert.acknowledged_by_email" class="alert-meta-item">
                {{ $t('staff.analytics.alerts.ackBy') }}: {{ alert.acknowledged_by_email }}
              </span>
            </div>
          </div>
        </div>
        <div class="alert-actions">
          <button
            v-if="alert.status === 'active'"
            class="btn-ack"
            :disabled="actionLoading === alert.id"
            @click="acknowledgeAlert(alert.id)"
          >
            {{ $t('staff.analytics.alerts.acknowledge') }}
          </button>
          <button
            v-if="alert.status !== 'resolved'"
            class="btn-resolve"
            :disabled="actionLoading === alert.id"
            @click="resolveAlert(alert.id)"
          >
            {{ $t('staff.analytics.alerts.resolve') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type { FunnelAlert } from '../api/staffAnalyticsApi'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import Alert from '@/ui/Alert.vue'
import EmptyState from '@/ui/EmptyState.vue'

const { t } = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)
const alerts = ref<FunnelAlert[]>([])
const activeCount = ref(0)
const actionLoading = ref<string | null>(null)

const statusFilter = ref<string>('')
const severityFilter = ref<string>('')

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

async function loadAlerts() {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, string | number> = {}
    if (statusFilter.value) params.status = statusFilter.value
    if (severityFilter.value) params.severity = severityFilter.value

    const res = await staffAnalyticsApi.getAlerts(params as any)
    alerts.value = res.results
    activeCount.value = res.active_count
  } catch (err: any) {
    error.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    loading.value = false
  }
}

async function acknowledgeAlert(alertId: string) {
  actionLoading.value = alertId
  try {
    await staffAnalyticsApi.acknowledgeAlert(alertId)
    await loadAlerts()
  } catch (err: any) {
    error.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    actionLoading.value = null
  }
}

async function resolveAlert(alertId: string) {
  actionLoading.value = alertId
  try {
    await staffAnalyticsApi.resolveAlert(alertId)
    await loadAlerts()
  } catch (err: any) {
    error.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  loadAlerts()
})
</script>

<style scoped>
.alerts-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.alerts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.active-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #ef4444;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.alerts-filters {
  display: flex;
  gap: var(--space-sm);
}

.filter-select {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.alerts-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) 0;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  transition: border-color 0.15s;
}

.alert-item.severity-critical {
  border-left: 3px solid #ef4444;
}

.alert-item.severity-warning {
  border-left: 3px solid #f59e0b;
}

.alert-item.severity-info {
  border-left: 3px solid #3b82f6;
}

.alert-item.status-resolved {
  opacity: 0.6;
}

.alert-left {
  display: flex;
  gap: var(--space-sm);
  flex: 1;
  min-width: 0;
}

.severity-indicator {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
}

.severity-indicator.critical { background: #ef4444; }
.severity-indicator.warning { background: #f59e0b; }
.severity-indicator.info { background: #3b82f6; }

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.alert-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.alert-status-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.alert-status-badge.active {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.alert-status-badge.acknowledged {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.alert-status-badge.resolved {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.alert-description {
  margin: var(--space-xs) 0 0 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.alert-meta {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-xs);
  flex-wrap: wrap;
}

.alert-meta-item {
  font-size: var(--text-xs);
  color: var(--text-tertiary, var(--text-secondary));
}

.alert-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.btn-ack,
.btn-resolve {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.15s;
}

.btn-ack {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-ack:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--accent);
}

.btn-resolve {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.btn-resolve:hover:not(:disabled) {
  background: #15803d;
}

.btn-ack:disabled,
.btn-resolve:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .alert-item {
    flex-direction: column;
  }

  .alert-actions {
    align-self: flex-end;
  }

  .alerts-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
