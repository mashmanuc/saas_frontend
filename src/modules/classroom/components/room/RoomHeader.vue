<template>
  <header class="room-header">
    <!-- Left: Session info -->
    <div class="room-header__info">
      <div class="session-type">
        <span class="icon">{{ sessionIcon }}</span>
        <span class="type-label">{{ $t(`classroom.types.${session?.session_type || 'lesson'}`) }}</span>
      </div>
      <div class="participants-info">
        <span class="icon">👥</span>
        <span>{{ session?.participants.length || 0 }}</span>
      </div>
    </div>

    <!-- Center: Timer -->
    <div class="room-header__timer">
      <span class="timer-icon">⏱️</span>
      <span class="timer-value">{{ elapsed }}</span>
    </div>

    <!-- Right: Connection status -->
    <div class="room-header__status">
      <div class="connection-indicator" :class="`connection-indicator--${connectionStatus}`">
        <span class="indicator-dot"></span>
        <span class="indicator-label">{{ $t(`classroom.status.${connectionStatus}`) }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClassroomSession } from '../../api/classroom'
import type { ConnectionStatus } from '../../stores/roomStore'

interface Props {
  session: ClassroomSession | null
  elapsed: string
  connectionStatus: ConnectionStatus
}

const props = defineProps<Props>()

const sessionIcon = computed(() => {
  switch (props.session?.session_type) {
    case 'lesson':
      return '📚'
    case 'solo':
      return '📝'
    case 'group':
      return '👥'
    case 'demo':
      return '🎬'
    default:
      return '📚'
  }
})
</script>

<style scoped>
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.room-header__info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.session-type,
.participants-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.room-header__timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-tertiary);
  border-radius: 8px;
}

.timer-icon {
  font-size: 1rem;
}

.timer-value {
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

.room-header__status {
  display: flex;
  align-items: center;
}

.connection-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.75rem;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.connection-indicator--connected {
  background: var(--color-success-light);
  color: var(--color-success);
}

.connection-indicator--connected .indicator-dot {
  background: var(--color-success);
}

.connection-indicator--connecting,
.connection-indicator--reconnecting {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.connection-indicator--connecting .indicator-dot,
.connection-indicator--reconnecting .indicator-dot {
  background: var(--color-warning);
  animation: pulse 1s ease-in-out infinite;
}

.connection-indicator--disconnected {
  background: var(--color-error-light);
  color: var(--color-error);
}

.connection-indicator--disconnected .indicator-dot {
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

.icon {
  font-size: 1rem;
}
</style>
