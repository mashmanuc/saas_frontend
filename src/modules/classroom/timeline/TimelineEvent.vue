<template>
  <div
    :class="[
      'timeline-event px-4 py-2 cursor-pointer transition-colors',
      isActive ? 'bg-primary-900/50' : 'hover:bg-gray-800/50'
    ]"
    @click="$emit('click')"
    @mouseenter="$emit('mouseenter')"
    @mouseleave="$emit('mouseleave')"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <div
        :class="[
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          iconBgClass
        ]"
      >
        <component :is="eventIcon" class="w-4 h-4 text-white" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-white">
            {{ eventLabel }}
          </span>
          <span class="text-xs text-gray-500">
            {{ formatTime(event.timestamp_ms) }}
          </span>
        </div>

        <p v-if="event.user" class="text-xs text-gray-400 mt-0.5">
          {{ event.user.name }}
        </p>

        <p v-if="eventDescription" class="text-xs text-gray-500 mt-1 truncate">
          {{ eventDescription }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Pencil,
  Users,
  Video,
  Settings,
  AlertCircle,
  Play,
  Pause,
  Square,
  Monitor,
  Trash2,
  Plus,
} from 'lucide-vue-next'
import type { TimelineEvent } from '../composables/useTimeline'

interface Props {
  event: TimelineEvent
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
})

defineEmits<{
  (e: 'click'): void
  (e: 'mouseenter'): void
  (e: 'mouseleave'): void
}>()

const eventConfig: Record<
  string,
  { icon: typeof Pencil; bg: string; label: string }
> = {
  board_stroke: { icon: Pencil, bg: 'bg-blue-600', label: 'Stroke' },
  board_object_create: { icon: Plus, bg: 'bg-blue-600', label: 'Object Created' },
  board_object_delete: { icon: Trash2, bg: 'bg-red-600', label: 'Object Deleted' },
  board_clear: { icon: Trash2, bg: 'bg-red-600', label: 'Board Cleared' },
  participant_join: { icon: Users, bg: 'bg-green-600', label: 'Joined' },
  participant_leave: { icon: Users, bg: 'bg-orange-600', label: 'Left' },
  participant_reconnect: { icon: Users, bg: 'bg-yellow-600', label: 'Reconnected' },
  media_toggle: { icon: Video, bg: 'bg-purple-600', label: 'Media Toggle' },
  screen_share_start: { icon: Monitor, bg: 'bg-purple-600', label: 'Screen Share Started' },
  screen_share_stop: { icon: Monitor, bg: 'bg-purple-600', label: 'Screen Share Stopped' },
  session_start: { icon: Play, bg: 'bg-green-600', label: 'Session Started' },
  session_end: { icon: Square, bg: 'bg-red-600', label: 'Session Ended' },
  session_pause: { icon: Pause, bg: 'bg-yellow-600', label: 'Session Paused' },
  session_resume: { icon: Play, bg: 'bg-green-600', label: 'Session Resumed' },
  error: { icon: AlertCircle, bg: 'bg-red-600', label: 'Error' },
}

const defaultConfig = { icon: Settings, bg: 'bg-gray-600', label: 'Event' }

const config = computed(() => eventConfig[props.event.event_type] || defaultConfig)
const eventIcon = computed(() => config.value.icon)
const iconBgClass = computed(() => config.value.bg)
const eventLabel = computed(() => config.value.label)

const eventDescription = computed(() => {
  const data = props.event.data
  if (!data) return null

  if (props.event.event_type === 'board_stroke' && data.color) {
    return `Color: ${data.color}`
  }
  if (props.event.event_type === 'media_toggle') {
    return `${data.media_type}: ${data.enabled ? 'On' : 'Off'}`
  }
  if (props.event.event_type === 'error' && data.message) {
    return data.message as string
  }

  return null
})

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.timeline-event {
  border-left: 2px solid transparent;
}

.timeline-event:hover {
  border-left-color: var(--color-primary, #3b82f6);
}
</style>
