<template>
  <div class="wb-replay-public">
    <header class="wb-replay-public__header">
      <div class="wb-replay-public__brand">M4SH</div>
      <div class="wb-replay-public__title">{{ sessionName || t('winterboard.replay.loading') }}</div>
      <div v-if="tutor" class="wb-replay-public__tutor">{{ tutor.name }}</div>
    </header>

    <main class="wb-replay-public__body">
      <div v-if="error" class="wb-replay-public__error">{{ error }}</div>
      <div v-else-if="loading" class="wb-replay-public__loading">{{ t('winterboard.replay.loading') }}</div>
      <div v-else class="wb-replay-public__stage">
        <!-- B.6/B.7/B.8: TODO — canvas renderer, tutor card after first play, branding overlay.
             Наразі показуємо простий placeholder + метадані. Замінимо при інтеграції Konva renderer. -->
        <div class="wb-replay-public__placeholder">
          <p>{{ t('winterboard.replay.replayReady', 'Запис готовий до відтворення') }}</p>
          <p class="wb-replay-public__meta">
            {{ t('winterboard.replay.operationsCount', { count: totalOperations }) }}
          </p>
        </div>
      </div>
    </main>

    <footer class="wb-replay-public__footer" aria-hidden="true">
      <span class="wb-replay-public__watermark">M4SH · Winterboard</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Phase B: публічний перегляд replay за share-token.
// INV-L: ніякого session.id тут; тільки token з URL.
// B.6: TODO додати <meta og:*> через useHead / vueuse head при SSR.
// B.7: TODO tutor card після першого play.
// B.8: TODO branding bottom-right з opacity 0.7 (наразі в footer).
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchPublicReplayByToken, ReplayGoneError, ReplayNotFoundError } from '../api/replay'

const props = defineProps<{ token: string }>()
const { t } = useI18n({ useScope: 'global' })

const loading = ref(true)
const error = ref<string | null>(null)
const sessionName = ref<string>('')
const totalOperations = ref(0)
const tutor = ref<{ id: number; name: string } | null>(null)

onMounted(async () => {
  try {
    const data = await fetchPublicReplayByToken(props.token)
    sessionName.value = data.session_name || ''
    totalOperations.value = data.total_operations || 0
    tutor.value = data.tutor ?? null
    // B.6: set document.title для share preview fallback.
    if (sessionName.value) {
      document.title = `${sessionName.value} — M4SH Replay`
    }
  } catch (e) {
    // Phase 2.5 cache plan: fetchPublicReplayByToken тепер кидає custom errors
    // (НЕ axios з .status). Mapping до user-friendly messages.
    if (e instanceof ReplayNotFoundError) {
      error.value = t('winterboard.replay.notFound', 'Запис не знайдено або був видалений')
    } else if (e instanceof ReplayGoneError) {
      // 410 Gone — replay trashed. Backend дав localized detail.
      error.value = e.detail || t('winterboard.replay.notFound', 'Запис видалено')
    } else if (e instanceof Error && e.message === 'rate_limited') {
      error.value = t('winterboard.replay.rateLimited', 'Забагато запитів, спробуйте пізніше')
    } else {
      const msg = e instanceof Error ? e.message : ''
      error.value = msg || t('winterboard.replay.loadError', 'Не вдалося завантажити запис')
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.wb-replay-public {
  display: flex; flex-direction: column;
  min-height: 100vh; min-height: 100dvh;
  background: var(--color-surface-alt, #f8fafc);
  color: var(--color-text, #0f172a);
}
.wb-replay-public__header {
  display: flex; align-items: center; gap: 20px;
  padding: 14px 24px;
  background: #0f172a; color: #ffffff;
  flex-shrink: 0;
}
.wb-replay-public__brand { font-weight: 900; letter-spacing: -0.02em; font-size: 18px; }
.wb-replay-public__title { flex: 1; font-size: 14px; opacity: 0.9; }
.wb-replay-public__tutor { font-size: 13px; opacity: 0.75; }
.wb-replay-public__body {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.wb-replay-public__stage, .wb-replay-public__loading, .wb-replay-public__error {
  width: 100%; max-width: 1100px;
  background: #ffffff;
  border-radius: 12px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}
.wb-replay-public__error { color: #dc2626; }
.wb-replay-public__placeholder p { margin: 6px 0; }
.wb-replay-public__meta { color: var(--color-text-muted, #64748b); font-size: 13px; }
.wb-replay-public__footer {
  display: flex; justify-content: flex-end;
  padding: 10px 24px;
  opacity: 0.7; font-size: 12px;
  color: var(--color-text-muted, #64748b);
}
</style>
