<!-- WB: End session / complete lesson confirmation dialog
     Замінює нативний window.confirm() у WBClassroomRoom.handleEndSession.
     Патерн повторює WBClearPageDialog (a11y) + isLoading із
     WBRecordingRestartConfirmModal (async endSession REST call).
     a11y: alertdialog role, aria-modal, focus-trap на confirm, Esc-cancel.
     Це суто presentational — НЕ торкається ops/seq/state (LAW §12 OK). -->
<template>
  <Teleport to="body">
    <Transition name="wb-dialog-fade">
      <div
        v-if="modelValue"
        class="wb-dialog-overlay"
        role="presentation"
        @click.self="cancel"
        @keydown.escape="cancel"
      >
        <div
          ref="dialogRef"
          class="wb-dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-label="t('winterboard.classroom.endSessionTitle')"
          tabindex="-1"
        >
          <!-- Warning icon -->
          <div class="wb-dialog__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86l-8.6 14.86A2 2 0 0 0 3.4 22h17.2a2 2 0 0 0 1.71-3.28l-8.6-14.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          <h3 class="wb-dialog__title">
            {{ t('winterboard.classroom.endSessionTitle') }}
          </h3>

          <p class="wb-dialog__message">
            {{ t('winterboard.classroom.endSessionConfirm') }}
          </p>

          <div class="wb-dialog__actions">
            <button
              type="button"
              class="wb-dialog__btn wb-dialog__btn--secondary"
              :disabled="isLoading"
              @click="cancel"
            >
              {{ t('winterboard.classroom.endSessionCancel') }}
            </button>
            <button
              ref="confirmBtnRef"
              type="button"
              class="wb-dialog__btn wb-dialog__btn--danger"
              :disabled="isLoading"
              @click="confirm"
            >
              {{ isLoading
                ? t('winterboard.classroom.endSessionEnding')
                : t('winterboard.classroom.endSessionConfirmBtn')
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  modelValue: boolean
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  isLoading: false,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

// Focus confirm button when dialog opens
watch(() => props.modelValue, async (open) => {
  if (open) {
    await nextTick()
    confirmBtnRef.value?.focus()
  }
})

function confirm(): void {
  if (props.isLoading) return
  emit('confirm')
}

function cancel(): void {
  if (props.isLoading) return
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.wb-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.wb-dialog {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 24px;
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.wb-dialog__icon {
  margin-bottom: 12px;
}

.wb-dialog__title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px;
}

.wb-dialog__message {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 16px;
  line-height: 1.5;
}

.wb-dialog__actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.wb-dialog__btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.wb-dialog__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.wb-dialog__btn--secondary {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}

.wb-dialog__btn--secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.wb-dialog__btn--danger {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

.wb-dialog__btn--danger:hover:not(:disabled) {
  background: #b91c1c;
}

.wb-dialog__btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Fade transition */
.wb-dialog-fade-enter-active {
  transition: opacity 0.15s ease;
}
.wb-dialog-fade-leave-active {
  transition: opacity 0.1s ease;
}
.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* Mobile: bottom-sheet dialog */
@media (max-width: 768px) {
  .wb-dialog-overlay {
    align-items: flex-end;
  }

  .wb-dialog {
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    padding: 20px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
  }

  .wb-dialog__btn {
    min-height: 44px;
    padding: 10px 20px;
    font-size: 15px;
  }

  .wb-dialog__actions {
    flex-direction: column-reverse;
    gap: 8px;
  }
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-dialog__btn,
  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
