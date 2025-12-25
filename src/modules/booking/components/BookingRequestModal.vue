<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3>{{ $t('booking.requestBooking.title') }}</h3>
            <button @click="close" class="close-btn">
              <XIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="modal-body">
            <div class="booking-details">
              <div class="detail-row">
                <CalendarIcon class="w-4 h-4 text-gray-500" />
                <span>{{ formatDate(cell.start) }}</span>
              </div>
              <div class="detail-row">
                <ClockIcon class="w-4 h-4 text-gray-500" />
                <span>{{ formatTime(cell.start) }}</span>
              </div>
              <div class="detail-row">
                <UserIcon class="w-4 h-4 text-gray-500" />
                <span>{{ tutor.full_name }}</span>
              </div>
            </div>

            <div class="form-group">
              <label for="duration">{{ $t('booking.requestBooking.duration') }}</label>
              <select id="duration" v-model="duration" class="form-select">
                <option :value="30">30 {{ $t('common.minutes') }}</option>
                <option :value="60">60 {{ $t('common.minutes') }}</option>
                <option :value="90">90 {{ $t('common.minutes') }}</option>
                <option :value="120">120 {{ $t('common.minutes') }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="message">{{ $t('booking.requestBooking.message') }}</label>
              <textarea
                id="message"
                v-model="message"
                :placeholder="$t('booking.requestBooking.messagePlaceholder')"
                rows="4"
                class="form-textarea"
                maxlength="500"
              />
              <span class="char-count">{{ message.length }}/500</span>
            </div>
          </div>

          <div class="modal-footer">
            <button @click="close" class="btn-secondary" :disabled="submitting">
              {{ $t('common.cancel') }}
            </button>
            <button @click="submit" class="btn-primary" :disabled="submitting">
              <Loader2Icon v-if="submitting" class="w-4 h-4 animate-spin" />
              <span>{{ $t('booking.requestBooking.sendRequest') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { X as XIcon, Calendar as CalendarIcon, Clock as ClockIcon, User as UserIcon, Loader2 as Loader2Icon } from 'lucide-vue-next'
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
import { bookingApi } from '@/modules/booking/api/booking'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useRouter } from 'vue-router'

const props = defineProps<{
  show: boolean
  cell: CalendarEvent
  tutor: {
    id: number
    full_name: string
    avatar_url?: string
  }
}>()

const emit = defineEmits<{
  close: []
  success: [requestId: number]
}>()

const authStore = useAuthStore()
const router = useRouter()
const { success: showSuccess, error: showError } = useToast()

const duration = ref(60)
const message = ref('')
const submitting = ref(false)

function formatDate(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleDateString('uk-UA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function submit() {
  if (!authStore.isAuthenticated) {
    const currentPath = router.currentRoute.value.fullPath
    router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`)
    return
  }

  submitting.value = true

  try {
    const result = await bookingApi.createBookingRequest({
      tutor_id: props.tutor.id,
      start_datetime: props.cell.start,
      duration_minutes: duration.value,
      student_message: message.value.trim() || undefined,
    })

    showSuccess(`Request sent to ${props.tutor.full_name}`)
    emit('success', result.id)
    close()
  } catch (error: any) {
    if (error.code === 'slot_not_available') {
      showError('This time slot is no longer available')
    } else if (error.code === 'overlap_exists') {
      showError('You already have a booking at this time')
    } else {
      showError('Failed to send request')
    }
  } finally {
    submitting.value = false
  }
}

function close() {
  emit('close')
  duration.value = 60
  message.value = ''
}

function handleOverlayClick() {
  if (!submitting.value) {
    close()
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
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-btn {
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
  color: #6b7280;
}

.close-btn:hover {
  background-color: #f3f4f6;
}

.modal-body {
  padding: 24px;
}

.booking-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.15s;
}

.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  background-color: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f9fafb;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active {
  animation: modal-in 0.3s ease-out;
}

.modal-leave-active {
  animation: modal-out 0.2s ease-in;
}

@keyframes modal-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.modal-container {
  animation: modal-container-in 0.3s ease-out;
}

@keyframes modal-container-in {
  from {
    transform: scale(0.95) translateY(-20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
