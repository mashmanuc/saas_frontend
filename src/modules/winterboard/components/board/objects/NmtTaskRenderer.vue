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
      { 'is-selected': isSelected, 'is-readonly': !interactive, 'is-expanded': isExpanded },
    ]"
    :style="{ '--nmt-presentation-scale': String(presentationScale) }"
    :data-testid="`nmt-task-${asset.id}`"
  >
    <!-- Основний контент: header + body -->
    <div class="nmt-task__inner">

    <!-- Header — pointer-events:none so Konva proxy catches drag -->
    <header class="nmt-task__header">
      <!-- Вигляд за макетом 29.10 (Пола, «Картки завдань»): тип читається з форми — значок і назва,
           бали НМТ праворуч; один колір для всіх типів, без кольорової смуги. -->
      <svg v-if="data.taskType === 'matching'" class="nmt-task__type-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" /><path d="M7 6.5 17 17.5M7 17.5 17 6.5" />
      </svg>
      <svg v-else-if="data.taskType === 'open_answer'" class="nmt-task__type-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="10" rx="2.5" /><path d="M8 10v4" />
      </svg>
      <svg v-else class="nmt-task__type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
      </svg>
      <span class="nmt-task__type-badge">{{ typeBadge }}</span>
      <span v-if="points" class="nmt-task__points" data-testid="nmt-points">{{ pointsLabel }}</span>
      <!-- externalId (артикул задачі) НЕ показуємо користувачу — лишається в data
           для traceability/provenance, але це технічний ідентифікатор, не для очей.
           Delete-кнопка має власний margin-left:auto, тож притискається праворуч. -->
      <button
        v-if="!hostWindowControls && (isTutor !== false && !asset.locked && isSelected)"
        type="button"
        class="nmt-task__delete-btn"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <!-- Body — pointer-events:auto for interactions -->
    <div ref="bodyEl" class="nmt-task__body">
      <!-- Потік вмісту окремим вузлом: його висота природна й НЕ залежить від
           висоти картки. Саме тому автопідгонка вміє не лише рости, а й
           стискатись — див. neededHeightPx(). -->
      <div ref="flowEl" class="nmt-task__flow">

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
          @load="requestAutoFit"
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

      <!-- Короткі варіанти (до п'яти) — плитками в один ряд, як у макеті; довгі — рядками. -->
      <div
        v-if="isChoiceType"
        class="nmt-task__options"
        :class="{ 'nmt-task__options--tiles': optionsAsTiles }"
        :style="optionsAsTiles ? { '--nmt-tiles': String(data.options.length) } : undefined"
      >
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
            @load="requestAutoFit"
          />
        </button>
      </div>

      <!-- ── open_answer ──────────────────────────────────── -->
      <div v-else-if="data.taskType === 'open_answer'" class="nmt-task__input-wrap">
        <!-- Власник 2026-10-18: поле завжди текстове. Банк позначає всі відкриті відповіді
             «number», а серед них дроби «5/3», кома «4,5», корені — числове поле зі стрілками
             їх не пускало. Картка вписане не перевіряє (лише «Показати відповідь»), тож тип
             поля нічого, крім набору, не змінює; `data.inputType` лишається в даних. -->
        <label class="nmt-task__input-row">
          <span class="nmt-task__input-label">{{ t('winterboard.widget.nmtTask.answerLabel') }}</span>
          <input
            class="nmt-task__input"
            type="text"
            autocomplete="off"
            v-model="openAnswerValue"
            :placeholder="t('winterboard.widget.nmtTask.answerPlaceholder')"
            @mousedown.stop
            @pointerdown.stop
          />
        </label>
        <div
          v-if="data.showAnswer && data.correctAnswer"
          class="nmt-task__correct-hint"
        >
          <span class="nmt-task__hint-icon">✓</span>
          <span v-html="renderTextWithLatex(String(data.correctAnswer))" />
        </div>
      </div>

      <!-- ── matching: бланк НМТ (LAW §9 v1.48) ─────────────────
           Дві колонки — пункти «1, 2, 3» і ВСІ варіанти «А–Д» (із зайвими), під ними бланк:
           у кожному рядку учень обирає одну літеру. Вибір локальний, як у single_choice;
           «Показати відповідь» фарбує кожен рядок окремо. -->
      <div v-else-if="data.taskType === 'matching' && matching" class="nmt-task__match" data-testid="nmt-match">
        <div class="nmt-task__match-cols">
          <div class="nmt-task__match-col">
            <div v-for="item in matching.left" :key="item.id" class="nmt-task__match-item">
              <span class="nmt-task__match-label">{{ item.label }}</span>
              <span class="nmt-task__match-text" v-html="renderTextWithLatex(item.text)" />
            </div>
          </div>
          <div class="nmt-task__match-col">
            <div v-for="item in matching.right" :key="item.id" class="nmt-task__match-item">
              <span class="nmt-task__match-label">{{ item.label }}</span>
              <span class="nmt-task__match-text" v-html="renderTextWithLatex(item.text)" />
            </div>
          </div>
        </div>
        <!-- Бланк як у ЗНО: літери варіантів зверху, у рядку — кружечки; літера в кружечку лише для читачів екрана -->
        <div class="nmt-task__match-sheet">
          <div class="nmt-task__match-head" aria-hidden="true">
            <span class="nmt-task__match-row-label" />
            <span v-for="opt in matching.right" :key="opt.id" class="nmt-task__match-head-cell">{{ opt.label }}</span>
          </div>
          <div
            v-for="item in matching.left"
            :key="item.id"
            class="nmt-task__match-row"
            :class="matchRowClass(item.id)"
            :data-testid="`nmt-match-row-${item.label}`"
          >
            <span class="nmt-task__match-row-label">{{ item.label }}</span>
            <button
              v-for="opt in matching.right"
              :key="opt.id"
              type="button"
              class="nmt-task__match-cell"
              :class="matchCellClass(item.id, opt.id)"
              :aria-pressed="matchPicks[item.id] === opt.id"
              :aria-label="`${item.label} — ${opt.label}`"
              @click.stop="pickMatch(item.id, opt.id)"
              @mousedown.stop
              @pointerdown.stop
            ><span class="nmt-task__sr">{{ opt.label }}</span></button>
          </div>
          <div class="nmt-task__match-caption">{{ t('winterboard.widget.nmtTask.sheetCaption') }}</div>
        </div>
      </div>

      <!-- ── matching (старі картки без бланка — як до v1.48) ── -->
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
        <!-- Стан вибору зліва (локальний, як і сам вибір); після «Показати відповідь» у відповідності — бал -->
        <span
          v-if="statusText"
          class="nmt-task__status"
          :class="statusTone"
          :data-testid="statusIsScore ? 'nmt-match-score' : 'nmt-status'"
        >{{ statusText }}</span>
        <button
          v-if="hasAnswerToShow && revealControlsAllowed"
          type="button"
          class="nmt-task__btn nmt-task__btn--primary"
          :class="{ 'is-active': data.showAnswer }"
          @click.stop="toggleShowAnswer"
          @mousedown.stop
          @pointerdown.stop
        >
          {{ primaryLabel }}
        </button>
        <button
          v-if="data.solution && revealControlsAllowed"
          type="button"
          class="nmt-task__btn nmt-task__btn--solution"
          :class="{ 'is-active': data.showSolution }"
          @click.stop="toggleShowSolution"
          @mousedown.stop
          @pointerdown.stop
        >
          {{ data.showSolution ? t('winterboard.widget.nmtTask.hideSolution') : t('winterboard.widget.nmtTask.showSolution') }}
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
          🔗 {{ t('winterboard.widget.nmtTask.build') }}
        </button>
      </div>

      <!-- ── Solution block ────────────────────────────────── -->
      <div v-if="data.showSolution && data.solution" class="nmt-task__solution">
        <div class="nmt-task__solution-title">{{ t('winterboard.widget.nmtTask.solutionTitle') }}</div>
        <div class="nmt-task__solution-row">
        <div
          class="nmt-task__solution-text"
          :style="{ fontSize: (solutionBasePx * presentationScale) + 'px' }"
          v-html="renderTextWithLatex(data.solution)"
        />
        <!-- Масштаб розбору. Розмір особистий (localStorage), у дошку не
             пишеться — див. useSolutionZoom. Кнопки поза текстом, щоб самі
             не збільшувались разом із ним. -->
        <!-- TLV2-05C: у режимі стандарту карток масштаб один — A−/100%/A+ верхньої панелі
             (спільний, SYSTEM_LAW §9.C). Особистий масштаб розбору тут дав би другий. -->
        <div
          v-if="!hostWindowControls"
          class="nmt-task__solution-zoom"
          @pointerdown.stop
          @mousedown.stop
        >
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
      </div>

      </div><!-- /.nmt-task__flow -->
    </div><!-- /.nmt-task__body -->
    </div><!-- /.nmt-task__inner -->
  </div><!-- /.nmt-task -->

    <!-- 8a-3: крок розв'язку. Компонент сам перевіряє прапорець і роль —
         показується лише учню при увімкненому Copilot. -->
    <WBStepInput v-if="interactive && data.externalId" :task-id="String(data.externalId)" />
</template>

<script setup lang="ts">
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_SOLUTION_FONT_PX, useSolutionZoom } from '../../../composables/useSolutionZoom'
import { presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import { resolveMediaUrl } from '@/utils/media'
import type { WBAsset } from '../../../types/winterboard'
import { type NmtTaskData } from '../../../types/nmtTask'
import { useNmtPresentationScale } from '../../../composables/useNmtPresentationScale'
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
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

// TLV2-05B.2 / 05C: режим стандарту карток — ⛶/× і масштаб дає спільна панель полотна.
// Оголошено ДО всього, що від нього залежить (спільна авто-висота читає джерела одразу).
const hostWindowControls = useHostWindowControls()

// Масштаб розбору. Singleton на рівні модуля: збільшив на одній картці —
// більший на всіх (див. useSolutionZoom). У стан дошки НЕ пишеться.
const solutionZoom = useSolutionZoom()

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є', 'Ж', 'З', 'І']

// ⚠️ `withDefaults` тут саме через `canFit`: Vue дає булевому пропу, якого не
// передали, значення false — без явного дефолту картка в чужому хості (тест,
// прев'ю) перестала б мірятись мовчки.
const props = withDefaults(defineProps<{
  asset: WBAsset
  isSelected: boolean
  interactive: boolean
  /** Чи міряти вміст і просити авто-висоту. Окремо від `interactive`: з
   *  олівцем картка не приймає кліків, але підганятись під вміст мусить
   *  (INV-25 п.8, власник 2026-09-24). */
  canFit?: boolean
  /** Лише вчитель керує спільним ключем, розбором і самою карткою. */
  isTutor?: boolean
  /** Картка локально показана на весь доступний простір полотна. */
  isExpanded?: boolean
}>(), { canFit: true })

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
  /**
   * Вмісту треба стільки екранних пікселів висоти. Картка НЕ змінює свою
   * геометрію сама: вона лише повідомляє потребу, а рішення (перевести в
   * координати дошки, обмежити низом полотна, зберегти операцією) ухвалює
   * WBCanvas — єдиний власник геометрії оверлеїв.
   */
  'request-height': [neededPx: number]
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

/* ── matching: бланк НМТ (LAW §9 v1.48) ────────────────────────────────────────
   Обрана літера в кожному рядку — локально (як selectedIds): ні ops, ні Replay.  */
const matching = computed(() => {
  const m = data.value.matching
  return m && Array.isArray(m.left) && m.left.length && Array.isArray(m.right) && m.right.length ? m : null
})

/** left.id → обраний right.id */
const matchPicks = ref<Record<string, string>>({})

function pickMatch(leftId: string, rightId: string) {
  const next = { ...matchPicks.value }
  if (next[leftId] === rightId) delete next[leftId]   // повторний натиск знімає вибір
  else next[leftId] = rightId
  matchPicks.value = next
}

const matchPickedCount = computed(() => Object.keys(matchPicks.value).length)

/** Бал НМТ: по одному за кожну правильну пару. */
const matchCorrectCount = computed(() => {
  const m = matching.value
  if (!m) return 0
  return m.left.filter((l) => matchPicks.value[l.id] !== undefined && matchPicks.value[l.id] === m.answer?.[l.id]).length
})

function matchRowClass(leftId: string) {
  const pick = matchPicks.value[leftId]
  if (!data.value.showAnswer || pick === undefined) return {}
  return pick === matching.value?.answer?.[leftId] ? { 'is-correct': true } : { 'is-wrong': true }
}

function matchCellClass(leftId: string, rightId: string) {
  const picked = matchPicks.value[leftId] === rightId
  const correct = matching.value?.answer?.[leftId] === rightId
  const shown = data.value.showAnswer
  return {
    'is-selected': picked,
    'is-correct': shown && correct,
    'is-wrong': shown && picked && !correct,
  }
}


/**
 * TLV2-05C · масштаб типографіки задачі = спільний учительський (`data.presentationScale`,
 * SYSTEM_LAW §9.C) × локальний множник пульта `view.zoom` — лише поки картка розгорнута
 * (показ, §9.C v1.13). Поза показом A± пульта пишуть спільний масштаб, а множник сюди не
 * потрапляє: інакше автопідгонка (INV-25) записала б висоту від вигляду одного екрана (Б-109).
 * Діє на ВСЮ картку через `--nmt-presentation-scale`, а не лише на розбір.
 */
const remoteScale = useNmtPresentationScale(() => props.asset.id)
const presentationScale = computed(() =>
  presentationScaleOf(props.asset) * (props.isExpanded ? remoteScale.value : 1))

/** Базовий розмір розбору: у режимі стандарту — фіксований (масштабує картка), у V1 — особистий. */
const solutionBasePx = computed(() =>
  hostWindowControls.value ? DEFAULT_SOLUTION_FONT_PX : solutionZoom.fontPx.value)

/* ── Автопідгонка висоти під вміст ────────────────────────────────────────────
   Запит власника 2026-09-09: «збільшую шрифт розбору — з'являється скрол, хоча
   під карткою вільна область». Правильна поведінка: спершу картка росте вниз,
   верхній лівий кут не рухається, і лише коли місця під нею більше немає —
   вмикається внутрішній скрол.

   Картка лише ВИМІРЮЄ і повідомляє потребу. Переведення в координати дошки,
   обмеження низом полотна і збереження — у WBCanvas: там єдине джерело
   геометрії оверлея (`getOverlayStyle`) і там же живе Konva-proxy, який має
   лишитись того самого розміру, що й картка.                                */
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

/*
 * TLV2-05C: вимір і тригери — спільні (`useCardContentFit`, SSOT INV-25), той самий
 * шлях `request-height → nextAutoFitHeight → asset_update`, що й у картки теорії.
 * Розгорнута, згорнута чи неінтерактивна картка операцій не породжує.
 */
const { requestFit: requestAutoFit } = useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  canMeasure: () => !props.isExpanded && props.canFit && !isMinimizedOnBoard(props.asset),
  // Тригери — рівно ті, після яких вміст справді змінює висоту.
  sources: [
    () => data.value.showSolution,
    () => data.value.showAnswer,
    () => solutionBasePx.value,
    () => presentationScale.value,
    () => props.asset.w,
    () => matchPickedCount.value > 0,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

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
    // Б-179 (2026-10-11): підписи картки — мовою інтерфейсу; текст задачі й літери А/Б/В/Г — матеріал НМТ.
    case 'single_choice': return t('winterboard.widget.nmtTask.type.singleChoice')
    case 'multiple_select': return t('winterboard.widget.nmtTask.type.multipleSelect')
    case 'matching':      return t('winterboard.widget.nmtTask.type.matching')
    case 'open_answer':   return t('winterboard.widget.nmtTask.type.openAnswer')
    default:              return t('winterboard.widget.nmtTask.type.task')
  }
})

/** Бали НМТ (макет 29.10): вибір однієї — 1, коротка відповідь — 2, відповідність — по одному за пару. */
const points = computed(() => {
  const d = data.value
  if (d.taskType === 'single_choice') return 1
  if (d.taskType === 'open_answer') return 2
  if (d.taskType === 'matching') return matching.value?.left.length ?? d.pairs?.length ?? 0
  return 0
})
const pointsLabel = computed(() => {
  const n = points.value
  const form = n === 1 ? 'one' : n >= 2 && n <= 4 ? 'few' : 'many'
  return t(`winterboard.widget.nmtTask.points.${form}`, { n })
})

/** Плитки в один ряд — лише для коротких варіантів без картинок (до п'яти). */
const optionsAsTiles = computed(() => {
  const opts = data.value.options ?? []
  if (opts.length < 2 || opts.length > 5 || opts.some((_, i) => optionImage(i))) return false
  // На 200 % у плитку вміщується лише зовсім коротке: «7», «0,125», «√3», «24/25». «(−10; −7]» уже ні — рядками.
  return opts.every((o) => String(o.text ?? '').replace(/\\[a-zA-Z]+|[${}\s]/g, '').length <= 6)
})

/** Рядок стану внизу картки: що обрано; у відповідності після «Показати відповідь» — бал. */
const statusIsScore = computed(() =>
  data.value.taskType === 'matching' && !!matching.value && data.value.showAnswer && matchPickedCount.value > 0)
const statusText = computed(() => {
  if (statusIsScore.value) {
    return t('winterboard.widget.nmtTask.matchScore', { n: matchCorrectCount.value, m: matching.value!.left.length })
  }
  if (data.value.showAnswer) return ''
  if (data.value.taskType === 'matching' && matching.value) {
    return t('winterboard.widget.nmtTask.picked', { n: matchPickedCount.value, m: matching.value.left.length })
  }
  if (data.value.taskType === 'single_choice') {
    const picked = (data.value.options ?? []).find((o) => selectedIds.value.has(o.id))
    return picked ? t('winterboard.widget.nmtTask.pickedOne', { letter: picked.letter }) : t('winterboard.widget.nmtTask.pickOne')
  }
  return ''
})
/** Головна кнопка (власник 29.10: «перейменуй на „Перевірити“»): учень уже щось обрав чи вписав — «Перевірити»,
 *  нічого — «Показати відповідь». Дія та сама — збережений `showAnswer` (LAW §9 v1.48), пульт натискає її так само. */
const somethingPicked = computed(() => selectedIds.value.size > 0 || matchPickedCount.value > 0
  || openAnswerValue.value.trim() !== '')
const primaryLabel = computed(() => data.value.showAnswer
  ? t('winterboard.widget.nmtTask.hideAnswer')
  : t(somethingPicked.value ? 'winterboard.widget.nmtTask.check' : 'winterboard.widget.nmtTask.showAnswer'))

const statusTone = computed(() => statusIsScore.value
  ? (matchCorrectCount.value === matching.value!.left.length ? 'is-ok' : 'is-bad')
  : '')

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
  if (d.taskType === 'matching')      return !!matching.value || (d.pairs?.length ?? 0) > 0
  return false
})

const tutorRevealAllowed = useTutorRevealGate(() => String(data.value.externalId ?? ''))
const revealControlsAllowed = computed(
  () => props.isTutor !== false && tutorRevealAllowed.value,
)

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
/* Вигляд за макетом 29.10 (Пола, «Картки завдань — пропозиція стилю»): один колір для всіх типів, тип — значком
   і формою зони відповіді. Картка — аркуш паперу: світла і в темній темі дошки. */

/* ── Root ────────────────────────────────────────────────────────────── */
.nmt-task {
  --m4-paper: #ffffff;
  --m4-ink: #0f2620;
  --m4-ink-2: #345148;
  --m4-ink-3: #5f7a72;
  --m4-line: rgba(15, 38, 32, 0.10);
  --m4-line-2: rgba(15, 38, 32, 0.18);
  --m4-primary: #0e7a5f;
  --m4-primary-dark: #0a5a46;
  --m4-primary-soft: #d6ece2;
  --m4-primary-tint: #eaf5ef;
  --m4-bad: #c14848;
  --m4-bad-soft: #f6dede;
  --m4-foot: #fafcfb;
  --m4-mono: ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--m4-paper);
  border: 1px solid var(--m4-line);
  border-radius: 14px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(15, 38, 32, 0.05), 0 4px 16px rgba(15, 38, 32, 0.06);
  transition: border-color 0.15s, box-shadow 0.15s;
  /* Єдина вісь показу для пульта A−/A+: усі текстові розміри нижче беруть
     значення з цих змінних. KaTeX рахує формули в em і масштабується разом. */
  --nmt-font-11: calc(11px * var(--nmt-presentation-scale, 1));
  --nmt-font-12: calc(12px * var(--nmt-presentation-scale, 1));
  --nmt-font-13: calc(13px * var(--nmt-presentation-scale, 1));
  --nmt-font-14: calc(14px * var(--nmt-presentation-scale, 1));
  --nmt-font-15: calc(15px * var(--nmt-presentation-scale, 1));
  --nmt-font-16: calc(16px * var(--nmt-presentation-scale, 1));
  /* Кружечок бланка й рядок варіанта — теж від масштабу, щоб на 200 % їх було видно з парти. */
  --nmt-cell: calc(22px * var(--nmt-presentation-scale, 1));
}

.nmt-task.is-selected {
  border-color: var(--m4-primary);
  box-shadow: 0 0 0 2px rgba(14, 122, 95, 0.18), 0 4px 16px rgba(15, 38, 32, 0.06);
}

.nmt-task__inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* ── Header: значок · тип · бали ─────────────────────────────────────── */
.nmt-task__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--m4-paper);
  border-bottom: 1px solid var(--m4-line);
  pointer-events: none;
  user-select: none;
  flex-shrink: 0;
}

.nmt-task__type-icon {
  width: calc(16px * var(--nmt-presentation-scale, 1));
  height: calc(16px * var(--nmt-presentation-scale, 1));
  flex-shrink: 0;
  color: var(--m4-ink);
}

.nmt-task__type-badge {
  font-size: var(--nmt-font-12);
  font-weight: 700;
  color: var(--m4-ink);
}

.nmt-task__points {
  margin-left: auto;
  font: 600 var(--nmt-font-11) var(--m4-mono);
  color: var(--m4-ink-2);
  border: 1px solid var(--m4-line-2);
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
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

.nmt-task__points + .nmt-task__delete-btn { margin-left: 4px; }

.nmt-task__delete-btn:hover {
  background: var(--m4-bad-soft);
  color: var(--m4-bad);
}

/* ── Body ────────────────────────────────────────────────────────────── */
.nmt-task__body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 0;
  overflow-y: auto;
  pointer-events: auto;
}

/* Потік має природну висоту, яку можна виміряти й у бік зменшення (автопідгонка, INV-25). */
.nmt-task__flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nmt-task.is-readonly .nmt-task__body {
  pointer-events: none;
}

/* ── Question ────────────────────────────────────────────────────────── */
.nmt-task__question {
  font-size: var(--nmt-font-15);
  font-weight: 500;
  line-height: 1.6;
  color: var(--m4-ink);
  text-wrap: pretty;
}

/* ── ілюстрації задачі (QUESTION_IMAGE / OPTION_IMAGE) ───────────────── */
.nmt-task__figures {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  padding: 4px 0;
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
  border-radius: 4px;
  background: #fff;
}

.nmt-task__hint {
  margin: 0;
  font-size: var(--nmt-font-12);
  font-weight: 600;
  color: #b45309;
}

/* ── Вибір: рядки (довгі варіанти) ───────────────────────────────────── */
.nmt-task__options {
  display: grid;
  /* На вузькій картці дві min-content колонки виносили відповіді за рамку.
     Один стовпець без обрізання формул; на широкій картці лишаються два. */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 8px;
}

.nmt-task__option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1.5px solid var(--m4-line-2);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font-size: var(--nmt-font-14);
  color: var(--m4-ink);
  transition: border-color 0.12s, background 0.12s;
}

.nmt-task__option:hover { border-color: var(--m4-primary); }

.nmt-task__option.is-selected {
  border-color: var(--m4-primary);
  background: var(--m4-primary-tint);
}

/* Правильний варіант після «Показати відповідь» — суцільно зелений, як у бланку відповідності */
.nmt-task__option.is-correct {
  border-color: var(--m4-primary);
  background: var(--m4-primary);
  color: #fff;
}

.nmt-task__option.is-wrong {
  border-color: var(--m4-bad);
  background: var(--m4-bad-soft);
}

.nmt-task__option-letter {
  flex-shrink: 0;
  font: 700 var(--nmt-font-12) var(--m4-mono);
  color: var(--m4-ink-3);
}

.nmt-task__option.is-selected .nmt-task__option-letter { color: var(--m4-primary-dark); }
.nmt-task__option.is-correct .nmt-task__option-letter { color: #fff; }
.nmt-task__option.is-wrong .nmt-task__option-letter { color: var(--m4-bad); }

.nmt-task__option-text {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

/* ── Вибір: плитки в один ряд (короткі варіанти) ─────────────────────── */
.nmt-task__options--tiles {
  grid-template-columns: repeat(var(--nmt-tiles, 5), minmax(0, 1fr));
}

.nmt-task__options--tiles .nmt-task__option {
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px 10px;
  text-align: center;
  font-size: var(--nmt-font-14);
}

.nmt-task__options--tiles .nmt-task__option-text { flex: none; }

/* ── Коротка відповідь ───────────────────────────────────────────────── */
.nmt-task__input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nmt-task__input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nmt-task__input-label {
  font-size: var(--nmt-font-13);
  font-weight: 700;
  color: var(--m4-ink-2);
  flex-shrink: 0;
}

.nmt-task__input {
  width: calc(150px * var(--nmt-presentation-scale, 1));
  max-width: 100%;
  height: calc(34px * var(--nmt-presentation-scale, 1));
  padding: 0 12px;
  border: 1.5px solid var(--m4-line-2);
  border-radius: 10px;
  font: 600 var(--nmt-font-15) var(--m4-mono);
  background: #fff;
  color: var(--m4-ink);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.nmt-task__input:focus {
  border-color: var(--m4-primary);
  box-shadow: 0 0 0 3px var(--m4-primary-soft);
}

.nmt-task__correct-hint {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: var(--nmt-font-14);
  font-weight: 700;
  color: #fff;
  background: var(--m4-primary);
  border: 1px solid var(--m4-primary);
  border-radius: 10px;
  padding: 5px 12px;
}

.nmt-task__hint-icon {
  font-size: var(--nmt-font-14);
  flex-shrink: 0;
}

/* ── Відповідність: колонки й бланк (LAW §9 v1.48) ───────────────────── */
.nmt-task__match {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nmt-task__match-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 4px 16px;
}

.nmt-task__match-col {
  display: flex;
  flex-direction: column;
}

.nmt-task__match-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-top: 1px solid var(--m4-line);
  font-size: var(--nmt-font-14);
  color: var(--m4-ink);
}

.nmt-task__match-label {
  flex-shrink: 0;
  width: calc(20px * var(--nmt-presentation-scale, 1));
  height: calc(20px * var(--nmt-presentation-scale, 1));
  border-radius: 7px;
  display: grid;
  place-items: center;
  font: 700 var(--nmt-font-12) var(--m4-mono);
  background: var(--m4-primary-tint);
  color: var(--m4-primary-dark);
}

.nmt-task__match-col + .nmt-task__match-col .nmt-task__match-label {
  background: #f3f7f5;
  color: var(--m4-ink-2);
}

.nmt-task__match-text {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.nmt-task__match-sheet {
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px 8px;
  border: 1px solid var(--m4-line);
  border-radius: 12px;
  background: var(--m4-foot);
}

.nmt-task__match-head,
.nmt-task__match-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 999px;
}

.nmt-task__match-row.is-correct { background: var(--m4-primary-tint); }
.nmt-task__match-row.is-wrong { background: var(--m4-bad-soft); }

.nmt-task__match-head-cell {
  width: var(--nmt-cell);
  text-align: center;
  font: 700 var(--nmt-font-12) var(--m4-mono);
  color: var(--m4-ink-3);
}

.nmt-task__match-row-label {
  flex-shrink: 0;
  width: calc(16px * var(--nmt-presentation-scale, 1));
  text-align: center;
  font: 700 var(--nmt-font-12) var(--m4-mono);
  color: var(--m4-primary-dark);
}

.nmt-task__match-cell {
  width: var(--nmt-cell);
  height: var(--nmt-cell);
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid var(--m4-line-2);
  background: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.12s, border-color 0.12s;
}

.nmt-task__match-cell:hover { border-color: var(--m4-primary); }

/* Обрано — зелений кружечок з білою крапкою, як позначка в бланку */
.nmt-task__match-cell.is-selected {
  background: var(--m4-primary);
  border-color: var(--m4-primary);
}
.nmt-task__match-cell.is-selected::after {
  content: '';
  width: 32%;
  height: 32%;
  border-radius: 50%;
  background: #fff;
}

/* «Показати відповідь»: правильна — суцільна зелена заливка (власник 29.10: «щоб повністю зеленим заливало»,
   пунктир майже не було видно); обрана правильна — ще й з білою крапкою; обрана хибна — червона */
.nmt-task__match-cell.is-correct {
  background: var(--m4-primary);
  border-color: var(--m4-primary);
}
.nmt-task__match-cell.is-wrong {
  border-color: var(--m4-bad);
  background: var(--m4-bad);
}

.nmt-task__match-caption {
  margin-top: 2px;
  text-align: center;
  font-size: var(--nmt-font-11);
  color: var(--m4-ink-3);
}

/* Літера в кружечку — лише для читачів екрана (видима літера — у шапці бланка) */
.nmt-task__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── Відповідність (старі картки без бланка) ─────────────────────────── */
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
  border: 1px solid var(--m4-line);
  border-radius: 10px;
  background: #fff;
  font-size: var(--nmt-font-13);
  color: var(--m4-ink);
  transition: background 0.13s, border-color 0.13s;
}

.nmt-task__pair.is-answer-shown {
  background: var(--m4-primary-tint);
  border-color: var(--m4-primary-soft);
}

.nmt-task__pair-letter {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--m4-primary-tint);
  color: var(--m4-primary-dark);
  font: 700 var(--nmt-font-11) var(--m4-mono);
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
  color: var(--m4-line-2);
  font-size: var(--nmt-font-16);
  font-weight: 300;
}

.nmt-task__pair-right {
  flex: 1;
  min-width: 0;
  color: var(--m4-primary-dark);
  font-weight: 500;
}

/* ── Нижній рядок: стан · розбір · головна дія ───────────────────────── */
.nmt-task__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin: 2px -16px 0;
  padding: 10px 16px;
  border-top: 1px solid var(--m4-line);
  background: var(--m4-foot);
}

.nmt-task__status {
  margin-right: auto;
  font-size: var(--nmt-font-12);
  color: var(--m4-ink-3);
}
.nmt-task__status.is-ok { color: var(--m4-primary); font-weight: 700; }
.nmt-task__status.is-bad { color: var(--m4-bad); font-weight: 700; }

.nmt-task__btn {
  padding: 6px 14px;
  border: 1px solid var(--m4-line-2);
  border-radius: 10px;
  background: transparent;
  color: var(--m4-ink-2);
  font-size: var(--nmt-font-12);
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.13s, background 0.13s, color 0.13s;
}

.nmt-task__btn:hover {
  background: var(--m4-primary-tint);
  color: var(--m4-ink);
}

.nmt-task__btn.is-active {
  border-color: var(--m4-primary);
  color: var(--m4-primary-dark);
}

/* Головна дія — одна, зелена */
.nmt-task__btn--primary {
  order: 3;
  background: var(--m4-primary);
  border-color: var(--m4-primary);
  color: #fff;
}
.nmt-task__btn--primary:hover {
  background: var(--m4-primary-dark);
  color: #fff;
}
.nmt-task__btn--primary.is-active {
  background: transparent;
  border-color: var(--m4-primary);
  color: var(--m4-primary-dark);
}

/* «Побудувати» — другорядна, як «Розбір» */
.nmt-task__btn--build {
  font-size: var(--nmt-font-12);
}

/* ── Розбір ──────────────────────────────────────────────────────────── */
.nmt-task__solution {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px dashed var(--m4-line-2);
  font-size: var(--nmt-font-13);
  color: var(--m4-ink-2);
  line-height: 1.55;
}

.nmt-task__solution-title {
  font-size: var(--nmt-font-13);
  font-weight: 800;
  color: var(--m4-ink);
}

.nmt-task__solution-row {
  display: flex;
  gap: 9px;
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
  border: 1px solid var(--m4-line-2);
  border-radius: 5px;
  background: #fff;
  color: var(--m4-ink-2);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.nmt-task__zoom-btn:hover:not(:disabled) {
  background: var(--m4-primary-tint);
  border-color: var(--m4-primary);
}

.nmt-task__zoom-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
