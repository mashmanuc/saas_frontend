<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useWebRTCStore } from '@/stores/webrtcStore'
import VideoTile from '../components/VideoTile.vue'
import CallControls from '../components/CallControls.vue'
import ConnectionStatus from '../components/ConnectionStatus.vue'
import ReconnectOverlay from '../components/ReconnectOverlay.vue'
import ErrorModal from '@/ui/ErrorModal.vue'

const route = useRoute()
const webrtcStore = useWebRTCStore()

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
  qualityLevel,
} = storeToRefs(webrtcStore)

const lessonId = computed(() => route.params.lessonId as string)

const layoutClass = computed(() => ({
  'layout-single': !remoteStream.value,
  'layout-dual': !!remoteStream.value,
}))

function toggleAudio() {
  webrtcStore.toggleAudio()
}

function toggleVideo() {
  webrtcStore.toggleVideo()
}

function setQuality(quality: '240p' | '480p' | '720p') {
  webrtcStore.setQuality(quality)
}

async function endCall() {
  await webrtcStore.endCall()
}

function clearError() {
  webrtcStore.clearError()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'm' || event.key === 'M') {
    toggleAudio()
  } else if (event.key === 'v' || event.key === 'V') {
    toggleVideo()
  } else if (event.key === 'Escape') {
    endCall()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="call-view">
    <div class="video-container" :class="layoutClass">
      <VideoTile
        v-if="remoteStream"
        :stream="remoteStream"
        :muted="isPeerAudioMuted"
        :video-off="isPeerVideoMuted"
        label="Peer"
        :quality="qualityLevel as 'excellent' | 'good' | 'fair' | 'poor'"
        main
      />
      <VideoTile
        :stream="localStream"
        :muted="isAudioMuted"
        :video-off="isVideoMuted"
        label="You"
        local
      />
    </div>

    <ConnectionStatus
      :state="connectionState"
      :quality="qualityLevel as 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'"
      :metrics="qualityMetrics"
    />

    <CallControls
      :audio-muted="isAudioMuted"
      :video-muted="isVideoMuted"
      :quality="currentQuality"
      @toggle-audio="toggleAudio"
      @toggle-video="toggleVideo"
      @change-quality="setQuality"
      @end-call="endCall"
    />

    <ReconnectOverlay v-if="isReconnecting" />

    <ErrorModal v-if="error" :error="error" @dismiss="clearError" />
  </div>
</template>

<style scoped>
.call-view {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.video-container {
  flex: 1;
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.layout-single {
  grid-template-columns: 1fr;
}

.layout-dual {
  grid-template-columns: 1fr;
  grid-template-rows: 3fr 1fr;
}

@media (min-width: 768px) {
  .layout-dual {
    grid-template-columns: 3fr 1fr;
    grid-template-rows: 1fr;
  }
}
</style>
