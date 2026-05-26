<template>
  <div class="lc-page">
    <div class="lc-page__inner">

      <!-- Header -->
      <div class="lc-page__header">
        <div class="lc-page__header-icon">🧩</div>
        <div>
          <h1 class="lc-page__title">Конструктор уроку</h1>
          <p class="lc-page__subtitle">
            Оберіть теми та параметри — система згенерує готову дошку з задачами НМТ.
          </p>
        </div>
      </div>

      <form class="lc-form" @submit.prevent="handleGenerate">

        <!-- ── Тема / теми ──────────────────────────────────────────────────── -->
        <section class="lc-section">
          <h2 class="lc-section__title">
            1. Оберіть теми
            <span class="lc-badge">{{ selectedTopics.length }} / {{ MAX_TOPICS }}</span>
          </h2>
          <p class="lc-section__hint">Оберіть від 1 до {{ MAX_TOPICS }} тем. Задачі беруться з усіх вибраних тем.</p>

          <div class="lc-topics">
            <button
              v-for="topic in TOPICS"
              :key="topic.value"
              type="button"
              class="lc-topic-chip"
              :class="{
                'lc-topic-chip--active': selectedTopics.includes(topic.value),
                'lc-topic-chip--disabled': !selectedTopics.includes(topic.value) && selectedTopics.length >= MAX_TOPICS,
              }"
              @click="toggleTopic(topic.value)"
            >
              {{ topic.label }}
            </button>
          </div>
          <p v-if="errors.topics" class="lc-error">{{ errors.topics }}</p>
        </section>

        <!-- ── Кількість задач ──────────────────────────────────────────────── -->
        <section class="lc-section">
          <h2 class="lc-section__title">2. Кількість задач</h2>
          <div class="lc-task-count">
            <input
              v-model.number="taskCount"
              type="range"
              min="1"
              max="20"
              step="1"
              class="lc-slider"
            />
            <span class="lc-task-count__value">{{ taskCount }}</span>
          </div>
          <!-- Реальний preview — показуємо структуру по типах сторінок -->
          <div class="lc-preview-box">
            <span class="lc-preview-item lc-preview-item--tasks">📋 {{ taskCount }} {{ taskWord }}</span>
            <span class="lc-preview-sep">→</span>
            <span v-if="theoryPages > 0" class="lc-preview-item lc-preview-item--theory">📖 1 теорія</span>
            <span v-if="theoryPages > 0" class="lc-preview-sep">+</span>
            <span class="lc-preview-item lc-preview-item--practice">📝 {{ practicePages }} практика</span>
            <span v-if="solutionPages > 0" class="lc-preview-sep">+</span>
            <span v-if="solutionPages > 0" class="lc-preview-item lc-preview-item--solution">💡 {{ solutionPages }} розбір</span>
            <span class="lc-preview-sep lc-preview-total-sep">=</span>
            <span class="lc-preview-item lc-preview-item--total">{{ totalPages }} {{ pageWord }}</span>
          </div>
          <p v-if="errors.task_count" class="lc-error">{{ errors.task_count }}</p>
        </section>

        <!-- ── Тема оформлення ──────────────────────────────────────────────── -->
        <section class="lc-section">
          <h2 class="lc-section__title">3. Стиль карток</h2>
          <div class="lc-themes">
            <button
              v-for="t in THEMES"
              :key="t.value"
              type="button"
              class="lc-theme-card"
              :class="{ 'lc-theme-card--active': theme === t.value }"
              @click="theme = t.value"
            >
              <span class="lc-theme-card__name">{{ t.label }}</span>
              <span class="lc-theme-card__desc">{{ t.desc }}</span>
            </button>
          </div>
        </section>

        <!-- ── Фон дошки ────────────────────────────────────────────────────── -->
        <section class="lc-section">
          <h2 class="lc-section__title">4. Фон дошки</h2>
          <p class="lc-section__hint">Застосовується до всіх практичних сторінок уроку.</p>
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
        </section>

        <!-- ── Додаткові параметри (collapsed) ─────────────────────────────── -->
        <section class="lc-section">
          <button
            type="button"
            class="lc-advanced-toggle"
            @click="showAdvanced = !showAdvanced"
          >
            <span>{{ showAdvanced ? '▲' : '▼' }}</span>
            Додаткові параметри
          </button>

          <div v-if="showAdvanced" class="lc-advanced">

            <div class="lc-field">
              <label class="lc-label">Складність задач</label>
              <div class="lc-radio-group">
                <label
                  v-for="dp in DIFF_PROFILES"
                  :key="dp.value"
                  class="lc-radio"
                >
                  <input v-model="diffProfile" type="radio" :value="dp.value" />
                  {{ dp.label }}
                </label>
              </div>
            </div>

            <div class="lc-field">
              <label class="lc-label">Режим уроку</label>
              <div class="lc-radio-group">
                <label
                  v-for="pm in PACING_MODES"
                  :key="pm.value"
                  class="lc-radio"
                >
                  <input v-model="pacingMode" type="radio" :value="pm.value" />
                  {{ pm.label }}
                </label>
              </div>
            </div>

            <div class="lc-field lc-field--col">
              <label class="lc-checkbox">
                <input v-model="includeTheory" type="checkbox" :disabled="pacingMode === 'exam'" />
                Сторінка теорії (визначення та формули)
              </label>
              <label class="lc-checkbox">
                <input v-model="includeSolution" type="checkbox" :disabled="pacingMode === 'exam'" />
                Окремі сторінки розбору
                <span class="lc-checkbox-hint">— повторює задачі з відповідями; зазвичай не потрібно, бо у кожній картці є "Показати розбір"</span>
              </label>
            </div>

            <div class="lc-field">
              <label class="lc-label">Назва дошки (необов'язково)</label>
              <input
                v-model="boardName"
                type="text"
                class="lc-input"
                maxlength="255"
                placeholder="Авто-назва з тем"
              />
            </div>

          </div>
        </section>

        <!-- ── Generate button ──────────────────────────────────────────────── -->
        <div class="lc-actions">
          <button
            type="submit"
            class="lc-btn-generate"
            :disabled="isLoading || selectedTopics.length === 0"
          >
            <span v-if="isLoading" class="lc-spinner" />
            <span v-else>✨</span>
            {{ isLoading ? 'Генерую урок…' : 'Згенерувати урок' }}
          </button>

          <p v-if="errors.general" class="lc-error lc-error--center">
            {{ errors.general }}
          </p>
        </div>

      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  TOPICS,
  THEMES,
  DIFF_PROFILES,
  PACING_MODES,
  lessonConstructorApi,
} from '../api/lessonConstructorApi'

const router = useRouter()

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_TOPICS = 5

const BG_PRESETS = [
  { value: '#ffffff', label: 'Білий (чистий)' },
  { value: '#fef9f0', label: 'Тепло-бежевий' },
  { value: '#f0f7ff', label: 'М\'який блакитний' },
  { value: '#f0fdf4', label: 'М\'який зелений' },
  { value: '#faf5ff', label: 'Лавандовий' },
  { value: '#fff7ed', label: 'Персиковий' },
  { value: '#f8fafc', label: 'Сіро-білий' },
  { value: '#f1f5f9', label: 'Сталевий' },
  { value: '#1e1e2e', label: 'Темний (нічний)' },
] as const

// ── Form state ─────────────────────────────────────────────────────────────
const selectedTopics  = ref<string[]>([])
const taskCount       = ref(4)
const theme           = ref('visual')
const boardBg         = ref('#ffffff')
const diffProfile     = ref('balanced')
const pacingMode      = ref('tutorial')
const includeTheory   = ref(true)
const includeSolution = ref(false)  // задачі вже мають кнопки "Показати відповідь/розбір"
const boardName       = ref('')
const showAdvanced    = ref(false)

// ── UI state ───────────────────────────────────────────────────────────────
const isLoading = ref(false)
const errors    = ref<Record<string, string>>({})

// ── Computed ───────────────────────────────────────────────────────────────
const currentTheme = computed(() => THEMES.find(t => t.value === theme.value))

/** Кількість практичних сторінок */
const practicePages = computed(() => {
  const perPage = currentTheme.value?.tasksPerPage ?? 1
  return Math.max(1, Math.ceil(taskCount.value / perPage))
})

/** Кількість сторінок розбору (= practicePages, той самий chunking що й practice). */
const solutionPages = computed(() => {
  if (pacingMode.value === 'exam' || !includeSolution.value) return 0
  return practicePages.value
})

/** Кількість теоретичних сторінок (0 або 1). */
const theoryPages = computed(() => {
  if (pacingMode.value === 'exam' || !includeTheory.value) return 0
  return 1
})

/** Загальна кількість сторінок (practice + theory + solution). */
const totalPages = computed(() =>
  practicePages.value + theoryPages.value + solutionPages.value
)

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

// ── Topic toggle ───────────────────────────────────────────────────────────
function toggleTopic(value: string) {
  const idx = selectedTopics.value.indexOf(value)
  if (idx >= 0) {
    selectedTopics.value.splice(idx, 1)
  } else if (selectedTopics.value.length < MAX_TOPICS) {
    selectedTopics.value.push(value)
  }
}

// ── Validation ─────────────────────────────────────────────────────────────
function validate(): boolean {
  errors.value = {}
  if (selectedTopics.value.length === 0) {
    errors.value.topics = 'Оберіть хоча б одну тему'
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
      task_count:            taskCount.value,
      theme:                 theme.value,
      board_bg:              boardBg.value !== '#ffffff' ? boardBg.value : undefined,
      diff_profile:          diffProfile.value,
      pacing_mode:           pacingMode.value,
      include_theory_page:   pacingMode.value !== 'exam' && includeTheory.value,
      include_solution_page: pacingMode.value !== 'exam' && includeSolution.value,
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

.lc-page__inner {
  max-width: 780px;
  margin: 0 auto;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.lc-page__header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
}

.lc-page__header-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.lc-page__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem;
}

.lc-page__subtitle {
  color: #64748b;
  font-size: 0.95rem;
  margin: 0;
}

/* ── Form ───────────────────────────────────────────────────────────────── */
.lc-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lc-section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
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
.lc-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
  white-space: nowrap;
}

.lc-topic-chip:hover:not(.lc-topic-chip--disabled) {
  border-color: #6366f1;
  color: #4f46e5;
  background: #eef2ff;
}

.lc-topic-chip--active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #ffffff;
}

.lc-topic-chip--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Task count ─────────────────────────────────────────────────────────── */
.lc-task-count {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.lc-slider {
  flex: 1;
  accent-color: #4f46e5;
}

.lc-task-count__value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4f46e5;
  min-width: 2.5rem;
  text-align: center;
}

/* ── Themes ─────────────────────────────────────────────────────────────── */
.lc-themes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 600px) {
  .lc-themes {
    grid-template-columns: repeat(4, 1fr);
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
  border-color: #6366f1;
  background: #eef2ff;
}

.lc-theme-card--active {
  border-color: #4f46e5;
  background: #eef2ff;
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

.lc-preview-item--tasks    { color: #4f46e5; font-weight: 600; }
.lc-preview-item--theory   { color: #0369a1; }
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
  border-color: #6366f1;
  transform: scale(1.08);
}

.lc-bg-swatch--active {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.lc-bg-swatch__check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #4f46e5;
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

/* ── Advanced ───────────────────────────────────────────────────────────── */
.lc-advanced-toggle {
  background: none;
  border: none;
  color: #4f46e5;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  margin-bottom: 1rem;
}

.lc-advanced {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.lc-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lc-field--row {
  flex-direction: row;
  gap: 1.5rem;
}

.lc-field--col {
  flex-direction: column;
  gap: 0.75rem;
}

.lc-checkbox-hint {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 400;
  display: block;
  margin-top: 0.15rem;
  margin-left: 1.4rem;
}

.lc-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.lc-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.lc-radio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.lc-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

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
  border-color: #4f46e5;
}

/* ── Actions ────────────────────────────────────────────────────────────── */
.lc-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.lc-btn-generate {
  background: #4f46e5;
  color: #ffffff;
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
  min-width: 220px;
  justify-content: center;
}

.lc-btn-generate:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.lc-btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
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

/* ── Spinner ────────────────────────────────────────────────────────────── */
.lc-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: lc-spin 0.7s linear infinite;
}

@keyframes lc-spin {
  to { transform: rotate(360deg); }
}
</style>
