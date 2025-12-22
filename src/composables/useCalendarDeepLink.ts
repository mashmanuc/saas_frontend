import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface CalendarDeepLinkParams {
  calendar?: string  // tutor slug
  date?: string      // ISO date
  slot?: string      // slot ID
}

export function useCalendarDeepLink() {
  const route = useRoute()
  const router = useRouter()
  
  const tutorSlug = ref<string | null>(null)
  const selectedDate = ref<Date | null>(null)
  const selectedSlotId = ref<number | null>(null)

  function parseQueryParams(): CalendarDeepLinkParams {
    return {
      calendar: route.query.calendar as string | undefined,
      date: route.query.date as string | undefined,
      slot: route.query.slot as string | undefined
    }
  }

  function applyDeepLink() {
    const params = parseQueryParams()
    
    if (params.calendar) {
      tutorSlug.value = params.calendar
    }
    
    if (params.date) {
      try {
        selectedDate.value = new Date(params.date)
      } catch (err) {
        console.warn('[deepLink] Invalid date format:', params.date)
      }
    }
    
    if (params.slot) {
      const slotId = parseInt(params.slot, 10)
      if (!isNaN(slotId)) {
        selectedSlotId.value = slotId
      }
    }
  }

  function updateDeepLink(params: Partial<CalendarDeepLinkParams>) {
    const query = { ...route.query }
    
    if (params.calendar !== undefined) {
      if (params.calendar) {
        query.calendar = params.calendar
      } else {
        delete query.calendar
      }
    }
    
    if (params.date !== undefined) {
      if (params.date) {
        query.date = params.date
      } else {
        delete query.date
      }
    }
    
    if (params.slot !== undefined) {
      if (params.slot) {
        query.slot = params.slot
      } else {
        delete query.slot
      }
    }
    
    router.replace({ query })
  }

  function clearDeepLink() {
    const query = { ...route.query }
    delete query.calendar
    delete query.date
    delete query.slot
    router.replace({ query })
  }

  function generateDeepLink(params: CalendarDeepLinkParams): string {
    const url = new URL(window.location.origin + route.path)
    
    if (params.calendar) {
      url.searchParams.set('calendar', params.calendar)
    }
    
    if (params.date) {
      url.searchParams.set('date', params.date)
    }
    
    if (params.slot) {
      url.searchParams.set('slot', params.slot)
    }
    
    return url.toString()
  }

  onMounted(() => {
    applyDeepLink()
  })

  watch(() => route.query, () => {
    applyDeepLink()
  })

  return {
    tutorSlug,
    selectedDate,
    selectedSlotId,
    parseQueryParams,
    updateDeepLink,
    clearDeepLink,
    generateDeepLink
  }
}
