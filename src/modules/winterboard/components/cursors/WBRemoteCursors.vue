<!-- WB: Remote cursors overlay — renders other users' cursors on top of canvas
     Ref: TASK_BOARD.md A3.1, ManifestWinterboard_v2.md LAW-16
     - SVG arrow + colored name label per cursor
     - CSS transition 50ms for smooth movement
     - Auto-hide cursors inactive >5s
     - Throttled render via requestAnimationFrame -->
<template>
  <div class="wb-remote-cursors" aria-hidden="true">
    <div
      v-for="cursor in visibleCursors"
      :key="cursor.userId"
      class="wb-cursor"
      :style="getCursorStyle(cursor)"
    >
      <!-- SVG Arrow -->
      <svg
        class="wb-cursor__arrow"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 2L16 10L10 11L8 18L4 2Z"
          :fill="cursor.color"
          stroke="white"
          stroke-width="1"
          stroke-linejoin="round"
        />
      </svg>

      <!-- Name label -->
      <span
        class="wb-cursor__label"
        :style="{ background: cursor.color }"
      >
        {{ cursor.displayName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBRemoteCursors — overlay for multi-user cursor rendering
// Ref: TASK_BOARD.md A3.1, classroom/stores/presenceCursorsStore.ts (reference)

import { computed, ref, onUnmounted } from 'vue'
import type { WBRemoteCursor } from '../../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5_000 // Hide cursors inactive >5s
const CLEANUP_INTERVAL_MS = 1_000 // Check for stale cursors every 1s

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  /** Map of userId → cursor data */
  cursors: Map<string, WBRemoteCursor>
  /** Current zoom level for coordinate scaling */
  zoom?: number
  /** Current page ID — only show cursors on same page */
  currentPageId?: string
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 1,
  currentPageId: '',
})

// ─── Stale cursor cleanup ───────────────────────────────────────────────────

const now = ref(Date.now())

const cleanupTimer = setInterval(() => {
  now.value = Date.now()
}, CLEANUP_INTERVAL_MS)

onUnmounted(() => {
  clearInterval(cleanupTimer)
})

// ─── Computed ───────────────────────────────────────────────────────────────

const visibleCursors = computed(() => {
  const result: WBRemoteCursor[] = []
  const threshold = now.value - STALE_THRESHOLD_MS

  for (const [, cursor] of props.cursors) {
    // Skip stale cursors
    if (cursor.lastUpdate < threshold) continue

    // Skip cursors on different pages (if pageId filtering is active)
    if (props.currentPageId && cursor.pageId && cursor.pageId !== props.currentPageId) continue

    result.push(cursor)
  }

  return result
})

// ─── Style helpers ──────────────────────────────────────────────────────────

function getCursorStyle(cursor: WBRemoteCursor): Record<string, string> {
  return {
    transform: `translate(${cursor.x * props.zoom}px, ${cursor.y * props.zoom}px)`,
  }
}
</script>

<style scoped>
/* WB: Remote cursors overlay
   Positioned absolutely over the canvas container.
   Parent must have position: relative. */

.wb-remote-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}

.wb-cursor {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 50ms linear;
}

.wb-cursor__arrow {
  display: block;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.wb-cursor__label {
  display: inline-block;
  margin-left: 14px;
  margin-top: -4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  line-height: 1.4;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-cursor {
    transition: none;
  }
}
</style>
