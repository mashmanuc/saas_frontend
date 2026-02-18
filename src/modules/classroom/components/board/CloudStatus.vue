<template>
  <!-- F29-STEALTH: quiet mode uses opacity-only transitions, no layout changes -->
  <div
    class="cloud-status"
    :class="[
      `cloud-status--${status}`,
      { 'cloud-status--compact': compact },
      { 'cloud-status--quiet': quiet && status !== 'error' }
    ]"
    role="status"
    :aria-live="status === 'error' ? 'assertive' : 'polite'"
    :aria-label="statusLabel"
  >
    <span class="cloud-status__icon">
      <IconCloud v-if="status === 'idle' || status === 'saved'" />
      <IconCloudSync v-else-if="status === 'syncing'" class="cloud-status__spin" />
      <IconCloudOff v-else-if="status === 'error'" />
    </span>

    <span v-if="!compact" class="cloud-status__text">
      {{ statusText }}
      <!-- F29-STEALTH: Show queued count if any -->
      <span v-if="pendingCount > 0" class="cloud-status__pending">
        ({{ pendingCount }})
      </span>
    </span>

    <button
      v-if="status === 'error' && !compact && !quiet"
      class="cloud-status__retry"
      @click="$emit('retry')"
      :aria-label="$t('common.retry')"
    >
      {{ $t('common.retry') }}
    </button>

    <span v-if="lastSavedAt && status === 'saved' && !compact" class="cloud-status__time">
      {{ formatTime(lastSavedAt) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Inline SVG icons for cloud status
import IconCloud from './icons/IconCloud.vue'
import IconCloudSync from './icons/IconCloudSync.vue'
import IconCloudOff from './icons/IconCloudOff.vue'
import IconCloudCheck from './icons/IconCloudCheck.vue'

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

interface Props {
  status: SyncStatus
  lastSavedAt?: Date | string | null
  compact?: boolean
  errorMessage?: string
  quiet?: boolean // F29-STEALTH: opacity-only mode
  pendingCount?: number // F29-STEALTH: queued saves count
}

const props = withDefaults(defineProps<Props>(), {
  status: 'idle',
  lastSavedAt: null,
  compact: false,
  errorMessage: '',
  quiet: true,
  pendingCount: 0,
})

defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const statusText = computed(() => {
  switch (props.status) {
    case 'syncing':
      return t('winterboard.board.syncing')
    case 'saved':
      return t('winterboard.board.saved')
    case 'error':
      return props.errorMessage || t('winterboard.board.error')
    default:
      return ''
  }
})

const statusLabel = computed(() => {
  return `${t('winterboard.board.cloudStatus')}: ${statusText.value}`
})

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* F29-AS.7, F29-AS.25: Zero-repaint CloudStatus with CSS containment */
.cloud-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
  background: var(--color-bg-secondary, #f8fafc);
  color: var(--color-fg-secondary, #475569);
  border: 1px solid var(--color-border, #e2e8f0);
  /* F29-AS.25: CSS containment to prevent layout/reflow of canvas */
  contain: content;
  will-change: opacity, background-color;
  /* Ensure fixed dimensions to prevent layout shifts */
  min-width: 80px;
  min-height: 32px;
}

.cloud-status--compact {
  padding: 4px 8px;
}

.cloud-status--syncing {
  background: var(--color-info-light, #e0f2fe);
  color: var(--color-info, #0284c7);
  border-color: var(--color-info, #0284c7);
}

.cloud-status--saved {
  background: var(--color-success-light, #dcfce7);
  color: var(--color-success, #16a34a);
  border-color: var(--color-success, #16a34a);
}

.cloud-status--error {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error, #dc2626);
  border-color: var(--color-error, #dc2626);
}

.cloud-status__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.cloud-status__icon svg {
  width: 100%;
  height: 100%;
}

.cloud-status__spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.cloud-status__text {
  white-space: nowrap;
}

.cloud-status__retry {
  margin-left: 4px;
  padding: 2px 8px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.cloud-status__retry:hover {
  background: rgba(0, 0, 0, 0.05);
}

.cloud-status__time {
  margin-left: 4px;
  font-size: 0.75rem;
  opacity: 0.7;
}

/* F29-STEALTH: Quiet mode - opacity-only transitions, no layout changes */
.cloud-status--quiet {
  /* Override color transitions with opacity-only */
  transition: opacity 0.15s ease;
  /* Keep same background/border to prevent layout shifts */
  background: var(--color-bg-secondary, #f8fafc) !important;
  border-color: var(--color-border, #e2e8f0) !important;
  color: var(--color-fg-secondary, #475569) !important;
}

.cloud-status--quiet.cloud-status--syncing {
  opacity: 0.7;
}

.cloud-status--quiet.cloud-status--saved {
  opacity: 1;
}

.cloud-status__pending {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 2px;
  opacity: 0.7;
}
</style>
