<!-- ExamStartView — список реальних НМТ-варіантів; старт із вибором часу учнем. -->
<template>
  <div class="exam-start">
    <h1 class="exam-start__title">{{ t('exam.start.title') }}</h1>
    <p class="exam-start__sub">{{ t('exam.start.subtitle') }}</p>

    <div v-if="loading" class="exam-start__state">{{ t('exam.loading') }}</div>
    <div v-else-if="error" class="exam-start__state is-err">{{ error }}</div>
    <div v-else-if="blueprints.length === 0" class="exam-start__state">
      {{ t('exam.start.empty') }}
    </div>

    <ul v-else class="exam-start__list">
      <li v-for="b in blueprints" :key="b.id" class="exam-start__item">
        <div class="exam-start__info">
          <div class="exam-start__name">{{ b.title }}</div>
          <div class="exam-start__detail">
            {{ b.sections[0]?.name || 'Математика' }} · {{ t('exam.start.standard') }} {{ totalMinutes(b) }} {{ t('exam.minShort') }}
          </div>
        </div>
        <button class="exam-start__btn" @click="openPicker(b)">
          {{ t('exam.start.begin') }}
        </button>
      </li>
    </ul>

    <!-- Модалка вибору часу проходження -->
    <div v-if="pending" class="exam-start__overlay" @click.self="pending = null">
      <div class="exam-start__dialog">
        <div class="exam-start__dialog-name">{{ pending.title }}</div>
        <div class="exam-start__dialog-q">{{ t('exam.start.chooseTime') }}</div>

        <div class="exam-start__times">
          <button
            v-for="m in presets"
            :key="m"
            type="button"
            class="exam-start__time"
            :class="{ 'is-on': !noLimit && chosenMin === m }"
            @click="selectPreset(m)"
          >
            {{ m }} {{ t('exam.minShort') }}<span v-if="m === standardMin"> · {{ t('exam.start.standard') }}</span>
          </button>
          <button
            type="button"
            class="exam-start__time"
            :class="{ 'is-on': noLimit }"
            @click="noLimit = true"
          >
            {{ t('exam.start.noLimit') }}
          </button>
        </div>

        <label class="exam-start__custom">
          <span>{{ t('exam.start.customTime') }}</span>
          <input
            v-model.number="chosenMin"
            type="number" min="1" max="300"
            @input="noLimit = false"
          />
        </label>

        <div class="exam-start__dialog-actions">
          <button class="exam-start__btn is-ghost" @click="pending = null">
            {{ t('exam.create.cancel') }}
          </button>
          <button class="exam-start__btn" :disabled="starting" @click="confirmStart">
            {{ t('exam.start.begin') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { examApi, type BlueprintSummary } from '../api/examApi'
import { useExamStore } from '../stores/examStore'

const { t } = useI18n()
const router = useRouter()
const store = useExamStore()

const blueprints = ref<BlueprintSummary[]>([])
const loading = ref(true)
const starting = ref(false)
const error = ref<string | null>(null)

const presets = [170, 120, 90, 60]
const DEFAULT_MIN = 60
const pending = ref<BlueprintSummary | null>(null)
const chosenMin = ref(DEFAULT_MIN)
const noLimit = ref(false)
const standardMin = computed(() => (pending.value ? totalMinutes(pending.value) : 170))

function totalMinutes(b: BlueprintSummary): number {
  const sec = b.sections.reduce((acc, s) => acc + (s.time_limit_sec || 0), 0)
  return Math.round(sec / 60) || 170
}

function openPicker(b: BlueprintSummary) {
  pending.value = b
  noLimit.value = false
  chosenMin.value = DEFAULT_MIN
}
function selectPreset(m: number) {
  chosenMin.value = m
  noLimit.value = false
}

async function confirmStart() {
  if (!pending.value) return
  const blueprintId = pending.value.id
  const timeLimitSec = noLimit.value ? 0 : Math.max(1, chosenMin.value || 1) * 60
  starting.value = true
  error.value = null
  try {
    const run = await examApi.startRun(blueprintId, timeLimitSec)
    store.setRun(run)
    router.push({ name: 'exam-run', params: { runId: run.id } })
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'start_failed'
    pending.value = null
  } finally {
    starting.value = false
  }
}

onMounted(async () => {
  try {
    const data = await examApi.listBlueprints('available')
    blueprints.value = data.blueprints || []
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'load_failed'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.exam-start { max-width: 720px; margin: 0 auto; padding: 24px 16px; color: var(--text-primary, inherit); }
.exam-start__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.exam-start__sub { opacity: 0.65; margin: 0 0 24px; }
.exam-start__state { padding: 32px; text-align: center; opacity: 0.7; }
.exam-start__state.is-err { color: #dc2626; }
.exam-start__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.exam-start__item { display: flex; align-items: center; gap: 16px; padding: 16px 18px; border: 1px solid var(--border-color, rgba(0,0,0,0.1)); border-radius: 12px; background: var(--card-bg, #fff); }
.exam-start__info { flex: 1; min-width: 0; }
.exam-start__name { font-size: 16px; font-weight: 600; }
.exam-start__detail { font-size: 13px; opacity: 0.6; margin-top: 3px; }
.exam-start__btn { background: #3B6D11; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 15px; font-weight: 500; cursor: pointer; flex-shrink: 0; }
.exam-start__btn.is-ghost { background: transparent; color: inherit; border: 1px solid var(--border-color, rgba(0,0,0,0.2)); }
.exam-start__btn:disabled { opacity: 0.5; cursor: default; }
[data-theme="dark"] .exam-start__btn:not(.is-ghost) { background: #6cae3e; }

/* модалка вибору часу */
.exam-start__overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
.exam-start__dialog { background: var(--card-bg, #fff); color: var(--text-primary, inherit); border-radius: 14px; padding: 22px; width: 100%; max-width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
.exam-start__dialog-name { font-size: 17px; font-weight: 700; }
.exam-start__dialog-q { font-size: 14px; opacity: 0.7; margin: 4px 0 14px; }
.exam-start__times { display: flex; flex-wrap: wrap; gap: 8px; }
.exam-start__time { padding: 9px 13px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 9px; background: transparent; color: inherit; font-size: 14px; cursor: pointer; }
.exam-start__time.is-on { border-color: #3B6D11; background: rgba(59,109,17,0.1); font-weight: 600; }
[data-theme="dark"] .exam-start__time.is-on { border-color: #6cae3e; background: rgba(125,211,80,0.16); }
.exam-start__custom { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; margin: 16px 0; }
.exam-start__custom input { width: 90px; padding: 8px 10px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--card-bg, #fff); color: inherit; font-size: 15px; }
.exam-start__dialog-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
