<script setup lang="ts">
// F18: Availability Editor Component
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader as LoaderIcon, CheckCircle as CheckCircleIcon, AlertCircle as AlertCircleIcon, Save } from 'lucide-vue-next'
import { bookingApi } from '../../api/booking'
import type { AvailabilityInput } from '../../api/booking'
import { useAvailabilityJob } from '../../composables/useAvailabilityJob'
import DaySchedule from './DaySchedule.vue'

const { t } = useI18n()
const { currentJob, isPolling, startTracking } = useAvailabilityJob()

const availability = ref<Record<number, any[]>>({})
const isLoading = ref(false)

const days = [
  { value: 1, label: 'common.weekdays.short.mon' },
  { value: 2, label: 'common.weekdays.short.tue' },
  { value: 3, label: 'common.weekdays.short.wed' },
  { value: 4, label: 'common.weekdays.short.thu' },
  { value: 5, label: 'common.weekdays.short.fri' },
  { value: 6, label: 'common.weekdays.short.sat' },
  { value: 0, label: 'common.weekdays.short.sun' },
]

// Local state for editing
const localSchedule = ref<Record<number, { start: string; end: string }[]>>({})
const isSaving = ref(false)
const hasChanges = ref(false)

// Initialize local schedule from API
onMounted(async () => {
  isLoading.value = true
  try {
    const response = await bookingApi.getAvailability()
    availability.value = response?.schedule || {}
    initializeLocalSchedule()
  } catch (e) {
    console.error('Failed to load availability:', e)
  } finally {
    isLoading.value = false
  }
})

function initializeLocalSchedule() {
  const schedule: Record<number, { start: string; end: string }[]> = {}
  for (let i = 0; i < 7; i++) {
    schedule[i] = []
  }

  for (const [day, windows] of Object.entries(availability.value)) {
    for (const av of windows) {
      schedule[Number(day)].push({
        start: av.start_time.slice(0, 5),
        end: av.end_time.slice(0, 5),
      })
    }
  }

  localSchedule.value = schedule
  hasChanges.value = false
}

function getWindowsForDay(dayValue: number) {
  return localSchedule.value[dayValue] || []
}

function addWindow(dayValue: number) {
  if (!localSchedule.value[dayValue]) {
    localSchedule.value[dayValue] = []
  }
  localSchedule.value[dayValue].push({ start: '09:00', end: '17:00' })
  hasChanges.value = true
}

function removeWindow(dayValue: number, index: number) {
  localSchedule.value[dayValue].splice(index, 1)
  hasChanges.value = true
}

function updateWindow(
  dayValue: number,
  index: number,
  field: 'start' | 'end',
  value: string
) {
  localSchedule.value[dayValue][index][field] = value
  hasChanges.value = true
}

async function saveAvailability() {
  isSaving.value = true

  try {
    const schedulePayload: Record<string, Array<{ start_time: string; end_time: string }>> = {}

    for (const [day, windows] of Object.entries(localSchedule.value)) {
      schedulePayload[day] = windows.map(w => ({
        start_time: w.start,
        end_time: w.end,
      }))
    }

    const response = await bookingApi.setAvailability({ schedule: schedulePayload })
    hasChanges.value = false

    // Почати відстеження job
    if (response.jobId) {
      await startTracking(response.jobId)
    }
  } catch (e) {
    console.error('Failed to save availability:', e)
  } finally {
    isSaving.value = false
  }
}

async function handleRetry() {
  try {
    const response = await bookingApi.generateAvailabilitySlots()
    await startTracking(response.jobId)
  } catch (error) {
    console.error('Failed to retry generation:', error)
  }
}

function resetChanges() {
  initializeLocalSchedule()
}
</script>

<template>
  <div class="availability-editor">
    <div class="editor-header">
      <h3>{{ t('availability.editor.weeklyScheduleTitle') }}</h3>
      <p class="hint">
        {{ t('availability.editor.weeklyScheduleSubtitle') }}
      </p>
    </div>

    <!-- Job status banner -->
    <div v-if="currentJob" class="job-status-banner" :class="`status-${currentJob.status}`">
      <div class="status-content">
        <div class="status-icon">
          <LoaderIcon v-if="currentJob.status === 'pending' || currentJob.status === 'running'" class="spinner-icon" :size="24" />
          <CheckCircleIcon v-else-if="currentJob.status === 'success'" class="icon-success" :size="24" />
          <AlertCircleIcon v-else-if="currentJob.status === 'failed'" class="icon-error" :size="24" />
        </div>
        
        <div class="status-text">
          <p class="status-title">
            {{ t(`availability.jobStatus.${currentJob.status}.title`) }}
          </p>
          <p v-if="currentJob.status === 'success'" class="status-details">
            {{ t('availability.jobStatus.success.details', { 
              created: currentJob.slotsCreated,
              deleted: currentJob.slotsDeleted 
            }) }}
          </p>
          <p v-else-if="currentJob.status === 'failed'" class="status-details error">
            {{ currentJob.errorMessage || t('availability.jobStatus.failed.details') }}
          </p>
          <p v-else class="status-details">
            {{ t(`availability.jobStatus.${currentJob.status}.details`) }}
          </p>
        </div>
        
        <button
          v-if="currentJob.status === 'failed'"
          @click="handleRetry"
          class="btn-retry"
        >
          {{ t('availability.jobStatus.retry') }}
        </button>
      </div>
      
      <!-- Progress bar для running status -->
      <div v-if="currentJob.status === 'running'" class="progress-bar">
        <div class="progress-fill indeterminate"></div>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner" />
    </div>

    <div v-else class="days-list">
      <div v-for="day in days" :key="day.value" class="day-row">
        <div class="day-label">{{ t(day.label) }}</div>
        <DaySchedule
          :windows="getWindowsForDay(day.value)"
          @add="addWindow(day.value)"
          @remove="(index) => removeWindow(day.value, index)"
          @update="(index, field, value) => updateWindow(day.value, index, field, value)"
        />
      </div>
    </div>

    <div v-if="hasChanges" class="editor-actions">
      <button class="btn btn-secondary" @click="resetChanges" :disabled="isSaving">
        {{ t('availability.editor.actions.reset') }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="isSaving || isPolling"
        @click="saveAvailability"
      >
        <LoaderIcon v-if="isSaving" class="spinner-small" :size="16" />
        <Save v-else :size="16" />
        {{
          isSaving
            ? t('availability.editor.actions.saving')
            : t('availability.editor.actions.save')
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.availability-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.days-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 12px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.day-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  padding-top: 8px;
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

/* Job status banner */
.job-status-banner {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid;
  background: var(--color-bg-secondary);
}

.status-pending,
.status-running {
  border-color: #3b82f6;
  background: #eff6ff;
}

.status-success {
  border-color: #10b981;
  background: #ecfdf5;
}

.status-failed {
  border-color: #ef4444;
  background: #fef2f2;
}

.status-content {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.status-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.spinner-icon {
  animation: spin 1s linear infinite;
  color: #3b82f6;
}

.icon-success {
  color: #10b981;
}

.icon-error {
  color: #ef4444;
}

.status-text {
  flex: 1;
}

.status-title {
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--color-text-primary);
}

.status-details {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.status-details.error {
  color: #ef4444;
}

.btn-retry {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: #2563eb;
}

.progress-bar {
  margin-top: 0.75rem;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
}

.progress-fill.indeterminate {
  animation: indeterminate 1.5s infinite;
  width: 40%;
}

@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}

.spinner-small {
  animation: spin 1s linear infinite;
}
</style>
