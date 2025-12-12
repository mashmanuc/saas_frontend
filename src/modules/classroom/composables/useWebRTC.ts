// F29: useWebRTC composable - WebRTC peer connection management
import { ref, onUnmounted, computed } from 'vue'

export interface WebRTCConfig {
  iceServers?: RTCIceServer[]
  onTrack?: (stream: MediaStream, userId: number) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
}

export interface PeerConnection {
  userId: number
  connection: RTCPeerConnection
  stream: MediaStream | null
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function useWebRTC(config: WebRTCConfig = {}) {
  const { iceServers = DEFAULT_ICE_SERVERS, onTrack, onConnectionStateChange } = config

  // State
  const localStream = ref<MediaStream | null>(null)
  const peers = ref<Map<number, PeerConnection>>(new Map())
  const isVideoEnabled = ref(true)
  const isAudioEnabled = ref(true)
  const isScreenSharing = ref(false)
  const connectionState = ref<RTCPeerConnectionState>('new')

  // Computed
  const peerCount = computed(() => peers.value.size)
  const remoteStreams = computed(() => {
    const streams: { userId: number; stream: MediaStream }[] = []
    peers.value.forEach((peer) => {
      if (peer.stream) {
        streams.push({ userId: peer.userId, stream: peer.stream })
      }
    })
    return streams
  })

  // Get user media
  async function startLocalStream(
    video: boolean = true,
    audio: boolean = true
  ): Promise<MediaStream> {
    try {
      localStream.value = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, facingMode: 'user' } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      })

      isVideoEnabled.value = video
      isAudioEnabled.value = audio

      return localStream.value
    } catch (error) {
      console.error('[useWebRTC] Failed to get user media:', error)
      throw error
    }
  }

  async function stopLocalStream(): Promise<void> {
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop())
      localStream.value = null
    }
    isVideoEnabled.value = false
    isAudioEnabled.value = false
  }

  // Screen sharing
  async function startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      isScreenSharing.value = true

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0]
      peers.value.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === 'video')
        if (sender) {
          sender.replaceTrack(videoTrack)
        }
      })

      // Handle screen share stop
      videoTrack.onended = () => {
        stopScreenShare()
      }

      return screenStream
    } catch (error) {
      console.error('[useWebRTC] Failed to start screen share:', error)
      throw error
    }
  }

  async function stopScreenShare(): Promise<void> {
    if (!localStream.value) return

    isScreenSharing.value = false

    // Restore camera video track
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
    })

    const videoTrack = cameraStream.getVideoTracks()[0]

    // Replace in all peer connections
    peers.value.forEach((peer) => {
      const sender = peer.connection
        .getSenders()
        .find((s) => s.track?.kind === 'video')
      if (sender) {
        sender.replaceTrack(videoTrack)
      }
    })

    // Update local stream
    const oldVideoTrack = localStream.value.getVideoTracks()[0]
    if (oldVideoTrack) {
      localStream.value.removeTrack(oldVideoTrack)
      oldVideoTrack.stop()
    }
    localStream.value.addTrack(videoTrack)
  }

  // Toggle media
  function toggleVideo(enabled?: boolean): void {
    if (!localStream.value) return

    const newState = enabled ?? !isVideoEnabled.value
    localStream.value.getVideoTracks().forEach((track) => {
      track.enabled = newState
    })
    isVideoEnabled.value = newState
  }

  function toggleAudio(enabled?: boolean): void {
    if (!localStream.value) return

    const newState = enabled ?? !isAudioEnabled.value
    localStream.value.getAudioTracks().forEach((track) => {
      track.enabled = newState
    })
    isAudioEnabled.value = newState
  }

  // Peer connection management
  function createPeerConnection(userId: number): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers })

    // Add local tracks
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.value!)
      })
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const peer = peers.value.get(userId)
      if (peer) {
        peer.stream = event.streams[0]
        onTrack?.(event.streams[0], userId)
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      connectionState.value = pc.connectionState
      onConnectionStateChange?.(pc.connectionState)
    }

    // Store peer
    peers.value.set(userId, {
      userId,
      connection: pc,
      stream: null,
    })

    return pc
  }

  async function createOffer(userId: number): Promise<RTCSessionDescriptionInit> {
    let peer = peers.value.get(userId)
    if (!peer) {
      createPeerConnection(userId)
      peer = peers.value.get(userId)!
    }

    const offer = await peer.connection.createOffer()
    await peer.connection.setLocalDescription(offer)

    return offer
  }

  async function handleOffer(
    userId: number,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    let peer = peers.value.get(userId)
    if (!peer) {
      createPeerConnection(userId)
      peer = peers.value.get(userId)!
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peer.connection.createAnswer()
    await peer.connection.setLocalDescription(answer)

    return answer
  }

  async function handleAnswer(
    userId: number,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const peer = peers.value.get(userId)
    if (!peer) return

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async function handleIceCandidate(
    userId: number,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const peer = peers.value.get(userId)
    if (!peer) return

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  function removePeer(userId: number): void {
    const peer = peers.value.get(userId)
    if (peer) {
      peer.connection.close()
      peers.value.delete(userId)
    }
  }

  function closeAllConnections(): void {
    peers.value.forEach((peer) => {
      peer.connection.close()
    })
    peers.value.clear()
  }

  // Cleanup
  onUnmounted(() => {
    stopLocalStream()
    closeAllConnections()
  })

  return {
    // State
    localStream,
    peers,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    connectionState,

    // Computed
    peerCount,
    remoteStreams,

    // Media
    startLocalStream,
    stopLocalStream,
    startScreenShare,
    stopScreenShare,
    toggleVideo,
    toggleAudio,

    // Peer management
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    closeAllConnections,
  }
}
