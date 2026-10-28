<template>
  <div class="lpv" data-testid="lp-learner-view">
    <p v-if="loading" class="lpv__muted">{{ t('loader.loading') }}</p>
    <p v-else-if="failed" class="lpv__muted">{{ t('learningPrograms.errors.load') }}</p>
    <template v-else-if="v">
      <h1 class="lpv__title">{{ v.title }}</h1>
      <p v-if="v.current_topic" class="lpv__now">
        <span class="lpv__k">{{ t('learningPrograms.learner.now') }}</span>{{ v.current_topic }}
      </p>
      <div class="lpv__progress" :aria-label="t('learningPrograms.learner.progress')">
        <div class="lpv__bar"><div class="lpv__fill" :style="{ width: `${percent}%` }" /></div>
        <span class="lpv__count">{{ t('learningPrograms.learner.done', { done: v.progress.done_lessons, total: v.progress.planned_lessons }) }}</span>
      </div>
      <ol class="lpv__plan">
        <li v-for="(s, i) in v.plan" :key="i" class="lpv__step" :class="`lpv__step--${s.state}`">
          <span class="lpv__dot" aria-hidden="true">{{ s.state === 'done' ? '✓' : '' }}</span>
          <span class="lpv__stitle">{{ s.title }}</span>
          <span v-if="s.state === 'now'" class="lpv__badge">{{ t('learningPrograms.learner.nowBadge') }}</span>
        </li>
      </ol>
      <section v-if="v.next_steps.length" class="lpv__next">
        <span class="lpv__k">{{ t('learningPrograms.learner.next') }}</span>
        <p v-for="(n, i) in v.next_steps" :key="i" class="lpv__nexttitle">{{ n.title }}</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Безпечний показ програми учневі (ТЗ §5.4): ЛИШЕ окрема серверна адреса `learner-view` з білим списком полів —
 * тема, план, публічний прогрес, наступні кроки. Повного DTO тут немає взагалі (не приховування CSS-ом),
 * тож приватні нотатки, інші учні й службові поля не потрапляють у браузер навіть на мить.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { learningProgramsApi, type LearnerView } from '../api/learningProgramsApi'

const props = defineProps<{ programId: string }>()
const { t } = useI18n({ useScope: 'global' })
const v = ref<LearnerView | null>(null)
const loading = ref(true)
const failed = ref(false)

const percent = computed(() => {
  const pr = v.value?.progress
  return pr && pr.planned_lessons ? Math.round((100 * pr.done_lessons) / pr.planned_lessons) : 0
})

watch(() => props.programId, async (id) => {
  loading.value = true
  failed.value = false
  try {
    v.value = await learningProgramsApi.learnerView(id)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}, { immediate: true })
</script>

<style scoped>
.lpv { display: flex; flex-direction: column; gap: 18px; max-width: 760px; margin: 0 auto; }
.lpv__title { margin: 0; font-size: var(--text-2xl); color: var(--text-primary); }
.lpv__now { margin: 0; font-size: var(--text-xl); color: var(--text-primary); font-weight: 600; }
.lpv__k { display: block; font-size: var(--text-xs); font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.lpv__progress { display: flex; align-items: center; gap: 12px; }
.lpv__bar { flex: 1; height: 12px; border-radius: var(--radius-full); background: var(--surface-card-muted, var(--bg-secondary)); overflow: hidden; }
.lpv__fill { height: 100%; background: var(--accent); border-radius: inherit; transition: width 0.3s; }
.lpv__count { color: var(--text-secondary); white-space: nowrap; }
.lpv__plan { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.lpv__step { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-md); font-size: var(--text-lg); color: var(--text-primary); }
.lpv__step--now { background: var(--surface-card, var(--card-bg)); border: 2px solid var(--accent); font-weight: 700; }
.lpv__step--done { color: var(--text-secondary); }
.lpv__step--deferred, .lpv__step--later { color: var(--text-muted); }
.lpv__dot {
  width: 26px; height: 26px; flex: none; border-radius: 50%; border: 2px solid var(--border-color);
  display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--accent-contrast);
}
.lpv__step--done .lpv__dot { background: var(--ui-color-success); border-color: var(--ui-color-success); }
.lpv__step--now .lpv__dot { border-color: var(--accent); }
.lpv__badge { margin-left: auto; font-size: var(--text-sm); color: var(--accent); }
.lpv__next { display: flex; flex-direction: column; gap: 4px; }
.lpv__nexttitle { margin: 0; font-size: var(--text-lg); color: var(--text-primary); }
.lpv__muted { color: var(--text-secondary); }
</style>
