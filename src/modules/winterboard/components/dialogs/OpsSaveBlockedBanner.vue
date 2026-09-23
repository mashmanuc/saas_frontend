<!-- SAVE_BLOCKED (2026-09-23) — OpsSaveBlockedBanner
     SYSTEM_LAW §4–§5 «Остаточні відмови», P0 ТЗ чесного збереження.

     Сервер остаточно відмовив пакету або результат не підтверджено. Черга стоїть
     (ті самі op_id), нічого не відправляється автоматично. Банер:
       - каже простими словами, що сталося і скільки змін ще НЕ на сервері;
       - дає дії вчителя: «Перевірити й надіслати» (лише коли дозволено законом),
         «Завантажити копію», «Відкинути незбережені зміни» (з підтвердженням);
       - role="alert": помітно без DevTools, читається скрінрідером.
     Не показує вчителю коди на кшталт payload_schema_invalid, UUID чи JSON.
-->
<template>
  <div
    v-if="opsSync.isSaveBlocked && info"
    class="wb-save-blocked"
    role="alert"
    :aria-label="t('winterboard.errors.saveBlocked.bannerLabel')"
  >
    <div class="wb-save-blocked__icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="7" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12" y2="16.5" />
      </svg>
    </div>

    <div class="wb-save-blocked__text">
      <span class="wb-save-blocked__title">{{ title }}</span>
      <span class="wb-save-blocked__hint">{{ hint }}</span>
      <!-- Нечитабельний запис: «0 змін» було б неправдою — скільки там, невідомо. -->
      <span v-if="queuedCount > 0 || info.kind !== 'storage_unreadable'" class="wb-save-blocked__count">
        {{ t('winterboard.errors.saveBlocked.queued', { count: queuedCount }) }}<template v-if="strokeCount > 0"> · {{ t('winterboard.errors.saveBlocked.strokes', { count: strokeCount }) }}</template>
      </span>
      <span v-if="!info.storageOk" class="wb-save-blocked__warn">
        {{ t('winterboard.errors.saveBlocked.storageFailed') }}
      </span>
      <span v-else-if="opsSync.inputLocked" class="wb-save-blocked__warn">
        {{ t('winterboard.errors.saveBlocked.queueFull') }}
      </span>
      <span v-if="opsSync.droppedWhileBlocked > 0" class="wb-save-blocked__warn">
        {{ t('winterboard.errors.saveBlocked.dropped', { count: opsSync.droppedWhileBlocked }) }}
      </span>
      <span v-if="resultText" class="wb-save-blocked__result" aria-live="polite">{{ resultText }}</span>
    </div>

    <div class="wb-save-blocked__actions">
      <button
        v-if="showRetry"
        type="button"
        class="wb-save-blocked__btn wb-save-blocked__btn--primary"
        :disabled="opsSync.blockResolving || !opsSync.canRetryBlocked"
        @click="onRetry"
      >
        {{ opsSync.blockResolving ? t('winterboard.errors.saveBlocked.checking') : t('winterboard.errors.saveBlocked.retry') }}
      </button>
      <button type="button" class="wb-save-blocked__btn" :disabled="opsSync.blockResolving" @click="onExport">
        {{ t('winterboard.errors.saveBlocked.export') }}
      </button>
      <button type="button" class="wb-save-blocked__btn wb-save-blocked__btn--danger" :disabled="opsSync.blockResolving" @click="onDiscard">
        {{ t('winterboard.errors.saveBlocked.discard') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore, type OpsSyncOp } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

const info = computed(() => opsSync.saveBlock)
const resultText = ref('')

const queuedCount = computed(() => opsSync.pendingCount + opsSync.inFlightCount)

/**
 * Скільки окремих штрихів у черзі. Злитий `stroke_append` може нести кілька рухів
 * пера, тож рахуємо унікальні id штрихів, а не ops (ТЗ §7).
 */
const strokeCount = computed(() => {
  const ids = new Set<string>()
  for (const op of [...opsSync.inFlightOps, ...opsSync.pendingOps] as OpsSyncOp[]) {
    if (!op.op_type.startsWith('stroke_')) continue
    const p = op.payload as { stroke?: { id?: unknown }; stroke_id?: unknown; id?: unknown }
    const id = p?.stroke?.id ?? p?.stroke_id ?? p?.id
    if (typeof id === 'string' && id) ids.add(id)
  }
  return ids.size
})

/** Зрозуміла назва відхиленої дії — без сирого op_type. */
function actionLabel(opType: string | null): string {
  if (!opType) return t('winterboard.errors.saveBlocked.action.other')
  if (opType.startsWith('stroke_')) return t('winterboard.errors.saveBlocked.action.stroke')
  if (opType.startsWith('graph_')) return t('winterboard.errors.saveBlocked.action.graph')
  if (opType.startsWith('asset_')) return t('winterboard.errors.saveBlocked.action.object')
  if (opType.startsWith('page_')) return t('winterboard.errors.saveBlocked.action.page')
  return t('winterboard.errors.saveBlocked.action.other')
}

const title = computed(() => {
  const i = info.value
  if (!i) return ''
  if (i.kind === 'rejected') {
    return t('winterboard.errors.saveBlocked.title.rejected', { action: actionLabel(i.invalidOpType) })
  }
  if (i.kind === 'unconfirmed') return t('winterboard.errors.saveBlocked.title.unconfirmed')
  return t('winterboard.errors.saveBlocked.title.stopped')
})

const hint = computed(() => {
  const i = info.value
  if (!i) return ''
  return t(`winterboard.errors.saveBlocked.hint.${i.kind}`)
})

/** Кнопку показуємо лише там, де закон дозволяє одну спробу дією вчителя. */
const showRetry = computed(() => {
  const k = info.value?.kind
  return k === 'unconfirmed' || k === 'rate_limited' || (k === 'rejected' && opsSync.canRetryBlocked)
})

async function onRetry(): Promise<void> {
  resultText.value = ''
  if (info.value?.kind === 'rejected' &&
      !window.confirm(t('winterboard.errors.saveBlocked.confirmRetryRejected'))) return
  try {
    const r = await opsSync.retryBlocked()
    if (r === 'unproven') resultText.value = t('winterboard.errors.saveBlocked.result.unproven')
    else if (r === 'already-saved') resultText.value = t('winterboard.errors.saveBlocked.result.alreadySaved')
    else if (r === 'too-early') {
      const ms = (info.value?.retryNotBefore ?? Date.now()) - Date.now()
      resultText.value = t('winterboard.errors.saveBlocked.result.tooEarly', { seconds: Math.max(1, Math.ceil(ms / 1000)) })
    }
  } catch (err) {
    console.warn('[WB:SaveBlocked] retry failed:', err)
    resultText.value = t('winterboard.errors.saveBlocked.result.failed')
  }
}

function onExport(): void {
  const data = opsSync.exportBlocked()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `m4sh-unsaved-${opsSync.sessionId ?? 'board'}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function onDiscard(): Promise<void> {
  if (!window.confirm(t('winterboard.errors.saveBlocked.confirmDiscard', { count: queuedCount.value }))) return
  try {
    await opsSync.discardBlocked()
    // Полотно показує незбережене — беремо стан із сервера (явна дія вчителя, не
    // безумовний reload, LAW §12).
    window.location.reload()
  } catch (err) {
    console.warn('[WB:SaveBlocked] discard failed:', err)
    resultText.value = t('winterboard.errors.saveBlocked.result.failed')
  }
}
</script>

<style scoped>
.wb-save-blocked {
  position: sticky;
  top: 0;
  z-index: 9999;  /* як PAUSED/DESYNC банери, нижче ProtocolMismatchModal */
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  background: #fef2f2;  /* red-50 */
  border-bottom: 1px solid #fecaca;
  color: #7f1d1d;
  font-size: 14px;
  pointer-events: auto;
}
.wb-save-blocked__icon { flex-shrink: 0; display: flex; padding-top: 1px; }
.wb-save-blocked__text { flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wb-save-blocked__title { font-weight: 600; }
.wb-save-blocked__hint, .wb-save-blocked__count { font-size: 13px; color: #991b1b; }
.wb-save-blocked__warn { font-size: 13px; font-weight: 600; color: #b91c1c; }
.wb-save-blocked__result { font-size: 13px; color: #7f1d1d; }
.wb-save-blocked__actions { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }
.wb-save-blocked__btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #fff;
  color: #7f1d1d;
  border: 1px solid #fca5a5;
}
.wb-save-blocked__btn--primary { background: #dc2626; color: #fff; border-color: #dc2626; }
.wb-save-blocked__btn--danger { color: #b91c1c; }
.wb-save-blocked__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.wb-save-blocked__btn:focus-visible { outline: 2px solid #f87171; outline-offset: 2px; }
@media (max-width: 640px) {
  .wb-save-blocked { flex-wrap: wrap; }
  .wb-save-blocked__actions { width: 100%; }
}
</style>
