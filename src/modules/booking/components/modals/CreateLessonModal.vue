<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div ref="modalRef" class="modal-container" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <div class="modal-header">
        <h2 id="modal-title">{{ $t('calendar.createLesson.title') }}</h2>
        <button @click="handleClose" class="close-btn" aria-label="Закрити">
          <XIcon class="w-5 h-5" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form">
        <!-- Time Selection -->
        <div class="form-field">
          <label for="lesson-time" class="field-label">
            {{ $t('calendar.createLesson.selectedTime') }}
            <span class="required">*</span>
          </label>
          <input
            id="lesson-time"
            v-model="formData.start"
            type="datetime-local"
            class="field-input"
            required
            :min="minDateTime"
          />
          <p class="field-hint">{{ $t('calendar.createLesson.timeHint') }}</p>
        </div>

        <!-- Order Selection -->
        <div class="form-field">
          <label for="order" class="field-label">
            {{ $t('calendar.createLesson.student') }}
            <span class="required">*</span>
          </label>
          <select
            id="order"
            v-model="formData.orderId"
            class="field-select"
            required
            @change="handleOrderChange"
            aria-required="true"
          >
            <option value="">{{ $t('calendar.createLesson.selectStudent') }}</option>
            <option
              v-for="order in availableOrders"
              :key="order.id"
              :value="order.id"
            >
              {{ order.clientName }}
            </option>
          </select>
        </div>

        <!-- Duration Selection -->
        <div class="form-field">
          <label for="duration" class="field-label">
            {{ $t('calendar.createLesson.duration') }}
            <span class="required">*</span>
          </label>
          <div class="duration-buttons" role="group" aria-label="Тривалість уроку">
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 30 }]"
              @click="formData.durationMin = 30"
              :aria-pressed="formData.durationMin === 30"
            >
              30 {{ $t('booking.common.minutes') }}
            </button>
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 60 }]"
              @click="formData.durationMin = 60"
              :aria-pressed="formData.durationMin === 60"
            >
              60 {{ $t('booking.common.minutes') }}
            </button>
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 90 }]"
              @click="formData.durationMin = 90"
              :aria-pressed="formData.durationMin === 90"
            >
              90 {{ $t('booking.common.minutes') }}
            </button>
          </div>
        </div>

        <!-- Regularity Selection -->
        <div class="form-field">
          <label for="regularity" class="field-label">
            {{ $t('calendar.createLesson.regularity') }}
          </label>
          <select
            id="regularity"
            v-model="formData.regularity"
            class="field-select"
          >
            <option value="single">{{ $t('booking.calendar.regularity.single') }}</option>
            <option value="once_a_week">{{ $t('booking.calendar.regularity.once_a_week') }}</option>
            <option value="twice_a_week">{{ $t('booking.calendar.regularity.twice_a_week') }}</option>
          </select>
        </div>

        <!-- Comment -->
        <div class="form-field">
          <label for="comment" class="field-label">
            {{ $t('calendar.createLesson.comment') }}
          </label>
          <textarea
            id="comment"
            v-model="formData.tutorComment"
            class="field-textarea"
            rows="3"
            :placeholder="$t('calendar.createLesson.commentPlaceholder')"
          />
        </div>

        <!-- Time Validation Error -->
        <div v-if="formData.start && !isTimeValid" class="warning-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ t('calendar.errors.invalidTime') }}</p>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ error }}</p>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button
            type="button"
            @click="handleClose"
            class="btn-secondary"
            :disabled="isSubmitting"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="btn-primary"
            :disabled="!isFormValid || isSubmitting"
          >
            <LoaderIcon v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            {{ $t('calendar.createLesson.create') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, Calendar as CalendarIcon, Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import { sanitizeComment } from '@/utils/sanitize'
import type { CalendarCell, CreateEventPayload } from '@/modules/booking/types/calendarWeek'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  visible: boolean
  selectedCell: CalendarCell
}>()

const emit = defineEmits<{
  close: []
  success: [eventId: number]
}>()

const { t } = useI18n()
const store = useCalendarWeekStore()
const { ordersArray } = storeToRefs(store)
const toast = useToast()
const { handleError } = useErrorHandler()

const modalRef = ref<HTMLElement | null>(null)
useFocusTrap(modalRef, {
  onEscape: handleClose,
  initialFocus: true,
})

const formData = ref<CreateEventPayload>({
  orderId: 0,
  start: '',
  durationMin: 60,
  regularity: 'single',
  tutorComment: '',
})

const isSubmitting = ref(false)
const error = ref<string | null>(null)

const availableOrders = computed(() => ordersArray.value)

const selectedOrder = computed(() => {
  return ordersArray.value.find(o => o.id === formData.value.orderId)
})

const availableDurations = computed(() => {
  if (!selectedOrder.value) return [30, 60, 90]
  return selectedOrder.value.durations
})

const isTimeValid = computed(() => {
  if (!formData.value.start) return false
  const selectedTime = new Date(formData.value.start)
  const now = new Date()
  
  // Перевірка: не в минулому
  if (selectedTime < now) return false
  
  // Перевірка: не пізніше ніж через 6 місяців
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
  if (selectedTime > sixMonthsLater) return false
  
  return true
})

const isFormValid = computed(() => {
  return formData.value.orderId > 0 && formData.value.durationMin > 0 && formData.value.start !== '' && isTimeValid.value
})

const minDateTime = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
})

watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm()
  }
})

function resetForm() {
  // Конвертувати UTC час клітинки в локальний datetime-local формат
  const cellDate = new Date(props.selectedCell.startAtUTC)
  const year = cellDate.getFullYear()
  const month = String(cellDate.getMonth() + 1).padStart(2, '0')
  const day = String(cellDate.getDate()).padStart(2, '0')
  const hours = String(cellDate.getHours()).padStart(2, '0')
  const minutes = String(cellDate.getMinutes()).padStart(2, '0')
  const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
  
  formData.value = {
    orderId: 0,
    start: localDateTime,
    durationMin: 60,
    regularity: 'single',
    tutorComment: '',
  }
  error.value = null
}

function handleOrderChange() {
  if (selectedOrder.value && !selectedOrder.value.durations.includes(formData.value.durationMin)) {
    formData.value.durationMin = selectedOrder.value.durations[0] || 60
  }
}

async function handleSubmit() {
  if (!isFormValid.value) return
  
  isSubmitting.value = true
  error.value = null
  
  try {
    // Конвертувати локальний datetime-local в ISO 8601 з локальним offset (не втрачати час)
    const localDate = new Date(formData.value.start)
    const formatWithOffset = (date: Date) => {
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
    const isoString = formatWithOffset(localDate)
    
    const payload = {
      orderId: formData.value.orderId,
      start: isoString,
      durationMin: formData.value.durationMin,
      regularity: formData.value.regularity,
      tutorComment: sanitizeComment(formData.value.tutorComment || ''),
      notifyStudent: true,
      autoGenerateZoom: false,
    }
    
    const eventId = await store.createEvent(payload)
    
    console.info('[CreateLessonModal] Lesson created:', eventId)
    emit('success', eventId)
    emit('close')
  } catch (err: any) {
    console.error('[CreateLessonModal] Submit error:', err)
    handleError(err, t('calendar.errors.createFailed'))
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
  }
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
  max-width: 500px;
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

.modal-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #eff6ff;
  border-radius: 8px;
  border: 1px solid #dbeafe;
}

.time-label {
  font-size: 12px;
  color: #6b7280;
}

.time-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
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

.required {
  color: #ef4444;
}

.field-select,
.field-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-select:focus,
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

.warning-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
  font-size: 14px;
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

.field-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.field-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn-secondary,
.btn-primary {
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

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
