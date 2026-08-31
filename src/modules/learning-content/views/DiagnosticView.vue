<script setup>
/**
 * Вступна діагностика — тонкий шар над `diagnostic.ts`.
 *
 * Тон тут не менш важливий за алгоритм. DIAGNOSTIC_PROFILE_SSOT §3:
 * «діагностика на старті = найризикованіший момент воронки: учень, що
 * провалив тест на першій хвилині, не повернеться». Тому:
 *   • ніде не сказано «тест», «іспит», «оцінка»;
 *   • прямо сказано, що помилка — корисна інформація;
 *   • після відповіді НЕ показуємо, правильно чи ні: це вимір, і
 *     реакція на кожну відповідь перетворила б його на екзамен;
 *   • наприкінці — людське речення, БЕЗ чисел (§2 п.4).
 *
 * Розбору теж немає — не через брак часу, а тому, що показаний розбір
 * підказує наступну задачу, і далі ми міряємо вже підказане.
 */
import { ref, computed, onMounted } from 'vue'
import { renderTextWithLatex } from '../utils/contentRenderer'
import {
  answerDiagnostic,
  buildProfile,
  createDiagnosticRun,
  currentTask,
  diagnosticProgress,
  isDiagnosticDone,
  rootsFromRun,
} from '../diagnostic'
import { applyReport, emptyLearnerState } from '../learnerState'
import {
  clearDiagnosticRun,
  loadDiagnosticRun,
  saveDiagnosticRun,
} from '../progressStore'

const LEARNER_KEY = 'm4sh:learner-state:v1'

const pool = ref(null)
const run = ref(null)
const profile = ref(null)
const error = ref('')
const started = ref(false)
const resumed = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/diagnostic-percent.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pool.value = await res.json()

    // Незавершена діагностика: §3 прямо каже «можна перервати — стан
    // зберігається, як у звичайному занятті». Придатність перевіряємо
    // тим самим правилом, що й у заняття: задача має існувати в пулі.
    const saved = loadDiagnosticRun()
    const known = new Set(pool.value.tasks.map((t) => t.id))
    if (saved?.currentId && known.has(saved.currentId)) {
      run.value = saved
      started.value = true
      resumed.value = true
    }
  } catch (e) {
    error.value = `Не вдалось завантажити діагностику: ${e.message}`
  }
})

const task = computed(() =>
  pool.value && run.value ? currentTask(pool.value, run.value) : null,
)
const percent = computed(() =>
  pool.value && run.value ? diagnosticProgress(pool.value, run.value) : 0,
)
const subgoalNow = computed(() =>
  task.value ? (pool.value.subgoalLabels[task.value.subgoal] ?? '') : '',
)

/** Що радимо робити далі — з профілю, людськими словами. */
const plan = computed(() => {
  if (!profile.value) return []
  return profile.value.subgoals
    .filter((s) => s.state !== 'solid')
    .map((s) => ({
      label: s.label,
      state: s.state,
      // які заняття існують — каже сам пул (`lessons`), а не список тут:
      // друга копія порядку курсу відстала б на першій новій підцілі
      lesson: (pool.value?.lessons ?? []).includes(s.subgoal) ? s.subgoal : null,
    }))
})

const STATE_WORD = {
  absent: 'починаємо з нуля',
  fragile: 'тримається хитко',
  working: 'у роботі',
  not_measured: 'не встигли перевірити',
}

function inline(t) {
  return renderTextWithLatex(String(t ?? ''))
}

function start() {
  run.value = createDiagnosticRun(pool.value)
  started.value = true
}

function pick(index) {
  run.value = answerDiagnostic(pool.value, run.value, index)
  resumed.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
  saveDiagnosticRun(run.value)
  if (isDiagnosticDone(run.value)) finish()
}

function finish() {
  clearDiagnosticRun()
  profile.value = buildProfile(pool.value, run.value, (pool.value.lessons ?? []).length)

  // Корені діагностики йдуть у той самий стан учня, що й корені занять —
  // ключ той самий (`rootId`), тож повторення впізнається наскрізно.
  try {
    const raw = localStorage.getItem(LEARNER_KEY)
    const prev = raw && JSON.parse(raw)?.version === 1 ? JSON.parse(raw) : emptyLearnerState()
    const roots = rootsFromRun(run.value)
    const next = applyReport(prev, `diagnostic:${pool.value.topicId}`, {
      answered: run.value.askedIds.length,
      solved: 0,
      correct: Object.values(run.value.evidence)
        .flat()
        .filter((e) => e.result === 'correct').length,
      roots,
      mistakes: [],
      treated: [],
    })
    localStorage.setItem(LEARNER_KEY, JSON.stringify(next))
  } catch {
    // сховище недоступне — профіль однаково показуємо
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <p v-if="error" class="rounded-lg bg-red-50 p-4 text-red-700">{{ error }}</p>

    <!-- 1. Запрошення. Тон задається тут, і далі його вже не виправиш. -->
    <section
      v-else-if="pool && !started"
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 class="text-xl font-semibold text-gray-900">
        Подивимось, звідки стартуємо
      </h1>
      <div class="mt-4 space-y-3 leading-relaxed text-gray-800">
        <p>
          Тема — <strong>{{ pool.topic }}</strong>. Кілька коротких питань, щоб
          зрозуміти, що ти вже вмієш, а де варто затриматись.
        </p>
        <p>
          Це <strong>не тест і не оцінка</strong>. Помилка тут корисніша за
          правильну відповідь: саме вона показує, куди дивитись. Розбори будуть
          на заняттях, а зараз просто обирай те, що вважаєш правильним.
        </p>
        <p class="text-sm text-gray-500">Займе кілька хвилин.</p>
      </div>
      <button
        type="button"
        class="mt-6 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="start"
      >
        Почати
      </button>
    </section>

    <!-- 2. Питання. Жодної реакції на відповідь — це вимір. -->
    <template v-else-if="task">
      <header class="mb-6">
        <div class="flex items-baseline justify-between gap-3">
          <h1 class="text-xl font-semibold text-gray-900">{{ pool.topic }}</h1>
          <span class="text-sm text-gray-500">{{ subgoalNow }}</span>
        </div>
        <p v-if="resumed" class="mt-1 text-xs text-indigo-500">
          продовжуємо з місця, де зупинились
        </p>
        <div class="mt-3 h-1.5 w-full rounded-full bg-gray-200">
          <div
            class="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
            :style="{ width: `${percent}%` }"
          />
        </div>
      </header>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p class="mb-4 text-gray-900" v-html="inline(task.text)" />
        <div class="space-y-2">
          <button
            v-for="(c, i) in task.choices"
            :key="i"
            type="button"
            class="flex w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
            @click="pick(i)"
          >
            <span class="text-gray-900" v-html="inline(c.text)" />
          </button>
        </div>
        <p class="mt-4 text-xs text-gray-400">
          Не знаєш — обери те, що здається ближчим. Це теж корисний сигнал.
        </p>
      </section>
    </template>

    <!-- 3. Профіль. Людське речення, без чисел (§2 п.4). -->
    <section
      v-else-if="profile"
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 class="text-xl font-semibold text-gray-900">Ось що видно</h1>
      <p class="mt-3 leading-relaxed text-gray-800">
        {{ profile.recommendation.humanSummary }}
      </p>

      <ul v-if="plan.length" class="mt-5 space-y-2">
        <li
          v-for="p in plan"
          :key="p.label"
          class="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
        >
          <span class="text-gray-800">{{ p.label }}</span>
          <span class="flex items-center gap-3">
            <span class="text-gray-500">{{ STATE_WORD[p.state] }}</span>
            <a
              v-if="p.lesson"
              :href="`/demo-lesson?lesson=${p.lesson}`"
              class="font-medium text-indigo-700 hover:text-indigo-900"
            >
              до заняття →
            </a>
            <span v-else class="text-gray-400">заняття ще готується</span>
          </span>
        </li>
      </ul>
      <p v-else class="mt-4 text-sm text-gray-600">
        Провалів немає — курс тут тобі мало що додасть.
      </p>

      <p
        v-if="profile.recommendation.scopeWarning"
        class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Це більше, ніж уміщується в поточний курс. Варто або додати занять, або
        звузити тему — вирішувати тобі.
      </p>

      <p class="mt-5 text-xs text-gray-400">
        Діагностика дає стартову картину, а не остаточну: заняття уточнюють її
        далі.
      </p>
    </section>

    <p v-else class="text-gray-500">Завантаження…</p>
  </div>
</template>
