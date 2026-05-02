<template>
  <Teleport to="body">
    <Transition name="audit-fade">
      <div
        v-if="isVisible && snapshot"
        ref="overlayRef"
        class="audit-overlay"
        :class="`audit-overlay--${snapshot.status}`"
        :style="positionStyle"
        data-testid="audit-overlay"
        @pointerdown="onDragStart"
      >
        <div class="audit-overlay__row" data-testid="audit-requests">
          <span class="audit-overlay__icon">📡</span>
          <span class="audit-overlay__label">Requests:</span>
          <span class="audit-overlay__value">{{ snapshot.requests }}</span>
          <span class="audit-overlay__badge" :class="requestsBadgeClass">{{ requestsIcon }}</span>
        </div>

        <div class="audit-overlay__row" data-testid="audit-duplicates">
          <span class="audit-overlay__icon">🔄</span>
          <span class="audit-overlay__label">Duplicates:</span>
          <span class="audit-overlay__value">{{ snapshot.duplicates }}</span>
          <span class="audit-overlay__badge" :class="duplicatesBadgeClass">{{ duplicatesIcon }}</span>
        </div>

        <div class="audit-overlay__row" data-testid="audit-cache">
          <span class="audit-overlay__icon">💾</span>
          <span class="audit-overlay__label">Cache:</span>
          <span class="audit-overlay__value">{{ cachePercent }}%</span>
          <span class="audit-overlay__badge" :class="cacheBadgeClass">{{ cacheIcon }}</span>
        </div>

        <div class="audit-overlay__row" data-testid="audit-ws">
          <span class="audit-overlay__icon">⚡</span>
          <span class="audit-overlay__label">WS:</span>
          <span class="audit-overlay__value">{{ snapshot.wsEventsInWindow }}/5s</span>
          <span class="audit-overlay__badge" :class="wsBadgeClass">{{ wsIcon }}</span>
        </div>

        <div class="audit-overlay__status" data-testid="audit-status">
          {{ statusIcon }} {{ statusText }}
        </div>

        <div
          v-if="visibleIssues.length"
          class="audit-overlay__issues"
          data-testid="audit-issues"
        >
          <div
            v-for="issue in visibleIssues"
            :key="issue.id"
            class="audit-overlay__issue"
            :class="`audit-overlay__issue--${issue.level}`"
            :data-testid="`audit-issue-${issue.id}`"
          >
            <span class="audit-overlay__issue-icon">{{ issue.level === 'error' ? '❌' : '⚠️' }}</span>
            <span class="audit-overlay__issue-text">
              <span class="audit-overlay__issue-msg">{{ issue.message }}</span>
              <span class="audit-overlay__issue-hint">{{ issue.hint }}</span>
            </span>
          </div>
          <div
            v-if="hiddenIssuesCount > 0"
            class="audit-overlay__issues-more"
            data-testid="audit-issues-more"
          >
            +{{ hiddenIssuesCount }} more
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Phase 30 B2: Audit Overlay Component
 *
 * Displays real-time audit metrics. Draggable to any screen position.
 * INV-4: No API calls — only reads client-side data.
 * INV-6: All data from auditCollector via useAuditOverlay.
 */
import { computed, ref } from 'vue'
import { useLayoutStore } from '@/stores/layoutStore'

// Layout SSoT (Stage 5) — drag positioning reads non-reactive viewport snapshot per onMove call.
const layoutStore = useLayoutStore()
import { useAuditOverlay } from './useAuditOverlay'
import { DEFAULT_AUDIT_CONFIG } from './types'
import type { AuditIssue } from './types'

const MAX_VISIBLE_ISSUES = 3

const { snapshot, isVisible } = useAuditOverlay()
const thresh = DEFAULT_AUDIT_CONFIG.thresholds

// ── Drag state ──────────────────────────────────────────────
const overlayRef = ref<HTMLElement>()
const posX = ref<number | null>(null)
const posY = ref<number | null>(null)

const positionStyle = computed(() => {
  if (posX.value !== null && posY.value !== null) {
    return {
      left: `${posX.value}px`,
      top: `${posY.value}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }
  // Дефолтна позиція — bottom-right
  return {}
})

function onDragStart(e: PointerEvent) {
  const el = overlayRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  // Якщо ще не було drag — ініціалізуємо позицію з поточної
  if (posX.value === null) {
    posX.value = rect.left
    posY.value = rect.top
  }

  const startX = e.clientX
  const startY = e.clientY
  const startPosX = posX.value!
  const startPosY = posY.value!

  el.style.cursor = 'grabbing'
  el.setPointerCapture(e.pointerId)

  function onMove(ev: PointerEvent) {
    const { width: vw, height: vh } = layoutStore.getViewportSnapshot()
    posX.value = Math.max(0, Math.min(startPosX + (ev.clientX - startX), vw - 60))
    posY.value = Math.max(0, Math.min(startPosY + (ev.clientY - startY), vh - 40))
  }

  function onUp() {
    el!.style.cursor = ''
    document.removeEventListener('pointermove', onMove)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp, { once: true })
}

// ── Metrics ─────────────────────────────────────────────────

const cachePercent = computed(() =>
  snapshot.value ? Math.round(snapshot.value.cacheHitRate * 100) : 100
)

const statusIcon = computed(() => {
  if (!snapshot.value) return '⏳'
  return { ok: '✅', warn: '⚠️', error: '❌' }[snapshot.value.status]
})
const statusText = computed(() => {
  if (!snapshot.value) return 'Loading...'
  return { ok: 'OK', warn: 'Warning', error: 'Issues detected' }[snapshot.value.status]
})

// Row badge icons
const requestsIcon = computed(() => {
  if (!snapshot.value) return '✅'
  if (snapshot.value.requests > thresh.requests.error) return '❌'
  if (snapshot.value.requests > thresh.requests.warn) return '⚠️'
  return '✅'
})
const duplicatesIcon = computed(() => {
  if (!snapshot.value) return '✅'
  if (snapshot.value.duplicates >= thresh.duplicates.error) return '❌'
  return '✅'
})
const cacheIcon = computed(() => {
  if (!snapshot.value || snapshot.value.cacheTotal === 0) return '✅'
  if (snapshot.value.cacheHitRate < thresh.cacheHitRate.error) return '❌'
  if (snapshot.value.cacheHitRate < thresh.cacheHitRate.warn) return '⚠️'
  return '✅'
})
const wsIcon = computed(() => {
  if (!snapshot.value) return '✅'
  if (snapshot.value.wsEventsInWindow > thresh.wsEventsPerWindow.error) return '❌'
  if (snapshot.value.wsEventsInWindow > thresh.wsEventsPerWindow.warn) return '⚠️'
  return '✅'
})

const requestsBadgeClass = computed(() => badgeClass(requestsIcon.value))
const duplicatesBadgeClass = computed(() => badgeClass(duplicatesIcon.value))
const cacheBadgeClass = computed(() => badgeClass(cacheIcon.value))
const wsBadgeClass = computed(() => badgeClass(wsIcon.value))

function badgeClass(icon: string): string {
  if (icon === '❌') return 'audit-overlay__badge--error'
  if (icon === '⚠️') return 'audit-overlay__badge--warn'
  return 'audit-overlay__badge--ok'
}

// Phase 31: Issues display (B7-B8)
const allIssues = computed(() => snapshot.value?.issues ?? ([] as AuditIssue[]))
const visibleIssues = computed(() => allIssues.value.slice(0, MAX_VISIBLE_ISSUES))
const hiddenIssuesCount = computed(() => Math.max(0, allIssues.value.length - MAX_VISIBLE_ISSUES))
</script>

<style scoped>
.audit-overlay {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9990;
  min-width: 200px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  backdrop-filter: blur(8px);
  cursor: grab;
  user-select: none;
  transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
.audit-overlay:active {
  cursor: grabbing;
}

.audit-overlay--ok {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.4);
  color: #16a34a;
}

.audit-overlay--warn {
  background: rgba(234, 179, 8, 0.12);
  border-color: rgba(234, 179, 8, 0.4);
  color: #ca8a04;
}

.audit-overlay--error {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
  color: #dc2626;
}

.audit-overlay__row {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.audit-overlay__icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.audit-overlay__label {
  opacity: 0.7;
  flex-shrink: 0;
}

.audit-overlay__value {
  font-weight: 600;
  min-width: 32px;
}

.audit-overlay__badge {
  margin-left: auto;
  flex-shrink: 0;
}

.audit-overlay__badge--ok { opacity: 0.6; }
.audit-overlay__badge--warn { opacity: 1; }
.audit-overlay__badge--error { opacity: 1; }

.audit-overlay__status {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid currentColor;
  opacity: 0.6;
  text-align: center;
  font-size: 11px;
}

/* Phase 31: Issues block */
.audit-overlay__issues {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid currentColor;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audit-overlay__issue {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
}

.audit-overlay__issue--error {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.audit-overlay__issue--warn {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}

.audit-overlay__issue-icon {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
}

.audit-overlay__issue-text {
  display: flex;
  flex-direction: column;
}

.audit-overlay__issue-msg {
  font-weight: 600;
}

.audit-overlay__issue-hint {
  opacity: 0.7;
  font-size: 10px;
}

.audit-overlay__issues-more {
  text-align: center;
  opacity: 0.5;
  font-size: 10px;
  padding: 2px 0;
}

/* Transition */
.audit-fade-enter-active,
.audit-fade-leave-active {
  transition: opacity 0.3s ease;
}

.audit-fade-enter-from,
.audit-fade-leave-to {
  opacity: 0;
}
</style>
