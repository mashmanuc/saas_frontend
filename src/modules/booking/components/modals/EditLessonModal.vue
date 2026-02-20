<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose" data-testid="event-modal">
      <div ref="modalRef" class="modal-container modal-large" role="dialog" aria-labelledby="edit-modal-title" aria-modal="true">
        <div class="modal-header">
          <h2 id="edit-modal-title" data-testid="event-modal-title">{{ $t('calendar.editLesson.title') }}</h2>
          <Button variant="ghost" iconOnly aria-label="Закрити" data-testid="event-modal-close" @click="handleClose">
            <XIcon class="w-5 h-5" />
          </Button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <LoaderIcon class="w-8 h-8 animate-spin text-primary" />
          <p>{{ $t('common.loading') }}</p>
        </div>

        <!-- Content -->
        <div v-else-if="eventDetails" class="modal-content">
          <!-- Tabs -->
          <div class="tabs-container">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab-btn', { active: activeTab === tab.id, disabled: tab.disabled }]"
              :data-testid="`event-tab-${tab.id}`"
              @click="!tab.disabled && (activeTab = tab.id)"
              :disabled="tab.disabled"
            >
              <component :is="tab.icon" class="w-4 h-4" />
              {{ tab.label }}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Update Tab -->
            <div v-if="activeTab === 'update'" class="space-y-4">
              <EventDetailsView
                v-if="!isEditing"
                :event="eventDetails.event"
                :dictionaries="eventDetails.dictionaries"
              />

              <div v-else class="edit-form">
                <!-- Student (readonly) -->
                <div class="form-field">
                  <label class="field-label">{{ $t('calendar.createLesson.student') }}</label>
                  <div class="field-readonly" data-testid="event-student-name">{{ eventDetails.event.clientName }}</div>
                </div>

                <!-- Date & Time -->
                <div class="form-field">
                  <DateTimePicker
                    v-model="editForm.start"
                    :min="minDateTime"
                    :label="$t('calendar.editLesson.dateTime')"
                    data-testid="event-time-input"
                    required
                  />
                </div>

                <!-- Duration -->
                <div class="form-field">
                  <label class="field-label">{{ $t('calendar.createLesson.duration') }}</label>
                  <div class="duration-buttons" data-testid="event-duration-select">
                    <button
                      v-for="dur in availableDurations"
                      :key="dur"
                      type="button"
                      :class="['duration-btn', { active: editForm.durationMin === dur }]"
                      :data-testid="`duration-${dur}`"
                      @click="editForm.durationMin = dur"
                    >
                      {{ dur }} {{ $t('common.minutes') }}
                    </button>
                  </div>
                </div>

                <!-- Tutor Comment -->
                <div class="form-field">
                  <label for="edit-comment" class="field-label">{{ $t('calendar.createLesson.tutorComment') }}</label>
                  <Textarea
                    id="edit-comment"
                    v-model="editForm.tutorComment"
                    :rows="3"
                    :placeholder="$t('calendar.createLesson.tutorCommentPlaceholder')"
                  />
                </div>
              </div>

              <!-- Actions -->
              <div class="modal-actions">
                <Button
                  v-if="!isEditing"
                  variant="outline"
                  @click="handleClose"
                >
                  {{ $t('common.close') }}
                </Button>
                <Button
                  v-if="!isEditing && canEdit"
                  variant="primary"
                  data-testid="event-edit-button"
                  @click="isEditing = true"
                >
                  <template #iconLeft>
                    <EditIcon class="w-4 h-4" />
                  </template>
                  {{ $t('calendar.editLesson.edit') }}
                </Button>

                <template v-if="isEditing">
                  <Button
                    variant="outline"
                    :disabled="isSaving"
                    @click="handleCancelEdit"
                  >
                    {{ $t('common.cancel') }}
                  </Button>
                  <Button
                    variant="primary"
                    :loading="isSaving"
                    data-testid="event-save-button"
                    @click="handleSaveEdit"
                  >
                    {{ $t('common.save') }}
                  </Button>
                </template>
              </div>
            </div>

            <!-- Delete Tab -->
            <div v-if="activeTab === 'delete'" class="space-y-4">
              <div class="warning-box">
                <AlertCircleIcon class="w-5 h-5 text-warning" />
                <div>
                  <p class="font-medium">{{ $t('calendar.editLesson.deleteWarning') }}</p>
                  <p class="text-sm text-muted mt-1">{{ $t('calendar.editLesson.deleteWarningDetails') }}</p>
                </div>
              </div>

              <EventDetailsView
                :event="eventDetails.event"
                :dictionaries="eventDetails.dictionaries"
              />

              <div v-if="!canDelete" class="error-message">
                <AlertCircleIcon class="w-5 h-5" />
                <p>{{ $t('calendar.editLesson.cannotDelete') }}</p>
              </div>

              <div class="modal-actions">
                <Button variant="outline" @click="handleClose">
                  {{ $t('common.cancel') }}
                </Button>
                <Button
                  variant="danger"
                  :disabled="!canDelete"
                  :loading="isDeleting"
                  data-testid="event-delete-button"
                  @click="handleDelete"
                >
                  <template #iconLeft>
                    <TrashIcon class="w-4 h-4" />
                  </template>
                  {{ $t('calendar.editLesson.delete') }}
                </Button>
              </div>
            </div>

            <!-- Reschedule Tab -->
            <div v-if="activeTab === 'reschedule'" class="space-y-4">
              <div class="info-box">
                <CalendarIcon class="w-5 h-5 text-primary" />
                <p>{{ $t('calendar.editLesson.rescheduleInfo') }}</p>
              </div>

              <!-- Current Event Info -->
              <div class="current-event-box">
                <h3 class="text-sm font-medium mb-2">{{ $t('calendar.editLesson.currentTime') }}</h3>
                <EventDetailsView
                  :event="eventDetails.event"
                  :dictionaries="eventDetails.dictionaries"
                  compact
                />
              </div>

              <!-- New Time Selection -->
              <div class="form-field">
                <DateTimePicker
                  v-model="rescheduleForm.targetStart"
                  :min="minDateTime"
                  :label="$t('calendar.editLesson.newTime')"
                  required
                />
              </div>

              <!-- Preview Button -->
              <Button
                v-if="!previewResult"
                variant="outline"
                fullWidth
                :disabled="!rescheduleForm.targetStart"
                :loading="isCheckingConflicts"
                @click="handleReschedulePreview"
              >
                {{ $t('calendar.editLesson.checkConflicts') }}
              </Button>

              <!-- Preview Result -->
              <div v-if="previewResult" class="preview-result">
                <div v-if="previewResult.allowed" class="success-box">
                  <CheckCircleIcon class="w-5 h-5 text-success" />
                  <p>{{ $t('calendar.editLesson.noConflicts') }}</p>
                </div>

                <div v-else class="conflict-warning">
                  <div class="conflict-header">
                    <AlertCircleIcon class="w-5 h-5" />
                    <h4>{{ $t('calendar.editLesson.conflictsFound') }}</h4>
                  </div>
                  <div class="conflict-list">
                    <div v-for="(conflict, idx) in previewResult.conflicts" :key="idx" class="conflict-item">
                      <p class="conflict-type">{{ conflict.type }}</p>
                      <p class="conflict-reason">{{ conflict.reason }}</p>
                    </div>
                  </div>
                </div>

                <!-- Suggested Alternatives -->
                <div v-if="previewResult.suggested_alternatives?.length" class="suggestions-box">
                  <h4 class="text-sm font-medium mb-2">{{ $t('calendar.editLesson.suggestedTimes') }}</h4>
                  <div class="suggestions-list">
                    <button
                      v-for="alt in previewResult.suggested_alternatives"
                      :key="alt.slotId"
                      @click="selectSuggestion(alt)"
                      class="suggestion-item"
                    >
                      <CalendarIcon class="w-4 h-4" />
                      <span>{{ formatDateTime(alt.start) }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="modal-actions">
                <Button variant="outline" @click="handleClose">
                  {{ $t('common.cancel') }}
                </Button>
                <Button
                  v-if="previewResult"
                  variant="outline"
                  @click="previewResult = null"
                >
                  {{ $t('calendar.editLesson.changeTime') }}
                </Button>
                <Button
                  v-if="previewResult?.allowed"
                  variant="primary"
                  :loading="isRescheduling"
                  @click="handleRescheduleConfirm"
                >
                  {{ $t('calendar.editLesson.confirmReschedule') }}
                </Button>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="error-message mt-4" role="alert">
            <AlertCircleIcon class="w-5 h-5" />
            <p>{{ error }}</p>
          </div>
        </div>

        <!-- Confirm Delete Dialog -->
        <ConfirmDialog
          :open="showConfirmDelete"
          :title="$t('calendar.editLesson.confirmDelete')"
          :message="$t('calendar.editLesson.confirmDeleteMessage', { student: eventDetails?.event?.clientName || '' })"
          :confirm-text="$t('calendar.editLesson.delete')"
          :cancel-text="$t('common.cancel')"
          variant="danger"
          @confirm="confirmDelete"
          @cancel="showConfirmDelete = false"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  X as XIcon, 
  AlertCircle as AlertCircleIcon, 
  Trash as TrashIcon, 
  Edit as EditIcon,
  Calendar as CalendarIcon,
  CheckCircle as CheckCircleIcon
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import { sanitizeComment } from '@/utils/sanitize'
import EventDetailsView from './EventDetailsView.vue'
import ConfirmDialog from '@/ui/ConfirmModal.vue'
import DateTimePicker from '@/components/ui/DateTimePicker.vue'
import type { ReschedulePreviewResponse } from '@/modules/booking/types/calendarV055'

const props = defineProps<{
  visible: boolean
  eventId: number
}>()

const emit = defineEmits<{
  close: []
  updated: []
  deleted: []
}>()

const { t } = useI18n()
const store = useCalendarWeekStore()
const toast = useToast()
const { handleError } = useErrorHandler()

const modalRef = ref<HTMLElement | null>(null)
useFocusTrap(modalRef, {
  onEscape: handleClose,
  initialFocus: true,
})

const activeTab = ref<'update' | 'delete' | 'reschedule'>('update')
const eventDetails = ref<any>(null)
const isLoading = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const isCheckingConflicts = ref(false)
const isRescheduling = ref(false)
const error = ref<string | null>(null)
const showConfirmDelete = ref(false)
const previewResult = ref<ReschedulePreviewResponse | null>(null)

const editForm = ref({
  start: '',
  durationMin: 60,
  tutorComment: '',
})

const rescheduleForm = ref({
  targetStart: '',
})

const tabs = computed(() => [
  {
    id: 'update' as const,
    label: t('calendar.editLesson.tabs.update'),
    icon: EditIcon,
    disabled: false,
  },
  {
    id: 'delete' as const,
    label: t('calendar.editLesson.tabs.delete'),
    icon: TrashIcon,
    disabled: false,
  },
  {
    id: 'reschedule' as const,
    label: t('calendar.editLesson.tabs.reschedule'),
    icon: CalendarIcon,
    disabled: !eventDetails.value?.event?.can_reschedule,
  },
])

const canEdit = computed(() => {
  if (!eventDetails.value) return false
  const event = eventDetails.value.event
  const eventStart = new Date(event.start)
  return eventStart > new Date()
})

const canDelete = computed(() => {
  if (!eventDetails.value) return false
  const event = eventDetails.value.event
  
  if (event.paidStatus === 'paid') return false
  if (event.status === 'completed') return false
  
  const eventStart = new Date(event.start)
  return eventStart > new Date()
})

const availableDurations = computed(() => {
  if (!eventDetails.value?.dictionaries?.durations) return [30, 60, 90]
  return eventDetails.value.dictionaries.durations
})

const minDateTime = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const currentMinutes = now.getMinutes()
  const roundedMinutes = Math.ceil(currentMinutes / 5) * 5
  const minutes = String(roundedMinutes).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
})

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await loadEventDetails()
      activeTab.value = 'update'
      isEditing.value = false
      previewResult.value = null
    } else {
      eventDetails.value = null
      error.value = null
    }
  },
  { immediate: true }
)

async function loadEventDetails() {
  console.log('[EditLessonModal] loadEventDetails START, eventId:', props.eventId)
  isLoading.value = true
  error.value = null
  
  try {
    console.log('[EditLessonModal] Calling store.getEventDetails...')
    const details = await store.getEventDetails(props.eventId)
    console.log('[EditLessonModal] Received details:', details)
    console.log('[EditLessonModal] details.event:', details?.event)
    console.log('[EditLessonModal] details.dictionaries:', details?.dictionaries)
    
    eventDetails.value = details
    console.log('[EditLessonModal] eventDetails.value set:', eventDetails.value)
    
    const startDate = new Date(details.event.start)
    const year = startDate.getFullYear()
    const month = String(startDate.getMonth() + 1).padStart(2, '0')
    const day = String(startDate.getDate()).padStart(2, '0')
    const hours = String(startDate.getHours()).padStart(2, '0')
    const minutes = String(startDate.getMinutes()).padStart(2, '0')
    
    editForm.value = {
      start: `${year}-${month}-${day}T${hours}:${minutes}`,
      durationMin: details.event.durationMin || 60,
      tutorComment: details.event.tutorComment || '',
    }
    console.log('[EditLessonModal] editForm initialized:', editForm.value)
    
    rescheduleForm.value = {
      targetStart: `${year}-${month}-${day}T${hours}:${minutes}`,
    }
    console.log('[EditLessonModal] rescheduleForm initialized:', rescheduleForm.value)
  } catch (err: any) {
    console.error('[EditLessonModal] Load error:', err)
    handleError(err, t('calendar.errors.loadFailed'))
  } finally {
    isLoading.value = false
    console.log('[EditLessonModal] loadEventDetails END, isLoading:', isLoading.value, 'eventDetails:', !!eventDetails.value)
  }
}

function handleCancelEdit() {
  isEditing.value = false
  if (eventDetails.value) {
    const startDate = new Date(eventDetails.value.event.start)
    const year = startDate.getFullYear()
    const month = String(startDate.getMonth() + 1).padStart(2, '0')
    const day = String(startDate.getDate()).padStart(2, '0')
    const hours = String(startDate.getHours()).padStart(2, '0')
    const minutes = String(startDate.getMinutes()).padStart(2, '0')
    
    editForm.value = {
      start: `${year}-${month}-${day}T${hours}:${minutes}`,
      durationMin: eventDetails.value.event.durationMin || 60,
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
  }
}

async function handleSaveEdit() {
  isSaving.value = true
  error.value = null
  
  try {
    const localDate = new Date(editForm.value.start)
    const isoString = formatWithOffset(localDate)
    
    await store.updateEvent({
      id: props.eventId,
      start: isoString,
      durationMin: editForm.value.durationMin,
      tutorComment: sanitizeComment(editForm.value.tutorComment || ''),
    })
    
    toast.success(t('calendar.success.updated'))
    await loadEventDetails()
    isEditing.value = false
    emit('updated')
  } catch (err: any) {
    handleError(err, t('calendar.errors.updateFailed'))
  } finally {
    isSaving.value = false
  }
}

function handleDelete() {
  if (!canDelete.value) return
  showConfirmDelete.value = true
}

async function confirmDelete() {
  showConfirmDelete.value = false
  isDeleting.value = true
  error.value = null
  
  try {
    await store.deleteEvent(props.eventId)
    toast.success(t('calendar.success.deleted'))
    emit('deleted')
    emit('close')
  } catch (err: any) {
    if (err.response?.data?.error?.code === 'CANNOT_DELETE') {
      error.value = err.response.data.error.message || t('calendar.errors.cannotDelete')
    } else {
      handleError(err, t('calendar.errors.deleteFailed'))
    }
  } finally {
    isDeleting.value = false
  }
}

async function handleReschedulePreview() {
  isCheckingConflicts.value = true
  error.value = null
  previewResult.value = null
  
  try {
    const localDate = new Date(rescheduleForm.value.targetStart)
    const targetStart = formatWithOffset(localDate)
    const targetEnd = formatWithOffset(new Date(localDate.getTime() + editForm.value.durationMin * 60000))
    
    const result = await store.reschedulePreview(props.eventId, {
      target_start: targetStart,
      target_end: targetEnd,
    })
    
    previewResult.value = result
  } catch (err: any) {
    handleError(err, t('calendar.errors.previewFailed'))
  } finally {
    isCheckingConflicts.value = false
  }
}

async function handleRescheduleConfirm() {
  isRescheduling.value = true
  error.value = null
  
  try {
    const localDate = new Date(rescheduleForm.value.targetStart)
    const targetStart = formatWithOffset(localDate)
    const targetEnd = formatWithOffset(new Date(localDate.getTime() + editForm.value.durationMin * 60000))
    
    await store.rescheduleConfirm(props.eventId, {
      target_start: targetStart,
      target_end: targetEnd,
    })
    
    toast.success(t('calendar.success.rescheduled'))
    emit('updated')
    emit('close')
  } catch (err: any) {
    if (err.response?.status === 409) {
      error.value = t('calendar.errors.slotNoLongerAvailable')
      previewResult.value = null
    } else {
      handleError(err, t('calendar.errors.rescheduleFailed'))
    }
  } finally {
    isRescheduling.value = false
  }
}

function selectSuggestion(alt: any) {
  const suggestedDate = new Date(alt.start)
  const year = suggestedDate.getFullYear()
  const month = String(suggestedDate.getMonth() + 1).padStart(2, '0')
  const day = String(suggestedDate.getDate()).padStart(2, '0')
  const hours = String(suggestedDate.getHours()).padStart(2, '0')
  const minutes = String(suggestedDate.getMinutes()).padStart(2, '0')
  
  rescheduleForm.value.targetStart = `${year}-${month}-${day}T${hours}:${minutes}`
  previewResult.value = null
}

function formatWithOffset(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const tz = date.getTimezoneOffset()
  const sign = tz <= 0 ? '+' : '-'
  const tzHours = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0')
  const tzMinutes = String(Math.abs(tz) % 60).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}:00${sign}${tzHours}:${tzMinutes}`
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleClose() {
  if (!isSaving.value && !isDeleting.value && !isRescheduling.value) {
    emit('close')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 42rem;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-large {
  max-width: 56rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-secondary);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.tabs-container {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid var(--border-color);
  margin-bottom: 1.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn:hover:not(.disabled) {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tab-content {
  min-height: 300px;
}

.space-y-4 > * + * {
  margin-top: 1rem;
}

.form-field {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.field-readonly {
  padding: 0.625rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
}

.field-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  resize: vertical;
}

.duration-buttons {
  display: flex;
  gap: 0.5rem;
}

.duration-btn {
  flex: 1;
  padding: 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--card-bg);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.duration-btn:hover {
  border-color: var(--accent);
}

.duration-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.warning-box, .info-box, .success-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.warning-box {
  background: var(--warning-bg, #fef3c7);
  border: 1px solid var(--warning, #fbbf24);
}

.info-box {
  background: var(--accent-bg, #dbeafe);
  border: 1px solid var(--accent);
}

.success-box {
  background: var(--success-bg, #d1fae5);
  border: 1px solid var(--success);
}

.current-event-box {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
}

.preview-result {
  margin-top: 1rem;
}

.conflict-warning {
  padding: 1rem;
  background: var(--danger-bg, #fef2f2);
  border: 1px solid var(--danger);
  border-radius: 0.5rem;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--danger);
  font-weight: 600;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.conflict-item {
  padding: 0.5rem;
  background: var(--card-bg);
  border-radius: 0.375rem;
}

.conflict-type {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--danger);
}

.conflict-reason {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.suggestions-box {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-item:hover {
  border-color: var(--accent);
  background: var(--accent-bg, #eff6ff);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--danger-bg, #fef2f2);
  border: 1px solid var(--danger);
  border-radius: 0.5rem;
  color: var(--danger);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  margin-top: 1.5rem;
}

.w-full {
  width: 100%;
}
</style>
