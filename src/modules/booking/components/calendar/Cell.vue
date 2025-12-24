<template>
  <div
    :class="cellClasses"
    :data-day-key="cell.dayKey"
    :data-slot-index="cell.slotIndex"
    :data-utc-key="cell.startAtUTC"
    role="button"
    :tabindex="cell.status !== 'notAllow' ? 0 : -1"
    :aria-disabled="cell.status === 'notAllow'"
    :aria-label="ariaLabel"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <span v-if="showTime" class="time-label">{{ formatTime(cell.startAtUTC) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CalendarCell } from '@/modules/booking/types/calendarWeek'

const { t } = useI18n()

const props = defineProps<{
  cell: CalendarCell
  timezone: string
}>()

const emit = defineEmits<{
  click: []
}>()

const cellClasses = computed(() => [
  'calendar-cell',
  `cell-${props.cell.status}`,
  {
    'cell-clickable': props.cell.status !== 'notAllow' && props.cell.status !== 'booked',
  },
])

const showTime = computed(() => {
  return props.cell.slotIndex % 2 === 0 && (props.cell.status === 'available' || props.cell.status === 'empty')
})

const ariaLabel = computed(() => {
  const time = formatTime(props.cell.startAtUTC)
  const statusLabel = t(`calendar.cellStatus.${props.cell.status}`)
  return `${statusLabel} о ${time}`
})

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: props.timezone,
  })
}

function handleClick() {
  if (props.cell.status === 'notAllow' || props.cell.status === 'booked') return
  emit('click')
}
</script>

<style scoped>
.calendar-cell {
  height: 36px;
  min-height: 36px;
  border-bottom: 1px solid #f3f4f6;
  padding: 4px 8px;
  cursor: default;
  transition: all 0.15s ease;
  position: relative;
  outline: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.cell-clickable {
  cursor: pointer;
}

.cell-clickable:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.cell-clickable:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
  z-index: 1;
}

.cell-empty {
  background-color: #ffffff;
}

.cell-available {
  background-color: #dbeafe;
}

.cell-available:hover {
  background-color: #bfdbfe;
}

.cell-booked {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.cell-blocked {
  background-color: #fafafa;
  cursor: not-allowed;
}

.cell-notAllow {
  background-color: #fee2e2;
  cursor: not-allowed;
  opacity: 0.5;
}

.time-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}
</style>
