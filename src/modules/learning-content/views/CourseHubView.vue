<script setup>
/**
 * Вітрина курсу — єдине місце, де видно, де ти зупинився.
 *
 * Навіщо окрема сторінка, а не список усередині заняття: заняття знає
 * лише про себе. Питання «що вже пройдено і що далі» стосується КУРСУ,
 * і відповідати на нього зсередини одного заняття означало б, що кожне
 * з них тримає копію порядку й копію прогресу.
 *
 * Порядок курсу читається з планів (`courseOrder`), стан — зі сховища
 * проходжень і зі стану учня. Тут не вирішується нічого: сторінка лише
 * показує те, що вже вирішили машина заняття й стан учня.
 */
import { ref, computed, onMounted } from 'vue'
import { emptyLearnerState, persistentRoots } from '../learnerState'
import { lessonProgress } from '../progressStore'

/** З якої підцілі починається курс — решту дає її ж `courseOrder`. */
const ENTRY = 'percent.concept'
const LEARNER_KEY = 'm4sh:learner-state:v1'

const lessons = ref([])
const learner = ref(emptyLearnerState())
const course = ref('')
const error = ref('')

function loadLearner() {
  try {
    const raw = localStorage.getItem(LEARNER_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.version === 1 ? parsed : emptyLearnerState()
  } catch {
    return emptyLearnerState()
  }
}

onMounted(async () => {
  try {
    learner.value = loadLearner()

    const first = await (await fetch(`/lesson-${ENTRY}.json`)).json()
    course.value = first.course
    const order = first.courseOrder ?? [ENTRY]

    const plans = await Promise.all(
      order.map(async (id) => {
        const res = await fetch(`/lesson-${id}.json`)
        return res.ok ? res.json() : null
      }),
    )

    lessons.value = plans.filter(Boolean).map((plan) => ({
      id: plan.id,
      session: plan.session,
      subgoal: plan.subgoal,
      objective: plan.objective,
      progress: lessonProgress(plan, plan.id, learner.value.completed ?? []),
    }))
  } catch (e) {
    error.value = `Не вдалось прочитати курс: ${e.message}`
  }
})

const diagnosticDone = computed(() =>
  (learner.value.completed ?? []).some((id) => id.startsWith('diagnostic:')),
)

/** Куди веде велика кнопка згори: продовжити почате або взяти наступне. */
const resumeTarget = computed(() => {
  const started = lessons.value.find((l) => l.progress.state === 'in-progress')
  if (started) return { id: started.id, label: 'Продовжити', hint: started.subgoal }
  const next = lessons.value.find((l) => l.progress.state === 'new')
  if (next) return { id: next.id, label: 'Далі', hint: next.subgoal }
  return null
})

const done = computed(() => lessons.value.filter((l) => l.progress.state === 'done').length)

/**
 * Підсумкова робота — РАДИМО після всіх занять, але не замикаємо.
 *
 * Замок тут був би тим самим, чого ми не робимо у графі передумов:
 * рекомендація не має права ставати забороною. Людина, яка хоче спершу
 * перевірити себе, має на це право — вона й побачить, чого бракує.
 */
const finalReady = computed(() => lessons.value.length > 0 && done.value === lessons.value.length)
const finalDone = computed(() =>
  (learner.value.completed ?? []).some((id) => id.startsWith('final:')),
)

/** Що курс уже знає про учня — назви коренів, а не лічилка. */
const weak = computed(() => persistentRoots(learner.value))

const LABEL = {
  new: 'не починали',
  'in-progress': 'у процесі',
  done: 'пройдено',
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <p v-if="error" class="rounded-lg bg-red-50 p-4 text-red-700">{{ error }}</p>

    <template v-else-if="lessons.length">
      <header class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">{{ course }}</h1>
        <p class="mt-1 text-sm text-gray-500">
          {{ done }} з {{ lessons.length }} занять пройдено
        </p>
      </header>

      <!-- Одна велика дія: продовжити те, що почато. -->
      <a
        v-if="resumeTarget"
        :href="`/demo-lesson?lesson=${resumeTarget.id}`"
        class="mb-6 flex items-center justify-between rounded-2xl bg-indigo-600 px-6 py-4 text-white transition hover:bg-indigo-700"
      >
        <span>
          <span class="block text-lg font-medium">{{ resumeTarget.label }}</span>
          <span class="block text-sm text-indigo-100">{{ resumeTarget.hint }}</span>
        </span>
        <span class="text-2xl">→</span>
      </a>

      <!-- Діагностика: вхід у тему, не заняття. -->
      <a
        href="/diagnostic"
        class="mb-6 flex items-center justify-between rounded-xl border px-5 py-4 transition"
        :class="diagnosticDone
          ? 'border-gray-200 bg-white hover:border-indigo-300'
          : 'border-indigo-200 bg-indigo-50/60 hover:border-indigo-400'"
      >
        <span>
          <span class="block font-medium text-gray-900">
            {{ diagnosticDone ? 'Пройти діагностику ще раз' : 'Почати з діагностики' }}
          </span>
          <span class="block text-sm text-gray-500">
            {{ diagnosticDone
              ? 'корисно, коли минув час і хочеш перевірити себе'
              : 'кілька питань, щоб зрозуміти, звідки стартувати' }}
          </span>
        </span>
        <span class="text-gray-400">→</span>
      </a>

      <ul class="space-y-2">
        <li
          v-for="l in lessons"
          :key="l.id"
          class="rounded-xl border border-gray-200 bg-white transition hover:border-indigo-300"
        >
          <a
            :href="`/demo-lesson?lesson=${l.id}`"
            class="flex items-center justify-between gap-4 px-5 py-4"
          >
            <span class="min-w-0">
              <span class="block font-medium text-gray-900">
                {{ l.session }}. {{ l.subgoal }}
              </span>
              <span class="block truncate text-sm text-gray-500">{{ l.objective }}</span>
            </span>
            <span class="flex-none text-sm" :class="{
              'text-green-700': l.progress.state === 'done',
              'text-indigo-700': l.progress.state === 'in-progress',
              'text-gray-400': l.progress.state === 'new',
            }">
              <template v-if="l.progress.state === 'in-progress'">
                крок {{ l.progress.step }} з {{ l.progress.total }}
              </template>
              <template v-else>
                {{ LABEL[l.progress.state] }}{{ l.progress.state === 'done' ? ' ✓' : '' }}
              </template>
            </span>
          </a>
        </li>
      </ul>

      <!-- Підсумкова робота. Стоїть ПІСЛЯ списку, бо це не заняття, а
           перевірка того, що заняття дали. -->
      <a
        href="/final"
        class="mt-4 flex items-center justify-between rounded-xl border px-5 py-4 transition"
        :class="finalReady
          ? 'border-indigo-300 bg-indigo-50/60 hover:border-indigo-500'
          : 'border-gray-200 bg-white hover:border-indigo-300'"
      >
        <span>
          <span class="block font-medium text-gray-900">
            {{ finalDone ? 'Пройти підсумкову ще раз' : 'Підсумкова робота' }}
          </span>
          <span class="block text-sm text-gray-500">
            {{ finalReady
              ? 'усі заняття пройдено — перевіримо, що лишилось'
              : 'краще після всіх занять, але відкрито завжди' }}
          </span>
        </span>
        <span class="text-gray-400">→</span>
      </a>

      <!-- Те, що курс уже знає. Показуємо лише стійке: один випадок міг
           бути неуважністю, і лякати ним не варто. -->
      <p v-if="weak.length" class="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Повертається з заняття в заняття:
        <span class="font-medium">{{ weak.length }}</span>
        {{ weak.length === 1 ? 'непорозуміння' : 'непорозуміння' }} — варто закріпити.
      </p>

      <p class="mt-6 text-xs text-gray-400">
        Прогрес зберігається лише в цьому браузері: без облікового запису він
        не перейде на інший пристрій.
      </p>
    </template>

    <p v-else class="text-gray-500">Завантаження…</p>
  </div>
</template>
