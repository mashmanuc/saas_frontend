<template>
  <div class="wb-rec-empty" role="status" aria-live="polite">
    <div class="wb-rec-empty__text">
      <strong class="wb-rec-empty__title">{{ t('winterboard.replay.recordingEmpty') }}</strong>
      <span class="wb-rec-empty__hint">{{ t('winterboard.replay.recordingEmptyHint') }}</span>
    </div>
    <button
      type="button"
      class="wb-rec-empty__close"
      :aria-label="t('common.close')"
      @click="$emit('dismiss')"
    >×</button>
  </div>
</template>

<script setup lang="ts">
/**
 * «Запис не збережено» під кнопкою запису (рішення власника 2026-10-07: «роби порожній
 * запис не зберігати»). Якщо між «Записати урок» і «Завершити запис» на дошці нічого не
 * змінилось, сервер Replay не створює (`recording_empty` у відповіді finalize) — і віконця
 * «Запис готовий!» немає. Спільне для соло (WBRecordingBanner) і класу
 * (WBClassroomRecordingControls); батько має `position: relative`.
 */
import { useI18n } from 'vue-i18n'

defineEmits<{ dismiss: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.wb-rec-empty {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: max-content;
  max-width: min(320px, calc(100vw - 32px));
  padding: 10px 12px;
  background: var(--color-surface-elevated, #fff);
  color: var(--color-text, #1f2937);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 24px var(--shadow-strong, rgba(0, 0, 0, 0.15));
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  white-space: normal;
}

.wb-rec-empty__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-rec-empty__title {
  font-weight: 600;
}

.wb-rec-empty__hint {
  color: var(--color-text-secondary, #4b5563);
}

.wb-rec-empty__close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted, #6b7280);
  font-size: 1.125rem;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
}

.wb-rec-empty__close:hover {
  color: var(--color-text, #1f2937);
}
</style>
