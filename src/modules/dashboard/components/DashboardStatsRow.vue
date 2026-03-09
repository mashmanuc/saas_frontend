<template>
  <div
    class="stats-row"
    role="region"
    :aria-label="$t('dashboard.stats.ariaLabel')"
  >
    <StatsCard
      v-for="stat in stats"
      :key="stat.key"
      :icon="stat.icon"
      :label="$t(stat.label)"
      :value="stat.value"
      :trend="stat.trend"
      :to="stat.to"
    />
  </div>
</template>

<script setup lang="ts">
import StatsCard from './StatsCard.vue'

export interface StatItem {
  key: string
  icon: string
  label: string
  value: number | string
  trend?: string
  to?: string
}

defineProps<{
  stats: StatItem[]
}>()
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md, 16px);
}

@media (min-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
