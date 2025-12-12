import { ref, onUnmounted } from 'vue'

export function useLocalMedia() {
  const stream = ref<MediaStream | null>(null)
  const videoEnabled = ref(false)
  const audioEnabled = ref(false)
  const error = ref<string | null>(null)

  async function startCamera(): Promise<boolean> {
    try {
      error.value = null
      stream.value = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      videoEnabled.value = true
      audioEnabled.value = true
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to access camera'
      return false
    }
  }

  function stopCamera(): void {
    if (stream.value) {
      stream.value.getTracks().forEach((track) => track.stop())
      stream.value = null
    }
    videoEnabled.value = false
    audioEnabled.value = false
  }

  function toggleVideo(): void {
    if (!stream.value) return

    const videoTrack = stream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      videoEnabled.value = videoTrack.enabled
    }
  }

  function toggleAudio(): void {
    if (!stream.value) return

    const audioTrack = stream.value.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      audioEnabled.value = audioTrack.enabled
    }
  }

  onUnmounted(() => {
    stopCamera()
  })

  return {
    stream,
    videoEnabled,
    audioEnabled,
    error,
    startCamera,
    stopCamera,
    toggleVideo,
    toggleAudio,
  }
}
