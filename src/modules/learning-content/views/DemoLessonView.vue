<script setup>
/**
 * Проходження заняття — тонкий шар над машиною станів.
 *
 * Уся логіка маршруту живе в `lessonMachine.ts` і перевіряється тестами
 * без браузера. Тут лишається лише показ: що намалювати для поточного
 * кроку і які події віддати машині. Якщо тягне дописати сюди «а якщо
 * учень двічі помилився…» — це ознака, що правило має бути в машині.
 *
 * Свідомі межі: план статичний (`/lesson-<підціль>.json`, зібраний
 * `build_lesson.py`), бекенд не чіпано, прогрес не зберігається,
 * діагностики й фіналу немає.
 *
 * Адреса: `?lesson=percent.of_number` обирає заняття,
 * `?step=N` — крок основної лінії (зручно перевіряти конкретний блок).
 *
 * Дошки тут НЕМА — свідомо (рішення власника 2026-08-31). Курс і дошка
 * розділені архітектурно: курс веде навчальний потік, а дошка буде
 * ОКРЕМИМ курсовим інструментом на кроці типу `solve` — одна задача,
 * мінімум інструментів, розпізнавання почерку, — а не універсальним
 * winterboard. Задачі-вибір нижче це ПЕРЕВІРКА, не розв'язування.
 *
 * Математика рендериться `renderTextWithLatex` — тим самим шляхом, що
 * решта контенту (KaTeX-сумісність доведена гейтом: 283 биті → 14).
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { renderTextWithLatex } from '../utils/contentRenderer'
import {
  advance,
  answer,
  back,
  canAdvance,
  canGoBack,
  createRun,
  currentStep,
  isAnswered,
  isFinished,
  position,
  progress,
  report,
  findDeadEnds,
  validatePlan,
} from '../lessonMachine'
import {
  adviseNext,
  applyReport,
  emptyLearnerState,
  persistentRoots,
} from '../learnerState'
import { clearRun, loadRun, saveRun } from '../progressStore'

/**
 * Типи кроків, які ця в'юшка вміє показати.
 *
 * `solve` свідомо ЗЗОВНІ: курсова дошка ще не побудована. Машина його
 * завершити вміє (`completeSolve`), а показати нема чим — тож план із
 * `solve` тут відхиляється НАЗВАНОЮ причиною, а не зависає порожнім
 * екраном. Межа має бути видною, а не з'ясовуватись кліком.
 */
const RENDERABLE = ['hook', 'explain', 'emphasis', 'example', 'check', 'remediate', 'summary']

/** Заняття за замовчуванням, якщо в адресі нічого не сказано. */
const DEFAULT_LESSON = 'percent.concept'

/**
 * Де лежить стан учня. localStorage — свідома тимчасова межа: без
 * бекенду це єдине чесне сховище, і воно не вдає, ніби прогрес
 * переживе інший пристрій. Модуль `learnerState` про сховище не
 * знає, тож заміна на бекенд не зачепить контракт.
 */
const LEARNER_KEY = 'm4sh:learner-state:v1'

function loadLearner() {
  try {
    const raw = localStorage.getItem(LEARNER_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.version === 1 ? parsed : emptyLearnerState()
  } catch {
    // приватне вікно чи биті дані — заняття має грати однаково
    return emptyLearnerState()
  }
}

function saveLearner(state) {
  try {
    localStorage.setItem(LEARNER_KEY, JSON.stringify(state))
  } catch {
    // не зберіглось — це не привід ламати проходження
  }
}

const route = useRoute()

const plan = ref(null)
const run = ref(null)
const error = ref('')
const nav = ref(null) // низ блоку — щоб «Далі» не тікав за екран
const learner = ref(emptyLearnerState())
const advice = ref(null)
/** чи повернулись у збережене місце — щоб сказати про це вголос */
const resumed = ref(false)

onMounted(async () => {
  try {
    // Яке заняття показати: /demo-lesson?lesson=percent.of_number
    // Дозволені лише «літери, крапки, дефіси» — значення йде в URL, і
    // приймати звідти довільний шлях означало б дати `../` у запит.
    const asked = String(route.query.lesson ?? DEFAULT_LESSON)
    const which = /^[a-z0-9._-]+$/i.test(asked) ? asked : DEFAULT_LESSON

    const res = await fetch(`/lesson-${which}.json`)
    if (!res.ok) throw new Error(`заняття «${which}» не знайдено (HTTP ${res.status})`)
    const loaded = await res.json()

    // План перевіряємо ДО показу: краще сказати, що він битий, ніж
    // показати учневі порожній екран посеред заняття.
    const problems = validatePlan(loaded)
    if (problems.length) {
      error.value = `План заняття непридатний: ${problems
        .map((p) => `${p.stepId} — ${p.problem}`)
        .join('; ')}`
      return
    }

    // Стани, з яких учень не вийде за жодних відповідей. Валідатор
    // посилань цього не бачить: цілі можуть існувати, а маршрут — кружляти.
    const stuck = findDeadEnds(loaded)
    if (stuck.length) {
      error.value = `У плані є кроки без виходу: ${stuck.join(', ')}`
      return
    }

    const unknown = loaded.steps.filter((s) => !RENDERABLE.includes(s.type))
    if (unknown.length) {
      error.value =
        `Заняття містить кроки, які ця сторінка ще не вміє показати: ` +
        `${unknown.map((s) => `${s.id} (${s.type})`).join(', ')}.`
      return
    }

    plan.value = loaded
    learner.value = loadLearner()

    // Незавершене проходження, якщо воно ПРИДАТНЕ до цього плану.
    // `loadRun` сам відкидає стан із кроком, якого в плані вже немає:
    // банк перезбирається, і мовчки відновлений стан дав би порожній
    // екран людині, яка ні в чому не винна.
    const saved = loadRun(loaded, loaded.id)
    resumed.value = !!saved
    run.value = saved ?? createRun(loaded)

    // Пряме посилання на крок переважає збережене: якщо в адресі назвали
    // крок, людина просила саме його.
    const want = Number(route.query.step)
    const main = loaded.steps.filter((s) => s.type !== 'remediate')
    if (Number.isInteger(want) && want > 0 && want <= main.length) {
      run.value = { ...run.value, stepId: main[want - 1].id, path: [main[want - 1].id] }
      resumed.value = false
    }
  } catch (e) {
    error.value = `Не вдалось завантажити заняття: ${e.message}`
  }
})

const ready = computed(() => !!plan.value && !!run.value)
const step = computed(() => (ready.value ? currentStep(plan.value, run.value) : null))
const place = computed(() => (ready.value ? position(plan.value, run.value) : null))
const percent = computed(() => (ready.value ? progress(plan.value, run.value) : 0))
const finished = computed(() => ready.value && isFinished(plan.value, run.value))
const forward = computed(() => ready.value && canAdvance(plan.value, run.value))
const backward = computed(() => ready.value && canGoBack(run.value))
const answered = computed(() => !!step.value && isAnswered(run.value, step.value.id))
const given = computed(() => (answered.value ? run.value.answers[step.value.id] : null))
const learned = computed(() => (run.value ? report(run.value) : null))

/**
 * Наступне заняття за порядком КУРСУ. Порахувати його можна завжди —
 * навіть коли порада каже «повтори»: рада не приховує шлях далі.
 */
const nextLesson = computed(() => {
  const order = plan.value?.courseOrder ?? []
  const i = order.indexOf(plan.value?.id)
  return i >= 0 ? order[i + 1] : undefined
})

/**
 * Абзаци + формули. `**жирний**` тут НЕ чіпаємо: renderTextWithLatex
 * уміє його сам (renderInlineMarkdown), а власна перед-обробка давала
 * `<strong>` ДО екранування — і теги показувались учневі як текст.
 */
function render(text) {
  if (!text) return ''
  return String(text)
    .split('\n\n')
    .map((p) => `<p>${renderTextWithLatex(p)}</p>`)
    .join('')
}

function inline(text) {
  return renderTextWithLatex(String(text ?? ''))
}

/**
 * Людська назва кореня. Якщо назви нема — показуємо сам ключ, а не
 * ховаємо рядок: непорозуміння, якого ми ще не назвали, лишається
 * видним, а не зникає зі звіту.
 */
function rootLabel(id) {
  return plan.value?.roots?.[id] ?? id
}

function choose(index) {
  run.value = answer(plan.value, run.value, index)
  saveRun(plan.value.id, run.value)
  // Розбір розгортається і виштовхує «Далі» за екран — знайдено
  // проходженням. Підтягуємо кінець блоку до видимої області.
  nextTick(() => nav.value?.scrollIntoView({ block: 'end', behavior: 'smooth' }))
}

function goNext() {
  run.value = advance(plan.value, run.value)
  resumed.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
  saveRun(plan.value.id, run.value)
  if (isFinished(plan.value, run.value)) finish()
}

/**
 * Заняття скінчилось: підсумок вливається у стан учня.
 *
 * `applyReport` не подвоює лічильники для того самого заняття, тож
 * повторний виклик (перезавантаження, крок назад і знову вперед)
 * безпечний — перевіряти «чи вже писали» тут не треба.
 */
function finish() {
  const next = applyReport(learner.value, plan.value.id, report(run.value))
  learner.value = next
  saveLearner(next)
  advice.value = adviseNext(next, plan.value.courseOrder ?? [], plan.value.id)
  // Заняття зараховане у стан учня — чернетка проходження відпрацювала.
  // Лишити її означало б, що «пройдено» і «на кроці 9» співіснують.
  clearRun(plan.value.id)
}

function goBack() {
  run.value = back(run.value)
  resumed.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
  saveRun(plan.value.id, run.value)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <p v-if="error" class="rounded-lg bg-red-50 p-4 text-red-700">{{ error }}</p>

    <template v-else-if="step">
      <!-- шапка: де учень зараз -->
      <header class="mb-6">
        <div class="flex items-baseline justify-between gap-3">
          <h1 class="text-xl font-semibold text-gray-900">{{ plan.course }}</h1>
          <span class="text-sm text-gray-500">
            Заняття {{ plan.session }} · {{ plan.subgoal }}
          </span>
        </div>
        <div class="mt-3 h-1.5 w-full rounded-full bg-gray-200">
          <div
            class="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <p class="mt-1 text-xs text-gray-400">
          крок {{ place.index }} з {{ place.total }}
          <span v-if="resumed" class="text-indigo-500"> · продовжуємо з місця, де зупинились</span>
          <span v-if="step.type === 'remediate'"> · розбираємось окремо</span>
        </p>
      </header>

      <!-- один крок маршруту -->
      <section
        class="rounded-2xl border bg-white p-6 shadow-sm"
        :class="step.type === 'remediate' ? 'border-amber-300' : 'border-gray-200'"
      >
        <h2 class="mb-4 text-lg font-medium text-gray-900">
          <span v-if="step.type === 'remediate'" class="mr-1">🔍</span>{{ step.title }}
        </h2>

        <div
          v-if="step.body"
          class="space-y-3 leading-relaxed text-gray-800"
          v-html="render(step.body)"
        />

        <!-- приклади -->
        <ul v-if="step.type === 'example'" class="space-y-3">
          <li v-for="(ex, i) in step.items" :key="i" class="rounded-lg bg-gray-50 px-4 py-3">
            <span class="text-gray-700" v-html="inline(ex.q)" />
            <span class="mx-2 text-gray-400">→</span>
            <span class="font-medium text-gray-900" v-html="inline(ex.a)" />
          </li>
        </ul>

        <!-- перевірка: маршрут далі залежить від цієї відповіді -->
        <div v-if="step.type === 'check'">
          <p class="mb-4 text-gray-900" v-html="inline(step.text)" />

          <div class="space-y-2">
            <button
              v-for="(c, ci) in step.choices"
              :key="ci"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition"
              :class="[
                !answered && 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50',
                answered && c.correct && 'border-green-500 bg-green-50',
                answered && !c.correct && given.choice === ci && 'border-red-400 bg-red-50',
                answered && !c.correct && given.choice !== ci && 'border-gray-200 opacity-60',
              ]"
              :disabled="answered"
              @click="choose(ci)"
            >
              <span class="text-gray-900" v-html="inline(c.text)" />
            </button>
          </div>

          <!-- розбір: після дії, не до неї -->
          <div
            v-if="answered"
            class="mt-4 rounded-lg px-4 py-3"
            :class="given.correct ? 'bg-green-50' : 'bg-amber-50'"
          >
            <p
              class="mb-1 text-sm font-medium"
              :class="given.correct ? 'text-green-800' : 'text-amber-800'"
            >
              {{ given.correct ? 'Правильно' : 'Не вийшло — подивись, як це працює' }}
            </p>
            <p class="text-sm text-gray-800" v-html="inline(step.solution)" />
          </div>
        </div>

        <!-- підсумок: що заняття дізналось про учня -->
        <div
          v-if="step.type === 'summary' && learned && learned.answered"
          class="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700"
        >
          <p>Відповів правильно: {{ learned.correct }} з {{ learned.answered }}.</p>
          <p v-if="learned.roots.length" class="mt-1">
            Над чим варто попрацювати:
            <span class="font-medium">{{ learned.roots.map(rootLabel).join(', ') }}</span>.
          </p>
        </div>

        <!-- що далі: РАДА зі стану учня, а не заборона.
             Наступне заняття лишається доступним у будь-якому разі. -->
        <div
          v-if="step.type === 'summary' && advice"
          class="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm"
        >
          <p v-if="advice.kind === 'repeat'" class="text-gray-800">
            <span class="font-medium">Це вже не вперше:</span>
            {{ advice.roots.map(rootLabel).join(', ') }} —
            траплялось не в одному занятті. Варто закріпити.
          </p>
          <p v-else-if="advice.kind === 'done'" class="text-gray-800">
            Це останнє заняття курсу. Далі — повторення того, що хочеш.
          </p>
          <p v-else class="text-gray-800">Можна рухатись далі.</p>

          <a
            v-if="nextLesson"
            :href="`/demo-lesson?lesson=${nextLesson}`"
            class="mt-2 inline-block font-medium text-indigo-700 hover:text-indigo-900"
          >
            Наступне заняття →
          </a>
        </div>

        <!-- навігація -->
        <div ref="nav" class="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <button
            type="button"
            class="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40"
            :disabled="!backward"
            @click="goBack"
          >
            ← Назад
          </button>

          <button
            v-if="!finished"
            type="button"
            class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            :disabled="!forward"
            @click="goNext"
          >
            {{ forward ? 'Далі →' : 'Обери відповідь' }}
          </button>
          <span v-else class="text-sm font-medium text-green-700">Заняття пройдено ✓</span>
        </div>
      </section>

      <!-- чесна межа демо -->
      <p class="mt-4 text-xs text-gray-400">Демо-доріжка: {{ plan.note }}</p>
      <p class="mt-1 text-xs text-gray-400">
        Джерело методики: {{ plan.sourceLessons?.join(', ') }}
      </p>
    </template>

    <p v-else class="text-gray-500">Завантаження…</p>
  </div>
</template>
