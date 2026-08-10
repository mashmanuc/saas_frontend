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
      <textarea
        v-model="instruction"
        :placeholder="t('winterboard.enrich.instructionPlaceholder')"
        rows="3"
      />
      <button :disabled="!instruction.trim() || loading" @click="runEnrich">
        {{ loading ? t('winterboard.enrich.running') : t('winterboard.enrich.run') }}
      </button>
    </div>

    <!-- Loading -->
    <div class="enrich-patches-preview__loading" v-if="loading">
      {{ t('winterboard.enrich.analysing') }}
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

    <!-- Error -->
    <div class="enrich-patches-preview__error" v-if="error">
      {{ error }}
    </div>

    <!-- Patches list -->
    <div class="enrich-patches-preview__list" v-if="patches.length">
      <div
        v-for="(patch, i) in patches"
        :key="i"
        class="enrich-patches-preview__item"
        :class="{ 'enrich-patches-preview__item--invalid': !patch.latex_valid }"
      >
        <label class="enrich-patches-preview__checkbox">
          <input type="checkbox" v-model="selected[i]" :disabled="!patch.latex_valid" />
          <span class="enrich-patches-preview__badge">{{ patch.action === 'add_formula' ? t('winterboard.enrich.badgeFormula') : t('winterboard.enrich.badgeCard') }}</span>
          <span class="enrich-patches-preview__task">{{ t('winterboard.enrich.task', { ref: patch.task_ref }) }}</span>
        </label>
        <div class="enrich-patches-preview__preview">
          <strong>{{ patch.card_data?.title || '' }}</strong>
          <p>{{ patch.card_data?.body || '' }}</p>
          <span class="enrich-patches-preview__badge-label">{{ patch.card_data?.badge || '' }}</span>
        </div>
        <div class="enrich-patches-preview__latex-warn" v-if="!patch.latex_valid">
          ⚠️ {{ t('winterboard.enrich.latexInvalid', { error: patch.latex_error }) }}
        </div>
        <!-- A-T1: картка-переказ умови — галочка знята, тьютор бачить чому
             (вибрати все одно можна: фільтр страхує, не забороняє). -->
        <div class="enrich-patches-preview__latex-warn" v-if="patch.low_value">
          💤 {{ t('winterboard.enrich.lowValue') }}
        </div>
        <!-- B-T1: та сама картка вже є в іншої задачі. Позначка, не
             заборона: інколи опора справді потрібна обом. -->
        <div class="enrich-patches-preview__latex-warn" v-if="patch.duplicate_of">
          🔁 {{ t('winterboard.enrich.duplicateOf', { ref: patch.duplicate_of }) }}
        </div>
      </div>
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
          <span class="enrich-patches-preview__task">{{ t('winterboard.enrich.task', { ref: skip.task_ref }) }}</span>
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
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { shipApi, type EnrichApplyResponse, type EnrichSkip } from './shipApi'
import { useOpsSyncStore } from '@/modules/winterboard/stores/opsSyncStore'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'

const { t } = useI18n()
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
const patches = ref<any[]>([])
const selected = ref<Record<number, boolean>>({})
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const result = ref<EnrichApplyResponse | null>(null)
// N1 Фаза 4.1 (2026-08-07): скільки задач уроку реально пройшло LLM —
// раніше урок обрізався на 12 задач мовчки, тепер run_enrich() йде
// пакетами по всіх і чесно каже, скільки встигло.
const processedTasks = ref(0)
const totalTasks = ref(0)
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

/** «3–9» для суцільного діапазону, «3, 5, 9» для розрізненого. */
const pagesLabel = computed(() => {
  const pages = result.value?.page_numbers ?? []
  if (!pages.length) return ''
  if (pages.length === 1) return String(pages[0])
  const isContiguous = pages[pages.length - 1] - pages[0] === pages.length - 1
  return isContiguous ? `${pages[0]}–${pages[pages.length - 1]}` : pages.join(', ')
})

async function runEnrich() {
  if (!instruction.value.trim()) return
  loading.value = true
  error.value = ''
  patches.value = []
  selected.value = {}
  skipped.value = []
  skippedOpen.value = false
  result.value = null
  try {
    const res = await shipApi.enrich(props.artifactId, instruction.value)
    processedTasks.value = res.processed_tasks ?? 0
    totalTasks.value = res.total_tasks ?? 0
    // ⚠️ error і patches НЕ взаємовиключні: частковий збій пакета лишає
    // error (напр. «Оброблено 12/24») І успішні патчі з пакетів, що
    // спрацювали — раніше цей else-гілка мовчки викидала вже готові
    // патчі, щойно з'являлась будь-яка помилка.
    if (res.error) error.value = res.error
    patches.value = res.patches || []
    skipped.value = res.skipped || []
    const sel: Record<number, boolean> = {}
    patches.value.forEach((p: any, i: number) => {
      // low_value (переказ умови) — галочка знята, але вибрати можна:
      // фільтр страхує, рішення за тьютором.
      sel[i] = p.latex_valid !== false && p.low_value !== true
        && !p.duplicate_of
    })
    selected.value = sel
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
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
  border: 1px solid #555;
  border-radius: 6px;
  padding: 16px;
  background: #2a2a2a;
  color: #eee;
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
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
}
.enrich-patches-preview__input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.enrich-patches-preview__input textarea {
  background: #3a3a3a;
  color: #eee;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 8px;
}
.enrich-patches-preview__input button {
  align-self: flex-start;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}
.enrich-patches-preview__input button:disabled {
  background: #555;
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
  color: #aaa;
}
.enrich-patches-preview__progress {
  color: #aaa;
  background: #333;
  font-size: 13px;
}
.enrich-patches-preview__error {
  color: #e74c3c;
  background: #3a2020;
}
.enrich-patches-preview__result {
  color: #2ecc71;
  background: #1a3a1a;
}
.enrich-patches-preview__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.enrich-patches-preview__item {
  border: 1px solid #444;
  border-radius: 4px;
  padding: 10px;
  background: #333;
}
.enrich-patches-preview__item--invalid {
  border-color: #e74c3c;
  background: #3a2020;
}
.enrich-patches-preview__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 6px;
}
.enrich-patches-preview__badge {
  background: #4a90d9;
  color: #fff;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}
.enrich-patches-preview__task {
  color: #aaa;
  font-size: 13px;
}
.enrich-patches-preview__preview {
  margin-left: 24px;
  padding: 8px;
  background: #3a3a3a;
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
.enrich-patches-preview__badge-label {
  font-size: 12px;
  color: #aaa;
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
  background: #333;
  color: #aaa;
  font-size: 13px;
  cursor: pointer;
}
.enrich-patches-preview__skipped-toggle:hover {
  color: #ddd;
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
  color: #aaa;
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
  background: #2ecc71;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}
.enrich-patches-preview__actions button:disabled {
  background: #555;
  cursor: not-allowed;
}
</style>