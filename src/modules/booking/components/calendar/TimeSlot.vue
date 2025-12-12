<script setup lang="ts">
// F11: Time Slot Component
import { computed } from 'vue'
import type { TimeSlot } from '../../api/booking'

const props = defineProps<{
  slot: TimeSlot
}>()

defineEmits<{
  click: []
}>()

const statusClass = computed(() => {
  return `status-${props.slot.status}`
})

const timeLabel = computed(() => {
  return `${props.slot.start_time.slice(0, 5)} - ${props.slot.end_time.slice(0, 5)}`
})

const isClickable = computed(() => {
  return props.slot.status === 'available' || props.slot.status === 'blocked'
})
</script>

<template>
  <div
    class="time-slot"
    :class="[statusClass, { clickable: isClickable }]"
    @click="isClickable && $emit('click')"
  >
    <span class="slot-time">{{ timeLabel }}</span>
    <span class="slot-status">{{ slot.status }}</span>
  </div>
</template>

<style scoped>
.time-slot {
  position: absolute;
  left: 4px;
  right: 4px;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.15s;
}

.time-slot.clickable {
  cursor: pointer;
}

.time-slot.clickable:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Available */
.time-slot.status-available {
  background: var(--color-success-light, #d1fae5);
  border: 1px solid var(--color-success, #10b981);
  color: var(--color-success-dark, #065f46);
}

/* Booked */
.time-slot.status-booked {
  background: var(--color-primary-light, #dbeafe);
  border: 1px solid var(--color-primary, #3b82f6);
  color: var(--color-primary-dark, #1e40af);
  cursor: default;
}

/* Blocked */
.time-slot.status-blocked {
  background: var(--color-bg-tertiary, #e5e7eb);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-secondary, #6b7280);
}

.slot-time {
  font-weight: 600;
}

.slot-status {
  text-transform: capitalize;
  opacity: 0.8;
}
</style>
