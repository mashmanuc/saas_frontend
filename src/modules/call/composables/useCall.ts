import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useWebRTCStore } from '@/stores/webrtcStore'
import type { VideoQuality } from '@/core/webrtc/types'

export function useCall(lessonId: string) {
  const webrtcStore = useWebRTCStore()
  const router = useRouter()

  const isInitialized = ref(false)

  const {
    connectionState,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isPeerAudioMuted,
    isPeerVideoMuted,
    qualityMetrics,
    currentQuality,
    error,
    isReconnecting,
    isConnected,
    isConnecting,
    qualityLevel,
  } = storeToRefs(webrtcStore)

  async function joinCall(): Promise<void> {
    try {
      // In real implementation, fetch session token from API
      const sessionId = lessonId
      const token = 'session-token' // Replace with actual token from API

      await webrtcStore.initializeCall(sessionId, token)
      isInitialized.value = true

      // Start call as initiator or wait for offer
      await webrtcStore.startCall()
    } catch (err) {
      console.error('[useCall] Failed to join call:', err)
    }
  }

  async function leaveCall(): Promise<void> {
    await webrtcStore.endCall()
    isInitialized.value = false
    router.push({ name: 'LessonDetail', params: { id: lessonId } })
  }

  function toggleAudio(): void {
    webrtcStore.toggleAudio()
  }

  function toggleVideo(): void {
    webrtcStore.toggleVideo()
  }

  async function setQuality(quality: VideoQuality): Promise<void> {
    await webrtcStore.setQuality(quality)
  }

  function clearError(): void {
    webrtcStore.clearError()
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'm' || event.key === 'M') {
      toggleAudio()
    } else if (event.key === 'v' || event.key === 'V') {
      toggleVideo()
    } else if (event.key === 'Escape') {
      leaveCall()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    joinCall()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    if (isInitialized.value) {
      webrtcStore.endCall()
    }
  })

  return {
    // State
    connectionState,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isPeerAudioMuted,
    isPeerVideoMuted,
    qualityMetrics,
    currentQuality,
    error,
    isReconnecting,
    isConnected,
    isConnecting,
    qualityLevel,
    isInitialized,

    // Actions
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    setQuality,
    clearError,
  }
}

export default useCall
