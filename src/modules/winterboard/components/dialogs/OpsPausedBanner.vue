<!-- TLV2-G1b (2026-09-16) — OpsPausedBanner
     SYSTEM_LAW §5 / OPS_SYNC_SSOT INV-12: видимий стан PAUSED (сервер 503 після
     первинної спроби і двох повторів).

     UX:
       - НЕ блокує дошку: учитель далі малює, дії стають у чергу з тими самими op_id.
       - Показує, скільки дій чекають на відправку, і що спроба йде сама раз на 30 с.
       - Одна дія — «Повторити зараз» → opsSync.retryNow(): одна спроба, без паралельних
         запитів (поки спроба в мережі, кнопка неактивна).
       - Зникає, щойно store виходить із PAUSED (успіх, DESYNC, скидання).
-->
<template>
  <Transition name="wb-paused-banner-slide">
    <div
      v-if="opsSync.isPaused"
      class="wb-paused-banner"
      role="status"
      aria-live="polite"
      :aria-label="t('winterboard.errors.paused.bannerLabel')"
    >
      <div class="wb-paused-banner__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="10" y1="9" x2="10" y2="15" />
          <line x1="14" y1="9" x2="14" y2="15" />
        </svg>
      </div>

      <div class="wb-paused-banner__text">
        <span class="wb-paused-banner__title">
          {{ t('winterboard.errors.paused.title') }}
        </span>
        <span class="wb-paused-banner__hint">
          {{ t('winterboard.errors.paused.hint', { count: queuedCount, seconds: autoRetrySeconds }) }}
        </span>
      </div>

      <button
        type="button"
        class="wb-paused-banner__btn"
        :disabled="opsSync.probeInFlight"
        @click="opsSync.retryNow()"
      >
        <span v-if="opsSync.probeInFlight">{{ t('winterboard.errors.paused.retrying') }}</span>
        <span v-else>{{ t('winterboard.errors.paused.retry') }}</span>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

const queuedCount = computed(() => opsSync.pendingCount + opsSync.inFlightCount)
const autoRetrySeconds = Math.round(opsSync.PAUSE_AUTO_RETRY_MS / 1000)
</script>

<style scoped>
.wb-paused-banner {
  /* Як DesyncRecoveryBanner: sticky, не overlay, не блокує полотно. */
  position: sticky;
  top: 0;
  z-index: 9999;  /* нижче ProtocolMismatchModal (z=99999) */
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #fef3c7;  /* amber-100 */
  border-bottom: 1px solid #fde68a;
  color: #92400e;  /* amber-900 */
  font-size: 14px;
  pointer-events: auto;
}

.wb-paused-banner__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.wb-paused-banner__text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wb-paused-banner__title {
  font-weight: 600;
}

.wb-paused-banner__hint {
  font-size: 13px;
  color: #b45309;  /* amber-800 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-paused-banner__btn {
  flex-shrink: 0;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #d97706;  /* amber-600 */
  color: #ffffff;
  border: none;
  transition: background 120ms ease;
}

.wb-paused-banner__btn:hover:not(:disabled) { background: #b45309; }
.wb-paused-banner__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.wb-paused-banner__btn:focus-visible { outline: 2px solid #fcd34d; outline-offset: 2px; }

.wb-paused-banner-slide-enter-active,
.wb-paused-banner-slide-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}
.wb-paused-banner-slide-enter-from,
.wb-paused-banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
