/**
 * Calendar Debug Module - Main Export
 * FE-55.DEBUG - Діагностичний модуль календаря v0.55
 */

export { useCalendarDebugSnapshot } from './composables/useCalendarDebugSnapshot'
export { calendarDebugRecorder } from './services/calendarDebugRecorder'
export { default as CalendarDebugPanel } from './components/CalendarDebugPanel.vue'
export { default as DebugToggleButton } from './components/DebugToggleButton.vue'
export type * from './types/calendarDebug'

/**
 * Initialize debug module
 * Викликається один раз при запуску додатку
 */
export function initCalendarDebug() {
  if (import.meta.env.VITE_CALENDAR_DEBUG !== 'true') {
    return
  }

  // Global debug hook
  if (typeof window !== 'undefined') {
    window.__M4_DEBUG__ = window.__M4_DEBUG__ || {}
    window.__M4_DEBUG__.calendar = {
      open: () => {
        const event = new CustomEvent('calendar-debug:open')
        window.dispatchEvent(event)
      },
      close: () => {
        const event = new CustomEvent('calendar-debug:close')
        window.dispatchEvent(event)
      },
      export: () => {
        const event = new CustomEvent('calendar-debug:export')
        window.dispatchEvent(event)
      },
      captureNow: () => {
        const event = new CustomEvent('calendar-debug:capture')
        window.dispatchEvent(event)
      },
    }

    console.info('[Calendar Debug] Module initialized. Use window.__M4_DEBUG__.calendar')
  }
}

// Type augmentation for window
declare global {
  interface Window {
    __M4_DEBUG__?: {
      calendar?: {
        open: () => void
        close: () => void
        export: () => void
        captureNow: () => void
      }
    }
  }
}
