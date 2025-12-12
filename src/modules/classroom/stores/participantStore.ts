// F7: Participant Store - Participants state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SessionParticipant } from '../api/classroom'

export interface LocalMediaState {
  video: boolean
  audio: boolean
  screen: boolean
}

export const useParticipantStore = defineStore('participants', () => {
  // State
  const participants = ref<SessionParticipant[]>([])
  const localMediaState = ref<LocalMediaState>({
    video: true,
    audio: true,
    screen: false,
  })
  const localUserId = ref<number | null>(null)

  // Computed
  const host = computed(() => 
    participants.value.find((p) => p.role === 'host')
  )

  const students = computed(() => 
    participants.value.filter((p) => p.role === 'student')
  )

  const viewers = computed(() => 
    participants.value.filter((p) => p.role === 'viewer')
  )

  const connectedParticipants = computed(() => 
    participants.value.filter((p) => p.status === 'connected')
  )

  const connectedCount = computed(() => connectedParticipants.value.length)

  const totalCount = computed(() => participants.value.length)

  const localParticipant = computed(() => 
    participants.value.find((p) => p.user_id === localUserId.value)
  )

  const remoteParticipants = computed(() => 
    participants.value.filter((p) => p.user_id !== localUserId.value)
  )

  const hasDisconnectedParticipants = computed(() => 
    participants.value.some((p) => p.status === 'disconnected' || p.status === 'reconnecting')
  )

  // Actions
  function setParticipants(newParticipants: SessionParticipant[]): void {
    participants.value = newParticipants
  }

  function addParticipant(participant: SessionParticipant): void {
    const exists = participants.value.some((p) => p.user_id === participant.user_id)
    if (!exists) {
      participants.value.push(participant)
    }
  }

  function removeParticipant(userId: number): void {
    participants.value = participants.value.filter((p) => p.user_id !== userId)
  }

  function updateParticipant(userId: number, updates: Partial<SessionParticipant>): void {
    const idx = participants.value.findIndex((p) => p.user_id === userId)
    if (idx !== -1) {
      participants.value[idx] = { ...participants.value[idx], ...updates }
    }
  }

  function setParticipantStatus(
    userId: number,
    status: SessionParticipant['status']
  ): void {
    updateParticipant(userId, { status })
  }

  function setParticipantMediaState(
    userId: number,
    videoEnabled: boolean,
    audioEnabled: boolean
  ): void {
    updateParticipant(userId, {
      video_enabled: videoEnabled,
      audio_enabled: audioEnabled,
    })
  }

  function setParticipantConnectionQuality(
    userId: number,
    quality: SessionParticipant['connection_quality']
  ): void {
    updateParticipant(userId, { connection_quality: quality })
  }

  // Local media state
  function setLocalMediaState(state: Partial<LocalMediaState>): void {
    localMediaState.value = { ...localMediaState.value, ...state }
  }

  function toggleLocalVideo(): void {
    localMediaState.value.video = !localMediaState.value.video
  }

  function toggleLocalAudio(): void {
    localMediaState.value.audio = !localMediaState.value.audio
  }

  function toggleLocalScreen(): void {
    localMediaState.value.screen = !localMediaState.value.screen
  }

  function setLocalUserId(userId: number): void {
    localUserId.value = userId
  }

  function getParticipantById(userId: number): SessionParticipant | undefined {
    return participants.value.find((p) => p.user_id === userId)
  }

  function $reset(): void {
    participants.value = []
    localMediaState.value = { video: true, audio: true, screen: false }
    localUserId.value = null
  }

  return {
    // State
    participants,
    localMediaState,
    localUserId,

    // Computed
    host,
    students,
    viewers,
    connectedParticipants,
    connectedCount,
    totalCount,
    localParticipant,
    remoteParticipants,
    hasDisconnectedParticipants,

    // Actions
    setParticipants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setParticipantStatus,
    setParticipantMediaState,
    setParticipantConnectionQuality,
    setLocalMediaState,
    toggleLocalVideo,
    toggleLocalAudio,
    toggleLocalScreen,
    setLocalUserId,
    getParticipantById,
    $reset,
  }
})
