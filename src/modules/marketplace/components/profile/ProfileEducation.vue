<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
import type { Education } from '../../api/marketplace'

interface Props {
  education: Education[]
}

defineProps<Props>()

function formatYears(edu: Education): string {
  if (edu.current) {
    return `${edu.startYear} - Present`
  }
  return edu.endYear ? `${edu.startYear} - ${edu.endYear}` : `${edu.startYear}`
}
</script>

<template>
  <section class="profile-education">
    <h2>
      <GraduationCap :size="20" />
      Education
    </h2>

    <div class="education-list">
      <div v-for="edu in education" :key="edu.id" class="education-item">
        <div class="edu-icon">
          <GraduationCap :size="20" />
        </div>
        <div class="edu-content">
          <h3>{{ edu.degree }} in {{ edu.field }}</h3>
          <p class="institution">{{ edu.institution }}</p>
          <p class="years">{{ formatYears(edu) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.profile-education {
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
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 8px;
  flex-shrink: 0;
}

.edu-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: #111827;
}

.institution {
  font-size: 0.9375rem;
  color: #374151;
  margin: 0 0 0.25rem;
}

.years {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0;
}
</style>
