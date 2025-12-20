<script setup lang="ts">
import type { TutorListItem } from '../../api/marketplace'
import TutorCard from './TutorCard.vue'

interface Props {
  tutors: TutorListItem[]
  loading?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="tutor-list" :class="{ loading }" data-test="marketplace-grid">
    <TutorCard v-for="tutor in tutors" :key="tutor.id" :tutor="tutor" data-test="marketplace-tutor-card" />
  </div>
</template>

<style scoped>
.tutor-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.tutor-list.loading {
  opacity: 0.6;
  pointer-events: none;
}
</style>
