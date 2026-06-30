<!--
  ExamRunView — FOCUS MODE: повноекранний екзаменаційний інтерфейс (top-level роут,
  без сайдбару/шапки застосунку). Серверний таймер, навігатор задач, автозбереження.
  Формальний нейтральний вигляд — тест має відчуватися як іспит, а не сторінка кабінету.
-->
<template>
  <div class="exam-fs">
    <header class="exam-fs__top">
      <div class="exam-fs__brand">{{ store.run?.blueprint_title || t('exam.start.title') }}</div>
      <div
        v-if="store.remainingSec !== null"
        class="exam-fs__timer"
        :class="{ 'is-low': store.remainingSec < 60 }"
      >
        <span class="exam-fs__timer-ic">⏱</span>{{ formatTime(store.remainingSec) }}
      </div>
      <div class="exam-fs__who">
        <span class="exam-fs__progress">{{ store.answeredCount }}/{{ store.total }}</span>
        <span v-if="displayName" class="exam-fs__name">{{ displayName }}</span>
      </div>
    </header>

    <main class="exam-fs__main">
      <div v-if="store.loading" class="exam-fs__state">{{ t('exam.loading') }}</div>
      <div v-else-if="store.error" class="exam-fs__state is-err">{{ store.error }}</div>

      <template v-else-if="store.current">
        <nav class="exam-fs__nav">
          <button
            v-for="(it, i) in store.items"
            :key="it.external_id"
            type="button"
            class="exam-fs__dot"
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

        <div class="exam-fs__actions">
          <button class="exam-fs__btn is-ghost" :disabled="store.currentIndex === 0" @click="store.prev()">
            {{ t('exam.prev') }}
          </button>
          <button
            v-if="store.currentIndex < store.total - 1"
            class="exam-fs__btn"
            @click="store.next()"
          >
            {{ t('exam.next') }}
          </button>
          <button
            v-else
            class="exam-fs__btn is-finish"
            :disabled="store.finishing"
            @click="confirmFinish"
          >
            {{ t('exam.finish') }}
          </button>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'

import ExamQuestionCard from '../components/ExamQuestionCard.vue'
import { useExamStore } from '../stores/examStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useExamStore()
const auth = useAuthStore()

const displayName = computed(() => {
  const u: any = auth.user
  if (!u) return ''
  return (u.full_name || `${u.first_name || ''} ${u.last_name || ''}`).trim()
})

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
/* FOCUS MODE — навмисно НЕ застосунковий зелений, а формальний нейтральний (slate/white),
   щоб тест візуально відрізнявся від кабінету. */
.exam-fs {
  --x-ink: #1f2937;
  --x-muted: #6b7280;
  --x-line: #e5e7eb;
  --x-surface: #ffffff;
  --x-bg: #f4f5f7;
  --x-accent: #1f3a5f;        /* стримана темно-синя — «офіційна» */
  --x-accent-soft: rgba(31,58,95,0.08);
  min-height: 100vh;
  background: var(--x-bg);
  color: var(--x-ink);
  font-family: inherit;
}
[data-theme="dark"] .exam-fs {
  --x-ink: #e5e7eb; --x-muted: #9ca3af; --x-line: rgba(255,255,255,0.12);
  --x-surface: #161b22; --x-bg: #0d1117; --x-accent: #7aa2d6; --x-accent-soft: rgba(122,162,214,0.14);
}

/* Липка офіційна шапка на всю ширину */
.exam-fs__top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 16px;
  padding: 14px 24px;
  background: var(--x-surface);
  border-bottom: 1px solid var(--x-line);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.exam-fs__brand {
  flex: 1; min-width: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.exam-fs__timer {
  font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 800;
  padding: 6px 16px; border-radius: 10px;
  background: var(--x-accent-soft); color: var(--x-accent);
  display: flex; align-items: center; gap: 8px;
}
.exam-fs__timer-ic { font-size: 16px; }
.exam-fs__timer.is-low { background: rgba(220,38,38,0.12); color: #dc2626; }
.exam-fs__who { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 14px; min-width: 0; }
.exam-fs__progress { font-size: 14px; color: var(--x-muted); font-variant-numeric: tabular-nums; }
.exam-fs__name { font-size: 14px; font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Центрований контент */
.exam-fs__main { max-width: 780px; margin: 0 auto; padding: 24px 20px 64px; }
.exam-fs__state { padding: 48px; text-align: center; color: var(--x-muted); }
.exam-fs__state.is-err { color: #dc2626; }

.exam-fs__nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
.exam-fs__dot {
  width: 36px; height: 36px; border-radius: 8px;
  border: 1px solid var(--x-line); background: var(--x-surface);
  color: var(--x-ink); cursor: pointer; font-size: 13px; font-variant-numeric: tabular-nums;
}
.exam-fs__dot.is-answered { background: var(--x-accent-soft); border-color: var(--x-accent); color: var(--x-accent); font-weight: 700; }
.exam-fs__dot.is-current { outline: 2px solid var(--x-accent); outline-offset: 1px; font-weight: 700; }

.exam-fs__actions { display: flex; gap: 10px; margin-top: 22px; }
.exam-fs__btn {
  background: var(--x-accent); color: #fff; border: none; border-radius: 8px;
  padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer;
}
.exam-fs__btn.is-ghost { background: transparent; color: var(--x-ink); border: 1px solid var(--x-line); }
.exam-fs__btn.is-finish { background: #b8430f; margin-left: auto; }
.exam-fs__btn:disabled { opacity: 0.45; cursor: default; }
</style>
