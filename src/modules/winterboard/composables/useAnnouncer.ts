// WB: Screen reader announcer composable
// Ref: TASK_BOARD.md B5.1 — aria-live announcements for tool changes, undo/redo, save status
// Uses a singleton hidden div with role="status" aria-live="assertive"

import { ref, onMounted, onUnmounted } from 'vue'

// ── Singleton state ─────────────────────────────────────────────────────────

let announcerEl: HTMLDivElement | null = null
let refCount = 0
const message = ref('')

function ensureAnnouncerEl(): void {
  if (announcerEl) return

  announcerEl = document.createElement('div')
  announcerEl.id = 'wb-announcer'
  announcerEl.setAttribute('role', 'status')
  announcerEl.setAttribute('aria-live', 'assertive')
  announcerEl.setAttribute('aria-atomic', 'true')

  // Visually hidden but accessible to screen readers
  Object.assign(announcerEl.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  })

  document.body.appendChild(announcerEl)
}

function removeAnnouncerEl(): void {
  if (announcerEl && announcerEl.parentNode) {
    announcerEl.parentNode.removeChild(announcerEl)
    announcerEl = null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Announce a message to screen readers via aria-live region.
 * Uses a clear-then-set pattern to ensure repeated identical messages are announced.
 */
function announce(text: string): void {
  ensureAnnouncerEl()
  if (!announcerEl) return

  // Clear first so identical consecutive messages still trigger announcement
  announcerEl.textContent = ''
  message.value = ''

  requestAnimationFrame(() => {
    if (announcerEl) {
      announcerEl.textContent = text
      message.value = text
    }
  })
}

/**
 * useAnnouncer — composable for screen reader announcements.
 * Manages the singleton announcer DOM element lifecycle via ref counting.
 */
export function useAnnouncer() {
  onMounted(() => {
    refCount++
    ensureAnnouncerEl()
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      refCount = 0
      removeAnnouncerEl()
    }
  })

  return {
    /** Current announcement message (reactive) */
    message,
    /** Announce a message to screen readers */
    announce,
  }
}
