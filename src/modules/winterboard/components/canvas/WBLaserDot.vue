<!-- WB: Laser pointer dot — ephemeral visual indicator (not persisted)
     Ref: TASK_BOARD_V5.md B5
     Local laser: bright red, no label
     Remote laser: custom color + displayName label
     a11y: aria-hidden (decorative, no interaction) -->
<template>
  <Transition name="wb-laser-fade">
    <div
      v-if="active"
      class="wb-laser-dot"
      :class="{
        'wb-laser-dot--local': isLocal,
        'wb-laser-dot--remote': !isLocal,
        'wb-laser-dot--fading': isFading,
      }"
      :style="dotStyle"
      role="presentation"
      :aria-hidden="true"
    >
      <!-- Display name label (only for remote lasers) -->
      <span v-if="!isLocal && displayName" class="wb-laser-dot__label">
        {{ displayName }}
      </span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  x: number
  y: number
  color?: string
  displayName?: string
  isLocal?: boolean
  active?: boolean
  isFading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  color: '#dc2626',
  displayName: '',
  isLocal: false,
  active: true,
  isFading: false,
})

const dotStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  backgroundColor: props.color,
  boxShadow: `0 0 8px 4px ${props.color}40`,
}))
</script>

<style scoped>
.wb-laser-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -50%);
  transition: left 0.05s linear, top 0.05s linear, opacity 0.3s ease;
}

.wb-laser-dot--local {
  /* Local laser: bright red via inline style */
}

.wb-laser-dot--remote {
  /* Remote: color via inline style */
}

.wb-laser-dot--fading {
  opacity: 0;
}

.wb-laser-dot__label {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  white-space: nowrap;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  color: inherit;
}

/* Fade transition */
.wb-laser-fade-enter-active {
  transition: opacity 0.15s ease;
}
.wb-laser-fade-leave-active {
  transition: opacity 0.3s ease;
}
.wb-laser-fade-enter-from,
.wb-laser-fade-leave-to {
  opacity: 0;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-laser-dot {
    transition: none;
    box-shadow: none !important;
  }
  .wb-laser-fade-enter-active,
  .wb-laser-fade-leave-active {
    transition: none;
  }
}
</style>
