<!-- Дошку не підключено до збереження (2026-09-24, рев'ю P0).

     Якщо при відкритті дошки не вдалося отримати її стан із сервера, store лишається
     в BOOTSTRAP і record() відкидає кожну дію. Раніше це було видно лише в консолі:
     учитель малював, а нічого не зберігалось. Тепер — постійний банер, малювання
     заблоковано (opsSync.inputLocked), одна дія: «Оновити сторінку» (явна дія
     вчителя, не автоматичний повтор — LAW §12).
-->
<template>
  <div v-if="opsSync.bootstrapFailed" class="wb-boot-failed" role="alert">
    <span class="wb-boot-failed__text">{{ t('winterboard.errors.bootstrapFailed.text') }}</span>
    <button type="button" class="wb-boot-failed__btn" @click="reload">
      {{ t('winterboard.errors.bootstrapFailed.reload') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

function reload(): void {
  window.location.reload()
}
</script>

<style scoped>
.wb-boot-failed {
  position: sticky;
  top: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 16px;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #7f1d1d;
  font-size: 14px;
}
.wb-boot-failed__text { flex: 1 1 240px; min-width: 0; font-weight: 600; }
.wb-boot-failed__btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.wb-boot-failed__btn:focus-visible { outline: 2px solid #f87171; outline-offset: 2px; }
</style>
