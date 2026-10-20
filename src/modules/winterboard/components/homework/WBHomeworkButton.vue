<!--
  «📝 Запропонувати домашку» (власник 2026-10-19). Кнопка у верхній смужці уроку — лише вчителю, у режимі
  редагування й лише коли на уроці є задачі з банку (без них домашку нема з чого складати).

  Натиск нічого не кладе на дошку: відкриває вікно з ПРОПОЗИЦІЄЮ — список таких самих задач, як на уроці
  (добирає сервер з банку, модель не викликається). Далі вчитель:
    «Інші задачі» — новий набір того самого виду; «Показати відповіді» — лише йому;
    «Скопіювати картинку» — картка з формулами й підписом M4SH для месенджера (власник 19.10: «очі ріже»
    від тексту; «скопіювати це карткою… зразу було видно, що це де зроблено»); не дав браузер — «Завантажити»;
    «Додати в урок» — одна картка-список на новій останній сторінці (видно в записі й у «Моїх уроках» учня).
  Той самий вікно відкриває Інтегралик на «дай домашку» (подія `m4sh:homework-propose`).
  План: `saas_docs/domains/intent/HOMEWORK_FROM_LESSON_2026-10-19.md`.
-->
<template>
  <button
    v-if="available"
    type="button"
    class="wb-header-btn wb-homework-btn"
    data-testid="wb-homework-button"
    :title="t('winterboard.homework.button')"
    @click="openModal()"
  >📝 {{ t('winterboard.homework.button') }}</button>

  <Teleport to="body">
    <div
      v-if="open"
      class="wb-homework-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('winterboard.homework.title')"
      data-testid="wb-homework-modal"
      @click.self="open = false"
    >
      <div class="wb-homework">
        <button type="button" class="wb-homework__close" :aria-label="t('common.close', 'Закрити')" @click="open = false">✕</button>
        <h2 class="wb-homework__title">
          {{ t('winterboard.homework.title') }}<span v-if="proposal?.date" class="wb-homework__lesson"> · {{ proposal.date }}</span>
          <span v-if="proposal?.lesson" class="wb-homework__lesson-name">{{ proposal.lesson }}</span>
        </h2>

        <!-- Поки сервер добирає — Інтегралик думає, як під час генерації уроку (власник 20.10: «мав би показуватись
             інтегралик… тут генерується домашнє завдання»). -->
        <div v-if="loading" class="wb-homework__thinking" role="status" aria-busy="true" data-testid="wb-homework-thinking">
          <IntegralykLoader :width="170" />
          <p class="wb-homework__status">{{ t('winterboard.homework.loading') }}</p>
        </div>
        <p v-else-if="error" class="wb-homework__error" role="alert" data-testid="wb-homework-error">{{ error }}</p>
        <template v-else-if="proposal">
          <p class="wb-homework__status">{{ proposal.message }}</p>
          <p v-if="proposal.instruction" class="wb-homework__instruction" data-testid="wb-homework-instruction">
            {{ proposal.instruction }}
          </p>
          <ol
            class="wb-homework__list"
            :class="{ 'wb-homework__list--grid': bareExpressions }"
            data-testid="wb-homework-list"
          >
            <li v-for="item in proposal.items" :key="item.id" class="wb-homework__item">
              <span v-html="renderTextWithLatex(item.short || item.text)" />
              <span
                v-if="showAnswers && item.answer"
                class="wb-homework__answer"
                data-testid="wb-homework-answer"
              > → <span v-html="renderTextWithLatex(item.answer)" /></span>
            </li>
          </ol>
          <p v-if="downloadUrl" class="wb-homework__status" data-testid="wb-homework-download-hint">
            {{ t('winterboard.homework.downloadHint') }}
            <a :href="downloadUrl" :download="downloadName" data-testid="wb-homework-download">{{ t('winterboard.homework.download') }}</a>
          </p>
        </template>

        <div class="wb-homework__row">
          <span class="wb-homework__count">
            {{ t('winterboard.homework.count') }}
            <button type="button" class="wb-homework__step" :disabled="loading || count <= 1" @click="changeCount(-1)">−</button>
            <b data-testid="wb-homework-count">{{ count }}</b>
            <button type="button" class="wb-homework__step" :disabled="loading || count >= MAX_COUNT" @click="changeCount(1)">+</button>
          </span>
          <button type="button" class="wb-homework__btn" :disabled="loading" data-testid="wb-homework-others" @click="others">
            {{ t('winterboard.homework.others') }}
          </button>
          <button
            type="button"
            class="wb-homework__btn"
            :disabled="loading || !proposal"
            data-testid="wb-homework-answers"
            @click="toggleAnswers"
          >{{ showAnswers ? t('winterboard.homework.hideAnswers') : t('winterboard.homework.showAnswers') }}</button>
        </div>
        <div class="wb-homework__row wb-homework__row--main">
          <button
            type="button"
            class="wb-homework__btn wb-homework__btn--main"
            :disabled="loading || !proposal"
            data-testid="wb-homework-copy"
            @click="copyImage"
          >{{ copying ? t('winterboard.homework.copying') : copied ? t('winterboard.homework.copied')
            : showAnswers ? t('winterboard.homework.copyWithAnswers') : t('winterboard.homework.copy') }}</button>
          <button
            type="button"
            class="wb-homework__btn wb-homework__btn--main"
            :disabled="loading || !proposal"
            data-testid="wb-homework-add"
            @click="addToLesson"
          >{{ t('winterboard.homework.add') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import IntegralykLoader from '@/modules/intent/IntegralykLoader.vue'
import { homeworkImage, proposeHomework } from '@/modules/intent/homeworkApi'
import { validateTaskPages } from '@/modules/intent/taskPages'
import { useWBStore } from '../../board/state/boardStore'
import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { homeworkPage, lastPageLook, lessonHasBankTasks, type HomeworkProposal } from '../../board/homeworkCard'

const props = defineProps<{ boardId: string }>()

const MAX_COUNT = 20
const DEFAULT_COUNT = 10

const { t } = useI18n()
const store = useWBStore()

const available = computed(() => Boolean(props.boardId) && store.mode === 'edit' && lessonHasBankTasks(store.pages))
const open = ref(false)
const loading = ref(false)
const error = ref('')
const proposal = ref<HomeworkProposal | null>(null)
const count = ref(DEFAULT_COUNT)
const showAnswers = ref(false)
const copied = ref(false)
const copying = ref(false)
const downloadUrl = ref('')
const downloadName = computed(() => `${t('winterboard.homework.title')}.png`)
// Самі вирази без тексту — двома колонками, як на картинці.
const bareExpressions = computed(() => (proposal.value?.items.length ?? 0) > 1
  && (proposal.value?.items ?? []).every(item => /^\s*\$[^$]+\$\s*$/.test(item.short || '')))

function dropDownload(): void {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''
}

function clamp(n: number): number {
  return Math.min(MAX_COUNT, Math.max(1, Math.round(n)))
}

async function fetchProposal(exclude: string[] = []): Promise<void> {
  loading.value = true
  error.value = ''
  copied.value = false
  dropDownload()
  try {
    // Сервер добирає «нові» задачі за станом дошки на сервері: спершу доносимо всі ще не відправлені дії.
    try {
      await useOpsSyncStore().flushAll()
    } catch {
      throw new Error(t('winterboard.homework.flushFailed'))
    }
    proposal.value = await proposeHomework({ boardId: props.boardId, count: count.value, exclude })
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
    proposal.value = null
    error.value = typeof detail === 'string' ? detail : ((e as Error)?.message || t('winterboard.homework.error'))
  } finally {
    loading.value = false
  }
}

function openModal(n?: number): void {
  if (typeof n === 'number' && Number.isFinite(n)) count.value = clamp(n)
  open.value = true
  showAnswers.value = false
  void fetchProposal()
}

function changeCount(delta: number): void {
  count.value = clamp(count.value + delta)
  void fetchProposal()
}

// Відповіді показано — картинка піде з ними (власник 20.10: «вибираю показати відповіді і копіюю, то відповіді не
// скопійовуються»). Перемкнув — попередня копія вже не та: «Скопійовано» і посилання на файл скидаємо.
function toggleAnswers(): void {
  showAnswers.value = !showAnswers.value
  copied.value = false
  dropDownload()
}

function others(): void {
  void fetchProposal(proposal.value?.items.map(item => item.id) ?? [])
}

/**
 * Картинка в буфер обміну одним натиском: `ClipboardItem` з обіцянкою — так браузер не губить натиск, поки сервер
 * малює. Буфер для картинок недоступний (Firefox, вікно без дозволу) — даємо завантажити той самий файл.
 */
async function copyImage(): Promise<void> {
  if (!proposal.value || copying.value) return
  copied.value = false
  dropDownload()
  copying.value = true
  const image = homeworkImage({
    boardId: props.boardId, ids: proposal.value.items.map(item => item.id), answers: showAnswers.value,
  })
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('no-image-clipboard')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
    copied.value = true
  } catch {
    try {
      downloadUrl.value = URL.createObjectURL(await image)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      error.value = typeof detail === 'string' ? detail : t('winterboard.homework.error')
    }
  } finally {
    copying.value = false
  }
}

function addToLesson(): void {
  if (!proposal.value) return
  const sync = useOpsSyncStore()
  if (store.mode !== 'edit' || sync.mode !== 'SYNC' || sync.inputLocked) {
    error.value = t('winterboard.homework.locked')
    return
  }
  try {
    // Колір і візерунок — як в останньої сторінки уроку (власник 20.10: «такі саме, як попередні»).
    const page = homeworkPage(proposal.value, lastPageLook(store.pages))
    store.insertTaskPagesUndoable(validateTaskPages([page]), { atEnd: true })
    open.value = false
    dropDownload()
  } catch (e: unknown) {
    error.value = (e as Error)?.message || t('winterboard.homework.error')
  }
}

// Інтегралик: «дай домашку» відкриває це саме вікно (boardActions `add_homework`).
function onPropose(event: Event): void {
  const detail = (event as CustomEvent<{ count?: number; handled?: boolean }>).detail
  if (!detail || !available.value) return
  detail.handled = true
  openModal(detail.count)
}

onMounted(() => window.addEventListener('m4sh:homework-propose', onPropose))
onBeforeUnmount(() => {
  window.removeEventListener('m4sh:homework-propose', onPropose)
  dropDownload()
})

defineExpose({ openModal })
</script>

<style scoped>
.wb-homework-btn { width: auto; padding: 0 10px; gap: 4px; font-size: 13px; font-weight: 600; white-space: nowrap; }

.wb-homework-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.wb-homework {
  position: relative;
  width: min(100%, 720px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 22px 22px 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.wb-homework__close {
  position: absolute; top: 10px; right: 12px; border: 0; background: transparent;
  font-size: 18px; color: var(--text-secondary, #64748b); cursor: pointer;
}
.wb-homework__title { margin: 0 32px 6px 0; font-size: 1.2rem; font-weight: 700; }
.wb-homework__lesson { font-weight: 500; color: var(--text-secondary, #475569); }
.wb-homework__lesson-name { display: block; margin-top: 2px; font-size: 0.95rem; font-weight: 500; color: var(--accent, #059669); }
.wb-homework__instruction { margin: 0 0 10px; font-size: 1rem; color: var(--text-primary, #0f172a); }
.wb-homework__list--grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; row-gap: 10px; }
.wb-homework__list--grid .wb-homework__item + .wb-homework__item { margin-top: 0; }
.wb-homework__list--grid .wb-homework__item { font-size: 1.15rem; }
.wb-homework__thinking { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 0 12px; }
.wb-homework__status { margin: 0 0 10px; color: var(--text-secondary, #475569); font-size: 0.9rem; }
.wb-homework__error { margin: 0 0 10px; color: var(--color-danger, #dc2626); font-size: 0.95rem; }
/* Загальні стилі сайту прибирають нумерацію списків — номер задачі тут обов'язковий. */
.wb-homework__list { list-style: decimal outside; margin: 0 0 14px; padding-left: 1.8em; font-size: 1.02rem; line-height: 1.5; }
.wb-homework__item { display: list-item; }
.wb-homework__item + .wb-homework__item { margin-top: 6px; }
.wb-homework__answer { color: var(--accent, #059669); font-weight: 600; }
.wb-homework__row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.wb-homework__row--main { margin-top: 12px; }
.wb-homework__count { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; font-size: 0.95rem; }
.wb-homework__step {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0);
  background: transparent; font-size: 1rem; cursor: pointer;
}
.wb-homework__btn {
  min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--border-color, #e2e8f0);
  background: transparent; color: var(--text-primary, #0f172a); font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.wb-homework__btn--main { flex: 1 1 200px; min-height: 44px; border: 0; background: var(--accent, #059669); color: var(--accent-contrast, #ffffff); }
.wb-homework__btn:disabled, .wb-homework__step:disabled { opacity: 0.45; cursor: default; }
</style>
