<script setup>
/**
 * Підсумкова робота теми — тонкий шар над `finalWork.ts`.
 *
 * Тон інший, ніж у діагностики, і це навмисно. Діагностика вмовляє не
 * боятись, бо це перша хвилина воронки. Сюди людина приходить після
 * чотирьох занять, і применшувати вагу роботи («та це так, дрібниця»)
 * означало б знецінити те, що вона зробила. Тому прямо: це перевірка,
 * вона показує, чого навчив курс, і її результат чесний.
 *
 * Чого тут немає і чому:
 *   • реакції на відповідь — підказана задача більше нічого не міряє;
 *   • оцінки в балах — вихід той самий, що в діагностики: стан по
 *     підцілях і людське речення;
 *   • «спробуй ще раз» одразу після провалу — правильна відповідь на
 *     провал це заняття, а не друга спроба того самого набору.
 */
import { ref, computed, onMounted } from 'vue'
import { renderTextWithLatex } from '../utils/contentRenderer'
import {
  answerFinal,
  buildFinalResult,
  createFinalRun,
  finalProgress,
  finalTask,
  isFinalDone,
} from '../finalWork'
import { applyReport, emptyLearnerState } from '../learnerState'
import {
  clearFinalRun,
  loadDiagnosticProfile,
  loadFinalRun,
  saveFinalRun,
} from '../progressStore'

const LEARNER_KEY = 'm4sh:learner-state:v1'

const work = ref(null)
const run = ref(null)
const result = ref(null)
const error = ref('')
const started = ref(false)
const resumed = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/final-percent.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    work.value = await res.json()

    // Незавершена робота відновлюється так само, як заняття: перервати
    // підсумок — не гріх, а почати його заново через закриту вкладку —
    // покарання ні за що.
    const saved = loadFinalRun(work.value.topicId)
    if (saved && Array.isArray(saved.answers) && saved.index < work.value.tasks.length) {
      run.value = saved
      started.value = true
      resumed.value = saved.index > 0
    }
  } catch (e) {
    error.value = `Не вдалось завантажити підсумкову роботу: ${e.message}`
  }
})

const task = computed(() => (work.value && run.value ? finalTask(work.value, run.value) : null))
const percent = computed(() =>
  work.value && run.value ? finalProgress(work.value, run.value) : 0,
)
const step = computed(() => (run.value ? run.value.index + 1 : 1))

function inline(t) {
  return renderTextWithLatex(String(t ?? ''))
}

function start() {
  run.value = createFinalRun()
  started.value = true
}

function pick(index) {
  run.value = answerFinal(work.value, run.value, index)
  resumed.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
  saveFinalRun(work.value.topicId, run.value)
  if (isFinalDone(work.value, run.value)) finish()
}

function finish() {
  clearFinalRun(work.value.topicId)
  const before = loadDiagnosticProfile(work.value.topicId)
  result.value = buildFinalResult(work.value, run.value, before)

  // Корені підсумкової йдуть у той самий стан учня — ключ той самий
  // (`rootId`), тож «це вже не вперше» працює і через підсумок.
  try {
    const raw = localStorage.getItem(LEARNER_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const prev = parsed?.version === 1 ? parsed : emptyLearnerState()
    const next = applyReport(prev, `final:${work.value.topicId}`, {
      answered: result.value.total,
      solved: 0,
      correct: result.value.correct,
      roots: result.value.roots,
      mistakes: [],
      treated: [],
      practice: { attempts: 0, correct: 0 },
    })
    localStorage.setItem(LEARNER_KEY, JSON.stringify(next))
  } catch {
    // сховище недоступне — результат однаково показуємо
  }
}

const STATE_WORD = {
  solid: 'тримається',
  working: 'у роботі',
  absent: 'не склалось',
  not_measured: 'не міряли',
}

const STATE_CLASS = {
  solid: 'text-green-700',
  working: 'text-amber-700',
  absent: 'text-red-700',
  not_measured: 'text-gray-400',
}

const MOVE = { up: '↑', down: '↓', same: '=' }

/** Куди повернутись — заняття тих підцілей, що не склались. */
const backTo = computed(() =>
  (result.value?.subgoals ?? []).filter((s) => s.state === 'absent' || s.state === 'working'),
)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <p v-if="error" class="rounded-lg bg-red-50 p-4 text-red-700">{{ error }}</p>

    <!-- 1. Вхід. Кажемо прямо, що це і чому без підказок. -->
    <section
      v-else-if="work && !started && !result"
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 class="text-xl font-semibold text-gray-900">Підсумкова робота</h1>
      <div class="mt-4 space-y-3 leading-relaxed text-gray-800">
        <p>
          Тема — <strong>{{ work.topic }}</strong>. {{ work.tasks.length }} задач, по дві
          на кожне вміння курсу. Жодної з тих, що були на заняттях.
        </p>
        <p>
          Розборів під час роботи не буде: показана відповідь підказує наступну
          задачу, і далі перевірка міряла б уже підказане. Усе покажемо в кінці —
          разом із тим, що було на початку.
        </p>
        <p class="text-sm text-gray-500">
          Робота в усіх однакова, тож її результат можна порівнювати — і з
          власним стартом, і між спробами.
        </p>
      </div>
      <button
        type="button"
        class="mt-6 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="start"
      >
        Почати
      </button>
      <a href="/course" class="ml-4 text-sm text-gray-500 hover:text-gray-700">← до курсу</a>
    </section>

    <!-- 2. Задачі. Жодної реакції — це вимір. -->
    <template v-else-if="task">
      <header class="mb-6">
        <div class="flex items-baseline justify-between gap-3">
          <h1 class="text-xl font-semibold text-gray-900">Підсумкова робота</h1>
          <span class="text-sm text-gray-500">
            {{ step }} з {{ work.tasks.length }}
          </span>
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
      </section>
    </template>

    <!-- 3. Результат: стан по вміннях + рух проти старту. -->
    <section
      v-else-if="result"
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h1 class="text-xl font-semibold text-gray-900">Що вийшло</h1>
      <p class="mt-3 leading-relaxed text-gray-800">{{ result.humanSummary }}</p>

      <ul class="mt-5 space-y-2">
        <li
          v-for="s in result.subgoals"
          :key="s.subgoal"
          class="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
        >
          <span class="text-gray-800">{{ s.label }}</span>
          <span class="flex items-center gap-3">
            <span
              v-if="s.direction"
              :title="`на старті: ${STATE_WORD[s.movedFrom] ?? s.movedFrom}`"
              :class="{
                'text-green-600': s.direction === 'up',
                'text-red-600': s.direction === 'down',
                'text-gray-300': s.direction === 'same',
              }"
            >
              {{ MOVE[s.direction] }}
            </span>
            <span :class="STATE_CLASS[s.state]">{{ STATE_WORD[s.state] }}</span>
          </span>
        </li>
      </ul>

      <p v-if="!result.compared" class="mt-4 text-xs text-gray-400">
        Порівняти зі стартом не з чим: діагностику в цьому браузері не проходили.
      </p>

      <!-- Провал = привід повернутись на заняття, а не перескладати те саме -->
      <div v-if="backTo.length" class="mt-6 rounded-lg bg-amber-50 px-4 py-3">
        <p class="text-sm text-amber-900">Варто повернутись:</p>
        <ul class="mt-2 space-y-1">
          <li v-for="s in backTo" :key="s.subgoal" class="text-sm">
            <a
              :href="`/demo-lesson?lesson=${s.subgoal}`"
              class="font-medium text-amber-900 underline hover:text-amber-950"
            >
              {{ s.label }} →
            </a>
          </li>
        </ul>
      </div>
      <p v-else class="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
        Тема закрита. Можна братись за наступну.
      </p>

      <p class="mt-5 text-xs text-gray-400">
        Це не оцінка й не бали: робота показує, де вміння тримається, а де ще ні.
      </p>
      <a href="/course" class="mt-4 inline-block text-sm text-indigo-700 hover:text-indigo-900">
        ← до курсу
      </a>
    </section>

    <p v-else class="text-gray-500">Завантаження…</p>
  </div>
</template>
