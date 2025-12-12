<template>
  <div class="video-controls">
    <!-- Microphone -->
    <button
      class="control-btn"
      :class="{ 'control-btn--off': !audioEnabled }"
      :title="audioEnabled ? $t('classroom.controls.mute') : $t('classroom.controls.unmute')"
      @click="$emit('toggle-audio')"
    >
      <span class="icon">{{ audioEnabled ? '🎤' : '🔇' }}</span>
    </button>

    <!-- Camera -->
    <button
      class="control-btn"
      :class="{ 'control-btn--off': !videoEnabled }"
      :title="videoEnabled ? $t('classroom.controls.stopVideo') : $t('classroom.controls.startVideo')"
      @click="$emit('toggle-video')"
    >
      <span class="icon">{{ videoEnabled ? '📹' : '📷' }}</span>
    </button>

    <!-- Screen share -->
    <button
      class="control-btn"
      :class="{ 'control-btn--active': screenSharing }"
      :title="screenSharing ? $t('classroom.controls.stopShare') : $t('classroom.controls.shareScreen')"
      @click="$emit('toggle-screen')"
    >
      <span class="icon">🖥️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  videoEnabled?: boolean
  audioEnabled?: boolean
  screenSharing?: boolean
}

withDefaults(defineProps<Props>(), {
  videoEnabled: true,
  audioEnabled: true,
  screenSharing: false,
})

defineEmits<{
  'toggle-video': []
  'toggle-audio': []
  'toggle-screen': []
}>()
</script>

<style scoped>
.video-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 24px;
  backdrop-filter: blur(8px);
}

.control-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--color-bg-hover);
  transform: scale(1.1);
}

.control-btn--off {
  background: var(--color-error);
  color: white;
}

.control-btn--off:hover {
  background: var(--color-error-dark);
}

.control-btn--active {
  background: var(--color-success);
  color: white;
}

.control-btn--active:hover {
  background: var(--color-success-dark);
}

.icon {
  font-size: 1.25rem;
}
</style>
