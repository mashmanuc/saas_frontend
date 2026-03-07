<template>
  <Transition name="spotlight-fade">
    <div v-if="target" class="wb-spotlight-overlay">
      <!-- Semi-transparent backdrop with cutout -->
      <svg class="wb-spotlight-overlay__svg" viewBox="0 0 10000 10000" preserveAspectRatio="none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="10000" height="10000" fill="white" />
            <rect
              :x="scaledTarget.x"
              :y="scaledTarget.y"
              :width="scaledTarget.w"
              :height="scaledTarget.h"
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="10000" height="10000"
          fill="rgba(0,0,0,0.45)"
          mask="url(#spotlight-mask)"
        />
      </svg>
      <!-- Glow border around the spotlight area -->
      <div
        class="wb-spotlight-overlay__glow"
        :style="glowStyle"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpotlightTarget } from '../../composables/useSpotlight'

const props = defineProps<{
  target: SpotlightTarget | null
  canvasWidth: number
  canvasHeight: number
  zoom: number
}>()

const scaledTarget = computed(() => {
  if (!props.target) return { x: 0, y: 0, w: 0, h: 0 }
  const z = props.zoom || 1
  // Map canvas coords to SVG viewBox (10000x10000)
  const scaleX = 10000 / (props.canvasWidth || 1)
  const scaleY = 10000 / (props.canvasHeight || 1)
  return {
    x: Math.round(props.target.x * z * scaleX),
    y: Math.round(props.target.y * z * scaleY),
    w: Math.round(props.target.w * z * scaleX),
    h: Math.round(props.target.h * z * scaleY),
  }
})

const glowStyle = computed(() => {
  if (!props.target) return {}
  const z = props.zoom || 1
  return {
    left: `${props.target.x * z}px`,
    top: `${props.target.y * z}px`,
    width: `${props.target.w * z}px`,
    height: `${props.target.h * z}px`,
  }
})
</script>

<style scoped>
.wb-spotlight-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}
.wb-spotlight-overlay__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.wb-spotlight-overlay__glow {
  position: absolute;
  border: 3px solid rgba(59, 130, 246, 0.7);
  border-radius: 12px;
  box-shadow: 0 0 24px 4px rgba(59, 130, 246, 0.35);
  animation: spotlight-pulse 2s ease-in-out infinite;
}

@keyframes spotlight-pulse {
  0%, 100% { box-shadow: 0 0 24px 4px rgba(59, 130, 246, 0.35); }
  50% { box-shadow: 0 0 36px 8px rgba(59, 130, 246, 0.55); }
}

/* Transition */
.spotlight-fade-enter-active { transition: opacity 0.4s ease-out; }
.spotlight-fade-leave-active { transition: opacity 0.3s ease-in; }
.spotlight-fade-enter-from,
.spotlight-fade-leave-to { opacity: 0; }
</style>
