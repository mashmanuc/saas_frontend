<template>
  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-value">{{ stats.total_lessons }}</span>
      <span class="stat-label">Всього уроків</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{ stats.upcoming_lessons }}</span>
      <span class="stat-label">Заплановано</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{ stats.total_hours }}</span>
      <span class="stat-label">Годин навчання</span>
    </div>
    <div v-if="stats.this_month_lessons !== undefined" class="stat-card">
      <span class="stat-value">{{ stats.this_month_lessons }}</span>
      <span class="stat-label">Цього місяця</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StudentStats } from '../api/dashboard'

interface Props {
  stats: StudentStats
}

defineProps<Props>()
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-md);
}

.stat-card {
  text-align: center;
  padding: var(--space-md);
  background: var(--card-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.stat-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
