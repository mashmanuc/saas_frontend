<!-- Власник 2026-09-28 («так»): щойно пульт підключився, ноутбук пропонує один дотик — «⛶ Повний
     екран для уроку» (та сама дія, що ⛶ у шапці) або F11. Тоді «⛶ На весь екран» з пульта розгортає
     відео на весь монітор. Смуга як OpsPausedBanner: зверху, не блокує дошку. -->
<template>
  <div class="wb-fs-prompt" role="status" aria-live="polite" data-testid="lesson-fullscreen-prompt">
    <span class="wb-fs-prompt__icon" aria-hidden="true">📱</span>
    <div class="wb-fs-prompt__text">
      <span class="wb-fs-prompt__title">{{ t('winterboard.remote.fullscreenPrompt.title') }}</span>
      <span class="wb-fs-prompt__hint">{{ t('winterboard.remote.fullscreenPrompt.hint') }}</span>
    </div>
    <button type="button" class="wb-fs-prompt__btn" data-testid="lesson-fullscreen-enter" @click="emit('enter')">
      ⛶ {{ t('winterboard.remote.fullscreenPrompt.enter') }}
    </button>
    <button
      type="button"
      class="wb-fs-prompt__close"
      data-testid="lesson-fullscreen-dismiss"
      :aria-label="t('winterboard.remote.fullscreenPrompt.close')"
      :title="t('winterboard.remote.fullscreenPrompt.close')"
      @click="emit('dismiss')"
    >&#x2715;</button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ enter: []; dismiss: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.wb-fs-prompt {
  /* Як OpsPausedBanner: sticky зверху, не overlay, дошку не блокує. */
  position: sticky;
  top: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #ecfdf5; /* emerald-50 */
  border-bottom: 1px solid #a7f3d0;
  color: #065f46; /* emerald-800 */
  font-size: 14px;
}
.wb-fs-prompt__icon { flex-shrink: 0; font-size: 18px; }
.wb-fs-prompt__text { flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wb-fs-prompt__title { font-weight: 600; }
.wb-fs-prompt__hint { font-size: 13px; color: #047857; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-fs-prompt__btn {
  flex-shrink: 0;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: #047857; /* emerald-700, як шапка дошки */
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wb-fs-prompt__btn:hover { background: #065f46; }
.wb-fs-prompt__close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #047857;
  font-size: 16px;
  cursor: pointer;
}
.wb-fs-prompt__close:hover { background: #d1fae5; }
</style>
