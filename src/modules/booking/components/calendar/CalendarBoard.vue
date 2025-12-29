<template>
  <DragSelectOverlay class="calendar-board" @select="handleCellsSelected">
    <div class="calendar-board__headers">
      <div class="time-scale time-scale--header" aria-hidden="true"></div>
      <button
        v-for="day in days"
        :key="day.dayKey"
        type="button"
        class="day-header"
        :class="{
          'day-header--today': day.dayKey === todayKey,
          'day-header--active': day.dayKey === activeDayKey,
          'day-header--empty': !hasAvailability(day.dayKey),
        }"
        @click="setActiveDay(day.dayKey)"
      >
        <div class="day-header__meta">
          <span class="day-header__dow">{{ day.label }}</span>
          <span class="day-header__date">{{ day.day }}</span>
        </div>
        <span class="day-header__badge">
          {{ availabilityLabel(day.dayKey) }}
        </span>
      </button>
    </div>

    <div class="time-scale" aria-hidden="true">
      <div
        v-for="slot in timeScaleSlots"
        :key="slot.key"
        class="time-scale__slot"
        :class="{ 'time-scale__slot--hour': slot.isHour }"
      >
        {{ slot.label }}
      </div>
    </div>

    <div
      v-for="day in days"
      :key="day.dayKey"
      class="day-column"
      :class="{ 'day-column--active': day.dayKey === activeDayKey }"
    >
      <Cell
        v-for="cell in getCellsForDay(day.dayKey)"
        :key="cell.startAtUTC"
        :cell="cell"
        :timezone="timezone"
        @click="() => handleCellClick(cell)"
      />
      <AvailabilityOverlay
        :day-key="day.dayKey"
        :layouts="availabilityLayouts"
        :slots-by-id="slotsById"
        @slot-clicked="handleSlotClick"
        @slot-edit="handleSlotEdit"
        @slot-delete="handleSlotDelete"
        @slot-block="handleSlotBlock"
      />
    </div>

    <EventsOverlay
      :event-layouts="eventLayouts"
      :events-by-id="eventsByIdComputed"
      :optimistic-event-ids="optimisticEventIds"
      draggable
      @event-click="handleEventClick"
    />
  </DragSelectOverlay>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Cell from './Cell.vue'
import EventsOverlay from './EventsOverlay.vue'
import AvailabilityOverlay from './AvailabilityOverlay.vue'
import DragSelectOverlay from './DragSelectOverlay.vue'
import type { Day, CalendarCell, EventLayout, AvailabilityLayout, AccessibleSlot } from '@/modules/booking/types/calendarWeek'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  days: Day[]
  cells: CalendarCell[]
  eventLayouts: EventLayout[]
  timezone: string
  dayAvailability?: Record<string, number>
  availabilityLayouts?: AvailabilityLayout[]
  slotsById?: Record<number, AccessibleSlot>
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
  eventClick: [eventId: number]
  cellsSelected: [utcKeys: string[]]
  slotClick: [slotId: number]
  slotEdit: [slotId: number]
  slotDelete: [slotId: number]
  slotBlock: [slotId: number]
  createSlot: [data: { date: string; start: string; end: string }]
}>()

const store = useCalendarWeekStore()
const { events } = storeToRefs(store)

// Конвертуємо events array у eventsById для сумісності з EventsOverlay
const eventsByIdComputed = computed(() => {
  const byId: Record<number, any> = {}
  for (const event of events.value || []) {
    byId[event.id] = event
  }
  return byId
})
const optimisticEventIds = computed(() => [] as number[])

const cellsByDay = computed<Record<string, CalendarCell[]>>(() => {
  const map: Record<string, CalendarCell[]> = {}
  for (const cell of props.cells) {
    if (!map[cell.dayKey]) {
      map[cell.dayKey] = []
    }
    map[cell.dayKey].push(cell)
  }
  return map
})

const cellsByUtcKey = computed<Record<string, CalendarCell>>(() => {
  const map: Record<string, CalendarCell> = {}
  for (const cell of props.cells) {
    map[cell.startAtUTC] = cell
  }
  return map
})

const getCellsForDay = (dayKey: string) => cellsByDay.value[dayKey] || []

const timeScaleSlots = computed(() => {
  const slots: Array<{ key: string; label: string; isHour: boolean }> = []
  const totalSlots = 32 // 16 hours, 30-minute increments
  const startHour = 6
  for (let i = 0; i < totalSlots; i++) {
    const hour = startHour + Math.floor(i / 2)
    const minutes = i % 2 === 0 ? '00' : '30'
    const label = i % 2 === 0 ? `${hour.toString().padStart(2, '0')}:${minutes}` : ''
    slots.push({
      key: `${hour}-${minutes}-${i}`,
      label,
      isHour: i % 2 === 0,
    })
  }
  return slots
})

const todayKey = new Date().toISOString().split('T')[0]
const activeDayKey = ref<string>('')

const hasAvailability = (dayKey: string) => {
  const minutes = props.dayAvailability?.[dayKey] ?? 0
  return minutes > 0
}

const formatHours = (minutes: number) => {
  const hours = minutes / 60
  return hours % 1 === 0 ? hours.toString() : hours.toFixed(1)
}

const availabilityLabel = (dayKey: string) => {
  const minutes = props.dayAvailability?.[dayKey] ?? 0
  if (minutes <= 0) return '0 год'
  return `${formatHours(minutes)} год`
}

watch(
  () => props.days.map(day => day.dayKey),
  (dayKeys) => {
    if (!dayKeys.length) {
      activeDayKey.value = ''
      return
    }
    if (!dayKeys.includes(activeDayKey.value)) {
      activeDayKey.value = dayKeys[0]
    }
  },
  { immediate: true }
)

function setActiveDay(dayKey: string) {
  activeDayKey.value = dayKey
}

function handleCellClick(cell: CalendarCell) {
  setActiveDay(cell.dayKey)
  emit('cellClick', cell)
}

function handleEventClick(eventId: number) {
  emit('eventClick', eventId)
}

function handleCellsSelected(utcKeys: string[]) {
  if (utcKeys.length) {
    const firstCell = cellsByUtcKey.value[utcKeys[0]]
    const lastCell = cellsByUtcKey.value[utcKeys[utcKeys.length - 1]]
    
    if (firstCell) {
      setActiveDay(firstCell.dayKey)
      
      // If multiple cells selected and they're on the same day, emit createSlot
      if (lastCell && firstCell.dayKey === lastCell.dayKey && utcKeys.length > 1) {
        const startDate = new Date(firstCell.startAtUTC)
        const endDate = new Date(lastCell.endAtUTC)
        
        const startTime = `${startDate.getUTCHours().toString().padStart(2, '0')}:${startDate.getUTCMinutes().toString().padStart(2, '0')}`
        const endTime = `${endDate.getUTCHours().toString().padStart(2, '0')}:${endDate.getUTCMinutes().toString().padStart(2, '0')}`
        
        emit('createSlot', {
          date: firstCell.dayKey,
          start: startTime,
          end: endTime
        })
        return
      }
    }
  }
  emit('cellsSelected', utcKeys)
}

function handleSlotClick(slotId: number) {
  emit('slotClick', slotId)
}

function handleSlotEdit(slotId: number) {
  emit('slotEdit', slotId)
}

function handleSlotDelete(slotId: number) {
  emit('slotDelete', slotId)
}

function handleSlotBlock(slotId: number) {
  emit('slotBlock', slotId)
}
</script>
