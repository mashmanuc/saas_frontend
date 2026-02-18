<!-- WB: Share dialog — generate/copy/revoke share links
     Ref: TASK_BOARD.md B4.2 -->
<template>
  <Teleport to="body">
    <Transition name="wb-dialog-fade">
      <div v-if="isOpen" class="wb-share-overlay" @click.self="emit('close')">
        <div class="wb-share-dialog" role="dialog" aria-modal="true" :aria-label="t('winterboard.share.title')" @keydown.escape="emit('close')">
          <!-- Header -->
          <div class="wb-share-dialog__header">
            <h2 class="wb-share-dialog__title">{{ t('winterboard.share.title') }}</h2>
            <button type="button" class="wb-share-dialog__close" :aria-label="t('winterboard.share.close')" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <p class="wb-share-dialog__desc">{{ t('winterboard.share.description') }}</p>

          <!-- Loading -->
          <div v-if="loadingStatus" class="wb-share-dialog__loading">
            <div class="wb-share-dialog__spinner" />
          </div>

          <!-- Active share link -->
          <template v-else-if="shareStatus?.is_shared && shareStatus?.url">
            <!-- Status badge -->
            <div class="wb-share-dialog__status-row">
              <span class="wb-share-badge" :class="`wb-share-badge--${computedLinkStatus}`">
                {{ t(`winterboard.share.status.${computedLinkStatus}`) }}
              </span>
              <span v-if="shareStatus.view_count != null" class="wb-share-dialog__views">
                {{ t('winterboard.sessionCard.viewCount', { count: shareStatus.view_count }) }}
              </span>
            </div>

            <!-- Link + Copy -->
            <div class="wb-share-dialog__link-row">
              <input
                ref="linkInput"
                type="text"
                class="wb-share-dialog__link-input"
                :value="shareStatus.url"
                readonly
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button type="button" class="wb-share-dialog__copy-btn" @click="copyLink">
                {{ copied ? t('winterboard.share.copied') : t('winterboard.share.copy') }}
              </button>
            </div>

            <!-- Revoke -->
            <div class="wb-share-dialog__revoke-section">
              <button
                v-if="!confirmingRevoke"
                type="button"
                class="wb-share-dialog__revoke-btn"
                @click="confirmingRevoke = true"
              >
                {{ t('winterboard.share.revoke') }}
              </button>
              <template v-else>
                <p class="wb-share-dialog__revoke-warn">{{ t('winterboard.share.revokeConfirm') }}</p>
                <div class="wb-share-dialog__revoke-actions">
                  <button type="button" class="wb-share-dialog__btn wb-share-dialog__btn--cancel" @click="confirmingRevoke = false">
                    {{ t('winterboard.sessions.confirmDelete.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="wb-share-dialog__btn wb-share-dialog__btn--danger"
                    :disabled="revoking"
                    @click="handleRevoke"
                  >
                    {{ revoking ? '…' : t('winterboard.share.revoke') }}
                  </button>
                </div>
              </template>
            </div>
          </template>

          <!-- No active share — generate form -->
          <template v-else>
            <!-- Options -->
            <div class="wb-share-dialog__options">
              <h3 class="wb-share-dialog__options-title">{{ t('winterboard.share.options') }}</h3>

              <!-- Expires -->
              <label class="wb-share-dialog__label">
                {{ t('winterboard.share.expires') }}
                <select v-model="expiresOption" class="wb-share-dialog__select">
                  <option value="1h">{{ t('winterboard.share.expiresOptions.1h') }}</option>
                  <option value="24h">{{ t('winterboard.share.expiresOptions.24h') }}</option>
                  <option value="7d">{{ t('winterboard.share.expiresOptions.7d') }}</option>
                  <option value="never">{{ t('winterboard.share.expiresOptions.never') }}</option>
                </select>
              </label>

              <!-- Max views -->
              <label class="wb-share-dialog__label">
                {{ t('winterboard.share.maxViews') }}
                <select v-model="maxViewsOption" class="wb-share-dialog__select">
                  <option value="10">{{ t('winterboard.share.maxViewsOptions.10') }}</option>
                  <option value="100">{{ t('winterboard.share.maxViewsOptions.100') }}</option>
                  <option value="unlimited">{{ t('winterboard.share.maxViewsOptions.unlimited') }}</option>
                </select>
              </label>

              <!-- Allow download -->
              <label class="wb-share-dialog__toggle-label">
                <input v-model="allowDownload" type="checkbox" class="wb-share-dialog__checkbox" />
                {{ t('winterboard.share.allowDownload') }}
              </label>
            </div>

            <!-- Generate button -->
            <button
              type="button"
              class="wb-share-dialog__generate-btn"
              :disabled="generating"
              @click="handleGenerate"
            >
              {{ generating ? '…' : t('winterboard.share.generateLink') }}
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// WB: WBShareDialog — share link management
// Ref: TASK_BOARD.md B4.2
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { winterboardApi, type WBShareStatus } from '../../api/winterboardApi'
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  sessionId: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  shared: []
}>()

const { t } = useI18n()
const { showToast } = useToast()

// ── State ─────────────────────────────────────────────────────────────────
const shareStatus = ref<WBShareStatus | null>(null)
const loadingStatus = ref(true)
const generating = ref(false)
const revoking = ref(false)
const copied = ref(false)
const confirmingRevoke = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

// ── Options ───────────────────────────────────────────────────────────────
const expiresOption = ref<'1h' | '24h' | '7d' | 'never'>('7d')
const maxViewsOption = ref<'10' | '100' | 'unlimited'>('unlimited')
const allowDownload = ref(true)

// ── Computed ──────────────────────────────────────────────────────────────
const computedLinkStatus = computed<'active' | 'expired' | 'revoked'>(() => {
  if (!shareStatus.value) return 'active'
  if (!shareStatus.value.is_valid) return 'expired'
  return 'active'
})

// ── Fetch current share status ────────────────────────────────────────────
async function fetchShareStatus(): Promise<void> {
  loadingStatus.value = true
  try {
    shareStatus.value = await winterboardApi.getShareStatus(props.sessionId)
  } catch {
    shareStatus.value = null
  } finally {
    loadingStatus.value = false
  }
}

// ── Generate share link ───────────────────────────────────────────────────
function resolveExpiresDays(): number | undefined {
  switch (expiresOption.value) {
    case '1h': return 0 // backend interprets 0 as ~1 hour or we pass fractional
    case '24h': return 1
    case '7d': return 7
    case 'never': return undefined
  }
}

async function handleGenerate(): Promise<void> {
  generating.value = true
  try {
    const opts: { expires_in_days?: number; max_views?: number; allow_download?: boolean } = {
      allow_download: allowDownload.value,
    }
    const days = resolveExpiresDays()
    if (days !== undefined) opts.expires_in_days = days
    if (maxViewsOption.value !== 'unlimited') opts.max_views = Number(maxViewsOption.value)

    shareStatus.value = await winterboardApi.createShare(props.sessionId, opts)
    emit('shared')
  } catch (err) {
    console.error('[WB:ShareDialog] Generate failed', err)
    showToast(t('winterboard.share.generateError'), 'error')
  } finally {
    generating.value = false
  }
}

// ── Copy link ─────────────────────────────────────────────────────────────
async function copyLink(): Promise<void> {
  if (!shareStatus.value?.url) return
  try {
    await navigator.clipboard.writeText(shareStatus.value.url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    showToast(t('winterboard.share.copyError'), 'error')
  }
}

// ── Revoke ────────────────────────────────────────────────────────────────
async function handleRevoke(): Promise<void> {
  revoking.value = true
  try {
    await winterboardApi.revokeShare(props.sessionId)
    shareStatus.value = null
    confirmingRevoke.value = false
    showToast(t('winterboard.share.revoked'), 'success')
  } catch (err) {
    console.error('[WB:ShareDialog] Revoke failed', err)
    showToast(t('winterboard.share.revokeError'), 'error')
  } finally {
    revoking.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  fetchShareStatus()
})
</script>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────── */
.wb-share-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-share-dialog {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

/* ── Header ──────────────────────────────────────────────────────────── */
.wb-share-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.wb-share-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-share-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s;
}

.wb-share-dialog__close:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-share-dialog__desc {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 20px;
}

/* ── Loading ─────────────────────────────────────────────────────────── */
.wb-share-dialog__loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.wb-share-dialog__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--wb-toolbar-border, #e2e8f0);
  border-top-color: var(--wb-brand, #0066FF);
  border-radius: 50%;
  animation: wb-spin 0.6s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

/* ── Status badge ────────────────────────────────────────────────────── */
.wb-share-dialog__status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.wb-share-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wb-share-badge--active {
  background: #dcfce7;
  color: #16a34a;
}

.wb-share-badge--expired {
  background: #fef3c7;
  color: #d97706;
}

.wb-share-badge--revoked {
  background: #fee2e2;
  color: #dc2626;
}

.wb-share-dialog__views {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Link row ────────────────────────────────────────────────────────── */
.wb-share-dialog__link-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.wb-share-dialog__link-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-canvas-bg, #f8fafc);
  outline: none;
}

.wb-share-dialog__link-input:focus {
  border-color: var(--wb-brand, #0066FF);
}

.wb-share-dialog__copy-btn {
  padding: 8px 16px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  min-width: 72px;
}

.wb-share-dialog__copy-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Revoke ───────────────────────────────────────────────────────────── */
.wb-share-dialog__revoke-section {
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  padding-top: 12px;
}

.wb-share-dialog__revoke-btn {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}

.wb-share-dialog__revoke-btn:hover {
  text-decoration: underline;
}

.wb-share-dialog__revoke-warn {
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0 0 12px;
  line-height: 1.4;
}

.wb-share-dialog__revoke-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ── Options ──────────────────────────────────────────────────────────── */
.wb-share-dialog__options {
  margin-bottom: 16px;
}

.wb-share-dialog__options-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 12px;
}

.wb-share-dialog__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  margin-bottom: 10px;
}

.wb-share-dialog__select {
  padding: 6px 10px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  background: #ffffff;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
  min-width: 140px;
}

.wb-share-dialog__toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
  margin-bottom: 8px;
}

.wb-share-dialog__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--wb-brand, #0066FF);
  cursor: pointer;
}

/* ── Generate button ─────────────────────────────────────────────────── */
.wb-share-dialog__generate-btn {
  display: block;
  width: 100%;
  padding: 10px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-share-dialog__generate-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-share-dialog__generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Shared button styles ────────────────────────────────────────────── */
.wb-share-dialog__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.wb-share-dialog__btn--cancel {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-share-dialog__btn--cancel:hover {
  background: #e2e8f0;
}

.wb-share-dialog__btn--danger {
  background: #ef4444;
  color: #ffffff;
}

.wb-share-dialog__btn--danger:hover {
  background: #dc2626;
}

.wb-share-dialog__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Dialog transition ───────────────────────────────────────────────── */
.wb-dialog-fade-enter-active,
.wb-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* B5.2: Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-share-dialog__close,
  .wb-share-dialog__copy-btn,
  .wb-share-dialog__revoke-btn,
  .wb-share-dialog__generate-btn,
  .wb-share-dialog__spinner {
    transition: none;
    animation: none;
  }

  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
