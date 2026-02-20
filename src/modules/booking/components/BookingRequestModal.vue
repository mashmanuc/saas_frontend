<template>
  <Modal :open="show" :title="$t('booking.requestBooking.title')" size="sm" @close="close">
    <div class="booking-details">
      <div class="detail-row">
        <CalendarIcon class="w-4 h-4 detail-icon" />
        <span>{{ formatDate(cell.start) }}</span>
      </div>
      <div class="detail-row">
        <ClockIcon class="w-4 h-4 detail-icon" />
        <span>{{ formatTime(cell.start) }}</span>
      </div>
      <div class="detail-row">
        <UserIcon class="w-4 h-4 detail-icon" />
        <span>{{ tutor.full_name }}</span>
      </div>
    </div>

    <div class="form-group">
      <label for="duration">{{ $t('booking.requestBooking.duration') }}</label>
      <select id="duration" v-model="duration" class="input">
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
        class="input"
        maxlength="500"
      />
      <span class="char-count">{{ message.length }}/500</span>
    </div>

    <template #footer>
      <Button variant="outline" :disabled="submitting" @click="close">
        {{ $t('common.cancel') }}
      </Button>
      <Button variant="primary" :loading="submitting" @click="submit">
        {{ $t('booking.requestBooking.sendRequest') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Calendar as CalendarIcon, Clock as ClockIcon, User as UserIcon } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
.booking-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-lg);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.detail-icon {
  color: var(--text-secondary);
}

.form-group {
  margin-bottom: var(--space-md);
}

.form-group label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.char-count {
  display: block;
  text-align: right;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
