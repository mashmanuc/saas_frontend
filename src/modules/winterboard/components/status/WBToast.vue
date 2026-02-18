<!-- WB: Toast notification container
     Ref: TASK_BOARD.md B3.2
     Position: bottom-right, auto-dismiss, stacked -->
<template>
  <Teleport to="body">
    <div
      v-if="toasts.length > 0"
      class="wb-toast-container"
      role="log"
      aria-live="polite"
      :aria-label="t('winterboard.a11y.notifications')"
    >
      <TransitionGroup name="wb-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="wb-toast"
          :class="`wb-toast--${toast.type}`"
          role="alert"
        >
          <!-- Icon -->
          <span class="wb-toast__icon" aria-hidden="true">{{ iconForType(toast.type) }}</span>

          <!-- Message -->
          <span class="wb-toast__message">{{ toast.message }}</span>

          <!-- Action button (optional, e.g. Retry) -->
          <button
            v-if="toast.action"
            type="button"
            class="wb-toast__action"
            @click="handleAction(toast)"
          >
            {{ toast.action.label }}
          </button>

          <!-- Dismiss -->
          <button
            type="button"
            class="wb-toast__dismiss"
            :aria-label="t('winterboard.a11y.dismiss')"
            @click="dismissToast(toast.id)"
          >
            &times;
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// WB: WBToast — toast notification UI
// Ref: TASK_BOARD.md B3.2

import { useI18n } from 'vue-i18n'
import { useToast, type WBToastItem, type WBToastType } from '../../composables/useToast'

const { t } = useI18n()
const { toasts, dismissToast } = useToast()

function iconForType(type: WBToastType): string {
  switch (type) {
    case 'success': return '✓'
    case 'error': return '✕'
    case 'warning': return '⚠'
    case 'info': return 'ℹ'
    default: return 'ℹ'
  }
}

function handleAction(toast: WBToastItem): void {
  toast.action?.callback()
  dismissToast(toast.id)
}
</script>

<style scoped>
/* WB: Toast container — bottom-right, stacked */
.wb-toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  max-width: 380px;
  pointer-events: none;
}

.wb-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

/* Type variants */
.wb-toast--success {
  background: #f0fdf4;
  color: #166534;
  border-left: 3px solid #22c55e;
}

.wb-toast--error {
  background: #fef2f2;
  color: #991b1b;
  border-left: 3px solid #ef4444;
}

.wb-toast--warning {
  background: #fffbeb;
  color: #92400e;
  border-left: 3px solid #f59e0b;
}

.wb-toast--info {
  background: #eff6ff;
  color: #1e40af;
  border-left: 3px solid #3b82f6;
}

.wb-toast__icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.wb-toast__message {
  flex: 1;
  min-width: 0;
}

.wb-toast__action {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
  color: inherit;
}

.wb-toast__action:hover {
  opacity: 0.8;
}

.wb-toast__action:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.wb-toast__dismiss {
  background: none;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  opacity: 0.5;
  color: inherit;
  flex-shrink: 0;
}

.wb-toast__dismiss:hover {
  opacity: 1;
}

/* Transition */
.wb-toast-enter-active {
  transition: all 0.3s ease;
}

.wb-toast-leave-active {
  transition: all 0.2s ease;
}

.wb-toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.wb-toast-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-toast-enter-active,
  .wb-toast-leave-active {
    transition: none;
  }
}
</style>
