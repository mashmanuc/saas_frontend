<script setup lang="ts">
/**
 * /mash/import — міст «Використати на дошці» з публічної MASH-воронки (A2).
 *
 * Потік: воронка кладе envelope у localStorage['mash:handoff'] і веде сюди.
 * Гість → auth-guard роутера сам відправить на /start|/auth/login?redirect=/mash/import,
 * handoff переживає логін у localStorage. Тут: читаємо envelope →
 *   stereo → нативний nmt3d-ассет, посіяний у createSession (generator-патерн,
 *            INV-STABLE-2; жодних нових write-шляхів) → redirect на дошку;
 *   g2d/g3d/geo → чесний екран «поки лише stereo» (до A3 mash_scene);
 *   student → чесний екран (solo-дошки tutor-only, Phase 5).
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import { winterboardApi } from '../api/winterboardApi'
import {
  takeMashHandoff,
  buildNmt3dAssetFromStereoScene,
  buildSeedState,
} from '../utils/mashImport'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

type ImportState = 'working' | 'empty' | 'invalid' | 'not-stereo' | 'student' | 'error'
const state = ref<ImportState>('working')

onMounted(async () => {
  const envelope = takeMashHandoff(window.localStorage)
  if (!envelope) {
    state.value = 'empty'
    return
  }
  if (auth.user?.role === 'student') {
    state.value = 'student'
    return
  }
  if (envelope.app !== 'stereo') {
    state.value = 'not-stereo'
    return
  }
  const asset = buildNmt3dAssetFromStereoScene(envelope.scene)
  if (!asset) {
    state.value = 'invalid'
    return
  }
  try {
    const created = await winterboardApi.createSession({
      name: t('mashImport.sessionName'),
      state: buildSeedState(asset),
      folder: null,
    })
    if (!created?.id) throw new Error('createSession: no id in response')
    router.replace(`/winterboard/${created.id}`)
  } catch (err) {
    console.error('[mash-import] createSession failed', err)
    state.value = 'error'
  }
})
</script>

<template>
  <div class="mash-import" data-testid="mash-import">
    <div v-if="state === 'working'" class="mi-card">
      <div class="mi-spinner" aria-hidden="true" />
      <p>{{ t('mashImport.working') }}</p>
    </div>

    <div v-else class="mi-card">
      <p v-if="state === 'empty'">{{ t('mashImport.empty') }}</p>
      <p v-else-if="state === 'invalid'">{{ t('mashImport.invalid') }}</p>
      <p v-else-if="state === 'not-stereo'">{{ t('mashImport.notStereo') }}</p>
      <p v-else-if="state === 'student'">{{ t('mashImport.studentOnly') }}</p>
      <p v-else>{{ t('mashImport.error') }}</p>
      <a class="mi-link" href="/mash/stereomash/index.html">{{ t('mashImport.backToMash') }}</a>
    </div>
  </div>
</template>

<style scoped>
.mash-import {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mi-card {
  max-width: 420px;
  padding: 2rem;
  text-align: center;
  border-radius: 12px;
  background: var(--surface-card, #fff);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.mi-spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 1rem;
  border: 3px solid var(--border-color, #e2e8f0);
  border-top-color: var(--primary-color, #7c3aed);
  border-radius: 50%;
  animation: mi-spin 0.8s linear infinite;
}
@keyframes mi-spin {
  to { transform: rotate(360deg); }
}
.mi-link {
  display: inline-block;
  margin-top: 0.75rem;
  color: var(--primary-color, #7c3aed);
}
</style>
