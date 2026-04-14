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
/* A.2.3: інформаційний банер (синій), не агресивний червоний.
   Використовує глобальні токени з ui/tokens. */
.wb-replay-banner {
  position: fixed;
  /* Зсунутий під хедер WBSoloRoom */
  top: var(--wb-header-height, 56px);
  left: 0;
  right: 0;
  height: var(--wb-replay-banner-height, 32px);
  background: var(--color-info-bg, #dbeafe);
  color: var(--color-info-text, #1e40af);
  border-bottom: 1px solid var(--color-info-border, #bfdbfe);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 60;
  font-size: 0.8125rem;
  font-weight: 500;
}

.wb-replay-banner__indicator {
  width: 6px;
  height: 6px;
  background: var(--color-info-text, #1e40af);
  border-radius: 50%;
  opacity: 0.8;
}

.wb-replay-banner__text {
  letter-spacing: 0.01em;
}

.wb-replay-banner__exit {
  padding: 2px 10px;
  background: transparent;
  color: var(--color-info-text, #1e40af);
  border: 1px solid var(--color-info-border, #93c5fd);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-replay-banner__exit:hover {
  background: rgba(30, 64, 175, 0.08);
}

/* R3: Tablet — sync with header height */
@media (min-width: 640px) and (max-width: 1023px) {
  .wb-replay-banner__exit {
    min-height: 28px;
    min-width: 44px;
    padding: 4px 12px;
  }
}

/* R2: Mobile — compact banner */
@media (max-width: 639px) {
  .wb-replay-banner {
    font-size: 0.75rem;
    gap: 8px;
  }
  .wb-replay-banner__exit {
    min-height: 28px;
    min-width: 44px;
    padding: 4px 10px;
  }
}
</style>
