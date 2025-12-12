<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
import type { Subject } from '../../api/marketplace'

interface Props {
  subjects: Subject[]
}

defineProps<Props>()

function getLevelColor(level: string): string {
  switch (level) {
    case 'beginner':
      return '#22c55e'
    case 'intermediate':
      return '#3b82f6'
    case 'advanced':
      return '#8b5cf6'
    case 'expert':
      return '#f59e0b'
    default:
      return '#6b7280'
  }
}
</script>

<template>
  <section class="profile-subjects">
    <h2>
      <BookOpen :size="20" />
      Subjects
    </h2>

    <div class="subjects-list">
      <div v-for="subject in subjects" :key="subject.id" class="subject-item">
        <div class="subject-header">
          <span class="subject-name">{{ subject.name }}</span>
          <span
            class="subject-level"
            :style="{ color: getLevelColor(subject.level) }"
          >
            {{ subject.level }}
          </span>
        </div>
        <p v-if="subject.description" class="subject-desc">
          {{ subject.description }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-subjects {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: #111827;
}

.subjects-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subject-item {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
}

.subject-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.subject-name {
  font-weight: 500;
  color: #111827;
}

.subject-level {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.subject-desc {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}
</style>
