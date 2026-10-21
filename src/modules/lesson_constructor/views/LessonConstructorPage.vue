<template>
  <div class="lc-page">
    <!-- Конструктор-речення (власник 2026-10-21: «Замість цього ставим» — макет дизайнера «Конструктор уроку»).
         Учитель читає урок одним реченням; клік на слово відкриває під реченням його вибір, праворуч — «Що вийде».
         «Режим уроку» і «Сторінки теорії» з макета НЕ повернуто — прибрані власником 2026-10-19/20; на їхньому
         місці — наявний «Конспект теми». Класи й теми — з реєстру програми (curriculum.ts), не зі списку макета. -->
    <form id="lc-form" class="lc-layout" @submit.prevent="handleGenerate">
      <section class="lc-main">
        <!-- Крок «Тип уроку» схований (LESSON_TYPE_STEP_VISIBLE = false); розмітка лишається для тесту правил. -->
        <section v-if="LESSON_TYPE_STEP_VISIBLE" class="lc-section">
          <h2 class="lc-section__title">1. Тип уроку</h2>
          <p class="lc-section__hint">Від типу залежить каркас плану і скільки тем брати.</p>
          <div class="lc-types">
            <button
              v-for="opt in LESSON_TYPE_OPTIONS"
              :key="opt.value"
              type="button"
              class="lc-type-chip"
              :class="{ 'lc-type-chip--active': lessonType === opt.value }"
              :aria-pressed="lessonType === opt.value ? 'true' : 'false'"
              @click="pickType(opt.value)"
            >
              <span class="lc-type-chip__label">{{ opt.label }}</span>
              <span class="lc-type-chip__hint">{{ opt.hint }}</span>
            </button>
          </div>
          <p v-if="typeNotice" class="lc-notice">{{ typeNotice }}</p>
          <p v-if="errors.lesson_type" class="lc-error">{{ errors.lesson_type }}</p>
        </section>

        <div class="lc-kick">Новий урок</div>
        <p class="lc-sentence" data-testid="lc-sentence">
          Урок для
          <button type="button" v-bind="slot('grade', !topicView)" data-testid="lc-slot-grade">{{ gradeSlot }}</button>
          про
          <button type="button" v-bind="slot('topic', !selectedTopics.length)" data-testid="lc-slot-topic">{{ pickedSummary || 'яку тему?' }}</button>
          —
          <button type="button" v-bind="slot('count')" data-testid="lc-slot-count">{{ taskCount }} {{ taskWord }}</button>,
          <button type="button" v-bind="slot('diff')" data-testid="lc-slot-diff">{{ diffSlot }}</button>,
          у стилі
          <button type="button" v-bind="slot('style')" data-testid="lc-slot-style">{{ (currentTheme?.label ?? '').toLowerCase() }}</button>
          на
          <button type="button" v-bind="slot('bg')" data-testid="lc-slot-bg">{{ bgSlot }}</button>
          фоні.
        </p>
        <p class="lc-more-line">
          📗 Конспект теми: {{ withKonspekt ? 'на початку уроку' : 'без конспекту' }}<template v-if="boardName.trim()"> · назва «{{ boardName.trim() }}»</template>
          <button type="button" class="lc-more-line__btn" data-testid="lc-slot-more" @click="openStep('more')">змінити</button>
        </p>

        <div class="lc-panel" :data-step="step">
          <!-- Клас -->
          <template v-if="step === 'grade'">
            <div class="lc-panel__head"><b>Клас учня</b><span>покажемо лише теми його програми</span></div>
            <TopicGradePicker
              part="grades"
              :view="topicView"
              :selected="selectedTopics"
              :labels="TOPIC_LABELS"
              @update:view="chooseGrade"
            />
          </template>

          <!-- Тема -->
          <template v-else-if="step === 'topic'">
            <!-- Лише зі схованим кроком «Тип уроку» (тест правил): скільки тем бере тип. -->
            <template v-if="LESSON_TYPE_STEP_VISIBLE">
              <h2 class="lc-section__title">
                2. Оберіть {{ topicsNeeded === 1 ? 'тему' : 'теми' }}
                <span class="lc-badge">{{ selectedTopics.length }} / {{ topicsNeeded || '—' }}</span>
              </h2>
              <p class="lc-section__hint">{{ topicsHint }}</p>
            </template>
            <div class="lc-panel__head">
              <b>Тема · {{ topicView === 'nmt' ? 'НМТ' : `${topicView} клас` }}</b>
              <span>{{ topicView === 'nmt' ? 'усі теми НМТ' : 'у порядку шкільної програми' }}</span>
            </div>
            <TopicGradePicker
              v-if="typeof topicView === 'number'"
              v-model:picked-key="pickedUnitKey"
              part="topics"
              :view="topicView"
              :selected="selectedTopics"
              :labels="TOPIC_LABELS"
              @pick="pickFromGrade"
            />
            <template v-else>
              <label class="lc-topic-search">
                <span aria-hidden="true">🔍</span>
                <input
                  v-model="topicQuery"
                  type="search"
                  placeholder="Знайти тему: «логарифм», «вектор», «відсотки»…"
                  data-testid="topic-search"
                >
              </label>
              <div v-if="topicQuery.trim()" class="lc-topic-hits">
                <button
                  v-for="topic in topicHits"
                  :key="topic.value"
                  type="button"
                  class="lc-topic-hit"
                  :class="{ 'lc-topic-hit--active': selectedTopics.includes(topic.value) }"
                  :data-testid="`topic-hit-${topic.value}`"
                  @click="toggleTopic(topic.value)"
                >
                  <span class="lc-topic-hit__label">{{ topic.label }}</span>
                  <span class="lc-topic-hit__path">{{ topic.block }} › {{ topic.section }}</span>
                </button>
                <p v-if="!topicHits.length" class="lc-section__hint">Нічого не знайдено. Спробуйте коротше слово.</p>
              </div>
              <template v-else>
                <!-- Два блоки (Алгебра / Геометрія), що згортаються; усередині розділ —
                     один рядок «назва | чипи» (слово власника 2026-09-22: «розділити на
                     алгебру і геометрію, а тоді розгортаються теми»). Блоки, розділи й
                     порядок — з таксономії на бекенді (`export_topics`). -->
                <div v-for="block in topicBlocks" :key="block.block" class="lc-topic-block">
                  <button
                    type="button"
                    class="lc-topic-block__head"
                    :aria-expanded="openBlocks.includes(block.block)"
                    @click="toggleBlock(block.block)"
                  >
                    <span class="lc-topic-block__chevron" aria-hidden="true">
                      {{ openBlocks.includes(block.block) ? '▾' : '▸' }}
                    </span>
                    <span class="lc-topic-block__title">{{ block.block }}</span>
                    <span v-if="pickedIn(block).length" class="lc-topic-block__picked">
                      · {{ pickedIn(block).join(', ') }}
                    </span>
                  </button>
                  <div v-if="openBlocks.includes(block.block)" class="lc-topic-block__body">
                    <div v-for="group in block.sections" :key="group.section" class="lc-topic-row">
                      <div class="lc-topic-row__title">{{ group.section }}</div>
                      <!-- Широкі теми першим рядком, під кожною — її вужчі з відступом і підписом
                           «Дроби ›» (власник 2026-10-19): видно, що загальне, а що покроковий маршрут.
                           Вужчі сховані: ▸ біля теми розкриває один рівень (власник 2026-10-19: «щоб
                           підтеми розгорталися» — розкрите все разом було «кишкою» на весь екран). -->
                      <div class="lc-topic-tree">
                        <div
                          v-for="row in topicRows(group.topics)"
                          :key="row.key"
                          class="lc-topics"
                          :class="{ 'lc-topics--child': row.depth > 0 }"
                          :style="row.depth > 0 ? { '--lc-depth': row.depth } : undefined"
                          :data-depth="row.depth"
                        >
                          <span v-if="row.parentLabel" class="lc-topics__parent">{{ row.parentLabel }} ›</span>
                          <span v-for="topic in row.topics" :key="topic.value" class="lc-topic-chip-wrap">
                            <button
                              type="button"
                              class="lc-topic-chip"
                              :class="{
                                'lc-topic-chip--active': selectedTopics.includes(topic.value),
                                'lc-topic-chip--disabled': !canPick(topic.value),
                              }"
                              @click="toggleTopic(topic.value)"
                            >
                              {{ topic.label }}
                            </button>
                            <button
                              v-if="row.expandable.includes(topic.value)"
                              type="button"
                              class="lc-topic-expand"
                              :aria-expanded="expandedTopics.includes(topic.value)"
                              :aria-label="`${expandedTopics.includes(topic.value) ? 'Згорнути' : 'Розгорнути'} «${topic.label}»`"
                              :title="expandedTopics.includes(topic.value) ? 'Згорнути' : 'Вужчі теми'"
                              :data-topic="topic.value"
                              @click="toggleExpand(topic.value)"
                            >{{ expandedTopics.includes(topic.value) ? '▾' : '▸' }}</button>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <p v-if="pickedSummary" class="lc-topic-picked" data-testid="topic-picked">
              Урок про: <b>{{ pickedSummary }}</b>
            </p>
            <p v-if="errors.topics" class="lc-error">{{ errors.topics }}</p>
          </template>

          <!-- Скільки задач -->
          <template v-else-if="step === 'count'">
            <div class="lc-panel__head"><b>Скільки задач</b><span>від 1 до {{ MAX_TASKS }}</span></div>
            <div class="lc-stepper">
              <button type="button" class="lc-stepper__btn" :disabled="taskCount <= 1" aria-label="Менше"
                      data-testid="lc-count-minus" @click="setTaskCount(taskCount - 1)">−</button>
              <b class="lc-stepper__value" data-testid="lc-count-value">{{ taskCount }}</b>
              <button type="button" class="lc-stepper__btn" :disabled="taskCount >= MAX_TASKS" aria-label="Більше"
                      data-testid="lc-count-plus" @click="setTaskCount(taskCount + 1)">+</button>
              <div class="lc-counts">
                <button
                  v-for="n in COUNT_PRESETS"
                  :key="n"
                  type="button"
                  class="lc-count"
                  :class="{ 'lc-count--on': taskCount === n }"
                  @click="setTaskCount(n)"
                >{{ n }}</button>
              </div>
            </div>
            <input
              v-model.number="taskCount"
              type="range"
              min="1"
              :max="MAX_TASKS"
              step="1"
              class="lc-count-range"
              aria-label="Кількість задач"
              data-testid="lc-count-range"
            />
            <div class="lc-preview-box">
              <span class="lc-preview-item lc-preview-item--tasks">📋 {{ taskCount }} {{ taskWord }}</span>
              <span class="lc-preview-sep">→</span>
              <!-- Конспект теми (2026-10-21): скільки в нього сторінок, знає сервер — тут лише видно, що він буде -->
              <template v-if="withKonspekt">
                <span class="lc-preview-item lc-preview-item--konspekt" data-testid="lc-preview-konspekt">📗 конспект</span>
                <span class="lc-preview-sep">+</span>
              </template>
              <span class="lc-preview-item lc-preview-item--practice">📝 {{ practicePages }} практика</span>
              <span class="lc-preview-sep lc-preview-total-sep">=</span>
              <span class="lc-preview-item lc-preview-item--total">{{ totalPages }} {{ pageWord }}</span>
            </div>
            <p v-if="errors.task_count" class="lc-error">{{ errors.task_count }}</p>
          </template>

          <!-- Складність -->
          <template v-else-if="step === 'diff'">
            <div class="lc-panel__head"><b>Складність задач</b><span>за замовчуванням — збалансована</span></div>
            <div class="lc-diffs">
              <button
                v-for="(dp, i) in DIFF_PROFILES"
                :key="dp.value"
                type="button"
                class="lc-diff"
                :class="{ 'lc-diff--on': diffProfile === dp.value }"
                :data-testid="`lc-diff-${dp.value}`"
                @click="diffProfile = dp.value"
              >
                <span class="lc-diff__bars" aria-hidden="true">
                  <i v-for="k in 4" :key="k" :class="{ 'lc-diff__bar--on': k <= i + 1 }" :style="{ height: `${4 + k * 4}px` }" />
                </span>
                {{ dp.label }}
              </button>
            </div>
          </template>

          <!-- Стиль карток -->
          <template v-else-if="step === 'style'">
            <div class="lc-panel__head"><b>Стиль карток</b><span>можна змінити й після створення</span></div>
            <div class="lc-themes">
              <button
                v-for="t in THEMES"
                :key="t.value"
                type="button"
                class="lc-theme-card"
                :class="{ 'lc-theme-card--active': theme === t.value }"
                @click="theme = t.value"
              >
                <span class="lc-theme-card__swatch" :class="{ 'lc-theme-card__swatch--grid': t.tasksPerPage > 1 }" aria-hidden="true">
                  <i /><span v-for="c in t.tasksPerPage" :key="c"><em /><em /><em /></span>
                </span>
                <span class="lc-theme-card__name">{{ t.label }}</span>
                <span class="lc-theme-card__desc">{{ t.desc }}</span>
              </button>
            </div>
          </template>

          <!-- Фон дошки -->
          <template v-else-if="step === 'bg'">
            <div class="lc-panel__head"><b>Фон дошки</b><span>для всіх сторінок уроку</span></div>
            <div class="lc-bg-mode">
              <button
                type="button"
                class="lc-bg-mode__btn"
                :class="{ 'lc-bg-mode__btn--active': !multicolorBg }"
                @click="multicolorBg = false"
              >Один колір</button>
              <button
                type="button"
                class="lc-bg-mode__btn"
                :class="{ 'lc-bg-mode__btn--active': multicolorBg }"
                @click="multicolorBg = true"
              >🌈 Різнокольорові</button>
            </div>
            <template v-if="!multicolorBg">
              <div class="lc-bg-grid">
                <button
                  v-for="bg in BG_PRESETS"
                  :key="bg.value"
                  type="button"
                  class="lc-bg-swatch"
                  :class="{ 'lc-bg-swatch--active': boardBg === bg.value }"
                  :style="{ background: bg.value }"
                  :title="bg.label"
                  @click="boardBg = bg.value"
                >
                  <span v-if="boardBg === bg.value" class="lc-bg-swatch__check">✓</span>
                </button>
              </div>
              <p class="lc-bg-label">{{ activeBgLabel }}</p>
            </template>
            <template v-else>
              <div class="lc-bg-strip">
                <span
                  v-for="(c, i) in bgPalette"
                  :key="i"
                  class="lc-bg-strip__cell"
                  :style="{ background: c }"
                  :title="c"
                />
              </div>
              <label class="lc-bg-sat">
                <span class="lc-bg-sat__label">Насиченість</span>
                <input
                  type="range"
                  min="0" max="100" step="5"
                  v-model.number="bgSaturation"
                  class="lc-bg-sat__range"
                />
                <span class="lc-bg-sat__val">{{ bgSaturation }}%</span>
              </label>
              <p class="lc-bg-label">Кожна практична сторінка — свій м'який колір (циклом). Учням так веселіше.</p>
            </template>
          </template>

          <!-- Ще: конспект і назва -->
          <template v-else-if="step === 'more'">
            <div class="lc-panel__head"><b>Ще про урок</b><span>можна не чіпати</span></div>
            <!-- Конспект теми (власник 2026-10-21: «так, роби конспекти картками») — сторінки на початку
                 уроку: означення, правила, «Запам'ятай», приклади, малюнки й «Перевір себе».
                 «Режим уроку» і «Сторінку теорії» прибрано (власник 2026-10-19): теорія була сухою, а режими
                 нічого не міняли. -->
            <label class="lc-check" data-testid="lc-konspekt">
              <input v-model="withKonspekt" type="checkbox" />
              <span>
                <b>📗 Конспект теми на початку уроку</b>
                <small>Картки з означеннями, правилами, прикладами й «Перевір себе»</small>
              </span>
            </label>
            <div class="lc-field">
              <label class="lc-label" for="lc-board-name">Назва дошки (необов'язково)</label>
              <input
                id="lc-board-name"
                v-model="boardName"
                type="text"
                class="lc-input"
                maxlength="255"
                placeholder="Авто-назва з теми"
              />
            </div>
          </template>
        </div>
      </section>

      <aside class="lc-aside">
        <div class="lc-preview" data-testid="lc-preview">
          <span class="lc-kick">Що вийде</span>
          <div class="lc-stack" aria-hidden="true">
            <div
              v-for="(pg, i) in previewPages"
              :key="i"
              class="lc-pg"
              :class="pg.konspekt ? 'lc-pg--k' : 'lc-pg--p'"
              :style="pg.style"
            >
              <span class="lc-pg__tag">{{ pg.tag }}</span>
              <span class="lc-pg__title">{{ pg.title }}</span>
              <em /><em class="lc-pg__short" />
              <span class="lc-pg__box" />
            </div>
          </div>
          <dl class="lc-sum">
            <div><dt>Клас</dt><dd>{{ topicView === 'nmt' ? 'НМТ' : topicView ?? '—' }}</dd></div>
            <div><dt>Тема</dt><dd>{{ pickedSummary || '—' }}</dd></div>
            <div><dt>Задач</dt><dd>{{ taskCount }}</dd></div>
            <div><dt>Сторінок</dt><dd>{{ withKonspekt ? 'конспект + ' : '' }}{{ totalPages }}</dd></div>
            <div><dt>Складність</dt><dd>{{ diffLabel }}</dd></div>
            <div><dt>Фон</dt><dd>{{ multicolorBg ? 'різнокольоровий' : activeBgLabel }}</dd></div>
          </dl>
        </div>

        <button
          type="submit"
          class="lc-btn-generate"
          :class="{ 'lc-btn-generate--busy': isLoading }"
          :disabled="isLoading || !!focusProblem"
        >
          <!-- Власник 2026-10-18: «що він думає, а не просто колесо крутиться». -->
          <IntegralykThinking v-if="isLoading" :size="22" />
          {{ isLoading ? 'Інтегралик складає урок…' : 'Створити дошку →' }}
        </button>
        <!-- Заблокована кнопка без причини — та сама глуха стіна, лише мовчазна. -->
        <p v-if="focusProblem" class="lc-hint-blocked">{{ !topicView ? 'Оберіть клас' : focusProblem }}</p>
        <p v-if="errors.general" class="lc-error lc-error--center">{{ errors.general }}</p>

        <div class="lc-mascot">
          <i aria-hidden="true">∫</i>
          <span data-testid="lc-tip">{{ tip }}</span>
        </div>

        <!-- Поки генерується — посередині екрана Інтегралик, що думає, у тій самій рамці, що й
             загальне «Завантаження…» (власник 2026-10-19: «не колесо, а Інтегралик»; 2026-10-20 — сцена
             «хмарка думок»: «підбери нового лодера»). Загальне вікно для цього запиту вимкнене
             (skipLoader у lessonConstructorApi.generate). -->
        <Teleport to="body">
          <div v-if="isLoading" class="loader-overlay" aria-live="polite" data-testid="lc-generating">
            <div class="loader-panel" role="status">
              <IntegralykLoader :width="170" />
              <p class="text-sm font-medium text-primary">Інтегралик складає урок…</p>
            </div>
          </div>
        </Teleport>
      </aside>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import IntegralykThinking from '@/modules/intent/IntegralykThinking.vue'
import IntegralykLoader from '@/modules/intent/IntegralykLoader.vue'
import TopicGradePicker from '../components/TopicGradePicker.vue'
import { loadTopicView, saveTopicView, searchTopics, type TopicView } from '../topicByGrade'
import {
  TOPICS,
  THEMES,
  DIFF_PROFILES,
  lessonConstructorApi,
} from '../api/lessonConstructorApi'
import {
  LESSON_TYPE_OPTIONS,
  LESSON_TYPE_STEP_VISIBLE,
  HIDDEN_STEP_LESSON_TYPE,
  canPickTopic,
  focusIssue,
  isBlockType,
  reconcileTopics,
  topicsRequiredFor,
  type LessonType,
} from '../lessonTypeRules'

const router = useRouter()

// ── Constants ──────────────────────────────────────────────────────────────

const BG_PRESETS = [
  { value: '#ffffff', label: 'Білий (чистий)', on: "білому" },
  { value: '#fef9f0', label: 'Тепло-бежевий', on: "тепло-бежевому" },
  { value: '#f0f7ff', label: 'М\'який блакитний', on: "м'якому блакитному" },
  { value: '#f0fdf4', label: 'М\'який зелений', on: "м'якому зеленому" },
  { value: '#faf5ff', label: 'Лавандовий', on: "лавандовому" },
  { value: '#fff7ed', label: 'Персиковий', on: "персиковому" },
  { value: '#f8fafc', label: 'Сіро-білий', on: "сіро-білому" },
  { value: '#f1f5f9', label: 'Сталевий', on: "сталевому" },
  { value: '#1e1e2e', label: 'Темний (нічний)', on: "темному" },
] as const

// Відтінки пастельної палітри (HSL hue, 0–360) — розкидані по колу.
// Світлість фіксована висока (пастель); насиченість керується слайдером.
const PASTEL_HUES = [0, 28, 50, 130, 175, 210, 260, 320] as const
const PASTEL_LIGHTNESS = 88   // % — світлий пастельний фон, комфортний для очей

/** HSL → '#rrggbb'. h: 0–360, s/l: 0–100. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100, lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  const [r, g, b] = (
    h < 60  ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  )
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

// ── Form state ─────────────────────────────────────────────────────────────
// Порожній рядок = тип ще не обрано. Замовчування тут було б брехнею: сервер
// саме через мовчазний `intro` і відмовляв учителю, який нічого не обирав.
// Крок типу схований → тип за замовчуванням (див. LESSON_TYPE_STEP_VISIBLE).
const lessonType      = ref<LessonType | ''>(LESSON_TYPE_STEP_VISIBLE ? '' : HIDDEN_STEP_LESSON_TYPE)
const typeNotice      = ref<string | null>(null)
const selectedTopics  = ref<string[]>([])
const taskCount       = ref(4)
const theme           = ref('nmt_exam')   // default = перший стиль у THEMES (visual прибрано)
const boardBg         = ref('#ffffff')
// Різнокольорові на максимумі — за замовчуванням (власник 2026-10-19: «дітям подобаються кольорові
// дошки, я щоразу їх клацаю — за замовчуванням треба їх поставити, і на максимум відтінок»).
const multicolorBg    = ref(true)    // різнокольоровий режим (палітра циклом по сторінках)
const bgSaturation    = ref(100)     // 0–100 % — насиченість пастельної палітри
const diffProfile     = ref('balanced')
const boardName       = ref('')
// Конспект теми на початку уроку (власник 2026-10-21) — за замовчуванням так; немає конспекту — лише задачі
const withKonspekt    = ref(true)

// ── UI state ───────────────────────────────────────────────────────────────
const isLoading = ref(false)
const errors    = ref<Record<string, string>>({})

// ── Computed ───────────────────────────────────────────────────────────────
const currentTheme = computed(() => THEMES.find(t => t.value === theme.value))

/** Пастельна палітра за поточною насиченістю (циклиться по practice-сторінках). */
const bgPalette = computed(() =>
  PASTEL_HUES.map(h => hslToHex(h, bgSaturation.value, PASTEL_LIGHTNESS))
)

/** Кількість практичних сторінок */
const practicePages = computed(() => {
  const perPage = currentTheme.value?.tasksPerPage ?? 1
  return Math.max(1, Math.ceil(taskCount.value / perPage))
})

/** Загальна кількість сторінок: лише задачі — теорії й окремих сторінок розбору немає. */
const totalPages = computed(() => practicePages.value)

const pageWord = computed(() => {
  const n = totalPages.value
  if (n === 1) return 'сторінка'
  if (n < 5)   return 'сторінки'
  return 'сторінок'
})

const taskWord = computed(() => {
  const n = taskCount.value
  if (n === 1) return 'задача'
  if (n < 5)   return 'задачі'
  return 'задач'
})

const activeBgLabel = computed(
  () => BG_PRESETS.find(b => b.value === boardBg.value)?.label ?? boardBg.value
)

// ── Тип уроку і теми ───────────────────────────────────────────────────────

type Topic = (typeof TOPICS)[number]
type TopicBlock = { block: string; sections: Array<{ section: string; topics: Topic[] }> }

/** Блоки → розділи → теми, у порядку, який дав `export_topics`. */
const topicBlocks = computed(() => {
  const blocks: TopicBlock[] = []
  for (const topic of TOPICS) {
    let block = blocks[blocks.length - 1]
    if (!block || block.block !== topic.block) {
      block = { block: topic.block, sections: [] }
      blocks.push(block)
    }
    const last = block.sections[block.sections.length - 1]
    if (last && last.section === topic.section) last.topics.push(topic)
    else block.sections.push({ section: topic.section, topics: [topic] })
  }
  return blocks
})

type TopicRow = {
  key: string
  depth: number
  parentLabel: string | null
  topics: Topic[]
  /** Теми цього рядка, що мають вужчі (біля них ▸). */
  expandable: string[]
}

/** Розкриті гілки: id широких тем, чиї вужчі зараз видно. Спершу все згорнуте. */
const expandedTopics = ref<string[]>([])
function toggleExpand(id: string) {
  expandedTopics.value = expandedTopics.value.includes(id)
    ? expandedTopics.value.filter((t) => t !== id)
    : [...expandedTopics.value, id]
}


/**
 * Рядки дерева тем одного розділу: перший — широкі теми, далі під кожною темою, що має вужчі, —
 * рядок її дітей (глибше на рівень, з підписом батька), і так донизу. Батько — найближчий предок
 * за id (`a.b.c` → `a.b` → `a`) У ЦЬОМУ Ж розділі; предок з іншого розділу не рахується — така
 * тема стає широкою свого розділу. Порядок тем усередині рядка — той, що дав `export_topics`.
 */
function topicRows(topics: Topic[]): TopicRow[] {
  const inSection = new Set<string>(topics.map((t) => t.value))
  const parentOf = (id: string): string | null => {
    let cut = id.lastIndexOf('.')
    while (cut > 0) {
      const candidate = id.slice(0, cut)
      if (inSection.has(candidate)) return candidate
      cut = candidate.lastIndexOf('.')
    }
    return null
  }
  const children = new Map<string | null, Topic[]>()
  for (const topic of topics) {
    const parent = parentOf(topic.value)
    children.set(parent, [...(children.get(parent) ?? []), topic])
  }
  const rows: TopicRow[] = []
  const walk = (parent: Topic | null, depth: number) => {
    const kids = children.get(parent ? parent.value : null)
    if (!kids?.length) return
    rows.push({
      key: parent ? parent.value : '__roots',
      depth,
      parentLabel: parent ? parent.label : null,
      topics: kids,
      expandable: kids.filter((k) => children.has(k.value)).map((k) => k.value),
    })
    // Глибше — лише в розкриті гілки.
    for (const kid of kids) if (expandedTopics.value.includes(kid.value)) walk(kid, depth + 1)
  }
  walk(null, 0)
  return rows
}

// Спочатку обидва блоки згорнуті: вчитель бачить два рядки, а не 61 чип.
const openBlocks = ref<string[]>([])
function toggleBlock(block: string) {
  openBlocks.value = openBlocks.value.includes(block)
    ? openBlocks.value.filter((b) => b !== block)
    : [...openBlocks.value, block]
}

/** Назви обраних тем цього блоку — видно й у згорнутому заголовку. */
function pickedIn(block: TopicBlock): string[] {
  return block.sections.flatMap((s) => s.topics)
    .filter((t) => selectedTopics.value.includes(t.value))
    .map((t) => t.label)
}

// ── Вибір теми «За класом» / «НМТ» (власник 2026-10-21) ──────────────────────
const TOPIC_LABELS: Readonly<Record<string, string>> = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]))
/** Клас учня чи «НМТ»; перший раз — нічого (вчитель обирає клас), далі — останній вибір у цьому браузері. */
const topicView = ref<TopicView | null>(loadTopicView())
function setTopicView(view: TopicView) {
  topicView.value = view
  saveTopicView(view)
}
const topicQuery = ref('')
const topicHits = computed(() => searchTopics(TOPICS, topicQuery.value))
/** З розділу програми: та сама тема вдруге не знімає вибір — розділ просто лишається обраним. */
function pickTopic(id: string) {
  if (!selectedTopics.value.includes(id)) toggleTopic(id)
}
/** Що саме піде в генератор: назва теми конструктора, а не розділу програми (вони не завжди збігаються). */
const pickedSummary = computed(() => selectedTopics.value.map((id) => TOPIC_LABELS[id]).filter(Boolean).join(', '))

// ── Конструктор-речення (власник 2026-10-21: макет «Конструктор уроку») ────────
// «Урок для [класу] про [тему] — [N задач], [складність], у стилі [..] на [..] фоні.» Клік на слово відкриває під
// реченням його вибір. Перший раз — клас; далі (клас запам'ятовано) — одразу тема.
type Step = 'grade' | 'topic' | 'count' | 'diff' | 'style' | 'bg' | 'more'
const step = ref<Step>(topicView.value === null ? 'grade' : 'topic')
function openStep(next: Step) {
  step.value = next
}
/** Слово речення: кнопка, що відкриває свій крок; порожнє — пунктиром («якого класу?»). */
function slot(name: Step, empty = false) {
  return {
    class: ['lc-slot', { 'lc-slot--empty': empty, 'lc-slot--on': step.value === name }],
    'aria-pressed': step.value === name,
    onClick: () => openStep(name),
  }
}

/** Інший клас — інша програма: тема попереднього класу не переходить сама (як у макеті). */
function chooseGrade(view: TopicView) {
  if (view !== topicView.value) selectedTopics.value = []
  setTopicView(view)
  step.value = 'topic'
}
/** Розділ програми, з якого обрано тему — щоб, повернувшись до теми, світився саме він (TopicGradePicker). */
const pickedUnitKey = ref<string | null>(null)
/** Тема з розділу програми обрана — далі кількість задач. У дереві НМТ крок не перемикається: там шукають. */
function pickFromGrade(id: string) {
  pickTopic(id)
  step.value = 'count'
}

const MAX_TASKS = 20
const COUNT_PRESETS = [2, 4, 6, 8, 10, 15, 20] as const
function setTaskCount(n: number) {
  taskCount.value = Math.min(MAX_TASKS, Math.max(1, Math.round(n)))
}

const gradeSlot = computed(() => (topicView.value === null ? 'якого класу?'
  : topicView.value === 'nmt' ? 'підготовки до НМТ' : `${topicView.value} класу`))
const DIFF_WORDS: Record<string, string> = { easy: 'легкі', balanced: 'збалансовані', hard: 'важкі', exam: 'екзаменаційні' }
const diffSlot = computed(() => DIFF_WORDS[diffProfile.value] ?? diffProfile.value)
const diffLabel = computed(() => DIFF_PROFILES.find((d) => d.value === diffProfile.value)?.label ?? diffProfile.value)
const bgSlot = computed(() => (multicolorBg.value ? '🌈 різнокольоровому'
  : BG_PRESETS.find((b) => b.value === boardBg.value)?.on ?? 'білому'))

/** «Що вийде»: віяло сторінок — конспект (якщо є) і практичні, до 6 штук, у кольорах фону уроку. */
const previewPages = computed(() => {
  const pages: Array<{ konspekt: boolean; tag: string; title: string }> = []
  if (withKonspekt.value) pages.push({ konspekt: true, tag: 'Конспект', title: pickedSummary.value || 'Тема уроку' })
  const perPage = currentTheme.value?.tasksPerPage ?? 1
  for (let p = 1; p <= practicePages.value && pages.length < 6; p++) {
    const onPage = Math.min(perPage, taskCount.value - (p - 1) * perPage)
    pages.push({ konspekt: false, tag: `Практика ${p}`, title: onPage === 1 ? '1 задача' : `${onPage} задачі` })
  }
  const shown = pages.length
  return pages.map((pg, i) => {
    const practiceNo = withKonspekt.value ? i : i + 1
    const background = multicolorBg.value && !pg.konspekt ? bgPalette.value[(practiceNo - 1) % bgPalette.value.length] : boardBg.value
    const off = shown > 1 ? i * (130 / (shown - 1)) - 65 : 0
    const rot = shown > 1 ? (i - (shown - 1) / 2) * 3 : 0
    return { ...pg, style: { background, zIndex: String(10 - i), transform: `translateX(${off}px) rotate(${rot}deg)` } }
  })
})

/** Підказка Інтегралика під кнопкою — що зробити далі. */
const tip = computed(() => {
  if (isLoading.value) return 'Збираю урок — конспект і задачі.'
  if (topicView.value === null) return 'Почніть з класу — я покажу лише теми його програми.'
  if (!selectedTopics.value.length) return 'Тепер тема. Можна просто почати вводити назву.'
  return 'Усе готово — натисніть «Створити дошку».'
})

const topicsNeeded = computed(() => topicsRequiredFor(lessonType.value))

/** Підказка до схованого кроку «Тип уроку» — скільки тем бере тип. */
const topicsHint = computed(() => {
  if (!lessonType.value) return 'Спершу оберіть тип уроку — від нього залежить, скільки тем брати.'
  return isBlockType(lessonType.value)
    ? 'Оберіть дві споріднені теми одного розділу — між ними буде що узагальнювати.'
    : 'Оберіть одну тему: урок про неї.'
})


/** Що заважає натиснути «Згенерувати». `null` = нічого. */
const focusProblem = computed(() => focusIssue(lessonType.value, selectedTopics.value))

function canPick(topic: string): boolean {
  // Без кроку типу вибір — перемикач (див. toggleTopic): жодна тема не «вимкнена».
  if (!LESSON_TYPE_STEP_VISIBLE && topicsNeeded.value === 1) return true
  return canPickTopic(lessonType.value, selectedTopics.value, topic)
}

/**
 * Зміна типу може зробити вже обрані теми несумісними. Чистимо — але ЗАВЖДИ
 * з поясненням: вибір, що зник без слів, читається як поламаний інтерфейс.
 */
function pickType(value: LessonType) {
  lessonType.value = value
  const { topics, notice } = reconcileTopics(value, selectedTopics.value)
  selectedTopics.value = topics
  typeNotice.value = notice
  delete errors.value.lesson_type
}

function toggleTopic(value: string) {
  const idx = selectedTopics.value.indexOf(value)
  if (idx >= 0) {
    selectedTopics.value.splice(idx, 1)
    typeNotice.value = null
    return
  }
  // Крок типу схований → одна тема на урок, і клік по іншій ЗАМІНЮЄ вибір (як
  // перемикач), а не впирається в заблоковану кнопку: без кроку типу вчитель
  // не бачив би чому. З видимим кроком — старе правило (друга вимкнена).
  if (!LESSON_TYPE_STEP_VISIBLE && topicsNeeded.value === 1 && selectedTopics.value.length) {
    selectedTopics.value = [value]
    typeNotice.value = null
    return
  }
  if (!canPick(value)) return
  selectedTopics.value.push(value)
  typeNotice.value = null
}

// ── Validation ─────────────────────────────────────────────────────────────
function validate(): boolean {
  errors.value = {}
  if (!lessonType.value) {
    errors.value.lesson_type = 'Оберіть тип уроку'
    return false
  }
  // Те саме правило, що на сервері, але ДО запиту: інакше вчитель дізнається
  // про помилку з 400-ки (так і сталося 2026-09-08).
  const problem = focusIssue(lessonType.value, selectedTopics.value)
  if (problem) {
    errors.value.topics = problem
    return false
  }
  if (taskCount.value < 1 || taskCount.value > 30) {
    errors.value.task_count = 'Кількість задач: від 1 до 30'
    return false
  }
  return true
}

// ── Generate ───────────────────────────────────────────────────────────────
async function handleGenerate() {
  if (!validate()) return

  isLoading.value = true
  errors.value = {}

  try {
    const result = await lessonConstructorApi.generate({
      topics:                selectedTopics.value,
      lesson_type:           lessonType.value as LessonType,
      task_count:            taskCount.value,
      theme:                 theme.value,
      board_bg:              !multicolorBg.value && boardBg.value !== '#ffffff' ? boardBg.value : undefined,
      board_bg_palette:      multicolorBg.value ? bgPalette.value : undefined,
      diff_profile:          diffProfile.value,
      // Стара «суха» теорія прибрана 2026-10-19; з 2026-10-21 сторінки теорії — конспект теми картками
      include_theory_page:   withKonspekt.value,
      include_solution_page: false,   // окремих сторінок розбору немає (картки мають "Показати розбір")
      name:                  boardName.value || undefined,
    })

    // Redirect до згенерованої дошки в режимі конструктора (constructorMode: true)
    // щоб одразу бачити editor-інструменти і testObjects у overlay.
    router.push({
      name:   'winterboard-prepare',
      params: { id: result.session_id },
    })

  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: { error?: string; detail?: string } } }
    const status = e?.response?.status
    const data   = e?.response?.data

    if (status === 422) {
      // Недостатньо задач у БД для вибраних тем
      errors.value.general =
        `Недостатньо задач для обраних тем. Спробуйте зменшити кількість або змінити теми.`
    } else if (data?.detail) {
      errors.value.general = data.detail
    } else {
      errors.value.general = 'Помилка генерації. Спробуйте ще раз.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.lc-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem 1rem 4rem;
}


/* ── Header ─────────────────────────────────────────────────────────────── */




/* ── Form ───────────────────────────────────────────────────────────────── */

.lc-section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.lc-types { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.lc-type-chip {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
  padding: 8px 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--color-border, #d7dde5); background: #fff; font: inherit;
}
.lc-type-chip:hover { border-color: #0f766e; }
.lc-type-chip--active { border-color: #0f766e; background: #0f766e; color: #fff; }
.lc-type-chip__label { font-weight: 600; }
.lc-type-chip__hint { font-size: 12px; opacity: .75; }
.lc-notice {
  margin: 8px 0 0; padding: 6px 10px; border-radius: 8px;
  background: #fff6db; font-size: 13px;
}
.lc-hint-blocked { margin: 8px 0 0; text-align: center; font-size: 13px; opacity: .8; }

.lc-topic-block { border: 1px solid #e2e8f0; border-radius: 10px; }
.lc-topic-block + .lc-topic-block { margin-top: 10px; }
.lc-topic-block__head {
  display: flex; align-items: baseline; gap: 8px; width: 100%;
  padding: 12px 14px; background: none; border: 0; cursor: pointer; text-align: left;
  font-size: 15px; color: #0f172a;
}
.lc-topic-block__chevron { width: 1em; color: #64748b; }
.lc-topic-block__title { font-weight: 700; }
.lc-topic-block__picked { color: #047857; font-weight: 600; }
.lc-topic-block__body { padding: 0 14px 12px; }
.lc-topic-row {
  display: grid; grid-template-columns: 170px 1fr; gap: 12px; align-items: start;
  padding: 8px 0; border-top: 1px solid #f1f5f9;
}
.lc-topic-row__title { font-size: 13px; font-weight: 600; color: #64748b; padding-top: 6px; }
@media (max-width: 640px) {
  .lc-topic-row { grid-template-columns: 1fr; gap: 6px; }
  .lc-topic-row__title { padding-top: 0; }
}
.lc-section__title {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lc-section__hint {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0 0 1rem;
}

.lc-badge {
  background: #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

/* ── Topics ─────────────────────────────────────────────────────────────── */
.lc-topic-tree {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lc-topics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

/* Вужчі теми: відступ на рівень і лінія зліва — видно, під якою темою вони стоять. */
.lc-topics--child {
  margin-left: calc((var(--lc-depth, 1) - 1) * 18px + 6px);
  padding-left: 12px;
  border-left: 2px solid #e2e8f0;
}

.lc-topics--child .lc-topic-chip {
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
}

.lc-topic-chip-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.lc-topic-expand {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
}

.lc-topic-expand:hover,
.lc-topic-expand[aria-expanded="true"] {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.lc-topics__parent {
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
}

.lc-topic-chip {
  border: 1.5px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
}

.lc-topic-chip:hover:not(.lc-topic-chip--disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, #fff);
}

.lc-topic-chip--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--color-on-accent);
}

.lc-topic-chip--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Task count ─────────────────────────────────────────────────────────── */



/* ── Themes ─────────────────────────────────────────────────────────────── */
.lc-themes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 600px) {
  .lc-themes {
    grid-template-columns: repeat(2, 1fr);
  }
}

.lc-theme-card {
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  padding: 0.75rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lc-theme-card:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, #fff);
}

.lc-theme-card--active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, #fff);
}

.lc-theme-card__name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
}

.lc-theme-card__desc {
  font-size: 0.75rem;
  color: #64748b;
}

/* ── Preview box ────────────────────────────────────────────────────────── */
.lc-preview-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 0.85rem;
}

.lc-preview-sep {
  color: #94a3b8;
}

.lc-preview-item {
  font-weight: 500;
  color: #334155;
}

.lc-preview-item--tasks    { color: var(--accent); font-weight: 600; }
.lc-preview-item--practice { color: #0f172a; }
.lc-preview-item--solution { color: #15803d; }
.lc-preview-item--total    { color: #0f172a; font-weight: 600; }
.lc-preview-total-sep      { color: #475569; font-weight: 600; }

/* ── Background picker ───────────────────────────────────────────────────── */
.lc-bg-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.lc-bg-swatch {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, transform 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.lc-bg-swatch:hover {
  border-color: var(--accent);
  transform: scale(1.08);
}

.lc-bg-swatch--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.lc-bg-swatch__check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--accent);
  text-shadow: 0 0 3px #fff;
  font-weight: 700;
}

/* Dark swatch — white check */
.lc-bg-swatch[style*="1e1e2e"] .lc-bg-swatch__check {
  color: #fff;
  text-shadow: none;
}

.lc-bg-label {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
}

/* ── Background: mode toggle ─────────────────────────────────────────────── */
.lc-bg-mode {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: #f1f5f9;
  border-radius: 10px;
  margin-bottom: 0.75rem;
}

.lc-bg-mode__btn {
  border: none;
  background: transparent;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.lc-bg-mode__btn--active {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* ── Background: multicolor preview strip ────────────────────────────────── */
.lc-bg-strip {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  margin: 0.5rem 0 0.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.lc-bg-strip__cell {
  flex: 1 1 0;
  height: 36px;
}

/* ── Background: saturation slider ───────────────────────────────────────── */
.lc-bg-sat {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: #475569;
}

.lc-bg-sat__label {
  font-weight: 500;
  white-space: nowrap;
}

.lc-bg-sat__range {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.lc-bg-sat__val {
  min-width: 2.6rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  font-weight: 600;
}

/* ── Advanced ───────────────────────────────────────────────────────────── */


.lc-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}




.lc-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.lc-check { display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer; }
.lc-check input { margin-top: 0.25rem; width: 1.05rem; height: 1.05rem; flex: none; }
.lc-check span { display: flex; flex-direction: column; gap: 0.15rem; }
.lc-check small { color: var(--text-secondary, #64748b); font-size: 0.85rem; }




.lc-input {
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.lc-input:focus {
  border-color: var(--accent);
}

/* ── Actions ────────────────────────────────────────────────────────────── */

.lc-btn-generate {
  background: var(--accent);
  color: var(--color-on-accent);
  border: none;
  border-radius: 12px;
  padding: 1rem 2.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.15s;
  width: 100%;
  justify-content: center;
}

.lc-btn-generate:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.lc-btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Генерує: кнопка не блідне — видно, що Інтегралик думає (власник 2026-10-18). */
.lc-btn-generate--busy:disabled {
  opacity: 1;
  cursor: progress;
}

/* ── Error ──────────────────────────────────────────────────────────────── */
.lc-error {
  font-size: 0.85rem;
  color: #dc2626;
  margin: 0.25rem 0 0;
}

.lc-error--center {
  text-align: center;
}

/* Вибір теми «НМТ»: пошук по всіх темах і список збігів (2026-10-21). */
.lc-topic-search {
  display: flex; align-items: center; gap: 0.6rem;
  margin: 0.9rem 0;
  padding: 0.6rem 0.8rem;
  border: 1.5px solid #cbd5e1; border-radius: 12px;
  background: #fff;
}
.lc-topic-search:focus-within { border-color: var(--accent); }
.lc-topic-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: inherit; }
.lc-topic-hits { display: flex; flex-direction: column; gap: 6px; }
.lc-topic-hit {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 0.55rem 0.8rem;
  border: 1px solid #e2e8f0; border-radius: 10px;
  background: #fff; color: #1e293b;
  font: inherit; font-size: 0.9rem; text-align: left;
  cursor: pointer;
}
.lc-topic-hit:hover { border-color: var(--accent); }
.lc-topic-hit--active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, #fff); }
.lc-topic-hit__path { font-size: 0.75rem; color: #64748b; }
.lc-topic-picked { margin: 0.9rem 0 0; font-size: 0.9rem; color: #334155; }

/* ── Конструктор-речення (2026-10-21, макет «Конструктор уроку») ─────────────── */
.lc-layout {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
  align-items: start;
}
@media (max-width: 960px) {
  .lc-layout { grid-template-columns: minmax(0, 1fr); }
  .lc-aside { position: static; }
}
.lc-main {
  min-width: 0;
  background: #fff;
  border-radius: 24px;
  padding: 36px 40px 32px;
  box-shadow: 0 20px 50px -30px rgba(13, 74, 62, 0.4);
}
@media (max-width: 640px) { .lc-main { padding: 24px 18px; } }
.lc-kick {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
.lc-sentence {
  margin: 10px 0 8px;
  font-family: 'Space Grotesk', var(--font-sans, system-ui), sans-serif;
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.01em;
  color: #0d4a3e;
  text-wrap: pretty;
}
.lc-slot {
  display: inline-flex;
  align-items: center;
  margin: 2px 0;
  padding: 0 12px 2px;
  border: 0;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 12%, #fff);
  color: color-mix(in srgb, var(--accent) 75%, #000);
  font: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
.lc-slot:hover { background: color-mix(in srgb, var(--accent) 20%, #fff); }
.lc-slot--on, .lc-slot--on:hover { background: var(--accent); color: var(--color-on-accent); }
.lc-slot--empty { padding: 0 4px; border-radius: 0; background: none; color: #94a3b8; border-bottom: 3px dashed #cbd5e1; }
.lc-slot--empty.lc-slot--on {
  padding: 0 12px 2px;
  border-radius: 14px;
  border-bottom-color: transparent;
  background: color-mix(in srgb, var(--accent) 12%, #fff);
  color: color-mix(in srgb, var(--accent) 75%, #000);
}
.lc-more-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 22px; font-size: 14px; color: #64748b; }
.lc-more-line__btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: pointer;
}
.lc-panel { min-height: 300px; padding-top: 22px; border-top: 1px solid #e2e8f0; }
.lc-panel__head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.lc-panel__head b { font-size: 17px; color: #0f172a; }
.lc-panel__head span { font-size: 13px; color: #64748b; }

.lc-stepper { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 12px; }
.lc-stepper__btn, .lc-count {
  border: 1.5px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}
.lc-stepper__btn { width: 46px; height: 46px; border-radius: 14px; font-size: 22px; }
.lc-stepper__btn:disabled { opacity: 0.35; cursor: default; }
.lc-stepper__value { min-width: 56px; text-align: center; font-size: 40px; color: #0f172a; }
.lc-counts { display: flex; flex-wrap: wrap; gap: 8px; }
.lc-count { width: 48px; height: 42px; border-radius: 14px; font-size: 17px; }
.lc-count:hover, .lc-stepper__btn:hover:not(:disabled) { border-color: var(--accent); }
.lc-count--on, .lc-count--on:hover { background: var(--accent); border-color: var(--accent); color: var(--color-on-accent); }
.lc-count-range { width: 100%; margin: 4px 0 14px; accent-color: var(--accent); }

.lc-diffs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 640px) { .lc-diffs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.lc-diff {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 10px;
  border: 1.5px solid #cbd5e1;
  border-radius: 16px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.lc-diff--on { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.lc-diff__bars { display: flex; align-items: flex-end; gap: 3px; height: 22px; }
.lc-diff__bars i { width: 7px; border-radius: 2px; background: #e2e8f0; }
.lc-diff__bars i.lc-diff__bar--on { background: var(--accent); }

.lc-theme-card__swatch {
  display: grid;
  grid-template-columns: 6px 1fr;
  height: 70px;
  margin-bottom: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.lc-theme-card__swatch--grid {
  grid-template-columns: 6px 1fr 1fr;
  background-image: linear-gradient(#e6efec 1px, transparent 1px), linear-gradient(90deg, #e6efec 1px, transparent 1px);
  background-size: 10px 10px;
}
.lc-theme-card__swatch i { background: var(--accent); }
.lc-theme-card__swatch > span { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
.lc-theme-card__swatch em { display: block; height: 6px; border-radius: 3px; background: #0d4a3e; opacity: 0.2; }
.lc-theme-card__swatch em:first-child { width: 60%; height: 8px; opacity: 0.5; }

.lc-aside { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.lc-preview { padding: 22px; border-radius: 24px; background: #fff; box-shadow: 0 20px 50px -30px rgba(13, 74, 62, 0.4); }
.lc-stack { position: relative; height: 210px; margin: 12px 0 16px; }
.lc-pg {
  position: absolute;
  left: 50%;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 150px;
  height: 200px;
  margin-left: -75px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 18px -10px rgba(13, 74, 62, 0.35);
  transition: transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1);
}
.lc-pg--k { border-top: 4px solid var(--accent); }
.lc-pg--p { border-top: 4px solid #e07a3c; }
.lc-pg__tag { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #047857; }
.lc-pg__title { font-size: 12px; font-weight: 600; line-height: 1.25; color: #0d4a3e; }
.lc-pg em { display: block; height: 5px; border-radius: 3px; background: rgba(13, 74, 62, 0.12); }
.lc-pg .lc-pg__short { width: 70%; }
.lc-pg__box { flex: 1; border: 1px dashed rgba(13, 74, 62, 0.18); border-radius: 6px; background: rgba(255, 255, 255, 0.55); }
@media (prefers-reduced-motion: reduce) { .lc-pg { transition: none; } }
.lc-sum { display: flex; flex-direction: column; gap: 8px; margin: 0; font-size: 14px; }
.lc-sum div { display: flex; justify-content: space-between; gap: 10px; padding-bottom: 7px; border-bottom: 1px dashed #e2e8f0; }
.lc-sum dt { color: #64748b; }
.lc-sum dd { margin: 0; font-weight: 700; text-align: right; color: #0f172a; }
.lc-mascot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: #fff;
  font-size: 13.5px;
  color: #1f6b5a;
}
.lc-mascot i {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 12%, #fff);
  color: var(--accent);
  font: italic 700 22px Georgia, serif;
}

/* ── Темна тема (Б-156, фаза 1) ─────────────────────────────────────────────
   Сторінка намальована жорсткими світлими кольорами (вище) — у темній темі це був
   білий острів. Тут ті самі елементи отримують токени темної теми; світла тема не
   змінюється. Стани (наведення, вибране, фокус) повторено, бо базові правила цього
   блоку сильніші за світлі модифікатори. Фаза 2 переведе кольори вище на токени. */
[data-theme="dark"] .lc-page { background: var(--color-page); }
[data-theme="dark"] .lc-section { background: var(--color-surface); border-color: var(--color-border); }
[data-theme="dark"] .lc-topic-block,
[data-theme="dark"] .lc-topic-row,
[data-theme="dark"] .lc-topics--child,
[data-theme="dark"] .lc-bg-strip,

[data-theme="dark"] .lc-page__title,
[data-theme="dark"] .lc-topic-block__head,
[data-theme="dark"] .lc-section__title,
[data-theme="dark"] .lc-theme-card__name { color: var(--color-text); }
[data-theme="dark"] .lc-page__subtitle,
[data-theme="dark"] .lc-topic-block__chevron,
[data-theme="dark"] .lc-topic-row__title,
[data-theme="dark"] .lc-topics__parent,
[data-theme="dark"] .lc-topic-expand,
[data-theme="dark"] .lc-section__hint,
[data-theme="dark"] .lc-theme-card__desc,
[data-theme="dark"] .lc-bg-label,
[data-theme="dark"] .lc-bg-sat,
[data-theme="dark"] .lc-label,
[data-theme="dark"] .lc-radio,
[data-theme="dark"] .lc-checkbox-hint,
[data-theme="dark"] .lc-preview-sep { color: var(--color-text-muted); }
[data-theme="dark"] .lc-topic-block__picked { color: var(--color-accent); }
[data-theme="dark"] .lc-error { color: var(--color-danger); }
[data-theme="dark"] .lc-notice { background: var(--color-warning-soft); color: var(--color-text); }
[data-theme="dark"] .lc-badge { background: var(--color-surface-sunken); color: var(--color-text-secondary); }

[data-theme="dark"] .lc-type-chip {
  background: var(--color-surface-sunken);
  border-color: var(--color-border-strong);
  color: var(--color-text);
}
[data-theme="dark"] .lc-type-chip:hover { border-color: var(--color-accent); }
[data-theme="dark"] .lc-type-chip--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

[data-theme="dark"] .lc-topic-search,
[data-theme="dark"] .lc-topic-hit {
  background: var(--color-surface-sunken); border-color: var(--color-border-strong); color: var(--color-text-primary);
}
[data-theme="dark"] .lc-topic-hit--active { background: var(--color-accent-soft); border-color: var(--color-accent); }
[data-theme="dark"] .lc-topic-hit__path { color: var(--color-text-secondary); }
[data-theme="dark"] .lc-topic-picked { color: var(--color-text-primary); }
[data-theme="dark"] .lc-topic-chip {
  background: var(--color-surface-sunken);
  border-color: var(--color-border-strong);
  color: var(--color-text-secondary);
}
[data-theme="dark"] .lc-topic-chip:hover:not(.lc-topic-chip--disabled) {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
[data-theme="dark"] .lc-topic-chip--active,
[data-theme="dark"] .lc-topic-chip--active:hover:not(.lc-topic-chip--disabled) {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

[data-theme="dark"] .lc-theme-card { background: var(--color-surface-sunken); border-color: var(--color-border); }
[data-theme="dark"] .lc-theme-card:hover,
[data-theme="dark"] .lc-theme-card--active { background: var(--color-accent-soft); border-color: var(--color-accent); }

[data-theme="dark"] .lc-preview-box { background: var(--color-surface-sunken); }
[data-theme="dark"] .lc-preview-item,
[data-theme="dark"] .lc-preview-total-sep { color: var(--color-text-secondary); }
[data-theme="dark"] .lc-preview-item--tasks { color: var(--color-accent); }
[data-theme="dark"] .lc-preview-item--practice,
[data-theme="dark"] .lc-preview-item--total { color: var(--color-text); }
[data-theme="dark"] .lc-preview-item--solution { color: var(--color-success); }

[data-theme="dark"] .lc-bg-swatch { border-color: var(--color-border-strong); }
[data-theme="dark"] .lc-bg-swatch:hover,
[data-theme="dark"] .lc-bg-swatch--active { border-color: var(--color-accent); }
[data-theme="dark"] .lc-bg-mode { background: var(--color-surface-sunken); }
[data-theme="dark"] .lc-bg-mode__btn { color: var(--color-text-secondary); }
[data-theme="dark"] .lc-bg-mode__btn--active { background: var(--color-surface-elevated); color: var(--color-accent); }

[data-theme="dark"] .lc-input {
  background: var(--color-surface-sunken);
  border-color: var(--color-border-strong);
  color: var(--color-text);
}
[data-theme="dark"] .lc-input:focus { border-color: var(--color-accent); }
[data-theme="dark"] .lc-main,
[data-theme="dark"] .lc-preview,
[data-theme="dark"] .lc-mascot { background: var(--color-surface); box-shadow: none; }
[data-theme="dark"] .lc-sentence,
[data-theme="dark"] .lc-panel__head b,
[data-theme="dark"] .lc-stepper__value,
[data-theme="dark"] .lc-sum dd { color: var(--color-text); }
[data-theme="dark"] .lc-more-line,
[data-theme="dark"] .lc-panel__head span,
[data-theme="dark"] .lc-sum dt,
[data-theme="dark"] .lc-mascot { color: var(--color-text-secondary); }
[data-theme="dark"] .lc-slot,
[data-theme="dark"] .lc-slot--empty.lc-slot--on { background: var(--color-accent-soft); color: var(--color-accent); }
[data-theme="dark"] .lc-slot--empty { background: none; color: var(--color-text-muted); border-bottom-color: var(--color-border-strong); }
[data-theme="dark"] .lc-slot--on,
[data-theme="dark"] .lc-slot--on:hover,
[data-theme="dark"] .lc-count--on,
[data-theme="dark"] .lc-count--on:hover { background: var(--color-accent); color: var(--color-on-accent); }
[data-theme="dark"] .lc-panel,
[data-theme="dark"] .lc-sum div { border-color: var(--color-border); }
[data-theme="dark"] .lc-stepper__btn,
[data-theme="dark"] .lc-count,
[data-theme="dark"] .lc-diff {
  background: var(--color-surface-sunken); border-color: var(--color-border-strong); color: var(--color-text);
}
[data-theme="dark"] .lc-diff__bars i { background: var(--color-border-strong); }
[data-theme="dark"] .lc-diff__bars i.lc-diff__bar--on { background: var(--color-accent); }
[data-theme="dark"] .lc-mascot i { background: var(--color-accent-soft); color: var(--color-accent); }
</style>
