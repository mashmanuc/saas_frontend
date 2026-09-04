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
    selectedIds               — local only (обрані варіанти; для
                                single_choice у наборі щонайбільше один)
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
    :style="{ '--nmt-presentation-scale': String(presentationScale) }"
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
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <!-- Body — pointer-events:auto for interactions -->
    <div class="nmt-task__body">

      <!-- Question text -->
      <div class="nmt-task__question" v-html="renderTextWithLatex(data.question)" />

      <!-- Ілюстрація умови (QUESTION_IMAGE). БЕЗ loading="lazy": картка може бути
           поза вьюпортом дошки → браузер не вантажив би зображення взагалі. -->
      <div v-if="questionImages.length" class="nmt-task__figures">
        <img
          v-for="(src, i) in questionImages"
          :key="i"
          :src="src"
          class="nmt-task__figure"
          alt=""
          draggable="false"
        />
      </div>

      <!-- ── single_choice / multiple_select ──────────────────
           Сітка варіантів спільна; різниця лише в тому, скільки їх можна
           вибрати. Окрема гілка для multiple_select дала б дубль розмітки. -->
      <!-- Скільки саме вибрати. Без цього рядка картка виглядає як звичайний
           вибір однієї відповіді, і учень зупиняється на першій правильній. -->
      <div v-if="selectCount > 1" class="nmt-task__hint">
        {{ t('winterboard.widget.nmtTask.selectN', { n: selectCount }) }}
      </div>

      <div v-if="isChoiceType" class="nmt-task__options">
        <button
          v-for="(opt, oi) in data.options"
          :key="opt.id"
          type="button"
          class="nmt-task__option"
          :class="{
            'is-selected': isSelected(opt.id),
            'is-correct':  data.showAnswer && opt.isCorrect,
            'is-wrong':    data.showAnswer && !opt.isCorrect && isSelected(opt.id),
          }"
          @click.stop="selectOption(opt.id)"
          @mousedown.stop
          @pointerdown.stop
        >
          <span class="nmt-task__option-letter">{{ opt.letter }}</span>
          <span class="nmt-task__option-text" v-html="renderTextWithLatex(opt.text)" />
          <!-- варіант-картинка (OPTION_IMAGE ↔ order) -->
          <img
            v-if="optionImage(oi)"
            :src="optionImage(oi)"
            class="nmt-task__option-img"
            alt=""
            draggable="false"
          />
        </button>
      </div>

      <!-- ── open_answer ──────────────────────────────────── -->
      <div v-else-if="data.taskType === 'open_answer'" class="nmt-task__input-wrap">
        <input
          class="nmt-task__input"
          :type="data.inputType ?? 'text'"
          v-model="openAnswerValue"
          :placeholder="t('winterboard.widget.nmtTask.answerPlaceholder')"
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

      <!-- ── Тема задачі: виправлення в потоці роботи ─────────
           Показуємо ЛИШЕ тьютору: це зміна спільного банку, не своєї
           копії. Бекенд теж віддає 403 — сховати кнопку це зручність,
           403 це межа, і одне не заміняє інше. -->
      <div v-if="topicFix.canFix.value" class="nmt-task__topic">
        <button
          type="button"
          class="nmt-task__topic-btn"
          :disabled="topicFix.saving.value"
          @click.stop="topicFix.toggle()"
          @mousedown.stop
          @pointerdown.stop
        >{{ topicFix.done.value ? `✓ ${topicFix.done.value}` : '✎ тема' }}</button>

        <div v-if="topicFix.open.value" class="nmt-task__topic-menu" @click.stop>
          <div v-if="topicFix.loading.value" class="nmt-task__topic-note">
            завантаження…
          </div>
          <template v-else>
            <div v-if="topicFix.current.value" class="nmt-task__topic-note">
              зараз: {{ topicFix.current.value.label }}
            </div>
            <button
              v-for="opt in (topicFix.showAll.value
                ? topicFix.allTopics.value : topicFix.suggestions.value)"
              :key="opt.id"
              type="button"
              class="nmt-task__topic-item"
              :disabled="topicFix.saving.value"
              @click.stop="topicFix.apply(opt.id)"
            >{{ opt.label }}</button>

            <button
              v-if="!topicFix.showAll.value"
              type="button"
              class="nmt-task__topic-item nmt-task__topic-item--muted"
              @click.stop="topicFix.showAll.value = true"
            >інша…</button>

            <button
              type="button"
              class="nmt-task__topic-item nmt-task__topic-item--danger"
              :disabled="topicFix.saving.value"
              @click.stop="topicFix.reject()"
            >задача погана — прибрати</button>

            <div v-if="topicFix.error.value" class="nmt-task__topic-error">
              {{ topicFix.error.value }}
            </div>
          </template>
        </div>
      </div>

      <!-- ── Action buttons ────────────────────────────────── -->
      <div class="nmt-task__actions">
        <button
          v-if="hasAnswerToShow && revealAllowed"
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
          v-if="data.solution && revealAllowed"
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
          :style="{ fontSize: (solutionZoom.fontPx.value * presentationScale) + 'px' }"
          v-html="renderTextWithLatex(data.solution)"
        />
        <!-- Масштаб розбору. Розмір особистий (localStorage), у дошку не
             пишеться — див. useSolutionZoom. Кнопки поза текстом, щоб самі
             не збільшувались разом із ним. -->
        <div class="nmt-task__solution-zoom" @pointerdown.stop @mousedown.stop>
          <button
            type="button"
            class="nmt-task__zoom-btn"
            :disabled="!solutionZoom.canZoomOut.value"
            :title="t('winterboard.widget.nmtTask.solutionZoomOut')"
            :aria-label="t('winterboard.widget.nmtTask.solutionZoomOut')"
            @click.stop="solutionZoom.zoomOut()"
          >А−</button>
          <button
            type="button"
            class="nmt-task__zoom-btn"
            :disabled="solutionZoom.isDefault.value"
            :title="t('winterboard.widget.nmtTask.solutionZoomReset')"
            :aria-label="t('winterboard.widget.nmtTask.solutionZoomReset')"
            @click.stop="solutionZoom.reset()"
          >⟲</button>
          <button
            type="button"
            class="nmt-task__zoom-btn"
            :disabled="!solutionZoom.canZoomIn.value"
            :title="t('winterboard.widget.nmtTask.solutionZoomIn')"
            :aria-label="t('winterboard.widget.nmtTask.solutionZoomIn')"
            @click.stop="solutionZoom.zoomIn()"
          >А+</button>
        </div>
      </div>

    </div><!-- /.nmt-task__body -->
    </div><!-- /.nmt-task__inner -->
  </div><!-- /.nmt-task -->

    <!-- 8a-3: крок розв'язку. Компонент сам перевіряє прапорець і роль —
         показується лише учню при увімкненому Copilot. -->
    <WBStepInput v-if="interactive && data.externalId" :task-id="String(data.externalId)" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSolutionZoom } from '../../../composables/useSolutionZoom'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import { resolveMediaUrl } from '@/utils/media'
import type { WBAsset } from '../../../types/winterboard'
import { normalizeNmtPresentationScale, type NmtTaskData } from '../../../types/nmtTask'
import {
  resolveCompanions,
  hasAvailableCompanions,
} from '../../../services/capabilityRegistry'
import type { CompanionResolution } from '../../../services/capabilityRegistry'
// EXPORT_PREPARATION_SSOT (PR-2 fix-up 2026-05-25): widget preview capture.
// nmt_task is a DOM widget (HTML + KaTeX) — snapshotElement falls through
// to foreignObject SVG rasterize path. INV-EP-8: thin adapter only.
import { useExportCapture } from '../../../composables/useExportCapture'
import WBStepInput from '../../copilot/WBStepInput.vue'
// 8b-2: reveal gate — «Показати відповідь/розбір» замкнені до стадії 3,
// але ЛИШЕ коли активний канал AI-репетитора (учень); тьютора не чіпає.
import { useTutorRevealGate } from '../../../composables/useStudentTutor'
import { useTaskTopicFix } from '../../../composables/useTaskTopicFix'
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

// Масштаб розбору. Singleton на рівні модуля: збільшив на одній картці —
// більший на всіх (див. useSolutionZoom). У стан дошки НЕ пишеться.
const solutionZoom = useSolutionZoom()

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

/** Масштаб символів картки; рамка та масштаб полотна від нього не залежать. */
const presentationScale = computed(() => normalizeNmtPresentationScale(data.value.presentationScale))

/* ── Ілюстрації задачі (2026-07-31) ──────────────────────────────────────────
   Задачі «На рисунку зображено куб…» приходили голим текстом: BE не проносив
   resource_refs у nmt_task, а тут не було <img>. BE віддає лише refs з url,
   тому додаткової перевірки на биті посилання не потрібно.                  */
const questionImages = computed(() =>
  (data.value.resourceRefs ?? [])
    .filter((r) => (r.role ?? 'QUESTION_IMAGE') === 'QUESTION_IMAGE')
    .map((r) => resolveMediaUrl(r.url)),
)
/** OPTION_IMAGE прив'язується до варіанта за order (0 → А, 1 → Б, …). */
function optionImage(index: number): string {
  const ref = (data.value.resourceRefs ?? []).find(
    (r) => r.role === 'OPTION_IMAGE' && r.order === index,
  )
  return ref ? resolveMediaUrl(ref.url) : ''
}

// ── Header label ──────────────────────────────────────────────────────────────

const typeBadge = computed(() => {
  switch (data.value.taskType) {
    case 'single_choice': return 'Вибір відповіді'
    case 'multiple_select': return 'Кілька відповідей'
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
  return hasAvailableCompanions(fp.intents, fp.extracted_data ?? {}, fp.entities ?? [])
})

function handleBuild() {
  const fp = data.value.fingerprint
  if (!fp?.intents?.length) return

  const companions = resolveCompanions(fp.intents, fp.extracted_data ?? {}, fp.entities ?? [])
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

/** open_answer — поточний введений текст (local) */
const openAnswerValue = ref<string>('')

/** Чи тип задачі має сітку варіантів (обидва — з одним рендером). */
const isChoiceType = computed(
  () => data.value.taskType === 'single_choice'
     || data.value.taskType === 'multiple_select',
)

/** Скільки варіантів треба вибрати; для single_choice завжди один. */
const selectCount = computed(() =>
  data.value.taskType === 'multiple_select'
    ? Math.max(1, data.value.selectCount ?? 1)
    : 1,
)

/** Вибрані варіанти. Для single_choice у наборі щонайбільше один. */
const selectedIds = ref<Set<string>>(new Set())

function isSelected(id: string): boolean {
  return selectedIds.value.has(id)
}

function selectOption(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    // ⚠️ У single_choice попередній вибір знімається — інакше картка тихо
    // перетворилась би на множинний вибір там, де правильна відповідь одна.
    if (selectCount.value === 1) next.clear()
    next.add(id)
  }
  selectedIds.value = next
}

// ── Persisted toggles ─────────────────────────────────────────────────────────

/** Чи є що показувати кнопкою "Показати відповідь" */
const hasAnswerToShow = computed(() => {
  const d = data.value
  if (d.taskType === 'single_choice' || d.taskType === 'multiple_select') {
    return (d.options?.some(o => o.isCorrect)) ?? false
  }
  if (d.taskType === 'open_answer')   return !!d.correctAnswer
  if (d.taskType === 'matching')      return (d.pairs?.length ?? 0) > 0
  return false
})

const revealAllowed = useTutorRevealGate(() => String(data.value.externalId ?? ''))

/** Виправлення теми на місці — уся логіка в композаблі, тут лише вигляд. */
const topicFix = useTaskTopicFix(() => String(data.value.externalId ?? ''))

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
  /* Єдина вісь показу для пульта A−/A+: усі текстові розміри нижче беруть
     значення з цих змінних. KaTeX рахує формули в em і масштабується разом. */
  --nmt-font-11: calc(11px * var(--nmt-presentation-scale, 1));
  --nmt-font-12: calc(12px * var(--nmt-presentation-scale, 1));
  --nmt-font-13: calc(13px * var(--nmt-presentation-scale, 1));
  --nmt-font-14: calc(14px * var(--nmt-presentation-scale, 1));
  --nmt-font-15: calc(15px * var(--nmt-presentation-scale, 1));
  --nmt-font-16: calc(16px * var(--nmt-presentation-scale, 1));
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
  font-size: var(--nmt-font-13);
  color: var(--accent);
  flex-shrink: 0;
}

.nmt-task__type-badge {
  font-size: var(--nmt-font-11);
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
  font-size: var(--nmt-font-16);
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
  font-size: var(--nmt-font-15);
  font-weight: 500;
  line-height: 1.55;
  color: #0f172a;
  padding-bottom: 4px;
  border-bottom: 1px solid #f1f5f9;
}

/* ── ілюстрації задачі (QUESTION_IMAGE / OPTION_IMAGE) ───────────────── */
.nmt-task__figures {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  padding: 10px 0 4px;
}
.nmt-task__figure {
  max-width: 100%;
  max-height: 320px;          /* щоб велике креслення не розпирало картку */
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
}
.nmt-task__option-img {
  max-width: 100%;
  max-height: 110px;
  object-fit: contain;
  margin-left: 8px;
  border-radius: 4px;
  background: #fff;
}

.nmt-task__topic {
  position: relative;
  margin-top: 6px;
}

.nmt-task__topic-btn {
  pointer-events: auto;
  border: none;
  background: transparent;
  padding: 0;
  font-size: var(--nmt-font-11);
  color: #64748b;
  cursor: pointer;
}

.nmt-task__topic-btn:hover { color: #2563eb; }

.nmt-task__topic-menu {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  min-width: 208px;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);
  /* Довгий список «інша…» не мусить розтягувати картку. */
  max-height: 240px;
  overflow-y: auto;
}

.nmt-task__topic-note {
  padding: 4px 8px;
  font-size: var(--nmt-font-11);
  color: #94a3b8;
}

.nmt-task__topic-item {
  display: block;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: var(--nmt-font-12);
  text-align: left;
  color: #0f172a;
  cursor: pointer;
}

.nmt-task__topic-item:hover { background: #f1f5f9; }
.nmt-task__topic-item--muted { color: #64748b; }
.nmt-task__topic-item--danger { color: #b91c1c; }

.nmt-task__topic-error {
  padding: 4px 8px;
  font-size: var(--nmt-font-11);
  color: #b91c1c;
}

.nmt-task__hint {
  margin: 2px 0 6px;
  font-size: var(--nmt-font-12);
  font-weight: 600;
  color: #b45309;
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
  font-size: var(--nmt-font-13);
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
  font-size: var(--nmt-font-12);
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
  font-size: var(--nmt-font-14);
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
  font-size: var(--nmt-font-13);
  font-weight: 600;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 7px;
  padding: 6px 11px;
}

.nmt-task__hint-icon {
  font-size: var(--nmt-font-14);
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
  font-size: var(--nmt-font-13);
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
  font-size: var(--nmt-font-11);
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
  font-size: var(--nmt-font-16);
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
  font-size: var(--nmt-font-12);
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
  font-size: var(--nmt-font-12);
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
  font-size: var(--nmt-font-13);
  color: #166534;
  line-height: 1.55;
}

.nmt-task__solution-icon {
  flex-shrink: 0;
  font-size: var(--nmt-font-16);
}

.nmt-task__solution-text {
  flex: 1;
  min-width: 0;
  /* Розмір задає інлайн-стиль із useSolutionZoom. KaTeX усередині рахує все
     в `em`, тож формули масштабуються разом із текстом самі. */
}

/* Кнопки масштабу — поза текстом, інакше зростали б разом із ним. */
.nmt-task__solution-zoom {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  align-self: flex-start;
  /* Власний розмір, не успадкований: блок розбору лишається 13px, а текст
     усередині може бути 28px. */
  font-size: 11px;
}

.nmt-task__zoom-btn {
  width: 22px;
  height: 20px;
  padding: 0;
  border: 1px solid #bbf7d0;
  border-radius: 5px;
  background: #fff;
  color: #166534;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.nmt-task__zoom-btn:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #86efac;
}

.nmt-task__zoom-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
