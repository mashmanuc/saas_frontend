<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ $t('booking.manualBooking.title') }}</h2>
        <button @click="handleClose" class="close-btn">
          <XIcon class="w-5 h-5" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="booking-form">
        <div class="form-field">
          <label>{{ $t('booking.manualBooking.student') }}</label>
          <StudentAutocomplete
            v-model="selectedStudent"
            :recent-students="recentStudents"
            :search-results="bookingStore.searchResults"
            @search="handleStudentSearch"
          />
          <span v-if="validationErrors.student" class="field-error">
            {{ validationErrors.student }}
          </span>
        </div>
        
        <div class="form-field">
          <label>{{ $t('booking.manualBooking.startTime') }}</label>
          <input
            type="text"
            :value="formatTime(cell.startAtUTC)"
            disabled
            class="input-disabled"
          />
        </div>
        
        <div class="form-field">
          <label>{{ $t('booking.manualBooking.duration') }}</label>
          <div class="duration-selector">
            <button
              v-for="duration in [30, 60, 90]"
              :key="duration"
              type="button"
              :class="['duration-btn', { active: selectedDuration === duration }]"
              @click="selectedDuration = duration"
            >
              {{ duration }} {{ $t('common.minutes') }}
            </button>
          </div>
        </div>
        
        <div class="form-field">
          <label>{{ $t('booking.manualBooking.notes') }}</label>
          <textarea
            v-model="notes"
            :placeholder="$t('booking.manualBooking.notesPlaceholder')"
            rows="3"
            class="textarea"
          />
        </div>
        
        <div v-if="error" class="error-message">
          <AlertCircleIcon class="w-5 h-5" />
          <div>
            <p class="font-semibold">{{ errorTitle }}</p>
            <p class="text-sm">{{ errorMessage }}</p>
            <button
              v-if="errorSuggestion"
              @click="handleSuggestion"
              type="button"
              class="text-blue-600 text-sm underline mt-2"
            >
              {{ errorSuggestion }}
            </button>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" @click="handleClose" class="btn-secondary">
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="!selectedStudent || submitting"
            class="btn-primary"
          >
            <LoaderIcon v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ $t('booking.manualBooking.createLesson') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { X as XIcon, Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useBookingStore } from '@/modules/booking/stores/bookingStore'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import StudentAutocomplete from '../common/StudentAutocomplete.vue'

const props = defineProps<{
  visible: boolean
  cell: CalendarCell
}>()

const emit = defineEmits<{
  close: []
  success: [lessonId: number]
}>()

const bookingStore = useBookingStore()

const selectedStudent = ref<any>(null)
const selectedDuration = ref(60)
const notes = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const validationErrors = ref<Record<string, string>>({})

const recentStudents = computed(() => bookingStore.recentStudents || [])

const errorTitle = computed(() => {
  if (error.value?.includes('tutor_overlap')) {
    return 'У вас вже є урок у цей час'
  } else if (error.value?.includes('student_overlap')) {
    return 'Учень вже має урок у цей час'
  }
  return 'Помилка'
})

const errorMessage = computed(() => {
  if (error.value?.includes('overlap')) {
    return 'Спробуйте вибрати інший час або перевірте існуючі уроки.'
  }
  return error.value
})

const errorSuggestion = computed(() => {
  if (error.value?.includes('overlap')) {
    return 'Переглянути календар →'
  }
  return null
})

function validateForm() {
  validationErrors.value = {}
  
  if (!selectedStudent.value) {
    validationErrors.value.student = 'Оберіть учня'
  }
  
  if (selectedDuration.value < 30) {
    validationErrors.value.duration = 'Мінімальна тривалість 30 хвилин'
  }
  
  return Object.keys(validationErrors.value).length === 0
}

async function handleSubmit() {
  if (!validateForm()) return
  if (!selectedStudent.value) return
  
  submitting.value = true
  error.value = null
  
  try {
    const lesson = await bookingStore.createManualBooking({
      studentId: selectedStudent.value.id,
      startAtUTC: props.cell.startAtUTC,
      durationMin: selectedDuration.value,
      notes: notes.value,
    })
    
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('booking.manual_created', {
        student_id: selectedStudent.value.id,
        duration: selectedDuration.value,
      })
    }
    
    emit('success', lesson.id)
    handleClose()
    
  } catch (err: any) {
    if (err.response?.data?.error === 'tutor_overlap') {
      error.value = 'tutor_overlap'
    } else if (err.response?.data?.error === 'student_overlap') {
      error.value = 'student_overlap'
    } else {
      error.value = err.message || 'Помилка при створенні уроку'
    }
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  selectedStudent.value = null
  selectedDuration.value = 60
  notes.value = ''
  error.value = null
  validationErrors.value = {}
  emit('close')
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleString('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

async function handleStudentSearch(query: string) {
  await bookingStore.searchStudents(query)
}

function handleSuggestion() {
  emit('close')
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
}

.modal-container {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: #f3f4f6;
}

.booking-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.input-disabled {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background-color: #f9fafb;
  color: #6b7280;
}

.duration-selector {
  display: flex;
  gap: 8px;
}

.duration-btn {
  flex: 1;
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  transition: all 0.15s;
  font-size: 14px;
}

.duration-btn.active {
  border-color: #3b82f6;
  background-color: #eff6ff;
  color: #1e40af;
  font-weight: 500;
}

.textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
}

.textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  font-size: 14px;
}

.field-error {
  color: #dc2626;
  font-size: 12px;
  margin-top: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
