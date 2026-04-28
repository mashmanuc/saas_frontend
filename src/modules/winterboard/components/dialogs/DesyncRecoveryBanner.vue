<!-- Phase 2 (2026-04-27) — DesyncRecoveryBanner
     Per `saas_docs/domains/winterboard/ops_sync/SYSTEM_LAW.md` §4 + INV-16.

     UX rules (per agent-A Section E directive):
       - NON-blocking — user може scroll/read/select. Не overlay, top-of-page banner.
       - Triggered коли opsSyncStore.mode === DESYNC AND reason !== 'protocol-version-mismatch'
         (бо protocol-version-mismatch → ProtocolMismatchModal, не banner)
       - Reasons handled here: 'seq-mismatch', '503 retries exhausted', other
       - Single Retry button — викликає opsSync.resync(sid) щоб return до SYNC
       - Status text відображає reason + auto-recovery state
       - INV-16 record() уже NO-OP'ить writes у store layer — banner лише signal user
-->
<template>
  <Transition name="wb-desync-banner-slide">
    <div
      v-if="isVisible"
      class="wb-desync-banner"
      role="status"
      aria-live="polite"
      :aria-label="t('winterboard.errors.desync.bannerLabel')"
    >
      <div class="wb-desync-banner__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <polyline points="21 3 21 8 16 8" />
        </svg>
      </div>

      <div class="wb-desync-banner__text">
        <span class="wb-desync-banner__title">
          {{ t('winterboard.errors.desync.title') }}
        </span>
        <span class="wb-desync-banner__hint">
          {{ statusText }}
        </span>
      </div>

      <button
        type="button"
        class="wb-desync-banner__btn"
        :disabled="isRecovering"
        @click="recover"
      >
        <span v-if="isRecovering">{{ t('winterboard.errors.desync.recovering') }}</span>
        <span v-else>{{ t('winterboard.errors.desync.retry') }}</span>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

/** Local state — recovery in-flight (resync API call). Local, NOT у store бо
 *  це UI optimistic flag. Якщо resync() throws — store mode лишається DESYNC
 *  + isRecovering returns to false → user може Retry знов. */
const isRecovering = ref(false)

/**
 * Visible коли DESYNC AND reason !== 'protocol-version-mismatch' (strict equality).
 * Protocol mismatch handled by ProtocolMismatchModal (full-screen blocking, full reload).
 * Banner — для recoverable conditions: seq-mismatch, cross-tab DESYNC, etc.
 *
 * Strict equality reasoning (per agent-A 2026-04-27): match canonical reason taxonomy
 * у opsSyncStore. Modal та banner = mutually exclusive (single reason → single UI gate).
 */
const PROTOCOL_MISMATCH_REASON = 'protocol-version-mismatch'

const isVisible = computed(() => {
  if (!opsSync.isDesync) return false
  return opsSync.desyncReason !== PROTOCOL_MISMATCH_REASON
})

/** Status text reflects reason. Strict prefix match за canonical taxonomy:
 *  - 'seq-mismatch (...)' — seq-mismatch family (вкл. expected_seq detail)
 *  - 'cross-tab DESYNC propagation' — INV-19 BroadcastChannel echo
 *  - default — generic recovery hint */
const statusText = computed(() => {
  const reason = opsSync.desyncReason ?? ''
  if (reason === 'seq-mismatch' || reason.startsWith('seq-mismatch (')) {
    return t('winterboard.errors.desync.reasonSeqMismatch')
  }
  if (reason === 'cross-tab DESYNC propagation') {
    return t('winterboard.errors.desync.reasonCrossTab')
  }
  return t('winterboard.errors.desync.reasonGeneric')
})

async function recover(): Promise<void> {
  const sid = opsSync.sessionId
  if (!sid) {
    // Should not happen — DESYNC implies bootstrap was done. Defensive log.
    console.warn('[DesyncBanner] recover() called without sessionId')
    return
  }
  if (isRecovering.value) return  // double-click guard
  isRecovering.value = true
  try {
    await opsSync.resync(sid)
    // Success — store mode → SYNC, isVisible flips to false (transition handles)
  } catch (e) {
    // Resync failed — store remains DESYNC, banner stays. Console for diagnostics.
    console.warn('[DesyncBanner] resync() failed (will allow retry):', e)
  } finally {
    isRecovering.value = false
  }
}
</script>

<style scoped>
.wb-desync-banner {
  /* Top-of-page non-blocking banner. NOT overlay — user може scroll past it. */
  position: sticky;
  top: 0;
  z-index: 9999;  /* above content, but BELOW ProtocolMismatchModal (z=99999) */
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #fef3c7;  /* amber-100 */
  border-bottom: 1px solid #fde68a;
  color: #92400e;  /* amber-900 */
  font-size: 14px;
  /* Pointer events scoped to banner only — does NOT block board scroll/select. */
  pointer-events: auto;
}

.wb-desync-banner__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.wb-desync-banner__text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wb-desync-banner__title {
  font-weight: 600;
}

.wb-desync-banner__hint {
  font-size: 13px;
  color: #b45309;  /* amber-800 — slightly muted */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-desync-banner__btn {
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

.wb-desync-banner__btn:hover:not(:disabled) { background: #b45309; }
.wb-desync-banner__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.wb-desync-banner__btn:focus-visible { outline: 2px solid #fcd34d; outline-offset: 2px; }

.wb-desync-banner-slide-enter-active,
.wb-desync-banner-slide-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}
.wb-desync-banner-slide-enter-from,
.wb-desync-banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
