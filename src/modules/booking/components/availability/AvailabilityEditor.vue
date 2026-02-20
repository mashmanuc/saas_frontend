<script setup lang="ts">
// F18: Availability Editor Component
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader as LoaderIcon, CheckCircle as CheckCircleIcon, AlertCircle as AlertCircleIcon, Save } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { bookingApi } from '../../api/booking'
import { calendarWeekApi } from '../../api/calendarWeekApi'
import type { AvailabilityInput } from '../../api/booking'
import { useAvailabilityJob } from '../../composables/useAvailabilityJob'
import { useToast } from '@/composables/useToast'
import DaySchedule from './DaySchedule.vue'
import SlotEditor from './SlotEditor.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { getISODayOfWeek } from '@/utils/dateUtils'
import type { Slot } from '@/modules/booking/types/slot'
import { useSlotStore } from '@/stores/slotStore'

const { t } = useI18n()
const router = useRouter()
const { currentJob, isPolling, startTracking } = useAvailabilityJob()
const toast = useToast()
const slotStore = useSlotStore()

// v0.94.0: Enforcement guard
const isEnforcementBlocked = ref(false)
const enforcementMessage = ref<string | null>(null)

const availability = ref<Record<number, any[]>>({})
const isLoading = ref(false)
const showSlotEditor = ref(false)
const isCheckingConflicts = ref(false)
const isSavingTemplate = ref(false)

// Use store for slots management
const existingSlots = computed(() => slotStore.slots)
const editingSlot = computed(() => slotStore.editingSlot)

const days = [
  { value: 1, label: 'common.weekdays.short.mon' },
  { value: 2, label: 'common.weekdays.short.tue' },
  { value: 3, label: 'common.weekdays.short.wed' },
  { value: 4, label: 'common.weekdays.short.thu' },
  { value: 5, label: 'common.weekdays.short.fri' },
  { value: 6, label: 'common.weekdays.short.sat' },
  { value: 7, label: 'common.weekdays.short.sun' },
]

const localSchedule = ref<Record<number, { start: string; end: string }[]>>({})
const isSaving = ref(false)

const hasChanges = computed(() => {
  return slotStore.hasTemplateChanges
})

// Compute existing slots for each day to show as blocked
const getBlockedSlotsForDay = (dayValue: number) => {
  // dayValue вже 1-7 (ISO 8601)
  const blockedSlots: any[] = []
  
  Object.entries(existingSlots.value).forEach(([dateKey, slots]) => {
    const date = new Date(dateKey)
    const dateDayOfWeek = getISODayOfWeek(date)
    
    if (dateDayOfWeek === dayValue) {
      blockedSlots.push(...slots)
    }
  })
  
  return blockedSlots
}

// Check if a time window conflicts with existing slots (backend validation)
async function checkConflictWithBackend(date: string, start: string, end: string): Promise<boolean> {
  try {
    const result = await bookingApi.checkSlotConflicts({
      date,
      start_time: start,
      end_time: end
    })
    return result.has_conflicts
  } catch (error) {
    console.error('[AvailabilityEditor] Conflict check failed:', error)
    return false
  }
}

// Helper function to convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Initialize local schedule from API
onMounted(async () => {
  isLoading.value = true
  try {
    // v0.94.0: Check activity enforcement
    try {
      const activityResponse = await fetch('/api/v1/tutor/activity-status/')
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        if (activityData.activity_status === 'INACTIVE_SOFT') {
          isEnforcementBlocked.value = true
          enforcementMessage.value = t('calendar.availability.notifications.enforcementBlocked')
        }
      }
    } catch (activityError) {
      console.warn('[AvailabilityEditor] Could not check activity status:', activityError)
    }

    // Load availability template
    const response = await bookingApi.getAvailability()
    availability.value = response?.schedule || {}
    
    // Load existing slots from store
    try {
      await slotStore.loadSlots({ page: 0 })
      console.log('[AvailabilityEditor] Loaded existing slots:', slotStore.slots)
    } catch (calendarError) {
      console.warn('[AvailabilityEditor] Could not load calendar data:', calendarError)
    }
    
    initializeLocalSchedule()
  } catch (e) {
    console.error('Failed to load availability:', e)
  } finally {
    isLoading.value = false
  }
})

function initializeLocalSchedule() {
  const schedule: Record<number, { start: string; end: string }[]> = {}
  for (let i = 1; i <= 7; i++) {
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
  slotStore.clearDraftSchedule()
}

function getWindowsForDay(dayValue: number) {
  return localSchedule.value[dayValue] || []
}

function addWindow(dayValue: number) {
  if (!localSchedule.value[dayValue]) {
    localSchedule.value[dayValue] = []
  }
  
  const newWindow = { start: '09:00', end: '17:00' }
  localSchedule.value[dayValue].push(newWindow)
  slotStore.setDraftSchedule({ ...localSchedule.value })
}

function removeWindow(dayValue: number, index: number) {
  localSchedule.value[dayValue].splice(index, 1)
  slotStore.setDraftSchedule({ ...localSchedule.value })
}

function updateWindow(
  dayValue: number,
  index: number,
  field: 'start' | 'end',
  value: string
) {
  const window = localSchedule.value[dayValue][index]
  const updatedWindow = { ...window, [field]: value }
  
  localSchedule.value[dayValue][index] = updatedWindow
  slotStore.setDraftSchedule({ ...localSchedule.value })
}

async function saveAvailability() {
  // v0.94.0: Enforcement check
  if (isEnforcementBlocked.value) {
    toast.error(enforcementMessage.value || t('calendar.availability.notifications.enforcementBlocked'))
    return
  }

  if (isSavingTemplate.value || (currentJob.value && (currentJob.value.status === 'pending' || currentJob.value.status === 'running'))) {
    toast.warning(t('calendar.availability.jobInProgress'))
    return
  }

  isSavingTemplate.value = true
  isCheckingConflicts.value = true

  try {
    const today = new Date()
    const conflictingDays: number[] = []

    for (const [day, windows] of Object.entries(localSchedule.value)) {
      if (windows.length === 0) continue
      
      const dayNum = Number(day)
      const daysUntilTarget = (dayNum === 7 ? 0 : dayNum) - today.getDay()
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + (daysUntilTarget >= 0 ? daysUntilTarget : daysUntilTarget + 7))
      const dateStr = targetDate.toISOString().slice(0, 10)

      for (const window of windows) {
        const hasConflict = await checkConflictWithBackend(dateStr, window.start, window.end)
        if (hasConflict) {
          conflictingDays.push(dayNum)
          break
        }
      }
    }

    isCheckingConflicts.value = false

    if (conflictingDays.length > 0) {
      const dayNames = conflictingDays.map(d => t(days.find(day => day.value === d)?.label || '')).join(', ')
      toast.error(t('calendar.availability.conflictsDetected', { days: dayNames }))
      return
    }

    const schedulePayload: Record<string, Array<{ start_time: string; end_time: string }>> = {}

    for (const [day, windows] of Object.entries(localSchedule.value)) {
      schedulePayload[day] = windows.map(w => ({
        start_time: w.start,
        end_time: w.end,
      }))
    }

    const response = await bookingApi.setAvailability({ schedule: schedulePayload })
    slotStore.clearDraftSchedule()

    toast.success(t('calendar.availability.notifications.saveSuccess'))

    if (response.jobId) {
      await startTracking(response.jobId)
    }
  } catch (e: any) {
    console.error('Failed to save availability:', e)
    toast.error(e.message || t('calendar.availability.notifications.saveError'))
  } finally {
    isSavingTemplate.value = false
    isCheckingConflicts.value = false
  }
}

async function handleRetry() {
  if (currentJob.value && (currentJob.value.status === 'pending' || currentJob.value.status === 'running')) {
    toast.warning(t('calendar.availability.jobInProgress'))
    return
  }

  try {
    const response = await bookingApi.generateAvailabilitySlots()
    await startTracking(response.jobId)
    toast.info(t('calendar.jobStatus.retry'))
  } catch (error: any) {
    console.error('Failed to retry generation:', error)
    
    // Handle 401 errors - token might have been refreshed, retry once
    if (error?.response?.status === 401 && !error.config?._retryAfter401) {
      console.log('[AvailabilityEditor] 401 on retry, attempting again after token refresh...')
      try {
        if (error.config) {
          error.config._retryAfter401 = true
        }
        const response = await bookingApi.generateAvailabilitySlots()
        await startTracking(response.jobId)
        toast.info(t('calendar.jobStatus.retry'))
        return
      } catch (retryError: any) {
        console.error('[AvailabilityEditor] Retry after 401 failed:', retryError)
        toast.error(retryError.message || t('calendar.jobStatus.retryError'))
        return
      }
    }
    
    toast.error(error.message || t('calendar.jobStatus.retryError'))
  }
}

function resetChanges() {
  initializeLocalSchedule()
}

// Slot editing handlers
function handleSlotClick(slot: any) {
  // Convert calendar slot to Slot type for editor
  const slotData: Slot = {
    id: slot.id.toString(),
    date: slot.date || slot.start.substring(0, 10),
    start: slot.start.substring(11, 16),
    end: slot.end.substring(11, 16),
    status: slot.status || 'available',
    source: slot.source || 'template',
    templateId: slot.template_id?.toString(),
    overrideReason: slot.override_reason,
    createdAt: slot.created_at,
    updatedAt: slot.updated_at
  }
  slotStore.setEditingSlot(slotData)
  showSlotEditor.value = true
}

async function handleSlotSaved(updatedSlot: Slot) {
  showSlotEditor.value = false
  slotStore.setEditingSlot(null)
  toast.success(t('calendar.slotEditor.saveSuccess'))
  
  try {
    await slotStore.loadSlots({ page: 0 })
  } catch (error) {
    console.warn('[AvailabilityEditor] Background sync failed:', error)
  }
}

function handleSlotEditCancelled() {
  showSlotEditor.value = false
  slotStore.setEditingSlot(null)
}

function handleSlotEditError(error: any) {
  console.error('[AvailabilityEditor] Slot edit error:', error)
  
  if (error.response?.status === 409) {
    toast.error(t('calendar.slotEditor.conflictPersists'))
  } else {
    toast.error(error.message || t('calendar.slotEditor.saveError'))
  }
  
  showSlotEditor.value = false
  slotStore.setEditingSlot(null)
  
  try {
    slotStore.loadSlots({ page: 0 })
  } catch (reloadError) {
    console.warn('[AvailabilityEditor] Failed to reload slots after error:', reloadError)
  }
}

async function loadExistingSlots() {
  try {
    await slotStore.loadSlots({ page: 0 })
  } catch (error) {
    console.warn('[AvailabilityEditor] Could not reload calendar data:', error)
  }
}

async function handleUndo() {
  try {
    await slotStore.undoLastAction()
    toast.success(t('calendar.availability.actions.undoSuccess'))
  } catch (error: any) {
    console.error('[AvailabilityEditor] Undo failed:', error)
    toast.error(t('calendar.availability.actions.undoError'))
  }
}

async function handleRedo() {
  try {
    await slotStore.redoLastAction()
    toast.success(t('calendar.availability.actions.redoSuccess'))
  } catch (error: any) {
    console.error('[AvailabilityEditor] Redo failed:', error)
    toast.error(t('calendar.availability.actions.redoError'))
  }
}

function handleBackToCalendar() {
  try {
    router.back()
  } catch (error) {
    console.warn('[AvailabilityEditor] Failed to navigate back:', error)
    router.push({ name: 'booking-calendar' }).catch(() => {})
  }
}
</script>

<template>
  <div class="availability-editor">
    <div class="editor-top-bar">
      <Button
        variant="ghost"
        @click="handleBackToCalendar"
        data-testid="back-to-calendar"
        :aria-label="t('calendar.weekNavigation.backToCalendar', 'Повернутися до календаря')"
      >
        ← {{ t('calendar.weekNavigation.backToCalendar', 'Повернутися до календаря') }}
      </Button>
    </div>
    <div class="editor-header">
      <h3>{{ t('calendar.availability.weeklyScheduleTitle') }}</h3>
      <p class="hint">
        {{ t('calendar.availability.weeklyScheduleSubtitle') }}
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
            {{ t(`calendar.jobStatus.${currentJob.status}.title`) }}
          </p>
          <p v-if="currentJob.status === 'success'" class="status-details">
            {{ t('calendar.jobStatus.success.details', { 
              created: currentJob.slotsCreated,
              deleted: currentJob.slotsDeleted 
            }) }}
          </p>
          <p v-else-if="currentJob.status === 'failed'" class="status-details error">
            {{ currentJob.errorMessage || t('calendar.jobStatus.failed.details') }}
          </p>
          <p v-else class="status-details">
            {{ t(`calendar.jobStatus.${currentJob.status}.details`) }}
          </p>
        </div>
        
        <Button
          v-if="currentJob.status === 'failed'"
          variant="outline"
          size="sm"
          @click="handleRetry"
          data-testid="retry-job"
          :aria-label="t('calendar.jobStatus.retry')"
        >
          {{ t('calendar.jobStatus.retry') }}
        </Button>
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
          :blocked-slots="getBlockedSlotsForDay(day.value)"
          @add="addWindow(day.value)"
          @remove="(index) => removeWindow(day.value, index)"
          @update="(index, field, value) => updateWindow(day.value, index, field, value)"
          @slot-click="handleSlotClick"
        />
      </div>
    </div>

    <div v-if="hasChanges" class="editor-actions">
      <!-- Undo/Redo Controls -->
      <div class="undo-redo-controls">
        <Button
          variant="ghost"
          iconOnly
          @click="handleUndo"
          :disabled="!slotStore.canUndo || isLoading"
          :title="t('calendar.availability.actions.undo')"
          data-testid="undo-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </Button>
        <Button
          variant="ghost"
          iconOnly
          @click="handleRedo"
          :disabled="!slotStore.canRedo || isLoading"
          :title="t('calendar.availability.actions.redo')"
          data-testid="redo-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 7v6h-6"/>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
          </svg>
        </Button>
      </div>
      
      <Button
        variant="outline"
        @click="resetChanges"
        :disabled="!hasChanges || isLoading"
        data-testid="reset-changes"
      >
        {{ t('calendar.availability.actions.reset') }}
      </Button>
      <Button
        variant="primary"
        :disabled="isSavingTemplate || isCheckingConflicts || (currentJob && (currentJob.status === 'pending' || currentJob.status === 'running'))"
        :loading="isSavingTemplate || isCheckingConflicts"
        @click="saveAvailability"
        data-testid="save-availability"
        :aria-label="t('calendar.availability.actions.save')"
      >
        <template v-if="!isSavingTemplate && !isCheckingConflicts" #iconLeft>
          <Save :size="16" />
        </template>
        {{
          isCheckingConflicts
            ? t('calendar.availability.actions.checking')
            : isSavingTemplate
            ? t('calendar.availability.actions.saving')
            : t('calendar.availability.actions.save')
        }}
      </Button>
    </div>

    <!-- Slot Editor Modal -->
    <Teleport to="body">
      <div v-if="showSlotEditor && editingSlot" class="modal-overlay" @click.self="handleSlotEditCancelled">
        <div class="modal-content">
          <ErrorBoundary>
            <SlotEditor
              :slot="editingSlot"
              @saved="handleSlotSaved"
              @cancelled="handleSlotEditCancelled"
              @error="handleSlotEditError"
            />
          </ErrorBoundary>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.availability-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
}

.editor-header h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.hint {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.days-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.day-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.day-label {
  min-width: 80px;
  padding-top: 8px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.undo-redo-controls {
  display: flex;
  gap: 4px;
  margin-right: auto;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  border-color: var(--accent);
  background: var(--accent-bg, #eff6ff);
}

.status-success {
  border-color: var(--success);
  background: var(--success-bg, #ecfdf5);
}

.status-failed {
  border-color: var(--danger);
  background: var(--danger-bg, #fef2f2);
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
  color: var(--accent);
}

.icon-success {
  color: var(--success);
}

.icon-error {
  color: var(--danger);
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
  color: var(--danger);
}

.btn-retry {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: var(--accent);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: var(--accent-hover, #2563eb);
}

.progress-bar {
  margin-top: 0.75rem;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
</style>
