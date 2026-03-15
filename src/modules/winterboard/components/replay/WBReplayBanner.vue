<template>
  <div class="wb-replay-banner" role="status" aria-live="polite">
    <span class="wb-replay-banner__indicator" />
    <span class="wb-replay-banner__text">{{ t('winterboard.replay.viewingMode') }}</span>
    <button
      type="button"
      class="wb-replay-banner__exit"
      @click="$emit('exit')"
    >
      {{ t('winterboard.replay.exitReplay') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineEmits<{
  (e: 'exit'): void
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.wb-replay-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 60;
  font-size: 0.8125rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.wb-replay-banner__indicator {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: wb-banner-blink 1.5s ease-in-out infinite;
}

.wb-replay-banner__text {
  letter-spacing: 0.02em;
}

.wb-replay-banner__exit {
  padding: 3px 12px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-replay-banner__exit:hover {
  background: rgba(255, 255, 255, 0.35);
}

@keyframes wb-banner-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
