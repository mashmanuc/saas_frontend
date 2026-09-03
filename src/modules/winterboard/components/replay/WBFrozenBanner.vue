<!-- WBFrozenBanner (2026-09-03) — дошка з ФІНАЛІЗОВАНИМ записом.

     Борг із живого уроку власника: сервер відхиляє всі операції на такій
     дошці (INV-23 REPLAY_FROZEN_NO_WRITE), а фронтенд мовчав — учитель вів
     урок на дошці, де нічого не зберігалось. Тепер: постійний банер угорі
     (як DesyncRecoveryBanner), полотно read-only, одна дія — «Новий запис»
     (штатний re-record: попередній реплей архівується, дошка розморожується).
     SSOT §23.12 для цього коду прямо дозволяє «trigger re-record flow». -->
<template>
  <Transition name="wb-frozen-banner-slide">
    <div
      v-if="visible"
      class="wb-frozen-banner"
      role="status"
      aria-live="polite"
      :aria-label="t('winterboard.recording.frozenBanner.title')"
    >
      <div class="wb-frozen-banner__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div class="wb-frozen-banner__text">
        <span class="wb-frozen-banner__title">{{ t('winterboard.recording.frozenBanner.title') }}</span>
        <span class="wb-frozen-banner__hint">{{ t('winterboard.recording.frozenBanner.hint') }}</span>
      </div>
      <button
        v-if="canRestart"
        type="button"
        class="wb-frozen-banner__btn"
        :disabled="busy"
        @click="$emit('restart')"
      >
        {{ busy ? t('winterboard.recording.frozenBanner.busy') : t('winterboard.recording.frozenBanner.action') }}
      </button>
      <span v-else class="wb-frozen-banner__hint">{{ t('winterboard.recording.frozenBanner.readOnlyOnly') }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  visible: boolean
  /** Власник/учитель може перезапустити запис; учень — лише читає банер */
  canRestart: boolean
  busy?: boolean
}>()
defineEmits<{ (e: 'restart'): void }>()

const { t } = useI18n()
</script>

<style scoped>
.wb-frozen-banner {
  position: sticky; top: 0; z-index: 61;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  background: #fffbeb; border-bottom: 2px solid #f59e0b; color: #78350f;
  font-size: 14px;
}
.wb-frozen-banner__icon { flex: none; display: grid; place-items: center; }
.wb-frozen-banner__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.wb-frozen-banner__title { font-weight: 700; }
.wb-frozen-banner__hint { font-size: 13px; color: #92400e; }
.wb-frozen-banner__btn {
  flex: none; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer;
  background: #b45309; color: #fff; font-weight: 600; font-size: 14px; min-height: 40px;
}
.wb-frozen-banner__btn:disabled { opacity: .6; cursor: default; }
.wb-frozen-banner-slide-enter-active, .wb-frozen-banner-slide-leave-active { transition: transform .2s ease, opacity .2s ease; }
.wb-frozen-banner-slide-enter-from, .wb-frozen-banner-slide-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
