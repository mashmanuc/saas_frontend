<template>
  <div class="calendar-board-v2" data-testid="calendar-board" role="grid" aria-label="Calendar week view">
    <template v-if="hasDays">
      <div class="calendar-header-row">
        <div class="time-column-header"></div>
        <div 
          v-for="day in days" 
          :key="day.date" 
          class="day-header-cell"
          :data-testid="`day-header-${day.date}`"
          :aria-label="`${formatDayName(day.date)} ${formatDayDate(day.date)}`"
        >
          <div 
            class="day-header-chip"
            :class="{ 'is-today': isToday(day.date) }"
          >
            <div class="day-name">{{ formatDayName(day.date) }}</div>
            <div class="day-date">{{ formatDayDate(day.date) }}</div>
          </div>
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
              :availability-mode="availabilityMode"
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
            <DraftSlotsLayer
              v-if="availabilityMode && draftSlots"
              :draft-slots="draftSlotsForDay(day.date)"
              :px-per-minute="pxPerMinute"
              :timezone="timezone"
              :grid-start-hour="startHour"
            />
          </div>
          <InteractionLayer 
            v-if="isDragEnabled || availabilityMode"
            ref="interactionLayerRef"
            :px-per-minute="pxPerMinute"
            :is-drag-enabled="isDragEnabled"
            :availability-mode="availabilityMode"
            :existing-slots="accessibleSlots"
            :events="events"
            :day-dates="dayDateStrings"
            :grid-start-hour="startHour"
            :timezone="timezone"
            @drag-start="handleDragStart"
            @drag-move="handleDragMove"
            @drag-end="handleDragEnd"
            @cell-click="handleAvailabilityCellClick"
          />
        </div>
      </div>
    </template>
    <div v-else class="calendar-empty-state">
      <h3>{{ t('calendar.emptyState.noAvailability.title') }}</h3>
      <p>{{ t('calendar.emptyState.noAvailability.description') }}</p>
      <div class="empty-actions">
        <Button variant="primary" @click="$emit('open-quick-block')">
          {{ t('calendar.header.mark_free_time') }}
        </Button>
        <Button variant="ghost" @click="$emit('open-guide')">
          {{ t('calendar.guide.title') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'
import { useDragDrop } from '@/modules/booking/composables/useDragDrop'
import GridLayer from './layers/GridLayer.vue'
import AccessibleSlotsLayer from './layers/AccessibleSlotsLayer.vue'
import AvailabilityLayer from './layers/AvailabilityLayer.vue'
import EventsLayer from './layers/EventsLayer.vue'
import InteractionLayer from './layers/InteractionLayer.vue'
import DraftSlotsLayer from './layers/DraftSlotsLayer.vue'
import type { CalendarEvent, DaySnapshot, BlockedRange } from '@/modules/booking/types/calendarV055'

interface AccessibleSlot {
  id: number
  start: string
  end: string
  is_recurring: boolean
}

interface DraftSlot {
  tempId?: string
  slotId?: number | null
  start: string
  end: string
  status?: 'available' | 'blocked'
  action?: 'remove'
}

const props = defineProps<{
  days: DaySnapshot[]
  events: CalendarEvent[]
  blockedRanges: BlockedRange[]
  accessibleSlots?: AccessibleSlot[]
  currentTime?: string
  isDragEnabled?: boolean
  timezone?: string
  availabilityMode?: boolean
  draftSlots?: DraftSlot[]
}>()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'slot-click': [slot: AccessibleSlot]
  'cell-click': [data: { date: string; hour: number } | { start: string; end: string; canAdd: boolean; canRemove: boolean; slotId?: number }]
  'drag-complete': [eventId: number, newStart: string, newEnd: string]
  'open-quick-block': []
  'open-guide': []
}>()

const { t } = useI18n()
const timezone = computed(() => props.timezone || 'UTC')
const { pxPerMinute, hours, gridHeight, isPast, startHour } = useCalendarGrid({ timezone: timezone.value })
const dragDrop = useDragDrop()
const interactionLayerRef = ref<InstanceType<typeof InteractionLayer> | null>(null)

const days = computed(() => (props.days || []).filter((d) => typeof (d as any)?.date === 'string' && (d as any).date.length >= 10))
const dayDateStrings = computed(() => days.value.map(day => day.date))
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

const draftSlotsForDay = (dateStr: string): DraftSlot[] => {
  console.log('[CalendarBoardV2] draftSlotsForDay called for:', dateStr)
  console.log('[CalendarBoardV2] props.draftSlots:', props.draftSlots)
  
  if (!props.draftSlots) {
    console.log('[CalendarBoardV2] No draftSlots prop, returning []')
    return []
  }
  
  const filtered = props.draftSlots.filter(s => s.start.startsWith(dateStr))
  console.log('[CalendarBoardV2] Filtered draft slots for', dateStr, ':', filtered)
  return filtered
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

const handleAvailabilityCellClick = (cellInfo: { start: string; end: string; canAdd: boolean; canRemove: boolean; slotId?: number }) => {
  console.log('[CalendarBoardV2] Availability cell clicked:', cellInfo)
  console.log('[CalendarBoardV2] Emitting cell-click event with:', cellInfo)
  emit('cell-click', cellInfo)
  console.log('[CalendarBoardV2] cell-click event emitted successfully')
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
  padding: 12px 16px 18px;
  gap: 12px;
  background: transparent;
  border-bottom: none;
  position: relative;
  z-index: 2;
}

.time-column-header {
  border-right: none;
}

.day-header-cell {
  display: flex;
  justify-content: center;
}
.day-header-chip {
  min-width: 78px;
  padding: 10px 16px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  border: 1px solid rgba(15, 23, 42, 0.08);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.day-header-chip.is-today {
  background: rgba(74, 222, 128, 0.18);
  border-color: rgba(22, 163, 74, 0.35);
  box-shadow: 0 6px 14px rgba(34, 197, 94, 0.25);
}

.day-header-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
}

.day-name {
  font-size: 12px;
  color: #475467;
  text-transform: lowercase;
  font-weight: 600;
}

.day-date {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
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
