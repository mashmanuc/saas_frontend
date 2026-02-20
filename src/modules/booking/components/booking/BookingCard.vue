<script setup lang="ts">
// F15: Booking Card Component
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Clock, User, BookOpen } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import type { Booking } from '../../api/booking'
import BookingStatus from './BookingStatus.vue'

const props = defineProps<{
  booking: Booking
  compact?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const router = useRouter()

const formattedDate = computed(() => {
  return new Date(props.booking.time_slot.start_datetime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
})

const formattedTime = computed(() => {
  const start = new Date(props.booking.time_slot.start_datetime)
  const end = new Date(props.booking.time_slot.end_datetime)
  return `${start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
})

const otherParty = computed(() => {
  // This would depend on current user role
  return props.booking.tutor
})

function viewDetails() {
  router.push(`/bookings/${props.booking.id}`)
}
</script>

<template>
  <div
    class="booking-card"
    :class="{ compact }"
    @click="viewDetails"
  >
    <div class="card-header">
      <BookingStatus :status="booking.status" />
      <span class="booking-id">#{{ booking.booking_id }}</span>
    </div>

    <div class="card-body">
      <!-- Date & Time -->
      <div class="info-row">
        <Calendar :size="16" />
        <span>{{ formattedDate }}</span>
      </div>
      <div class="info-row">
        <Clock :size="16" />
        <span>{{ formattedTime }}</span>
      </div>

      <!-- Subject -->
      <div class="info-row">
        <BookOpen :size="16" />
        <span>{{ booking.subject }}</span>
      </div>

      <!-- Other Party -->
      <div v-if="!compact" class="info-row">
        <User :size="16" />
        <span>{{ otherParty.display_name || otherParty.full_name }}</span>
      </div>
    </div>

    <!-- Actions for pending bookings -->
    <div v-if="booking.status === 'pending' && !compact" class="card-actions">
      <Button variant="primary" size="sm" @click.stop="emit('confirm')">
        Confirm
      </Button>
      <Button variant="danger" size="sm" @click.stop="emit('cancel')">
        Decline
      </Button>
    </div>

    <!-- Compact actions -->
    <div v-if="booking.status === 'pending' && compact" class="compact-actions">
      <Button variant="ghost" iconOnly size="sm" @click.stop="emit('confirm')">✓</Button>
      <Button variant="ghost" iconOnly size="sm" @click.stop="emit('cancel')">✕</Button>
    </div>

    <!-- Price -->
    <div class="card-price">
      {{ booking.currency }}{{ booking.price }}
    </div>
  </div>
</template>

<style scoped>
.booking-card {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.booking-card:hover {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.booking-card.compact {
  padding: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.booking-id {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}

.info-row svg {
  color: var(--color-text-secondary, #6b7280);
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-success {
  background: var(--color-success, #10b981);
  color: white;
}

.btn-success:hover {
  background: var(--color-success-dark, #059669);
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: white;
}

.btn-danger:hover {
  background: var(--color-danger-dark, #dc2626);
}

.compact-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn.confirm {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success, #10b981);
}

.action-btn.confirm:hover {
  background: var(--color-success, #10b981);
  color: white;
}

.action-btn.cancel {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}

.action-btn.cancel:hover {
  background: var(--color-danger, #ef4444);
  color: white;
}

.card-price {
  position: absolute;
  bottom: 16px;
  right: 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary, #3b82f6);
}

.compact .card-price {
  bottom: 12px;
  right: 12px;
  font-size: 14px;
}
</style>
