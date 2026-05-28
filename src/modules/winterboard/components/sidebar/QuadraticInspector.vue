<!--
  QuadraticInspector — contextual sidebar panel for selected quadratic_card asset.

  Shown by GroupContentSidebar when quadUiState.bridge !== null.
  Sections:
    1. Рівняння (equation display + presets)
    2. Коефіцієнти a, b, c (sliders)
    3. Дискримінант + корені (readonly computed)
    4. Відображення (toggles: vertex, axis, roots)

  Pattern: mirrors CalculusInspector.vue.
-->
<template>
  <div class="quad-insp">
    <!-- Header -->
    <div class="quad-insp__header">
      <span class="quad-insp__title">ax² + bx + c = 0</span>
      <span class="quad-insp__subtitle">дискримінант · корені на параболі</span>
    </div>

    <!-- Presets -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">Приклади</div>
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

    <!-- Coefficients -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">Коефіцієнти</div>

      <label class="quad-insp__slider-row">
        <span class="quad-insp__slider-label">a =</span>
        <input
          type="range"
          class="quad-insp__slider"
          min="-5" max="5" step="0.1"
          :value="b.a"
          @input="onAInput"
        />
        <span class="quad-insp__slider-val">{{ fmtVal(b.a) }}</span>
      </label>

      <label class="quad-insp__slider-row">
        <span class="quad-insp__slider-label">b =</span>
        <input
          type="range"
          class="quad-insp__slider"
          min="-10" max="10" step="0.1"
          :value="b.b"
          @input="onBInput"
        />
        <span class="quad-insp__slider-val">{{ fmtVal(b.b) }}</span>
      </label>

      <label class="quad-insp__slider-row">
        <span class="quad-insp__slider-label">c =</span>
        <input
          type="range"
          class="quad-insp__slider"
          min="-10" max="10" step="0.1"
          :value="b.c"
          @input="onCInput"
        />
        <span class="quad-insp__slider-val">{{ fmtVal(b.c) }}</span>
      </label>
    </div>

    <!-- Discriminant + roots (computed readonly) -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">Дискримінант</div>

      <div class="quad-insp__disc-row">
        <span class="quad-insp__disc-label">D = b² − 4ac =</span>
        <span class="quad-insp__disc-val" :class="discClass">{{ fmtVal(disc) }}</span>
      </div>

      <div class="quad-insp__roots-row">
        <template v-if="disc > 1e-9">
          <span class="quad-insp__root-item root-pos">x₁ = {{ fmtVal(root1) }}</span>
          <span class="quad-insp__root-item root-pos">x₂ = {{ fmtVal(root2) }}</span>
        </template>
        <template v-else-if="Math.abs(disc) < 1e-9">
          <span class="quad-insp__root-item root-zero">x₀ = {{ fmtVal(vertexX) }}</span>
        </template>
        <template v-else>
          <span class="quad-insp__root-item root-neg">коренів немає</span>
        </template>
      </div>

      <div class="quad-insp__vertex-row">
        вершина: ({{ fmtVal(vertexX) }}; {{ fmtVal(vertexY) }})
      </div>
    </div>

    <!-- Display toggles -->
    <div class="quad-insp__section">
      <div class="quad-insp__section-label">Відображення</div>
      <div class="quad-insp__btn-row">
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showVertex }"
          title="Показати вершину параболи"
          @click="b.toggle('showVertex')"
        >● Вершина</button>
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showAxis }"
          title="Вісь симетрії x = x₀"
          @click="b.toggle('showAxis')"
        >| Вісь</button>
        <button
          type="button"
          class="quad-insp__btn"
          :class="{ 'is-active': b.showRoots }"
          title="Корені на осі x"
          @click="b.toggle('showRoots')"
        >✕ Корені</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { quadUiState } from '../../board/state/quadUiState'
import { QUAD_PRESETS } from '../../constants/quadDefaults'

const b = computed(() => quadUiState.bridge!)
const PRESETS = QUAD_PRESETS

function fmtVal(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 100) / 100
  return r.toString().replace('.', ',')
}

const disc     = computed(() => b.value.b ** 2 - 4 * b.value.a * b.value.c)
const vertexX  = computed(() => -b.value.b / (2 * b.value.a))
const vertexY  = computed(() => b.value.a * vertexX.value ** 2 + b.value.b * vertexX.value + b.value.c)
const root1    = computed(() => (-b.value.b - Math.sqrt(disc.value)) / (2 * b.value.a))
const root2    = computed(() => (-b.value.b + Math.sqrt(disc.value)) / (2 * b.value.a))

const discClass = computed(() =>
  disc.value > 1e-9 ? 'disc-pos' : disc.value < -1e-9 ? 'disc-neg' : 'disc-zero',
)

function onAInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v) && Math.abs(v) >= 0.02) b.value.setA(v)
}
function onBInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) b.value.setB(v)
}
function onCInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) b.value.setC(v)
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

/* ── Sliders ── */
.quad-insp__slider-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.quad-insp__slider-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #3b5a6a;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 28px;
}
.quad-insp__slider {
  flex: 1;
  height: 3px;
  accent-color: #3b7b9b;
  cursor: pointer;
}
.quad-insp__slider-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #3b7b9b;
  font-weight: 600;
  min-width: 36px;
  text-align: right;
  white-space: nowrap;
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
}
</style>
