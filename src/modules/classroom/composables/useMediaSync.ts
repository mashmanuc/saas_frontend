// F4: useMediaSync - WebRTC + SyncEngine integration
import { ref, watch, onUnmounted } from 'vue'
import { useWebRTC } from './useWebRTC'
import { useRoomStore } from '../stores/roomStore'
import { useParticipantStore } from '../stores/participantStore'
import { classroomApi } from '../api/classroom'

export interface MediaSyncOptions {
  autoStart?: boolean
  onMediaStateChange?: (state: MediaSyncState) => void
}

export interface MediaSyncState {
  videoEnabled: boolean
  audioEnabled: boolean
  screenSharing: boolean
}

export function useMediaSync(options: MediaSyncOptions = {}) {
  const { autoStart = true, onMediaStateChange } = options

  const roomStore = useRoomStore()
  const participantStore = useParticipantStore()

  const webRTC = useWebRTC({
    onTrack: (stream, userId) => {
      // Update participant's remote stream
      console.log('[useMediaSync] Received stream from user:', userId, stream)
    },
    onConnectionStateChange: (state) => {
      console.log('[useMediaSync] Connection state:', state)
    },
  })

  const isInitialized = ref(false)
  const mediaError = ref<string | null>(null)

  // Initialize media on mount
  async function initializeMedia(): Promise<void> {
    if (isInitialized.value) return

    try {
      await webRTC.startLocalStream(true, true)
      isInitialized.value = true

      // Notify server about media state
      await syncMediaState()
    } catch (error) {
      mediaError.value = 'Не вдалося отримати доступ до камери/мікрофона'
      console.error('[useMediaSync] Failed to initialize media:', error)
    }
  }

  // Sync media state with server
  async function syncMediaState(): Promise<void> {
    if (!roomStore.session) return

    const state: MediaSyncState = {
      videoEnabled: webRTC.isVideoEnabled.value,
      audioEnabled: webRTC.isAudioEnabled.value,
      screenSharing: webRTC.isScreenSharing.value,
    }

    try {
      await classroomApi.updateMediaState(roomStore.session.uuid, {
        video_enabled: state.videoEnabled,
        audio_enabled: state.audioEnabled,
        screen_sharing: state.screenSharing,
      })

      onMediaStateChange?.(state)
    } catch (error) {
      console.error('[useMediaSync] Failed to sync media state:', error)
    }
  }

  // Toggle video with sync
  async function toggleVideo(): Promise<void> {
    webRTC.toggleVideo()
    await syncMediaState()
  }

  // Toggle audio with sync
  async function toggleAudio(): Promise<void> {
    webRTC.toggleAudio()
    await syncMediaState()
  }

  // Start screen sharing with sync
  async function startScreenShare(): Promise<void> {
    try {
      await webRTC.startScreenShare()
      await syncMediaState()
    } catch (error) {
      console.error('[useMediaSync] Failed to start screen share:', error)
      throw error
    }
  }

  // Stop screen sharing with sync
  async function stopScreenShare(): Promise<void> {
    await webRTC.stopScreenShare()
    await syncMediaState()
  }

  // Handle signaling messages from SyncEngine
  function handleSignalingMessage(
    type: string,
    data: { userId: number; payload: unknown }
  ): void {
    switch (type) {
      case 'offer':
        handleOffer(data.userId, data.payload as RTCSessionDescriptionInit)
        break
      case 'answer':
        webRTC.handleAnswer(data.userId, data.payload as RTCSessionDescriptionInit)
        break
      case 'ice-candidate':
        webRTC.handleIceCandidate(data.userId, data.payload as RTCIceCandidateInit)
        break
      case 'peer-joined':
        initiateConnection(data.userId)
        break
      case 'peer-left':
        webRTC.removePeer(data.userId)
        break
    }
  }

  // Initiate WebRTC connection with peer
  async function initiateConnection(userId: number): Promise<void> {
    try {
      const offer = await webRTC.createOffer(userId)

      // Send offer through SyncEngine
      roomStore.roomEngine?.sendBoardEvent('webrtc:offer', {
        targetUserId: userId,
        offer,
      })
    } catch (error) {
      console.error('[useMediaSync] Failed to create offer:', error)
    }
  }

  // Handle incoming offer
  async function handleOffer(
    userId: number,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      const answer = await webRTC.handleOffer(userId, offer)

      // Send answer through SyncEngine
      roomStore.roomEngine?.sendBoardEvent('webrtc:answer', {
        targetUserId: userId,
        answer,
      })
    } catch (error) {
      console.error('[useMediaSync] Failed to handle offer:', error)
    }
  }

  // Watch for connection status changes
  watch(
    () => roomStore.connectionStatus,
    (status) => {
      if (status === 'connected' && autoStart && !isInitialized.value) {
        initializeMedia()
      }
    },
    { immediate: true }
  )

  // Cleanup
  onUnmounted(() => {
    webRTC.stopLocalStream()
    webRTC.closeAllConnections()
  })

  return {
    // State
    localStream: webRTC.localStream,
    isVideoEnabled: webRTC.isVideoEnabled,
    isAudioEnabled: webRTC.isAudioEnabled,
    isScreenSharing: webRTC.isScreenSharing,
    isInitialized,
    mediaError,
    remoteStreams: webRTC.remoteStreams,

    // Actions
    initializeMedia,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    handleSignalingMessage,

    // Direct WebRTC access
    webRTC,
  }
}
