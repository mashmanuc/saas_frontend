<template>
  <div v-if="visible" class="wb-rec-done" role="status" :aria-label="t('winterboard.replay.recordingDone')">
    <header class="wb-rec-done__header">
      <span class="wb-rec-done__icon">✅</span>
      <div class="wb-rec-done__title-wrap">
        <strong class="wb-rec-done__title">{{ t('winterboard.replay.recordingDone') }}</strong>
        <span class="wb-rec-done__subtitle">{{ t('winterboard.replay.recordingDoneHint') }}</span>
      </div>
      <button
        type="button"
        class="wb-rec-done__close"
        :aria-label="t('common.close')"
        @click="$emit('dismiss')"
      >×</button>
    </header>

    <!-- Visibility segmented control (inline, без окремої модалки) -->
    <div v-if="currentReplay" class="wb-rec-done__vis">
      <button
        v-for="opt in visibilityOptions"
        :key="opt.value"
        type="button"
        class="wb-rec-done__vis-btn"
        :class="{ 'wb-rec-done__vis-btn--active': currentReplay.visibility === opt.value }"
        :aria-pressed="currentReplay.visibility === opt.value"
        :title="opt.hint"
        @click="onVisibilityChange(opt.value)"
      >
        <span class="wb-rec-done__vis-icon">{{ opt.icon }}</span>
        <span class="wb-rec-done__vis-label">{{ opt.label }}</span>
      </button>
    </div>

    <!-- Copy link — показати якщо не private -->
    <div v-if="shareUrl && currentReplay?.visibility !== 'private'" class="wb-rec-done__link">
      <input type="text" readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()" />
      <button
        type="button"
        class="wb-rec-done__copy"
        :class="{ 'wb-rec-done__copy--done': copied }"
        @click="copyLink"
      >
        {{ copied ? t('winterboard.replay.share.copied') : t('winterboard.replay.share.copy') }}
      </button>
    </div>

    <footer class="wb-rec-done__footer">
      <router-link :to="{ name: 'winterboard-replays' }" class="wb-rec-done__list-link">
        {{ t('winterboard.replay.goToList') }} →
      </router-link>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Post-record proactive share prompt (Share Layer S.2).
 *
 * Відмінно від modal: показується inline як toast/banner з visibility toggle
 * + auto-copy при виборі unlisted/public. Тьютор не змушений відкривати
 * окрему модалку щоб поділитися записом одразу після stop_recording.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getReplay,
  changeReplayVisibility,
  type Replay,
  type ReplayVisibility,
} from '../../api/replayLifecycleApi'

const props = defineProps<{
  visible: boolean
  replayId: string | null
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'replay-updated', replay: Replay): void
}>()

const { t } = useI18n({ useScope: 'global' })

const currentReplay = ref<Replay | null>(null)
const copied = ref(false)

const shareUrl = computed(() => {
  if (!currentReplay.value?.public_token) return ''
  return `${window.location.origin}/winterboard/public/${currentReplay.value.public_token}`
})

const visibilityOptions = computed<Array<{
  value: ReplayVisibility
  label: string
  hint: string
  icon: string
}>>(() => [
  {
    value: 'private',
    label: t('winterboard.replayList.visibility.private'),
    hint: t('winterboard.replay.share.visibilityHints.private'),
    icon: '🔒',
  },
  {
    value: 'unlisted',
    label: t('winterboard.replayList.visibility.unlisted'),
    hint: t('winterboard.replay.share.visibilityHints.unlisted'),
    icon: '🔗',
  },
  {
    value: 'public',
    label: t('winterboard.replayList.visibility.public'),
    hint: t('winterboard.replay.share.visibilityHints.public'),
    icon: '🌐',
  },
])

watch(() => [props.visible, props.replayId] as const, async ([v, id]) => {
  if (!v || !id) return
  try {
    currentReplay.value = await getReplay(id)
  } catch (err) {
    console.warn('[WBRecordingDonePrompt] failed to load replay', err)
    currentReplay.value = null
  }
}, { immediate: true })

async function onVisibilityChange(value: ReplayVisibility) {
  if (!currentReplay.value || currentReplay.value.visibility === value) return
  try {
    const updated = await changeReplayVisibility(currentReplay.value.id, value)
    currentReplay.value = updated
    emit('replay-updated', updated)
    // Auto-copy URL коли юзер вибирає shareable mode
    if (value !== 'private' && shareUrl.value) {
      await copyLink()
    }
  } catch (err) {
    console.error('[WBRecordingDonePrompt] visibility change failed', err)
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
</script>

<style scoped>
.wb-rec-done {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 360px;
  max-width: calc(100vw - 40px);
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.15);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1100;
  animation: wb-rec-done-slide-in 0.28s ease;
}

@keyframes wb-rec-done-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.wb-rec-done__header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 10px;
}

.wb-rec-done__icon { font-size: 1.4rem; line-height: 1; }

.wb-rec-done__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-rec-done__title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
}

.wb-rec-done__subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.wb-rec-done__close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 6px;
}
.wb-rec-done__close:hover { color: var(--text-primary); }

.wb-rec-done__vis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: var(--bg-secondary, #f3f4f6);
  padding: 4px;
  border-radius: 8px;
}

.wb-rec-done__vis-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.12s, color 0.12s;
}

.wb-rec-done__vis-btn:hover {
  color: var(--text-primary);
}

.wb-rec-done__vis-btn--active {
  background: var(--card-bg, #fff);
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wb-rec-done__vis-icon { font-size: 1rem; }
.wb-rec-done__vis-label { font-size: 0.75rem; font-weight: 600; }

.wb-rec-done__link {
  display: flex;
  gap: 6px;
}

.wb-rec-done__link input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-primary);
  background: var(--card-bg);
}

.wb-rec-done__copy {
  padding: 7px 14px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s;
}
.wb-rec-done__copy:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
}
.wb-rec-done__copy--done {
  background: var(--color-success, #10b981);
}

.wb-rec-done__footer {
  display: flex;
  justify-content: flex-end;
}

.wb-rec-done__list-link {
  font-size: 0.8125rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
.wb-rec-done__list-link:hover {
  text-decoration: underline;
}
</style>
