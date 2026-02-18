<!-- WB: Remote Cursors Overlay — render remote user cursors + selections
     Ref: TASK_BOARD_PHASES.md B6.1, LAW-16 (Multi-User Cursors) -->
<template>
  <div class="wb-remote-cursors" aria-hidden="true">
    <!-- Remote cursors -->
    <div
      v-for="cursor in visibleCursors"
      :key="'cursor-' + cursor.userId"
      class="wb-remote-cursors__cursor"
      :class="{ 'wb-remote-cursors__cursor--faded': cursor.isFaded }"
      :style="{
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        '--cursor-color': cursor.color,
      }"
    >
      <!-- Arrow -->
      <svg
        class="wb-remote-cursors__arrow"
        width="16" height="20" viewBox="0 0 16 20" fill="none"
      >
        <path
          d="M1 1L6.5 18L8.5 11L15 9L1 1Z"
          :fill="cursor.color"
          stroke="#fff"
          stroke-width="1"
          stroke-linejoin="round"
        />
      </svg>

      <!-- Label -->
      <div
        class="wb-remote-cursors__label"
        :style="{ backgroundColor: cursor.color }"
      >
        <span class="wb-remote-cursors__name">{{ cursor.displayName }}</span>
        <span v-if="cursor.tool" class="wb-remote-cursors__tool">{{ toolIcon(cursor.tool) }}</span>
      </div>
    </div>

    <!-- Remote selections (highlighted strokes) -->
    <div
      v-for="sel in visibleSelections"
      :key="'sel-' + sel.userId"
      class="wb-remote-cursors__selection-badge"
      :style="selectionBadgeStyle(sel)"
    >
      <span
        class="wb-remote-cursors__selection-name"
        :style="{ backgroundColor: sel.color }"
      >
        {{ sel.displayName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBRemoteCursorsOverlay — smooth remote cursor rendering
// Ref: TASK_BOARD_PHASES.md B6.1
import { computed } from 'vue'
import type { YjsRemoteCursor, RemoteSelection } from '../../composables/useYjsPresence'
import type { WBToolType } from '../../types/winterboard'

const props = defineProps<{
  /** Remote cursors from useYjsPresence */
  remoteCursors: YjsRemoteCursor[]
  /** Remote selections from useYjsPresence */
  remoteSelections: RemoteSelection[]
  /** Current page index — only show cursors on this page */
  currentPageIndex: number
  /** Stroke bounding boxes: strokeId → { x, y, width, height } */
  strokeBounds?: Map<string, { x: number; y: number; width: number; height: number }>
}>()

// ── Visible cursors (filtered by page) ────────────────────────────────────
const visibleCursors = computed(() =>
  props.remoteCursors.filter(
    c => String(c.pageId) === String(props.currentPageIndex),
  ),
)

// ── Visible selections (with at least one stroke on current page) ─────────
const visibleSelections = computed(() =>
  props.remoteSelections.filter(sel => {
    if (!props.strokeBounds) return sel.strokeIds.length > 0
    return sel.strokeIds.some(id => props.strokeBounds!.has(id))
  }),
)

// ── Tool icons ────────────────────────────────────────────────────────────
function toolIcon(tool: WBToolType): string {
  const map: Record<string, string> = {
    pen: '✏️',
    highlighter: '🖍️',
    eraser: '🧹',
    select: '👆',
    text: '📝',
    shape: '⬜',
    pan: '✋',
    laser: '🔴',
  }
  return map[tool] || ''
}

// ── Selection badge position ──────────────────────────────────────────────
function selectionBadgeStyle(sel: RemoteSelection): Record<string, string> {
  if (!props.strokeBounds) return { display: 'none' }

  let minX = Infinity
  let minY = Infinity

  for (const id of sel.strokeIds) {
    const b = props.strokeBounds.get(id)
    if (b) {
      if (b.x < minX) minX = b.x
      if (b.y < minY) minY = b.y
    }
  }

  if (minX === Infinity) return { display: 'none' }

  return {
    left: minX + 'px',
    top: (minY - 20) + 'px',
  }
}

// ── Expose for testing ────────────────────────────────────────────────────
defineExpose({
  visibleCursors,
  visibleSelections,
})
</script>

<style scoped>
.wb-remote-cursors {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 60;
  overflow: hidden;
}

/* ── Cursor ─────────────────────────────────────────────────────── */
.wb-remote-cursors__cursor {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  transition: transform 0.1s linear;
}

.wb-remote-cursors__cursor--faded {
  opacity: 0.3;
  transition: transform 0.1s linear, opacity 0.5s ease;
}

.wb-remote-cursors__arrow {
  display: block;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.wb-remote-cursors__label {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 12px;
  margin-top: -2px;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  max-width: 120px;
}

.wb-remote-cursors__name {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-remote-cursors__tool {
  font-size: 10px;
  line-height: 1;
}

/* ── Selection badge ────────────────────────────────────────────── */
.wb-remote-cursors__selection-badge {
  position: absolute;
}

.wb-remote-cursors__selection-name {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

/* ── Reduced motion ─────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wb-remote-cursors__cursor {
    transition: none;
  }

  .wb-remote-cursors__cursor--faded {
    transition: none;
  }
}
</style>
