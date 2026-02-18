<!-- WB: Conflict Indicators — selection locks, area highlights, concurrent edit toast
     Ref: TASK_BOARD_PHASES.md B6.1, LAW-16 (Multi-User Conflict UX) -->
<template>
  <div class="wb-conflict-indicators" aria-hidden="true">
    <!-- Selection lock icons (positioned absolutely over canvas) -->
    <div
      v-for="lock in selectionLocks"
      :key="'lock-' + lock.userId + '-' + lock.strokeId"
      class="wb-conflict-indicators__lock"
      :style="{ left: lock.x + 'px', top: lock.y + 'px', color: lock.color }"
      :title="t('winterboard.collaboration.lockedBy', { name: lock.displayName })"
      role="img"
      :aria-label="t('winterboard.collaboration.lockedBy', { name: lock.displayName })"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    </div>

    <!-- Area highlights (semi-transparent rectangles around active remote cursors) -->
    <div
      v-for="area in activeAreas"
      :key="'area-' + area.userId"
      class="wb-conflict-indicators__area"
      :style="{
        left: area.x - 30 + 'px',
        top: area.y - 30 + 'px',
        width: '60px',
        height: '60px',
        backgroundColor: area.color + '15',
        borderColor: area.color + '40',
      }"
    />

    <!-- Concurrent edit toast -->
    <Teleport to="body">
      <Transition name="wb-toast-fade">
        <div
          v-if="showConcurrentToast"
          class="wb-conflict-indicators__toast"
          role="status"
          aria-live="polite"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="#0066FF" stroke-width="1.2" />
            <circle cx="5.5" cy="7.5" r="1" fill="#0066FF" />
            <circle cx="10.5" cy="7.5" r="1" fill="#0066FF" />
          </svg>
          <span>{{ concurrentToastText }}</span>
        </div>
      </Transition>
    </Teleport>

    <!-- Screen reader announcements for locks -->
    <div class="wb-sr-only" aria-live="polite" aria-atomic="true">
      {{ srLockAnnouncement }}
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBConflictIndicators — visual conflict feedback for multi-user editing
// Ref: TASK_BOARD_PHASES.md B6.1
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { YjsRemoteCursor, RemoteSelection } from '../../composables/useYjsPresence'

const props = defineProps<{
  /** Remote cursors from useYjsPresence */
  remoteCursors: YjsRemoteCursor[]
  /** Remote selections from useYjsPresence */
  remoteSelections: RemoteSelection[]
  /** Current page index to filter cursors/selections */
  currentPageIndex: number
  /** Stroke positions map: strokeId → { x, y } for lock icon placement */
  strokePositions?: Map<string, { x: number; y: number }>
}>()

const { t } = useI18n()

// ── Selection locks ───────────────────────────────────────────────────────
interface SelectionLock {
  userId: string
  displayName: string
  color: string
  strokeId: string
  x: number
  y: number
}

const selectionLocks = computed<SelectionLock[]>(() => {
  const locks: SelectionLock[] = []
  const positions = props.strokePositions ?? new Map()

  for (const sel of props.remoteSelections) {
    for (const strokeId of sel.strokeIds) {
      const pos = positions.get(strokeId)
      if (pos) {
        locks.push({
          userId: sel.userId,
          displayName: sel.displayName,
          color: sel.color,
          strokeId,
          x: pos.x,
          y: pos.y,
        })
      }
    }
  }

  return locks
})

// ── Active areas (cursors drawing on current page) ────────────────────────
interface ActiveArea {
  userId: string
  color: string
  x: number
  y: number
}

const AREA_FADE_MS = 2_000
const areaTimestamps = ref<Map<string, number>>(new Map())

const activeAreas = computed<ActiveArea[]>(() => {
  const now = Date.now()
  const areas: ActiveArea[] = []

  for (const cursor of props.remoteCursors) {
    if (cursor.isFaded) continue
    if (String(cursor.pageId) !== String(props.currentPageIndex)) continue

    const lastSeen = areaTimestamps.value.get(cursor.userId) ?? cursor.lastUpdate
    if (now - lastSeen > AREA_FADE_MS) continue

    areas.push({
      userId: cursor.userId,
      color: cursor.color,
      x: cursor.x,
      y: cursor.y,
    })
  }

  return areas
})

// Track cursor activity timestamps
watch(() => props.remoteCursors, (cursors) => {
  const now = Date.now()
  for (const c of cursors) {
    if (!c.isFaded) {
      areaTimestamps.value.set(c.userId, now)
    }
  }
}, { deep: true })

// ── Concurrent edit toast ─────────────────────────────────────────────────
const showConcurrentToast = ref(false)
const concurrentEditorCount = ref(0)
let toastTimer: ReturnType<typeof setTimeout> | null = null
let lastToastPageIndex: number | null = null

const concurrentToastText = computed(() =>
  t('winterboard.collaboration.concurrentEditors', { count: concurrentEditorCount.value }),
)

// Show toast when multiple users are on the same page
watch([() => props.remoteCursors, () => props.currentPageIndex], ([cursors, pageIdx]) => {
  const samePageUsers = cursors.filter(
    c => String(c.pageId) === String(pageIdx) && !c.isFaded,
  )

  if (samePageUsers.length > 0 && lastToastPageIndex !== pageIdx) {
    concurrentEditorCount.value = samePageUsers.length + 1 // +1 for current user
    showConcurrentToast.value = true
    lastToastPageIndex = pageIdx

    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      showConcurrentToast.value = false
    }, 5_000)
  }
}, { deep: true })

// ── Screen reader lock announcements ──────────────────────────────────────
const srLockAnnouncement = ref('')

watch(() => props.remoteSelections, (selections) => {
  if (selections.length > 0) {
    const first = selections[0]
    srLockAnnouncement.value = t('winterboard.collaboration.lockedBy', { name: first.displayName })
  }
}, { deep: true })

// ── Expose for testing ────────────────────────────────────────────────────
defineExpose({
  selectionLocks,
  activeAreas,
  showConcurrentToast,
  concurrentEditorCount,
  srLockAnnouncement,
})

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.wb-conflict-indicators {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

/* ── Lock icons ─────────────────────────────────────────────────── */
.wb-conflict-indicators__lock {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: auto;
  cursor: help;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}

/* ── Area highlights ────────────────────────────────────────────── */
.wb-conflict-indicators__area {
  position: absolute;
  border: 1px dashed;
  border-radius: 8px;
  transition: opacity 0.3s ease;
}

/* ── Concurrent toast ───────────────────────────────────────────── */
.wb-conflict-indicators__toast {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #ffffff;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1001;
  pointer-events: auto;
}

/* ── SR only ────────────────────────────────────────────────────── */
.wb-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Transitions ────────────────────────────────────────────────── */
.wb-toast-fade-enter-active,
.wb-toast-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.wb-toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.wb-toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .wb-conflict-indicators__area,
  .wb-toast-fade-enter-active,
  .wb-toast-fade-leave-active {
    transition: none;
  }
}
</style>
