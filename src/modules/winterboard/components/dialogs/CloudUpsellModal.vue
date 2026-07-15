<template>
  <!-- Local Workspace (ТЗ 2026-07-15 §4): єдиний «елегантний» модал для всіх
       хмарних дій у local-режимі. Кнопки share/invite/export/медіа видимі,
       але клік веде сюди — конверсійний гачок, НЕ заглушка «недоступно». -->
  <Teleport to="body">
    <Transition name="cloud-upsell-fade">
      <div
        v-if="open"
        class="cloud-upsell__backdrop"
        @pointerdown.self="$emit('close')"
      >
        <div class="cloud-upsell__dialog" role="dialog" aria-modal="true" :aria-label="t('winterboard.localWorkspace.upsell.title')">
          <div class="cloud-upsell__icon" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M7 18a4.5 4.5 0 01-.4-8.98 6 6 0 0111.3 1.6A3.5 3.5 0 0117 17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 12v7M9.5 14.5L12 12l2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="cloud-upsell__title">{{ t('winterboard.localWorkspace.upsell.title') }}</h2>
          <p class="cloud-upsell__message">{{ message }}</p>
          <p class="cloud-upsell__note">{{ t('winterboard.localWorkspace.upsell.note') }}</p>
          <div class="cloud-upsell__actions">
            <button type="button" class="cloud-upsell__btn cloud-upsell__btn--primary" @click="$emit('connect')">
              {{ t('winterboard.localWorkspace.upsell.cta') }}
            </button>
            <button type="button" class="cloud-upsell__btn cloud-upsell__btn--ghost" @click="$emit('close')">
              {{ t('winterboard.localWorkspace.upsell.later') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  open: boolean
  /** Готовий локалізований текст пояснення (варіант обирає caller). */
  message: string
}>()

defineEmits<{
  close: []
  connect: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.cloud-upsell__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  padding: 16px;
}

.cloud-upsell__dialog {
  width: min(420px, 100%);
  background: #ffffff;
  border-radius: 16px;
  padding: 28px 24px 24px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.cloud-upsell__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #e7f6ee;
  color: #1db954;
  margin-bottom: 14px;
}

.cloud-upsell__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.cloud-upsell__message {
  margin: 0 0 6px;
  font-size: 15px;
  line-height: 1.45;
  color: #334155;
}

.cloud-upsell__note {
  margin: 0 0 20px;
  font-size: 13px;
  color: #64748b;
}

.cloud-upsell__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cloud-upsell__btn {
  width: 100%;
  padding: 11px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, color 0.15s;
}

.cloud-upsell__btn--primary {
  background: #1db954;
  color: #ffffff;
}

.cloud-upsell__btn--primary:hover {
  background: #17a34a;
}

.cloud-upsell__btn--ghost {
  background: transparent;
  color: #64748b;
}

.cloud-upsell__btn--ghost:hover {
  color: #0f172a;
}

.cloud-upsell-fade-enter-active,
.cloud-upsell-fade-leave-active {
  transition: opacity 0.18s ease;
}

.cloud-upsell-fade-enter-from,
.cloud-upsell-fade-leave-to {
  opacity: 0;
}
</style>
