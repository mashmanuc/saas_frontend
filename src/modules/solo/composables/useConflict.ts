import { ref, onMounted, onUnmounted } from 'vue'

export function useConflict(sessionId: string) {
  const hasConflict = ref(false)
  const remoteVersion = ref<number | null>(null)
  const localVersion = ref(0)

  // BroadcastChannel for cross-tab communication
  let channel: BroadcastChannel | null = null

  function initChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return

    channel = new BroadcastChannel(`solo-session-${sessionId}`)

    channel.onmessage = (event) => {
      if (event.data.type === 'save' && event.data.version > localVersion.value) {
        hasConflict.value = true
        remoteVersion.value = event.data.version
      }
    }
  }

  function broadcastSave(version: number): void {
    localVersion.value = version
    channel?.postMessage({ type: 'save', version })
  }

  function resolveConflict(action: 'keep' | 'reload'): void {
    hasConflict.value = false

    if (action === 'reload') {
      window.location.reload()
    }
  }

  onMounted(() => {
    initChannel()
  })

  onUnmounted(() => {
    channel?.close()
  })

  return {
    hasConflict,
    remoteVersion,
    localVersion,
    broadcastSave,
    resolveConflict,
  }
}
