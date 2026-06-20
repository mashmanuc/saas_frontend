<!--
  CampaignStepPlayer (F3.4) — оверлей розв'язання Challenge поточного Step.
  Reuse PuzzleCard (F1 renderer). submit → store.submitChallenge → карта advance-иться.
  correct+next → наступний поточний Step (continuous-play) або close (світ/кампанію пройдено);
  wrong+retry → та сама задача (новий attempt, дозволено беком).
-->
<template>
  <div class="cstep" :class="{ 'is-fading': fading }" @click.self="emit('close')">
    <div class="cstep__panel">
      <header class="cstep__head">
        <span class="cstep__title">{{ t('practice.step') }} {{ world }}.{{ step + 1 }}</span>
        <button type="button" class="cstep__x" :aria-label="t('practice.close')" @click="emit('close')">×</button>
      </header>

      <div v-if="loading" class="cstep__msg">{{ t('practice.progress.loading') }}</div>
      <div v-else-if="error" class="cstep__msg cstep__msg--err">{{ error }}</div>
      <PuzzleCard
        v-else-if="puzzle"
        :puzzle="puzzle"
        :result="result"
        :submitting="submitting"
        :auto-next="true"
        @submit="onSubmit"
        @next="onNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { practiceApi, type CampaignState, type CampaignSubmitResult, type NextPuzzle } from '../api/practiceApi'
import { usePracticeCampaignStore } from '../stores/practiceCampaignStore'
import PuzzleCard from './PuzzleCard.vue'

const props = defineProps<{ world: number; step: number }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'advance', campaign: CampaignState): void }>()
const { t } = useI18n()
const store = usePracticeCampaignStore()

const world = ref(props.world)
const step = ref(props.step)
const puzzle = ref<NextPuzzle | null>(null)
const result = ref<CampaignSubmitResult | null>(null)
const submitting = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const fading = ref(false)          // повільне зникнення модалки на пройдений крок
let advanced = false               // гард: один advance на крок
const timers: number[] = []

async function loadStep(w: number, s: number) {
  loading.value = true
  error.value = null
  result.value = null
  puzzle.value = null
  try {
    const res = await practiceApi.getStep(w, s, store.campaign?.id)
    puzzle.value = (res.challenges[0] as NextPuzzle) || null
    if (!puzzle.value) error.value = t('practice.progress.unavailable')
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'Помилка'
  } finally {
    loading.value = false
  }
}

async function onSubmit(answer: Record<string, any>) {
  if (!puzzle.value) return
  submitting.value = true
  try {
    result.value = await store.submitChallenge(
      world.value,
      step.value,
      puzzle.value.problem_external_id,
      answer,
    )
    // увесь крок пройдено (cps=1 → 1 правильна) → дати побачити «✓», тоді авто-fade
    if (result.value?.correct && result.value.step_complete) {
      timers.push(window.setTimeout(beginAdvance, 1100))
    }
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'Помилка'
  } finally {
    submitting.value = false
  }
}

function onNext() {
  // wrong → retry ту саму задачу (скидаємо результат, PuzzleCard знову активний)
  if (result.value && !result.value.correct) {
    result.value = null
    return
  }
  beginAdvance() // «Далі» = прискорити авто-зникнення
}

// крок пройдено: модалка ПОВІЛЬНО зникає (fade), ТОДІ хост закриває + застосовує
// advance → пішак ковзає на нову сходинку. Один раз (advanced-гард).
function beginAdvance() {
  if (advanced || !result.value) return
  advanced = true
  fading.value = true
  const campaign = result.value.campaign
  timers.push(window.setTimeout(() => emit('advance', campaign), 600)) // після fade-out
}

onMounted(() => loadStep(world.value, step.value))
onBeforeUnmount(() => timers.forEach((id) => window.clearTimeout(id)))
</script>

<style scoped>
.cstep {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-start; justify-content: center;
  padding: 24px 12px; background: rgba(8, 20, 16, 0.5); overflow-y: auto;
  transition: opacity 0.55s ease;
}
.cstep.is-fading { opacity: 0; pointer-events: none; }   /* повільне зникнення на пройдений крок */
.cstep__panel {
  width: 100%; max-width: 580px; background: var(--card-bg, #fff); border-radius: 14px; padding: 14px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
  transition: transform 0.55s ease;
}
.cstep.is-fading .cstep__panel { transform: translateY(-14px) scale(0.97); }  /* елегантно «відлітає» */
@media (prefers-reduced-motion: reduce) { .cstep, .cstep__panel { transition: none; } }
.cstep__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cstep__title { font: 700 0.95rem system-ui, sans-serif; color: var(--text-primary, #0d4a3e); }
.cstep__x {
  border: none; background: none; font-size: 24px; line-height: 1; cursor: pointer;
  color: var(--text-secondary, #777); padding: 0 4px;
}
.cstep__msg { padding: 28px 12px; text-align: center; color: var(--text-secondary, #555); }
.cstep__msg--err { color: #a02d2d; }
</style>
