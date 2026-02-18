<!-- WB: Error boundary component
     Ref: TASK_BOARD.md B3.2
     Catches errors in child components, shows fallback UI with retry -->
<template>
  <slot v-if="!hasError" />
  <div v-else class="wb-error-boundary" role="alert">
    <div class="wb-error-boundary__content">
      <!-- Icon -->
      <div class="wb-error-boundary__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <!-- Message -->
      <h2 class="wb-error-boundary__title">{{ t('winterboard.error.title') }}</h2>
      <p class="wb-error-boundary__message">{{ t('winterboard.error.message') }}</p>

      <!-- Actions -->
      <div class="wb-error-boundary__actions">
        <button type="button" class="wb-error-boundary__retry" @click="handleRetry">
          {{ t('winterboard.error.retry') }}
        </button>
      </div>

      <!-- Collapsible error details -->
      <details class="wb-error-boundary__details">
        <summary class="wb-error-boundary__details-toggle">
          {{ t('winterboard.error.showDetails') }}
        </summary>
        <pre class="wb-error-boundary__stack">{{ errorInfo }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBErrorBoundary — catches errors in child component tree
// Ref: TASK_BOARD.md B3.2

import { ref, onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const hasError = ref(false)
const errorInfo = ref('')

onErrorCaptured((error: Error, instance, info) => {
  console.error('[WB:ErrorBoundary]', error, '\nComponent:', instance, '\nInfo:', info)

  hasError.value = true
  errorInfo.value = [
    `Error: ${error.message}`,
    `Info: ${info}`,
    error.stack ?? '',
  ].join('\n')

  // Prevent error from propagating further
  return false
})

function handleRetry(): void {
  hasError.value = false
  errorInfo.value = ''
}
</script>

<style scoped>
.wb-error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 32px;
  background: var(--wb-bg, #ffffff);
}

.wb-error-boundary__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
}

.wb-error-boundary__icon {
  width: 48px;
  height: 48px;
  color: var(--wb-error, #dc2626);
  margin-bottom: 16px;
}

.wb-error-boundary__icon svg {
  width: 100%;
  height: 100%;
}

.wb-error-boundary__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 8px;
}

.wb-error-boundary__message {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0 0 20px;
  line-height: 1.5;
}

.wb-error-boundary__actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.wb-error-boundary__retry {
  padding: 10px 24px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-error-boundary__retry:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-error-boundary__retry:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: 2px;
}

.wb-error-boundary__details {
  width: 100%;
  text-align: left;
}

.wb-error-boundary__details-toggle {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  cursor: pointer;
  padding: 4px 0;
}

.wb-error-boundary__details-toggle:hover {
  color: var(--wb-fg, #0f172a);
}

.wb-error-boundary__stack {
  margin-top: 8px;
  padding: 12px;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--wb-fg-secondary, #64748b);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

@media (prefers-reduced-motion: reduce) {
  .wb-error-boundary__retry {
    transition: none;
  }
}
</style>
