<!--
  NmtTaskRenderer — nmt_task asset HTML overlay (§3.7.9).
  Interactive NMT task card for Lesson Constructor.

  Три типи задач:
    single_choice — питання + сітка варіантів А/Б/В/Г + "Показати відповідь"
    matching      — питання + пари ліворуч↔праворуч + "Показати відповідь"
    open_answer   — питання + поле вводу + "Показати відповідь"

  Всі типи: кнопка "Показати розбір" (solution block, hidden by default).

  POINTER-EVENTS MODEL:
    Root .nmt-task           = pointer-events:none → Konva proxy catches drag/select.
    .nmt-task__header        = pointer-events:none → falls through to Konva proxy.
    .nmt-task__body          = pointer-events:auto → user interacts with content.
    .nmt-task__body[readonly]= pointer-events:none → clicks fall through (pen/other tools).
    .nmt-task__delete-btn    = pointer-events:auto with event.stop (always available when selected).

  State:
    showAnswer / showSolution — persisted via update:asset emit
    selectedOptionId          — local only (student's current selection)
    openAnswerValue           — local only (student's typed answer)

  Follows: TrigSolverRenderer (§3.7.7), Nmt3dRenderer (§3.7.8).
-->
<template>
  <div
    ref="rootEl"
    class="nmt-task"
    :class="[
      `nmt-task--${data.taskType}`,
      { 'is-selected': isSelected, 'is-readonly': !interactive },
    ]"
    :data-testid="`nmt-task-${asset.id}`"
  >
    <!-- Кольорова смуга зліва за типом задачі -->
    <div class="nmt-task__accent-bar" />

    <!-- Основний контент: header + body -->
    <div class="nmt-task__inner">

    <!-- Header — pointer-events:none so Konva proxy catches drag -->
    <header class="nmt-task__header">
      <span class="nmt-task__type-icon">{{ typeIcon }}</span>
      <span class="nmt-task__type-badge">{{ typeBadge }}</span>
      <!-- externalId (артикул задачі) НЕ показуємо користувачу — лишається в data
           для traceability/provenance, але це технічний ідентифікатор, не для очей.
           Delete-кнопка має власний margin-left:auto, тож притискається праворуч. -->
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="nmt-task__delete-btn"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <!-- Body — pointer-events:auto for interactions -->
    <div class="nmt-task__body">

      <!-- Question text -->
      <div class="nmt-task__question" v-html="renderTextWithLatex(data.question)" />

      <!-- ── single_choice ────────────────────────────────── -->
      <div v-if="data.taskType === 'single_choice'" class="nmt-task__options">
        <button
          v-for="opt in data.options"
          :key="opt.id"
          type="button"
          class="nmt-task__option"
          :class="{
            'is-selected': selectedOptionId === opt.id,
            'is-correct':  data.showAnswer && opt.isCorrect,
            'is-wrong':    data.showAnswer && !opt.isCorrect && selectedOptionId === opt.id,
          }"
          @click.stop="selectOption(opt.id)"
          @mousedown.stop
          @pointerdown.stop
        >
          <span class="nmt-task__option-letter">{{ opt.letter }}</span>
          <span class="nmt-task__option-text" v-html="renderTextWithLatex(opt.text)" />
        </button>
      </div>

      <!-- ── open_answer ──────────────────────────────────── -->
      <div v-else-if="data.taskType === 'open_answer'" class="nmt-task__input-wrap">
        <input
          class="nmt-task__input"
          :type="data.inputType ?? 'text'"
          v-model="openAnswerValue"
          placeholder="Введіть відповідь…"
          @mousedown.stop
          @pointerdown.stop
        />
        <div
          v-if="data.showAnswer && data.correctAnswer"
          class="nmt-task__correct-hint"
        >
          <span class="nmt-task__hint-icon">✓</span>
          <span v-html="renderTextWithLatex(String(data.correctAnswer))" />
        </div>
      </div>

      <!-- ── matching ─────────────────────────────────────── -->
      <div v-else-if="data.taskType === 'matching'" class="nmt-task__pairs">
        <div
          v-for="(pair, i) in data.pairs"
          :key="pair.id"
          class="nmt-task__pair"
          :class="{ 'is-answer-shown': data.showAnswer }"
        >
          <div class="nmt-task__pair-letter">{{ LETTERS[i] }}</div>
          <div class="nmt-task__pair-left" v-html="renderTextWithLatex(pair.left)" />
          <div class="nmt-task__pair-sep">—</div>
          <div class="nmt-task__pair-right" v-html="renderTextWithLatex(pair.right)" />
        </div>
      </div>

      <!-- ── Action buttons ────────────────────────────────── -->
      <div class="nmt-task__actions">
        <button
          v-if="hasAnswerToShow"
          type="button"
          class="nmt-task__btn"
          :class="{ 'is-active': data.showAnswer }"
          @click.stop="toggleShowAnswer"
          @mousedown.stop
          @pointerdown.stop
        >
          {{ data.showAnswer ? 'Сховати відповідь' : 'Показати відповідь' }}
        </button>
        <button
          v-if="data.solution"
          type="button"
          class="nmt-task__btn nmt-task__btn--solution"
          :class="{ 'is-active': data.showSolution }"
          @click.stop="toggleShowSolution"
          @mousedown.stop
          @pointerdown.stop
        >
          {{ data.showSolution ? 'Сховати розбір' : 'Показати розбір' }}
        </button>
        <!-- Кнопка "Побудувати" — тільки якщо задача має semantic intents
             і CapabilityRegistry може resolve хоча б один renderer -->
        <button
          v-if="hasCompanion"
          type="button"
          class="nmt-task__btn nmt-task__btn--build"
          @click.stop="handleBuild"
          @mousedown.stop
          @pointerdown.stop
        >
          🔗 Побудувати
        </button>
      </div>

      <!-- ── Solution block ────────────────────────────────── -->
      <div v-if="data.showSolution && data.solution" class="nmt-task__solution">
        <span class="nmt-task__solution-icon">📖</span>
        <div
          class="nmt-task__solution-text"
          v-html="renderTextWithLatex(data.solution)"
        />
      </div>

    </div><!-- /.nmt-task__body -->
    </div><!-- /.nmt-task__inner -->
  </div><!-- /.nmt-task -->
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBAsset } from '../../../types/winterboard'
import type { NmtTaskData } from '../../../types/nmtTask'
import {
  resolveCompanions,
  hasAvailableCompanions,
} from '../../../services/capabilityRegistry'
import type { CompanionResolution } from '../../../services/capabilityRegistry'
// EXPORT_PREPARATION_SSOT (PR-2 fix-up 2026-05-25): widget preview capture.
// nmt_task is a DOM widget (HTML + KaTeX) — snapshotElement falls through
// to foreignObject SVG rasterize path. INV-EP-8: thin adapter only.
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є', 'Ж', 'З', 'І']

const props = defineProps<{
  asset: WBAsset
  isSelected: boolean
  interactive: boolean
}>()

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  'delete': []
  /** Випускається коли натиснуто "Побудувати" — WBCanvas spawn-ить companions. */
  'spawn-companions': [payload: {
    sourceAssetId: string
    companions: CompanionResolution[]
    spawnX: number
    spawnY: number
  }]
}>()

// ── Template root for export capture ─────────────────────────────────────────
const rootEl = ref<HTMLElement | null>(null)

// INV-EP-8: thin adapter — snapshotElement тут пробує canvas → svg → DOM
// rasterize (третій fallback саме для DOM widgets як nmt_task).
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)

// ── Data access ───────────────────────────────────────────────────────────────

const data = computed(() => (props.asset.data as unknown as NmtTaskData))

// ── Header label ──────────────────────────────────────────────────────────────

const typeBadge = computed(() => {
  switch (data.value.taskType) {
    case 'single_choice': return 'Вибір відповіді'
    case 'matching':      return 'Відповідність'
    case 'open_answer':   return 'Відкрита відповідь'
    default:              return 'Завдання'
  }
})

const typeIcon = computed(() => {
  switch (data.value.taskType) {
    case 'single_choice': return '◉'
    case 'matching':      return '⇄'
    case 'open_answer':   return '✏'
    default:              return '📋'
  }
})

// ── Companion spawn ───────────────────────────────────────────────────────────

/**
 * Чи показувати кнопку "Побудувати":
 * - fingerprint є і має непорожній intents[]
 * - CapabilityRegistry може resolve хоча б один renderer
 *
 * Companion — ЄДИНИЙ механізм: on-demand кнопка (per-task). Pre-placement прибрано,
 * тож fp.companion більше НЕ впливає на показ кнопки (раніше ховав її).
 * INV-CAP-1: рішення який renderer spawn-ити — тільки в resolveCompanions().
 */
const hasCompanion = computed(() => {
  const fp = data.value.fingerprint
  if (!fp?.intents?.length) return false
  return hasAvailableCompanions(fp.intents, fp.extracted_data ?? {})
})

function handleBuild() {
  const fp = data.value.fingerprint
  if (!fp?.intents?.length) return

  const companions = resolveCompanions(fp.intents, fp.extracted_data ?? {})
  if (!companions.length) return

  emit('spawn-companions', {
    sourceAssetId: props.asset.id,
    companions,
    spawnX:        props.asset.x + props.asset.w + 24,
    spawnY:        props.asset.y,
  })
}

// ── Local interaction state ───────────────────────────────────────────────────

/** single_choice — id вибраного варіанту (local, не персистується) */
const selectedOptionId = ref<string | null>(null)

/** open_answer — поточний введений текст (local) */
const openAnswerValue = ref<string>('')

function selectOption(id: string) {
  selectedOptionId.value = selectedOptionId.value === id ? null : id
}

// ── Persisted toggles ─────────────────────────────────────────────────────────

/** Чи є що показувати кнопкою "Показати відповідь" */
const hasAnswerToShow = computed(() => {
  const d = data.value
  if (d.taskType === 'single_choice') return (d.options?.some(o => o.isCorrect)) ?? false
  if (d.taskType === 'open_answer')   return !!d.correctAnswer
  if (d.taskType === 'matching')      return (d.pairs?.length ?? 0) > 0
  return false
})

function toggleShowAnswer() {
  emitDataUpdate({ showAnswer: !data.value.showAnswer })
}

function toggleShowSolution() {
  emitDataUpdate({ showSolution: !data.value.showSolution })
}

function emitDataUpdate(patch: Partial<NmtTaskData>) {
  emit('update:asset', {
    ...props.asset,
    data: { ...data.value, ...patch } as unknown as WBAsset['data'],
  })
}
</script>

<style scoped>
/* ── CSS змінні за типом задачі ──────────────────────────────────────── */
.nmt-task--single_choice {
  --accent:       #6366f1;
  --accent-light: #eef2ff;
  --accent-mid:   #a5b4fc;
  --header-bg:    #f5f3ff;
}
.nmt-task--open_answer {
  --accent:       #059669;
  --accent-light: #f0fdf4;
  --accent-mid:   #6ee7b7;
  --header-bg:    #ecfdf5;
}
.nmt-task--matching {
  --accent:       #7c3aed;
  --accent-light: #faf5ff;
  --accent-mid:   #c4b5fd;
  --header-bg:    #f5f3ff;
}

/* ── Root ────────────────────────────────────────────────────────────── */
.nmt-task {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  background: #ffffff;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.nmt-task.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18), 0 2px 8px rgba(0, 0, 0, 0.07);
}

/* ── Кольорова смуга акценту (ліворуч) ───────────────────────────────── */
.nmt-task__accent-bar {
  flex-shrink: 0;
  width: 5px;
  background: var(--accent, #6366f1);
}

/* ── Внутрішній контейнер (без смуги) ───────────────────────────────── */
.nmt-task__header,
.nmt-task__body {
  /* компенсуємо flex-row: розтягуємо на всю ширину */
}

.nmt-task {
  /* Override flex-direction для внутрішнього layout */
}

/* Обгортка: accent-bar + column-layout */
.nmt-task__inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.nmt-task__header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 6px;
  background: var(--header-bg, #f8fafc);
  border-bottom: 1px solid #e5e7eb;
  pointer-events: none;
  user-select: none;
  flex-shrink: 0;
}

.nmt-task__type-icon {
  font-size: 13px;
  color: var(--accent);
  flex-shrink: 0;
}

.nmt-task__type-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-light);
  border-radius: 5px;
  padding: 2px 8px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.nmt-task__delete-btn {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: background 0.12s, color 0.12s;
}

.nmt-task__delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* ── Body ────────────────────────────────────────────────────────────── */
.nmt-task__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
  overflow-y: auto;
  pointer-events: auto;
}

.nmt-task.is-readonly .nmt-task__body {
  pointer-events: none;
}

/* ── Question ────────────────────────────────────────────────────────── */
.nmt-task__question {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.55;
  color: #0f172a;
  padding-bottom: 4px;
  border-bottom: 1px solid #f1f5f9;
}

/* ── single_choice: options grid ─────────────────────────────────────── */
.nmt-task__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.nmt-task__option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border: 1.5px solid #e5e7eb;
  border-radius: 9px;
  background: #fafafa;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: #374151;
  transition: border-color 0.13s, background 0.13s, transform 0.1s;
}

.nmt-task__option:hover {
  border-color: var(--accent-mid);
  background: var(--accent-light);
  transform: translateY(-1px);
}

.nmt-task__option.is-selected {
  border-color: var(--accent);
  background: var(--accent-light);
}

.nmt-task__option.is-correct {
  border-color: #16a34a;
  background: #f0fdf4;
}

.nmt-task__option.is-wrong {
  border-color: #dc2626;
  background: #fef2f2;
}

.nmt-task__option-letter {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.13s, color 0.13s;
}

.nmt-task__option.is-selected .nmt-task__option-letter {
  background: var(--accent);
  color: #fff;
}

.nmt-task__option.is-correct .nmt-task__option-letter {
  background: #16a34a;
  color: #fff;
}

.nmt-task__option.is-wrong .nmt-task__option-letter {
  background: #dc2626;
  color: #fff;
}

.nmt-task__option-text {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

/* ── open_answer ─────────────────────────────────────────────────────── */
.nmt-task__input-wrap {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.nmt-task__input {
  width: 100%;
  max-width: 380px;
  height: 42px;
  padding: 0 13px;
  border: 1.5px solid #d1d5db;
  border-radius: 9px;
  font-size: 14px;
  background: #fafafa;
  color: #111827;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.nmt-task__input:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}

.nmt-task__correct-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 7px;
  padding: 6px 11px;
}

.nmt-task__hint-icon {
  font-size: 14px;
  flex-shrink: 0;
}

/* ── matching ────────────────────────────────────────────────────────── */
.nmt-task__pairs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nmt-task__pair {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
  font-size: 13px;
  color: #374151;
  transition: background 0.13s, border-color 0.13s;
}

.nmt-task__pair.is-answer-shown {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.nmt-task__pair-letter {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nmt-task__pair-left {
  flex: 1;
  min-width: 0;
  font-weight: 500;
}

.nmt-task__pair-sep {
  flex-shrink: 0;
  color: #cbd5e1;
  font-size: 16px;
  font-weight: 300;
}

.nmt-task__pair-right {
  flex: 1;
  min-width: 0;
  color: #166534;
  font-weight: 500;
}

/* ── Action buttons ──────────────────────────────────────────────────── */
.nmt-task__actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.nmt-task__btn {
  padding: 6px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.13s, background 0.13s, color 0.13s, transform 0.1s;
}

.nmt-task__btn:hover {
  border-color: var(--accent-mid);
  background: var(--accent-light);
  color: var(--accent);
  transform: translateY(-1px);
}

.nmt-task__btn.is-active {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}

.nmt-task__btn--solution {
  border-color: #d1fae5;
  background: #f0fdf4;
  color: #166534;
}

.nmt-task__btn--solution:hover,
.nmt-task__btn--solution.is-active {
  border-color: #16a34a;
  background: #dcfce7;
  color: #14532d;
}

/* "Побудувати" — companion spawn btn (azure accent) */
.nmt-task__btn--build {
  border-color: #bae6fd;
  background: #f0f9ff;
  color: #0369a1;
  font-size: 12px;
}

.nmt-task__btn--build:hover {
  border-color: #0ea5e9;
  background: #e0f2fe;
  color: #0284c7;
  transform: translateY(-1px);
}

/* ── Solution block ──────────────────────────────────────────────────── */
.nmt-task__solution {
  display: flex;
  gap: 9px;
  padding: 10px 13px;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid #bbf7d0;
  border-radius: 9px;
  font-size: 13px;
  color: #166534;
  line-height: 1.55;
}

.nmt-task__solution-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.nmt-task__solution-text {
  flex: 1;
  min-width: 0;
}
</style>
