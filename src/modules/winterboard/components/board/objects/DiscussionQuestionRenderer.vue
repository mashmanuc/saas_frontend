<!--
  DiscussionQuestionRenderer — питання до обговорення на сцені уроку (2026-10-06).

  Власник: «так, показувати відповідь після обговорення». Питання бачать усі одразу;
  відповідь — лише коли вчитель її відкрив. Механіка — як «Відповідь» у nmt_task:
  `showAnswer` у даних картки, перемикається звичайним `update:asset` → `asset_update`,
  тож відкриття бачать усі учасники, а в записі уроку відповідь з'являється в ту мить.

  ХТО БАЧИТЬ КНОПКУ (`canReveal`): лише вчитель у живому редагуванні (реєстр оверлеїв).
  Кнопка працює з будь-яким інструментом — як кнопки шкали; у Replay і в учня її немає.
  Стоїть праворуч у рядку питання, щоб висота картки не залежала від того, хто дивиться.
  В експорт PNG/PDF кнопка не потрапляє (`data-export-hide`).

  POINTER-EVENTS (дзеркало theory_card):
    .discussion-question (root)   none → Konva-проксі ловить drag/select/resize
    .discussion-question__body    auto → прокрутка, якщо вміст вищий за картку
    …__body (readonly)            none → з олівцем малювання проходить крізь картку
    .discussion-question__reveal  auto + stop — завжди, коли кнопка є

  Висота — спільний шлях INV-25 (`useCardContentFit`), масштаб — `data.presentationScale`.
-->
<template>
  <div
    ref="rootEl"
    class="discussion-question"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive, 'is-open': data.showAnswer }"
    :style="textScaleStyle"
    :data-testid="`discussion-question-${asset.id}`"
  >
    <div ref="bodyEl" class="discussion-question__body">
      <div ref="flowEl" class="discussion-question__flow">
        <!-- Панель вікна картки («A− A+ — ×», INV-WIN-6) сідає в ПРАВИЙ ВЕРХНІЙ кут — туди,
             де в інших картках порожня смуга шапки. Шапки тут немає, тож місце під панель
             тримає плаваючий відступ першого рядка (у всіх однаковий — висота не залежить
             від того, хто дивиться). Кнопка стоїть одразу за текстом питання, у потоці
             тексту: панель її не накриває (стенд 2026-10-06: накривала, коли стояла в куті). -->
        <p class="discussion-question__question" data-testid="discussion-question-text">
          <span class="discussion-question__controls-space" aria-hidden="true">
            <button
              v-if="!hostWindowControls && canReveal && isSelected && !asset.locked"
              type="button"
              class="discussion-question__delete-btn"
              :title="t('winterboard.widget.delete')"
              data-export-hide
              @click.stop="emit('delete')"
              @mousedown.stop
              @pointerdown.stop
            >×</button>
          </span>
          <span class="discussion-question__mark" aria-hidden="true">❓</span>{{ data.question }}<button
            v-if="canReveal && data.answer"
            type="button"
            class="discussion-question__reveal"
            :class="{ 'is-on': data.showAnswer }"
            :aria-pressed="data.showAnswer"
            data-export-hide
            data-testid="discussion-question-reveal"
            @pointerdown.stop.prevent="onRevealPointerDown"
            @mousedown.stop
            @click.stop="onRevealClick"
          >{{ data.showAnswer ? t('winterboard.discussionQuestion.hide') : t('winterboard.discussionQuestion.show') }}</button>
        </p>
        <div v-if="data.showAnswer && data.answer" class="discussion-question__answer" data-testid="discussion-question-answer">
          <p class="discussion-question__answer-text">
            <span class="discussion-question__answer-label">{{ answerLabel }}:</span> {{ data.answer }}
          </p>
          <p v-if="data.support" class="discussion-question__support" data-testid="discussion-question-support">{{ data.support }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiscussionQuestionData, WBAsset } from '../../../types/winterboard'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { cardTextScaleStyle, presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
    /** Чи міряти вміст і просити авто-висоту (INV-25 п.8: з олівцем — теж). */
    canFit?: boolean
    /** Кнопка «Показати/Сховати відповідь»: лише вчитель у живому редагуванні. */
    canReveal?: boolean
  }>(),
  { isSelected: false, interactive: true, canFit: true, canReveal: false },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  delete: []
  /** TLV2-05C: скільки пікселів висоти треба вмісту (спільна авто-висота). */
  'request-height': [neededPx: number]
}>()

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

const data = computed<DiscussionQuestionData>(() => {
  const raw = (props.asset.data ?? {}) as Partial<DiscussionQuestionData>
  return {
    version: 1,
    question: typeof raw.question === 'string' ? raw.question : '',
    answer: typeof raw.answer === 'string' ? raw.answer : '',
    support: typeof raw.support === 'string' ? raw.support : '',
    content_language: raw.content_language === 'en' ? 'en' : 'uk',
    showAnswer: raw.showAnswer === true,
  }
})

// Підпис — мовою МАТЕРІАЛУ, не інтерфейсу: англомовне питання не підписується
// українською (той самий принцип, що «Джерела» в картці теорії).
const ANSWER_LABELS = { uk: 'Відповідь', en: 'Answer' } as const
const answerLabel = computed(() => ANSWER_LABELS[data.value.content_language ?? 'uk'])

function toggleAnswer(): void {
  if (!props.canReveal) return
  // Розгортаємо СИРІ дані картки, а не нормалізовані: інші ключі (напр. presentationScale)
  // мусять лишитись як були — змінюється тільки showAnswer.
  const current = (props.asset.data ?? {}) as DiscussionQuestionData
  emit('update:asset', { ...props.asset, data: { ...current, showAnswer: !data.value.showAnswer } })
}

// З олівцем полотно забирає вказівник одразу після натискання: `pointerup` і `click`
// до кнопки вже не доходять (стенд 2026-10-06: на кнопці лише pointerdown і mousedown,
// showAnswer не мінявся). Тому мишею й пером перемикаємо на НАТИСКАННІ — воно доходить
// завжди. `click` лишається для клавіатури: Enter/Пробіл дають click без натискання
// (`detail === 0`); клік мишею (`detail ≥ 1`) уже оброблено на натисканні — без подвоєння.
function onRevealPointerDown(e: PointerEvent): void {
  if (e.button > 0) return // права/середня кнопка — не дія
  toggleAnswer()
}
function onRevealClick(e: MouseEvent): void {
  if (e.detail === 0) toggleAnswer()
}

const textScaleStyle = computed(() => cardTextScaleStyle(props.asset))

useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  // Перо, replay, учень і згорнута в трей картка операцій не породжують.
  canMeasure: () => props.canFit && !isMinimizedOnBoard(props.asset),
  sources: [
    () => data.value.question,
    () => data.value.answer,
    () => data.value.support,
    () => data.value.showAnswer,
    () => data.value.content_language,
    () => presentationScaleOf(props.asset),
    () => props.asset.w,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

// Експорт: картка знімається з екрана, як картка теорії (кнопки — `data-export-hide`).
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)

// TLV2-05B.2: у режимі стандарту карток × малює спільна група полотна — власна ховається.
const hostWindowControls = useHostWindowControls()
</script>

<style scoped>
.discussion-question {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  pointer-events: none;            /* Konva-проксі ловить drag/select */
  font-family: inherit;
  --dq-scale: var(--wb-card-text-scale, 1);
}

.discussion-question__body {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  pointer-events: auto;            /* прокрутка, якщо вміст вищий за картку */
}
.discussion-question.is-readonly .discussion-question__body { pointer-events: none; }

.discussion-question__flow {
  padding: calc(4px * var(--dq-scale)) 0;
}

/* Закритий стан — рядок ❓ сцени (колір і вага — як у Салютового рядка: 700, #1d4ed8).
   Розміри — у пікселях екрана, як у картки теорії (§9.C): картка не масштабується
   з полотном, тому 34 одиниці аркуша з текстового рядка тут були б завеликі. */
.discussion-question__question {
  margin: 0;
  font-size: calc(20px * var(--dq-scale));
  font-weight: 700;
  line-height: 1.35;
  color: #1d4ed8;
  overflow-wrap: anywhere;
}
/* Місце під панель вікна картки в правому верхньому куті (INV-WIN-6): плаваюча ділянка
   лише першого рядка. Панель — інтерфейс полотна, її ширина від масштабу тексту не залежить. */
.discussion-question__controls-space {
  float: right;
  width: 150px;
  height: 1.35em;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.discussion-question__mark {
  margin-right: calc(8px * var(--dq-scale));
}

.discussion-question__reveal {
  display: inline-block;
  vertical-align: middle;
  pointer-events: auto;            /* і з олівцем: кнопка має працювати завжди, коли вона є */
  margin: 0 0 0 calc(12px * var(--dq-scale));
  padding: calc(4px * var(--dq-scale)) calc(10px * var(--dq-scale));
  font-size: calc(13px * var(--dq-scale));
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1.5px solid #93c5fd;
  border-radius: calc(8px * var(--dq-scale));
  cursor: pointer;
}
.discussion-question__reveal:hover { background: #dbeafe; }
.discussion-question__reveal.is-on {
  color: #1e3a8a;
  background: #dbeafe;
  border-color: #60a5fa;
}

.discussion-question__delete-btn {
  pointer-events: auto;
  width: calc(22px * var(--dq-scale));
  height: calc(22px * var(--dq-scale));
  font-size: calc(15px * var(--dq-scale));
  line-height: 1;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
}

.discussion-question__answer {
  margin-top: calc(6px * var(--dq-scale));
  padding: calc(6px * var(--dq-scale)) calc(12px * var(--dq-scale));
  background: #f8fafc;
  border-left: calc(4px * var(--dq-scale)) solid #60a5fa;
  border-radius: calc(8px * var(--dq-scale));
}
.discussion-question__answer-text {
  margin: 0;
  font-size: calc(15px * var(--dq-scale));
  line-height: 1.45;
  color: #0f172a;
  overflow-wrap: anywhere;
}
.discussion-question__answer-label {
  font-weight: 700;
}
.discussion-question__support {
  margin: calc(4px * var(--dq-scale)) 0 0;
  font-size: calc(12.5px * var(--dq-scale));
  font-style: italic;
  line-height: 1.4;
  color: #475569;
  overflow-wrap: anywhere;
}
</style>
