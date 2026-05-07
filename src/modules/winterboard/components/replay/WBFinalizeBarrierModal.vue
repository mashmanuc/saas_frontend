<!--
  WBFinalizeBarrierModal — INV-22 PR-1b blocking modal

  Per OPS_SYNC_SSOT.md INV-22 §22.7 + FIRST_FIX_SPRINT_PROPOSAL §1:
    Shown коли finalizeWithBarrier() rejects with 504 (timeout) or 429 (contention).
    User-driven retry only — NO auto retry (LAW §12).

  States (props):
    - 'waiting'    : barrier in flight; spinner shown, NO buttons (modal blocks).
    - 'timeout'    : 504 APPLY_BACKLOG_TIMEOUT — show seq diagnostics + retry button.
    - 'contention' : 429 FINALIZE_ALREADY_PENDING — same modal, retry disabled
                     for retry_after_ms then re-enabled.
    - 'closed' / null : not shown.

  Emits:
    - 'retry' : user clicked "Спробувати ще раз" — caller fires single new
                finalizeWithBarrier() attempt.
    - (no 'close' emit — modal is BLOCKING; user cannot dismiss without action.
       If caller decides to give up, it sets state to 'closed' from outside.)

  HARD invariant (per §22.7): this modal MUST NOT trigger DESYNC, redirect, or
  reload. It is a UX wrapper for operational states; opsSyncStore stays SYNC.
-->
<template>
  <div
    v-if="visible"
    class="wb-finalize-barrier__backdrop"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    data-testid="wb-finalize-barrier-modal"
  >
    <div class="wb-finalize-barrier">
      <header class="wb-finalize-barrier__header">
        <h3 :id="titleId" class="wb-finalize-barrier__title">
          Завершення уроку…
        </h3>
      </header>

      <section class="wb-finalize-barrier__body">
        <p class="wb-finalize-barrier__message">
          Очікуємо збереження останніх дій.
        </p>

        <!-- Diagnostic info on timeout (operational visibility) -->
        <p
          v-if="state === 'timeout' && expectedSeq != null && currentSeq != null"
          class="wb-finalize-barrier__diagnostic"
          data-testid="wb-finalize-barrier-diagnostic"
        >
          Очікувано до seq <strong>{{ expectedSeq }}</strong>,
          застосовано до <strong>{{ currentSeq }}</strong>.
        </p>

        <!-- Spinner для waiting state -->
        <div
          v-if="state === 'waiting'"
          class="wb-finalize-barrier__spinner"
          aria-hidden="true"
          data-testid="wb-finalize-barrier-spinner"
        />
      </section>

      <footer
        v-if="state === 'timeout' || state === 'contention'"
        class="wb-finalize-barrier__footer"
      >
        <button
          type="button"
          class="wb-finalize-barrier__retry"
          :disabled="!canRetry"
          data-testid="wb-finalize-barrier-retry"
          @click="onRetryClick"
        >
          Спробувати ще раз
        </button>
        <p
          v-if="state === 'contention' && !canRetry && contentionRemainingMs > 0"
          class="wb-finalize-barrier__hint"
          data-testid="wb-finalize-barrier-contention-hint"
        >
          Інше завершення триває… доступно через {{ Math.ceil(contentionRemainingMs / 1000) }}с
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type BarrierModalState = 'closed' | 'waiting' | 'timeout' | 'contention'

const props = withDefaults(defineProps<{
  /** Current barrier state. 'closed' or null hides modal. */
  state: BarrierModalState | null
  /** From 504 payload (timeout state). */
  expectedSeq?: number | null
  /** From 504 payload (timeout state). */
  currentSeq?: number | null
  /** From 429 payload (contention state). Modal disables retry button until elapsed. */
  retryAfterMs?: number
}>(), {
  expectedSeq: null,
  currentSeq: null,
  retryAfterMs: 0,
})

const emit = defineEmits<{
  (e: 'retry'): void
}>()

const titleId = `wb-finalize-barrier-title-${Math.random().toString(36).slice(2, 9)}`

const visible = computed(() =>
  props.state === 'waiting' || props.state === 'timeout' || props.state === 'contention',
)

// ── Contention retry-after countdown ──────────────────────────────────
// 429 contention path disables the retry button for `retry_after_ms` so user
// can't spam — visual hint only. Server-side SETNX guard is the real gate.
const contentionDeadline = ref<number | null>(null)
const _now = ref<number>(Date.now())
let _tickHandle: ReturnType<typeof setInterval> | null = null

watch(
  () => [props.state, props.retryAfterMs] as const,
  ([newState, ms]) => {
    if (newState === 'contention' && ms > 0) {
      contentionDeadline.value = Date.now() + ms
      if (!_tickHandle) {
        _tickHandle = setInterval(() => {
          _now.value = Date.now()
          if (contentionDeadline.value != null && _now.value >= contentionDeadline.value) {
            // Re-enable button; стопнемо tick щоб не leak'ало.
            stopTick()
          }
        }, 250)
      }
    } else {
      contentionDeadline.value = null
      stopTick()
    }
  },
  { immediate: true },
)

function stopTick() {
  if (_tickHandle) {
    clearInterval(_tickHandle)
    _tickHandle = null
  }
}

onBeforeUnmount(stopTick)

const contentionRemainingMs = computed(() => {
  if (props.state !== 'contention' || contentionDeadline.value == null) return 0
  return Math.max(0, contentionDeadline.value - _now.value)
})

const canRetry = computed(() => {
  if (props.state === 'timeout') return true
  if (props.state === 'contention') return contentionRemainingMs.value <= 0
  return false
})

function onRetryClick() {
  if (!canRetry.value) return
  // Single emit — caller fires ONE new attempt. NO auto-emit, NO timer-driven
  // retry, NO re-emit on subsequent ticks (LAW §12, INV-22 §22.7).
  emit('retry')
}
</script>

<style scoped>
.wb-finalize-barrier__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-finalize-barrier {
  background: var(--surface, #fff);
  color: var(--text, #1a1a1a);
  border-radius: 12px;
  padding: 24px 28px;
  min-width: 320px;
  max-width: 480px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.wb-finalize-barrier__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.wb-finalize-barrier__body {
  margin: 16px 0;
}

.wb-finalize-barrier__message {
  margin: 0 0 12px 0;
  font-size: 15px;
  line-height: 1.4;
}

.wb-finalize-barrier__diagnostic {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-variant-numeric: tabular-nums;
}

.wb-finalize-barrier__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border, #e0e0e0);
  border-top-color: var(--primary, #2563eb);
  border-radius: 50%;
  animation: wb-finalize-barrier-spin 0.8s linear infinite;
  margin: 16px auto 0;
}

@keyframes wb-finalize-barrier-spin {
  to { transform: rotate(360deg); }
}

.wb-finalize-barrier__footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin-top: 16px;
}

.wb-finalize-barrier__retry {
  appearance: none;
  background: var(--primary, #2563eb);
  color: #fff;
  border: 0;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.wb-finalize-barrier__retry:disabled {
  background: var(--disabled, #9ca3af);
  cursor: not-allowed;
}

.wb-finalize-barrier__hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #666);
  text-align: center;
}
</style>
