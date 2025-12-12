<template>
  <div 
    class="video-tile"
    :class="{
      'video-tile--local': isLocal,
      'video-tile--speaking': isSpeaking,
      'video-tile--muted': !participant.audio_enabled,
      'video-tile--video-off': !participant.video_enabled,
    }"
    @dblclick="$emit('toggle-pin', participant.user_id)"
  >
    <!-- Video element -->
    <video
      v-if="participant.video_enabled && videoStream"
      ref="videoRef"
      class="video-tile__video"
      :muted="isLocal"
      autoplay
      playsinline
    ></video>

    <!-- Avatar fallback -->
    <div v-else class="video-tile__avatar">
      <img 
        v-if="participant.avatar" 
        :src="participant.avatar" 
        :alt="participant.name"
      />
      <span v-else class="video-tile__initials">
        {{ initials }}
      </span>
    </div>

    <!-- Overlay info -->
    <div class="video-tile__overlay">
      <!-- Name -->
      <div class="video-tile__name">
        <span class="name-text">{{ participant.name }}</span>
        <span v-if="participant.role === 'host'" class="role-badge">
          {{ $t('classroom.roles.host') }}
        </span>
      </div>

      <!-- Status indicators -->
      <div class="video-tile__indicators">
        <!-- Audio -->
        <span 
          v-if="!participant.audio_enabled" 
          class="indicator indicator--muted"
          :title="$t('classroom.video.muted')"
        >
          🔇
        </span>

        <!-- Connection quality -->
        <span 
          class="indicator indicator--quality"
          :class="`indicator--${participant.connection_quality}`"
          :title="$t(`classroom.quality.${participant.connection_quality}`)"
        >
          {{ qualityIcon }}
        </span>

        <!-- Reconnecting -->
        <span 
          v-if="participant.status === 'reconnecting'" 
          class="indicator indicator--reconnecting"
        >
          🔄
        </span>
      </div>
    </div>

    <!-- Speaking indicator -->
    <div v-if="isSpeaking" class="video-tile__speaking-ring"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { SessionParticipant } from '../../api/classroom'

interface Props {
  participant: SessionParticipant
  isLocal?: boolean
  isSpeaking?: boolean
  videoStream?: MediaStream | null
}

const props = withDefaults(defineProps<Props>(), {
  isLocal: false,
  isSpeaking: false,
  videoStream: null,
})

defineEmits<{
  'toggle-pin': [userId: number]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

// Computed
const initials = computed(() => {
  const parts = props.participant.name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return props.participant.name.slice(0, 2).toUpperCase()
})

const qualityIcon = computed(() => {
  switch (props.participant.connection_quality) {
    case 'excellent':
      return '📶'
    case 'good':
      return '📶'
    case 'fair':
      return '📶'
    case 'poor':
      return '📶'
    default:
      return '📶'
  }
})

// Watch for stream changes
watch(
  () => props.videoStream,
  (stream) => {
    if (videoRef.value && stream) {
      videoRef.value.srcObject = stream
    }
  }
)

onMounted(() => {
  if (videoRef.value && props.videoStream) {
    videoRef.value.srcObject = props.videoStream
  }
})
</script>

<style scoped>
.video-tile {
  position: relative;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.video-tile__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-tile--local .video-tile__video {
  transform: scaleX(-1);
}

.video-tile__avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
}

.video-tile__avatar img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.video-tile__initials {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  font-size: 1.5rem;
  font-weight: 600;
  border-radius: 50%;
}

.video-tile__overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.video-tile__name {
  display: flex;
  align-items: center;
  gap: 4px;
}

.name-text {
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.role-badge {
  padding: 2px 6px;
  background: var(--color-primary);
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
}

.video-tile__indicators {
  display: flex;
  gap: 4px;
}

.indicator {
  font-size: 0.875rem;
}

.indicator--quality.indicator--excellent {
  opacity: 1;
}

.indicator--quality.indicator--good {
  opacity: 0.8;
}

.indicator--quality.indicator--fair {
  opacity: 0.6;
}

.indicator--quality.indicator--poor {
  opacity: 0.4;
  color: var(--color-error);
}

.indicator--reconnecting {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.video-tile__speaking-ring {
  position: absolute;
  inset: 0;
  border: 3px solid var(--color-success);
  border-radius: 8px;
  pointer-events: none;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.video-tile--speaking {
  box-shadow: 0 0 0 2px var(--color-success);
}
</style>
