<template>
  <!-- Б-205 (власник 2026-10-16): попередити ПІД ЧАС письма, що дошка підходить до межі
       «Зберегти як урок», — щоб учитель не писав даремно. Лише підказка: дошку не блокує. -->
  <div
    class="wb-lesson-size"
    :class="`wb-lesson-size--${level}`"
    role="status"
    aria-live="polite"
    data-testid="lesson-size-strip"
  >
    <div class="wb-lesson-size__text">
      <span class="wb-lesson-size__title">
        {{ level === 'full' ? t('winterboard.lessonSize.fullTitle') : t('winterboard.lessonSize.warnTitle', { percent }) }}
      </span>
      <span class="wb-lesson-size__hint">
        {{ level === 'full' ? t('winterboard.lessonSize.fullHint') : t('winterboard.lessonSize.warnHint') }}
      </span>
    </div>
    <button type="button" class="wb-lesson-size__btn" data-testid="lesson-size-dismiss" @click="emit('dismiss')">
      {{ t('winterboard.lessonSize.dismiss') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ level: 'warn' | 'full'; percent: number }>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.wb-lesson-size {
  /* Як OpsPausedBanner: sticky, не overlay, полотно не блокує. */
  position: sticky;
  top: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  font-size: 14px;
  border-bottom: 1px solid #fde68a;
  background: #fef3c7;
  color: #92400e;
}

.wb-lesson-size--full {
  background: #fee2e2;
  border-bottom-color: #fecaca;
  color: #991b1b;
}

.wb-lesson-size__text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wb-lesson-size__title {
  font-weight: 600;
}

.wb-lesson-size__hint {
  font-size: 13px;
}

.wb-lesson-size__btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
</style>
