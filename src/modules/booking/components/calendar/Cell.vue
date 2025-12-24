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
  background: var(--calendar-status-available);
  opacity: 1;
}

.calendar-cell--blocked .cell-status-indicator {
  background: var(--calendar-status-blocked);
  opacity: 1;
}

.cell-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-xs) var(--space-sm);
  background: var(--text-primary);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 100;
}

.calendar-cell:hover .cell-tooltip {
  opacity: 1;
}
</style>
