<!--
  Confirmation modal for starting a NEW recording cycle after finalize.
  Backend архівує попередній active Replay, новий цикл починається з поточного
  стану дошки. UX cleanup: явно показуємо user-у що це не "continuation",
  а свідомий новий запис.
-->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="wb-rec-restart-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      @click.self="cancel"
      @keydown.escape="cancel"
    >
      <div
        ref="dialogRef"
        class="wb-rec-restart-dialog bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 relative"
        role="dialog"
        aria-modal="true"
        :aria-label="t('winterboard.recording.restartConfirm.title')"
        tabindex="-1"
      >
        <!-- Warning icon -->
        <div class="wb-rec-restart-dialog__icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="18" fill="#FEF3C7" />
            <path d="M18 11v8" stroke="#B45309" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="18" cy="24" r="1.3" fill="#B45309"/>
          </svg>
        </div>

        <h2 class="wb-rec-restart-dialog__title">
          {{ t('winterboard.recording.restartConfirm.title') }}
        </h2>

        <p class="wb-rec-restart-dialog__body">
          {{ t('winterboard.recording.restartConfirm.bodyArchive') }}
        </p>
        <p class="wb-rec-restart-dialog__body">
          {{ t('winterboard.recording.restartConfirm.bodyNew') }}
        </p>
        <p class="wb-rec-restart-dialog__hint">
          {{ t('winterboard.recording.restartConfirm.hint') }}
        </p>

        <div class="wb-rec-restart-dialog__actions">
          <button
            type="button"
            class="wb-rec-restart-dialog__btn wb-rec-restart-dialog__btn--ghost"
            :disabled="isLoading"
            @click="cancel"
          >
            {{ t('winterboard.recording.restartConfirm.cancel') }}
          </button>
          <button
            type="button"
            class="wb-rec-restart-dialog__btn wb-rec-restart-dialog__btn--primary"
            :disabled="isLoading"
            @click="confirm"
          >
            {{ isLoading
              ? t('winterboard.recording.restartConfirm.starting')
              : t('winterboard.recording.restartConfirm.confirm')
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), { isLoading: false })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const { t } = useI18n({ useScope: 'global' })
const dialogRef = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      nextTick(() => dialogRef.value?.focus())
    }
  },
)

function cancel(): void {
  if (props.isLoading) return
  emit('cancel')
  emit('update:modelValue', false)
}

function confirm(): void {
  if (props.isLoading) return
  emit('confirm')
}
</script>

<style scoped>
.wb-rec-restart-dialog__icon {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}

.wb-rec-restart-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
  margin: 0 0 12px 0;
}

.wb-rec-restart-dialog__body {
  font-size: 14px;
  color: #475569;
  text-align: center;
  margin: 0 0 6px 0;
  line-height: 1.5;
}

.wb-rec-restart-dialog__hint {
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  margin: 10px 0 0 0;
  line-height: 1.45;
}

.wb-rec-restart-dialog__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.wb-rec-restart-dialog__btn {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  border: 1px solid transparent;
}

.wb-rec-restart-dialog__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.wb-rec-restart-dialog__btn--ghost {
  background: transparent;
  color: #475569;
  border-color: #e2e8f0;
}
.wb-rec-restart-dialog__btn--ghost:hover:not(:disabled) {
  background: #f8fafc;
  color: #0f172a;
}

.wb-rec-restart-dialog__btn--primary {
  background: #b45309;
  color: white;
}
.wb-rec-restart-dialog__btn--primary:hover:not(:disabled) {
  background: #92400e;
}
</style>
