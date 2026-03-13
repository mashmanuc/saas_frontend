<template>
  <!-- WB Responsive: Layout wrapper that adapts by deviceMode
       Ref: winterboard_dev/responsive/PHASE1.md B2
       INV-3: One toolbar with variant — CSS drives layout via data-device-mode -->
  <div
    class="wb-responsive-shell"
    :class="shellClasses"
    :data-device-mode="deviceMode"
    :data-input-mode="inputMode"
    :data-orientation="orientation"
    :style="shellStyle"
  >
    <!-- Header slot: always at top -->
    <div class="wb-responsive-shell__header">
      <slot name="header" />
    </div>

    <!-- Body: toolbar + canvas area -->
    <div class="wb-responsive-shell__body">
      <!-- Toolbar slot: left on desktop/tablet, bottom on mobile -->
      <div
        v-if="deviceMode !== 'mobile'"
        class="wb-responsive-shell__toolbar wb-responsive-shell__toolbar--side"
      >
        <slot name="toolbar" />
      </div>

      <!-- Canvas area -->
      <div ref="canvasContainerRef" class="wb-responsive-shell__canvas">
        <slot name="canvas" />
      </div>

      <!-- Sidebar slot (optional — content sidebar) -->
      <div v-if="$slots.sidebar" class="wb-responsive-shell__sidebar">
        <slot name="sidebar" />
      </div>
    </div>

    <!-- Mobile toolbar: bottom -->
    <div
      v-if="deviceMode === 'mobile'"
      class="wb-responsive-shell__toolbar wb-responsive-shell__toolbar--bottom"
    >
      <slot name="toolbar" />
    </div>

    <!-- Footer slot -->
    <div v-if="$slots.footer" class="wb-responsive-shell__footer">
      <slot name="footer" />
    </div>

    <!-- Overlay slot (dialogs, sheets) -->
    <slot name="overlay" />
  </div>
</template>

<script setup lang="ts">
// WB Responsive: Shell layout wrapper
// Ref: winterboard_dev/responsive/PHASE1.md B2
// Uses useDeviceMode for layout decisions, provides canvasContainerRef for useCanvasResize

import { ref, computed, watch, provide } from 'vue'
import { useDeviceMode } from '../../composables/useDeviceMode'
import { useCanvasResize } from '../../composables/useCanvasResize'
import { useWBStore } from '../../board/state/boardStore'
import type { DeviceMode } from '../../types/responsive'

const { deviceMode, inputMode, orientation, state: deviceState } = useDeviceMode()
const store = useWBStore()

const canvasContainerRef = ref<HTMLElement | null>(null)

const { width: containerWidth, height: containerHeight } = useCanvasResize({
  containerRef: canvasContainerRef,
  onResize(w, h) {
    store.setContainerSize(w, h)
  },
})

// Provide device state to children
provide('wb-device-mode', deviceMode)
provide('wb-input-mode', inputMode)
provide('wb-orientation', orientation)
provide('wb-device-state', deviceState)
provide('wb-canvas-container-ref', canvasContainerRef)

// Shell CSS classes
const shellClasses = computed(() => ({
  'wb-responsive-shell--mobile': deviceMode.value === 'mobile',
  'wb-responsive-shell--tablet': deviceMode.value === 'tablet',
  'wb-responsive-shell--desktop': deviceMode.value === 'desktop',
  'wb-responsive-shell--display': deviceMode.value === 'display',
  'wb-responsive-shell--portrait': orientation.value === 'portrait',
  'wb-responsive-shell--landscape': orientation.value === 'landscape',
}))

// INV-5: Set --wb-vh from visualViewport (Safari-safe), fallback to innerHeight
// This makes the variable available to all children and avoids 100vh iOS jump.
const shellStyle = computed(() => {
  const vhPx =
    typeof window !== 'undefined'
      ? ((window.visualViewport?.height ?? window.innerHeight) / 100)
      : 1
  return {
    '--wb-vh': `${vhPx}px`,
    height: 'calc(var(--wb-vh, 1vh) * 100)',
  }
})

// Expose for parent components
defineExpose({
  deviceMode,
  inputMode,
  orientation,
  containerWidth,
  containerHeight,
  canvasContainerRef,
})
</script>

<style scoped>
/* WB Responsive Shell layout
   Uses CSS Grid for adaptive layout by deviceMode.
   INV-5: Never use 100vh — uses --wb-vh CSS variable. */

.wb-responsive-shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  background: var(--wb-bg, #f1f5f9);
}

.wb-responsive-shell__header {
  flex-shrink: 0;
  z-index: var(--wb-z-header, 30);
}

.wb-responsive-shell__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.wb-responsive-shell__toolbar--side {
  flex-shrink: 0;
  z-index: var(--wb-z-toolbar, 10);
}

.wb-responsive-shell__toolbar--bottom {
  flex-shrink: 0;
  z-index: var(--wb-z-mobile-toolbar, 20);
  touch-action: manipulation;
}

.wb-responsive-shell__canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
  z-index: var(--wb-z-canvas, 1);
  touch-action: none;
}

.wb-responsive-shell__sidebar {
  flex-shrink: 0;
  overflow-y: auto;
}

.wb-responsive-shell__footer {
  flex-shrink: 0;
}

/* ── Mobile: toolbar at bottom ─────────────────────────────────── */
.wb-responsive-shell--mobile .wb-responsive-shell__body {
  flex-direction: column;
}

/* ── Display: slightly larger spacing ──────────────────────────── */
.wb-responsive-shell--display .wb-responsive-shell__toolbar--side {
  padding: var(--wb-spacing-display, 24px) 0;
}
</style>
