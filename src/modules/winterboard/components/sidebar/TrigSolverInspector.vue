<!--
  TrigSolverInspector — contextual sidebar panel for selected TrigSolver asset.

  Shown by GroupContentSidebar when trigSolverUiState.bridge !== null.
  Reads reactive state from bridge.local; calls bridge.setType/setRel/setA/toggleOpt.

  Sections:
    1. Функція (sin/cos/tg/ctg)
    2. Знак (= / > / < / ≥ / ≤)
    3. Значення a (slider + preset buttons)
    4. Опції (snap, графік, всі розв'язки)

  Pattern: mirrors TrigCircleInspector.vue.
-->
<template>
  <div class="ts-insp">
    <!-- Header -->
    <div class="ts-insp__header">
      <span class="ts-insp__title">
        {{ typeLabel }}(x) {{ relLabel }} {{ roundedA }}
      </span>
      <span class="ts-insp__subtitle">Тригонометричні рівняння / нерівності</span>
    </div>

    <!-- Функція -->
    <div class="ts-insp__section">
      <div class="ts-insp__section-label">Функція</div>
      <div class="ts-insp__btn-row">
        <button
          v-for="t in TYPE_OPTS"
          :key="t.v"
          type="button"
          class="ts-insp__btn"
          :class="{ 'is-active': b.local.type === t.v }"
          @click="b.setType(t.v)"
        >{{ t.lab }}</button>
      </div>
    </div>

    <!-- Знак -->
    <div class="ts-insp__section">
      <div class="ts-insp__section-label">Знак</div>
      <div class="ts-insp__btn-row">
        <button
          v-for="r in REL_OPTS"
          :key="r.v"
          type="button"
          class="ts-insp__btn ts-insp__btn--rel"
          :class="{ 'is-active': b.local.rel === r.v }"
          @click="b.setRel(r.v)"
        >{{ r.lab }}</button>
      </div>
    </div>

    <!-- Значення a -->
    <div class="ts-insp__section">
      <div class="ts-insp__section-label">Значення a</div>

      <!-- Slider -->
      <label class="ts-insp__slider-row">
        <span class="ts-insp__slider-label">a =</span>
        <input
          type="range"
          class="ts-insp__slider"
          :min="aMin"
          :max="aMax"
          step="0.01"
          :value="b.local.a"
          @input="onSlider"
        />
        <span class="ts-insp__slider-val">{{ roundedA }}</span>
      </label>

      <!-- Пресети -->
      <div class="ts-insp__btn-row ts-insp__btn-row--wrap ts-insp__presets">
        <button
          v-for="p in currentPresets"
          :key="p.label"
          type="button"
          class="ts-insp__btn ts-insp__btn--preset"
          :class="{ 'is-active': isPresetActive(p.v) }"
          @click="b.setA(p.v)"
        >{{ p.label }}</button>
      </div>
    </div>

    <!-- Опції -->
    <div class="ts-insp__section">
      <div class="ts-insp__section-label">Опції</div>
      <div class="ts-insp__btn-row">
        <button
          type="button"
          class="ts-insp__btn"
          :class="{ 'is-active': b.local.snapSpecial }"
          title="Snap до табличних значень"
          @click="b.toggleOpt('snapSpecial')"
        >⊙ snap</button>
        <button
          type="button"
          class="ts-insp__btn"
          :class="{ 'is-active': b.local.showGraph }"
          title="Показати графік"
          @click="b.toggleOpt('showGraph')"
        >~ графік</button>
        <button
          type="button"
          class="ts-insp__btn"
          :class="{ 'is-active': b.local.showAllSolutions }"
          title="Показати всі розв'язки"
          @click="b.toggleOpt('showAllSolutions')"
        >∞ всі</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { trigSolverUiState } from '../../board/state/trigSolverUiState'
import type { TrigFuncType, TrigRelation } from '../../types/trigSolver'

// Non-null — component shown only when bridge is registered
const b = computed(() => trigSolverUiState.bridge!)

const TYPE_OPTS: { v: TrigFuncType; lab: string }[] = [
  { v: 'sin', lab: 'sin' },
  { v: 'cos', lab: 'cos' },
  { v: 'tan', lab: 'tg'  },
  { v: 'cot', lab: 'ctg' },
]

const REL_OPTS: { v: TrigRelation; lab: string }[] = [
  { v: '=',  lab: '='  },
  { v: '>',  lab: '>'  },
  { v: '<',  lab: '<'  },
  { v: '>=', lab: '≥'  },
  { v: '<=', lab: '≤'  },
]

const SIN_COS_PRESETS = [
  { label: '−1',   v: -1 },
  { label: '−½',   v: -0.5 },
  { label: '0',    v: 0 },
  { label: '½',    v: 0.5 },
  { label: '√2/2', v: Math.SQRT2 / 2 },
  { label: '√3/2', v: Math.sqrt(3) / 2 },
  { label: '1',    v: 1 },
]
const TAN_COT_PRESETS = [
  { label: '−√3', v: -Math.sqrt(3) },
  { label: '−1',  v: -1 },
  { label: '0',   v: 0 },
  { label: '1',   v: 1 },
  { label: '√3',  v: Math.sqrt(3) },
]

const currentPresets = computed(() =>
  b.value.local.type === 'sin' || b.value.local.type === 'cos'
    ? SIN_COS_PRESETS
    : TAN_COT_PRESETS,
)

const aMin = computed(() =>
  b.value.local.type === 'sin' || b.value.local.type === 'cos' ? -1 : -5,
)
const aMax = computed(() =>
  b.value.local.type === 'sin' || b.value.local.type === 'cos' ?  1 :  5,
)

const roundedA = computed(() =>
  (Math.round(b.value.local.a * 100) / 100).toString().replace('.', ','),
)

const typeLabel = computed(() =>
  TYPE_OPTS.find((o) => o.v === b.value.local.type)?.lab ?? b.value.local.type,
)
const relLabel = computed(() =>
  REL_OPTS.find((o) => o.v === b.value.local.rel)?.lab ?? b.value.local.rel,
)

/** Highlight preset when current `a` matches it within floating-point tolerance. */
function isPresetActive(v: number): boolean {
  return Math.abs(b.value.local.a - v) < 0.001
}

function onSlider(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) b.value.setA(v)
}
</script>

<style scoped>
.ts-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.ts-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5c99a;
  background: #f4ede0;
}

.ts-insp__title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #3a2f24;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.3;
}

.ts-insp__subtitle {
  display: block;
  font-size: 10px;
  color: #9a8674;
  margin-top: 2px;
}

/* ── Section ── */
.ts-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ede3d0;
}

.ts-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a8674;
  margin-bottom: 6px;
}

/* ── Button rows ── */
.ts-insp__btn-row {
  display: flex;
  gap: 4px;
}

.ts-insp__btn-row--wrap {
  flex-wrap: wrap;
}

.ts-insp__presets {
  margin-top: 6px;
}

.ts-insp__btn {
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

.ts-insp__btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}

.ts-insp__btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}

/* relation buttons — wider for ≥ / ≤ */
.ts-insp__btn--rel {
  min-width: 32px;
  text-align: center;
}

/* preset buttons — compact */
.ts-insp__btn--preset {
  padding: 4px 6px;
  font-size: 10px;
}

/* ── Slider row ── */
.ts-insp__slider-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ts-insp__slider-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #5a4a3a;
  white-space: nowrap;
  flex-shrink: 0;
}

.ts-insp__slider {
  flex: 1;
  height: 3px;
  accent-color: #c4622a;
  cursor: pointer;
}

.ts-insp__slider-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #c4622a;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  white-space: nowrap;
}
</style>
