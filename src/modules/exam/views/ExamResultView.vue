<!-- ExamResultView — підсумок: тестовий бал, per-section, розбір по задачах (KaTeX). -->
<template>
  <div class="exam-res">
    <div v-if="store.loading" class="exam-res__state">{{ t('exam.loading') }}</div>
    <div v-else-if="!store.result" class="exam-res__state is-err">{{ t('exam.result.none') }}</div>

    <template v-else>
      <header class="exam-res__head">
        <h1 class="exam-res__title">{{ t('exam.result.title') }}</h1>
        <div class="exam-res__score">
          {{ store.result.test_score }} / {{ store.result.max_score }}
          <span class="exam-res__score-lbl">{{ t('exam.result.testScore') }}</span>
        </div>
        <div class="exam-res__rating">
          <template v-if="store.result.rating_calibrated && store.result.rating !== null">
            {{ t('exam.result.rating') }}: <b>{{ store.result.rating }}</b>
          </template>
          <template v-else>{{ t('exam.result.ratingPending') }}</template>
        </div>
        <div v-if="store.result.duration_sec !== null" class="exam-res__dur">
          {{ t('exam.result.duration') }}: {{ formatDur(store.result.duration_sec) }}
        </div>
      </header>

      <!-- per-section + теми -->
      <section v-for="s in store.result.sections" :key="s.section_order" class="exam-res__sec">
        <div class="exam-res__sec-head">
          {{ t('exam.result.section') }} {{ s.section_order + 1 }} · {{ s.subject_label || s.subject }} —
          {{ s.raw_score }}/{{ s.max_score }}
        </div>
        <ul class="exam-res__topics">
          <li v-for="(st, topic) in s.topic_stats" :key="topic">
            {{ topic }}: {{ st.correct }}/{{ st.total }}
          </li>
        </ul>
      </section>

      <!-- розбір по задачах -->
      <section class="exam-res__review">
        <h2 class="exam-res__sub">{{ t('exam.result.review') }}</h2>
        <div
          v-for="(r, i) in store.result.review"
          :key="r.external_id"
          class="exam-res__item"
          :class="r.is_correct ? 'is-ok' : 'is-bad'"
        >
          <div class="exam-res__item-head">
            <span class="exam-res__num">{{ i + 1 }}</span>
            <span class="exam-res__verdict">
              {{ r.is_correct ? t('exam.result.correct') : (r.answered ? t('exam.result.wrong') : t('exam.result.skipped')) }}
            </span>
          </div>
          <div v-if="r.solution" class="exam-res__sol" v-html="renderTextWithLatex(r.solution)" />
        </div>
      </section>

      <div class="exam-res__actions">
        <button class="exam-res__btn" @click="backToStart">{{ t('exam.result.toStart') }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

import { useExamStore } from '../stores/examStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useExamStore()

function formatDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} ${t('exam.minShort')} ${String(s).padStart(2, '0')} ${t('exam.secShort')}`
}

function backToStart() {
  store.reset()
  router.push({ name: 'exam-start' })
}

onMounted(async () => {
  const runId = String(route.params.runId)
  if (!store.result || store.result.run_id !== runId) await store.loadResult(runId)
})
</script>

<style scoped>
.exam-res { max-width: 720px; margin: 0 auto; padding: 24px 16px; color: var(--text-primary, inherit); }
.exam-res__state { padding: 32px; text-align: center; opacity: 0.7; }
.exam-res__state.is-err { color: #dc2626; }
.exam-res__head { text-align: center; padding: 16px 0 24px; border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.1)); }
.exam-res__title { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
.exam-res__score { font-size: 40px; font-weight: 800; color: #3B6D11; }
[data-theme="dark"] .exam-res__score { color: #6cae3e; }
.exam-res__score-lbl { display: block; font-size: 13px; font-weight: 400; opacity: 0.6; }
.exam-res__rating { margin-top: 10px; font-size: 15px; opacity: 0.8; }
.exam-res__dur { margin-top: 4px; font-size: 13px; opacity: 0.55; }
.exam-res__sec { margin-top: 20px; }
.exam-res__sec-head { font-weight: 600; font-size: 15px; }
.exam-res__topics { margin: 6px 0 0; padding-left: 18px; font-size: 13px; opacity: 0.7; }
.exam-res__sub { font-size: 16px; font-weight: 600; margin: 28px 0 12px; }
.exam-res__item { padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid transparent; }
.exam-res__item.is-ok { background: rgba(59,109,17,0.08); border-left-color: #3B6D11; }
.exam-res__item.is-bad { background: rgba(220,38,38,0.07); border-left-color: #dc2626; }
.exam-res__item-head { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.exam-res__num { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(0,0,0,0.06); font-size: 12px; font-weight: 600; }
.exam-res__verdict { font-weight: 600; }
.exam-res__sol { margin-top: 8px; font-size: 13px; line-height: 1.6; opacity: 0.85; }
.exam-res__actions { margin-top: 24px; text-align: center; }
.exam-res__btn { background: #3B6D11; color: #fff; border: none; border-radius: 8px; padding: 11px 24px; font-size: 15px; cursor: pointer; }
[data-theme="dark"] .exam-res__btn { background: #6cae3e; }
.exam-res :deep(.katex) { font-size: 1.04em; }
.exam-res :deep(.lc-display-math) { text-align: center; margin: 8px 0; }
</style>
