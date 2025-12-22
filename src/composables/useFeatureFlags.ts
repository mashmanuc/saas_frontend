import { ref, computed } from 'vue'

interface FeatureFlags {
  ENABLE_V044_CALENDAR_SYNC: boolean
  [key: string]: boolean
}

const flags = ref<FeatureFlags>({
  ENABLE_V044_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V044_CALENDAR_SYNC === 'true'
})

export function useFeatureFlags() {
  const isCalendarSyncEnabled = computed(() => flags.value.ENABLE_V044_CALENDAR_SYNC)

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
        ENABLE_V044_CALENDAR_SYNC: import.meta.env.VITE_ENABLE_V044_CALENDAR_SYNC === 'true'
      }
      
      flags.value = { ...flags.value, ...envFlags }
    } catch (err) {
      console.error('[featureFlags] Failed to fetch flags:', err)
    }
  }

  return {
    flags: computed(() => flags.value),
    isCalendarSyncEnabled,
    setFlag,
    getFlag,
    fetchFlags
  }
}
