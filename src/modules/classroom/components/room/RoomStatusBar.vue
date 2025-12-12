<template>
  <div class="room-status-bar">
    <!-- Participants summary -->
    <div class="status-item">
      <span class="icon">👥</span>
      <span class="value">{{ connectedCount }}/{{ totalCount }}</span>
      <span class="label">{{ $t('classroom.status.participants') }}</span>
    </div>

    <!-- Connection quality -->
    <div class="status-item">
      <span class="icon">{{ qualityIcon }}</span>
      <span class="label">{{ $t(`classroom.quality.${overallQuality}`) }}</span>
    </div>

    <!-- Reconnecting participants -->
    <div v-if="reconnectingCount > 0" class="status-item status-item--warning">
      <span class="icon">🔄</span>
      <span class="value">{{ reconnectingCount }}</span>
      <span class="label">{{ $t('classroom.status.reconnecting') }}</span>
    </div>

    <!-- Participant list toggle -->
    <button class="status-btn" @click="showParticipants = !showParticipants">
      <span class="icon">📋</span>
    </button>

    <!-- Participant list dropdown -->
    <div v-if="showParticipants" class="participants-dropdown">
      <ParticipantList :participants="participants" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SessionParticipant } from '../../api/classroom'
import type { ConnectionStatus } from '../../stores/roomStore'
import ParticipantList from '../participants/ParticipantList.vue'

interface Props {
  participants: SessionParticipant[]
  connectionStatus: ConnectionStatus
}

const props = defineProps<Props>()

// State
const showParticipants = ref(false)

// Computed
const connectedCount = computed(() =>
  props.participants.filter((p) => p.status === 'connected').length
)

const totalCount = computed(() => props.participants.length)

const reconnectingCount = computed(() =>
  props.participants.filter((p) => p.status === 'reconnecting').length
)

const overallQuality = computed(() => {
  const connected = props.participants.filter((p) => p.status === 'connected')
  if (connected.length === 0) return 'poor'

  const qualities = connected.map((p) => {
    switch (p.connection_quality) {
      case 'excellent':
        return 4
      case 'good':
        return 3
      case 'fair':
        return 2
      case 'poor':
        return 1
      default:
        return 2
    }
  })

  const avg = qualities.reduce((a, b) => a + b, 0) / qualities.length

  if (avg >= 3.5) return 'excellent'
  if (avg >= 2.5) return 'good'
  if (avg >= 1.5) return 'fair'
  return 'poor'
})

const qualityIcon = computed(() => {
  switch (overallQuality.value) {
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
</script>

<style scoped>
.room-status-bar {
  position: fixed;
  bottom: 80px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
}

.status-item--warning {
  color: var(--color-warning);
}

.status-item .icon {
  font-size: 0.875rem;
}

.status-item .value {
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.status-btn:hover {
  background: var(--color-bg-hover);
}

.participants-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  min-width: 250px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
</style>
