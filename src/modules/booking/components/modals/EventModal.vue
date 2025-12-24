<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div ref="modalRef" class="modal-container" role="dialog" aria-labelledby="event-modal-title" aria-modal="true">
      <div class="modal-header">
        <h2 id="event-modal-title">{{ $t('calendar.eventModal.title') }}</h2>
        <button @click="handleClose" class="close-btn" aria-label="Закрити">
          <XIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
        <p>{{ $t('common.loading') }}</p>
      </div>

      <!-- Event Details -->
      <div v-else-if="eventDetails" class="modal-content">
        <!-- View Mode -->
        <div v-if="!isEditing">
          <EventDetailsView
            :event="eventDetails.event"
            :dictionaries="eventDetails.dictionaries"
          />
        </div>

        <!-- Edit Mode -->
        <div v-else class="edit-form">
          <div class="form-field">
            <label for="edit-start" class="field-label">
              {{ $t('calendar.eventModal.editTime') }}
            </label>
            <input
              id="edit-start"
              v-model="editForm.start"
              type="datetime-local"
              class="field-input"
            />
          </div>

          <div class="form-field">
            <label class="field-label">
              {{ $t('calendar.createLesson.duration') }}
            </label>
            <div class="duration-buttons">
              <button
                v-for="duration in availableDurations"
                :key="duration"
                type="button"
                :class="['duration-btn', { active: editForm.durationMin === duration }]"
                @click="editForm.durationMin = duration"
              >
                {{ duration }} {{ $t('common.minutes') }}
              </button>
            </div>
          </div>

          <div class="form-field">
            <label for="edit-comment" class="field-label">
              {{ $t('calendar.createLesson.comment') }}
            </label>
            <textarea
              id="edit-comment"
              v-model="editForm.tutorComment"
              class="field-textarea"
              rows="3"
              :placeholder="$t('calendar.createLesson.commentPlaceholder')"
            />
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ error }}</p>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <template v-if="!isEditing">
            <button
              @click="handleClose"
              class="btn-secondary"
              :disabled="isDeleting"
            >
              {{ $t('common.close') }}
            </button>
            
            <button
              v-if="canEdit"
              @click="handleEdit"
              class="btn-secondary"
              :disabled="isDeleting"
            >
              {{ $t('calendar.eventModal.edit') }}
            </button>
            
            <button
              v-if="canDelete"
              @click="handleDelete"
              class="btn-danger"
              :disabled="isDeleting"
            >
              <LoaderIcon v-if="isDeleting" class="w-4 h-4 animate-spin" />
              <TrashIcon v-else class="w-4 h-4" />
              {{ $t('calendar.eventModal.delete') }}
            </button>
          </template>

          <template v-else>
            <button
              @click="handleCancelEdit"
              class="btn-secondary"
              :disabled="isSaving"
            >
              {{ $t('common.cancel') }}
            </button>
            
            <button
              @click="handleSaveEdit"
              class="btn-primary"
              :disabled="isSaving"
            >
              <LoaderIcon v-if="isSaving" class="w-4 h-4 animate-spin" />
              {{ $t('common.save') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :visible="showConfirmDelete"
      :title="t('calendar.eventModal.confirmDelete')"
      :message="t('calendar.eventModal.confirmDeleteMessage', { student: eventDetails?.event?.clientName || '' })"
      :confirm-text="t('calendar.eventModal.delete')"
      :cancel-text="t('common.cancel')"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, Loader as LoaderIcon, AlertCircle as AlertCircleIcon, Trash as TrashIcon } from 'lucide-vue-next'
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
  start: string
  durationMin: number
  tutorComment: string
}>({
  start: '',
  durationMin: 60,
  tutorComment: '',
})

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
  if (!eventDetails.value) return false
  const event = eventDetails.value.event
  
  // Не можна редагувати урок у минулому
  const eventStart = new Date(event.start)
  if (eventStart < new Date()) return false
  
  return true
})

const availableDurations = computed(() => {
  if (!eventDetails.value?.dictionaries?.durations) return [30, 60, 90]
  return eventDetails.value.dictionaries.durations
})

watch(() => props.visible, async (visible) => {
  if (visible) {
    await loadEventDetails()
  } else {
    eventDetails.value = null
    error.value = null
  }
})

async function loadEventDetails() {
  isLoading.value = true
  error.value = null
  
  try {
    eventDetails.value = await store.getEventDetails(props.eventId)
    console.info('[EventModal] Event details loaded:', props.eventId)
    
    // Ініціалізувати форму редагування
    editForm.value = {
      start: eventDetails.value.event.start,
      durationMin: eventDetails.value.event.durationMin,
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
  } catch (err: any) {
    console.error('[EventModal] Load error:', err)
    handleError(err, t('calendar.errors.loadFailed'))
  } finally {
    isLoading.value = false
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
      error.value = err.response.data.error.message || t('calendar.errors.cannotDelete')
    } else {
      error.value = t('calendar.errors.deleteFailed')
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
    editForm.value = {
      start: eventDetails.value.event.start,
      durationMin: eventDetails.value.event.durationMin,
      tutorComment: eventDetails.value.event.tutorComment || '',
    }
  }
}

async function handleSaveEdit() {
  isSaving.value = true
  error.value = null
  
  try {
    await store.updateEvent({
      id: props.eventId,
      start: editForm.value.start,
      durationMin: editForm.value.durationMin,
      tutorComment: sanitizeComment(editForm.value.tutorComment || ''),
      notifyStudent: true,
    })
    
    console.info('[EventModal] Event updated:', props.eventId)
    
    // Перезавантажити деталі
    await loadEventDetails()
    isEditing.value = false
  } catch (err: any) {
    handleError(err, t('calendar.errors.updateFailed'))
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
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  padding: 4px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f3f4f6;
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
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-danger {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-danger:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  color: #374151;
}

.field-input,
.field-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.duration-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.duration-btn {
  padding: 10px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  background: white;
  color: #6b7280;
}

.duration-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.duration-btn.active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: white;
}
</style>
