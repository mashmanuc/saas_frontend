<template>
  <div class="staff-health" data-testid="staff-health">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.health.title') }}</h1>
      <p class="help-text">{{ $t('staff.health.helpText') }}</p>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- Alerts -->
      <div v-if="alerts.length > 0" class="alerts-section">
        <div
          v-for="alert in alerts"
          :key="alert.key"
          class="alert-item"
          :class="alert.level"
        >
          <AlertTriangle v-if="alert.level === 'red'" :size="16" />
          <AlertCircle v-else :size="16" />
          <span>{{ alert.message }}</span>
        </div>
      </div>

      <!-- Metrics grid -->
      <div class="health-cards-row">
        <Card v-for="card in healthCards" :key="card.key" class="health-card" :class="`border-${card.status}`">
          <div class="health-indicator" :class="card.status" />
          <div class="health-info">
            <div class="health-value" :class="card.status !== 'green' ? `text-${card.status}` : ''">
              {{ card.value }}
            </div>
            <div class="health-label">{{ card.label }}</div>
            <div v-if="card.hint" class="health-hint">{{ card.hint }}</div>
          </div>
        </Card>
      </div>

      <!-- Summary status -->
      <Card class="status-summary">
        <div class="summary-row">
          <div class="summary-dot" :class="overallStatus" />
          <span class="summary-text">{{ summaryLabel }}</span>
          <span class="summary-time">{{ $t('staff.health.asOf') }} {{ checkedAt }}</span>
        </div>
      </Card>

      <Card v-if="error">
        <p class="text-danger">{{ error }}</p>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, AlertCircle } from 'lucide-vue-next'
import apiClient from '@/utils/apiClient'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { activeLocale } from '@/utils/i18nDate'

const { t } = useI18n()
const loading = ref(true)
const error = ref('')
const checkedAt = ref('')

interface HealthCard {
  key: string
  label: string
  value: string
  status: 'green' | 'yellow' | 'red'
  hint?: string
}

interface Alert {
  key: string
  level: 'yellow' | 'red'
  message: string
}

const healthCards = ref<HealthCard[]>([])
const alerts = ref<Alert[]>([])

const overallStatus = computed(() => {
  if (alerts.value.some(a => a.level === 'red')) return 'red'
  if (alerts.value.some(a => a.level === 'yellow')) return 'yellow'
  return 'green'
})

const summaryLabel = computed(() => {
  if (overallStatus.value === 'red') return t('staff.health.statusCritical')
  if (overallStatus.value === 'yellow') return t('staff.health.statusWarning')
  return t('staff.health.statusHealthy')
})

onMounted(async () => {
  try {
    const res = await apiClient.get('/v1/staff/stats/overview/', {
      meta: { skipLoader: true },
    } as any)

    const openReports = res?.trust?.open_reports ?? 0
    const activeBans = res?.trust?.active_bans ?? 0
    const suspiciousOpen = res?.trust?.suspicious_open ?? 0
    const pendingSessions = res?.billing?.pending_sessions ?? 0
    const activeTutors = res?.activity?.active_tutors ?? 0
    const inactiveTutors = res?.activity?.inactive_tutors ?? 0
    const totalUsers = res?.users?.total ?? 0
    const newUsers7d = res?.users?.new_7d ?? 0
    const activeSubs = res?.billing?.active_subscriptions ?? 0

    healthCards.value = [
      {
        key: 'users',
        label: t('staff.health.users'),
        value: String(totalUsers),
        status: 'green',
        hint: newUsers7d > 0 ? `+${newUsers7d} ${t('staff.health.last7d')}` : undefined,
      },
      {
        key: 'reports',
        label: t('staff.health.openReports'),
        value: String(openReports),
        status: openReports > 20 ? 'red' : openReports > 5 ? 'yellow' : 'green',
        hint: openReports > 0 ? t('staff.health.reportsHint') : undefined,
      },
      {
        key: 'bans',
        label: t('staff.health.activeBans'),
        value: String(activeBans),
        status: activeBans > 10 ? 'red' : activeBans > 5 ? 'yellow' : 'green',
      },
      {
        key: 'suspicious',
        label: t('staff.health.suspicious'),
        value: String(suspiciousOpen),
        status: suspiciousOpen > 5 ? 'yellow' : 'green',
      },
      {
        key: 'pending',
        label: t('staff.health.pendingSessions'),
        value: String(pendingSessions),
        status: pendingSessions > 3 ? 'yellow' : 'green',
        hint: pendingSessions > 0 ? t('staff.health.pendingHint') : undefined,
      },
      {
        key: 'subs',
        label: t('staff.health.activeSubs'),
        value: String(activeSubs),
        status: 'green',
      },
      {
        key: 'tutors_active',
        label: t('staff.health.activeTutors'),
        value: String(activeTutors),
        status: 'green',
        hint: inactiveTutors > 0 ? `${inactiveTutors} ${t('staff.health.inactive')}` : undefined,
      },
    ]

    // Build alerts
    const newAlerts: Alert[] = []
    if (openReports > 20) {
      newAlerts.push({ key: 'reports_crit', level: 'red', message: t('staff.health.alertReportsCritical', { count: openReports }) })
    } else if (openReports > 5) {
      newAlerts.push({ key: 'reports_warn', level: 'yellow', message: t('staff.health.alertReportsWarning', { count: openReports }) })
    }
    if (activeBans > 10) {
      newAlerts.push({ key: 'bans_crit', level: 'red', message: t('staff.health.alertBansCritical', { count: activeBans }) })
    }
    if (pendingSessions > 3) {
      newAlerts.push({ key: 'pending_warn', level: 'yellow', message: t('staff.health.alertPendingWarning', { count: pendingSessions }) })
    }
    alerts.value = newAlerts

    checkedAt.value = new Date().toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' })
  } catch (e: any) {
    error.value = e?.message || t('staff.health.errorLoad')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.staff-health {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0 0;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.health-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

.health-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
}

.health-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.health-indicator.green { background: #22c55e; }
.health-indicator.yellow { background: #eab308; }
.health-indicator.red { background: #ef4444; }

.health-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.health-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.health-value.text-yellow { color: #eab308; }
.health-value.text-red { color: #ef4444; }

.health-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.border-yellow { border-left: 3px solid #eab308 !important; }
.border-red { border-left: 3px solid #ef4444 !important; }
.border-green { border-left: 3px solid #22c55e !important; }

.alerts-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.alert-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
}

.alert-item.red {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
}

.alert-item.yellow {
  background: color-mix(in srgb, #eab308 12%, transparent);
  color: #a16207;
  border: 1px solid color-mix(in srgb, #eab308 30%, transparent);
}

.status-summary {
  padding: var(--space-md) var(--space-lg) !important;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.summary-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.summary-dot.green { background: #22c55e; }
.summary-dot.yellow { background: #eab308; }
.summary-dot.red { background: #ef4444; }

.summary-text {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.summary-time {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.loading-state {
  padding: var(--space-xl);
  text-align: center;
}

.text-danger {
  color: var(--danger-bg, #ef4444);
}
</style>
