<template>
  <div
    class="wb-interaction-overlay"
    :style="positionStyle"
    @click.stop
  >
    <!-- Label -->
    <div v-if="interaction.label" class="wb-interaction-overlay__label">
      {{ interaction.label }}
    </div>

    <!-- Content -->
    <div class="wb-interaction-overlay__content" v-text="interaction.content" />

    <!-- Close -->
    <button
      type="button"
      class="wb-interaction-overlay__close"
      :title="t('winterboard.interactions.close')"
      @click="$emit('close')"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
// WB: InteractionOverlay — popover showing interaction content near a board object
// Positioned below the object, anchored to its center-bottom
// Ref: PLAN.md v2 §1.3.2

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBInteraction } from '../../types/winterboard'

const props = defineProps<{
  interaction: WBInteraction
  /** Object bounding box in canvas coordinates */
  anchorRect: { x: number; y: number; w: number; h: number }
  zoom: number
  /** Canvas offset (pan) */
  canvasOffset: { x: number; y: number }
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n({ useScope: 'global' })

const positionStyle = computed(() => {
  const z = props.zoom
  const offset = props.canvasOffset
  const centerX = (props.anchorRect.x + props.anchorRect.w / 2) * z + offset.x
  const bottomY = (props.anchorRect.y + props.anchorRect.h) * z + offset.y + 8

  return {
    position: 'absolute' as const,
    left: `${centerX}px`,
    top: `${bottomY}px`,
    transform: 'translateX(-50%)',
    zIndex: 18,
  }
})
</script>

<style scoped>
.wb-interaction-overlay {
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 12px 16px;
  max-width: 300px;
  min-width: 120px;
  pointer-events: auto;
  animation: wb-overlay-in 0.15s ease-out;
  position: relative;
}

.wb-interaction-overlay__label {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.wb-interaction-overlay__content {
  font-size: 14px;
  line-height: 1.5;
  color: #1e293b;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.wb-interaction-overlay__close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  padding: 0;
}

.wb-interaction-overlay__close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #475569;
}

@keyframes wb-overlay-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Dark mode support */
:root[data-theme="dark"] .wb-interaction-overlay {
  background: #1e293b;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

:root[data-theme="dark"] .wb-interaction-overlay__content {
  color: #e2e8f0;
}

:root[data-theme="dark"] .wb-interaction-overlay__close {
  color: #64748b;
}
:root[data-theme="dark"] .wb-interaction-overlay__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}
</style>
