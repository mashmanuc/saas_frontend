<template>
  <div class="session-grid">
    <SessionCard
      v-for="session in sessions"
      :key="session.id"
      :session="session"
      @open="$emit('open', $event)"
      @share="$emit('share', $event)"
      @duplicate="$emit('duplicate', $event)"
      @delete="$emit('delete', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SoloSession } from '../../types/solo'
import SessionCard from './SessionCard.vue'

defineProps<{
  sessions: SoloSession[]
}>()

defineEmits<{
  (e: 'open', session: SoloSession): void
  (e: 'share', session: SoloSession): void
  (e: 'duplicate', session: SoloSession): void
  (e: 'delete', session: SoloSession): void
}>()
</script>

<style scoped>
.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
</style>
