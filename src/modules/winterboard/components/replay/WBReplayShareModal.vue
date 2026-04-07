<template>
  <div v-if="visible" class="wb-share-modal__backdrop" @click.self="$emit('close')">
    <div class="wb-share-modal" role="dialog" aria-modal="true" :aria-label="t('winterboard.replay.share.title', 'Поділитися записом')">
      <header class="wb-share-modal__header">
        <h3>{{ t('winterboard.replay.share.title', 'Поділитися записом уроку') }}</h3>
        <button type="button" class="wb-share-modal__close" @click="$emit('close')" aria-label="Close">×</button>
      </header>

      <section class="wb-share-modal__body">
        <p class="wb-share-modal__hint">
          {{ t('winterboard.replay.share.hint', 'Оберіть, хто може переглядати запис цього уроку.') }}
        </p>

        <label v-for="opt in options" :key="opt.value" class="wb-share-modal__option" :class="{ active: visibility === opt.value }">
          <input type="radio" :value="opt.value" v-model="visibility" @change="onVisibilityChange" />
          <div class="wb-share-modal__opt-body">
            <strong>{{ opt.label }}</strong>
            <span>{{ opt.desc }}</span>
          </div>
        </label>

        <div v-if="visibility !== 'private' && shareUrl" class="wb-share-modal__link">
          <label>{{ t('winterboard.replay.share.link', 'Посилання') }}</label>
          <div class="wb-share-modal__link-row">
            <input type="text" readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()" />
            <button type="button" @click="copyLink">
              {{ copied ? t('winterboard.replay.share.copied', 'Скопійовано') : t('winterboard.replay.share.copy', 'Копіювати') }}
            </button>
          </div>
          <button type="button" class="wb-share-modal__rotate" @click="onRotate">
            {{ t('winterboard.replay.share.rotate', 'Згенерувати нове посилання (зробити старе недійсним)') }}
          </button>
        </div>

        <p v-if="error" class="wb-share-modal__error">{{ error }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// B.3: Visibility / Share link UX для викладача.
// Зв'язаний з Phase B backend (replay/visibility, share-link, rotate-token).
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  updateReplayVisibility,
  createReplayShareLink,
  rotateReplayShareToken,
  type ReplayVisibility,
} from '../../api/replay'

const props = defineProps<{
  visible: boolean
  sessionId: string
  initialVisibility?: ReplayVisibility
  initialToken?: string | null
}>()

defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n({ useScope: 'global' })

const visibility = ref<ReplayVisibility>(props.initialVisibility || 'private')
const token = ref<string | null>(props.initialToken ?? null)
const error = ref<string | null>(null)
const copied = ref(false)

watch(() => props.visible, (v) => {
  if (v) {
    visibility.value = props.initialVisibility || 'private'
    token.value = props.initialToken ?? null
    error.value = null
    copied.value = false
  }
})

const options = computed(() => [
  {
    value: 'private' as ReplayVisibility,
    label: t('winterboard.replay.share.private', 'Приватний'),
    desc: t('winterboard.replay.share.privateDesc', 'Бачите лише ви.'),
  },
  {
    value: 'link' as ReplayVisibility,
    label: t('winterboard.replay.share.link_mode', 'За посиланням'),
    desc: t('winterboard.replay.share.linkDesc', 'Будь-хто з посиланням може переглянути.'),
  },
  {
    value: 'public' as ReplayVisibility,
    label: t('winterboard.replay.share.public', 'Публічний'),
    desc: t('winterboard.replay.share.publicDesc', 'Доступно всім, індексується пошуковиками.'),
  },
])

const shareUrl = computed(() => {
  if (!token.value) return ''
  return `${window.location.origin}/replay/share/${token.value}/`
})

async function onVisibilityChange(): Promise<void> {
  error.value = null
  try {
    const res = await updateReplayVisibility(props.sessionId, visibility.value)
    token.value = res.share_token
    if (visibility.value !== 'private' && !token.value) {
      // Fallback — просимо backend створити токен
      const link = await createReplayShareLink(props.sessionId)
      token.value = link.share_token
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update visibility'
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
.wb-share-modal__option {
  display: flex; gap: 10px; padding: 10px 12px;
  border: 1px solid var(--color-border, #e2e8f0); border-radius: 8px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.wb-share-modal__option:hover { background: var(--color-surface-alt, #f8fafc); }
.wb-share-modal__option.active { border-color: var(--color-primary, #2563eb); background: var(--color-info-bg, #dbeafe); }
.wb-share-modal__opt-body { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.wb-share-modal__opt-body strong { color: var(--color-text, #0f172a); }
.wb-share-modal__opt-body span { color: var(--color-text-muted, #64748b); }
.wb-share-modal__link { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.wb-share-modal__link label { font-size: 12px; font-weight: 600; color: var(--color-text-muted, #64748b); }
.wb-share-modal__link-row { display: flex; gap: 6px; }
.wb-share-modal__link-row input {
  flex: 1; padding: 8px 10px; border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px; font-size: 12px; font-family: monospace;
}
.wb-share-modal__link-row button {
  padding: 8px 14px; background: var(--color-primary, #2563eb); color: white;
  border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
}
.wb-share-modal__rotate {
  margin-top: 4px; padding: 6px 0; background: transparent;
  border: none; color: var(--color-text-muted, #64748b);
  font-size: 12px; cursor: pointer; text-align: left; text-decoration: underline;
}
.wb-share-modal__error { color: #dc2626; font-size: 12px; margin: 0; }
</style>
