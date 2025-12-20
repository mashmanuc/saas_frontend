<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Subject } from '../../api/marketplace'

interface Props {
  subjects: Subject[]
}

defineProps<Props>()

const { t } = useI18n()

function formatLevel(level: string): string {
  if (!level) return t('common.notSpecified')
  return t(`marketplace.profile.subjectLevel.${level}`)
}
</script>

<template>
  <section class="profile-subjects">
    <h2>
      <BookOpen :size="20" />
      {{ t('marketplace.profile.subjectsTitle') }}
    </h2>

    <div class="subjects-list">
      <div v-for="subject in subjects" :key="subject.id" class="subject-item">
        <div class="subject-header">
          <span class="subject-name">{{ subject.name }}</span>
          <span
            class="subject-level"
          >
            {{ formatLevel(subject.level) }}
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
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font: var(--font-headline);
  margin: 0 0 1.25rem;
  color: var(--text-primary);
}

.subjects-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subject-item {
  padding: 0.75rem;
  background: var(--surface-card-muted);
  border-radius: var(--radius-md);
}

.subject-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.subject-name {
  font-weight: 500;
  color: var(--text-primary);
}

.subject-level {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.subject-desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0.5rem 0 0;
}
</style>
