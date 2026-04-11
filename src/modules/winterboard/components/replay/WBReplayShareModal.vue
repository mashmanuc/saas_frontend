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
          {{ t('winterboard.replay.share.creating', 'Створюємо посилання…') }}
        </div>

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
 * INV: 1 replay → 0 or 1 active share token.
 * Opening modal auto-creates link if none exists.
 * No visibility selection — link access is the only mode.
 * Publishing to catalog is a separate action (not here).
 */
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createReplayShareLink,
  rotateReplayShareToken,
} from '../../api/replay'

const props = defineProps<{
  visible: boolean
  sessionId: string
  /** Pre-existing token (from session data) — skip creation if present */
  initialToken?: string | null
}>()

defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n({ useScope: 'global' })

const token = ref<string | null>(props.initialToken ?? null)
const error = ref<string | null>(null)
const copied = ref(false)
const isCreating = ref(false)

const shareUrl = computed(() => {
  if (!token.value) return ''
  return `${window.location.origin}/winterboard/public/${token.value}`
})

// Auto-create share link when modal opens (if no token yet)
watch(() => props.visible, async (v) => {
  if (!v) return
  error.value = null
  copied.value = false

  // Pre-existing token — just show it
  if (props.initialToken) {
    token.value = props.initialToken
    return
  }

  // No token — create one
  if (!token.value) {
    isCreating.value = true
    try {
      const res = await createReplayShareLink(props.sessionId)
      token.value = res.share_token
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create share link'
    } finally {
      isCreating.value = false
    }
  }
})

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
.wb-share-modal__loading {
  text-align: center; padding: 16px 0;
  font-size: 13px; color: var(--color-text-muted, #64748b);
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
