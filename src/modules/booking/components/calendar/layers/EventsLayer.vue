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
        'is-platform': isPlatform(event),
        'is-short': !hasTwoLines(event),
      }"
      :title="cardTitle(event)"
      :style="getEventStyle(event)"
      @click="$emit('event-click', event)"
      @mousedown="handleEventMouseDown(event, $event)"
    >
      <div class="event-line">
        <!-- Залишок оплачених уроків (власник 2026-10-17, О3): «₴3» = цей і ще 2 оплачені; «₴0» — не оплачено -->
        <span
          v-if="leftOf(event) !== null"
          class="event-pay-chip"
          :class="{ 'event-pay-chip--last': leftOf(event) === 1, 'event-pay-chip--unpaid': leftOf(event) === 0 }"
          :data-testid="`lesson-pay-chip-${event.id}`"
        >₴{{ leftOf(event) }}</span>
        <span class="event-student" :class="{ 'event-student--two': nameLines(event) === 2 }" data-testid="lesson-name">
          {{ getStudentName(event) }}
        </span>
        <span v-if="!hasTwoLines(event)" class="event-time-inline" data-testid="lesson-time">{{ formatTime(event.start) }}</span>
      </div>
      <div v-if="hasTwoLines(event)" class="event-time" data-testid="lesson-time">{{ formatTimeRange(event) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Вигляд уроку в розкладі вчителя (власник 2026-10-17; інваріанти В1–В4, К1–К2, О1–О7 у BOOKING_DOMAIN_SSOT):
// урок — на всю ширину колонки й рівно свою тривалість; імʼя й час читаються без обрізання; учень «З платформи» —
// інший колір; залишок оплачених уроків — лише значком (колір картки від оплати не залежить).
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
  /** Назва платформи, звідки учень (знімок тижня); порожньо — свій учень */
  platform?: string | null
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
  /** Залишок оплачених уроків (О3): { [eventId]: n }, n ≥ 1 — оплачено (разом із цим), 0 — не оплачено */
  paymentLeft?: Record<string, number>
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'drag-start': [event: CalendarEvent, mouseEvent: MouseEvent]
}>()

const tz = computed(() => props.timezone || 'UTC')
const { formatTime, calculateTopPx, calculateHeightPx } = useCalendarGrid({
  timezone: tz.value,
  pxPerMinute: props.pxPerMinute,
})

// Проміжок між сусідніми уроками (18:00 і 19:00 не зливаються в одну смугу)
const GAP_PX = 1
/** В2: два рядки (імʼя + час) — з уроку на годину; коротший — один рядок «Імʼя · 18:00» */
const TWO_LINES_MIN_MINUTES = 60
/** Імʼя у два рядки — лише коли картка має місце ще й під час */
const TWO_NAME_LINES_MIN_MINUTES = 90

function minutesOf(event: CalendarEvent): number {
  return Math.max(0, dayjs(event.end).diff(dayjs(event.start), 'minute'))
}
function hasTwoLines(event: CalendarEvent): boolean {
  return minutesOf(event) >= TWO_LINES_MIN_MINUTES
}
function nameLines(event: CalendarEvent): 1 | 2 {
  return minutesOf(event) >= TWO_NAME_LINES_MIN_MINUTES ? 2 : 1
}
function isPlatform(event: CalendarEvent): boolean {
  return Boolean(event.student?.platform && String(event.student.platform).trim())
}
function leftOf(event: CalendarEvent): number | null {
  const n = props.paymentLeft?.[String(event.id)]
  return typeof n === 'number' && n >= 0 ? n : null
}

const handleEventMouseDown = (event: CalendarEvent, mouseEvent: MouseEvent) => {
  if (!props.isPastFn(event.start)) {
    emit('drag-start', event, mouseEvent)
  }
}

const getEventStyle = (event: CalendarEvent) => {
  const topPx = calculateTopPx(event.start)
  const heightPx = calculateHeightPx(event.start, event.end)
  return {
    top: `${topPx + GAP_PX}px`,
    height: `${Math.max(heightPx - GAP_PX * 2, 10)}px`,
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

/** Підказка при наведенні: повне імʼя, час, звідки учень і оплата — словами */
function cardTitle(event: CalendarEvent): string {
  const parts = [getStudentName(event), formatTimeRange(event)]
  if (isPlatform(event)) parts.push(t('calendar.lessonCard.fromPlatform', { name: String(event.student?.platform).trim() }))
  const left = leftOf(event)
  if (left === 0) parts.push(t('calendar.lessonCard.unpaid'))
  else if (left !== null) parts.push(t('calendar.lessonCard.paidLeft', { n: left }))
  return parts.filter(Boolean).join(' · ')
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

/* В1: на всю ширину колонки дня (відступ 2 px) і рівно свою тривалість */
.event-card {
  position: absolute;
  left: 2px;
  right: 2px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 3px 6px;
  background: #2e7d32;
  color: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  pointer-events: auto;
  transition: box-shadow 0.15s, filter 0.15s;
  overflow: hidden;
  box-sizing: border-box;
}

/* К1: учень «З платформи» — синій; свій — зелений */
.event-card.is-platform {
  background: #1d4ed8;
}

.event-card.is-short {
  padding: 0 6px;
}

.event-card.is-past {
  opacity: 0.55;
  cursor: default;
}

.event-card.is-no-show {
  background: #9e9e9e;
  color: #ffffff;
}

.event-card.is-cancelled {
  background: #f87171;
  color: #7f1d1d;
}

.event-card:not(.is-past):hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22);
  filter: brightness(1.06);
}

.event-line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.event-student {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 700;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-student--two {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.event-time,
.event-time-inline {
  font-size: 11px;
  line-height: 14px;
  opacity: 0.92;
  white-space: nowrap;
}

.event-time-inline {
  flex: none;
}

/* О6: компактний значок не ховає імʼя й час */
.event-pay-chip {
  flex: none;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  line-height: 15px;
  background: #ffffff;
  color: #14532d;
}

.event-pay-chip--last {
  background: #fef3c7;
  color: #92400e;
}

.event-pay-chip--unpaid {
  background: #fee2e2;
  color: #991b1b;
}

/* ── Темна тема (Б-156): ті самі селектори, кольори токенами теми; текст на заливці — on-accent ── */
[data-theme="dark"] .event-card {
  background: var(--color-success);
  color: var(--color-on-accent);
}
[data-theme="dark"] .event-card.is-platform {
  background: var(--color-info);
  color: var(--color-on-accent);
}
[data-theme="dark"] .event-card.is-no-show {
  background: var(--color-border-strong);
  color: var(--color-text);
}
[data-theme="dark"] .event-card.is-cancelled {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
[data-theme="dark"] .event-pay-chip {
  background: var(--color-surface);
  color: var(--color-text);
}
/* на світлій заливці картки «м'які» тони зливались — суцільна заливка з темним текстом */
[data-theme="dark"] .event-pay-chip--last {
  background: var(--color-warning);
  color: var(--color-on-accent);
}
[data-theme="dark"] .event-pay-chip--unpaid {
  background: var(--color-danger);
  color: var(--color-on-accent);
}
</style>
