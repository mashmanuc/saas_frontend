// Phase 15 A2.3: useKnowledgeAnalytics — composable for tutor analytics dashboard
// Ref: AGENT_A_FE_CORE.md A2.3

import { ref, watch } from 'vue'
import {
  analyticsApi,
  type TutorStats,
  type ViewsDataPoint,
  type TutorAchievement,
} from '../api/analyticsApi'

// ─── Composable ─────────────────────────────────────────────────────────────

export function useKnowledgeAnalytics() {
  const stats = ref<TutorStats | null>(null)
  const viewsTimeseries = ref<ViewsDataPoint[]>([])
  const achievements = ref<TutorAchievement[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const period = ref<7 | 30 | 90>(30)

  async function loadAll(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const [statsRes, viewsRes, achievementsRes] = await Promise.all([
        analyticsApi.getMyStats(),
        analyticsApi.getViewsTimeseries(period.value),
        analyticsApi.getMyAchievements(),
      ])
      stats.value = statsRes
      viewsTimeseries.value = viewsRes
      achievements.value = achievementsRes
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      error.value = message || 'Не вдалося завантажити аналітику'
      console.error('[useKnowledgeAnalytics] Load failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadViews(): Promise<void> {
    try {
      viewsTimeseries.value = await analyticsApi.getViewsTimeseries(period.value)
    } catch (err) {
      console.error('[useKnowledgeAnalytics] Views load failed:', err)
    }
  }

  watch(period, () => loadViews())

  return {
    stats,
    viewsTimeseries,
    achievements,
    isLoading,
    error,
    period,
    loadAll,
    loadViews,
  }
}
