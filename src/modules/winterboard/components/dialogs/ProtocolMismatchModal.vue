<!-- Phase 2 (2026-04-27) — ProtocolMismatchModal
     Per `saas_docs/domains/winterboard/ops_sync/SYSTEM_LAW.md` §10 + INV-20.

     UX rules (per agent-A Section E directive):
       - Non-dismissable (no Esc, no overlay click — single Reload button only)
       - Modal BLOCKS writes only — board still readable beneath
       - INV-16 record() уже dropping ops at store layer; modal — UI signal only
       - НЕ disable input handlers (записи silent-drop у store)
       - NO "Cancel" / "Try again" buttons (per LAW §10 — single user gate)
       - Wire: watch(opsSyncStore.isDesync && reason==='protocol-version-mismatch')
         → toggle visibility. NOT direct API detection.
-->
<template>
  <Teleport to="body">
    <Transition name="wb-protocol-modal-fade">
      <div
        v-if="isVisible"
        class="wb-protocol-modal__overlay"
        role="presentation"
      >
        <div
          ref="dialogRef"
          class="wb-protocol-modal__dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
        >
          <!-- Update icon -->
          <div class="wb-protocol-modal__icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
          </div>

          <h2 :id="titleId" class="wb-protocol-modal__title">
            {{ t('winterboard.errors.protocolMismatch.title') }}
          </h2>

          <p :id="bodyId" class="wb-protocol-modal__body">
            {{ t('winterboard.errors.protocolMismatch.body') }}
          </p>

          <button
            ref="reloadBtnRef"
            type="button"
            class="wb-protocol-modal__btn"
            @click="reload"
          >
            {{ t('winterboard.errors.protocolMismatch.reload') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const opsSync = useOpsSyncStore()

const dialogRef = ref<HTMLElement | null>(null)
const reloadBtnRef = ref<HTMLButtonElement | null>(null)

const titleId = `wb-protocol-mismatch-title-${Math.random().toString(36).slice(2, 8)}`
const bodyId = `wb-protocol-mismatch-body-${Math.random().toString(36).slice(2, 8)}`

/**
 * Wire: store mode === DESYNC AND reason === 'protocol-version-mismatch' (strict).
 * Per agent-A directive (2026-04-27): strict equality, NOT startsWith().
 *
 * Strict equality reasoning:
 *   - opsSyncStore emits canonical reason string `'protocol-version-mismatch'` для INV-20
 *   - startsWith() leaks future-tagged variants ('protocol-version-mismatch-foo') into modal
 *     unintentionally — strict equality enforces explicit reason taxonomy
 *   - Якщо нова reason додається — пройде через DesyncRecoveryBanner (non-blocking)
 *     unless explicitly listed тут
 *
 * isDesync alone не достатньо — DESYNC може бути також з SEQ_MISMATCH (handled
 * by DesyncRecoveryBanner — non-blocking auto-resync). PROTOCOL_VERSION_MISMATCH
 * → user MUST reload (LAW §10).
 */
const PROTOCOL_MISMATCH_REASON = 'protocol-version-mismatch'

const isVisible = computed(() => {
  if (!opsSync.isDesync) return false
  return opsSync.desyncReason === PROTOCOL_MISMATCH_REASON
})

// Auto-focus reload button on appear (a11y — keyboard users can immediately Enter)
watch(isVisible, async (visible) => {
  if (visible) {
    await nextTick()
    reloadBtnRef.value?.focus()
  }
})

function reload(): void {
  // Per LAW §10: hard reload (NO router.push). Bust SW cache + force fresh JS bundle.
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}
</script>

<style scoped>
.wb-protocol-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;  /* above ALL — including drawing canvas, lock dialog, etc. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  /* Modal blocks WRITES (record() уже NO-OP), AЛЕ user може scroll/read board
     під overlay. Pointer events НЕ disable globally — лише захоплюємо клік на overlay
     (НЕ closing modal — single Reload gate). */
  pointer-events: auto;
}

.wb-protocol-modal__dialog {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  padding: 32px;
  max-width: 440px;
  width: 90%;
  text-align: center;
}

.wb-protocol-modal__icon {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.wb-protocol-modal__title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 12px;
}

.wb-protocol-modal__body {
  font-size: 15px;
  color: #475569;
  line-height: 1.6;
  margin: 0 0 24px;
}

.wb-protocol-modal__btn {
  display: inline-block;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  background: #2563eb;
  color: #ffffff;
  border: none;
  transition: background 120ms ease;
}

.wb-protocol-modal__btn:hover { background: #1d4ed8; }
.wb-protocol-modal__btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }

.wb-protocol-modal-fade-enter-active,
.wb-protocol-modal-fade-leave-active {
  transition: opacity 200ms ease;
}
.wb-protocol-modal-fade-enter-from,
.wb-protocol-modal-fade-leave-to {
  opacity: 0;
}
</style>
