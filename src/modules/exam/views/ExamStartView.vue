<!-- ExamStartView — вибір варіанта й старт Solo-проходження. -->
<template>
  <div class="exam-start">
    <div class="exam-start__head">
      <div>
        <h1 class="exam-start__title">{{ t('exam.start.title') }}</h1>
        <p class="exam-start__sub">{{ t('exam.start.subtitle') }}</p>
      </div>
      <button v-if="isTutor" class="exam-start__create" @click="$router.push({ name: 'exam-create' })">
        + {{ t('exam.create.title') }}
      </button>
    </div>

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
            {{ t(`exam.kind.${b.type}`) }} ·
            {{ t('exam.start.sections', { n: b.sections.length }) }} ·
            {{ totalMinutes(b) }} {{ t('exam.minShort') }}
          </div>
        </div>
        <button class="exam-start__btn" :disabled="starting" @click="start(b.id)">
          {{ t('exam.start.begin') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'

import { examApi, type BlueprintSummary } from '../api/examApi'
import { useExamStore } from '../stores/examStore'

const { t } = useI18n()
const router = useRouter()
const store = useExamStore()
const auth = useAuthStore()
const isTutor = computed(() => auth.user?.role === 'tutor')

const blueprints = ref<BlueprintSummary[]>([])
const loading = ref(true)
const starting = ref(false)
const error = ref<string | null>(null)

function totalMinutes(b: BlueprintSummary): number {
  const sec = b.sections.reduce((acc, s) => acc + (s.time_limit_sec || 0), 0)
  return Math.round(sec / 60)
}

async function start(blueprintId: string) {
  starting.value = true
  error.value = null
  try {
    const run = await examApi.startRun(blueprintId)
    store.setRun(run)
    router.push({ name: 'exam-run', params: { runId: run.id } })
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'start_failed'
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
.exam-start__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.exam-start__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.exam-start__sub { opacity: 0.65; margin: 0; }
.exam-start__create { flex-shrink: 0; background: transparent; color: #3B6D11; border: 1px solid #3B6D11; border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
[data-theme="dark"] .exam-start__create { color: #6cae3e; border-color: #6cae3e; }
.exam-start__state { padding: 32px; text-align: center; opacity: 0.7; }
.exam-start__state.is-err { color: #dc2626; }
.exam-start__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.exam-start__item { display: flex; align-items: center; gap: 16px; padding: 16px 18px; border: 1px solid var(--border-color, rgba(0,0,0,0.1)); border-radius: 12px; background: var(--card-bg, #fff); }
.exam-start__info { flex: 1; min-width: 0; }
.exam-start__name { font-size: 16px; font-weight: 600; }
.exam-start__detail { font-size: 13px; opacity: 0.6; margin-top: 3px; }
.exam-start__btn { background: #3B6D11; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 15px; font-weight: 500; cursor: pointer; flex-shrink: 0; }
.exam-start__btn:disabled { opacity: 0.5; cursor: default; }
[data-theme="dark"] .exam-start__btn { background: #6cae3e; }
</style>
