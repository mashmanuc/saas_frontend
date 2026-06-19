<template>
  <div class="staff-analytics" data-testid="staff-analytics">
    <div class="analytics-header">
      <h1 class="analytics-title">{{ $t('staff.analytics.title') }}</h1>
      <p class="analytics-help-text">{{ $t('staff.analytics.helpText') }}</p>
    </div>

    <!-- Filters -->
    <Card class="filters-card">
      <div class="filters-row">
        <div class="filter-group">
          <label class="filter-label">{{ $t('staff.analytics.period') }}</label>
          <select v-model="selectedPeriod" class="filter-select" @change="loadData">
            <option value="daily">{{ $t('staff.analytics.periodDaily') }}</option>
            <option value="weekly">{{ $t('staff.analytics.periodWeekly') }}</option>
            <option value="monthly">{{ $t('staff.analytics.periodMonthly') }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">{{ $t('staff.analytics.role') }}</label>
          <select v-model="selectedRole" class="filter-select" @change="loadData">
            <option value="ALL">{{ $t('staff.analytics.roleAll') }}</option>
            <option value="TUTOR">{{ $t('staff.analytics.roleTutor') }}</option>
            <option value="STUDENT">{{ $t('staff.analytics.roleStudent') }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">{{ $t('staff.analytics.days') }}</label>
          <select v-model.number="selectedDays" class="filter-select" @change="loadData">
            <option :value="7">7 {{ $t('staff.analytics.daysLabel') }}</option>
            <option :value="14">14 {{ $t('staff.analytics.daysLabel') }}</option>
            <option :value="30">30 {{ $t('staff.analytics.daysLabel') }}</option>
            <option :value="60">60 {{ $t('staff.analytics.daysLabel') }}</option>
            <option :value="90">90 {{ $t('staff.analytics.daysLabel') }}</option>
          </select>
        </div>
      </div>
    </Card>

    <!-- Alerts (Phase 5.1) -->
    <Card class="section-card">
      <AlertsPanel />
    </Card>

    <!-- Realtime Today -->
    <Card class="section-card">
      <div class="section-header">
        <h2 class="section-title">{{ $t('staff.analytics.realtimeTitle') }}</h2>
        <span class="section-date">{{ todayDate }}</span>
      </div>
      <div v-if="realtimeLoading" class="section-loading">
        <LoadingSpinner />
      </div>
      <div v-else-if="realtimeError" class="section-error">
        <Alert variant="danger">{{ realtimeError }}</Alert>
      </div>
      <div v-else class="funnel-cards-row">
        <div
          v-for="step in FUNNEL_STEPS"
          :key="step.key"
          class="funnel-card"
        >
          <div class="funnel-card-value">{{ realtimeData[step.key] ?? 0 }}</div>
          <div class="funnel-card-label">{{ $t(step.labelKey) }}</div>
        </div>
      </div>
    </Card>

    <!-- Drop-off Analysis -->
    <Card class="section-card">
      <h2 class="section-title">{{ $t('staff.analytics.dropoffTitle') }}</h2>
      <div v-if="dropoffLoading" class="section-loading">
        <LoadingSpinner />
      </div>
      <div v-else-if="dropoffError" class="section-error">
        <Alert variant="danger">{{ dropoffError }}</Alert>
      </div>
      <div v-else-if="dropoffData.length === 0" class="section-empty">
        <EmptyState :text="$t('staff.analytics.noData')" />
      </div>
      <div v-else class="dropoff-table-wrap">
        <table class="dropoff-table">
          <thead>
            <tr>
              <th>{{ $t('staff.analytics.fromStep') }}</th>
              <th>{{ $t('staff.analytics.toStep') }}</th>
              <th class="text-right">{{ $t('staff.analytics.fromCount') }}</th>
              <th class="text-right">{{ $t('staff.analytics.toCount') }}</th>
              <th class="text-right">{{ $t('staff.analytics.conversionRate') }}</th>
              <th class="text-right">{{ $t('staff.analytics.dropRate') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dropoffData" :key="row.from_step">
              <td>{{ stepLabel(row.from_step) }}</td>
              <td>{{ stepLabel(row.to_step) }}</td>
              <td class="text-right">{{ row.from_count }}</td>
              <td class="text-right">{{ row.to_count }}</td>
              <td class="text-right">
                <span class="rate-badge success">{{ row.conversion_rate }}%</span>
              </td>
              <td class="text-right">
                <span
                  class="rate-badge"
                  :class="row.drop_rate > 50 ? 'danger' : row.drop_rate > 30 ? 'warning' : 'muted'"
                >
                  {{ row.drop_rate }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Cohort Analysis (Phase 5.2) -->
    <Card class="section-card">
      <CohortTable />
    </Card>

    <!-- Engagement Scores (Phase 6.2) -->
    <Card class="section-card">
      <h2 class="section-title">{{ $t('staff.engagement.title') }}</h2>
      <EngagementPanel />
    </Card>

    <!-- Revenue Analytics (Phase 7.1) -->
    <Card class="section-card">
      <h2 class="section-title">{{ $t('staff.revenue.title') }}</h2>
      <RevenuePanel />
    </Card>

    <!-- Marketplace Extraction 2026-06-18: «Marketplace Health» панель прибрана з аналітики
         (marketplace вимкнено — health-метрики мертві). -->

    <!-- Replay Analytics (2026-04-16, Replay Lifecycle v4.2) -->
    <Card class="section-card">
      <ReplayAnalyticsPanel />
    </Card>

    <!-- Experiments (Phase 8) -->
    <Card class="section-card">
      <h2 class="section-title">{{ $t('staff.experiments.title') }}</h2>
      <ExperimentsPanel />
    </Card>

    <!-- Historical Funnel Trend -->
    <Card class="section-card">
      <h2 class="section-title">{{ $t('staff.analytics.trendTitle') }}</h2>
      <div v-if="snapshotLoading" class="section-loading">
        <LoadingSpinner />
      </div>
      <div v-else-if="snapshotError" class="section-error">
        <Alert variant="danger">{{ snapshotError }}</Alert>
      </div>
      <div v-else-if="snapshots.length === 0" class="section-empty">
        <EmptyState :text="$t('staff.analytics.noData')" />
      </div>
      <div v-else class="trend-table-wrap">
        <table class="trend-table">
          <thead>
            <tr>
              <th>{{ $t('staff.analytics.periodLabel') }}</th>
              <th v-for="step in FUNNEL_STEPS" :key="step.key" class="text-right">
                {{ $t(step.shortLabelKey) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="snap in snapshots" :key="snap.id">
              <td class="period-cell">{{ snap.period_start }}</td>
              <td v-for="step in FUNNEL_STEPS" :key="step.key" class="text-right">
                {{ snap[step.key as keyof typeof snap] ?? 0 }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type {
  FunnelSnapshotItem,
  FunnelRealtimeRoleData,
  DropoffStep,
} from '../api/staffAnalyticsApi'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import Alert from '@/ui/Alert.vue'
import EmptyState from '@/ui/EmptyState.vue'
import AlertsPanel from '../components/AlertsPanel.vue'
import CohortTable from '../components/CohortTable.vue'
import EngagementPanel from '../components/EngagementPanel.vue'
import RevenuePanel from '../components/RevenuePanel.vue'
// MarketplaceHealthPanel import прибрано — Marketplace Extraction 2026-06-18
import ExperimentsPanel from '../components/ExperimentsPanel.vue'
import ReplayAnalyticsPanel from '../components/ReplayAnalyticsPanel.vue'

const { t } = useI18n()

const FUNNEL_STEPS = [
  { key: 'registered', labelKey: 'staff.analytics.steps.registered', shortLabelKey: 'staff.analytics.stepsShort.reg' },
  { key: 'email_verified', labelKey: 'staff.analytics.steps.emailVerified', shortLabelKey: 'staff.analytics.stepsShort.email' },
  { key: 'first_login', labelKey: 'staff.analytics.steps.firstLogin', shortLabelKey: 'staff.analytics.stepsShort.login' },
  { key: 'onboarding_started', labelKey: 'staff.analytics.steps.onboardingStarted', shortLabelKey: 'staff.analytics.stepsShort.obStart' },
  { key: 'onboarding_completed', labelKey: 'staff.analytics.steps.onboardingCompleted', shortLabelKey: 'staff.analytics.stepsShort.obDone' },
  { key: 'profile_saved', labelKey: 'staff.analytics.steps.profileSaved', shortLabelKey: 'staff.analytics.stepsShort.saved' },
  { key: 'profile_published', labelKey: 'staff.analytics.steps.profilePublished', shortLabelKey: 'staff.analytics.stepsShort.published' },
  { key: 'first_inquiry_sent', labelKey: 'staff.analytics.steps.firstInquiry', shortLabelKey: 'staff.analytics.stepsShort.inquiry' },
] as const

const STEP_LABEL_MAP: Record<string, string> = {
  registered: 'staff.analytics.steps.registered',
  email_verified: 'staff.analytics.steps.emailVerified',
  first_login: 'staff.analytics.steps.firstLogin',
  onboarding_started: 'staff.analytics.steps.onboardingStarted',
  onboarding_completed: 'staff.analytics.steps.onboardingCompleted',
  profile_saved: 'staff.analytics.steps.profileSaved',
  profile_published: 'staff.analytics.steps.profilePublished',
  first_inquiry_sent: 'staff.analytics.steps.firstInquiry',
}

function stepLabel(key: string): string {
  const i18nKey = STEP_LABEL_MAP[key]
  return i18nKey ? t(i18nKey) : key
}

// Filters
const selectedPeriod = ref<'daily' | 'weekly' | 'monthly'>('daily')
const selectedRole = ref<'ALL' | 'TUTOR' | 'STUDENT'>('ALL')
const selectedDays = ref(30)

// Realtime
const realtimeLoading = ref(false)
const realtimeError = ref<string | null>(null)
const realtimeData = ref<FunnelRealtimeRoleData>({
  registered: 0,
  email_verified: 0,
  first_login: 0,
  onboarding_started: 0,
  onboarding_completed: 0,
  profile_saved: 0,
  profile_published: 0,
  first_inquiry_sent: 0,
})

const todayDate = computed(() => new Date().toLocaleDateString('uk-UA'))

// Dropoff
const dropoffLoading = ref(false)
const dropoffError = ref<string | null>(null)
const dropoffData = ref<DropoffStep[]>([])

// Snapshots
const snapshotLoading = ref(false)
const snapshotError = ref<string | null>(null)
const snapshots = ref<FunnelSnapshotItem[]>([])

async function loadRealtime() {
  realtimeLoading.value = true
  realtimeError.value = null
  try {
    const res = await staffAnalyticsApi.getFunnelRealtime()
    realtimeData.value = res.data[selectedRole.value] ?? res.data['ALL'] ?? realtimeData.value
  } catch (err: any) {
    realtimeError.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    realtimeLoading.value = false
  }
}

async function loadDropoff() {
  dropoffLoading.value = true
  dropoffError.value = null
  try {
    const res = await staffAnalyticsApi.getFunnelDropoff({
      period: selectedPeriod.value,
      role: selectedRole.value,
      days: selectedDays.value,
    })
    dropoffData.value = res.dropoff
  } catch (err: any) {
    dropoffError.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    dropoffLoading.value = false
  }
}

async function loadSnapshots() {
  snapshotLoading.value = true
  snapshotError.value = null
  try {
    const res = await staffAnalyticsApi.getFunnelSnapshots({
      period: selectedPeriod.value,
      role: selectedRole.value,
      days: selectedDays.value,
    })
    snapshots.value = res.results
  } catch (err: any) {
    snapshotError.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    snapshotLoading.value = false
  }
}

async function loadData() {
  await Promise.all([loadRealtime(), loadDropoff(), loadSnapshots()])
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.staff-analytics {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.analytics-header {
  margin-bottom: 0;
}

.analytics-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.analytics-help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0 0;
}

/* Filters */
.filters-card {
  padding: var(--space-md);
}

.filters-row {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.filter-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  min-width: 140px;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 99, 102, 241), 0.15);
}

/* Sections */
.section-card {
  padding: var(--space-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md) 0;
}

.section-header .section-title {
  margin-bottom: 0;
}

.section-date {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.section-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) 0;
}

.section-error {
  margin-top: var(--space-sm);
}

.section-empty {
  padding: var(--space-xl) 0;
}

/* Realtime funnel cards */
.funnel-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-sm);
}

.funnel-card {
  background: var(--bg-secondary, var(--bg-primary));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  text-align: center;
  transition: border-color 0.15s;
}

.funnel-card:hover {
  border-color: var(--accent);
}

.funnel-card-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  margin-bottom: var(--space-xs);
}

.funnel-card-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Dropoff table */
.dropoff-table-wrap,
.trend-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.dropoff-table,
.trend-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.dropoff-table th,
.trend-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.dropoff-table td,
.trend-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  white-space: nowrap;
}

.dropoff-table tr:last-child td,
.trend-table tr:last-child td {
  border-bottom: none;
}

.text-right {
  text-align: right !important;
}

.period-cell {
  font-weight: 500;
  color: var(--text-secondary);
}

/* Rate badges */
.rate-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
}

.rate-badge.success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.rate-badge.warning {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.rate-badge.danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.rate-badge.muted {
  background: var(--bg-secondary, rgba(148, 163, 184, 0.1));
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
    gap: var(--space-md);
  }

  .filter-select {
    min-width: 100%;
  }

  .funnel-cards-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .funnel-cards-row {
    grid-template-columns: 1fr;
  }
}
</style>
