/**
 * Calendar Debug Snapshot Composable
 * FE-55.DEBUG - Діагностичний модуль календаря v0.55
 *
 * Компоненти (панель/кнопка) мають ділити спільний стан, тому
 * використовуємо сінглтон, який ініціалізується один раз.
 */

import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { calendarDebugRecorder } from '../services/calendarDebugRecorder'
import type { DebugExportBundle, RawSnapshotPayload } from '../types/calendarDebug'

type DebugTab = 'snapshot' | 'legacy' | 'metadata' | 'logs'

let debugSnapshotState: ReturnType<typeof createCalendarDebugState> | null = null
let globalEventsBound = false

function createCalendarDebugState() {
  const store = useCalendarWeekStore()
  const isDebugMode = import.meta.env.VITE_CALENDAR_DEBUG === 'true'

  const {
    snapshot,
    meta,
    days,
    events,
    accessible,
    blockedRanges,
    dictionaries,
  } = storeToRefs(store)

  const rawSnapshots = ref<RawSnapshotPayload[]>([])
  const isPanelOpen = ref(false)
  const activeTab = ref<DebugTab>('snapshot')

  const v055Snapshot = computed(() => ({
    meta: meta.value,
    days: days.value,
    events: events.value,
    accessible: accessible.value,
    blockedRanges: blockedRanges.value,
    dictionaries: dictionaries.value,
  }))

  const apiLogs = computed(() => calendarDebugRecorder.getApiLogs())
  const wsLogs = computed(() => calendarDebugRecorder.getWsLogs())

  const stats = computed(() => ({
    eventsCount: events.value?.length || 0,
    accessibleCount: accessible.value?.length || 0,
    blockedRangesCount: blockedRanges.value?.length || 0,
    apiLogsCount: apiLogs.value.length,
    wsLogsCount: wsLogs.value.length,
    rawSnapshotsCount: rawSnapshots.value.length,
  }))

  function recordSnapshot(type: 'v055', payload: any) {
    if (!isDebugMode || !payload) return

    const snapshotEntry: RawSnapshotPayload = {
      type,
      at: new Date().toISOString(),
      tutorId: meta.value?.tutorId,
      weekStart: meta.value?.weekStart,
      payload: calendarDebugRecorder.maskSensitiveData(payload),
      size: JSON.stringify(payload).length,
    }

    rawSnapshots.value.push(snapshotEntry)

    if (rawSnapshots.value.length > 10) {
      rawSnapshots.value.shift()
    }
  }

  function exportDebugBundle(): DebugExportBundle {
    const bundle: DebugExportBundle = {
      version: 'v0.55',
      exportedAt: new Date().toISOString(),
      userContext: {
        role: 'tutor',
        masked: true,
      },
      flags: {
        calendarDebug: isDebugMode,
      },
      apiLogs: apiLogs.value,
      wsLogs: wsLogs.value,
      storeSnapshot: {
        v055: calendarDebugRecorder.maskSensitiveData(v055Snapshot.value),
      },
      metadata: {
        totalSize: calculateBundleSize(),
        logsCount: apiLogs.value.length + wsLogs.value.length,
        snapshotsCount: rawSnapshots.value.length,
      },
    }

    return bundle
  }

  function downloadDebugBundle() {
    const bundle = exportDebugBundle()
    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `calendar-debug-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyDebugBundle() {
    const bundle = exportDebugBundle()
    const json = JSON.stringify(bundle, null, 2)
    await navigator.clipboard.writeText(json)
  }

  function calculateBundleSize(): number {
    try {
      const bundle = exportDebugBundle()
      return JSON.stringify(bundle).length
    } catch {
      return 0
    }
  }

  function clearAllLogs() {
    calendarDebugRecorder.clearLogs()
    rawSnapshots.value = []
  }

  function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value
  }

  function openPanel() {
    isPanelOpen.value = true
  }

  function closePanel() {
    isPanelOpen.value = false
  }

  function setActiveTab(tab: DebugTab) {
    activeTab.value = tab
  }

  function captureNow() {
    recordSnapshot('v055', snapshot.value)
  }

  function bindGlobalEvents() {
    if (globalEventsBound || typeof window === 'undefined') return

    window.addEventListener('calendar-debug:open', openPanel)
    window.addEventListener('calendar-debug:close', closePanel)
    window.addEventListener('calendar-debug:export', downloadDebugBundle)
    window.addEventListener('calendar-debug:capture', captureNow)

    globalEventsBound = true
  }

  bindGlobalEvents()

  return {
    isDebugMode,
    isPanelOpen,
    activeTab,
    v055Snapshot,
    apiLogs,
    wsLogs,
    rawSnapshots,
    stats,
    recordSnapshot,
    exportDebugBundle,
    downloadDebugBundle,
    copyDebugBundle,
    clearAllLogs,
    togglePanel,
    openPanel,
    closePanel,
    setActiveTab,
    captureNow,
  }
}

export function useCalendarDebugSnapshot() {
  if (!debugSnapshotState) {
    debugSnapshotState = createCalendarDebugState()
  }

  return debugSnapshotState
}
