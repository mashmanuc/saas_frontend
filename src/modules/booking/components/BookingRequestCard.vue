<template>
  <div class="booking-request-card">
    <div class="card-header">
      <div class="student-info">
        <div class="avatar">
          <img v-if="request.student.avatar_url" :src="request.student.avatar_url" :alt="request.student.display_name || request.student.full_name || 'Student'" />
          <UserIcon v-else class="w-6 h-6 text-gray-400" />
        </div>
        <div class="student-details">
          <h4>{{ request.student.display_name || request.student.full_name }}</h4>
          <p class="time">{{ formatDateTime(request.start_datetime) }}</p>
        </div>
      </div>
      <span :class="`status-badge status-${request.status}`">
        {{ $t(`booking.requestStatus.${request.status}`) }}
      </span>
    </div>

    <div class="card-body">
      <div class="detail">
        <ClockIcon class="w-4 h-4 text-gray-500" />
        <span>{{ request.duration_minutes }} {{ $t('common.minutes') }}</span>
      </div>

      <div v-if="request.student_message" class="message">
        <p>{{ request.student_message }}</p>
      </div>

      <div v-if="request.tutor_response" class="response">
        <strong>{{ $t('booking.yourResponse') }}:</strong>
        <p>{{ request.tutor_response }}</p>
      </div>
    </div>

    <div v-if="request.status === 'pending'" class="card-actions">
      <Button variant="outline" :disabled="processing" @click="handleReject">
        <template #iconLeft><XIcon class="w-4 h-4" /></template>
        {{ $t('common.reject') }}
      </Button>
      <Button variant="primary" :disabled="processing" @click="handleAccept">
        <template #iconLeft><CheckIcon class="w-4 h-4" /></template>
        {{ $t('common.accept') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { User as UserIcon, Clock as ClockIcon, X as XIcon, Check as CheckIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  request: {
    id: number
    student: {
      id: number
      display_name?: string  // Privacy-safe: "Ivan P."
      full_name?: string     // Only after accept
      avatar_url?: string
      rating?: number
    }
    start_datetime: string
    end_datetime: string
    duration_minutes: number
    status: string
    student_message?: string
    tutor_response?: string
    created_at: string
    expires_at?: string
  }
}>()

const emit = defineEmits<{
  accept: [requestId: number]
  reject: [requestId: number, reason: string]
}>()

const processing = ref(false)

function formatDateTime(datetime: string): string {
  const date = new Date(datetime)
  return date.toLocaleString('uk-UA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleAccept() {
  processing.value = true
  emit('accept', props.request.id)
}

function handleReject() {
  processing.value = true
  emit('reject', props.request.id, '')
}
</script>

<style scoped>
.booking-request-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.booking-request-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.student-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.student-details h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.student-details .time {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending {
  background-color: var(--warning-bg, #fef3c7);
  color: var(--warning-text, #92400e);
}

.status-accepted {
  background-color: var(--success-bg, #d1fae5);
  color: var(--success-text, #065f46);
}

.status-rejected {
  background-color: var(--danger-bg, #fee2e2);
  color: var(--danger-text, #991b1b);
}

.status-cancelled {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
}

.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.message,
.response {
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  font-size: 14px;
}

.message p,
.response p {
  margin: 0;
  color: var(--text-primary);
  line-height: 1.5;
}

.response strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

</style>
