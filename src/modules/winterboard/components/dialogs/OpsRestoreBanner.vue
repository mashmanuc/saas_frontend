<!-- Б-28 (2026-09-24): дії, відновлені з копії на цьому комп'ютері.

     Поки йде звірка (запис звичайним шляхом → свіжий стан сервера → полотно),
     малювання стоїть і банер пояснює чому. Якщо звірка не вдалась — копію не знято,
     полотно не чіпали, і банер каже це прямо: жодного удаваного успіху. Одна дія —
     «Оновити сторінку» (явна дія вчителя, не автоматичний повтор — LAW §12).
     SAVE_BLOCKED / PAUSED мають власні банери — тут не дублюємо.
-->
<template>
  <div v-if="opsSync.restoring" class="wb-restore wb-restore--info" role="status" aria-live="polite">
    <span class="wb-restore__text">{{ t('winterboard.errors.restore.restoring') }}</span>
  </div>
  <div v-else-if="showProblem" class="wb-restore wb-restore--problem" role="alert">
    <span class="wb-restore__text">{{ t(`winterboard.errors.restore.problem.${opsSync.restoreProblem}`) }}</span>
    <button type="button" class="wb-restore__btn" @click="reload">
      {{ t('winterboard.errors.restore.reload') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

const showProblem = computed(() =>
  opsSync.restoreProblem !== null && !opsSync.isSaveBlocked && !opsSync.isPaused)

function reload(): void {
  window.location.reload()
}
</script>

<style scoped>
.wb-restore {
  position: sticky;
  top: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 16px;
  font-size: 13px;
}
.wb-restore--info { background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e3a8a; }
.wb-restore--problem { background: #fffbeb; border-bottom: 1px solid #fde68a; color: #78350f; font-weight: 600; }
.wb-restore__text { flex: 1 1 240px; min-width: 0; }
.wb-restore__btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #d97706;
  background: #d97706;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.wb-restore__btn:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
</style>
