<!--
  NumberLineInspector — contextual sidebar panel for selected number_line asset (Б-184).

  Shown by GroupContentSidebar when numberLineUiState.bridge !== null.
  Чернетка живе в NumberLineRenderer; тут лише поля й кнопки → bridge.

  Один розділ замість трьох режимів (ТЗ «Числова пряма — один рядок», 2026-10-13): чим рахувати,
  вирішує chooseNumberLine; слів «режим», «сервер», «пілот» учитель не бачить.
  Sections:
    1. Нерівність (рядок на умову: Enter — новий рядок, Backspace у порожньому — прибрати)
    2. Знак (вставляє знак, дужку, ², √ у рядок з фокусом)
    3. Поєднання (система / сукупність — коли рядків більше одного)
    4. Опції (відповідь; «Знаки інтервалів» — пілот, лише один рядок)
    «Застосувати» / Ctrl+Enter — рівно один asset_update; Esc — повернути застосоване.
    Стара пряма «вручну» — замість 1–3 старий розділ точок і знаків (лише для такої прямої).

  Pattern: mirrors TrigSolverInspector.vue (ті самі класи-кольори).
-->
<template>
  <div class="nl-insp" data-testid="number-line-editor" @keydown.stop>
    <!-- Header -->
    <div class="nl-insp__header">
      <span class="nl-insp__title">{{ t('winterboard.numberLine.title') }}</span>
      <span class="nl-insp__subtitle">{{ t('winterboard.numberLine.subtitle') }}</span>
    </div>

    <!-- Стара пряма «вручну» (точки й знаки вчителя): лише для такої прямої, нову так не створити. -->
    <template v-if="b.legacyManual">

        <div class="nl-insp__section">
          <div class="nl-insp__section-label">{{ t('winterboard.numberLine.pointsLabel') }}</div>
          <input
            class="nl-insp__input"
            :class="{ 'has-error': b.intervalsError }"
            :value="b.pointsText"
            :placeholder="t('winterboard.numberLine.pointsPlaceholder')"
            data-testid="number-line-points"
            spellcheck="false"
            autocomplete="off"
          maxlength="200"
            @input="b.setPointsText(($event.target as HTMLInputElement).value)"
            @keydown="onExprKeydown"
          />
          <div v-if="b.intervalsError" class="nl-insp__error" data-testid="number-line-iv-error">{{ b.intervalsError }}</div>
          <div v-if="b.manualPoints.length" class="nl-insp__btn-row nl-insp__keys">
            <button
              v-for="(p, i) in b.manualPoints"
              :key="p.label"
              type="button"
              class="nl-insp__btn nl-insp__point"
              :title="t('winterboard.numberLine.pointsHint')"
              :data-testid="`number-line-point-chip-${i}`"
              @click="b.togglePoint(i)"
            ><span class="nl-insp__dot" :class="{ 'is-filled': p.included }" />{{ p.display }}</button>
          </div>
        </div>

        <div v-if="b.manualPoints.length" class="nl-insp__section">
          <div class="nl-insp__section-label">{{ t('winterboard.numberLine.signsLabel') }}</div>
          <div class="nl-insp__btn-row nl-insp__signs">
            <template v-for="(sg, i) in b.manualSigns" :key="i">
              <button
                type="button"
                class="nl-insp__btn nl-insp__btn--rel"
                :class="{ 'is-plus': sg === '+', 'is-minus': sg === '-' }"
                :data-testid="`number-line-sign-btn-${i}`"
                @click="b.toggleSign(i)"
              >{{ sg === '+' ? '+' : '−' }}</button>
              <span v-if="i < b.manualPoints.length" class="nl-insp__between">{{ b.manualPoints[i].display }}</span>
            </template>
          </div>
        </div>

        <div class="nl-insp__section">
          <div class="nl-insp__section-label">{{ t('winterboard.numberLine.opLabel') }}</div>
          <div class="nl-insp__btn-row">
            <button
              v-for="o in IV_OPS"
              :key="o.v"
              type="button"
              class="nl-insp__btn nl-insp__btn--rel"
              :class="{ 'is-active': b.manualOp === o.v }"
              :data-testid="`number-line-op-${o.v}`"
              @click="b.setManualOp(o.v)"
            >{{ o.lab }} 0</button>
          </div>
        </div>
    </template>

    <template v-else>
    <!-- Нерівність: рядок на умову (Enter — новий рядок, Backspace у порожньому — прибрати) -->
    <div class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.numberLine.inequalityLabel') }}</div>
      <div v-for="(line, i) in b.draft" :key="i" class="nl-insp__row">
        <input
          :ref="(el) => setInputRef(el as HTMLInputElement | null, i)"
          class="nl-insp__input"
          :class="{ 'has-error': b.errorFor(i) }"
          :value="line"
          :placeholder="i === 0 ? t('winterboard.numberLine.placeholder') : ''"
          :data-testid="`number-line-input-${i}`"
          spellcheck="false"
          autocomplete="off"
          maxlength="200"
          @input="b.setLine(i, ($event.target as HTMLInputElement).value)"
          @keydown="onKeydown($event, i)"
          @focus="focused = i"
        />
        <div v-if="b.errorFor(i)" class="nl-insp__error" :data-testid="`number-line-error-${i}`">{{ b.errorFor(i) }}</div>
      </div>
      <div v-if="b.note" class="nl-insp__subtitle" data-testid="number-line-note">{{ b.note }}</div>
      <button
        type="button"
        class="nl-insp__btn nl-insp__btn--add"
        data-testid="number-line-add-row"
        @mousedown.prevent
        @click="addRow(focused)"
      >{{ t('winterboard.numberLine.addCondition') }}</button>
    </div>

    <!-- Знак (вставляє в рядок з фокусом) -->
    <div class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.quadratic.signLabel') }}</div>
      <div class="nl-insp__btn-row nl-insp__keys">
        <button
          v-for="k in KEYS"
          :key="k"
          type="button"
          class="nl-insp__btn nl-insp__btn--rel"
          @mousedown.prevent
          @click="insertText(k)"
        >{{ k }}</button>
      </div>
    </div>

    <!-- Поєднання -->
    <div v-if="filledRows > 1" class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.numberLine.combineLabel') }}</div>
      <div class="nl-insp__btn-row">
        <button
          type="button"
          class="nl-insp__btn"
          :class="{ 'is-active': b.combine === 'and' }"
          data-testid="number-line-combine-and"
          @click="b.setCombine('and')"
        >{{ t('winterboard.numberLine.combineAnd') }}</button>
        <button
          type="button"
          class="nl-insp__btn"
          :class="{ 'is-active': b.combine === 'or' }"
          data-testid="number-line-combine-or"
          @click="b.setCombine('or')"
        >{{ t('winterboard.numberLine.combineOr') }}</button>
      </div>
    </div>
    </template>

    <!-- Опції -->
    <div class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.trigSolver.optionsLabel') }}</div>
      <div class="nl-insp__btn-row">
        <button
          type="button"
          class="nl-insp__btn"
          :class="{ 'is-active': b.showAnswer }"
          data-testid="number-line-show-answer"
          @click="b.toggleAnswer()"
        >{{ t('winterboard.numberLine.showAnswer') }}</button>
        <!-- «Знаки інтервалів»: «+/−» і крива — лише один рядок; бачить пілот (і пряма, де знаки вже є). -->
        <button
          v-if="showSigns"
          type="button"
          class="nl-insp__btn"
          :class="{ 'is-active': b.signs && filledRows <= 1 }"
          :disabled="filledRows > 1"
          data-testid="number-line-signs"
          @click="b.setSigns(!b.signs)"
        >{{ t('winterboard.numberLine.signsOption') }}</button>
      </div>
    </div>

    <!-- Дії -->
    <div class="nl-insp__section nl-insp__actions">
      <span v-if="b.dirty" class="nl-insp__dirty" data-testid="number-line-dirty">{{ t('winterboard.numberLine.notApplied') }}</span>
      <button v-if="b.dirty" type="button" class="nl-insp__btn" data-testid="number-line-revert" @click="b.revert()">
        {{ t('winterboard.numberLine.revert') }}
      </button>
      <button
        type="button"
        class="nl-insp__btn is-active nl-insp__apply"
        data-testid="number-line-apply"
        :disabled="b.solving"
        @click="b.apply()"
      >{{ t(b.solving ? 'winterboard.numberLine.solving' : 'winterboard.numberLine.apply') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { numberLineUiState } from '../../board/state/numberLineUiState'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { isIntervalsPilotUser } from '../../engine/numberLine/pilot'

const { t } = useI18n()

// Non-null — component shown only when bridge is registered
const b = computed(() => numberLineUiState.bridge!)

const authStore = useAuthStore()
/** «Знаки інтервалів» — пілот; пряма, де знаки вже є, показує галочку будь-кому (щоб можна було вимкнути). */
const showSigns = computed(() => !b.value.legacyManual && (isIntervalsPilotUser(authStore.user?.id) || b.value.signs))

/** Одна клавіатура: знаки нерівностей + дужки, квадрат і корінь (ТЗ «один рядок» §1). */
const KEYS = ['<', '≤', '>', '≥', '≠', '=', '(', ')', '²', '√']
const TIGHT = new Set(['(', ')', '²', '√'])
const IV_OPS: Array<{ v: '<' | '<=' | '>' | '>='; lab: string }> = [
  { v: '<', lab: '<' }, { v: '<=', lab: '≤' }, { v: '>', lab: '>' }, { v: '>=', lab: '≥' },
]

/** «Вручну»: Enter / Ctrl+Enter застосовують, Esc — повертає застосоване. */
function onExprKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    b.value.apply()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    b.value.revert()
  }
}

const focused = ref(0)
const inputs: Array<HTMLInputElement | null> = []

const filledRows = computed(() => b.value.draft.filter((l) => l.trim()).length)

function setInputRef(el: HTMLInputElement | null, i: number): void {
  inputs[i] = el
}

function focusRow(i: number, caret?: number): void {
  void nextTick(() => {
    const el = inputs[i]
    if (!el) return
    el.focus()
    if (caret !== undefined) el.setSelectionRange(caret, caret)
  })
}

function addRow(after: number): void {
  focusRow(b.value.addRow(after), 0)
}

function insertText(text: string): void {
  const i = Math.min(focused.value, b.value.draft.length - 1)
  const el = inputs[i]
  const value = b.value.draft[i] ?? ''
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  const piece = TIGHT.has(text) ? text : ` ${text} `
  const next = `${value.slice(0, start)}${piece}${value.slice(end)}`.replace(/\s{2,}/g, ' ')
  b.value.setLine(i, next)
  focusRow(i, Math.min(next.length, start + piece.length))
}

function onKeydown(e: KeyboardEvent, i: number): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    b.value.apply()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    addRow(i)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    b.value.revert()
    return
  }
  if (e.key === 'Backspace' && b.value.draft[i] === '' && b.value.draft.length > 1) {
    e.preventDefault()
    const prev = b.value.removeRow(i)
    if (prev >= 0) focusRow(prev, b.value.draft[prev].length)
  }
}
</script>

<style scoped>
.nl-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.nl-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5c99a;
  background: #f4ede0;
}

.nl-insp__title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #3a2f24;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.3;
}

.nl-insp__subtitle {
  display: block;
  font-size: 10px;
  color: #9a8674;
  margin-top: 2px;
}

/* ── Section ── */
.nl-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ede3d0;
}

.nl-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a8674;
  margin-bottom: 6px;
}

/* ── Rows ── */
.nl-insp__row { margin-bottom: 5px; }

.nl-insp__input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 8px;
  border: 1px solid rgba(196, 98, 42, 0.3);
  border-radius: 4px;
  background: #ffffff;
  color: #2b2118;
  font: 13px 'JetBrains Mono', monospace;
  outline: none;
}

.nl-insp__input:focus { border-color: #c4622a; box-shadow: 0 0 0 2px rgba(196, 98, 42, 0.15); }
.nl-insp__input.has-error { border-color: #a83a5b; background: #fdf2f5; }

.nl-insp__error {
  margin-top: 2px;
  font-size: 11px;
  color: #a83a5b;
}

/* ── Button rows ── */
.nl-insp__btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nl-insp__btn {
  font-size: 10.5px;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid rgba(196, 98, 42, 0.3);
  border-radius: 4px;
  background: #fffaf0;
  color: #5a4a3a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
}

.nl-insp__btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}

.nl-insp__btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}

.nl-insp__btn--rel {
  min-width: 32px;
  text-align: center;
}

.nl-insp__btn--add { margin-top: 2px; }

/* ── Метод інтервалів ── */
.nl-insp__keys { margin-top: 6px; }
.nl-insp__point { display: inline-flex; align-items: center; gap: 4px; }
.nl-insp__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.6px solid #c4622a;
  background: #fffaf0;
  box-sizing: border-box;
}
.nl-insp__dot.is-filled { background: #c4622a; }
.nl-insp__signs { align-items: center; }
.nl-insp__between { font: 10px 'JetBrains Mono', monospace; color: #9a8674; }
.nl-insp__btn.is-plus { color: #c4622a; font-weight: 700; }
.nl-insp__btn.is-minus { color: #3a6ea5; font-weight: 700; }

/* ── Actions ── */
.nl-insp__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: none;
}

.nl-insp__dirty {
  font-size: 10px;
  color: #b45309;
}

.nl-insp__apply {
  margin-left: auto;
  padding: 6px 12px;
  font-size: 11.5px;
}

/* ── Темна тема: ті самі токени, що й у TrigSolverInspector ── */
[data-theme="dark"] .nl-insp {
  background: var(--color-warning-soft);
}
[data-theme="dark"] .nl-insp__header {
  border-bottom-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
  background: var(--color-surface-sunken);
}
[data-theme="dark"] .nl-insp__title {
  color: var(--color-text);
}
[data-theme="dark"] .nl-insp__subtitle,
[data-theme="dark"] .nl-insp__section-label {
  color: var(--color-text-muted);
}
[data-theme="dark"] .nl-insp__section {
  border-bottom-color: var(--color-border);
}
[data-theme="dark"] .nl-insp__input {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-warning);
}
[data-theme="dark"] .nl-insp__btn {
  border-color: var(--color-warning);
  background: var(--color-warning-soft);
  color: var(--color-text-secondary);
}
[data-theme="dark"] .nl-insp__btn:hover {
  background: var(--color-border);
  border-color: var(--color-warning);
}
[data-theme="dark"] .nl-insp__btn.is-active {
  background: var(--color-warning);
  border-color: var(--color-warning);
  color: var(--color-on-accent);
}
</style>
