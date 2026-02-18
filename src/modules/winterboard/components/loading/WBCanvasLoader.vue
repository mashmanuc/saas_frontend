<!-- WB: Canvas loading spinner — shown while Konva/session data loads
     Ref: TASK_BOARD.md B6.2 — Canvas loading spinner
     Centered spinner + text, reduced motion: static text only -->
<template>
  <div class="wb-canvas-loader" role="status" :aria-label="t('winterboard.loading.canvas')">
    <div class="wb-canvas-loader__spinner" aria-hidden="true">
      <svg class="wb-canvas-loader__svg" viewBox="0 0 48 48" fill="none">
        <circle
          cx="24" cy="24" r="20"
          stroke="currentColor"
          stroke-width="3"
          opacity="0.2"
        />
        <path
          d="M44 24c0-11.046-8.954-20-20-20"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          class="wb-canvas-loader__arc"
        />
      </svg>
    </div>
    <p class="wb-canvas-loader__text">{{ t('winterboard.loading.canvas') }}</p>
    <p class="wb-canvas-loader__subtitle">{{ t('winterboard.loading.canvasSubtitle') }}</p>
  </div>
</template>

<script setup lang="ts">
// WB: WBCanvasLoader — loading state for canvas area
// Ref: TASK_BOARD.md B6.2

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped>
.wb-canvas-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: var(--wb-bg-tertiary, #f8fafc);
}

.wb-canvas-loader__spinner {
  width: 48px;
  height: 48px;
  color: var(--wb-brand, #2563eb);
}

.wb-canvas-loader__svg {
  width: 100%;
  height: 100%;
  animation: wb-loader-spin 0.8s linear infinite;
}

.wb-canvas-loader__arc {
  stroke: var(--wb-brand, #2563eb);
}

.wb-canvas-loader__text {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.wb-canvas-loader__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
}

@keyframes wb-loader-spin {
  to { transform: rotate(360deg); }
}

/* B5.2: Reduced motion — no spin, just static indicator */
@media (prefers-reduced-motion: reduce) {
  .wb-canvas-loader__svg {
    animation: none;
  }
}
</style>
