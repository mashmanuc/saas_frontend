<template>
  <div class="participant-list">
    <div class="participant-list__header">
      <h3>{{ $t('classroom.participants.title') }}</h3>
      <span class="count">{{ participants.length }}</span>
    </div>

    <div class="participant-list__items">
      <ParticipantItem
        v-for="participant in sortedParticipants"
        :key="participant.user_id"
        :participant="participant"
        @action="handleAction"
      />
    </div>

    <div v-if="participants.length === 0" class="participant-list__empty">
      {{ $t('classroom.participants.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SessionParticipant } from '../../api/classroom'
import ParticipantItem from './ParticipantItem.vue'

interface Props {
  participants: SessionParticipant[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  action: [action: string, userId: number]
}>()

// Computed
const sortedParticipants = computed(() => {
  return [...props.participants].sort((a, b) => {
    // Host first
    if (a.role === 'host' && b.role !== 'host') return -1
    if (b.role === 'host' && a.role !== 'host') return 1

    // Then by status (connected first)
    if (a.status === 'connected' && b.status !== 'connected') return -1
    if (b.status === 'connected' && a.status !== 'connected') return 1

    // Then alphabetically
    return a.name.localeCompare(b.name)
  })
})

// Handlers
function handleAction(action: string, userId: number): void {
  emit('action', action, userId)
}
</script>

<style scoped>
.participant-list {
  max-height: 300px;
  overflow-y: auto;
}

.participant-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.participant-list__header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.count {
  padding: 2px 8px;
  background: var(--color-bg-tertiary);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.participant-list__items {
  padding: 8px;
}

.participant-list__empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 0.875rem;
}
</style>
