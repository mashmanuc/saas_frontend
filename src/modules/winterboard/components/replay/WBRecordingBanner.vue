<template>
  <div class="wb-recording-banner" role="status" aria-live="polite">
    <button
      v-if="!isRecording"
      type="button"
      class="wb-recording-banner__btn wb-recording-banner__btn--start"
      :title="t('winterboard.recording.startTitle')"
      @click="$emit('start-recording')"
    >
      <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
      {{ t('winterboard.recording.start') }}
    </button>
    <template v-else>
      <span class="wb-recording-banner__dot wb-recording-banner__dot--active" aria-hidden="true" />
      <span class="wb-recording-banner__text">{{ t('winterboard.recording.active') }}</span>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--stop"
        @click="$emit('stop-recording')"
      >
        <span class="wb-recording-banner__stop-icon" aria-hidden="true" />
        {{ t('winterboard.recording.stop') }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isRecording: boolean
}>()

defineEmits<{
  'start-recording': []
  'stop-recording': []
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.wb-recording-banner {
  position: fixed;
  top: 8px;
  right: 60px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 55;
  font-size: 0.75rem;
  font-weight: 600;
}

.wb-recording-banner__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  border: 1px solid;
}

.wb-recording-banner__btn--start {
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  border-color: #d1d5db;
}

.wb-recording-banner__btn--start:hover {
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.wb-recording-banner__btn--stop {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}

.wb-recording-banner__btn--stop:hover {
  background: rgba(239, 68, 68, 0.2);
}

.wb-recording-banner__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-recording-banner__dot--idle {
  background: #9ca3af;
}

.wb-recording-banner__dot--active {
  background: #ef4444;
  animation: wb-rec-blink 1s ease-in-out infinite;
}

.wb-recording-banner__stop-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 1px;
  flex-shrink: 0;
}

.wb-recording-banner__text {
  color: #ef4444;
  letter-spacing: 0.02em;
}

@keyframes wb-rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Dark mode support */
:root[data-theme='dark'] .wb-recording-banner__btn--start {
  background: rgba(55, 65, 81, 0.9);
  color: #e5e7eb;
  border-color: #4b5563;
}

:root[data-theme='dark'] .wb-recording-banner__btn--start:hover {
  background: #374151;
}
</style>
