/**
 * useMediaSync — WS sync for video_player objects.
 *
 * Phase 3C: Only for video. Audio = local playback, no sync.
 *
 * Connects to BoardConsumer WS at /ws/classroom/{sessionId}/board/?token=...
 * Listens for media.play / media.pause / media.seek events.
 * Only host/solo can send (can_control_media permission).
 *
 * ⚠️ Does NOT use Yjs. Uses raw WebSocket to BoardConsumer.
 */
import { ref, readonly, onUnmounted, type Ref } from 'vue'
import { tokenVault } from '@/utils/tokenVault'

const LOG = '[WB:MediaSync]'

// ── Types ───────────────────────────────────────────────────────

export interface VideoSyncState {
  playing: boolean
  position: number
  serverTimestamp: number
}

export interface MediaSyncEvent {
  type: string       // media.play | media.pause | media.seek
  object_id: string
  position?: number
  timestamp?: number
}

// ── Composable ──────────────────────────────────────────────────

export function useMediaSync(
  sessionId: Ref<string | null>,
  token: Ref<string | null>,
  canControlMedia: Ref<boolean>,
) {
  const videoStates = ref<Record<string, VideoSyncState>>({})
  const isConnected = ref(false)

  let ws: WebSocket | null = null
  const messageHandlers: Array<(event: MediaSyncEvent) => void> = []

  // ── Connect ─────────────────────────────────────────────────

  async function connect(): Promise<void> {
    const sid = sessionId.value
    const rawTok = token.value
    if (!sid || !rawTok || rawTok === '__cookie__') {
      console.warn(LOG, 'Cannot connect: missing sessionId or real token')
      return
    }
    // Phase 2: token may be encrypted in memory — decrypt before sending to WS
    const tok = await tokenVault.decrypt(rawTok) || rawTok
    if (!tok) {
      console.warn(LOG, 'Cannot connect: token decrypt failed')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env?.VITE_WS_HOST || window.location.host
    const url = `${protocol}//${host}/ws/classroom/${sid}/board/?token=${tok}`

    ws = new WebSocket(url)

    ws.onopen = () => {
      isConnected.value = true
      console.info(LOG, 'Connected', { sessionId: sid })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MediaSyncEvent
        handleIncomingEvent(data)
      } catch {
        // Ignore non-JSON or non-media messages
      }
    }

    ws.onclose = () => {
      isConnected.value = false
      console.info(LOG, 'Disconnected')
    }

    ws.onerror = (err) => {
      console.error(LOG, 'WS error', err)
    }
  }

  // ── Handle incoming ─────────────────────────────────────────

  function handleIncomingEvent(data: MediaSyncEvent): void {
    if (!data.type || !data.object_id) return
    if (!data.type.startsWith('media.')) return

    const state = getOrCreate(data.object_id)

    switch (data.type) {
      case 'media.play':
        state.playing = true
        state.position = data.position ?? 0
        state.serverTimestamp = data.timestamp ?? Date.now() / 1000
        break

      case 'media.pause':
        state.playing = false
        break

      case 'media.seek':
        state.position = data.position ?? 0
        state.serverTimestamp = data.timestamp ?? Date.now() / 1000
        break
    }

    // Notify handlers
    messageHandlers.forEach(h => h(data))
  }

  function getOrCreate(objectId: string): VideoSyncState {
    if (!videoStates.value[objectId]) {
      videoStates.value[objectId] = {
        playing: false,
        position: 0,
        serverTimestamp: 0,
      }
    }
    return videoStates.value[objectId]
  }

  // ── Send (host only) ───────────────────────────────────────

  function sendPlay(objectId: string, position = 0): void {
    if (!canControlMedia.value) {
      console.warn(LOG, 'Cannot control media: permission denied')
      return
    }
    send({ type: 'media.play', object_id: objectId, position })
  }

  function sendPause(objectId: string): void {
    if (!canControlMedia.value) return
    send({ type: 'media.pause', object_id: objectId })
  }

  function sendSeek(objectId: string, position: number): void {
    if (!canControlMedia.value) return
    send({ type: 'media.seek', object_id: objectId, position })
  }

  function send(data: Record<string, unknown>): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(LOG, 'WS not connected, cannot send')
      return
    }
    ws.send(JSON.stringify(data))
  }

  // ── Event subscription ──────────────────────────────────────

  function onMediaEvent(handler: (event: MediaSyncEvent) => void): () => void {
    messageHandlers.push(handler)
    return () => {
      const idx = messageHandlers.indexOf(handler)
      if (idx >= 0) messageHandlers.splice(idx, 1)
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────

  function disconnect(): void {
    if (ws) {
      ws.close()
      ws = null
    }
    isConnected.value = false
    videoStates.value = {}
  }

  onUnmounted(() => disconnect())

  return {
    videoStates: readonly(videoStates),
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    sendPlay,
    sendPause,
    sendSeek,
    onMediaEvent,
  }
}
