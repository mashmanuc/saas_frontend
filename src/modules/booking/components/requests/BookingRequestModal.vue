<template>
  <Modal :open="visible" :title="$t('booking.request.title')" size="md" @close="handleClose">
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

      <Textarea
        v-model="message"
        :label="$t('booking.request.message')"
        :placeholder="$t('booking.request.messagePlaceholder')"
        :rows="4"
      />

      <div v-if="error" class="error-message">
        <AlertCircleIcon class="w-5 h-5" />
        <p>{{ error }}</p>
      </div>
    </form>

    <template #footer>
      <Button variant="outline" @click="handleClose">
        {{ $t('common.cancel') }}
      </Button>
      <Button variant="primary" :loading="submitting" @click="handleSubmit">
        {{ $t('booking.request.send') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Calendar as CalendarIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { bookingRequestsApi } from '@/modules/booking/api/bookingRequestsApi'
import { useToast } from '@/composables/useToast'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

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
  background-color: var(--accent-bg, #eff6ff);
  border-radius: var(--radius-md);
}

.slot-date {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.slot-time {
  font-size: 14px;
  color: var(--text-secondary);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.duration-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.duration-btn {
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: all 0.2s;
}

.duration-btn:hover {
  border-color: var(--accent);
  background-color: var(--accent-bg, #eff6ff);
}

.duration-btn.active {
  border-color: var(--accent);
  background-color: var(--accent);
  color: white;
  font-weight: 500;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--danger-bg, #fee2e2);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 14px;
}
</style>
