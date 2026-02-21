/**
 * useStaffStats composable v0.90.0
 *
 * Auto-refresh stats for staff dashboard.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import staffStatsApi, { type StatsOverview } from '../api/staffStatsApi'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function useStaffStats() {
  const stats = ref<StatsOverview | null>(null)
  const loading = ref(true)
  const error = ref('')
  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchStats() {
    try {
      stats.value = await staffStatsApi.getStatsOverview()
      error.value = ''
    } catch (e: any) {
      error.value = e?.message || 'Failed to load stats'
    } finally {
      loading.value = false
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    timer = setInterval(fetchStats, REFRESH_INTERVAL)
  }

  function stopAutoRefresh() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    fetchStats()
    startAutoRefresh()
  })

  onUnmounted(stopAutoRefresh)

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  }
}
