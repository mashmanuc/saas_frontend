<!--
  ImageReadingBlock — «Інтегралик прочитав»: коректор розпізнаного для виділеної картинки.
  ТЗ: saas_docs/domains/intent/TZ_IMAGE_READING_CORRECTOR_2026-10-08.md (§0 К1, §5, §7).

  Правило власника: «не перетворити на ще один редактор тексту й LaTeX». Тому тут лише:
    • показ прочитаного (текст — текстом, формули — KaTeX);
    • виправлення ОДНОГО фрагмента: формула → наявне вікно WBFormulaInputModal,
      текст → просте поле без форматування;
    • «Підтвердити», «Прочитати заново», «Прибрати виправлення».
  Жодних панелей інструментів, шрифтів, таблиць, редагування JSON.

  Стан дошки й ops НЕ змінюються (SYSTEM_LAW): блок лише читає id сесії й картинки
  і кличе REST Інтегралика. Сервер — джерело правди; повторів кодом немає (LAW §12).
-->
<template>
  <section v-if="shown" class="image-reading" data-testid="image-reading">
    <div class="image-reading__header">
      <span class="image-reading__title">{{ t('winterboard.imageReading.title') }}</span>
      <span
        v-if="statusLabel"
        class="image-reading__status"
        :class="`image-reading__status--${status}`"
        data-testid="image-reading-status"
      >{{ statusLabel }}</span>
    </div>

    <p v-if="loading" class="image-reading__muted">{{ t('winterboard.imageReading.loading') }}</p>
    <p v-else-if="notOnBoard" class="image-reading__muted" data-testid="image-reading-not-on-board">
      {{ t('winterboard.imageReading.notOnBoard') }}
    </p>

    <template v-else-if="reading">
      <p v-if="status === 'none'" class="image-reading__muted" data-testid="image-reading-none">
        {{ t('winterboard.imageReading.notRead') }}
      </p>

      <template v-else>
        <p v-if="segments.length === 0" class="image-reading__muted">
          {{ t('winterboard.imageReading.emptyText') }}
        </p>
        <div
          v-else
          class="image-reading__text"
          :class="{ 'image-reading__text--stale': status === 'stale' }"
          data-testid="image-reading-text"
        >
          <template v-for="(seg, i) in segments" :key="i">
            <span
              v-if="seg.type === 'formula'"
              class="image-reading__formula"
              :class="{
                'image-reading__formula--fixable': canFix,
                'image-reading__formula--invalid': !rendered[i],
              }"
              :role="canFix ? 'button' : undefined"
              :tabindex="canFix ? 0 : undefined"
              :title="canFix ? t('winterboard.imageReading.editFormula') : undefined"
              :aria-label="canFix ? t('winterboard.imageReading.editFormula') : undefined"
              :aria-disabled="canFix && !!busy ? 'true' : undefined"
              data-testid="image-reading-formula"
              :data-index="i"
              @click="openFormula(i)"
              @keydown.enter.prevent="openFormula(i)"
            ><span v-if="rendered[i]" v-html="rendered[i]" /><code v-else>{{ seg.latex }}</code></span>

            <span v-else-if="seg.type === 'text' && editingText === i" class="image-reading__text-edit">
              <textarea
                :ref="setTextInput"
                v-model="textDraft"
                class="image-reading__text-input"
                rows="3"
                maxlength="1500"
                spellcheck="false"
                data-testid="image-reading-text-input"
                @keydown.esc.prevent="cancelText"
                @keydown.ctrl.enter.prevent="saveText"
                @keydown.meta.enter.prevent="saveText"
              />
              <span class="image-reading__text-edit-actions">
                <button
                  type="button"
                  class="image-reading__btn image-reading__btn--primary"
                  :disabled="!!busy || !textDraft.trim()"
                  data-testid="image-reading-text-save"
                  @click="saveText"
                >{{ t('winterboard.imageReading.save') }}</button>
                <button
                  type="button"
                  class="image-reading__btn"
                  data-testid="image-reading-text-cancel"
                  @click="cancelText"
                >{{ t('winterboard.imageReading.cancel') }}</button>
              </span>
            </span>

            <span
              v-else-if="seg.type === 'text'"
              class="image-reading__segment"
              :class="{ 'image-reading__segment--fixable': canFix }"
              :role="canFix ? 'button' : undefined"
              :tabindex="canFix ? 0 : undefined"
              :title="canFix ? t('winterboard.imageReading.editText') : undefined"
              :aria-disabled="canFix && !!busy ? 'true' : undefined"
              data-testid="image-reading-segment-text"
              :data-index="i"
              @click="openText(i)"
              @keydown.enter.prevent="openText(i)"
            >{{ seg.text }}</span>
          </template>
        </div>

        <p v-if="canFix && segments.length > 0" class="image-reading__hint">
          {{ t('winterboard.imageReading.hint') }}
        </p>
      </template>

      <p v-if="busy === 'read'" class="image-reading__muted" data-testid="image-reading-busy">
        {{ t('winterboard.imageReading.reading') }}
      </p>

      <!-- Дії — ЛИШЕ з правом (`can_edit` від сервера). Без нього — тільки перегляд. -->
      <div v-if="reading.can_edit === true" class="image-reading__actions">
        <button
          v-if="status === 'none'"
          type="button"
          class="image-reading__btn image-reading__btn--primary"
          :disabled="!!busy"
          data-testid="image-reading-read"
          @click="onRead(false)"
        >{{ t('winterboard.imageReading.read') }}</button>
        <template v-else>
          <button
            v-if="status === 'model'"
            type="button"
            class="image-reading__btn image-reading__btn--primary"
            :disabled="!!busy"
            data-testid="image-reading-confirm"
            @click="onConfirm"
          >{{ t('winterboard.imageReading.confirm') }}</button>
          <button
            type="button"
            class="image-reading__btn"
            :disabled="!!busy"
            data-testid="image-reading-reread"
            @click="onRead(true)"
          >{{ t('winterboard.imageReading.reread') }}</button>
          <button
            v-if="status === 'corrected' || status === 'confirmed'"
            type="button"
            class="image-reading__btn"
            :disabled="!!busy"
            data-testid="image-reading-revert"
            @click="onRevert"
          >{{ t('winterboard.imageReading.revert') }}</button>
        </template>
      </div>
    </template>

    <p v-if="errorText" class="image-reading__error" role="alert" data-testid="image-reading-error">
      {{ errorText }}<template v-if="errorLatex"> <code>{{ errorLatex }}</code></template>
    </p>

    <!-- Наявне вікно формули (не змінене): initialFormula → submit з LaTeX. -->
    <WBFormulaInputModal
      :visible="formulaModal.visible"
      :initial-formula="formulaModal.initial"
      @close="closeFormula"
      @submit="onFormulaSubmit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import 'katex/dist/katex.min.css'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useProfileStore } from '@/modules/profile/store/profileStore'
import { isIntegralykServerDisabled } from '@/modules/intent/integralykAccess'
import { canSeeImageReading } from '@/modules/intent/imageReadingAccess'
import { errorCodeOf } from '@/modules/intent/errorMessage'
import {
  confirmImageReading,
  fetchImageReading,
  readImage,
  revertImageReading,
  saveImageReading,
} from '@/modules/intent/imageReadingApi'
import {
  firstInvalidFormulaIndex,
  renderFormulaHtml,
  replaceSegment,
} from '@/modules/intent/imageReadingSegments'
import { notifySuccess } from '@/utils/notify'
import WBFormulaInputModal from '../../toolbar/WBFormulaInputModal.vue'

type Segment = { type: 'text'; text: string } | { type: 'formula'; latex: string }
type ReadingStatus = 'none' | 'model' | 'confirmed' | 'corrected' | 'stale'
interface Reading {
  status: ReadingStatus
  segments?: Segment[]
  model?: string | null
  read_at?: string | null
  can_edit?: boolean
}
type Busy = 'read' | 'confirm' | 'revert' | 'save' | null

const props = defineProps<{
  /** id сесії дошки (`store.workspaceId`) — `board_id` API. */
  boardId: string | null
  /** Власник дошки (`store.ownerId`). */
  boardOwnerId: string | number | null
  /** id виділеної картинки — `object_id` API. */
  objectId: string
  /** Адреса картинки: змінилась — перечитуємо стан із сервера. */
  imageSrc?: string
}>()

const emit = defineEmits<{
  /** Сервер сказав «не для вас» (403) або Інтегралик на сервері вимкнено — блок сховано. */
  unavailable: []
}>()

const { t } = useI18n()
const auth = useAuthStore()
const profile = useProfileStore()
const route = useRoute()

// ── Хто бачить блок ─────────────────────────────────────────────────────────
// Одне правило з кнопкою тулбара (imageReadingAccess.js): гейт Інтегралика (роль,
// маршрут, персональний вимикач) + власник дошки. Учню блоку немає й запиту теж.
const allowed = computed(() => (
  !!props.boardId &&
  !!props.objectId &&
  canSeeImageReading({
    user: auth.user,
    route,
    settings: profile.settings,
    boardOwnerId: props.boardOwnerId,
  })
))
// Сервер сказав «не для вас» (403) або Інтегралик вимкнено на сервері (404 без коду) —
// ховаємо блок для цієї дошки, щоб не питати знову на кожне виділення.
const hiddenForBoard = ref<string | null>(null)
const shown = computed(() => allowed.value && hiddenForBoard.value !== props.boardId)

// ── Стан ────────────────────────────────────────────────────────────────────
const reading = ref<Reading | null>(null)
const loading = ref(false)
const notOnBoard = ref(false)
const busy = ref<Busy>(null)
const errorText = ref('')
const errorLatex = ref('')
// Вікно формули (наявне WBFormulaInputModal) — для якого сегмента і з чим відкрите.
const formulaModal = ref({ visible: false, index: -1, initial: '' })
// Відхилена формула (не відмальовується): повторне відкриття віддає введене, а не стару.
const rejected = ref<{ index: number; latex: string } | null>(null)
// Текстовий фрагмент, який зараз виправляють, і чернетка поля.
const editingText = ref<number | null>(null)
const textDraft = ref('')
let textInput: HTMLTextAreaElement | null = null

const status = computed<ReadingStatus | null>(() => reading.value?.status ?? null)
const segments = computed<Segment[]>(() => (
  Array.isArray(reading.value?.segments) ? reading.value!.segments! : []
))
const rendered = computed(() => segments.value.map((s) => (
  s.type === 'formula' ? renderFormulaHtml(s.latex) : null
)))
// Виправляти можна лише чинне прочитане і лише з правом від сервера.
const canFix = computed(() => (
  reading.value?.can_edit === true &&
  (status.value === 'model' || status.value === 'corrected' || status.value === 'confirmed')
))

const statusLabel = computed(() => {
  switch (status.value) {
    case 'model': return t('winterboard.imageReading.status.model')
    case 'corrected': return t('winterboard.imageReading.status.corrected')
    case 'confirmed': return t('winterboard.imageReading.status.confirmed')
    case 'stale': return t('winterboard.imageReading.status.stale')
    default: return ''
  }
})

const apiRef = () => ({ boardId: props.boardId, objectId: props.objectId })

// Номер поточного об'єкта: відповідь для попередньої картинки не перезаписує нову.
let generation = 0

function clearError() {
  errorText.value = ''
  errorLatex.value = ''
}

/**
 * Людський текст помилки. 400 «спробуйте ще раз» не лікує: при читанні це картинка,
 * яку Інтегралик не читає (адреса не з дозволених джерел, ТЗ §7.7), при зміні —
 * сервер її не прийняв.
 */
function messageFor(err: any, kind: 'load' | Exclude<Busy, null>): string {
  const statusCode = err?.response?.status
  if (statusCode === 400) {
    return kind === 'load' || kind === 'read'
      ? t('winterboard.imageReading.cannotRead')
      : t('winterboard.imageReading.notAccepted')
  }
  if (statusCode === 403) return t('winterboard.imageReading.forbidden')
  if (statusCode === 404) return t('winterboard.imageReading.notOnBoard')
  if (statusCode === 429) return t('winterboard.imageReading.rateLimited')
  return t('winterboard.imageReading.failed')
}

async function load() {
  const my = ++generation
  reading.value = null
  notOnBoard.value = false
  busy.value = null
  editingText.value = null
  rejected.value = null
  formulaModal.value = { visible: false, index: -1, initial: '' }
  clearError()
  if (!allowed.value || hiddenForBoard.value === props.boardId) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await fetchImageReading(apiRef())
    if (my !== generation) return
    reading.value = res
  } catch (err: any) {
    if (my !== generation) return
    const code = err?.response?.status
    if (code === 403 || isIntegralykServerDisabled(err)) {
      hiddenForBoard.value = props.boardId
      // Вікно в тулбарі інакше лишилось би порожнім — хай закриється й сховає кнопку.
      emit('unavailable')
    } else if (code === 404) {
      notOnBoard.value = true
    } else {
      errorText.value = messageFor(err, 'load')
    }
  } finally {
    if (my === generation) loading.value = false
  }
}

watch(
  [allowed, () => props.boardId, () => props.objectId, () => props.imageSrc],
  load,
  { immediate: true },
)

/**
 * Одна дія — один запит; поки він іде, інші кнопки неактивні.
 * Повертає true, якщо сервер прийняв.
 */
async function run(kind: Exclude<Busy, null>, call: () => Promise<Reading>, sent?: Segment[]): Promise<boolean> {
  if (busy.value) return false
  const my = generation
  busy.value = kind
  clearError()
  try {
    const res = await call()
    if (my !== generation) return false
    reading.value = res
    // Нове прочитане / повернення до моделі — відхилена спроба формули вже не про те.
    if (kind !== 'save') rejected.value = null
    return true
  } catch (err: any) {
    if (my !== generation) return false
    const data = err?.response?.data
    if (err?.response?.status === 400 && errorCodeOf(data) === 'INVALID_FORMULA') {
      const idx = Number(data?.index)
      const seg = sent?.[idx]
      errorText.value = t('winterboard.imageReading.formulaInvalid')
      errorLatex.value = seg?.type === 'formula' ? seg.latex : ''
      if (seg?.type === 'formula') rejected.value = { index: idx, latex: seg.latex }
    } else {
      errorText.value = messageFor(err, kind)
    }
    return false
  } finally {
    if (my === generation) busy.value = null
  }
}

function onRead(force: boolean) {
  return run('read', () => readImage(apiRef(), { force }))
}

function onConfirm() {
  return run('confirm', () => confirmImageReading(apiRef()))
}

function onRevert() {
  return run('revert', () => revertImageReading(apiRef()))
}

/**
 * Зберегти виправлення: спершу кожна формула має відмальовуватись KaTeX — інакше
 * не зберігаємо й кажемо, яка саме. Сервер перевіряє ще раз (400 invalid_formula).
 */
async function saveSegments(next: Segment[]): Promise<boolean> {
  const bad = firstInvalidFormulaIndex(next)
  if (bad !== -1) {
    const seg = next[bad] as { type: 'formula'; latex: string }
    errorText.value = t('winterboard.imageReading.formulaInvalid')
    errorLatex.value = seg.latex
    rejected.value = { index: bad, latex: seg.latex }
    return false
  }
  const ok = await run('save', () => saveImageReading(apiRef(), next), next)
  if (ok) notifySuccess(t('winterboard.imageReading.saved'))
  return ok
}

// ── Формула: наявне вікно ────────────────────────────────────────────────────
function openFormula(i: number) {
  if (!canFix.value || busy.value) return
  const seg = segments.value[i]
  if (seg?.type !== 'formula') return
  editingText.value = null
  const initial = rejected.value?.index === i ? rejected.value.latex : seg.latex
  formulaModal.value = { visible: true, index: i, initial }
}

function closeFormula() {
  formulaModal.value = { ...formulaModal.value, visible: false }
}

async function onFormulaSubmit(latex: string) {
  const i = formulaModal.value.index
  closeFormula()
  const seg = segments.value[i]
  if (seg?.type !== 'formula') return
  if (latex === seg.latex) {
    rejected.value = null
    return
  }
  const ok = await saveSegments(replaceSegment(segments.value, i, latex))
  if (ok) rejected.value = null
}

// ── Текст: просте поле для одного фрагмента ─────────────────────────────────
function setTextInput(el: unknown) {
  textInput = (el as HTMLTextAreaElement | null) ?? null
}

async function openText(i: number) {
  if (!canFix.value || busy.value) return
  const seg = segments.value[i]
  if (seg?.type !== 'text') return
  closeFormula()
  editingText.value = i
  textDraft.value = seg.text
  await nextTick()
  textInput?.focus()
}

function cancelText() {
  editingText.value = null
}

async function saveText() {
  const i = editingText.value
  if (i === null || busy.value) return
  const seg = segments.value[i]
  if (seg?.type !== 'text') return
  const draft = textDraft.value
  if (!draft.trim()) return
  if (draft === seg.text) {
    editingText.value = null
    return
  }
  const ok = await saveSegments(replaceSegment(segments.value, i, draft))
  if (ok) editingText.value = null
}
</script>

<style scoped>
.image-reading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.image-reading__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.image-reading__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.image-reading__status {
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
}

.image-reading__status--stale {
  color: var(--color-warning, #b45309);
}

.image-reading__text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--wb-text-primary, #111827);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.image-reading__text--stale {
  opacity: 0.6;
}

.image-reading__formula,
.image-reading__segment {
  border-radius: 4px;
}

.image-reading__formula--fixable,
.image-reading__segment--fixable {
  cursor: pointer;
}

.image-reading__formula--fixable:hover,
.image-reading__formula--fixable:focus-visible,
.image-reading__segment--fixable:hover,
.image-reading__segment--fixable:focus-visible {
  background: var(--wb-bg-secondary, #f3f4f6);
  outline: 1px dashed var(--wb-brand, #0066ff);
}

.image-reading__formula--invalid code {
  color: var(--color-danger, #b91c1c);
  font-size: 12px;
}

.image-reading__text-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0;
  white-space: normal;
}

.image-reading__text-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.image-reading__text-input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

.image-reading__text-edit-actions,
.image-reading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.image-reading__btn {
  padding: 5px 10px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  font-size: 12px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  cursor: pointer;
}

.image-reading__btn--primary {
  border-color: var(--wb-brand, #0066ff);
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.image-reading__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-reading__muted,
.image-reading__hint {
  margin: 0;
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
}

.image-reading__error {
  margin: 0;
  font-size: 12px;
  color: var(--color-danger, #b91c1c);
}
</style>
