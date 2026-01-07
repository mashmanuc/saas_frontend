import { ref, computed, watch } from 'vue'
import marketplaceApi from '@/modules/marketplace/api/marketplace'
import type { AvailableSlot } from '@/modules/marketplace/api/marketplace'
import { apiCall, commonSchemas, getErrorMessage } from '@/utils/apiWrapper'
import { z } from 'zod'

/**
 * Centralized Availability Management
 * Єдиний composable для роботи зі слотами доступності
 */

interface CachedAvailability {
  tutorId: number
  weekStart: string
  slots: AvailableSlot[]
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const availabilityCache = new Map<string, CachedAvailability>()

export function useAvailability(tutorId?: number) {
  const slots = ref<AvailableSlot[]>([])
  const selectedSlot = ref<AvailableSlot | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const weekStart = ref<string>(getCurrentWeekStart())
  const timezone = ref<string>('Europe/Kiev')

  // Computed
  const slotsByDate = computed(() => {
    const grouped: Record<string, AvailableSlot[]> = {}
    
    slots.value.forEach(slot => {
      const date = slot.start_at.split('T')[0]
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(slot)
    })

    return grouped
  })

  const hasAvailableSlots = computed(() => {
    return slots.value.some(slot => slot.status === 'available')
  })

  // Cache key
  const getCacheKey = (tid: number, week: string) => `${tid}-${week}`

  // Fetch availability with caching
  async function fetchWeek(tid?: number, week?: string) {
    const targetTutorId = tid || tutorId
    const targetWeek = week || weekStart.value

    if (!targetTutorId) {
      error.value = 'Tutor ID is required'
      return
    }

    // Check cache first
    const cacheKey = getCacheKey(targetTutorId, targetWeek)
    const cached = availabilityCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[useAvailability] Using cached data')
      slots.value = cached.slots
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Schema for validation (v0.59 contract: cells = array of dayCells)
      const responseSchema = z.object({
        tutor_id: z.number(),
        week_start: z.string(),
        timezone: z.string(),
        cells: z.array(z.object({
          date: z.string(),
          day_status: z.string(),
          slots: z.array(z.object({
            slot_id: z.string(),
            start_at: z.string(),
            duration_min: z.number(),
            status: z.string(),
          })),
        })),
      })

      const response = await apiCall(
        () => marketplaceApi.getTutorCalendar({
          tutorId: targetTutorId,
          weekStart: targetWeek,
          timezone: timezone.value,
        }),
        responseSchema,
        {
          errorContext: 'Fetch availability',
          timeout: 10000,
          retries: 2,
        }
      )

      // Flatten dayCells into a single array of slots for backward compatibility
      const flattenedSlots: AvailableSlot[] = []
      if (response.cells) {
        for (const dayCell of response.cells) {
          for (const slot of dayCell.slots) {
            flattenedSlots.push({
              slot_id: slot.slot_id,
              start_at: slot.start_at,
              duration_min: slot.duration_min,
              status: slot.status as 'available' | 'booked' | 'blocked',
            })
          }
        }
      }
      slots.value = flattenedSlots

      // Update cache
      availabilityCache.set(cacheKey, {
        tutorId: targetTutorId,
        weekStart: targetWeek,
        slots: slots.value,
        timestamp: Date.now(),
      })

      console.log('[useAvailability] Fetched and cached', slots.value.length, 'slots')
    } catch (err) {
      error.value = getErrorMessage(err, 'Не вдалося завантажити доступність')
      console.error('[useAvailability] Fetch failed:', err)
      
      // Try to use stale cache on error
      const cached = availabilityCache.get(cacheKey)
      if (cached) {
        console.warn('[useAvailability] Using stale cache due to error')
        slots.value = cached.slots
        error.value = 'Показано збережені дані (можуть бути застарілими)'
      }
    } finally {
      isLoading.value = false
    }
  }

  // Select slot
  function selectSlot(slot: AvailableSlot | null) {
    if (slot && slot.status !== 'available') {
      console.warn('[useAvailability] Cannot select non-available slot')
      return
    }
    selectedSlot.value = slot
  }

  // Clear selection
  function clearSelection() {
    selectedSlot.value = null
  }

  // Navigate week
  function navigateWeek(direction: number) {
    const current = new Date(weekStart.value)
    current.setDate(current.getDate() + (direction * 7))
    weekStart.value = formatDate(current)
  }

  function goToToday() {
    weekStart.value = getCurrentWeekStart()
  }

  // Clear cache for specific tutor
  function clearCache(tid?: number) {
    if (tid) {
      const keysToDelete: string[] = []
      availabilityCache.forEach((_, key) => {
        if (key.startsWith(`${tid}-`)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => availabilityCache.delete(key))
    } else {
      availabilityCache.clear()
    }
  }

  // Auto-fetch when tutorId or weekStart changes
  watch([() => tutorId, weekStart], () => {
    if (tutorId) {
      fetchWeek()
    }
  }, { immediate: true })

  return {
    // State
    slots,
    selectedSlot,
    isLoading,
    error,
    weekStart,
    timezone,

    // Computed
    slotsByDate,
    hasAvailableSlots,

    // Methods
    fetchWeek,
    selectSlot,
    clearSelection,
    navigateWeek,
    goToToday,
    clearCache,
  }
}

// Helper functions
function getCurrentWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday as start
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return formatDate(monday)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
