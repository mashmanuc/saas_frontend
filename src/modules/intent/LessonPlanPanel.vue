<script setup>
/**
 * Панель плану уроку для вчителя — Г2-г (ТЗ §3.1).
 *
 * Компактний блок над чатом Інтегралика. Стан — лише з сервера через
 * `useLessonPlan` (пропом `lp`, reactive): панель нічого не тримає сама.
 *
 * Правила, які тут не можна порушити:
 *   • етапи перемикає ЛИШЕ кнопка — Інтегралик цю панель не смикає;
 *   • чернетка від Інтегралика (`lp.draft`) стає планом лише після «Зберегти»;
 *   • 409 показуємо повідомленням (`lp.notice`), не ховаємо;
 *   • без прапорця батько цей блок не монтує взагалі (`lp.enabled`).
 */
import { ref, computed, nextTick, watch } from 'vue'
import { defaultPlan, draftView, KIND_LABELS } from './lessonPlanApi'

const props = defineProps({
  lp: { type: Object, required: true },
})

const MARK = { done: '✓', active: '●', pending: '○', skipped: '⊘' }

// ── «Новий план»: мінімальна форма — мета + п'ять етапів, назви редагуються ──
const composing = ref(false)
const form = ref(null)

function startCompose() {
  form.value = defaultPlan('')
  composing.value = true
}
function cancelCompose() { composing.value = false; form.value = null }
function removeFormStage(i) {
  if (!form.value || form.value.stages.length <= 1) return
  const wasActive = form.value.stages[i].status === 'active'
  form.value.stages.splice(i, 1)
  if (wasActive) form.value.stages[0].status = 'active'
}
const canSubmit = computed(() =>
  !!form.value && form.value.objective.trim().length > 0
  && form.value.stages.every(s => s.title.trim().length > 0))
async function submitCompose() {
  if (!canSubmit.value) return
  const ok = await props.lp.save({
    ...form.value,
    objective: form.value.objective.trim(),
    stages: form.value.stages.map(s => ({ ...s, title: s.title.trim(), goal: (s.goal || '').trim() })),
  })
  if (ok) cancelCompose()
}

const objectiveEl = ref(null)

// Сигнал від Інтегралика: «намір без теми» — відкрити порожню форму й
// поставити курсор у мету. Фокус тут не косметика: у формі п'ять полів,
// і без нього вчитель мусив би шукати, куди писати те єдине, чого бракує.
watch(() => props.lp.composeTick, (tick) => {
  if (!tick) return
  startCompose()
  nextTick(() => objectiveEl.value?.focus())
})

const draft = computed(() => draftView(props.lp.draft))

// «Наступний» на останньому етапі — завершити урок: підпис чесний, дія та сама.
const nextLabel = computed(() => props.lp.nextStageId ? 'Наступний →' : 'Завершити урок')
</script>

<template>
  <section class="lpp" aria-label="План уроку">
    <!-- 409 / помилки — не тихо -->
    <p v-if="lp.notice" class="lpp-notice">{{ lp.notice }}</p>
    <p v-if="lp.error" class="lpp-error">{{ lp.error }}</p>

    <!-- Чернетка від Інтегралика: показати, зберегти лише кнопкою -->
    <div v-if="draft" class="lpp-draft">
      <div class="lpp-title">Інтегралик пропонує план</div>
      <div class="lpp-objective">{{ draft.objective }}</div>
      <ol class="lpp-stages lpp-stages--draft">
        <li v-for="s in draft.stages" :key="s.id">
          <span class="lpp-stage-title">{{ s.title }}</span>
          <span v-if="s.goal" class="lpp-stage-goal"> — {{ s.goal }}</span>
        </li>
      </ol>
      <div class="lpp-actions">
        <button class="lpp-btn lpp-btn--primary" :disabled="lp.busy" @click="lp.saveDraft()">Зберегти план</button>
        <button class="lpp-btn" :disabled="lp.busy" @click="lp.discardDraft()">Відхилити</button>
      </div>
    </div>

    <!-- Форма «Новий план» -->
    <div v-else-if="composing" class="lpp-compose">
      <div class="lpp-title">Новий план уроку</div>
      <input
        ref="objectiveEl"
        v-model="form.objective" class="lpp-input" type="text" maxlength="200"
        placeholder="Мета уроку: чого учні мають навчитись"
        aria-label="Мета уроку"
      >
      <ol class="lpp-stages">
        <li v-for="(s, i) in form.stages" :key="s.id" class="lpp-form-stage">
          <span class="lpp-mark">{{ MARK[s.status] }}</span>
          <input v-model="s.title" class="lpp-input lpp-input--stage" type="text" maxlength="120" :aria-label="'Назва етапу ' + (i + 1)">
          <input v-model="s.goal" class="lpp-input lpp-input--goal" type="text" maxlength="200" placeholder="мета етапу (необов'язково)" :aria-label="'Мета етапу ' + (i + 1)">
          <button class="lpp-x" :disabled="form.stages.length <= 1" title="Прибрати етап" @click="removeFormStage(i)">✕</button>
        </li>
      </ol>
      <div class="lpp-actions">
        <button class="lpp-btn lpp-btn--primary" :disabled="!canSubmit || lp.busy" @click="submitCompose">Зберегти</button>
        <button class="lpp-btn" :disabled="lp.busy" @click="cancelCompose">Скасувати</button>
      </div>
    </div>

    <!-- Плану немає -->
    <div v-else-if="!lp.plan" class="lpp-empty">
      <span class="lpp-title">План уроку</span>
      <button class="lpp-btn" :disabled="lp.busy" @click="startCompose">Новий план</button>
    </div>

    <!-- План є -->
    <div v-else class="lpp-plan">
      <div class="lpp-row">
        <span class="lpp-title">План уроку</span>
        <span class="lpp-objective">· {{ lp.plan.objective }}</span>
        <button class="lpp-more" title="Видалити план" aria-label="Видалити план" :disabled="lp.busy" @click="lp.remove()">⋯</button>
      </div>
      <ol class="lpp-stages lpp-stages--inline">
        <li
          v-for="s in lp.plan.stages" :key="s.id"
          class="lpp-stage" :class="'lpp-stage--' + s.status"
          :title="s.goal || s.title"
        >
          <span class="lpp-mark">{{ MARK[s.status] }}</span>
          <span class="lpp-stage-title">{{ s.title }}</span>
        </li>
      </ol>
      <p v-if="lp.isCompleted" class="lpp-done">Урок завершено</p>
      <div class="lpp-actions">
        <button class="lpp-btn" :disabled="!lp.canPrev || lp.busy" @click="lp.stage('prev')">← Попередній</button>
        <button class="lpp-btn" :disabled="!lp.canNext || lp.busy" @click="lp.stage('skip')">Пропустити</button>
        <button class="lpp-btn lpp-btn--primary" :disabled="!lp.canNext || lp.busy" @click="lp.stage('next')">{{ nextLabel }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lpp { margin: 4px 8px 6px; padding: 6px 8px; border: 1px solid var(--cmdp-border, #e3e6ea); border-radius: 8px; font-size: 12px; line-height: 1.35; }
.lpp-title { font-weight: 600; }
.lpp-objective { opacity: .85; }
.lpp-row { display: flex; gap: 6px; align-items: baseline; }
.lpp-row .lpp-objective { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lpp-more { border: 0; background: transparent; cursor: pointer; opacity: .6; }
.lpp-more:hover { opacity: 1; }
.lpp-stages { list-style: none; margin: 4px 0; padding: 0; }
.lpp-stages--inline { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.lpp-stage { display: inline-flex; gap: 4px; align-items: center; opacity: .7; }
.lpp-stage--active { opacity: 1; font-weight: 600; }
.lpp-stage--skipped { text-decoration: line-through; }
.lpp-mark { width: 1em; text-align: center; }
.lpp-actions { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.lpp-btn { font: inherit; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--cmdp-border, #cfd4da); background: var(--cmdp-btn-bg, #fff); cursor: pointer; }
.lpp-btn:disabled { opacity: .45; cursor: default; }
.lpp-btn--primary { font-weight: 600; }
.lpp-empty { display: flex; justify-content: space-between; align-items: center; }
.lpp-notice { margin: 0 0 4px; padding: 3px 6px; border-radius: 6px; background: var(--cmdp-notice-bg, #fff6db); }
.lpp-error { margin: 0 0 4px; color: var(--cmdp-error, #b42318); }
.lpp-done { margin: 2px 0; opacity: .8; }
.lpp-input { font: inherit; width: 100%; box-sizing: border-box; padding: 3px 6px; border: 1px solid var(--cmdp-border, #cfd4da); border-radius: 6px; margin: 2px 0; }
.lpp-form-stage { display: grid; grid-template-columns: 1em 1fr 1fr auto; gap: 4px; align-items: center; }
.lpp-x { border: 0; background: transparent; cursor: pointer; opacity: .6; }
.lpp-x:disabled { opacity: .2; cursor: default; }
.lpp-stages--draft li { margin: 1px 0; }
</style>
