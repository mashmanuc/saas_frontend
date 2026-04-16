<template>
  <div v-if="visible" class="wb-share-modal__backdrop" @click.self="$emit('close')">
    <div class="wb-share-modal" role="dialog" aria-modal="true" :aria-label="t('winterboard.replay.share.title')">
      <header class="wb-share-modal__header">
        <h3>{{ t('winterboard.replay.share.title') }}</h3>
        <button type="button" class="wb-share-modal__close" @click="$emit('close')" aria-label="Close">×</button>
      </header>

      <section class="wb-share-modal__body">
        <!-- Loading -->
        <div v-if="isBusy" class="wb-share-modal__loading">
          {{ statusMessage || t('winterboard.replay.share.creating') }}
        </div>

        <!-- No ops → cannot create replay -->
        <template v-else-if="noOpsError">
          <p class="wb-share-modal__hint wb-share-modal__hint--empty">
            {{ t('winterboard.replay.share.noOps') }}
          </p>
        </template>

        <!-- CTA: create replay from existing ops -->
        <template v-else-if="showCreateCta">
          <p class="wb-share-modal__cta-context">
            {{ t('winterboard.replay.share.noRecordingTitle') }}
          </p>
          <button type="button" class="wb-share-modal__cta" @click="createAndShare">
            {{ t('winterboard.replay.share.createAndShare') }}
          </button>
          <p class="wb-share-modal__cta-hint">
            {{ t('winterboard.replay.share.createHint') }}
          </p>
        </template>

        <!-- Main: visibility toggle + share link -->
        <template v-else-if="replay">
          <!-- Visibility segmented control -->
          <div class="wb-share-modal__visibility">
            <label class="wb-share-modal__label">
              {{ t('winterboard.replayList.menu.visibility') }}
            </label>
            <div class="wb-share-modal__visibility-group" role="radiogroup">
              <button
                v-for="opt in visibilityOptions"
                :key="opt.value"
                type="button"
                role="radio"
                class="wb-share-modal__visibility-btn"
                :class="{ 'wb-share-modal__visibility-btn--active': replay.visibility === opt.value }"
                :aria-checked="replay.visibility === opt.value"
                @click="changeVis(opt.value)"
              >
                <span class="wb-share-modal__visibility-label">{{ opt.label }}</span>
                <span class="wb-share-modal__visibility-hint">{{ opt.hint }}</span>
              </button>
            </div>
          </div>

          <!-- Link: tylko якщо unlisted або public -->
          <div v-if="replay.visibility !== 'private' && shareUrl" class="wb-share-modal__link">
            <label class="wb-share-modal__label">
              {{ t('winterboard.replay.share.link') }}
            </label>
            <div class="wb-share-modal__link-row">
              <input type="text" readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()" />
              <button type="button" class="wb-share-modal__copy" @click="copyLink">
                {{ copied ? t('winterboard.replay.share.copied') : t('winterboard.replay.share.copy') }}
              </button>
            </div>
            <button type="button" class="wb-share-modal__rotate" @click="onRotate">
              🔄 {{ t('winterboard.replay.share.rotate') }}
            </button>
          </div>

          <!-- Private hint -->
          <p v-if="replay.visibility === 'private'" class="wb-share-modal__hint">
            {{ t('winterboard.replay.share.privateHint') }}
          </p>
        </template>

        <p v-if="error" class="wb-share-modal__error">{{ error }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Replay Share Modal (Share Layer v1 — migrated до Replay content entity).
 *
 * Приймає:
 *   - replayId (NEW, preferred) — показує inline visibility toggle + link
 *   - sessionId (legacy) — якщо Replay ще не існує, пропонує створити з ops
 *
 * INV: НЕ створює replay автоматично. Тільки по explicit user click (CTA).
 */
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createReplayFromExistingOps } from '../../api/replay'
import {
  getReplay,
  changeReplayVisibility,
  rotateReplayToken,
  type Replay,
  type ReplayVisibility,
} from '../../api/replayLifecycleApi'

const props = defineProps<{
  visible: boolean
  /** Preferred: Replay entity id. */
  replayId?: string | null
  /** Legacy fallback: WBSession id → "create from ops" flow. */
  sessionId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** After create-from-ops: parent refreshes state (isReplayFrozen=true). */
  (e: 'replay-created', replayId: string): void
  /** After visibility change — parent store може оновити картку. */
  (e: 'replay-updated', replay: Replay): void
}>()

const { t } = useI18n({ useScope: 'global' })

const replay = ref<Replay | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)
const isBusy = ref(false)
const noOpsError = ref(false)
const showCreateCta = ref(false)
const statusMessage = ref<string | null>(null)

const shareUrl = computed(() => {
  if (!replay.value?.public_token) return ''
  return `${window.location.origin}/winterboard/public/${replay.value.public_token}`
})

const visibilityOptions = computed(() => [
  {
    value: 'private' as ReplayVisibility,
    label: t('winterboard.replayList.visibility.private'),
    hint: t('winterboard.replay.share.visibilityHints.private'),
  },
  {
    value: 'unlisted' as ReplayVisibility,
    label: t('winterboard.replayList.visibility.unlisted'),
    hint: t('winterboard.replay.share.visibilityHints.unlisted'),
  },
  {
    value: 'public' as ReplayVisibility,
    label: t('winterboard.replayList.visibility.public'),
    hint: t('winterboard.replay.share.visibilityHints.public'),
  },
])

// Reset and load when modal opens
watch(() => props.visible, async (v) => {
  if (!v) return
  error.value = null
  copied.value = false
  noOpsError.value = false
  showCreateCta.value = false
  statusMessage.value = null

  // Direct replayId → load from new API
  if (props.replayId) {
    await loadReplay(props.replayId)
    return
  }

  // Legacy: sessionId only → CTA (explicit click creates replay)
  if (props.sessionId) {
    showCreateCta.value = true
  }
})

async function loadReplay(id: string) {
  isBusy.value = true
  try {
    replay.value = await getReplay(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load replay'
  } finally {
    isBusy.value = false
  }
}

async function createAndShare() {
  if (!props.sessionId) return
  isBusy.value = true
  showCreateCta.value = false
  statusMessage.value = t('winterboard.replay.share.creatingReplay')
  try {
    const res = await createReplayFromExistingOps(props.sessionId)
    // Backend тепер повертає replay_id у response
    const newReplayId = (res as unknown as { replay_id?: string })?.replay_id
    if (newReplayId) {
      await loadReplay(newReplayId)
      emit('replay-created', newReplayId)
    } else {
      error.value = t('winterboard.replay.share.createFailed')
    }
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 422) {
      noOpsError.value = true
    } else {
      error.value = e instanceof Error ? e.message : 'Failed to create replay'
    }
  } finally {
    isBusy.value = false
    statusMessage.value = null
  }
}

async function changeVis(value: ReplayVisibility) {
  if (!replay.value || replay.value.visibility === value) return
  try {
    const updated = await changeReplayVisibility(replay.value.id, value)
    replay.value = updated
    emit('replay-updated', updated)
    // Auto-copy URL when switching до public/unlisted
    if (value !== 'private' && shareUrl.value) {
      copyLink()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to change visibility'
  }
}

async function copyLink() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    /* clipboard unavailable */
  }
}

async function onRotate() {
  if (!replay.value) return
  // eslint-disable-next-line no-alert
  const ok = window.confirm(t('winterboard.replay.share.rotateConfirm'))
  if (!ok) return
  error.value = null
  try {
    const updated = await rotateReplayToken(replay.value.id)
    replay.value = updated
    emit('replay-updated', updated)
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
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.wb-share-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.wb-share-modal__header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }
.wb-share-modal__close {
  background: transparent; border: none; font-size: 24px; cursor: pointer;
  color: var(--text-secondary, #64748b); line-height: 1;
}
.wb-share-modal__body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.wb-share-modal__label {
  font-size: 11px; font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase; letter-spacing: 0.06em;
  display: block; margin-bottom: 8px;
}
.wb-share-modal__hint {
  margin: 0; font-size: 13px; color: var(--text-secondary);
  line-height: 1.45;
}
.wb-share-modal__hint--empty { text-align: center; padding: 16px 0; }
.wb-share-modal__loading {
  text-align: center; padding: 24px 0;
  font-size: 13px; color: var(--text-secondary);
}

/* CTA for legacy create-from-ops flow */
.wb-share-modal__cta-context {
  margin: 0; padding: 8px 0 4px;
  font-size: 14px; font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}
.wb-share-modal__cta {
  width: 100%; padding: 12px 20px;
  background: var(--accent); color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 600;
  transition: background 0.15s;
}
.wb-share-modal__cta:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
}
.wb-share-modal__cta-hint {
  margin: 0;
  font-size: 12px; color: var(--text-secondary);
  text-align: center;
}

/* Visibility segmented control */
.wb-share-modal__visibility-group {
  display: flex; flex-direction: column; gap: 6px;
}
.wb-share-modal__visibility-btn {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; text-align: left;
  background: transparent;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.wb-share-modal__visibility-btn:hover {
  background: var(--bg-secondary);
}
.wb-share-modal__visibility-btn--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.wb-share-modal__visibility-label {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
}
.wb-share-modal__visibility-btn--active .wb-share-modal__visibility-label::before {
  content: '✓ '; color: var(--accent);
}
.wb-share-modal__visibility-hint {
  font-size: 12px; color: var(--text-secondary);
}

/* Link row */
.wb-share-modal__link { display: flex; flex-direction: column; gap: 6px; }
.wb-share-modal__link-row { display: flex; gap: 6px; }
.wb-share-modal__link-row input {
  flex: 1; padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px; font-size: 12px; font-family: monospace;
  color: var(--text-primary);
  background: var(--card-bg);
}
.wb-share-modal__copy {
  padding: 8px 14px;
  background: var(--accent); color: white;
  border: none; border-radius: 6px; cursor: pointer;
  font-size: 12px; font-weight: 600;
  white-space: nowrap;
}
.wb-share-modal__copy:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
}
.wb-share-modal__rotate {
  margin-top: 4px; padding: 6px 0;
  background: transparent; border: none;
  color: var(--text-secondary);
  font-size: 12px; cursor: pointer;
  text-align: left;
  align-self: flex-start;
}
.wb-share-modal__rotate:hover { color: var(--text-primary); }

.wb-share-modal__error {
  color: var(--color-error, #dc2626);
  font-size: 12px; margin: 0;
}
</style>
