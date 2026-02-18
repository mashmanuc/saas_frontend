// WB: Toast notification composable
// Ref: TASK_BOARD.md B3.2
// Provides showToast() for user-facing notifications (save errors, success, etc.)

import { ref, readonly } from 'vue'

// ─── Types ──────────────────────────────────────────────────────────────────

export type WBToastType = 'success' | 'error' | 'warning' | 'info'

export interface WBToastItem {
  id: number
  message: string
  type: WBToastType
  duration: number
  action?: { label: string; callback: () => void }
}

// ─── Singleton state (shared across all consumers) ──────────────────────────

const toasts = ref<WBToastItem[]>([])
let nextId = 1

// ─── Public API ─────────────────────────────────────────────────────────────

function showToast(
  message: string,
  type: WBToastType = 'info',
  options?: { duration?: number; action?: { label: string; callback: () => void } },
): number {
  const id = nextId++
  const duration = options?.duration ?? (type === 'error' ? 8000 : 5000)

  const toast: WBToastItem = {
    id,
    message,
    type,
    duration,
    action: options?.action,
  }

  toasts.value = [...toasts.value, toast]

  // Auto-dismiss (0 = persistent until manual dismiss)
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id)
    }, duration)
  }

  return id
}

function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function clearAllToasts(): void {
  toasts.value = []
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useToast() {
  return {
    toasts: readonly(toasts),
    showToast,
    dismissToast,
    clearAllToasts,
  }
}
