<!--
  NumberLineInspector — contextual sidebar panel for selected number_line asset (Б-184).

  Shown by GroupContentSidebar when numberLineUiState.bridge !== null.
  Чернетка живе в NumberLineRenderer; тут лише поля й кнопки → bridge.

  Sections:
    1. Умови (рядок на умову: Enter — новий рядок, Backspace у порожньому — прибрати)
    2. Знак (вставляє знак у рядок з фокусом)
    3. Поєднання (система / сукупність — коли умов більше однієї)
    4. Опції (відповідь)
    «Застосувати» / Ctrl+Enter — рівно один asset_update; Esc — повернути застосоване.

  Pattern: mirrors TrigSolverInspector.vue (ті самі класи-кольори).
-->
<template>
  <div class="nl-insp" data-testid="number-line-editor" @keydown.stop>
    <!-- Header -->
    <div class="nl-insp__header">
      <span class="nl-insp__title">{{ t('winterboard.numberLine.title') }}</span>
      <span class="nl-insp__subtitle">{{ t('winterboard.numberLine.subtitle') }}</span>
    </div>

    <!-- Умови -->
    <div class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.numberLine.conditionsLabel') }}</div>
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
          @input="b.setLine(i, ($event.target as HTMLInputElement).value)"
          @keydown="onKeydown($event, i)"
          @focus="focused = i"
        />
        <div v-if="b.errorFor(i)" class="nl-insp__error" :data-testid="`number-line-error-${i}`">{{ b.errorFor(i) }}</div>
      </div>
      <button
        type="button"
        class="nl-insp__btn nl-insp__btn--add"
        data-testid="number-line-add-row"
        @mousedown.prevent
        @click="addRow(focused)"
      >{{ t('winterboard.numberLine.addCondition') }}</button>
    </div>

    <!-- Знак -->
    <div class="nl-insp__section">
      <div class="nl-insp__section-label">{{ t('winterboard.quadratic.signLabel') }}</div>
      <div class="nl-insp__btn-row">
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
      </div>
    </div>

    <!-- Дії -->
    <div class="nl-insp__section nl-insp__actions">
      <span v-if="b.dirty" class="nl-insp__dirty" data-testid="number-line-dirty">{{ t('winterboard.numberLine.notApplied') }}</span>
      <button v-if="b.dirty" type="button" class="nl-insp__btn" data-testid="number-line-revert" @click="b.revert()">
        {{ t('winterboard.numberLine.revert') }}
      </button>
      <button type="button" class="nl-insp__btn is-active nl-insp__apply" data-testid="number-line-apply" @click="b.apply()">
        {{ t('winterboard.numberLine.apply') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { numberLineUiState } from '../../board/state/numberLineUiState'

const { t } = useI18n()

// Non-null — component shown only when bridge is registered
const b = computed(() => numberLineUiState.bridge!)

const KEYS = ['<', '≤', '>', '≥', '≠', '=', '√']

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
  const piece = ` ${text} `
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
