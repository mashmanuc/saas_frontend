<!-- WB5-B4: Lock indicator — shows a red lock badge on locked items
     Ref: TASK_BOARD_V5.md B4
     Positioned at top-right of item bounding box, scales inversely with zoom -->
<template>
  <div
    v-if="visible"
    class="wb-lock-indicator"
    :style="indicatorStyle"
    :aria-label="t('winterboard.lock.locked_label')"
    role="img"
  >
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm-1.5 3a1.5 1.5 0 1 1 3 0v2h-3V4z"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  x: number
  y: number
  zoom: number
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 1,
  visible: false,
})

const { t } = useI18n()

const indicatorStyle = computed(() => {
  const scale = 1 / Math.max(props.zoom, 0.25)
  return {
    position: 'absolute' as const,
    left: `${props.x}px`,
    top: `${props.y}px`,
    transform: `translate(-50%, -50%) scale(${scale})`,
  }
})
</script>

<style scoped>
.wb-lock-indicator {
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.85);
  color: white;
  font-size: 12px;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
