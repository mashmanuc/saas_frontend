<template>
  <div class="events-overlay">
    <EventBlock
      v-for="layout in eventLayouts"
      :key="layout.eventId"
      :event="eventsById[layout.eventId]"
      :layout="layout"
      :is-draggable="draggable"
      :is-optimistic="optimisticEventIdsSet.has(layout.eventId)"
      @click="handleEventClick(layout.eventId)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EventBlock from './EventBlock.vue'
import type { EventLayout, CalendarEvent } from '@/modules/booking/types/calendarWeek'

const props = withDefaults(defineProps<{
  eventLayouts: EventLayout[]
  eventsById: Record<number, CalendarEvent>
  optimisticEventIds?: number[]
  draggable?: boolean
}>(), {
  optimisticEventIds: () => [],
  draggable: false,
})

const emit = defineEmits<{
  eventClick: [eventId: number]
}>()

const optimisticEventIdsSet = computed(() => new Set(props.optimisticEventIds))

function handleEventClick(eventId: number) {
  emit('eventClick', eventId)
}
</script>

<style scoped>
.events-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}
</style>
