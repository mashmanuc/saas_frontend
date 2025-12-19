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
  <div class="tutor-grid" :class="{ loading }" data-test="marketplace-grid">
    <TutorCard v-for="tutor in tutors" :key="tutor.id" :tutor="tutor" data-test="marketplace-tutor-card" />
  </div>
</template>

<style scoped>
.tutor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.tutor-grid.loading {
  opacity: 0.6;
  pointer-events: none;
}
</style>
