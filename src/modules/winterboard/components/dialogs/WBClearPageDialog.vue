<!-- WB: Clear page confirmation dialog
     Ref: TASK_BOARD_V5.md B8
     a11y: alertdialog role, aria-modal, auto-focus confirm button
     Shows locked items count that will be preserved -->
<template>
  <Teleport to="body">
    <Transition name="wb-dialog-fade">
      <div
        v-if="visible"
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
          :aria-label="t('winterboard.clear.title')"
        >
          <!-- Warning icon -->
          <div class="wb-dialog__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86l-8.6 14.86A2 2 0 0 0 3.4 22h17.2a2 2 0 0 0 1.71-3.28l-8.6-14.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          <h3 class="wb-dialog__title">
            {{ t('winterboard.clear.title') }}
          </h3>

          <p class="wb-dialog__message">
            {{ t('winterboard.clear.message') }}
          </p>

          <!-- Locked items note -->
          <p v-if="lockedCount > 0" class="wb-dialog__note">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="6" width="10" height="7" rx="1" />
              <path d="M4 6V4a3 3 0 0 1 6 0v2" />
            </svg>
            {{ t('winterboard.clear.locked_note', { n: lockedCount }) }}
          </p>

          <div class="wb-dialog__actions">
            <button
              type="button"
              class="wb-dialog__btn wb-dialog__btn--secondary"
              @click="cancel"
            >
              {{ t('winterboard.clear.cancel') }}
            </button>
            <button
              ref="confirmBtnRef"
              type="button"
              class="wb-dialog__btn wb-dialog__btn--danger"
              @click="confirm"
            >
              {{ t('winterboard.clear.confirm') }}
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

const { t } = useI18n()

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  lockedCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  lockedCount: 0,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

// Focus confirm button when dialog opens
watch(() => props.visible, async (visible) => {
  if (visible) {
    await nextTick()
    confirmBtnRef.value?.focus()
  }
})

function confirm(): void {
  emit('confirm')
}

function cancel(): void {
  emit('cancel')
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
  margin: 0 0 12px;
  line-height: 1.5;
}

.wb-dialog__note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: #f59e0b;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 0 0 16px;
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

.wb-dialog__btn--secondary {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}

.wb-dialog__btn--secondary:hover {
  background: #e2e8f0;
}

.wb-dialog__btn--danger {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

.wb-dialog__btn--danger:hover {
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

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-dialog__btn,
  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
