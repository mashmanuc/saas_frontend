<script setup lang="ts">
// F18: Availability Editor Component
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader as LoaderIcon, CheckCircle as CheckCircleIcon, AlertCircle as AlertCircleIcon, Save } from 'lucide-vue-next'
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

const availability = ref<Record<number, any[]>>({})
const isLoading = ref(false)
const showSlotEditor = ref(false)

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

// Local state for editing
const localSchedule = ref<Record<number, { start: string; end: string }[]>>({})
const isSaving = ref(false)
const hasChanges = ref(false)

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

// Check if a time window conflicts with existing slots
const hasConflictWithSlots = (dayValue: number, start: string, end: string) => {
  const blockedSlots = getBlockedSlotsForDay(dayValue)
  const newStart = timeToMinutes(start)
  const newEnd = timeToMinutes(end)
  
  return blockedSlots.some(slot => {
    // Extract time from datetime string (format: "2024-12-25T09:00:00Z")
    const slotStart = timeToMinutes(slot.start.substring(11, 16))
    const slotEnd = timeToMinutes(slot.end.substring(11, 16))
    
    return (newStart < slotEnd && newEnd > slotStart) // Overlap check
  })
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
  hasChanges.value = false
}

function getWindowsForDay(dayValue: number) {
  return localSchedule.value[dayValue] || []
}

function addWindow(dayValue: number) {
  if (!localSchedule.value[dayValue]) {
    localSchedule.value[dayValue] = []
  }
  
  const newWindow = { start: '09:00', end: '17:00' }
  
  // Check for conflicts with existing slots
  if (hasConflictWithSlots(dayValue, newWindow.start, newWindow.end)) {
    toast.warning(t('availability.editor.conflictWithSlots'))
    return
  }
  
  localSchedule.value[dayValue].push(newWindow)
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
  const window = localSchedule.value[dayValue][index]
  const updatedWindow = { ...window, [field]: value }
  
  // Check for conflicts with existing slots
  if (hasConflictWithSlots(dayValue, updatedWindow.start, updatedWindow.end)) {
    toast.warning(t('availability.editor.conflictWithSlots'))
    // Don't update the window if there's a conflict
    return
  }
  
  localSchedule.value[dayValue][index] = updatedWindow
  hasChanges.value = true
}

async function saveAvailability() {
  isSaving.value = true

  try {
    // Check for conflicts before saving
    for (const [day, windows] of Object.entries(localSchedule.value)) {
      for (const window of windows) {
        if (hasConflictWithSlots(Number(day), window.start, window.end)) {
          toast.error(t('availability.editor.conflictWithSlots'))
          return
        }
      }
    }

    const schedulePayload: Record<string, Array<{ start_time: string; end_time: string }>> = {}

    for (const [day, windows] of Object.entries(localSchedule.value)) {
      schedulePayload[day] = windows.map(w => ({
        start_time: w.start,
        end_time: w.end,
      }))
    }

    const response = await bookingApi.setAvailability({ schedule: schedulePayload })
    hasChanges.value = false

    // Success toast
    toast.success(t('availability.editor.saveSuccess'))

    // Почати відстеження job
    if (response.jobId) {
      await startTracking(response.jobId)
    }
  } catch (e) {
    console.error('Failed to save availability:', e)
    toast.error(t('availability.editor.saveError'))
  } finally {
    isSaving.value = false
  }
}

async function handleRetry() {
  try {
    const response = await bookingApi.generateAvailabilitySlots()
    await startTracking(response.jobId)
    toast.info(t('availability.jobStatus.retry'))
  } catch (error) {
    console.error('Failed to retry generation:', error)
    toast.error(t('availability.jobStatus.retryError'))
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
  toast.success(t('availability.slotEditor.saveSuccess'))
  
  // Optimistic update already done in store
  // Background sync to ensure consistency
  try {
    await slotStore.loadSlots({ page: 0 })
  } catch (error) {
    console.warn('[AvailabilityEditor] Background sync failed:', error)
    // Optimistic update remains, user can retry if needed
  }
}

function handleSlotEditCancelled() {
  showSlotEditor.value = false
  slotStore.setEditingSlot(null)
}

function handleSlotEditError(error: any) {
  console.error('Slot edit error:', error)
  toast.error(t('availability.slotEditor.saveError'))
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
    toast.success(t('availability.editor.actions.undoSuccess'))
  } catch (error: any) {
    console.error('[AvailabilityEditor] Undo failed:', error)
    toast.error(t('availability.editor.actions.undoError'))
  }
}

async function handleRedo() {
  try {
    await slotStore.redoLastAction()
    toast.success(t('availability.editor.actions.redoSuccess'))
  } catch (error: any) {
    console.error('[AvailabilityEditor] Redo failed:', error)
    toast.error(t('availability.editor.actions.redoError'))
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
      <button class="back-button" @click="handleBackToCalendar">
        ← {{ t('calendar.weekNavigation.backToCalendar', 'Повернутися до календаря') }}
      </button>
    </div>
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
        <button
          class="btn-icon"
          @click="handleUndo"
          :disabled="!slotStore.canUndo || isLoading"
          :title="t('availability.editor.actions.undo')"
          data-testid="undo-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </button>
        <button
          class="btn-icon"
          @click="handleRedo"
          :disabled="!slotStore.canRedo || isLoading"
          :title="t('availability.editor.actions.redo')"
          data-testid="redo-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 7v6h-6"/>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
          </svg>
        </button>
      </div>
      
      <button
        class="btn btn-secondary" 
        @click="resetChanges" 
        :disabled="!hasChanges || isLoading"
        data-testid="reset-changes"
      >
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
