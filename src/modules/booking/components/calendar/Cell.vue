<template>
  <div
    :class="cellClasses"
    :data-day-key="cell.dayKey"
    :data-slot-index="cell.slotIndex"
    :data-utc-key="cell.startAtUTC"
    role="gridcell"
    :tabindex="isInteractive ? 0 : -1"
    :aria-disabled="!isInteractive"
    :aria-label="ariaLabel"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <!-- Status indicator -->
    <div v-if="cell.status !== 'empty'" class="cell-status-indicator" />
    
    <!-- Hover tooltip -->
    <div v-if="isInteractive" class="cell-tooltip">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CalendarCell } from '@/modules/booking/types/calendarWeek'
import '@/styles/calendar-tokens.css'

const { t } = useI18n()

const props = defineProps<{
  cell: CalendarCell
  timezone: string
}>()

const emit = defineEmits<{
  click: []
}>()

const isInteractive = computed(() => {
  return props.cell.status === 'empty' || props.cell.status === 'available'
})

const cellClasses = computed(() => [
  'calendar-cell',
  `calendar-cell--${props.cell.status}`,
  {
    'calendar-cell--interactive': isInteractive.value,
    'calendar-cell--has-availability': props.cell.status === 'available',
  },
])

const ariaLabel = computed(() => {
  const time = formatTime(props.cell.startAtUTC)
  const statusLabel = t(`calendar.cellStatus.${props.cell.status}`)
  return `${time}, ${statusLabel}`
})

const tooltipText = computed(() => {
  if (props.cell.status === 'available') {
    return t('calendar.tooltips.clickToBook')
  }
  if (props.cell.status === 'empty') {
    return t('calendar.tooltips.clickToCreate')
  }
  return ''
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
  if (isInteractive.value) {
    emit('click')
  }
}
</script>

<style scoped>
.calendar-cell {
  border: 1px solid var(--calendar-border-color);
  border-radius: var(--calendar-border-radius);
  padding: var(--calendar-cell-padding);
  transition: background-color var(--calendar-transition-base), 
              transform var(--calendar-transition-fast);
  position: relative;
  min-height: var(--calendar-cell-height); /* Use CSS variable for consistent height */
}

.calendar-cell.calendar-cell--empty {
  background: var(--calendar-cell-empty);
}

.calendar-cell.calendar-cell--available {
  background: var(--calendar-cell-available);
  cursor: pointer;
}

.calendar-cell.calendar-cell--available:hover {
  background: var(--calendar-cell-available-hover);
  transform: scale(1.02);
}

.calendar-cell.calendar-cell--booked {
  background: var(--calendar-cell-booked);
}

.calendar-cell.calendar-cell--blocked {
  background: var(--calendar-cell-blocked);
  cursor: not-allowed;
}

.calendar-cell.calendar-cell--not-allow {
  background: var(--calendar-cell-not-allow);
  cursor: not-allowed;
}

/* Accessibility: focus state */
.calendar-cell:focus-visible {
  outline: var(--calendar-focus-ring);
  outline-offset: var(--calendar-focus-offset);
  z-index: 10;
}

.cell-status-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.calendar-cell--available .cell-status-indicator {
  background: #4caf50;
  opacity: 1;
}

.calendar-cell--blocked .cell-status-indicator {
  background: #9e9e9e;
  opacity: 1;
}

.cell-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 4px;
  font-size: var(--calendar-font-size-small);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--calendar-transition-base);
  z-index: 100;
  margin-bottom: 4px;
}

.calendar-cell:hover .cell-tooltip {
  opacity: 1;
}

/* Responsive: mobile touch targets */
@media (max-width: 768px) {
  .calendar-cell {
    min-height: var(--calendar-cell-height);
    padding: 6px;
  }
}
</style>
