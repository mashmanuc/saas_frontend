<!--
  QuadraticInspector — contextual sidebar panel for selected quadratic_card asset.

  Shown by GroupContentSidebar when quadUiState.bridge !== null.
  Sections:
    1. Знак (sign selector: < ≤ = ≥ >)
    2. Приклади (presets)
    3. Коефіцієнти a, b, c (number inputs — без обмежень діапазону)
    4. Дискримінант + корені (readonly computed)
    5. Відображення (toggles: vertex, axis, roots)

  Pattern: mirrors CalculusInspector.vue.
-->
<template>
  <div class="quad-insp">
    <!-- Header — dynamic title with sign -->
    <div class="quad-insp__header">
      <span class="quad-insp__title">ax² + bx + c <em class="quad-insp__sign">{{ b.sign }}</em> 0</span>
      <span class="quad-insp__subtitle">{{ headerSubtitle }}</span>
    </div>

    <!-- Sign selector -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">{{ t('winterboard.quadratic.signLabel') }}</div>
      <div class="quad-insp__sign-row">
        <button
          v-for="s in SIGNS"
          :key="s.value"
          type="button"
          class="quad-insp__sign-btn"
          :class="{ 'is-active': b.sign === s.value }"
          :title="s.title"
          @click="b.setSign(s.value)"
        >{{ s.label }}</button>
      </div>
    </div>

    <!-- Presets -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">{{ t('winterboard.quadratic.presetsLabel') }}</div>
      <div class="quad-insp__btn-row quad-insp__btn-row--wrap">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="quad-insp__btn quad-insp__btn--preset"
          :title="p.hint"
          @click="b.setPreset(p.a, p.b, p.c)"
        >{{ p.label }}</button>
      </div>
    </div>

    <!-- Coefficients — number inputs (no range limit) -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">{{ t('winterboard.quadratic.coefficientsLabel') }}</div>

      <label class="quad-insp__num-row">
        <span class="quad-insp__num-label">a =</span>
        <input
          type="number"
          class="quad-insp__num-input"
          step="0.01"
          :value="r2(b.a)"
          :title="t('winterboard.quadratic.coefATitle')"
          @change="onAChange"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <span class="quad-insp__num-hint">a ≠ 0</span>
      </label>

      <label class="quad-insp__num-row">
        <span class="quad-insp__num-label">b =</span>
        <input
          type="number"
          class="quad-insp__num-input"
          step="0.01"
          :value="r2(b.b)"
          @change="onBChange"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </label>

      <label class="quad-insp__num-row">
        <span class="quad-insp__num-label">c =</span>
        <input
          type="number"
          class="quad-insp__num-input"
          step="0.01"
          :value="r2(b.c)"
          @change="onCChange"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </label>
    </div>

    <!-- Discriminant + roots (computed readonly) -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">{{ t('winterboard.quadratic.discriminantLabel') }}</div>

      <div class="quad-insp__disc-row">
        <span class="quad-insp__disc-label">D =</span>
        <span class="quad-insp__disc-val" :class="discClass">{{ fmtVal(disc) }}</span>
      </div>

      <div class="quad-insp__roots-row">
        <template v-if="disc > 1e-9">
          <span class="quad-insp__root-item root-pos">x₁ = {{ fmtVal(Math.min(root1, root2)) }}</span>
          <span class="quad-insp__root-item root-pos">x₂ = {{ fmtVal(Math.max(root1, root2)) }}</span>
        </template>
        <template v-else-if="Math.abs(disc) < 1e-9">
          <span class="quad-insp__root-item root-zero">x₀ = {{ fmtVal(vertexX) }}</span>
        </template>
        <template v-else>
          <span class="quad-insp__root-item root-neg">{{ t('winterboard.quadratic.noRoots') }}</span>
        </template>
      </div>

      <div class="quad-insp__vertex-row">
        {{ t('winterboard.quadratic.vertex') }}: ({{ fmtVal(vertexX) }}; {{ fmtVal(vertexY) }})
      </div>

      <!-- Solution summary for inequalities -->
      <div v-if="b.sign !== '='" class="quad-insp__sol-row">
        <span class="quad-insp__sol-label">{{ t('winterboard.quadratic.solutionLabel') }}:</span>
        <span class="quad-insp__sol-val">{{ solutionText }}</span>
      </div>
    </div>

    <!-- Display toggles -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">{{ t('winterboard.quadratic.displayLabel') }}</div>
      <div class="quad-insp__btn-row">
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showVertex }"
          :title="t('winterboard.quadratic.showVertexTitle')"
          @click="b.toggle('showVertex')"
        >● {{ t('winterboard.quadratic.vertexBtn') }}</button>
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showAxis }"
          :title="t('winterboard.quadratic.axisTitle')"
          @click="b.toggle('showAxis')"
        >| {{ t('winterboard.quadratic.axisBtn') }}</button>
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showRoots }"
          :title="t('winterboard.quadratic.rootsTitle')"
          @click="b.toggle('showRoots')"
        >✕ {{ t('winterboard.quadratic.rootsBtn') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { quadUiState } from '../../board/state/quadUiState'
import { QUAD_PRESETS } from '../../constants/quadDefaults'
import type { QuadSign } from '../../types/quad'

const { t } = useI18n()

const b = computed(() => quadUiState.bridge!)
const PRESETS = QUAD_PRESETS

const SIGNS = computed<Array<{ value: QuadSign; label: string; title: string }>>(() => [
  { value: '<',  label: '<',  title: 'ax²+bx+c < 0' },
  { value: '<=', label: '≤',  title: 'ax²+bx+c ≤ 0' },
  { value: '=',  label: '=',  title: t('winterboard.quadratic.signEquationTitle') },
  { value: '>=', label: '≥',  title: 'ax²+bx+c ≥ 0' },
  { value: '>',  label: '>',  title: 'ax²+bx+c > 0' },
])

/** Округлення до 2 знаків для відображення (навчальний контекст). */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtVal(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return r2(n).toString().replace('.', ',')
}

const disc    = computed(() => b.value.b ** 2 - 4 * b.value.a * b.value.c)
const vertexX = computed(() => -b.value.b / (2 * b.value.a))
const vertexY = computed(() => b.value.a * vertexX.value ** 2 + b.value.b * vertexX.value + b.value.c)
const root1   = computed(() => (-b.value.b - Math.sqrt(disc.value)) / (2 * b.value.a))
const root2   = computed(() => (-b.value.b + Math.sqrt(disc.value)) / (2 * b.value.a))

const discClass = computed(() =>
  disc.value > 1e-9 ? 'disc-pos' : disc.value < -1e-9 ? 'disc-neg' : 'disc-zero',
)

const headerSubtitle = computed(() => {
  if (b.value.sign === '=') return t('winterboard.quadratic.subtitleEquation')
  return t('winterboard.quadratic.subtitleInequality')
})

/** Текстовий опис розв'язку нерівності для Inspector */
const solutionText = computed(() => {
  const { a, sign } = b.value
  const D = disc.value
  const incl = sign === '>=' || sign === '<='
  const wantPos = sign === '>' || sign === '>='
  const wantNeg = sign === '<' || sign === '<='

  if (Math.abs(D) < 1e-9) {
    // D = 0 → один корінь x₀
    const x0 = fmtVal(vertexX.value)
    if (wantPos && a > 0) return incl ? t('winterboard.quadratic.allReal') : `x ≠ ${x0}`
    if (wantNeg && a < 0) return incl ? t('winterboard.quadratic.allReal') : `x ≠ ${x0}`
    if (incl) return `x = ${x0}`
    return t('winterboard.quadratic.noSolution')
  }

  if (D < -1e-9) {
    // D < 0 → коренів немає
    if ((wantPos && a > 0) || (wantNeg && a < 0)) return t('winterboard.quadratic.allNumbers')
    return t('winterboard.quadratic.noSolution')
  }

  // D > 0 → два корені x₁ < x₂
  const x1 = fmtVal(Math.min(root1.value, root2.value))
  const x2 = fmtVal(Math.max(root1.value, root2.value))
  const lo = incl ? '[' : '('
  const hi = incl ? ']' : ')'

  if ((wantPos && a > 0) || (wantNeg && a < 0)) {
    // поза парабола-додатна зона → (-∞; x₁) ∪ (x₂; +∞)
    return `(-∞; ${x1}${hi} ∪ ${lo}${x2}; +∞)`
  }
  // всередині
  return `${lo}${x1}; ${x2}${hi}`
})

// ── Event handlers ────────────────────────────────────────────────────────

function onAChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const v = r2(parseFloat(input.value))
  if (Number.isFinite(v) && Math.abs(v) >= 0.01) {
    b.value.setA(v)
    input.value = String(v)   // нормалізуємо відображення
  } else {
    // скидаємо до поточного округленого значення якщо введено 0 або нечислове
    input.value = String(r2(b.value.a))
  }
}

function onBChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const v = r2(parseFloat(input.value))
  if (Number.isFinite(v)) { b.value.setB(v); input.value = String(v) }
}

function onCChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const v = r2(parseFloat(input.value))
  if (Number.isFinite(v)) { b.value.setC(v); input.value = String(v) }
}
</script>

<style scoped>
.quad-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.quad-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #c5dae8;
  background: #e8f4f8;
}
.quad-insp__title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #1e4a5a;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.3;
}
.quad-insp__sign {
  font-style: normal;
  color: #c05a20;
  font-size: 15px;
}
.quad-insp__subtitle {
  display: block;
  font-size: 10px;
  color: #6a8a9a;
  margin-top: 2px;
}

/* ── Sections ── */
.quad-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ddeef5;
}
.quad-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6a8a9a;
  margin-bottom: 6px;
}

/* ── Sign selector ── */
.quad-insp__sign-row {
  display: flex;
  gap: 4px;
}
.quad-insp__sign-btn {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  padding: 5px 2px;
  border: 1px solid rgba(59, 123, 155, 0.3);
  border-radius: 4px;
  background: #fffaf0;
  color: #3b5a6a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  text-align: center;
}
.quad-insp__sign-btn:hover { background: #deeef5; border-color: #3b7b9b; }
.quad-insp__sign-btn.is-active {
  background: #c05a20;
  border-color: #c05a20;
  color: #fff;
}

/* ── Buttons ── */
.quad-insp__btn-row {
  display: flex;
  gap: 4px;
}
.quad-insp__btn-row--wrap { flex-wrap: wrap; }

.quad-insp__btn {
  font-size: 10.5px;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid rgba(59, 123, 155, 0.3);
  border-radius: 4px;
  background: #fffaf0;
  color: #3b5a6a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
}
.quad-insp__btn:hover { background: #deeef5; border-color: #3b7b9b; }
.quad-insp__btn.is-active { background: #3b7b9b; border-color: #3b7b9b; color: #fffaf0; }
.quad-insp__btn--preset { padding: 4px 6px; font-size: 10px; }

/* ── Number inputs ── */
.quad-insp__num-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.quad-insp__num-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #3b5a6a;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 26px;
}
.quad-insp__num-input {
  flex: 1;
  min-width: 0;
  padding: 3px 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #1e3a4a;
  background: #fff;
  border: 1px solid rgba(59, 123, 155, 0.35);
  border-radius: 4px;
  outline: none;
  text-align: right;
  transition: border-color 0.1s;
  -moz-appearance: textfield;
}
.quad-insp__num-input::-webkit-outer-spin-button,
.quad-insp__num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.quad-insp__num-input:focus { border-color: #3b7b9b; box-shadow: 0 0 0 2px rgba(59,123,155,0.15); }
.quad-insp__num-hint {
  font-size: 9.5px;
  color: #9aaa8a;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Discriminant ── */
.quad-insp__disc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.quad-insp__disc-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #5a4a3a;
}
.quad-insp__disc-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
}
.disc-pos  { color: #3b7b9b; }
.disc-zero { color: #7a8b3a; }
.disc-neg  { color: #a83a5b; }

.quad-insp__roots-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.quad-insp__root-item {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
}
.root-pos  { color: #3b7b9b; }
.root-zero { color: #7a8b3a; }
.root-neg  { color: #a83a5b; font-size: 11px; }

.quad-insp__vertex-row {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8a7a6a;
  margin-bottom: 2px;
}

/* ── Solution summary ── */
.quad-insp__sol-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 6px;
  padding: 5px 7px;
  background: rgba(59,123,155,0.07);
  border-radius: 5px;
  border: 1px solid rgba(59,123,155,0.18);
}
.quad-insp__sol-label {
  font-size: 10px;
  color: #6a8a9a;
  white-space: nowrap;
  flex-shrink: 0;
}
.quad-insp__sol-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #1e3a4a;
  word-break: break-all;
}
</style>
