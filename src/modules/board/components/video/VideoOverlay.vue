<script setup lang="ts">
import { ref, computed } from 'vue'
import { Minimize2, Maximize2, Users, Eye } from 'lucide-vue-next'
import type { VideoLayout } from '@/core/board/types'

interface Props {
  layout: VideoLayout
  isFollowMode: boolean
  followingUserName?: string
  localStream?: MediaStream | null
  remoteStream?: MediaStream | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'layout-change', layout: VideoLayout): void
  (e: 'toggle-follow'): void
}>()

const localVideoRef = ref<HTMLVideoElement | null>(null)
const remoteVideoRef = ref<HTMLVideoElement | null>(null)

const isPip = computed(() => props.layout === 'pip')
const isSplit = computed(() => props.layout === 'split')
const isHidden = computed(() => props.layout === 'hidden')

function cycleLayout() {
  const layouts: VideoLayout[] = ['pip', 'split', 'hidden']
  const currentIndex = layouts.indexOf(props.layout)
  const nextIndex = (currentIndex + 1) % layouts.length
  emit('layout-change', layouts[nextIndex])
}
</script>

<template>
  <div class="video-overlay" :class="[layout]">
    <!-- Follow mode indicator -->
    <div v-if="isFollowMode" class="follow-indicator">
      <Eye :size="16" />
      <span>Following {{ followingUserName || 'teacher' }}</span>
    </div>

    <!-- PiP mode -->
    <div v-if="isPip" class="pip-container">
      <video
        v-if="remoteStream"
        ref="remoteVideoRef"
        class="remote-video"
        autoplay
        playsinline
      />
      <video
        v-if="localStream"
        ref="localVideoRef"
        class="local-video"
        autoplay
        playsinline
        muted
      />
    </div>

    <!-- Split mode -->
    <div v-if="isSplit" class="split-container">
      <div class="video-panel">
        <video
          v-if="remoteStream"
          ref="remoteVideoRef"
          class="video"
          autoplay
          playsinline
        />
        <div v-else class="video-placeholder">
          <Users :size="32" />
          <span>Waiting for participant...</span>
        </div>
      </div>
      <div class="video-panel local">
        <video
          v-if="localStream"
          ref="localVideoRef"
          class="video"
          autoplay
          playsinline
          muted
        />
      </div>
    </div>

    <!-- Controls -->
    <div class="video-controls">
      <button class="control-btn" :title="isPip ? 'Split View' : 'Picture in Picture'" @click="cycleLayout">
        <Minimize2 v-if="isPip" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
      <button
        class="control-btn"
        :class="{ active: isFollowMode }"
        title="Follow Teacher"
        @click="emit('toggle-follow')"
      >
        <Eye :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.video-overlay {
  position: absolute;
  z-index: 50;
}

.video-overlay.pip {
  bottom: 1rem;
  right: 1rem;
}

.video-overlay.split {
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: #1a1a2e;
  border-left: 1px solid #333;
}

.video-overlay.hidden {
  display: none;
}

.follow-indicator {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  border-radius: 20px;
  font-size: 0.875rem;
  z-index: 100;
}

.pip-container {
  position: relative;
  width: 240px;
  height: 180px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.pip-container .remote-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pip-container .local-video {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  width: 80px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  border: 2px solid white;
}

.split-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.5rem;
  gap: 0.5rem;
}

.video-panel {
  flex: 1;
  background: #0f0f1a;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-panel .video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #666;
}

.video-controls {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
}

.video-overlay.split .video-controls {
  bottom: auto;
  top: 0.5rem;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  transition: background 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.control-btn.active {
  background: #3b82f6;
}
</style>
