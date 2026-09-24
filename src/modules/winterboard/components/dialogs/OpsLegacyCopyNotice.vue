<!-- Старі локальні копії незбережених дій (2026-09-24, рев'ю P0).

     До 2026-09-24 копії черги писалися без власника (`wb_ops_backup_{дошка}`,
     частина `wb_ops_blocked_v1_*`). Приписати їх акаунту автоматично не можна —
     на спільному браузері вони могли належати іншій людині, тож нова версія їх НЕ
     відновлює і не надсилає. Щоб вони не стали невидимими, кімната показує їх
     ЛИШЕ ВЛАСНИКОВІ ДОШКИ: якби ці дії зберіглися, вони стали б частиною його
     дошки — він не бачить нічого понад своє. Доступ до дошки (учень, спільний
     перегляд) права читати чужі локальні дії не дає — іншим не показуємо й не
     стираємо (рев'ю P0, 2026-09-24). «Завантажити» / «Прибрати» (з підтвердженням).
-->
<template>
  <div v-if="visible" class="wb-legacy-copy" role="status">
    <span class="wb-legacy-copy__text">{{ t('winterboard.errors.legacyCopy.text') }}</span>
    <div class="wb-legacy-copy__actions">
      <button type="button" class="wb-legacy-copy__btn" @click="onExport">
        {{ t('winterboard.errors.legacyCopy.export') }}
      </button>
      <button type="button" class="wb-legacy-copy__btn" @click="onDismiss">
        {{ t('winterboard.errors.legacyCopy.dismiss') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { useWBStore } from '../../board/state/boardStore'
import { useAuthStore } from '@/modules/auth/store/authStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()
const board = useWBStore()
const auth = useAuthStore()

/** Лише власник дошки; невідомий власник чи користувач → не показуємо. */
const visible = computed(() => {
  const me = auth.user?.id
  return opsSync.legacyCopies.length > 0 && me !== undefined && me !== null &&
    !!board.ownerId && String(board.ownerId) === String(me)
})

function onExport(): void {
  const data = opsSync.exportLegacyCopies()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `m4sh-old-unsaved-${opsSync.sessionId ?? 'board'}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function onDismiss(): void {
  if (!window.confirm(t('winterboard.errors.legacyCopy.confirmDismiss'))) return
  opsSync.dismissLegacyCopies()
}
</script>

<style scoped>
.wb-legacy-copy {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 16px;
  background: #eff6ff;
  border-bottom: 1px solid #bfdbfe;
  color: #1e3a8a;
  font-size: 13px;
}
.wb-legacy-copy__text { flex: 1 1 240px; min-width: 0; }
.wb-legacy-copy__actions { display: flex; gap: 8px; flex-shrink: 0; }
.wb-legacy-copy__btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #93c5fd;
  background: #fff;
  color: #1e3a8a;
  font-size: 13px;
  cursor: pointer;
}
.wb-legacy-copy__btn:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
</style>
