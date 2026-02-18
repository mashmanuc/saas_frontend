<!-- WB: Save status indicator component
     Ref: ManifestWinterboard_v2.md LAW-02, TASK_BOARD.md B2.2
     Shows sync state: idle, syncing, saved, error, offline -->
<template>
  <div
    class="wb-save-status"
    :class="`wb-save-status--${status}`"
    role="status"
    :aria-live="status === 'error' ? 'assertive' : 'polite'"
    :aria-label="statusLabel"
  >
    <!-- Icon per state -->
    <component :is="statusIcon" class="wb-save-status__icon" />

    <!-- Text -->
    <span class="wb-save-status__text">{{ statusLabel }}</span>

    <!-- Retry button (error state only) -->
    <button
      v-if="status === 'error'"
      type="button"
      class="wb-save-status__retry"
      :aria-label="t('winterboard.status.retry')"
      @click="$emit('retry')"
    >
      {{ t('winterboard.status.retry') }}
    </button>
  </div>
</template>

<script setup lang="ts">
// WB: WBSaveStatus — sync status indicator
// Ref: TASK_BOARD.md B2.2

import { computed, h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBSyncStatus } from '../../types/winterboard'

// ─── Props & Emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  status: WBSyncStatus
  lastSavedAt: number | null
}>()

defineEmits<{
  (e: 'retry'): void
}>()

const { t } = useI18n()

// ─── Icons (inline SVG functional components) ───────────────────────────────

const IconCheck: FunctionalComponent = () =>
  h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('polyline', { points: '3.5 8.5 6.5 11.5 12.5 4.5' }),
  ])

const IconSync: FunctionalComponent = () =>
  h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('path', { d: 'M2 8a6 6 0 0 1 10.47-4' }),
    h('polyline', { points: '13 2 13 5 10 5' }),
    h('path', { d: 'M14 8a6 6 0 0 1-10.47 4' }),
    h('polyline', { points: '3 14 3 11 6 11' }),
  ])

const IconAlert: FunctionalComponent = () =>
  h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('circle', { cx: '8', cy: '8', r: '6' }),
    h('line', { x1: '8', y1: '5', x2: '8', y2: '8.5' }),
    h('line', { x1: '8', y1: '10.5', x2: '8.01', y2: '10.5' }),
  ])

const IconOffline: FunctionalComponent = () =>
  h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('line', { x1: '2', y1: '2', x2: '14', y2: '14' }),
    h('path', { d: 'M1.5 5.5a11 11 0 0 1 4.14-2.3' }),
    h('path', { d: 'M10.36 3.2a11 11 0 0 1 4.14 2.3' }),
    h('circle', { cx: '8', cy: '13', r: '1', fill: 'currentColor', stroke: 'none' }),
  ])

const IconIdle: FunctionalComponent = () =>
  h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('circle', { cx: '8', cy: '8', r: '2', fill: 'currentColor', stroke: 'none' }),
  ])

// ─── Computed ───────────────────────────────────────────────────────────────

const statusIcon = computed(() => {
  switch (props.status) {
    case 'syncing': return IconSync
    case 'saved': return IconCheck
    case 'error': return IconAlert
    case 'offline': return IconOffline
    default: return IconIdle
  }
})

const statusLabel = computed((): string => {
  switch (props.status) {
    case 'idle':
      return t('winterboard.status.idle')
    case 'syncing':
      return t('winterboard.status.syncing')
    case 'saved':
      return props.lastSavedAt
        ? t('winterboard.status.saved', { time: formatTimeAgo(props.lastSavedAt) })
        : t('winterboard.status.savedJustNow')
    case 'error':
      return t('winterboard.status.errorRetry')
    case 'offline':
      return t('winterboard.status.offline')
    default:
      return ''
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = Math.max(0, now - timestamp)
  const seconds = Math.floor(diff / 1000)

  if (seconds < 10) return t('winterboard.time.justNow')
  if (seconds < 60) return t('winterboard.time.secondsAgo', { n: seconds })

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('winterboard.time.minutesAgo', { n: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('winterboard.time.hoursAgo', { n: hours })

  return t('winterboard.time.daysAgo', { n: Math.floor(hours / 24) })
}
</script>

<style scoped>
/* WB: Save status indicator
   LAW-02: Sync metadata display
   LAW-22: Accessible status announcements */
.wb-save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  contain: layout style;
  transition: background 0.2s ease, color 0.2s ease;
}

/* State colors */
.wb-save-status--idle {
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-save-status--syncing {
  color: var(--wb-brand, #0066FF);
}

.wb-save-status--saved {
  color: var(--wb-success, #16a34a);
}

.wb-save-status--error {
  color: var(--wb-error, #dc2626);
  background: var(--wb-error-bg, #fef2f2);
  border-radius: 6px;
}

.wb-save-status--offline {
  color: var(--wb-warning, #d97706);
  background: var(--wb-warning-bg, #fffbeb);
  border-radius: 6px;
}

/* Icon */
.wb-save-status__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Spinning animation for syncing */
.wb-save-status--syncing .wb-save-status__icon {
  animation: wb-spin 1.2s linear infinite;
}

@keyframes wb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Text */
.wb-save-status__text {
  font-variant-numeric: tabular-nums;
}

/* Retry button */
.wb-save-status__retry {
  background: none;
  border: none;
  color: var(--wb-error, #dc2626);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 0 2px;
}

.wb-save-status__retry:hover {
  color: var(--wb-error-hover, #b91c1c);
}

.wb-save-status__retry:focus-visible {
  outline: 2px solid var(--wb-error, #dc2626);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-save-status {
    transition: none;
  }
  .wb-save-status--syncing .wb-save-status__icon {
    animation: none;
  }
}
</style>
