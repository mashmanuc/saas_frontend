<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Education } from '../../api/marketplace'

interface Props {
  education: Education[]
}

defineProps<Props>()

const { t } = useI18n()

function formatYears(edu: Education): string {
  if (edu.current) {
    return `${edu.startYear} - ${t('marketplace.profile.education.present')}`
  }
  return edu.endYear ? `${edu.startYear} - ${edu.endYear}` : `${edu.startYear}`
}
</script>

<template>
  <section class="profile-education">
    <h2>
      <GraduationCap :size="20" />
      {{ t('marketplace.profile.education.title') }}
    </h2>

    <div class="education-list">
      <div v-for="edu in education" :key="edu.id" class="education-item">
        <div class="edu-icon">
          <GraduationCap :size="20" />
        </div>
        <div class="edu-content">
          <h3>{{ edu.degree }} {{ t('marketplace.profile.education.in') }} {{ edu.field }}</h3>
          <p class="institution">{{ edu.institution }}</p>
          <p class="years">{{ formatYears(edu) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-education {
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

.education-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.education-item {
  display: flex;
  gap: 1rem;
}

.edu-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.edu-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.institution {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem;
}

.years {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
