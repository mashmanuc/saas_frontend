<script setup>
/**
 * Панель плану уроку для вчителя — Г2-г (ТЗ §3.1) + вибір типу уроку (Г3-2).
 *
 * Компактний блок над чатом Інтегралика. Стан — лише з сервера через
 * `useLessonPlan` (пропом `lp`, reactive): панель нічого не тримає сама.
 *
 * Правила, які тут не можна порушити:
 *   • етапи перемикає ЛИШЕ кнопка — Інтегралик цю панель не смикає;
 *   • чернетка (від Інтегралика чи від типу уроку) стає планом лише після
 *     «Зберегти»; до того не змінюється ні дошка, ні активний план, ні шаблон;
 *   • тип уроку обирає ВЧИТЕЛЬ — ні модель, ні евристика з форми плану;
 *   • 409 показуємо повідомленням (`lp.notice`), не ховаємо;
 *   • без прапорця батько цей блок не монтує взагалі (`lp.enabled`).
 *
 * Учня це не стосується: у класній кімнаті палітри немає (`boardRoute.js`), і
 * він бачить лише «Етап: …» у рядку вчителя.
 */
import { ref, computed, nextTick, watch } from 'vue'
import { draftView, KIND_LABELS, LESSON_KINDS, LESSON_KIND_LABELS } from './lessonPlanApi'

const props = defineProps({
  lp: { type: Object, required: true },
})

const MARK = { done: '✓', active: '●', pending: '○', skipped: '⊘' }

// ── Форма плану: два кроки ───────────────────────────────────────────────
// 'start' — мета + тип уроку (без них не буде каркасу);
// 'edit'  — каркас від сервера, ще редагований і ще НЕ збережений.
const composing = ref(false)
const step = ref('start')
const form = ref(null)
const kind = ref('')
const objective = ref('')
// Оголошено тут, а не в своїй секції нижче: `cancelCompose` його скидає, і
// порядок оголошень у <script setup> значущий (TDZ уже клав прод 2026-09-03).
const changing = ref(false)

/** Каркас із сервера → редагована форма. Статуси лишаємо як прийшли. */
function toForm(raw) {
  const v = draftView(raw)
  if (!v) return null
  return {
    version: 1,
    objective: v.objective,
    subject: raw?.subject || 'math',
    stages: v.stages.map(s => ({ ...s, goal: s.goal || '' })),
  }
}

function startCompose() {
  composing.value = true
  step.value = 'start'
  kind.value = ''
  objective.value = ''
  form.value = null
}
function cancelCompose() {
  composing.value = false
  form.value = null
  step.value = 'start'
  changing.value = false
}
function removeFormStage(i) {
  if (!form.value || form.value.stages.length <= 1) return
  const wasActive = form.value.stages[i].status === 'active'
  form.value.stages.splice(i, 1)
  if (wasActive) form.value.stages[0].status = 'active'
}

const canBuild = computed(() => !!kind.value && objective.value.trim().length > 0)

/**
 * Каркас складає СЕРВЕР із (тип, мета): п'ять педагогічних каркасів живуть
 * там одним SSOT. Дублювати їх тут означало б, що вони розійдуться.
 * Нуль викликів моделі — це детермінована функція.
 */
async function buildSkeleton() {
  if (!canBuild.value || props.lp.busy) return
  const ok = await props.lp.requestKindDraft(kind.value, objective.value)
  if (!ok) return
  form.value = toForm(props.lp.draft)
  props.lp.discardDraft()      // чернетка переїхала у форму — транспорт вільний
  step.value = 'edit'
}

const canSubmit = computed(() =>
  !!form.value && form.value.objective.trim().length > 0
  && form.value.stages.every(s => s.title.trim().length > 0))

/** Зберегти. Конверт `{plan, lesson_kind}` — тип і план одним записом. */
async function submitCompose() {
  if (!canSubmit.value) return
  const ok = await props.lp.save({
    ...form.value,
    objective: form.value.objective.trim(),
    stages: form.value.stages.map(s => ({ ...s, title: s.title.trim(), goal: (s.goal || '').trim() })),
  }, kind.value || null)
  if (ok) cancelCompose()
}

// ── «Змінити тип уроку» для наявного плану ───────────────────────────────
// Ручна дія вчителя. Дошку не чіпає, матеріали не перегенеровує; у шаблон не
// пише взагалі — туди веде лише окрема дія «Оновити шаблон» у кімнаті.
async function pickKind(k) {
  if (props.lp.busy) return
  const ok = await props.lp.requestKindDraft(k)   // мета вже є на сервері
  if (!ok) return
  form.value = toForm(props.lp.draft)
  props.lp.discardDraft()
  kind.value = k
  objective.value = form.value?.objective || ''
  composing.value = true
  step.value = 'edit'
  changing.value = false
}

const objectiveEl = ref(null)

// Сигнал від Інтегралика: «намір без теми» — відкрити порожню форму й
// поставити курсор у мету. Фокус тут не косметика: без нього вчитель мусив би
// шукати, куди писати те єдине, чого бракує.
watch(() => props.lp.composeTick, (tick) => {
  if (!tick) return
  startCompose()
  nextTick(() => objectiveEl.value?.focus())
})

const draft = computed(() => draftView(props.lp.draft))

const kindLabel = computed(() => LESSON_KIND_LABELS[props.lp.lessonKind] || '')
const formKindLabel = computed(() => LESSON_KIND_LABELS[kind.value] || '')

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

    <!-- Форма, крок 1: мета + тип уроку -->
    <div v-else-if="composing && step === 'start'" class="lpp-compose">
      <div class="lpp-title">Новий план уроку</div>
      <input
        ref="objectiveEl"
        v-model="objective" class="lpp-input" type="text" maxlength="200"
        placeholder="Тема уроку: чого учні мають навчитись"
        aria-label="Тема уроку"
      >
      <div class="lpp-kinds" role="radiogroup" aria-label="Тип уроку">
        <button
          v-for="k in LESSON_KINDS" :key="k"
          class="lpp-kind" :class="{ 'lpp-kind--on': kind === k }"
          type="button" role="radio" :aria-checked="kind === k"
          @click="kind = k"
        >{{ LESSON_KIND_LABELS[k] }}</button>
      </div>
      <div class="lpp-actions">
        <button class="lpp-btn lpp-btn--primary" :disabled="!canBuild || lp.busy" @click="buildSkeleton">Скласти план</button>
        <button class="lpp-btn" :disabled="lp.busy" @click="cancelCompose">Скасувати</button>
      </div>
    </div>

    <!-- Форма, крок 2: каркас від сервера, ще не збережений -->
    <div v-else-if="composing && step === 'edit'" class="lpp-compose">
      <div class="lpp-title">
        Новий план<span v-if="formKindLabel">: {{ formKindLabel }}</span>
      </div>
      <input
        v-model="form.objective" class="lpp-input" type="text" maxlength="200"
        placeholder="Тема уроку: чого учні мають навчитись"
        aria-label="Тема уроку"
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
        <button class="lpp-btn lpp-btn--primary" :disabled="!canSubmit || lp.busy" @click="submitCompose">Зберегти план</button>
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
        <span v-if="kindLabel" class="lpp-kind-badge">{{ kindLabel }}</span>
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

      <!-- Вибір типу: показуємо лише коли натиснули «Змінити тип» -->
      <div v-if="changing" class="lpp-kinds" role="radiogroup" aria-label="Тип уроку">
        <button
          v-for="k in LESSON_KINDS" :key="k"
          class="lpp-kind" :class="{ 'lpp-kind--on': lp.lessonKind === k }"
          type="button" role="radio" :aria-checked="lp.lessonKind === k"
          :disabled="lp.busy" @click="pickKind(k)"
        >{{ LESSON_KIND_LABELS[k] }}</button>
        <button class="lpp-btn" :disabled="lp.busy" @click="changing = false">Скасувати</button>
      </div>

      <div class="lpp-actions">
        <button class="lpp-btn" :disabled="!lp.canPrev || lp.busy" @click="lp.stage('prev')">← Попередній</button>
        <button class="lpp-btn" :disabled="!lp.canNext || lp.busy" @click="lp.stage('skip')">Пропустити</button>
        <button class="lpp-btn lpp-btn--primary" :disabled="!lp.canNext || lp.busy" @click="lp.stage('next')">{{ nextLabel }}</button>
        <button v-if="!changing" class="lpp-btn" :disabled="lp.busy" @click="changing = true">Змінити тип</button>
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
.lpp-kinds { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 2px; }
.lpp-kind { font: inherit; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--cmdp-border, #cfd4da); background: var(--cmdp-btn-bg, #fff); cursor: pointer; }
.lpp-kind--on { font-weight: 600; border-color: currentColor; }
.lpp-kind:disabled { opacity: .45; cursor: default; }
.lpp-kind-badge { padding: 0 6px; border-radius: 999px; border: 1px solid var(--cmdp-border, #cfd4da); opacity: .85; white-space: nowrap; }
</style>
