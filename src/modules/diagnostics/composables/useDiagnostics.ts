/**
 * Diagnostics composable for dev panel and local logging.
 */
import { ref, computed, readonly } from 'vue'
import type { LocalLogEntry } from '../types'

const MAX_LOCAL_LOGS = 200
let logIdCounter = 0

// Shared state
const logs = ref<LocalLogEntry[]>([])
const isPanelOpen = ref(false)
const filters = ref({
  severity: null as string | null,
  service: null as string | null,
})

export function useDiagnostics() {
  /**
   * Add log to local buffer.
   */
  function addLocalLog(entry: Omit<LocalLogEntry, 'id'>): void {
    const log: LocalLogEntry = {
      ...entry,
      id: ++logIdCounter,
    }

    logs.value.unshift(log)

    // Trim if too many
    if (logs.value.length > MAX_LOCAL_LOGS) {
      logs.value = logs.value.slice(0, MAX_LOCAL_LOGS)
    }
  }

  /**
   * Reset filters to initial state.
   */
  function resetFilters(): void {
    filters.value = {
      severity: null,
      service: null,
    }
  }

  /**
   * Clear all logs and reset filters.
   */
  function clearLogs(): void {
    logs.value = []
    resetFilters()
  }

  /**
   * Toggle panel visibility.
   */
  function togglePanel(): void {
    isPanelOpen.value = !isPanelOpen.value
  }

  /**
   * Open panel.
   */
  function openPanel(): void {
    isPanelOpen.value = true
  }

  /**
   * Close panel.
   */
  function closePanel(): void {
    isPanelOpen.value = false
  }

  /**
   * Set filter.
   */
  function setFilter(key: 'severity' | 'service', value: string | null): void {
    filters.value[key] = value
  }

  /**
   * Filtered logs.
   */
  const filteredLogs = computed(() => {
    let result = logs.value

    if (filters.value.severity) {
      result = result.filter((l) => l.severity === filters.value.severity)
    }

    if (filters.value.service) {
      result = result.filter((l) =>
        (l.context?.service as string | undefined)?.includes(filters.value.service!)
      )
    }

    return result
  })

  /**
   * Log counts by severity.
   */
  const logCounts = computed(() => ({
    info: logs.value.filter((l) => l.severity === 'info').length,
    warning: logs.value.filter((l) => l.severity === 'warning').length,
    error: logs.value.filter((l) => l.severity === 'error').length,
    total: logs.value.length,
  }))

  return {
    // State
    logs: readonly(logs),
    filteredLogs,
    logCounts,
    isPanelOpen: readonly(isPanelOpen),
    filters: readonly(filters),

    // Actions
    addLocalLog,
    clearLogs,
    togglePanel,
    openPanel,
    closePanel,
    setFilter,
    resetFilters,
  }
}
