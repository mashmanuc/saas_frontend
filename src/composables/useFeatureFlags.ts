import { ref, computed } from 'vue'
console.log('[flags] env value', import.meta.env.VITE_ENABLE_V045_CALENDAR_SYNC)
interface FeatureFlags {
  ENABLE_V044_CALENDAR_SYNC: boolean
  ENABLE_V045_CALENDAR_SYNC: boolean
  ENABLE_V046_CALENDAR_CLICK_MODE: boolean
  [key: string]: boolean
}

const flags = ref<FeatureFlags>({
  ENABLE_V044_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V044_CALENDAR_SYNC === 'true',
  ENABLE_V045_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V045_CALENDAR_SYNC === 'true',
  ENABLE_V046_CALENDAR_CLICK_MODE: import.meta.env.VITE_ENABLE_V046_CALENDAR_CLICK_MODE === 'true'
})

export function useFeatureFlags() {
  const isCalendarSyncEnabled = computed(() => flags.value.ENABLE_V044_CALENDAR_SYNC)
  const isV045CalendarSyncEnabled = computed(() => flags.value.ENABLE_V045_CALENDAR_SYNC)
  const isV046CalendarClickMode = computed(() => flags.value.ENABLE_V046_CALENDAR_CLICK_MODE)

  function setFlag(key: keyof FeatureFlags, value: boolean) {
    flags.value[key] = value
  }

  function getFlag(key: keyof FeatureFlags): boolean {
    return flags.value[key] ?? false
  }

  async function fetchFlags() {
    try {
      // In production, this would fetch from backend
      // For now, use env vars
      const envFlags: FeatureFlags = {
        ENABLE_V044_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V044_CALENDAR_SYNC === 'true',
        ENABLE_V045_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V045_CALENDAR_SYNC === 'true',
        ENABLE_V046_CALENDAR_CLICK_MODE: import.meta.env.VITE_ENABLE_V046_CALENDAR_CLICK_MODE === 'true'
      }
      
      flags.value = { ...flags.value, ...envFlags }
    } catch (err) {
      console.error('[featureFlags] Failed to fetch flags:', err)
    }
  }

  return {
    flags: computed(() => flags.value),
    isCalendarSyncEnabled,
    isV045CalendarSyncEnabled,
    isV046CalendarClickMode,
    setFlag,
    getFlag,
    fetchFlags
  }
}
