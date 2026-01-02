<template>
  <div 
    v-if="isDragEnabled || availabilityMode"
    class="interaction-layer"
    :class="{ 'availability-mode': availabilityMode }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeyDown"
    tabindex="0"
    role="grid"
    :aria-label="availabilityMode ? $t('calendar.availability.grid.label') : $t('calendar.drag.grid.label')"
  >
    <div
      v-if="previewSlot && !availabilityMode"
      class="preview-slot"
      :style="getPreviewStyle()"
    >
      <div class="preview-label">{{ $t('calendar.drag.preview') }}</div>
    </div>
    
    <div
      v-if="availabilityMode && hoveredCell"
      class="availability-hover-indicator"
      :style="getHoverStyle()"
      :class="{ 'can-add': canAddSlot, 'can-remove': canRemoveSlot }"
    >
      <div class="hover-icon">
        <span v-if="canAddSlot">+</span>
        <span v-else-if="canRemoveSlot">×</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { useDragDrop } from '@/modules/booking/composables/useDragDrop'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const props = defineProps<{
  pxPerMinute: number
  isDragEnabled?: boolean
  availabilityMode?: boolean
  existingSlots?: Array<{ start: string; end: string; slotId?: number }>
  events?: Array<{ start: string; end: string }>
  dayDates?: string[]
  gridStartHour?: number
  timezone?: string
}>()

const emit = defineEmits<{
  'drag-start': [event: MouseEvent]
  'drag-move': [slot: { start: string; end: string }]
  'drag-end': []
  'cell-click': [cellInfo: { start: string; end: string; canAdd: boolean; canRemove: boolean; slotId?: number }]
}>()

const dragDrop = useDragDrop()

const isDragging = computed(() => dragDrop.isDragging())
const previewSlot = computed(() => dragDrop.previewSlot())
const draggedEvent = computed(() => dragDrop.draggedEvent())

interface HoveredCell {
  start: string
  end: string
  slotId?: number
  columnIndex: number
  columnLeft: number
  columnWidth: number
}

const hoveredCell = ref<HoveredCell | null>(null)
const focusedCellIndex = ref(0)

const canAddSlot = computed(() => {
  if (!hoveredCell.value || !props.availabilityMode) return false
  
  const cellStart = new Date(hoveredCell.value.start)
  const cellEnd = new Date(hoveredCell.value.end)
  
  const hasEvent = props.events?.some(event => {
    const eventStart = new Date(event.start)
    const eventEnd = new Date(event.end)
    return cellStart < eventEnd && cellEnd > eventStart
  })
  
  if (hasEvent) return false
  
  const hasSlot = props.existingSlots?.some(slot => {
    const slotStart = new Date(slot.start)
    const slotEnd = new Date(slot.end)
    return cellStart < slotEnd && cellEnd > slotStart
  })
  
  return !hasSlot
})

const canRemoveSlot = computed(() => {
  if (!hoveredCell.value || !props.availabilityMode) return false
  return !!hoveredCell.value.slotId
})

const handleMouseDown = (event: MouseEvent) => {
  if (props.availabilityMode) {
    handleAvailabilityClick(event)
    return
  }
  
  // Emit to parent to handle event selection and drag start
  emit('drag-start', event)
}

const handleAvailabilityClick = (event: MouseEvent) => {
  const cellInfo = getCellInfoFromEvent(event)
  if (!cellInfo) return
  hoveredCell.value = cellInfo

  emit('cell-click', {
    start: cellInfo.start,
    end: cellInfo.end,
    canAdd: canAddSlot.value,
    canRemove: canRemoveSlot.value,
    slotId: cellInfo.slotId,
  })
}

const findScrollContainer = (element: HTMLElement | null): HTMLElement | null => {
  if (!element) return null
  if (element.classList.contains('calendar-grid-container')) return element
  return findScrollContainer(element.parentElement)
}

const getScrollTop = (target: HTMLElement): number => {
  const scrollableParent = findScrollContainer(target)
  if (scrollableParent) {
    return scrollableParent.scrollTop
  }
  return target.scrollTop || 0
}

const handleMouseMove = (event: MouseEvent) => {
  if (props.availabilityMode) {
    updateHoveredCell(event)
    return
  }
  
  if (!isDragging.value || !draggedEvent.value) return
  
  // Calculate target slot from mouse position
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const scrollTop = getScrollTop(target)
  const mouseY = event.clientY - rect.top + scrollTop

  // Calculate duration from dragged event
  const eventStart = new Date(draggedEvent.value.start)
  const eventEnd = new Date(draggedEvent.value.end)
  const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / 60000
  
  // Calculate target slot
  const slot = dragDrop.calculateTargetSlot(
    mouseY,
    0, // containerTop offset
    props.pxPerMinute,
    durationMinutes
  )
  
  // Emit to parent to update preview
  emit('drag-move', slot)
}

const handleMouseUp = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  // Emit to parent to confirm reschedule
  emit('drag-end')
}

const handleMouseLeave = () => {
  if (props.availabilityMode) {
    hoveredCell.value = null
  }
  
  if (isDragging.value) {
    dragDrop.cancelDrag()
  }
}

const updateHoveredCell = (event: MouseEvent) => {
  const cellInfo = getCellInfoFromEvent(event)
  hoveredCell.value = cellInfo
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.availabilityMode) return
  
  if (event.key === 'Escape') {
    hoveredCell.value = null
    return
  }
  
  if (event.key === 'Enter' || event.key === ' ') {
    if (hoveredCell.value) {
      emit('cell-click', {
        start: hoveredCell.value.start,
        end: hoveredCell.value.end,
        canAdd: canAddSlot.value,
        canRemove: canRemoveSlot.value,
        slotId: hoveredCell.value.slotId,
      })
    }
    event.preventDefault()
  }
}

const getPreviewStyle = () => {
  if (!previewSlot.value) return {}
  
  const start = new Date(previewSlot.value.start)
  const end = new Date(previewSlot.value.end)
  
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const gridStartMinutes = (props.gridStartHour ?? 0) * 60
  const minutesFromGridStart = Math.max(0, minutesFromDayStart - gridStartMinutes)
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  return {
    top: `${minutesFromGridStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`
  }
}

const getCellInfoFromEvent = (event: MouseEvent): HoveredCell | null => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const scrollTop = getScrollTop(target)
  const mouseY = event.clientY - rect.top + scrollTop
  const mouseX = event.clientX - rect.left

  const dayCount = props.dayDates?.length || 0
  if (dayCount === 0) return null

  const minutesFromTop = Math.max(0, Math.floor(mouseY / props.pxPerMinute))
  const gridStartMinutes = (props.gridStartHour ?? 0) * 60
  const totalMinutesFromDayStart = minutesFromTop + gridStartMinutes
  const snappedMinutesFromDayStart = Math.floor(totalMinutesFromDayStart / 60) * 60
  const hour = Math.floor(snappedMinutesFromDayStart / 60)
  const minute = snappedMinutesFromDayStart % 60

  const columnWidth = rect.width / dayCount
  const rawIndex = Math.floor(mouseX / columnWidth)
  const columnIndex = Math.min(Math.max(rawIndex, 0), dayCount - 1)
  const dayDateStr = props.dayDates?.[columnIndex]
  if (!dayDateStr) return null

  // Створюємо дату в локальному часі браузера (без timezone offset)
  const dayDate = new Date(dayDateStr + 'T00:00:00')
  if (Number.isNaN(dayDate.valueOf())) return null

  // Встановлюємо час безпосередньо в локальному часі
  const cellStart = new Date(dayDate)
  cellStart.setHours(hour, minute, 0, 0)
  const cellEnd = new Date(cellStart.getTime() + 60 * 60 * 1000)

  const timezone = props.timezone || dayjs.tz?.guess?.() || 'UTC'
  const formatPattern = 'YYYY-MM-DDTHH:mm:ssZ'
  const cellStartLocalized = dayjs(cellStart).tz(timezone).format(formatPattern)
  const cellEndLocalized = dayjs(cellEnd).tz(timezone).format(formatPattern)

  const existingSlot = props.existingSlots?.find(slot => {
    const slotStart = new Date(slot.start)
    const slotEnd = new Date(slot.end)
    return cellStart < slotEnd && cellEnd > slotStart
  })

  return {
    start: cellStartLocalized,
    end: cellEndLocalized,
    slotId: existingSlot?.slotId ?? (existingSlot as any)?.id,
    columnIndex,
    columnLeft: columnWidth * columnIndex,
    columnWidth,
  }
}

const getHoverStyle = () => {
  if (!hoveredCell.value) return {}
  
  const start = new Date(hoveredCell.value.start)
  const end = new Date(hoveredCell.value.end)

  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const gridStartMinutes = (props.gridStartHour ?? 0) * 60
  const minutesFromGridStart = Math.max(0, minutesFromDayStart - gridStartMinutes)
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  return {
    top: `${minutesFromGridStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`,
    left: `${hoveredCell.value.columnLeft + 8}px`,
    width: `${Math.max(hoveredCell.value.columnWidth - 16, 0)}px`,
  }
}
</script>

<style scoped>
.interaction-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  cursor: grab;
  pointer-events: none;
}

.interaction-layer:active {
  pointer-events: auto;
}

.interaction-layer:active {
  cursor: grabbing;
}

.preview-slot {
  position: absolute;
  left: 8px;
  right: 8px;
  background: rgba(76, 175, 80, 0.3);
  border: 2px dashed #4CAF50;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.preview-label {
  font-size: 12px;
  color: #4CAF50;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
}

.interaction-layer.availability-mode {
  pointer-events: auto;
  cursor: pointer;
}

.availability-hover-indicator {
  position: absolute;
  left: 8px;
  right: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: all 0.15s ease;
}

.availability-hover-indicator.can-add {
  background: rgba(76, 175, 80, 0.2);
  border: 2px solid #4CAF50;
}

.availability-hover-indicator.can-remove {
  background: rgba(244, 67, 54, 0.2);
  border: 2px solid #f44336;
}

.hover-icon {
  font-size: 24px;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.95);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.availability-hover-indicator.can-add .hover-icon {
  color: #4CAF50;
}

.availability-hover-indicator.can-remove .hover-icon {
  color: #f44336;
}
</style>
