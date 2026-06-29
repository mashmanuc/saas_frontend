<!--
  ExamRunView — екзаменаційний інтерфейс: серверний таймер, навігатор задач,
  поточне питання (ExamQuestionCard), автозбереження відповіді, завершення.
  Таймер = серверний SSOT (відлік від deadline_at); по 0 → авто-finish.
-->
<template>
  <div class="exam-run">
    <header class="exam-run__bar">
      <div class="exam-run__title">{{ store.run?.blueprint_title }}</div>
      <div
        class="exam-run__timer"
        :class="{ 'is-low': store.remainingSec !== null && store.remainingSec < 60 }"
        v-if="store.remainingSec !== null"
      >
        ⏱ {{ formatTime(store.remainingSec) }}
      </div>
      <div class="exam-run__progress">{{ store.answeredCount }}/{{ store.total }}</div>
    </header>

    <div v-if="store.loading" class="exam-run__state">{{ t('exam.loading') }}</div>
    <div v-else-if="store.error" class="exam-run__state is-err">{{ store.error }}</div>

    <div v-else-if="store.current" class="exam-run__body">
      <!-- навігатор -->
      <nav class="exam-run__nav">
        <button
          v-for="(it, i) in store.items"
          :key="it.external_id"
          type="button"
          class="exam-run__dot"
          :class="{
            'is-current': i === store.currentIndex,
            'is-answered': !!store.answers[it.external_id],
          }"
          @click="store.goTo(i)"
        >
          {{ i + 1 }}
        </button>
      </nav>

      <ExamQuestionCard
        :item="store.current"
        :answer="store.answers[store.current.external_id] || null"
        :disabled="!store.isActive"
        :position="store.currentIndex + 1"
        :total-count="store.total"
        @commit="onCommit"
      />

      <div class="exam-run__actions">
        <button class="exam-run__btn is-ghost" :disabled="store.currentIndex === 0" @click="store.prev()">
          {{ t('exam.prev') }}
        </button>
        <button
          v-if="store.currentIndex < store.total - 1"
          class="exam-run__btn"
          @click="store.next()"
        >
          {{ t('exam.next') }}
        </button>
        <button
          v-else
          class="exam-run__btn is-finish"
          :disabled="store.finishing"
          @click="confirmFinish"
        >
          {{ t('exam.finish') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ExamQuestionCard from '../components/ExamQuestionCard.vue'
import { useExamStore } from '../stores/examStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useExamStore()

let timer: ReturnType<typeof setInterval> | null = null

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function onCommit(answer: Record<string, any>) {
  if (store.current) store.saveAnswer(store.current.external_id, answer)
}

async function goResult() {
  await router.push({ name: 'exam-result', params: { runId: String(route.params.runId) } })
}

async function confirmFinish() {
  if (!window.confirm(t('exam.finishConfirm'))) return
  const res = await store.finish()
  if (res) await goResult()
}

async function onExpired() {
  if (timer) clearInterval(timer)
  await store.finish()
  await goResult()
}

onMounted(async () => {
  const runId = String(route.params.runId)
  if (!store.run || store.run.id !== runId) await store.load(runId)
  if (store.run && store.run.status !== 'in_progress') {
    await goResult()
    return
  }
  timer = setInterval(() => {
    const expired = store.tick()
    if (expired) onExpired()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.exam-run { max-width: 760px; margin: 0 auto; padding: 16px; color: var(--text-primary, inherit); }
.exam-run__bar { display: flex; align-items: center; gap: 16px; padding: 12px 0 16px; }
.exam-run__title { flex: 1; font-size: 16px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exam-run__timer { font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 700; padding: 4px 12px; border-radius: 8px; background: rgba(59,109,17,0.1); }
.exam-run__timer.is-low { background: rgba(220,38,38,0.12); color: #dc2626; }
.exam-run__progress { font-size: 14px; opacity: 0.65; }
.exam-run__state { padding: 32px; text-align: center; opacity: 0.7; }
.exam-run__state.is-err { color: #dc2626; }
.exam-run__nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.exam-run__dot { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); background: transparent; color: inherit; cursor: pointer; font-size: 13px; }
.exam-run__dot.is-answered { background: rgba(59,109,17,0.12); border-color: #3B6D11; }
.exam-run__dot.is-current { outline: 2px solid #3B6D11; outline-offset: 1px; font-weight: 700; }
.exam-run__actions { display: flex; gap: 10px; margin-top: 18px; }
.exam-run__btn { background: #3B6D11; color: #fff; border: none; border-radius: 8px; padding: 11px 22px; font-size: 15px; font-weight: 500; cursor: pointer; }
.exam-run__btn.is-ghost { background: transparent; color: inherit; border: 1px solid var(--border-color, rgba(0,0,0,0.2)); }
.exam-run__btn.is-finish { background: #b8430f; margin-left: auto; }
.exam-run__btn:disabled { opacity: 0.45; cursor: default; }
[data-theme="dark"] .exam-run__btn { background: #6cae3e; }
[data-theme="dark"] .exam-run__btn.is-finish { background: #d4691f; }
</style>
