<template>
  <div class="timeline-panel h-full flex flex-col bg-gray-900 border-l border-gray-700">
    <!-- Header -->
    <div class="p-4 border-b border-gray-700">
      <h3 class="text-lg font-semibold text-white">Таймлайн</h3>
      <p class="text-sm text-gray-400">{{ totalEvents }} подій</p>
    </div>

    <!-- Filters -->
    <TimelineFilters
      v-model:selected="selectedFilters"
      :available-types="availableTypes"
      @change="handleFilterChange"
    />

    <!-- Loading -->
    <div v-if="isLoading && events.length === 0" class="flex-1 flex items-center justify-center">
      <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && visibleBuckets.length === 0"
      class="flex-1 flex items-center justify-center text-gray-500"
    >
      <div class="text-center">
        <Clock class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Немає подій</p>
      </div>
    </div>

    <!-- Timeline List -->
    <div
      v-else
      ref="timelineContainer"
      class="flex-1 overflow-y-auto"
      @scroll="handleScroll"
    >
      <div
        v-for="bucket in visibleBuckets"
        :key="bucket.start_ms"
        class="timeline-bucket"
      >
        <!-- Time marker -->
        <div class="sticky top-0 bg-gray-800 px-4 py-1 text-xs text-gray-400 z-10">
          {{ formatTime(bucket.start_ms) }}
        </div>

        <!-- Events in bucket -->
        <TimelineEvent
          v-for="event in bucket.events"
          :key="event.id"
          :event="event"
          :is-active="activeEventId === event.id"
          @click="handleEventClick(event)"
          @mouseenter="handleEventHover(event, $event)"
          @mouseleave="handleEventLeave"
        />
      </div>

      <!-- Load more -->
      <div v-if="hasMore" class="p-4 text-center">
        <button
          class="text-primary-400 hover:text-primary-300 text-sm"
          :disabled="isLoading"
          @click="loadMore"
        >
          {{ isLoading ? 'Завантаження...' : 'Завантажити більше' }}
        </button>
      </div>
    </div>

    <!-- Preview on hover -->
    <TimelinePreview
      v-if="hoveredEvent && isBoardEvent(hoveredEvent.event_type)"
      :event="hoveredEvent"
      :position="previewPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Loader2, Clock } from 'lucide-vue-next'
import { useTimeline, type TimelineEvent } from '../composables/useTimeline'
import TimelineFilters from './TimelineFilters.vue'
import TimelineEventComponent from './TimelineEvent.vue'
import TimelinePreview from './TimelinePreview.vue'

// Rename to avoid conflict with type
const TimelineEvent = TimelineEventComponent

interface Props {
  sessionId: string
  currentTimeMs?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'seek', timeMs: number): void
  (e: 'event-select', event: TimelineEvent): void
}>()

const {
  events,
  buckets,
  totalEvents,
  availableTypes,
  hasMore,
  isLoading,
  loadTimeline,
  loadMore,
  filterByTypes,
} = useTimeline(props.sessionId)

const selectedFilters = ref<string[]>([])
const hoveredEvent = ref<TimelineEvent | null>(null)
const previewPosition = ref({ x: 0, y: 0 })
const activeEventId = ref<number | null>(null)
const timelineContainer = ref<HTMLElement | null>(null)

// Filter categories to event types mapping
const filterTypeMap: Record<string, string[]> = {
  participants: ['participant_join', 'participant_leave', 'participant_reconnect'],
  board: ['board_stroke', 'board_object_create', 'board_object_delete', 'board_clear'],
  media: ['media_toggle', 'screen_share_start', 'screen_share_stop'],
  system: ['session_start', 'session_end', 'session_pause', 'session_resume'],
  errors: ['error'],
}

// Get selected event types from filter categories
const selectedEventTypes = computed(() => {
  if (selectedFilters.value.length === 0) return []

  const types: string[] = []
  for (const filter of selectedFilters.value) {
    if (filterTypeMap[filter]) {
      types.push(...filterTypeMap[filter])
    }
  }
  return types
})

// Filter buckets based on selected filters
const visibleBuckets = computed(() => {
  return buckets.value
    .map((bucket) => ({
      ...bucket,
      events: bucket.events.filter(
        (e) =>
          selectedEventTypes.value.length === 0 ||
          selectedEventTypes.value.includes(e.event_type)
      ),
    }))
    .filter((b) => b.events.length > 0)
})

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function isBoardEvent(type: string): boolean {
  return type.startsWith('board_')
}

function handleEventClick(event: TimelineEvent): void {
  activeEventId.value = event.id
  emit('seek', event.timestamp_ms)
  emit('event-select', event)
}

function handleEventHover(event: TimelineEvent, mouseEvent: MouseEvent): void {
  hoveredEvent.value = event
  previewPosition.value = {
    x: mouseEvent.clientX,
    y: mouseEvent.clientY,
  }
}

function handleEventLeave(): void {
  hoveredEvent.value = null
}

function handleFilterChange(): void {
  filterByTypes(selectedFilters.value)
}

function handleScroll(e: Event): void {
  const target = e.target as HTMLElement
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
    if (hasMore.value && !isLoading.value) {
      loadMore()
    }
  }
}

// Highlight current event based on playback time
watch(
  () => props.currentTimeMs,
  (timeMs) => {
    if (timeMs === undefined) return

    // Find closest event
    for (const bucket of buckets.value) {
      for (const event of bucket.events) {
        if (event.timestamp_ms <= timeMs && event.timestamp_ms + 100 > timeMs) {
          activeEventId.value = event.id
          return
        }
      }
    }
  }
)

onMounted(() => {
  loadTimeline()
})
</script>

<style scoped>
.timeline-panel {
  min-width: 300px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
