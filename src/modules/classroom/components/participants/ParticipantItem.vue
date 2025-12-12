<template>
  <div
    class="participant-item"
    :class="{
      'participant-item--host': participant.role === 'host',
      'participant-item--disconnected': participant.status === 'disconnected',
      'participant-item--reconnecting': participant.status === 'reconnecting',
    }"
  >
    <!-- Avatar -->
    <div class="participant-item__avatar">
      <img
        v-if="participant.avatar"
        :src="participant.avatar"
        :alt="participant.name"
      />
      <span v-else class="initials">{{ initials }}</span>

      <!-- Status indicator -->
      <span class="status-dot" :class="`status-dot--${participant.status}`"></span>
    </div>

    <!-- Info -->
    <div class="participant-item__info">
      <div class="name-row">
        <span class="name">{{ participant.name }}</span>
        <span v-if="participant.role === 'host'" class="role-badge">
          {{ $t('classroom.roles.host') }}
        </span>
      </div>
      <div class="status-row">
        <span class="connection-quality" :class="`quality--${participant.connection_quality}`">
          {{ $t(`classroom.quality.${participant.connection_quality}`) }}
        </span>
      </div>
    </div>

    <!-- Media indicators -->
    <div class="participant-item__media">
      <span v-if="!participant.audio_enabled" class="media-icon media-icon--off">
        🔇
      </span>
      <span v-if="!participant.video_enabled" class="media-icon media-icon--off">
        📷
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SessionParticipant } from '../../api/classroom'

interface Props {
  participant: SessionParticipant
}

const props = defineProps<Props>()

defineEmits<{
  action: [action: string, userId: number]
}>()

// Computed
const initials = computed(() => {
  const parts = props.participant.name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return props.participant.name.slice(0, 2).toUpperCase()
})
</script>

<style scoped>
.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.participant-item:hover {
  background: var(--color-bg-hover);
}

.participant-item--host {
  background: var(--color-primary-light);
}

.participant-item--disconnected {
  opacity: 0.5;
}

.participant-item--reconnecting {
  opacity: 0.7;
}

.participant-item__avatar {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.participant-item__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 50%;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-bg-secondary);
  border-radius: 50%;
}

.status-dot--connected {
  background: var(--color-success);
}

.status-dot--reconnecting {
  background: var(--color-warning);
  animation: pulse 1s ease-in-out infinite;
}

.status-dot--disconnected {
  background: var(--color-error);
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

.participant-item__info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.status-row {
  margin-top: 2px;
}

.connection-quality {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.quality--excellent {
  color: var(--color-success);
}

.quality--good {
  color: var(--color-success);
}

.quality--fair {
  color: var(--color-warning);
}

.quality--poor {
  color: var(--color-error);
}

.participant-item__media {
  display: flex;
  gap: 4px;
}

.media-icon {
  font-size: 0.875rem;
  opacity: 0.5;
}

.media-icon--off {
  opacity: 1;
  color: var(--color-error);
}
</style>
