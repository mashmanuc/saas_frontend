import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import WebRTCClient from '@/core/webrtc/WebRTCClient'
import type { ConnectionState, QualityMetrics, VideoQuality, WebRTCError } from '@/core/webrtc/types'

const defaultSignalingUrl = import.meta.env.VITE_SIGNALING_URL ?? '/ws/webrtc'

export const useWebRTCStore = defineStore('webrtc', () => {
  const client = ref<WebRTCClient | null>(null)
  const connectionState = ref<ConnectionState>('idle')
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const isAudioMuted = ref(false)
  const isVideoMuted = ref(false)
  const isPeerAudioMuted = ref(false)
  const isPeerVideoMuted = ref(false)
  const qualityMetrics = ref<QualityMetrics | null>(null)
  const currentQuality = ref<VideoQuality>('480p')
  const error = ref<WebRTCError | null>(null)
  const isReconnecting = ref(false)

  const eventDisposers: Array<() => void> = []

  const isConnected = computed(() => connectionState.value === 'connected')
  const isConnecting = computed(() =>
    connectionState.value === 'connecting' || connectionState.value === 'initializing'
  )
  const qualityLevel = computed(() => qualityMetrics.value?.quality ?? 'unknown')

  function disposeEvents(): void {
    while (eventDisposers.length) {
      const dispose = eventDisposers.pop()
      dispose?.()
    }
  }

  async function initializeCall(sessionId: string, token: string): Promise<void> {
    await cleanupClient()

    const instance = new WebRTCClient({ signalingUrl: defaultSignalingUrl })
    client.value = instance

    eventDisposers.push(
      instance.events.on('state-change', (state) => {
        connectionState.value = state
      })
    )
    eventDisposers.push(
      instance.events.on('remote-stream', (stream) => {
        remoteStream.value = stream
      })
    )
    eventDisposers.push(
      instance.events.on('quality-change', (metrics) => {
        qualityMetrics.value = metrics
      })
    )
    eventDisposers.push(
      instance.events.on('peer-muted', (type, muted) => {
        if (type === 'audio') {
          isPeerAudioMuted.value = muted
        } else {
          isPeerVideoMuted.value = muted
        }
      })
    )
    eventDisposers.push(
      instance.events.on('reconnecting', () => {
        isReconnecting.value = true
      })
    )
    eventDisposers.push(
      instance.events.on('reconnected', () => {
        isReconnecting.value = false
      })
    )
    eventDisposers.push(
      instance.events.on('error', (err) => {
        error.value = err
      })
    )

    await instance.initialize(sessionId, token)
    localStream.value = instance.getLocalStream()
    remoteStream.value = instance.getRemoteStream()
    qualityMetrics.value = instance.getQualityMetrics()
  }

  async function startCall(): Promise<void> {
    await client.value?.startCall()
  }

  async function answerCall(offer: RTCSessionDescriptionInit): Promise<void> {
    await client.value?.answerCall(offer)
  }

  async function endCall(): Promise<void> {
    await client.value?.endCall()
    await cleanupClient()
  }

  function toggleAudio(): void {
    const enabled = client.value?.toggleAudio()
    if (typeof enabled === 'boolean') {
      isAudioMuted.value = !enabled
    }
  }

  function toggleVideo(): void {
    const enabled = client.value?.toggleVideo()
    if (typeof enabled === 'boolean') {
      isVideoMuted.value = !enabled
    }
  }

  async function setQuality(quality: VideoQuality): Promise<void> {
    await client.value?.setVideoQuality(quality)
    currentQuality.value = quality
  }

  function clearError(): void {
    error.value = null
  }

  async function cleanupClient(): Promise<void> {
    disposeEvents()
    if (client.value) {
      await client.value.destroy()
    }
    client.value = null
    connectionState.value = 'idle'
    localStream.value = null
    remoteStream.value = null
    isAudioMuted.value = false
    isVideoMuted.value = false
    isPeerAudioMuted.value = false
    isPeerVideoMuted.value = false
    qualityMetrics.value = null
    isReconnecting.value = false
  }

  return {
    // state
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
    // getters
    isConnected,
    isConnecting,
    qualityLevel,
    // actions
    initializeCall,
    startCall,
    answerCall,
    endCall,
    toggleAudio,
    toggleVideo,
    setQuality,
    clearError,
  }
})
