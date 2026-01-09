<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookingStore } from '../store/bookingStore'
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-vue-next'

const props = defineProps<{
  bookingId: string
}>()

const { t } = useI18n()
const bookingStore = useBookingStore()

const booking = computed(() => bookingStore.bookings[props.bookingId])
const timeline = computed(() => booking.value?.timeline || [])

const statusIcon = {
  created: Calendar,
  confirmed: CheckCircle,
  canceled: XCircle
}

function getTimelineEventLabel(eventType: string | null | undefined): string {
  switch (eventType) {
    case 'lesson_cancelled':
      return t('booking.timeline.events.lesson_cancelled')
    case 'lesson_completed':
      return t('booking.timeline.events.lesson_completed')
    case 'lesson_scheduled':
      return t('booking.timeline.events.lesson_scheduled')
    case 'payment_pending':
      return t('booking.timeline.events.payment_pending')
    case 'payment_received':
      return t('booking.timeline.events.payment_received')
    case 'request_accepted':
      return t('booking.timeline.events.request_accepted')
    case 'request_cancelled':
      return t('booking.timeline.events.request_cancelled')
    case 'request_created':
      return t('booking.timeline.events.request_created')
    case 'request_pending':
      return t('booking.timeline.events.request_pending')
    case 'request_rejected':
      return t('booking.timeline.events.request_rejected')
    case 'template_applied':
      return t('booking.timeline.events.template_applied')
    case 'template_failed':
      return t('booking.timeline.events.template_failed')
    default:
      return eventType ? eventType : ''
  }
}

async function loadBooking() {
  await bookingStore.fetchBooking(props.bookingId)
}

onMounted(() => {
  loadBooking()
})
</script>

<template>
  <div class="booking-timeline">
    <h3>{{ t('booking.timeline.title') }}</h3>

    <div v-if="timeline.length === 0" class="empty">
      {{ t('booking.timeline.empty') }}
    </div>

    <div v-else class="timeline">
      <div
        v-for="(event, idx) in timeline"
        :key="idx"
        class="timeline-item"
      >
        <div class="icon">
          <component :is="statusIcon[event.event] || Clock" :size="20" />
        </div>
        <div class="content">
          <h4>{{ getTimelineEventLabel(event.event) }}</h4>
          <p class="actor">{{ t('booking.timeline.by', { actor: event.actor }) }}</p>
          <p class="timestamp">{{ event.timestamp }}</p>
          <p v-if="event.request_id" class="request-id">
            {{ t('booking.timeline.requestId') }}: {{ event.request_id }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.booking-timeline {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.booking-timeline h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
}

.empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 30px;
  bottom: 30px;
  width: 2px;
  background: var(--border-color);
}

.timeline-item {
  display: flex;
  gap: 1rem;
  position: relative;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--surface-card);
  border: 2px solid var(--border-color);
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
}

.content {
  flex: 1;
  padding-top: 0.25rem;
}

.content h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.375rem 0;
  color: var(--text-primary);
}

.actor {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem 0;
}

.timestamp {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin: 0 0 0.25rem 0;
}

.request-id {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-tertiary);
  margin: 0;
}
</style>
