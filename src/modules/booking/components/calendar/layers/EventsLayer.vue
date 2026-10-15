<template>
  <div class="events-layer">
    <div
      v-for="event in events"
      :key="event.id"
      class="event-card"
      data-testid="lesson-card"
      :data-lesson-id="event.id"
      :class="{
        'is-past': isPastFn(event.start),
        'is-no-show': event.status === 'no_show',
        'is-cancelled': event.status === 'cancelled',
        [`event-card--pay-${markOf(event)}`]: Boolean(markOf(event))
      }"
      :title="markOf(event) ? t(`calendar.paymentMark.${markOf(event)}Title`) : undefined"
      :style="getEventStyle(event)"
      @click="$emit('event-click', event)"
      @mousedown="handleEventMouseDown(event, $event)"
    >
      <div class="event-student">
        <!-- ₴ у першому рядку: на низькій 60-хв картці другий рядок обрізається, а цей видно завжди -->
        <span
          v-if="markOf(event)"
          class="event-pay-chip"
          :class="`event-pay-chip--${markOf(event)}`"
          :data-testid="`lesson-pay-chip-${event.id}`"
          aria-hidden="true"
        >₴</span>{{ getStudentName(event) }}
      </div>
      <!-- Залишок передоплати (2026-10-15): на місці часу (час видно з сітки) — інакше на 60-хв картці обрізається -->
      <div
        v-if="markOf(event) && hasSecondLine(event)"
        class="event-pay"
        :class="`event-pay--${markOf(event)}`"
        :data-testid="`lesson-pay-${event.id}`"
      >
        {{ t(`calendar.paymentMark.${markOf(event)}`) }}
      </div>
      <div v-else class="event-time" data-testid="lesson-time">{{ formatTimeRange(event) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'

dayjs.extend(utc)
dayjs.extend(timezone)

interface Student {
  id: number
  name: string
}

interface CalendarEvent {
  id: number
  start: string
  end: string
  status: string
  is_first?: boolean
  student?: Student
  clientName?: string
}

const props = defineProps<{
  events: CalendarEvent[]
  pxPerMinute: number
  isPastFn: (datetime: string) => boolean
  timezone?: string
  /** Залишок передоплати (2026-10-15): { [eventId]: 'last' | 'unpaid' } */
  paymentMarks?: Record<string, 'last' | 'unpaid'>
}>()

const { t } = useI18n()

function markOf(event: CalendarEvent): 'last' | 'unpaid' | null {
  return props.paymentMarks?.[String(event.id)] ?? null
}

/** Чи влазить другий рядок (плашка з текстом); на низькій картці її край визирав би знизу — там лише ₴ і смуга */
const SECOND_LINE_MIN_PX = 46
function hasSecondLine(event: CalendarEvent): boolean {
  return calculateHeightPx(event.start, event.end) >= SECOND_LINE_MIN_PX
}

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'drag-start': [event: CalendarEvent, mouseEvent: MouseEvent]
}>()

const tz = computed(() => props.timezone || 'UTC')
const { formatTime, calculateTopPx, calculateHeightPx } = useCalendarGrid({
  timezone: tz.value,
  pxPerMinute: props.pxPerMinute,
})

const handleEventMouseDown = (event: CalendarEvent, mouseEvent: MouseEvent) => {
  if (!props.isPastFn(event.start)) {
    emit('drag-start', event, mouseEvent)
  }
}

const getEventStyle = (event: CalendarEvent) => {
  const topPx = calculateTopPx(event.start)
  const heightPx = calculateHeightPx(event.start, event.end)

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`
  }
}

const getStudentName = (event: CalendarEvent): string => {
  if (event.student?.name && event.student.name.trim()) {
    return event.student.name.trim()
  }
  if (event.clientName && event.clientName.trim()) {
    return event.clientName.trim()
  }
  return ''
}

const formatTimeRange = (event: CalendarEvent): string => {
  const from = formatTime(event.start)
  const to = formatTime(event.end)
  return `${from} – ${to}`
}
</script>

<style scoped>
.events-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;
}

.event-card {
  position: absolute;
  left: 8px;
  right: 8px;
  min-height: 32px;
  background: #4caf50;
  color: #0a2f16;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
  border: 1px solid #2e7d32;
}

.event-card.is-past {
  opacity: 0.6;
  cursor: default;
}

/* Залишок передоплати (2026-10-15): смуга ліворуч видна й на найменшій картці */
.event-card--pay-last {
  border-left: 4px solid #f59e0b;
}

.event-card--pay-unpaid {
  border-left: 4px solid #dc2626;
}

.event-pay-chip {
  display: inline-block;
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  line-height: 14px;
  vertical-align: 1px;
}

.event-pay-chip--last {
  background: #fef3c7;
  color: #92400e;
}

.event-pay-chip--unpaid {
  background: #fee2e2;
  color: #991b1b;
}

.event-pay {
  display: inline-block;
  margin-top: 2px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-pay--last {
  background: #fef3c7;
  color: #92400e;
}

.event-pay--unpaid {
  background: #fee2e2;
  color: #991b1b;
}

.event-card.is-no-show {
  background: #9e9e9e;
  border-color: #757575;
  color: #f5f5f5;
}

.event-card.is-cancelled {
  background: #f87171;
  border-color: #ef4444;
  color: #7f1d1d;
}

.event-card:not(.is-past):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.event-student {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
  color: #041b0c;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.event-time {
  font-size: 12px;
  opacity: 0.95;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .event-card {
  background: var(--color-success);
  color: var(--color-on-accent);
  border-color: var(--color-success);
}
[data-theme="dark"] .event-card.is-no-show {
  background: var(--color-border-strong);
  border-color: var(--color-border-strong);
}
[data-theme="dark"] .event-card.is-cancelled {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
  color: var(--color-danger);
}
[data-theme="dark"] .event-student {
  color: var(--color-text);
}
</style>
