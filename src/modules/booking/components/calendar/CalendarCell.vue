<template>
  <div
    :class="cellClasses"
    :data-utc-key="cell.startAtUTC"
    @click="handleClick($event)"
  >
    <div v-if="cell.isDraft" class="draft-indicator">
      <PencilIcon class="w-3 h-3" />
    </div>
    
    <div v-if="cell.booking" class="cell-booking">
      <span class="student-name">{{ cell.booking.student.name }}</span>
    </div>
    
    <div v-else-if="cell.status === 'available'" class="cell-available">
      <span class="time-label">{{ formatTime(cell.startAtUTC) }}</span>
    </div>
    
    <div v-else-if="cell.status === 'blocked'" class="cell-blocked">
      <LockIcon class="w-3 h-3" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Lock as LockIcon, Pencil as PencilIcon } from 'lucide-vue-next'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import { formatInTimezone } from '@/utils/timezone'

const props = defineProps<{
  cell: CalendarCell
  timezone?: string
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const cellClasses = computed(() => [
  'calendar-cell',
  `cell-${props.cell.status}`,
  {
    'cell-has-booking': !!props.cell.booking,
    'cell-clickable': props.cell.status !== 'empty',
    'cell-draft': props.cell.isDraft,
  },
])

function formatTime(utcTime: string): string {
  if (props.timezone) {
    return formatInTimezone(utcTime, props.timezone)
  }
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<style scoped>
.calendar-cell {
  height: 40px;
  border-bottom: 1px solid #e5e7eb;
  padding: 4px;
  cursor: default;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.cell-clickable {
  cursor: pointer;
}

.cell-clickable:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.cell-empty {
  background-color: #fafafa;
}

.cell-available {
  background-color: #dbeafe;
}

.cell-available:hover {
  background-color: #bfdbfe;
}

.cell-blocked {
  background-color: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-blocked:hover {
  background-color: #fecaca;
}

.cell-has-booking {
  background-color: #86efac;
}

.cell-draft {
  border: 2px dashed #f59e0b;
  background-color: #fef3c7;
}

.draft-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #fbbf24;
  border-radius: 50%;
  padding: 2px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.cell-booking {
  display: flex;
  align-items: center;
  height: 100%;
}

.student-name {
  font-size: 12px;
  font-weight: 500;
  color: #065f46;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-label {
  font-size: 10px;
  color: #6b7280;
}
</style>
