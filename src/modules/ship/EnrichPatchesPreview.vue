<template>
  <div class="enrich-patches-preview" v-if="visible">
    <div class="enrich-patches-preview__header">
      <h3>{{ t('winterboard.enrich.title') }}</h3>
      <button class="enrich-patches-preview__close" @click="$emit('close')">&times;</button>
    </div>

    <!-- Instruction input.
         Ховаємо ЛИШЕ поки є незастосований список патчів або триває запит.
         Раніше умова була `!patches.length && !error`: після першого
         прогону форма зникала назавжди — тьютор не міг ні попросити щось
         інше («спершу приклади, потім формули»), ні повторити спробу
         після помилки (живий прогін 2026-08-09). -->
    <div class="enrich-patches-preview__input" v-if="!patches.length && !loading">
      <label>{{ t('winterboard.enrich.instructionLabel') }}</label>

      <!-- Чіпи-приклади: клік підставляє готову інструкцію в поле (далі можна
           дописати). Тьютор бачить, ЩО вміє enrich, не читаючи плейсхолдер. -->
      <div class="enrich-patches-preview__chips" role="list">
        <button
          v-for="chip in exampleChips"
          :key="chip.key"
          type="button"
          class="enrich-patches-preview__chip"
          role="listitem"
          @click="applyChip(chip.text)"
        >{{ chip.text }}</button>
      </div>

      <!-- Композер — як стрічка вводу чату: поле авто-росте, дії знизу в ряд.
           Кнопка блокується ЛИШЕ під час запиту, не за станом v-model.
           Живий прогін 2026-08-10: текст у полі є, а «Запустити» сіра —
           бо голосове введення (AudioScribe) і подібні розширення пишуть
           у DOM напряму, БЕЗ події `input`, тож v-model лишався порожнім.
           Значення беремо з елемента при кліку — працює для друку,
           диктування, вставки, чіпів і автозаповнення однаково. -->
      <div class="enrich-patches-preview__composer" :class="{ 'enrich-patches-preview__composer--listening': micListening }">
        <textarea
          ref="instructionEl"
          v-model="instruction"
          class="enrich-patches-preview__composer-input"
          :placeholder="t('winterboard.enrich.instructionPlaceholder')"
          rows="2"
          @keydown.enter.exact.prevent="runEnrich()"
        />
        <div class="enrich-patches-preview__composer-bar">
          <span class="enrich-patches-preview__composer-hint">
            {{ micListening ? t('winterboard.enrich.listening') : t('winterboard.enrich.enterHint') }}
          </span>
          <div class="enrich-patches-preview__composer-actions">
            <button
              v-if="micSupported"
              type="button"
              class="enrich-patches-preview__mic"
              :class="{ 'enrich-patches-preview__mic--on': micListening }"
              :title="micListening ? t('winterboard.enrich.dictateStop') : t('winterboard.enrich.dictateStart')"
              :aria-pressed="micListening"
              @click="toggleDictation"
            >🎤</button>
            <button
              type="button"
              class="enrich-patches-preview__run"
              :disabled="loading"
              @click="runEnrich()"
            >
              <span>{{ loading ? t('winterboard.enrich.running') : t('winterboard.enrich.run') }}</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading. Enrich — один синхронний POST (10–30 с); BE після кожного пакета
         пише {processed,total} під progress_id, ми поллимо GET → справжня смуга
         «5 з 12». Поки перший пакет не завершився (або поллінг не долітає) —
         індетермінантна смуга + секундомір + етап словами, щоб не виглядало
         зависанням. Відсоток ніколи не вигадуємо: є total — детермінована, нема — рух. -->
    <div class="enrich-patches-preview__loading" v-if="loading" role="status" aria-live="polite">
      <div class="enrich-patches-preview__loading-row">
        <span class="enrich-patches-preview__spinner" aria-hidden="true" />
        <span class="enrich-patches-preview__loading-stage">{{ loadingStage }}</span>
        <span v-if="progressPercent !== null" class="enrich-patches-preview__loading-pct">{{ progressPercent }}%</span>
        <span class="enrich-patches-preview__loading-time">{{ elapsedSec }} с</span>
      </div>
      <div
        class="enrich-patches-preview__bar"
        :class="{ 'enrich-patches-preview__bar--determinate': progressPercent !== null }"
        role="progressbar"
        :aria-valuenow="progressPercent ?? undefined"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span
          class="enrich-patches-preview__bar-fill"
          :style="progressPercent !== null ? { width: progressPercent + '%' } : undefined"
        />
      </div>
    </div>

    <!-- Оброблено: X/Y задач (N1 Фаза 4.1) — видно і при успіху, і при
         частковому збої: тьютор завжди знає, скільки задач урок мав
         і скільки реально пройшло LLM, а не здогадується з тиші. -->
    <div class="enrich-patches-preview__progress" v-if="totalTasks > 0 && !loading">
      {{ t('winterboard.enrich.processed', { done: processedTasks, total: totalTasks }) }}
      <!-- B-T2: пропуск — не «нічого не сталось», а результат роботи моделі.
           Тому він стоїть у тому самому рядку, що й «оброблено»: тьютор
           читає підсумок цілком, а не здогадується, куди поділась задача. -->
      <span class="enrich-patches-preview__tally" v-if="patches.length || skipped.length">
        {{ t('winterboard.enrich.tally', { proposed: patches.length, skipped: skipped.length }) }}
      </span>
    </div>

    <!-- Error. При частковому збої пакета BE віддає failed_task_refs — даємо
         кнопку дозбору саме цих задач, а не «спробуйте ще раз увесь урок». -->
    <div class="enrich-patches-preview__error" v-if="error">
      <span>{{ error }}</span>
      <button
        v-if="failedTaskRefs.length && !loading"
        type="button"
        class="enrich-patches-preview__retry"
        @click="retryFailed"
      >
        ↻ {{ t('winterboard.enrich.retryFailed', { n: failedTaskRefs.length }) }}
      </button>
    </div>

    <!-- Patches list.
         2026-08-13 (живий гейт B-T1): на ДРУГОМУ прогоні 12 пропозицій із 13
         виявились тим, що вже лежить в уроці, — і всі 12 висіли в загальному
         списку з попередженням. Тьютор отримував стіну ♻️ замість роботи.
         Тому повтори йдуть В КІНЕЦЬ і згорнуті, як пропуски: вони не зникли
         (галочку можна поставити), просто не заступають свіже.
         Один `v-for` навмисно: розкладка картки складна, і дві копії
         розмітки розійшлися б при першій же правці. -->
    <div class="enrich-patches-preview__list" v-if="patches.length">
      <template v-for="row in orderedPatches" :key="row.i">
      <button
        v-if="row.firstRepeat"
        type="button"
        class="enrich-patches-preview__skipped-toggle"
        :aria-expanded="repeatsOpen"
        @click="repeatsOpen = !repeatsOpen"
      >
        {{ repeatsOpen ? '▾' : '▸' }}
        ♻️ {{ t('winterboard.enrich.repeatsTitle', { count: repeatCount }) }}
      </button>
      <div
        v-show="!row.repeat || repeatsOpen"
        class="enrich-patches-preview__item"
        :class="{ 'enrich-patches-preview__item--invalid': !row.patch.latex_valid }"
      >
        <label class="enrich-patches-preview__checkbox">
          <input type="checkbox" v-model="selected[row.i]" :disabled="!row.patch.latex_valid" />
          <span class="enrich-patches-preview__badge">{{ row.patch.action === 'add_formula' ? t('winterboard.enrich.badgeFormula') : t('winterboard.enrich.badgeCard') }}</span>
          <!-- 2026-08-12: тут стояло «Задача: 10719» — ID банку, який тьютору
               нічого не каже. Показуємо початок УМОВИ: свою задачу він
               упізнає за текстом. Поля може не бути (старий BE) — тоді
               мовчимо, бо ID гірший за порожнечу. -->
          <span v-if="row.patch.task_title" class="enrich-patches-preview__task"
                v-html="renderTextWithLatex(row.patch.task_title)" />
        </label>
        <!-- Формули рендеряться так само, як потім на дошці (той самий
             renderTextWithLatex, що в TheoryCardRenderer). Інакше тьютор
             бачив у прев'ю сирий `$\frac{k}{x+b}$` і оцінював картку по
             гіршому вигляду, ніж вона матиме після застосування
             (живий прогін 2026-08-10).
             v-html безпечний саме тут: renderTextWithLatex сам екранує
             HTML (`&`, `<`, `>`) перед вставкою LaTeX — сирий v-html із
             відповіддю LLM використовувати НЕ можна. -->
        <div class="enrich-patches-preview__preview">
          <strong v-html="rendered[row.i].title" />
          <p v-html="rendered[row.i].body" />
          <span class="enrich-patches-preview__badge-label">{{ row.patch.card_data?.badge || '' }}</span>
        </div>
        <div class="enrich-patches-preview__latex-warn" v-if="!row.patch.latex_valid">
          ⚠️ {{ t('winterboard.enrich.latexInvalid', { error: row.patch.latex_error }) }}
        </div>
        <!-- A-T1: картка-переказ умови — галочка знята, тьютор бачить чому
             (вибрати все одно можна: фільтр страхує, не забороняє). -->
        <div class="enrich-patches-preview__latex-warn" v-if="row.patch.low_value">
          💤 {{ t('winterboard.enrich.lowValue') }}
        </div>
        <!-- 2026-08-12: ця картка вже лежить в уроці з минулого запуску.
             Промпт просить модель не повторюватись — вона не слухається,
             тож показуємо факт і знімаємо галочку. Не забороняємо: інколи
             ту саму опору справді хочуть поставити ще раз. -->
        <div class="enrich-patches-preview__latex-warn" v-if="row.patch.already_on_board">
          ♻️ {{ t('winterboard.enrich.alreadyOnBoard') }}
        </div>
        <!-- B-T1: та сама картка вже є в іншої задачі. Позначка, не
             заборона: інколи опора справді потрібна обом. -->
        <!-- 2026-08-12: тут теж стояв ID банку («задачі 10719»). Показуємо
             умову тієї задачі — так само, як у підписі картки. -->
        <div class="enrich-patches-preview__latex-warn" v-if="row.patch.duplicate_of">
          🔁 {{ t('winterboard.enrich.duplicateOf', { ref: taskLabel(row.patch.duplicate_of) }) }}
        </div>
      </div>
      </template>
    </div>

    <!-- B-T2: свідомі пропуски. Згорнуто за замовчуванням — це довідка,
         а не робота: розгортає той, кому цікаво ЧОМУ модель промовчала.
         Блок стоїть усередині скрольованої області діалогу, тож модалку
         не розсуває (max-height 80vh + overflow вже є у WBExportDialog). -->
    <div class="enrich-patches-preview__skipped" v-if="skipped.length && !loading">
      <button
        type="button"
        class="enrich-patches-preview__skipped-toggle"
        :aria-expanded="skippedOpen"
        @click="skippedOpen = !skippedOpen"
      >
        {{ skippedOpen ? '▾' : '▸' }}
        {{ t('winterboard.enrich.skippedTitle', { count: skipped.length }) }}
      </button>
      <ul class="enrich-patches-preview__skipped-list" v-if="skippedOpen">
        <li v-for="(skip, i) in skipped" :key="i">
          <span v-if="skip.task_title" class="enrich-patches-preview__task"
                v-html="renderTextWithLatex(skip.task_title)" />
          <span class="enrich-patches-preview__skipped-reason">{{ skip.reason }}</span>
        </li>
      </ul>
    </div>

    <!-- Apply button -->
    <div class="enrich-patches-preview__actions" v-if="patches.length">
      <button
        :disabled="!hasSelected || applying"
        @click="applySelected"
      >
        {{ applying ? t('winterboard.enrich.applying') : t('winterboard.enrich.applySelected', { count: selectedCount }) }}
      </button>
    </div>

    <!-- Result -->
    <div class="enrich-patches-preview__result" v-if="result">
      {{ t('winterboard.enrich.sectionsAdded', { count: result.sections_added }) }}
      <!-- Куди саме лягли: без цього тьютор дивиться на поточну сторінку,
           не бачить змін і думає, що нічого не сталось. -->
      <span v-if="pagesLabel">{{ t('winterboard.enrich.onPages', { pages: pagesLabel }) }}</span>
      {{ result.error || '' }}
    </div>

    <!-- Записано, але ця вкладка не показала — чесно просимо перезавантажити -->
    <div class="enrich-patches-preview__error" v-if="staleView">
      {{ t('winterboard.enrich.reloadToSee') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { shipApi, type EnrichApplyResponse, type EnrichProgress, type EnrichSkip } from './shipApi'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import { useOpsSyncStore } from '@/modules/winterboard/stores/opsSyncStore'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useVoiceDictation } from '@/composables/useVoiceDictation'

const { t, locale } = useI18n()
// Enrich пише на дошку СЕРВЕРНИМ шляхом (ops → OpsApplyService), тобто повз
// цю вкладку: її localSeq відстає, а полотно не знає про нові картки —
// тьютор бачив порожню дошку і думав, що нічого не сталось (живий прогін
// 2026-08-08, довелось тиснути F5). INV-24 catchUp — штатний read-side
// resync рівно для цього: звіряє seq із сервером і гідратує стан.
const opsSync = useOpsSyncStore()
const boardStore = useWBStore()

const props = defineProps<{
  artifactId: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  applied: []
}>()

const instruction = ref('')
/** Пряме посилання на поле — читаємо значення з DOM при запуску
 *  (v-model не бачить вводу від розширень; живий прогін 2026-08-10). */
const instructionEl = ref<HTMLTextAreaElement | null>(null)
// Голосовий ввід інструкції — той самий спільний композабл, що й голос
// Інтегралика (Web Speech, локально в браузері; нічого не летить у сервіси).
// На Firefox supported=false → кнопка мікрофона просто не показується.
const { supported: micSupported, listening: micListening, toggle: micToggle } =
  useVoiceDictation({ lang: locale.value === 'en' ? 'en-US' : 'uk-UA' })
function toggleDictation() { micToggle(instruction) }
// Чіпи-жанри. Enrich кумулятивний: кожен чіп — окремий педагогічний шар,
// їх можна докладати один за одним (правило власника 2026-08-16).
//
// Список стоїть НА ВИМІРІ, не на смаку: `tools/phrase_probe/exp_chip_genre.py`
// прогнав 62 фрази × 3 зразки на прод-моделі й показав, які формулювання
// класифікатор упізнає СТАБІЛЬНО (3/3). Взято переможців:
//   Помилка 10/10 · Формула 11/13 · Метод 8/10 · Підказка 5/7 ·
//   Приклад із життя 6/10 · Теорія 3/8
// Порядок — за надійністю: те, що працює найкраще, ближче до ока.
//
// ⚠️ Сьомий жанр GENRES — «Приклад» — свідомо НЕ показуємо (рішення
// власника 2026-08-16): вимір дав 0/4, усі фрази стабільно падають у
// «Метод», і це не збій моделі — «розібраний приклад розв'язання» і Є
// метод. У беку жанр лишається (він може стояти в badge наявних карток),
// але пропонувати тьютору те, що система не розрізняє, не можна.
//
// ⚠️ Фрази не міняти «щоб гарніше»: сусідні формулювання того самого жанру
// провалились («Зв'яжи із транспортом» → Метод, «Додай математичну
// довідку» → Формула). Нова фраза = новий прогін стенда.
const exampleChips = computed(() => ([
  { key: 'mistake',  text: t('winterboard.enrich.chips.commonMistake') },
  { key: 'formulas', text: t('winterboard.enrich.chips.formulas') },
  { key: 'method',   text: t('winterboard.enrich.chips.method') },
  { key: 'hint',     text: t('winterboard.enrich.chips.hint') },
  { key: 'life',     text: t('winterboard.enrich.chips.lifeExample') },
  { key: 'theory',   text: t('winterboard.enrich.chips.theory') },
]))
function applyChip(text: string) {
  instruction.value = text
  instructionEl.value?.focus()
}
const patches = ref<any[]>([])
const selected = ref<Record<number, boolean>>({})
const loading = ref(false)
// Секундомір очікування + етап словами. Справжнього серверного прогресу під
// час одного синхронного виклику немає — це чесна альтернатива «мертвому»
// тексту: тьютор бачить, що процес живий і скільки триває.
const elapsedSec = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
function stopElapsed() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
}
watch(loading, (on) => {
  stopElapsed()
  elapsedSec.value = 0
  if (on) elapsedTimer = setInterval(() => { elapsedSec.value += 1 }, 1000)
})
onBeforeUnmount(stopElapsed)

// Справжній прогрес по пакетах: BE пише {processed,total} у cache після кожного
// пакета під progress_id, ми поллимо GET раз на 1.5 с, поки триває POST.
// liveProgress=null (або known=false) → ще нічого не відомо → індетермінантна
// смуга; коли є total → відсоткова смуга «processed з total».
const liveProgress = ref<EnrichProgress | null>(null)
let progressTimer: ReturnType<typeof setInterval> | null = null
function newProgressId(): string {
  const c: any = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  // Fallback для дуже старих WebView: uuid-подібний рядок з тим самим алфавітом.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
function stopProgressPolling() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
}
function startProgressPolling(progressId: string) {
  stopProgressPolling()
  const tick = async () => {
    const p = await shipApi.enrichProgress(props.artifactId, progressId)
    if (p && p.known) liveProgress.value = p
  }
  progressTimer = setInterval(tick, 1500)
  // Перший запит — одразу через пів секунди: 0/N з'являється, щойно BE дійшов до пакетів.
  setTimeout(tick, 500)
}
onBeforeUnmount(stopProgressPolling)

const progressPercent = computed(() => {
  const p = liveProgress.value
  if (!p || !p.total) return null
  return Math.min(100, Math.round((p.processed / p.total) * 100))
})

const loadingStage = computed(() => {
  const p = liveProgress.value
  if (p && p.total) {
    return t('winterboard.enrich.stageBatches', { done: p.processed, total: p.total })
  }
  const s = elapsedSec.value
  if (s < 3)  return t('winterboard.enrich.stageReading')
  if (s < 20) return t('winterboard.enrich.stageThinking')
  return t('winterboard.enrich.stageLong')
})
const applying = ref(false)
const error = ref('')
const result = ref<EnrichApplyResponse | null>(null)
// N1 Фаза 4.1 (2026-08-07): скільки задач уроку реально пройшло LLM —
// раніше урок обрізався на 12 задач мовчки, тепер run_enrich() йде
// пакетами по всіх і чесно каже, скільки встигло.
const processedTasks = ref(0)
const totalTasks = ref(0)
// Рефи задач із пакетів, що впали (BE віддає їх саме для кнопки «Повторити
// необроблені»: run_enrich(task_ids=failed_task_refs) чіпає лише їх).
const failedTaskRefs = ref<string[]>([])
function retryFailed() {
  if (failedTaskRefs.value.length && !loading.value) runEnrich(failedTaskRefs.value)
}
// B-T2: задачі, над якими модель ДУМАЛА і свідомо вирішила мовчати.
// Для методиста це сигнал не менш цінний за картку: видно, що урок
// пройдено цілком, а не обірвано.
const skipped = ref<EnrichSkip[]>([])
const skippedOpen = ref(false)
// Картки записані, але ця вкладка їх не показала (resync не пройшов) —
// краще сказати «перезавантажте», ніж лишити тьютора з порожньою дошкою
// і думкою, що фіча не спрацювала.
const staleView = ref(false)

const hasSelected = computed(() => Object.values(selected.value).some(v => v))
const selectedCount = computed(() => Object.values(selected.value).filter(v => v).length)

/**
 * Заголовок і тіло кожного патча, відрендерені з $LaTeX$ — рівно тим
 * рендерером, що потім намалює картку на дошці.
 *
 * Обчислюємо computed'ом, а не викликом просто в шаблоні: KaTeX не
 * безкоштовний, а список — до 24 полів (12 патчів × 2), і виклик у
 * шаблоні ганяв би їх на КОЖЕН ререндер (клік по галочці, зміна
 * скролу). Тут — один прохід на зміну `patches`.
 */
/**
 * Тіло картки → HTML. Формульні картки потребують окремого поводження.
 *
 * 2026-08-12 (живий тест власника): у прев'ю висіло `\log_a b + \log_a c =
 * \log_a (bc)` сирим текстом. Здавалося, що рендер відкотили — ні, він на
 * місці. Причина в КОНТРАКТІ: для `add_formula` промпт вимагає «body = ЛИШЕ
 * формула, чистий LaTeX БЕЗ $», а `renderTextWithLatex` рендерить лише те,
 * що між доларами. Голий LaTeX проходив як звичайний текст — ще й із
 * обрізаними слешами.
 *
 * Дошка це робила правильно весь час (`FormulaCardRenderer.vue:80` обгортає
 * у `$$…$$`), тобто прев'ю знову показувало ГІРШЕ, ніж буде після
 * застосування — рівно та вада, яку лагодили 2026-08-10 для `add_card`.
 * Тоді `add_formula` не покрили, і поки жанр майже не слухався, формульних
 * карток було мало. Ф-1 навчив модель давати «Формула» — і дефект вилетів
 * на кожній картці.
 *
 * Обгортаємо ЛИШЕ коли доларів немає: якщо модель усе-таки їх поставила,
 * зовнішні `$$` зламали б вираз.
 */
function renderBody(patch: any): string {
  const body = String(patch?.card_data?.body ?? '')
  if (!body.trim()) return ''
  const bare = patch?.action === 'add_formula' && !body.includes('$')
  return renderTextWithLatex(bare ? `$$${body}$$` : body)
}

/**
 * task_ref → упізнаваний підпис задачі. Потрібен для повідомлення про
 * дубль: воно посилається на ІНШУ задачу, і показувати там ID банку —
 * та сама вада, що й у підписі картки.
 * Немає підпису (старий BE) → лишаємо ref: краще щось, ніж порожнеча
 * у реченні «вже запропонована задачі ___».
 */
function taskLabel(ref: string): string {
  const found = patches.value.find((p: any) => String(p?.task_ref) === String(ref))
  const title = found?.task_title || skipped.value.find(
    (s: any) => String(s?.task_ref) === String(ref))?.task_title
  return title ? `«${String(title).replace(/\$/g, '')}»` : String(ref)
}

const rendered = computed(() =>
  patches.value.map((p: any) => ({
    title: renderTextWithLatex(p?.card_data?.title || ''),
    body: renderBody(p),
  })),
)

/**
 * Порядок показу: спершу свіже, повтори — в кінець і згорнуті.
 *
 * Живий гейт B-T1 (2026-08-13): другий прогін дав 13 пропозицій, з них 12
 * уже лежали в уроці. Позначка ♻️ на кожній була ЧЕСНОЮ, але тьютор бачив
 * стіну попереджень і мусив вишукувати в ній єдину нову картку. Позначка
 * має допомагати обрати, а не ховати роботу.
 *
 * `i` — ОРИГІНАЛЬНИЙ індекс патча: `selected` і `rendered` індексуються за
 * ним, і застосування бере `patches.filter((_, i) => selected[i])`.
 * Переставляти самі `patches` було б простіше в шаблоні й неправильно по
 * суті — зсунулись би всі галочки.
 *
 * Повтор = `already_on_board` (те, що вже в уроці). `duplicate_of` НЕ
 * згортаємо: це збіг між задачами всередині ЦЬОГО прогону, тьютор мусить
 * побачити обидві картки поруч, щоб вирішити, котру лишити.
 */
const repeatsOpen = ref(false)

const orderedPatches = computed(() => {
  const rows = patches.value.map((patch: any, i: number) => ({
    i, patch, repeat: !!patch?.already_on_board, firstRepeat: false,
  }))
  const fresh = rows.filter(r => !r.repeat)
  const repeats = rows.filter(r => r.repeat)
  if (repeats.length) repeats[0].firstRepeat = true
  return [...fresh, ...repeats]
})

const repeatCount = computed(() => orderedPatches.value.filter(r => r.repeat).length)

/** «3–9» для суцільного діапазону, «3, 5, 9» для розрізненого. */
const pagesLabel = computed(() => {
  const pages = result.value?.page_numbers ?? []
  if (!pages.length) return ''
  if (pages.length === 1) return String(pages[0])
  const isContiguous = pages[pages.length - 1] - pages[0] === pages.length - 1
  return isContiguous ? `${pages[0]}–${pages[pages.length - 1]}` : pages.join(', ')
})

/** Галочка за замовчуванням: low_value (переказ умови), дубль, повтор і битий
 *  LaTeX — зняті, але вибрати можна: фільтр страхує, рішення за тьютором. */
function defaultSelected(p: any): boolean {
  return p.latex_valid !== false && p.low_value !== true
    && p.already_on_board !== true
    && !p.duplicate_of
}

/**
 * Запуск enrich. Без аргументу — повний прогін по уроку (стан скидається).
 * `onlyTaskRefs` — ДОЗБІР лише названих задач (кнопка «Повторити необроблені»
 * після часткового збою пакета): наявні патчі/пропуски лишаються, нові
 * докидаються, галочки перераховуються лише для доданих. BE приймає ті самі
 * рефи, що віддав у `failed_task_refs` (str(section.ref)).
 */
async function runEnrich(onlyTaskRefs?: string[]) {
  // Лише справжній масив рефів = дозбір. Захист від `@click="runEnrich"` без
  // дужок — тоді сюди прилетів би Event, і він НЕ має вмикати retry.
  const retry = Array.isArray(onlyTaskRefs) && onlyTaskRefs.length > 0
  // Джерело правди — сам елемент, не v-model: голосове введення й
  // розширення пишуть у DOM без події `input` (див. коментар у шаблоні).
  // Синхронізуємо назад, щоб решта компонента бачила те саме значення.
  // При дозборі поля вже нема на екрані — беремо збережену інструкцію.
  const typed = (retry ? instruction.value : (instructionEl.value?.value ?? instruction.value)).trim()
  if (!typed) {
    error.value = t('winterboard.enrich.instructionRequired')
    return
  }
  instruction.value = typed
  loading.value = true
  error.value = ''
  if (!retry) {
    patches.value = []
    selected.value = {}
    skipped.value = []
    skippedOpen.value = false
    repeatsOpen.value = false
    result.value = null
    failedTaskRefs.value = []
  }
  // Справжній прогрес: BE після кожного пакета пише {processed,total} під цим
  // id, ми поллимо GET, поки триває POST. Збій поллінгу нічого не ламає —
  // просто лишається індетермінантна смуга.
  const progressId = newProgressId()
  liveProgress.value = null
  startProgressPolling(progressId)
  try {
    const res = await shipApi.enrich(props.artifactId, instruction.value,
                                     retry ? onlyTaskRefs : undefined, progressId)
    if (retry) {
      // Дозбір: total не міняється, processed росте на те, що вдалось тепер.
      processedTasks.value += res.processed_tasks ?? 0
    } else {
      processedTasks.value = res.processed_tasks ?? 0
      totalTasks.value = res.total_tasks ?? 0
    }
    // ⚠️ error і patches НЕ взаємовиключні: частковий збій пакета лишає
    // error (напр. «Оброблено 12/24») І успішні патчі з пакетів, що
    // спрацювали — раніше цей else-гілка мовчки викидала вже готові
    // патчі, щойно з'являлась будь-яка помилка.
    if (res.error) error.value = res.error
    failedTaskRefs.value = res.failed_task_refs || []
    const incoming: any[] = res.patches || []
    if (retry) {
      const base = patches.value.length
      patches.value = [...patches.value, ...incoming]
      skipped.value = [...skipped.value, ...(res.skipped || [])]
      const sel: Record<number, boolean> = { ...selected.value }
      incoming.forEach((p: any, i: number) => { sel[base + i] = defaultSelected(p) })
      selected.value = sel
      return   // finally нижче зупинить поллінг і зніме loading
    }
    patches.value = incoming
    skipped.value = res.skipped || []
    const sel: Record<number, boolean> = {}
    patches.value.forEach((p: any, i: number) => { sel[i] = defaultSelected(p) })
    selected.value = sel
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    stopProgressPolling()
    loading.value = false
  }
}

async function applySelected() {
  applying.value = true
  result.value = null
  try {
    const selectedPatches = patches.value.filter((_: any, i: number) => selected.value[i])
    const res = await shipApi.enrichApply(props.artifactId, selectedPatches)
    result.value = res
    if (res.sections_added > 0) await syncBoard()
    // Застосовані патчі більше не потрібні — звільняємо форму під наступну
    // інструкцію («приклади» → «тепер формули»), не змушуючи закривати
    // й відкривати діалог. `result` лишається на екрані як підсумок.
    patches.value = []
    selected.value = {}
    skipped.value = []
    instruction.value = ''
    emit('applied')
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    applying.value = false
  }
}

/**
 * Підтягнути картки, записані сервером, у цю вкладку (INV-24 WS-CATCHUP).
 *
 * Без retry: подієва модель (LAW §12) — не вдалось, кажемо тьютору
 * перезавантажити сторінку, а не крутимо цикл. Провал синхронізації НЕ
 * скасовує успіху apply: картки вже на дошці, питання лише у тому, коли
 * їх побачить ця вкладка.
 */
async function syncBoard() {
  try {
    const r = await opsSync.catchUp((state: Record<string, unknown>) =>
      boardStore.applyCatchUpState(state))
    console.info(`[ship:enrich] catch-up status=${r.status} last_seq=${r.lastSeq}`)
    // 'applied' — картки вже на полотні. Решта статусів ('blocked' при
    // DESYNC/PAUSED, 'stale' при недоступному стані, 'flush-failed') means
    // канвас свідомо не чіпали — тоді чесно просимо перезавантажити.
    if (r.status !== 'applied' && r.status !== 'current') {
      staleView.value = true
    }
  } catch (e) {
    console.warn('[ship:enrich] catch-up failed:', e)
    staleView.value = true
  }
}
</script>

<style scoped>
.enrich-patches-preview {
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 16px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  max-height: 80vh;
  overflow-y: auto;
}
.enrich-patches-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.enrich-patches-preview__close {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 20px;
  cursor: pointer;
}
.enrich-patches-preview__input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
/* ── Чіпи-приклади: пігулки над композером, як підказки в чаті ───────────── */
.enrich-patches-preview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.enrich-patches-preview__chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.1s;
}
.enrich-patches-preview__chip:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
}
.enrich-patches-preview__chip:active {
  transform: scale(0.97);
}

/* ── Композер: округлий контейнер, поле авто-росте, дії знизу в ряд ─────── */
.enrich-patches-preview__composer {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  background: var(--color-bg-secondary);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.enrich-patches-preview__composer:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.enrich-patches-preview__composer--listening {
  border-color: var(--color-primary);
}
.enrich-patches-preview__composer-input {
  width: 100%;
  min-height: 56px;
  max-height: 200px;
  padding: 12px 14px 6px;
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  outline: none;
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
  resize: none;
  field-sizing: content; /* авто-ріст за вмістом (Chrome/Edge); інакше — скрол */
}
.enrich-patches-preview__composer-input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.8;
}
.enrich-patches-preview__composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 8px 14px;
}
.enrich-patches-preview__composer-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.85;
}
.enrich-patches-preview__composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.enrich-patches-preview__mic {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 15px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.enrich-patches-preview__mic:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border-color: var(--color-border-subtle);
}
.enrich-patches-preview__mic--on {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
  animation: enrich-mic-pulse 1.2s ease-in-out infinite;
}
@keyframes enrich-mic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.enrich-patches-preview__run {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.enrich-patches-preview__run:hover { opacity: 0.92; }
.enrich-patches-preview__run:active { transform: scale(0.98); }
.enrich-patches-preview__run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.enrich-patches-preview__loading,
.enrich-patches-preview__progress,
.enrich-patches-preview__error,
.enrich-patches-preview__result {
  margin: 12px 0;
  padding: 8px;
  border-radius: 4px;
}
.enrich-patches-preview__loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--color-text-secondary);
}
.enrich-patches-preview__loading-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.enrich-patches-preview__loading-stage {
  flex: 1;
  color: var(--color-text-primary);
}
.enrich-patches-preview__loading-time {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  opacity: 0.8;
}
.enrich-patches-preview__spinner {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  border-top-color: transparent;
  animation: enrich-spin 0.8s linear infinite;
}
@keyframes enrich-spin { to { transform: rotate(360deg); } }
/* Індетермінантна смуга: рух є, відсотка нема — і ми його не вигадуємо. */
.enrich-patches-preview__bar {
  position: relative;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.enrich-patches-preview__bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 35%;
  border-radius: 999px;
  background: var(--color-primary);
  animation: enrich-bar-slide 1.4s ease-in-out infinite;
}
@keyframes enrich-bar-slide {
  0%   { left: -35%; }
  100% { left: 100%; }
}
/* Коли BE віддав processed/total — смуга стає детермінованою: заповнення від
   лівого краю, ширина = відсоток, плавно росте з кожним пакетом. */
.enrich-patches-preview__bar--determinate .enrich-patches-preview__bar-fill {
  left: 0;
  animation: none;
  transition: width 0.6s ease;
}
.enrich-patches-preview__loading-pct {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}
@media (prefers-reduced-motion: reduce) {
  .enrich-patches-preview__spinner,
  .enrich-patches-preview__bar-fill { animation-duration: 3s; }
}
.enrich-patches-preview__progress {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  font-size: 13px;
}
.enrich-patches-preview__error {
  color: #e74c3c;
  background: var(--danger-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.enrich-patches-preview__retry {
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.enrich-patches-preview__retry:hover {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.enrich-patches-preview__result {
  color: #2ecc71;
  background: var(--success-bg);
}
.enrich-patches-preview__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.enrich-patches-preview__item {
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  padding: 10px;
  background: var(--color-bg-secondary);
}
.enrich-patches-preview__item--invalid {
  border-color: #e74c3c;
  background: var(--danger-bg);
}
.enrich-patches-preview__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 6px;
}
.enrich-patches-preview__badge {
  background: var(--color-primary);
  color: #fff;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}
.enrich-patches-preview__task {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.enrich-patches-preview__preview {
  margin-left: 24px;
  padding: 8px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
}
.enrich-patches-preview__preview strong {
  display: block;
  margin-bottom: 4px;
}
.enrich-patches-preview__preview p {
  margin: 4px 0;
  font-size: 14px;
}
/* Формули в прев'ю: та сама поведінка, що на дошці, але у вузькій
   колонці діалогу — тож довгий вираз скролиться, а не розпирає модалку.
   :deep, бо вміст вставляється через v-html. */
.enrich-patches-preview__preview :deep(.katex) { font-size: 1em; }
.enrich-patches-preview__preview :deep(.katex-display) {
  margin: 6px 0; overflow-x: auto; overflow-y: hidden;
}
.enrich-patches-preview__preview :deep(.lc-display-math) { overflow-x: auto; }
.enrich-patches-preview__badge-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.enrich-patches-preview__latex-warn {
  margin-left: 24px;
  margin-top: 4px;
  color: #e74c3c;
  font-size: 12px;
}

/* B-T2: блок пропусків. Тон приглушений — це довідка, а не помилка й не
   дія; червоне тут читалося б як «щось пішло не так», хоча пропуск —
   штатний і бажаний результат. */
.enrich-patches-preview__tally {
  margin-left: 8px;
  opacity: 0.85;
}
.enrich-patches-preview__skipped {
  margin: 12px 0;
}
.enrich-patches-preview__skipped-toggle {
  width: 100%;
  text-align: left;
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}
.enrich-patches-preview__skipped-toggle:hover {
  color: var(--color-text-primary);
}
.enrich-patches-preview__skipped-list {
  margin: 4px 0 0;
  padding: 0 0 0 24px;
  /* Довгий список не розтягує модалку: власна межа + скрол усередині
     блоку. Зовнішній overflow діалогу лишається недоторканим. */
  max-height: 180px;
  overflow-y: auto;
  list-style: none;
}
.enrich-patches-preview__skipped-list li {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.enrich-patches-preview__skipped-reason {
  margin-left: 6px;
  font-style: italic;
}
.enrich-patches-preview__actions {
  display: flex;
  gap: 8px;
}
.enrich-patches-preview__actions button {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}
.enrich-patches-preview__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>