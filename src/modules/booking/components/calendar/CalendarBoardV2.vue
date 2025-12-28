<template>
  <div class="calendar-board-v2">
    <template v-if="hasDays">
      <div class="calendar-header-row">
        <div class="time-column-header"></div>
        <div 
          v-for="day in days" 
          :key="day.date" 
          class="day-header-cell"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-name">{{ formatDayName(day.date) }}</div>
          <div class="day-date">{{ formatDayDate(day.date) }}</div>
        </div>
      </div>
      
      <div class="calendar-grid-container" :style="boardStyles">
        <div class="time-column">
          <div 
            v-for="hour in hours" 
            :key="hour"
            class="time-label"
            :style="{ height: `${pxPerMinute * 60}px` }"
          >
            {{ formatHour(hour) }}
          </div>
        </div>
        
        <div class="days-grid">
          <div v-for="day in days" :key="day.date" class="day-column">
            <GridLayer 
              :days="[day]" 
              :hours="hours" 
              :current-time="currentTime"
              :px-per-minute="pxPerMinute"
              :show-labels="false"
              @cell-click="(hour) => handleCellClick(day.date, hour)"
            />
            <AccessibleSlotsLayer
              :accessible-slots="accessibleSlotsForDay(day.date)"
              :px-per-minute="pxPerMinute"
              :timezone="timezone"
              @slot-click="handleSlotClick"
            />
            <AvailabilityLayer 
              :blocked-ranges="blockedRangesForDay(day.date)"
              :px-per-minute="pxPerMinute"
            />
            <EventsLayer 
              :events="eventsForDay(day.date)"
              :px-per-minute="pxPerMinute"
              :is-past-fn="isPast"
              :timezone="timezone"
              @event-click="handleEventClick"
              @drag-start="handleEventDragStart"
            />
          </div>
          <InteractionLayer 
            v-if="isDragEnabled"
            ref="interactionLayerRef"
            :px-per-minute="pxPerMinute"
            :is-drag-enabled="isDragEnabled"
            @drag-start="handleDragStart"
            @drag-move="handleDragMove"
            @drag-end="handleDragEnd"
          />
        </div>
      </div>
    </template>
    <div v-else class="calendar-empty-state">
      <h3>{{ t('calendar.emptyState.noAvailability.title') }}</h3>
      <p>{{ t('calendar.emptyState.noAvailability.description') }}</p>
      <div class="empty-actions">
        <button class="btn-primary" @click="$emit('open-quick-block')">
          {{ t('calendar.header.mark_free_time') }}
        </button>
        <button class="btn-link" @click="$emit('open-guide')">
          {{ t('calendar.guide.title') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'
import { useDragDrop } from '@/modules/booking/composables/useDragDrop'
import GridLayer from './layers/GridLayer.vue'
import AccessibleSlotsLayer from './layers/AccessibleSlotsLayer.vue'
import AvailabilityLayer from './layers/AvailabilityLayer.vue'
import EventsLayer from './layers/EventsLayer.vue'
import InteractionLayer from './layers/InteractionLayer.vue'
import type { CalendarEvent, DaySnapshot, BlockedRange } from '@/modules/booking/types/calendarV055'

interface AccessibleSlot {
  id: number
  start: string
  end: string
  is_recurring: boolean
}

const props = defineProps<{
  days: DaySnapshot[]
  events: CalendarEvent[]
  blockedRanges: BlockedRange[]
  accessibleSlots?: AccessibleSlot[]
  currentTime?: string
  isDragEnabled?: boolean
  timezone?: string
}>()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'slot-click': [slot: AccessibleSlot]
  'cell-click': [data: { date: string; hour: number }]
  'drag-complete': [eventId: number, newStart: string, newEnd: string]
  'open-quick-block': []
  'open-guide': []
}>()

const { t } = useI18n()
const timezone = computed(() => props.timezone || 'UTC')
const { pxPerMinute, hours, gridHeight, isPast } = useCalendarGrid({ timezone: timezone.value })
const dragDrop = useDragDrop()
const interactionLayerRef = ref<InstanceType<typeof InteractionLayer> | null>(null)

const days = computed(() => (props.days || []).filter((d) => typeof (d as any)?.date === 'string' && (d as any).date.length >= 10))
const events = computed(() => props.events || [])
const blockedRanges = computed(() => props.blockedRanges || [])
const accessibleSlots = computed(() => props.accessibleSlots || [])
const currentTime = computed(() => props.currentTime || new Date().toISOString())
const hasDays = computed(() => days.value.length > 0)

const formatDayName = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('uk-UA', { weekday: 'short' })
  } catch {
    return '—'
  }
}

const formatDayDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
  } catch {
    return '—'
  }
}

const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`
}

const isToday = (dateStr: string): boolean => {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today
}

const eventsForDay = (dateStr: string): CalendarEvent[] => {
  return events.value.filter(e => e.start.startsWith(dateStr))
}

const accessibleSlotsForDay = (dateStr: string): AccessibleSlot[] => {
  return accessibleSlots.value.filter(s => s.start.startsWith(dateStr))
}

const blockedRangesForDay = (dateStr: string): BlockedRange[] => {
  return blockedRanges.value.filter(r => r.start.startsWith(dateStr))
}

const boardStyles = computed(() => ({
  height: `${gridHeight.value}px`
}))

const handleEventClick = (event: CalendarEvent) => {
  emit('event-click', event)
}

const handleSlotClick = (slot: AccessibleSlot) => {
  console.log('[CalendarBoardV2] handleSlotClick called with:', slot)
  emit('slot-click', slot)
  console.log('[CalendarBoardV2] slot-click event emitted')
}

const handleCellClick = (date: string, hour: number) => {
  console.log('[CalendarBoardV2] Cell clicked:', { date, hour })
  emit('cell-click', { date, hour })
}

const handleEventDragStart = (event: CalendarEvent, mouseEvent: MouseEvent) => {
  dragDrop.startDrag(event)
}

const handleDragStart = (mouseEvent: MouseEvent) => {
  // InteractionLayer emits mouseEvent, but we need to determine which event was clicked
  // This will be handled by EventsLayer click, not InteractionLayer mousedown
  console.log('[CalendarBoardV2] Drag start from interaction layer', mouseEvent)
}

const handleDragMove = (slot: { start: string; end: string }) => {
  dragDrop.updatePreview(slot)
}

const handleDragEnd = async () => {
  const result = await dragDrop.confirmDrop(() => {
    // Success callback - emit to parent
    const draggedEvent = dragDrop.draggedEvent()
    const previewSlot = dragDrop.previewSlot()
  })
}
</script>

<style scoped>
.calendar-board-v2 {
  position: relative;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Header row */
.calendar-header-row {
  display: grid;
  grid-template-columns: 64px repeat(7, 1fr);
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.time-column-header {
  border-right: 1px solid #e0e0e0;
}

.day-header-cell {
  padding: 10px 8px;
  text-align: center;
  border-right: 1px solid #f0f0f0;
}

.day-header-cell:last-child {
  border-right: none;
}

.day-header-cell.is-today {
  background: rgba(59, 130, 246, 0.08);
}

.day-name {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 2px;
}

.day-date {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

/* Grid container */
.calendar-grid-container {
  display: grid;
  grid-template-columns: 64px 1fr;
  height: 100%;
  overflow: auto;
  scroll-behavior: smooth;
}

.time-column {
  border-right: 1px solid #e0e0e0;
  background: #fafafa;
}

.time-label {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  font-size: 12px;
  color: #6b7280;
  border-bottom: 1px solid #e0e0e0;
}

.days-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.day-column {
  position: relative;
  border-right: 1px solid #f0f0f0;
  min-width: 0;
}

.day-column:last-child {
  border-right: none;
}

/* Custom scrollbar */
.calendar-board-v2::-webkit-scrollbar {
  width: 8px;
}

.calendar-board-v2::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.calendar-board-v2::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.calendar-board-v2::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
