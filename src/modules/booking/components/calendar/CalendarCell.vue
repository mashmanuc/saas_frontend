<template>
  <div 
    :class="cellClasses"
    :data-date="date"
    :data-time="time"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div v-if="hasEvent" class="cell-event">
      <slot name="event" :event="event" />
    </div>
    <div v-if="isAvailable" class="cell-available">
      <slot name="available" />
    </div>
    <div v-if="isBlocked" class="cell-blocked">
      <slot name="blocked" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  date: string
  time: string
  status?: 'empty' | 'available' | 'booked' | 'blocked' | 'notAllow'
  event?: any
  isSelectable?: boolean
  isSelected?: boolean
  isHovered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'empty',
  isSelectable: true,
  isSelected: false,
  isHovered: false,
})

const emit = defineEmits<{
  click: [{ date: string; time: string }]
  mouseenter: [{ date: string; time: string }]
  mouseleave: [{ date: string; time: string }]
}>()

const cellClasses = computed(() => ({
  'calendar-cell': true,
  [`calendar-cell--${props.status}`]: true,
  'calendar-cell--selectable': props.isSelectable,
  'calendar-cell--selected': props.isSelected,
  'calendar-cell--hovered': props.isHovered,
}))

const hasEvent = computed(() => props.status === 'booked' && props.event)
const isAvailable = computed(() => props.status === 'available')
const isBlocked = computed(() => props.status === 'blocked')

function handleClick() {
  if (props.isSelectable) {
    emit('click', { date: props.date, time: props.time })
  }
}

function handleMouseEnter() {
  emit('mouseenter', { date: props.date, time: props.time })
}

function handleMouseLeave() {
  emit('mouseleave', { date: props.date, time: props.time })
}
</script>

<style scoped>
.calendar-cell {
  position: relative;
  min-height: 30px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.calendar-cell--empty {
  background-color: #ffffff;
}

.calendar-cell--available {
  background-color: #d1fae5;
  cursor: pointer;
}

.calendar-cell--booked {
  background-color: #dbeafe;
}

.calendar-cell--blocked {
  background-color: #fee2e2;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(239, 68, 68, 0.1) 10px,
    rgba(239, 68, 68, 0.1) 20px
  );
}

.calendar-cell--notAllow {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.calendar-cell--selectable:hover {
  opacity: 0.8;
}

.calendar-cell--selected {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.calendar-cell--hovered {
  background-color: #f0f9ff;
}

.cell-event,
.cell-available,
.cell-blocked {
  padding: 4px;
  font-size: 12px;
}
</style>
