<template>
  <div
    :class="eventClasses"
    :style="eventStyle"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <div class="event-block__header">
      <span class="event-block__time">{{ formatTime(event.start) }}</span>
      <div class="event-block__status-badges">
        <span v-if="event.paidStatus === 'paid'" class="status-badge status-badge--paid">
          {{ $t('calendar.paidStatus.paid') }}
        </span>
        <span v-if="event.doneStatus === 'done'" class="status-badge status-badge--done">
          {{ $t('calendar.doneStatus.done') }}
        </span>
      </div>
    </div>
    
    <div class="event-block__client">{{ event.clientName }}</div>
    <div class="event-block__duration">{{ event.durationMin }} {{ t('common.minutes') }}</div>
    
    <!-- Drag handle -->
    <div v-if="isDraggable" class="event-block__drag-handle">
      <GripVerticalIcon class="w-4 h-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GripVertical as GripVerticalIcon } from 'lucide-vue-next'
import type { CalendarEvent, EventLayout } from '@/modules/booking/types/calendarWeek'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  event: CalendarEvent
  layout: EventLayout
  isDraggable?: boolean
  isOptimistic?: boolean
}>(), {
  isDraggable: false,
  isOptimistic: false,
})

const emit = defineEmits<{
  click: []
}>()

const eventClasses = computed(() => [
  'event-block',
  'hover-lift',
  {
    'event-block--draggable': props.isDraggable,
    'optimistic-update': props.isOptimistic,
  },
])

const eventStyle = computed(() => ({
  top: `${props.layout.top}px`,
  height: `${props.layout.height}px`,
  left: `${props.layout.left}px`,
  width: props.layout.width,
}))

const ariaLabel = computed(() => {
  return `Урок з ${props.event.clientName} о ${formatTime(props.event.start)}, тривалість ${props.event.durationMin} ${t('common.minutes')}`
})

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleClick() {
  emit('click')
}
</script>

<style scoped>
.event-block__drag-handle {
  position: absolute;
  top: 50%;
  left: 4px;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: grab;
}

.event-block:hover .event-block__drag-handle {
  opacity: 0.5;
}

.event-block--draggable {
  cursor: grab;
}

.event-block--draggable:active {
  cursor: grabbing;
}
</style>
