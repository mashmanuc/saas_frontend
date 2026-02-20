<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose" data-testid="event-modal">
    <div
      ref="modalRef"
      :class="['modal-container', modalContainerClasses]"
      role="dialog"
      aria-labelledby="event-modal-title"
      aria-modal="true"
    >
      <div class="modal-header">
        <h2 id="event-modal-title" data-testid="event-modal-title">{{ $t('booking.calendar.eventModal.title') }}</h2>
        <Button variant="ghost" iconOnly aria-label="Закрити" data-testid="event-modal-close" @click="handleClose">
          <XIcon class="w-5 h-5" />
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
        <p>{{ $t('common.loading') }}</p>
      </div>

      <!-- Event Details -->
      <div
        v-else-if="eventDetails"
        :class="['modal-content', { 'view-mode': !isEditing }]"
      >
        <!-- View Mode -->
        <div v-if="!isEditing">
          <EventDetailsView
            :event="eventDetails.event"
            :dictionaries="eventDetails.dictionaries"
            data-testid="event-details-view"
          />
        </div>

        <!-- Edit Mode -->
        <div v-else class="edit-form">
          <!-- Учень (readonly) -->
          <div class="form-field">
            <label class="field-label">{{ $t('booking.calendar.createLesson.student') }}</label>
            <div class="field-readonly" data-testid="event-student-name">{{ eventDetails.event.clientName }}</div>
          </div>

          <!-- Заявка (readonly) -->
          <div class="form-field">
            <label class="field-label">{{ $t('booking.calendar.eventModal.order') }}</label>
            <div class="field-readonly">№ {{ eventDetails.event.orderId }}</div>
          </div>

          <!-- Дата -->
          <div class="form-field">
            <label for="edit-date" class="field-label">{{ $t('booking.calendar.eventModal.date') }}</label>
            <input
              id="edit-date"
              v-model="editForm.date"
              type="date"
              class="field-input"
            />
          </div>

          <!-- Початок (час з dropdown) -->
          <div class="form-field">
            <label for="edit-time" class="field-label">{{ $t('booking.calendar.eventModal.startTime') }}</label>
            <div class="time-picker" data-testid="event-time-input">
              <select v-model="editForm.hours" class="field-select time-select">
                <option v-for="h in 24" :key="h-1" :value="String(h-1).padStart(2, '0')">
                  {{ String(h-1).padStart(2, '0') }}
                </option>
              </select>
              <span class="time-separator">:</span>
              <select v-model="editForm.minutes" class="field-select time-select">
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
            </div>
          </div>

          <!-- Тривалість -->
          <div class="form-field">
            <label class="field-label">{{ $t('booking.calendar.createLesson.duration') }}</label>
            <select v-model="editForm.durationMin" class="field-select" data-testid="event-duration-select">
              <option :value="30">30 {{ $t('common.minutes') }}</option>
              <option :value="60">60 {{ $t('common.minutes') }}</option>
              <option :value="90">90 {{ $t('common.minutes') }}</option>
            </select>
          </div>

          <!-- Повторюваність -->
          <div class="form-field">
            <label for="edit-regularity" class="field-label">{{ $t('booking.calendar.createLesson.regularity') }}</label>
            <select
              id="edit-regularity"
              v-model="editForm.regularity"
              class="field-select"
            >
              <option value="single">{{ $t('booking.calendar.regularity.single') }}</option>
              <option value="once_a_week">{{ $t('booking.calendar.regularity.once_a_week') }}</option>
              <option value="twice_a_week">{{ $t('booking.calendar.regularity.twice_a_week') }}</option>
            </select>
          </div>

          <!-- Коментар -->
          <div class="form-field">
            <label for="edit-comment" class="field-label">{{ $t('booking.calendar.createLesson.comment') }}</label>
            <Textarea
              id="edit-comment"
              v-model="editForm.tutorComment"
              :rows="3"
              :placeholder="$t('booking.calendar.createLesson.commentPlaceholder')"
              data-testid="event-comment-input"
            />
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ error }}</p>
        </div>

        <!-- Actions -->
        <div :class="['modal-actions', { 'view-mode': !isEditing }]">
          <template v-if="!isEditing">
            <Button
              variant="outline"
              :disabled="isDeleting"
              @click="handleClose"
            >
              {{ $t('common.close') }}
            </Button>

            <Button
              v-if="canEdit"
              variant="outline"
              :disabled="isDeleting"
              data-testid="event-edit-button"
              @click="handleEdit"
            >
              {{ $t('booking.calendar.eventModal.edit') }}
            </Button>

            <Button
              v-if="canDelete"
              variant="danger"
              :disabled="isDeleting"
              :loading="isDeleting"
              data-testid="event-delete-button"
              @click="handleDelete"
            >
              <template #iconLeft>
                <TrashIcon class="w-4 h-4" />
              </template>
              {{ $t('booking.calendar.eventModal.delete') }}
            </Button>
          </template>

          <template v-else>
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
    </div>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :visible="showConfirmDelete"
      :title="t('booking.calendar.eventModal.confirmDelete')"
      :message="t('booking.calendar.eventModal.confirmDeleteMessage', { student: eventDetails?.event?.clientName || '' })"
      :confirm-text="t('booking.calendar.eventModal.delete')"
      :cancel-text="t('common.cancel')"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
      data-testid="delete-confirmation-dialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, AlertCircle as AlertCircleIcon, Trash as TrashIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import { sanitizeComment } from '@/utils/sanitize'
import EventDetailsView from './EventDetailsView.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = defineProps<{
  visible: boolean
  eventId: number
}>()

const emit = defineEmits<{
  close: []
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

const eventDetails = ref<any>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const showConfirmDelete = ref(false)

const editForm = ref<{
  date: string
  hours: string
  minutes: string
  durationMin: number
  regularity: string
  tutorComment: string
}>({
  date: '',
  hours: '19',
  minutes: '00',
  durationMin: 60,
  regularity: 'single',
  tutorComment: '',
})

const modalContainerClasses = computed(() => ({
  'modal-container--compact': !isEditing.value,
  'modal-container--expanded': isEditing.value,
}))

const canDelete = computed(() => {
  if (!eventDetails.value) return false
  const event = eventDetails.value.event
  
  // Не можна видалити оплачений урок
  if (event.paidStatus === 'paid') return false
  
  // Не можна видалити урок у минулому
  const eventStart = new Date(event.start)
  if (eventStart < new Date()) return false
  
  return true
})

const canEdit = computed(() => {
  if (!eventDetails.value) {
    console.log('[EventModal] canEdit: no eventDetails')
    return false
  }
  const event = eventDetails.value.event
  
  // Не можна редагувати урок у минулому
  const eventStart = new Date(event.start)
  const now = new Date()
  console.log('[EventModal] canEdit check:', {
    eventStart: eventStart.toISOString(),
    now: now.toISOString(),
    isPast: eventStart < now,
    eventData: event
  })
  
  if (eventStart < now) {
    console.log('[EventModal] canEdit: false (event in past)')
    return false
  }
  
  console.log('[EventModal] canEdit: true')
  return true
})

const availableDurations = computed(() => {
  if (!eventDetails.value?.dictionaries?.durations) return [30, 60, 90]
  return eventDetails.value.dictionaries.durations
})

watch(() => props.visible, async (visible) => {
  console.log('[EventModal] Visibility changed:', visible, 'eventId:', props.eventId)
  if (visible) {
    await loadEventDetails()
  } else {
    eventDetails.value = null
    error.value = null
  }
})

async function loadEventDetails() {
  console.log('[EventModal] loadEventDetails START, eventId:', props.eventId)
  isLoading.value = true
  error.value = null
  
  try {
    console.log('[EventModal] Calling store.getEventDetails...')
    const details = await store.getEventDetails(props.eventId)
    console.log('[EventModal] Received details:', details)
    
    eventDetails.value = details
    console.info('[EventModal] Event details loaded:', props.eventId, eventDetails.value)
    
    // Ініціалізувати форму редагування
    const startDate = new Date(eventDetails.value.event.start)
    editForm.value = {
      date: startDate.toISOString().split('T')[0],
      hours: String(startDate.getHours()).padStart(2, '0'),
      minutes: String(startDate.getMinutes()).padStart(2, '0'),
      durationMin: eventDetails.value.event.durationMin,
      regularity: eventDetails.value.event.regularity || 'single',
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
    console.log('[EventModal] Form initialized:', editForm.value)
  } catch (err: any) {
    console.error('[EventModal] Load error:', err)
    handleError(err, t('booking.calendar.errors.loadFailed'))
  } finally {
    isLoading.value = false
    console.log('[EventModal] loadEventDetails END, isLoading:', isLoading.value, 'eventDetails:', !!eventDetails.value)
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
    
    console.info('[EventModal] Event deleted:', props.eventId)
    toast.success(t('calendar.success.deleted'))
    emit('deleted')
    emit('close')
  } catch (err: any) {
    console.error('[EventModal] Delete error:', err)
    
    if (err.response?.data?.error?.code === 'CANNOT_DELETE') {
      error.value = err.response.data.error.message || t('booking.calendar.errors.cannotDelete')
    } else {
      error.value = t('booking.calendar.errors.deleteFailed')
    }
  } finally {
    isDeleting.value = false
  }
}

function handleEdit() {
  isEditing.value = true
  error.value = null
}

function handleCancelEdit() {
  isEditing.value = false
  error.value = null
  // Скинути форму до оригінальних значень
  if (eventDetails.value) {
    const startDate = new Date(eventDetails.value.event.start)
    editForm.value = {
      date: startDate.toISOString().split('T')[0],
      hours: String(startDate.getHours()).padStart(2, '0'),
      minutes: String(startDate.getMinutes()).padStart(2, '0'),
      durationMin: eventDetails.value.event.durationMin,
      regularity: eventDetails.value.event.regularity || 'single',
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
  }
}

async function handleSaveEdit() {
  isSaving.value = true
  error.value = null
  
  try {
    // Скласти datetime з окремих полів
    const startDateTime = `${editForm.value.date}T${editForm.value.hours}:${editForm.value.minutes}:00`
    
    await store.updateEvent({
      id: props.eventId,
      start: startDateTime,
      durationMin: editForm.value.durationMin,
      tutorComment: sanitizeComment(editForm.value.tutorComment || ''),
    })
    
    console.info('[EventModal] Event updated:', props.eventId)
    
    // Перезавантажити деталі
    await loadEventDetails()
    isEditing.value = false
  } catch (err: any) {
    handleError(err, t('booking.calendar.errors.updateFailed'))
  } finally {
    isSaving.value = false
  }
}

function handleClose() {
  if (!isDeleting.value && !isSaving.value) {
    emit('close')
  }
}

function cancelDelete() {
  showConfirmDelete.value = false
}
</script>

<style scoped>
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
  padding: 16px;
}

.modal-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  transition: max-width 0.3s ease;
}

/* Compact mode for view-only */
.modal-container--compact {
  max-width: 520px;
}

/* Expanded mode for editing */
.modal-container--expanded {
  max-width: 640px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  padding: 4px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-secondary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
}

.modal-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--danger-bg, #fef2f2);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.field-input,
.field-textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.duration-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.duration-btn {
  padding: 10px 16px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  background: var(--card-bg);
  color: var(--text-secondary);
}

.duration-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.duration-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.field-readonly {
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-secondary);
}

.field-select {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.2s;
}

.field-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-select {
  flex: 1;
  min-width: 70px;
}

.time-separator {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
