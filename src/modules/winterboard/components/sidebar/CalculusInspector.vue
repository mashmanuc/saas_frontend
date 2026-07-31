<!--
  CalculusInspector — contextual sidebar panel for selected Calculus asset.

  Shown by GroupContentSidebar when calculusUiState.bridge !== null.
  Reads reactive state from bridge; calls bridge.toggle/setRiemann/setH/setN/onExprPreset.

  Sections:
    1. Вираз (expression presets)
    2. Derivative: Січна, Слід f'(x), h slider
    3. Integral: Σ (Riemann off/L/M/R), N slider, Первісна

  Pattern: mirrors TrigSolverInspector.vue.
-->
<template>
  <div class="calc-insp">
    <!-- Header -->
    <div class="calc-insp__header">
      <span class="calc-insp__title">{{ modeLabel }}: <MathExpr :expr="'y = ' + b.expr" /></span>
      <span class="calc-insp__subtitle">{{ t('winterboard.calculus.subtitle') }}</span>
    </div>

    <!-- Швидкі пресети — завжди перші, завжди видно -->
    <div class="calc-insp__section">
      <div class="calc-insp__section-label">{{ t('winterboard.calculus.examples') }}</div>
      <div class="calc-insp__btn-row calc-insp__btn-row--wrap">
        <button
          v-for="p in EXPR_PRESETS"
          :key="p.expr"
          type="button"
          class="calc-insp__btn calc-insp__btn--preset"
          :class="{ 'is-active': b.expr === p.expr }"
          @click="b.onExprPreset(p.expr)"
        ><MathExpr :expr="p.expr" /></button>
      </div>
    </div>

    <!-- Вираз — editable input -->
    <div class="calc-insp__section">
      <div class="calc-insp__section-label">{{ t('winterboard.calculus.expression') }}</div>
      <div class="calc-insp__expr-row">
        <span class="calc-insp__expr-prefix">y =</span>
        <!-- Гібрид «рендер у спокої»: KaTeX-прев'ю поки не редагується;
             клік → той самий <input>. Порожній вираз → одразу input. -->
        <button
          v-if="!exprFocused && localExpr.trim()"
          type="button"
          class="calc-insp__expr-preview"
          @click="startExprEdit"
        ><MathExpr :expr="localExpr" /></button>
        <!-- MathQuill WYSIWYG у edit-режимі; fallback — plain input нижче -->
        <!-- mqEditing фіксується один раз у startExprEdit — перевірка renderable
             на кожен keystroke розмонтовувала б поле на проміжному вводі (x+) -->
        <MathQuillField
          v-else-if="exprFocused && mqEditing"
          :model-value="localExpr"
          autofocus
          @update:model-value="onMqInput"
          @enter="onExprCommit"
          @blur="exprFocused = false; onExprCommit()"
          @unavailable="mqAvailable = false"
        />
        <input
          v-else
          ref="exprInputEl"
          type="text"
          class="calc-insp__expr-input"
          :value="localExpr"
          spellcheck="false"
          autocomplete="off"
          placeholder="x^2"
          @focus="exprFocused = true"
          @blur="exprFocused = false; onExprCommit()"
          @input="onExprInput"
          @keydown.enter.prevent="onExprCommit"
        />
      </div>
    </div>

    <!-- Derivative controls -->
    <template v-if="b.mode === 'derivative'">
      <div class="calc-insp__section">
        <div class="calc-insp__section-label">{{ t('winterboard.calculus.mode.derivative.full') }}</div>

        <div class="calc-insp__btn-row">
          <button
            type="button"
            class="calc-insp__btn"
            :class="{ 'is-active': b.showSecant }"
            :title="t('winterboard.calculus.titles.showSecant')"
            @click="b.toggle('showSecant')"
          >/ {{ t('winterboard.calculus.toggle.secant') }}</button>
          <button
            type="button"
            class="calc-insp__btn"
            :class="{ 'is-active': b.showDerivTrace }"
            :title="t('winterboard.calculus.titles.showDerivTrace')"
            @click="b.toggle('showDerivTrace')"
          >~ f'(x)</button>
        </div>

        <!-- h slider — only when showSecant active -->
        <label v-if="b.showSecant" class="calc-insp__slider-row">
          <span class="calc-insp__slider-label">h =</span>
          <input
            type="range"
            class="calc-insp__slider"
            min="0.02"
            max="2"
            step="0.01"
            :value="b.h"
            @input="onHInput"
          />
          <span class="calc-insp__slider-val">{{ b.h.toFixed(2) }}</span>
        </label>
      </div>
    </template>

    <!-- Integral controls -->
    <template v-if="b.mode === 'integral'">
      <div class="calc-insp__section">
        <div class="calc-insp__section-label">{{ t('winterboard.calculus.sectionIntegral') }}</div>

        <!-- Riemann mode + Первісна -->
        <div class="calc-insp__riemann-row">
          <span class="calc-insp__mini-label">Σ:</span>
          <button
            v-for="mode in RIEMANN_MODES"
            :key="mode"
            type="button"
            class="calc-insp__btn calc-insp__btn--seg"
            :class="{ 'is-active': b.riemann === mode }"
            @click="b.setRiemann(mode)"
          >{{ riemannLabel(mode) }}</button>
          <button
            type="button"
            class="calc-insp__btn"
            :class="{ 'is-active': b.showF }"
            :title="t('winterboard.calculus.titles.showAntiderivative')"
            @click="b.toggle('showF')"
          >∫ F(x)</button>
        </div>

        <!-- Межі інтегрування — ручний ввід (доповнює drag на канві) -->
        <div class="calc-insp__bounds-row" :title="t('winterboard.calculus.boundsTitle')">
          <label class="calc-insp__bound">
            <span class="calc-insp__slider-label">a =</span>
            <input
              type="number"
              class="calc-insp__bound-input"
              step="0.1"
              :value="b.a"
              @change="onBoundChange('a', $event)"
              @keydown.enter.prevent="onBoundChange('a', $event)"
            />
          </label>
          <label class="calc-insp__bound">
            <span class="calc-insp__slider-label">b =</span>
            <input
              type="number"
              class="calc-insp__bound-input"
              step="0.1"
              :value="b.b"
              @change="onBoundChange('b', $event)"
              @keydown.enter.prevent="onBoundChange('b', $event)"
            />
          </label>
        </div>

        <!-- N slider -->
        <label class="calc-insp__slider-row">
          <span class="calc-insp__slider-label">N =</span>
          <input
            type="range"
            class="calc-insp__slider"
            min="2"
            max="200"
            step="1"
            :value="b.N"
            @input="onNInput"
          />
          <span class="calc-insp__slider-val">{{ b.N }}</span>
        </label>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MathExpr from '../shared/MathExpr.vue'
import MathQuillField from '../shared/MathQuillField.vue'
import { isRenderableAscii } from '../../utils/asciiMathToLatex'
import { loadMathQuill } from '../../utils/mathquillLoader'
import { calculusUiState } from '../../board/state/calculusUiState'
import { CALCULUS_EXPR_PRESETS } from '../../constants/calculusDefaults'
import type { RiemannMode } from '../../vendor/calculus'

const { t } = useI18n()

// Non-null — component shown only when bridge is registered
const b = computed(() => calculusUiState.bridge!)

const EXPR_PRESETS = CALCULUS_EXPR_PRESETS
const RIEMANN_MODES: RiemannMode[] = ['off', 'left', 'mid', 'right']

const modeLabel = computed(() =>
  b.value.mode === 'derivative' ? "f'(x)" : '∫ f dx',
)

function riemannLabel(mode: RiemannMode): string {
  const map: Record<RiemannMode, string> = { off: '—', left: 'L', mid: 'M', right: 'R' }
  return map[mode]
}

// ── Expression input (local draft) ────────────────────────────────────────
// localExpr tracks user's live typing. b.expr is the committed store value.
// We sync localExpr ← b.expr ONLY when input is not focused (no typing conflict).
const localExpr = ref(calculusUiState.bridge?.expr ?? '')
const exprFocused = ref(false)
const exprInputEl = ref<HTMLInputElement | null>(null)

// MathQuill: перевіряємо доступність до першого показу (без flash input→MQ)
const mqAvailable = ref(false)
// Фіксується на вході в редагування (НЕ на кожен keystroke — див. template)
const mqEditing = ref(false)
let mqChecked = false

/** Гібрид: клік по KaTeX-прев'ю → MathQuill-поле (або input, якщо MQ недоступний). */
async function startExprEdit(): Promise<void> {
  if (!mqChecked) {
    mqChecked = true
    mqAvailable.value = (await loadMathQuill()) !== null
  }
  mqEditing.value = mqAvailable.value && isRenderableAscii(localExpr.value)
  exprFocused.value = true
  nextTick(() => {
    // plain-input гілка
    exprInputEl.value?.focus()
    exprInputEl.value?.select()
  })
}

/** MQ-ввід: живий апдейт двигуна тим самим шляхом, що typing в input. */
function onMqInput(v: string): void {
  localExpr.value = v
  b.value.setExpr(v)
}

watch(
  () => calculusUiState.bridge?.expr,
  (v) => {
    if (v !== undefined && !exprFocused.value && v !== localExpr.value) {
      localExpr.value = v
    }
  },
  { immediate: true },
)

function onExprInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value
  localExpr.value = v
  b.value.setExpr(v)   // live engine update (no store commit)
}

function onExprCommit(): void {
  // teardown-guard: клік повз картку одночасно обнуляє bridge (unregister) і шле
  // blur → обробник спрацьовує вже на null. Читаємо bridge напряму (не b.value!)
  // з optional chaining — інакше null.commitExpr() вбиває всю сторінку.
  calculusUiState.bridge?.commitExpr()   // persist to store on blur / Enter
}

function onHInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) b.value.setH(v)
}

function onNInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (Number.isFinite(v)) b.value.setN(v)
}

function onBoundChange(which: 'a' | 'b', e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  // teardown-guard (@change стріляє на blur) — bridge напряму, не b.value.
  if (Number.isFinite(v)) calculusUiState.bridge?.setBound(which, v)
}
</script>

<style scoped>
.calc-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.calc-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5c99a;
  background: #f4ede0;
}

.calc-insp__title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #3a2f24;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.3;
}

.calc-insp__subtitle {
  display: block;
  font-size: 10px;
  color: #9a8674;
  margin-top: 2px;
}

/* ── Section ── */
.calc-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ede3d0;
}

.calc-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a8674;
  margin-bottom: 6px;
}

/* ── Button rows ── */
.calc-insp__btn-row {
  display: flex;
  gap: 4px;
}

.calc-insp__btn-row--wrap {
  flex-wrap: wrap;
}

.calc-insp__riemann-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.calc-insp__mini-label {
  font: 11px 'JetBrains Mono', monospace;
  color: #5a4a3a;
  flex-shrink: 0;
}

.calc-insp__btn {
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

.calc-insp__btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}

.calc-insp__btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}

/* Riemann segment buttons — compact fixed width */
.calc-insp__btn--seg {
  min-width: 28px;
  text-align: center;
}

/* Preset buttons — compact padding */
.calc-insp__btn--preset {
  padding: 4px 6px;
  font-size: 10px;
}

/* ── Expression input row ── */
.calc-insp__expr-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.calc-insp__expr-prefix {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #5a4a3a;
  flex-shrink: 0;
}

.calc-insp__expr-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid rgba(196, 98, 42, 0.35);
  border-radius: 4px;
  font: 12px 'JetBrains Mono', monospace;
  background: #fffaf0;
  color: #1e293b;
  outline: none;
  transition: border-color 0.12s;
}

.calc-insp__expr-input:focus {
  border-color: #c4622a;
  background: #fff;
}

/* Гібрид: KaTeX-прев'ю дзеркалить метрики input (без стрибка лейауту) */
.calc-insp__expr-preview {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid rgba(196, 98, 42, 0.2);
  border-radius: 4px;
  font-size: 13px;
  background: #fffaf0;
  color: #1e293b;
  cursor: text;
  text-align: left;
  overflow-x: auto;
  white-space: nowrap;
}

.calc-insp__expr-preview:hover {
  border-color: #c4622a;
  background: #fff;
}

/* ── Межі інтегрування ── */
.calc-insp__bounds-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.calc-insp__bound {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1 1 0;
  min-width: 0;
}

.calc-insp__bound-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  padding: 3px 6px;
  border: 1px solid rgba(196, 98, 42, 0.35);
  border-radius: 4px;
  font: 11px 'JetBrains Mono', monospace;
  background: #fffaf0;
  color: #1e293b;
  outline: none;
}

.calc-insp__bound-input:focus {
  border-color: #c4622a;
  background: #fff;
}

/* ── Slider row ── */
.calc-insp__slider-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.calc-insp__slider-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #5a4a3a;
  white-space: nowrap;
  flex-shrink: 0;
}

.calc-insp__slider {
  flex: 1;
  height: 3px;
  accent-color: #c4622a;
  cursor: pointer;
}

.calc-insp__slider-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #c4622a;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  white-space: nowrap;
}
</style>
