<template>
  <!-- Б-202: власнику дошки на телефоні вертикально (логіка показу — board/phoneBoardHint.ts).
       Лише вигляд на цьому пристрої: дошку, операції й стан не чіпає.
       Прохід «очима вчителя» 19.10: вікно обіцяло пульт і не відкривало його — тепер перша кнопка
       «Відкрити пульт» (той самий вхід /remote, що й QR «Підключити телефон»). -->
  <Teleport to="body">
    <div class="wb-phone-hint__overlay" role="dialog" aria-modal="true" aria-labelledby="wb-phone-hint-title"
         data-testid="phone-board-hint">
      <div class="wb-phone-hint">
        <div class="wb-phone-hint__icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="3" y="6" width="26" height="18" rx="2" stroke="currentColor" stroke-width="2" />
            <path d="M11 30h10M16 24v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <rect x="27" y="14" width="10" height="20" rx="2" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <h2 id="wb-phone-hint-title" class="wb-phone-hint__title">{{ t('winterboard.phoneHint.title') }}</h2>
        <p class="wb-phone-hint__body">{{ t('winterboard.phoneHint.body') }}</p>
        <div class="wb-phone-hint__actions">
          <button type="button" class="wb-phone-hint__btn wb-phone-hint__btn--primary"
                  data-testid="phone-board-hint-remote" @click="emit('open-remote')">
            {{ t('winterboard.phoneHint.openRemote') }}
          </button>
          <button type="button" class="wb-phone-hint__btn wb-phone-hint__btn--quiet"
                  data-testid="phone-board-hint-understood" @click="emit('understood')">
            {{ t('winterboard.phoneHint.understood') }}
          </button>
          <button type="button" class="wb-phone-hint__btn wb-phone-hint__btn--quiet"
                  data-testid="phone-board-hint-open" @click="emit('open-anyway')">
            {{ t('winterboard.phoneHint.openAnyway') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits<{ 'open-remote': []; understood: []; 'open-anyway': [] }>()
</script>

<style scoped>
.wb-phone-hint__overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.wb-phone-hint {
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 24px 20px 20px;
  width: min(100%, 360px);
  max-height: 100%;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}


.wb-phone-hint__icon {
  color: var(--accent, #059669);
  margin-bottom: 8px;
}

.wb-phone-hint__title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
}

.wb-phone-hint__body {
  margin: 0 0 20px;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--text-secondary, #475569);
}

.wb-phone-hint__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-phone-hint__btn {
  min-height: 44px;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
}

.wb-phone-hint__btn--primary {
  border: 0;
  background: var(--accent, #059669);
  color: var(--accent-contrast, #ffffff);
}

.wb-phone-hint__btn--quiet {
  border: 1px solid var(--border-color, #e2e8f0);
  background: transparent;
  color: var(--text-secondary, #475569);
}

/* Телефон горизонтально (власник 2026-10-21): екран 375–430 px заввишки — вікно ширше, без значка,
   кнопки в один ряд, щоб «Все одно відкрити дошку» не опинилась за нижнім краєм. */
@media (max-height: 480px) {
  .wb-phone-hint {
    width: min(100%, 600px);
    padding: 14px 18px;
  }
  .wb-phone-hint__icon {
    display: none;
  }
  .wb-phone-hint__body {
    margin-bottom: 12px;
  }
  .wb-phone-hint__actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .wb-phone-hint__btn {
    flex: 1 1 150px;
  }
}
</style>
