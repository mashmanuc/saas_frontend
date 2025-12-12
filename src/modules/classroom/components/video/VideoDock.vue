<template>
  <div class="video-dock" :class="{ 'video-dock--compact': compact }">
    <div class="video-dock__grid" :style="gridStyle">
      <VideoTile
        v-for="participant in visibleParticipants"
        :key="participant.user_id"
        :participant="participant"
        :is-local="participant.user_id === localUserId"
        :is-speaking="speakingUsers.has(participant.user_id)"
        @toggle-pin="handleTogglePin"
      />
    </div>

    <!-- Overflow indicator -->
    <div v-if="hiddenCount > 0" class="video-dock__overflow">
      +{{ hiddenCount }} {{ $t('classroom.video.more') }}
    </div>

    <!-- Controls overlay -->
    <VideoControls
      v-if="showControls"
      :video-enabled="localMediaState.video"
      :audio-enabled="localMediaState.audio"
      :screen-sharing="localMediaState.screen"
      @toggle-video="$emit('toggle-video')"
      @toggle-audio="$emit('toggle-audio')"
      @toggle-screen="$emit('toggle-screen')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SessionParticipant } from '../../api/classroom'
import type { LocalMediaState } from '../../stores/participantStore'
import VideoTile from './VideoTile.vue'
import VideoControls from './VideoControls.vue'

interface Props {
  participants: SessionParticipant[]
  localUserId?: number
  localMediaState?: LocalMediaState
  maxVisible?: number
  compact?: boolean
  showControls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  localUserId: 0,
  localMediaState: () => ({ video: true, audio: true, screen: false }),
  maxVisible: 6,
  compact: false,
  showControls: true,
})

defineEmits<{
  'toggle-video': []
  'toggle-audio': []
  'toggle-screen': []
}>()

// State
const pinnedUserId = ref<number | null>(null)
const speakingUsers = ref<Set<number>>(new Set())

// Computed
const sortedParticipants = computed(() => {
  const sorted = [...props.participants]

  // Pinned user first
  if (pinnedUserId.value) {
    const pinnedIdx = sorted.findIndex((p) => p.user_id === pinnedUserId.value)
    if (pinnedIdx > 0) {
      const [pinned] = sorted.splice(pinnedIdx, 1)
      sorted.unshift(pinned)
    }
  }

  // Host second (if not pinned)
  const hostIdx = sorted.findIndex((p) => p.role === 'host' && p.user_id !== pinnedUserId.value)
  if (hostIdx > 1) {
    const [host] = sorted.splice(hostIdx, 1)
    sorted.splice(1, 0, host)
  }

  return sorted
})

const visibleParticipants = computed(() => {
  return sortedParticipants.value.slice(0, props.maxVisible)
})

const hiddenCount = computed(() => {
  return Math.max(0, props.participants.length - props.maxVisible)
})

const gridStyle = computed(() => {
  const count = visibleParticipants.value.length

  if (count === 1) {
    return { gridTemplateColumns: '1fr' }
  }
  if (count === 2) {
    return { gridTemplateColumns: '1fr 1fr' }
  }
  if (count <= 4) {
    return { gridTemplateColumns: '1fr 1fr' }
  }
  return { gridTemplateColumns: 'repeat(3, 1fr)' }
})

// Handlers
function handleTogglePin(userId: number): void {
  if (pinnedUserId.value === userId) {
    pinnedUserId.value = null
  } else {
    pinnedUserId.value = userId
  }
}
</script>

<style scoped>
.video-dock {
  position: relative;
  height: 100%;
  background: var(--color-bg-tertiary);
  border-radius: 12px;
  overflow: hidden;
}

.video-dock__grid {
  display: grid;
  gap: 8px;
  padding: 8px;
  height: 100%;
}

.video-dock--compact .video-dock__grid {
  gap: 4px;
  padding: 4px;
}

.video-dock__overflow {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
}
</style>
