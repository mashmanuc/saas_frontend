<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ $t('booking.request.title') }}</h2>
        <button @click="handleClose" class="close-btn">
          <XIcon class="w-5 h-5" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="request-form">
        <div class="slot-info">
          <CalendarIcon class="w-5 h-5" />
          <div>
            <p class="slot-date">{{ formatDate(slot.startAtUTC) }}</p>
            <p class="slot-time">{{ formatTime(slot.startAtUTC) }}</p>
          </div>
        </div>
        
        <div class="form-field">
          <label>{{ $t('booking.request.duration') }}</label>
          <div class="duration-selector">
            <button
              v-for="duration in [30, 60, 90, 120]"
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
          <label>{{ $t('booking.request.message') }}</label>
          <textarea
            v-model="message"
            :placeholder="$t('booking.request.messagePlaceholder')"
            rows="4"
            class="textarea"
          />
        </div>
        
        <div v-if="error" class="error-message">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ error }}</p>
        </div>
        
        <div class="form-actions">
          <button type="button" @click="handleClose" class="btn-secondary">
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="btn-primary"
          >
            <LoaderIcon v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ $t('booking.request.send') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { X as XIcon, Calendar as CalendarIcon, Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { bookingRequestsApi } from '@/modules/booking/api/bookingRequestsApi'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  visible: boolean
  tutorId: number
  slot: { startAtUTC: string }
}>()

const emit = defineEmits<{
  close: []
  success: [requestId: number]
}>()

const selectedDuration = ref(60)
const message = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const toast = useToast()

async function handleSubmit() {
  submitting.value = true
  error.value = null
  
  try {
    const result = await bookingRequestsApi.create({
      tutor_id: props.tutorId,
      start_datetime: props.slot.startAtUTC,
      duration_minutes: selectedDuration.value,
      student_message: message.value,
    })
    
    toast.success('Запит надіслано!')
    emit('success', result.id)
    emit('close')
  } catch (err: any) {
    if (err.response?.data?.error === 'overlap_exists') {
      error.value = 'У вас вже є урок у цей час'
    } else {
      error.value = 'Не вдалося надіслати запит'
    }
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  emit('close')
}

function formatDate(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
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

.request-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.slot-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #eff6ff;
  border-radius: 8px;
}

.slot-date {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.slot-time {
  font-size: 14px;
  color: #6b7280;
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

.duration-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.duration-btn {
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.duration-btn:hover {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.duration-btn.active {
  border-color: #3b82f6;
  background-color: #3b82f6;
  color: white;
  font-weight: 500;
}

.textarea {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
}

.textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #fee2e2;
  border: 1px solid #ef4444;
  border-radius: 8px;
  color: #991b1b;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #3b82f6;
  color: white;
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}
</style>
