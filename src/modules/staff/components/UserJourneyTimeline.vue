<template>
  <div class="user-journey-timeline">
    <!-- Header -->
    <div class="journey-header">
      <div class="journey-summary">
        <div class="summary-item">
          <span class="summary-label">{{ t('staff.journey.currentStep') }}</span>
          <span class="summary-value" :class="currentStepClass">
            {{ data?.current_funnel_step ? t(`staff.journey.steps.${data.current_funnel_step}`) : '—' }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">{{ t('staff.journey.daysSinceReg') }}</span>
          <span class="summary-value">{{ data?.days_since_registration ?? '—' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">{{ t('staff.journey.daysStuck') }}</span>
          <span class="summary-value" :class="{ 'text-danger': (data?.days_stuck ?? 0) >= 7 }">
            {{ data?.days_stuck ?? '—' }}
          </span>
        </div>
      </div>

      <div class="journey-actions">
        <select v-model="actionsFilter" class="journey-select">
          <option value="funnel">{{ t('staff.journey.funnelOnly') }}</option>
          <option value="all">{{ t('staff.journey.allActions') }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="journey-loading">
      <LoadingSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="journey-error" role="alert">
      {{ error }}
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <!-- Funnel Progress Bar -->
      <div class="funnel-progress">
        <div
          v-for="step in allSteps"
          :key="step"
          class="funnel-step"
          :class="stepClass(step)"
          :title="t(`staff.journey.steps.${step}`)"
        >
          <div class="step-dot"></div>
          <span class="step-label">{{ t(`staff.journey.steps.${step}`) }}</span>
        </div>
      </div>

      <!-- Recommendations -->
      <div v-if="data.recommendations.length > 0" class="journey-recommendations">
        <div
          v-for="(rec, i) in data.recommendations"
          :key="i"
          class="recommendation-item"
        >
          <span class="rec-icon">&#9888;</span>
          {{ rec }}
        </div>
      </div>

      <!-- Timeline -->
      <div class="timeline">
        <div
          v-for="(event, i) in data.journey"
          :key="i"
          class="timeline-item"
        >
          <div class="timeline-connector">
            <div class="timeline-dot" :class="dotClass(event.action)"></div>
            <div v-if="i < data.journey.length - 1" class="timeline-line"></div>
          </div>
          <div class="timeline-content">
            <div class="event-header">
              <span class="event-action">{{ formatAction(event.action) }}</span>
              <span v-if="event.time_since_prev" class="event-delta">+{{ event.time_since_prev }}</span>
            </div>
            <div class="event-time">{{ formatTimestamp(event.timestamp) }}</div>
            <div v-if="event.metadata && Object.keys(event.metadata).length > 0" class="event-metadata">
              <span
                v-for="(val, key) in event.metadata"
                :key="String(key)"
                class="metadata-tag"
              >
                {{ key }}: {{ val }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="data.journey.length === 0" class="journey-empty">
        {{ t('staff.journey.noEvents') }}
      </div>

      <!-- Missing Steps -->
      <div v-if="displayedMissingSteps.length > 0" class="missing-steps">
        <h4 class="missing-title">{{ t('staff.journey.missingSteps') }}</h4>
        <div class="missing-list">
          <span
            v-for="step in displayedMissingSteps"
            :key="step"
            class="missing-tag"
          >
            {{ t(`staff.journey.steps.${step}`) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '@/modules/staff/api/staffAnalyticsApi'
import type { UserJourneyResponse } from '@/modules/staff/api/staffAnalyticsApi'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const props = defineProps<{
  userId: number | string
}>()

const { t } = useI18n()

const data = ref<UserJourneyResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const actionsFilter = ref<'funnel' | 'all'>('funnel')

// Marketplace Extraction 2026-06-18: profile_published + first_inquiry_sent прибрано з
// воронки (marketplace-кроки публікації профілю + першого inquiry — мертві в BYO).
const MARKETPLACE_STEPS = ['profile_published', 'first_inquiry_sent']
const allSteps = [
  'registered',
  'email_verified',
  'first_login',
  'onboarding_started',
  'onboarding_completed',
  'profile_saved',
]

// «Пропущені кроки» — без marketplace-кроків (backend ще може їх повертати)
const displayedMissingSteps = computed(() =>
  (data.value?.missing_steps ?? []).filter(s => !MARKETPLACE_STEPS.includes(s))
)

const completedSteps = new Set<string>()

async function fetchJourney() {
  loading.value = true
  error.value = null
  try {
    const res = await staffAnalyticsApi.getUserJourney(props.userId, {
      actions: actionsFilter.value,
    })
    data.value = res
    completedSteps.clear()
    allSteps.forEach(s => {
      if (!res.missing_steps.includes(s)) {
        completedSteps.add(s)
      }
    })
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'Failed to load journey'
    data.value = null
  } finally {
    loading.value = false
  }
}

function stepClass(step: string): string {
  if (!data.value) return ''
  const isCompleted = !data.value.missing_steps.includes(step)
  const isCurrent = data.value.current_funnel_step === step
  const isStuck = isCurrent && (data.value.days_stuck ?? 0) >= 7

  if (isStuck) return 'step--stuck'
  if (isCurrent) return 'step--current'
  if (isCompleted) return 'step--completed'
  return 'step--pending'
}

function dotClass(action: string): string {
  const funnelActions = [
    'user.registered', 'user.email_verified', 'user.login',
    'onboarding.started', 'onboarding.completed',
    'profile.first_saved',
  ]
  return funnelActions.includes(action) ? 'dot--funnel' : 'dot--other'
}

const currentStepClass = ref('')
watch(data, (d) => {
  if (d && d.days_stuck >= 7) {
    currentStepClass.value = 'text-danger'
  } else {
    currentStepClass.value = ''
  }
})

function formatAction(action: string): string {
  return action.replace(/[._]/g, ' ')
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(actionsFilter, () => {
  fetchJourney()
})

onMounted(() => {
  fetchJourney()
})
</script>

<style scoped>
.user-journey-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.journey-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.journey-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-label {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.text-danger {
  color: #dc2626 !important;
}

.journey-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111827);
}

.journey-loading,
.journey-error,
.journey-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6b7280);
  font-size: 14px;
}

.journey-error {
  color: #dc2626;
  background: #fef2f2;
  border-radius: 8px;
}

/* Funnel Progress */
.funnel-progress {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 8px 0;
}

.funnel-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 72px;
  position: relative;
}

.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  background: #fff;
  transition: all 0.2s;
}

.step-label {
  font-size: 10px;
  color: var(--text-muted, #9ca3af);
  text-align: center;
  line-height: 1.2;
}

.step--completed .step-dot {
  background: #059669;
  border-color: #059669;
}
.step--completed .step-label {
  color: #059669;
  font-weight: 600;
}

.step--current .step-dot {
  background: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
.step--current .step-label {
  color: #3b82f6;
  font-weight: 600;
}

.step--stuck .step-dot {
  background: #dc2626;
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
}
.step--stuck .step-label {
  color: #dc2626;
  font-weight: 600;
}

.step--pending .step-dot {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Recommendations */
.journey-recommendations {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.rec-icon {
  flex-shrink: 0;
  font-size: 14px;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  padding-left: 8px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  min-height: 56px;
}

.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.dot--funnel {
  background: #4f46e5;
}

.dot--other {
  background: #9ca3af;
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--border-color, #e5e7eb);
  margin: 4px 0;
}

.timeline-content {
  flex: 1;
  padding-bottom: 16px;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-action {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  text-transform: capitalize;
}

.event-delta {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  background: var(--bg-secondary, #f3f4f6);
  padding: 1px 6px;
  border-radius: 4px;
}

.event-time {
  font-size: 12px;
  color: var(--text-muted, #6b7280);
  margin-top: 2px;
}

.event-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.metadata-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px;
  color: var(--text-muted, #6b7280);
}

/* Missing Steps */
.missing-steps {
  margin-top: 4px;
}

.missing-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 8px;
}

.missing-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.missing-tag {
  font-size: 12px;
  padding: 4px 10px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  font-weight: 500;
}
</style>
