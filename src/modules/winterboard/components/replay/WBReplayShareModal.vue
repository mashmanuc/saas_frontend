<template>
  <div v-if="visible" class="wb-share-modal__backdrop" @click.self="$emit('close')">
    <div class="wb-share-modal" role="dialog" aria-modal="true" :aria-label="t('winterboard.replay.share.title', 'Поділитися записом')">
      <header class="wb-share-modal__header">
        <h3>{{ t('winterboard.replay.share.title', 'Поділитися записом уроку') }}</h3>
        <button type="button" class="wb-share-modal__close" @click="$emit('close')" aria-label="Close">×</button>
      </header>

      <section class="wb-share-modal__body">
        <!-- Loading state -->
        <div v-if="isCreating" class="wb-share-modal__loading">
          {{ statusMessage || t('winterboard.replay.share.creating', 'Створюємо посилання…') }}
        </div>

        <!-- No ops at all -->
        <template v-else-if="noOpsError">
          <p class="wb-share-modal__hint wb-share-modal__hint--empty">
            {{ t('winterboard.replay.share.noOps', 'На дошці ще немає дій для створення запису.') }}
          </p>
        </template>

        <!-- CTA: no recording exists but ops available — context → then action -->
        <template v-else-if="showCreateCta">
          <p class="wb-share-modal__cta-context">
            {{ t('winterboard.replay.share.noRecordingTitle', 'Урок вже проведено без запису') }}
          </p>
          <button type="button" class="wb-share-modal__cta" @click="createAndShare">
            {{ t('winterboard.replay.share.createAndShare', 'Створити запис уроку') }}
          </button>
          <p class="wb-share-modal__cta-hint">
            {{ t('winterboard.replay.share.createHint', 'Запис буде створено з того, що вже є на дошці') }}
          </p>
        </template>

        <!-- Share link (main content) -->
        <template v-else-if="shareUrl">
          <p class="wb-share-modal__hint">
            {{ t('winterboard.replay.share.linkHint', 'Будь-хто з цим посиланням може переглянути запис уроку.') }}
          </p>

          <div class="wb-share-modal__link">
            <label>{{ t('winterboard.replay.share.link', 'Посилання') }}</label>
            <div class="wb-share-modal__link-row">
              <input type="text" readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()" />
              <button type="button" @click="copyLink">
                {{ copied ? t('winterboard.replay.share.copied', 'Скопійовано') : t('winterboard.replay.share.copy', 'Копіювати') }}
              </button>
            </div>
            <button type="button" class="wb-share-modal__rotate" @click="onRotate">
              {{ t('winterboard.replay.share.rotate', 'Оновити посилання') }}
            </button>
          </div>
        </template>

        <p v-if="error" class="wb-share-modal__error">{{ error }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Simplified Replay Share Modal.
 *
 * Flow:
 * 1. hasRecording=true → auto-create share link, show URL
 * 2. hasRecording=false, ops exist → show CTA "Створити запис і поділитися"
 * 3. No ops → show "немає дій"
 *
 * INV: NO auto side-effects. Replay creation only on explicit user click.
 */
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createReplayShareLink,
  createReplayFromExistingOps,
  rotateReplayShareToken,
} from '../../api/replay'

const props = defineProps<{
  visible: boolean
  sessionId: string
  /** Pre-existing share token — skip link creation */
  initialToken?: string | null
  /** Recording already exists (is_replay_frozen or isManualRecording) */
  hasRecording?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** Emitted after replay created from ops — parent should update isReplayFrozen */
  (e: 'replay-created'): void
}>()

const { t } = useI18n({ useScope: 'global' })

const token = ref<string | null>(props.initialToken ?? null)
const error = ref<string | null>(null)
const copied = ref(false)
const isCreating = ref(false)
const noOpsError = ref(false)
const showCreateCta = ref(false)
const statusMessage = ref<string | null>(null)

const shareUrl = computed(() => {
  if (!token.value) return ''
  return `${window.location.origin}/winterboard/public/${token.value}`
})

// On modal open — determine what to show
watch(() => props.visible, async (v) => {
  if (!v) return
  error.value = null
  copied.value = false
  noOpsError.value = false
  showCreateCta.value = false
  statusMessage.value = null

  // Pre-existing token — just show it
  if (props.initialToken) {
    token.value = props.initialToken
    return
  }

  // Recording exists — create share link
  if (props.hasRecording) {
    await ensureShareLink()
    return
  }

  // No recording — show CTA (user must explicitly click)
  showCreateCta.value = true
})

/** CTA click: create replay from ops → then create share link */
async function createAndShare(): Promise<void> {
  isCreating.value = true
  showCreateCta.value = false
  try {
    // Step 1: Create replay from existing ops
    statusMessage.value = t('winterboard.replay.share.creatingReplay', 'Створюємо запис з усіх операцій…')
    try {
      await createReplayFromExistingOps(props.sessionId)
      emit('replay-created')
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 422) {
        noOpsError.value = true
        return
      }
      if (status !== 409) throw e // 409 = already exists, proceed
    }

    // Step 2: Create share link
    await ensureShareLink()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create replay'
  } finally {
    isCreating.value = false
    statusMessage.value = null
  }
}

async function ensureShareLink(): Promise<void> {
  if (token.value) return
  isCreating.value = true
  statusMessage.value = t('winterboard.replay.share.creating', 'Створюємо посилання…')
  try {
    const res = await createReplayShareLink(props.sessionId)
    token.value = res.share_token
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create share link'
  } finally {
    isCreating.value = false
    statusMessage.value = null
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    /* ignore */
  }
}

async function onRotate(): Promise<void> {
  error.value = null
  try {
    const res = await rotateReplayShareToken(props.sessionId)
    token.value = res.share_token
    copied.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to rotate token'
  }
}
</script>

<style scoped>
.wb-share-modal__backdrop {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1200;
}
.wb-share-modal {
  width: 480px; max-width: calc(100vw - 32px);
  background: var(--color-surface, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.wb-share-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--color-border, #e2e8f0);
}
.wb-share-modal__header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.wb-share-modal__close {
  background: transparent; border: none; font-size: 24px; cursor: pointer;
  color: var(--color-text-muted, #64748b); line-height: 1;
}
.wb-share-modal__body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.wb-share-modal__hint { margin: 0 0 4px; font-size: 13px; color: var(--color-text-muted, #64748b); }
.wb-share-modal__hint--empty { text-align: center; padding: 16px 0; }
.wb-share-modal__loading {
  text-align: center; padding: 16px 0;
  font-size: 13px; color: var(--color-text-muted, #64748b);
}
.wb-share-modal__cta-context {
  margin: 0; padding: 8px 0 4px;
  font-size: 14px; font-weight: 600;
  color: var(--color-text, #0f172a);
  text-align: center;
}
.wb-share-modal__cta {
  width: 100%; padding: 12px 20px;
  background: var(--color-primary, #2563eb); color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 600;
  transition: background 0.15s;
}
.wb-share-modal__cta:hover {
  background: var(--color-primary-hover, #1d4ed8);
}
.wb-share-modal__cta-hint {
  margin: 0;
  font-size: 12px; color: var(--color-text-muted, #94a3b8);
  text-align: center;
}
.wb-share-modal__link { display: flex; flex-direction: column; gap: 6px; }
.wb-share-modal__link label { font-size: 12px; font-weight: 600; color: var(--color-text-muted, #64748b); }
.wb-share-modal__link-row { display: flex; gap: 6px; }
.wb-share-modal__link-row input {
  flex: 1; padding: 8px 10px; border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px; font-size: 12px; font-family: monospace;
}
.wb-share-modal__link-row button {
  padding: 8px 14px; background: var(--color-primary, #2563eb); color: white;
  border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
  white-space: nowrap;
}
.wb-share-modal__rotate {
  margin-top: 4px; padding: 6px 0; background: transparent;
  border: none; color: var(--color-text-muted, #64748b);
  font-size: 12px; cursor: pointer; text-align: left; text-decoration: underline;
}
.wb-share-modal__error { color: #dc2626; font-size: 12px; margin: 0; }
</style>
