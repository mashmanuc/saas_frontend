<!-- Phase 15 A2.5: Minimal Knowledge stats widget for TutorDashboard
     Shows 3 numbers (views, forks, lessons) + link to /knowledge/analytics.
     Ref: AGENT_A_FE_CORE.md A2.5 -->
<template>
  <div class="knowledge-stats-widget">
    <div class="knowledge-stats-widget__header">
      <h3 class="knowledge-stats-widget__title">Knowledge</h3>
      <router-link to="/knowledge/analytics" class="knowledge-stats-widget__link">Детальніше →</router-link>
    </div>

    <div v-if="isLoading" class="knowledge-stats-widget__loading">
      <div v-for="i in 3" :key="i" class="knowledge-stats-widget__skeleton" />
    </div>

    <div v-else-if="stats" class="knowledge-stats-widget__stats">
      <div class="knowledge-stats-widget__stat">
        <span class="knowledge-stats-widget__stat-value">{{ formatNumber(stats.total_views) }}</span>
        <span class="knowledge-stats-widget__stat-label">переглядів</span>
      </div>
      <div class="knowledge-stats-widget__stat">
        <span class="knowledge-stats-widget__stat-value">{{ formatNumber(stats.total_forks) }}</span>
        <span class="knowledge-stats-widget__stat-label">форків</span>
      </div>
      <div class="knowledge-stats-widget__stat">
        <span class="knowledge-stats-widget__stat-value">{{ stats.lessons_count }}</span>
        <span class="knowledge-stats-widget__stat-label">уроків</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { analyticsApi, type TutorStats } from '../api/analyticsApi'

const stats = ref<TutorStats | null>(null)
const isLoading = ref(true)

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

onMounted(async () => {
  try {
    stats.value = await analyticsApi.getMyStats()
  } catch (err) {
    console.error('[KnowledgeStatsWidget] Load failed:', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.knowledge-stats-widget {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.knowledge-stats-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.knowledge-stats-widget__title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.knowledge-stats-widget__link {
  font-size: 12px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
}

.knowledge-stats-widget__link:hover { text-decoration: underline; }

.knowledge-stats-widget__loading {
  display: flex;
  gap: 12px;
}

.knowledge-stats-widget__skeleton {
  flex: 1;
  height: 48px;
  background: #e2e8f0;
  border-radius: 8px;
  animation: ksw-pulse 1.5s ease-in-out infinite;
}

@keyframes ksw-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.knowledge-stats-widget__stats {
  display: flex;
  gap: 12px;
}

.knowledge-stats-widget__stat {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.knowledge-stats-widget__stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.knowledge-stats-widget__stat-label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .knowledge-stats-widget__skeleton { animation: none; }
}
</style>
