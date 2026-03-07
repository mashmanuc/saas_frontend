/**
 * Spotlight Mode composable — tutor focuses student attention on a canvas object.
 *
 * Sends/receives spotlight events via the existing presence WebSocket.
 * No backend model needed — pure realtime ephemeral event.
 *
 * Usage:
 *   const spotlight = useSpotlight({ sendMessage, onSpotlightReceived })
 *   spotlight.activate({ x: 100, y: 200, w: 400, h: 300 })
 *   spotlight.deactivate()
 */

import { ref, onUnmounted } from 'vue'

export interface SpotlightTarget {
  x: number
  y: number
  w: number
  h: number
  zoom?: number
}

export interface SpotlightEvent {
  type: 'spotlight.focus' | 'spotlight.clear'
  user_id: string
  target?: SpotlightTarget
}

export interface UseSpotlightOptions {
  /** Send message via presence WebSocket */
  sendMessage: (data: Record<string, unknown>) => void
  /** Current user ID */
  userId: string
  /** Auto-clear spotlight after N ms (default 8000) */
  autoClearMs?: number
}

export function useSpotlight(options: UseSpotlightOptions) {
  const { sendMessage, userId, autoClearMs = 8000 } = options

  /** Currently active spotlight (received from tutor or self) */
  const activeSpotlight = ref<SpotlightTarget | null>(null)
  /** Who initiated the spotlight */
  const spotlightBy = ref<string | null>(null)

  let autoClearTimer: ReturnType<typeof setTimeout> | null = null

  /** Tutor: broadcast spotlight focus on a region */
  function activate(target: SpotlightTarget) {
    activeSpotlight.value = target
    spotlightBy.value = userId

    sendMessage({
      type: 'spotlight.focus',
      user_id: userId,
      target,
    })

    // Auto-clear after timeout
    clearAutoClear()
    autoClearTimer = setTimeout(() => deactivate(), autoClearMs)
  }

  /** Tutor: clear spotlight */
  function deactivate() {
    activeSpotlight.value = null
    spotlightBy.value = null
    clearAutoClear()

    sendMessage({
      type: 'spotlight.clear',
      user_id: userId,
    })
  }

  /** Handle incoming spotlight event from WebSocket */
  function handleSpotlightMessage(msg: SpotlightEvent) {
    if (msg.user_id === userId) return // Skip own echoed messages

    if (msg.type === 'spotlight.focus' && msg.target) {
      activeSpotlight.value = msg.target
      spotlightBy.value = msg.user_id

      // Auto-clear received spotlight after timeout
      clearAutoClear()
      autoClearTimer = setTimeout(() => {
        activeSpotlight.value = null
        spotlightBy.value = null
      }, autoClearMs)
    }

    if (msg.type === 'spotlight.clear') {
      activeSpotlight.value = null
      spotlightBy.value = null
      clearAutoClear()
    }
  }

  function clearAutoClear() {
    if (autoClearTimer) {
      clearTimeout(autoClearTimer)
      autoClearTimer = null
    }
  }

  onUnmounted(() => clearAutoClear())

  return {
    activeSpotlight,
    spotlightBy,
    activate,
    deactivate,
    handleSpotlightMessage,
  }
}
