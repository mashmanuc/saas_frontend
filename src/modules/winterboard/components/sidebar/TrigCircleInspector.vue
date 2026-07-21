<!--
  TrigCircleInspector — contextual sidebar panel for selected TrigCircle asset.

  Shown by GroupContentSidebar when trigCircleUiState.bridge !== null.
  Reads reactive state from bridge.local + bridge.animating/drawMode.
  Calls bridge.toggle(), bridge.jumpTo(), bridge.setSpeed(), etc.

  Pattern: mirrors Nmt3dInspector.vue.
-->
<template>
  <div class="trig-insp">
    <!-- Header -->
    <div class="trig-insp__header">
      <span class="trig-insp__title">{{ t('winterboard.trigCircle.cardTitle') }}</span>
    </div>

    <!-- Функції -->
    <div class="trig-insp__section">
      <div class="trig-insp__section-label">{{ t('winterboard.trigCircle.funcsLabel') }}</div>
      <div class="trig-insp__btn-row">
        <button
          v-for="fn in FUNC_TOGGLES"
          :key="fn.key"
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': !!b.local[fn.key] }"
          @click="b.toggle(fn.key)"
        >{{ fn.label }}</button>
      </div>
    </div>

    <!-- Підписи -->
    <div class="trig-insp__section">
      <div class="trig-insp__section-label">{{ t('winterboard.trigCircle.labelsLabel') }}</div>
      <div class="trig-insp__btn-row">
        <button
          v-for="lb in LABEL_TOGGLES"
          :key="lb.key"
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': !!b.local[lb.key] }"
          @click="b.toggle(lb.key)"
        >{{ lb.label }}</button>
      </div>
    </div>

    <!-- Сітка -->
    <div class="trig-insp__section">
      <div class="trig-insp__section-label">{{ t('winterboard.trigCircle.gridLabel') }}</div>
      <div class="trig-insp__btn-row">
        <button
          v-for="gr in GRID_TOGGLES"
          :key="gr.key"
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': !!b.local[gr.key] }"
          @click="b.toggle(gr.key)"
        >{{ gr.label }}</button>
      </div>
    </div>

    <!-- Рух -->
    <div class="trig-insp__section">
      <div class="trig-insp__section-label">{{ t('winterboard.trigCircle.motionLabel') }}</div>
      <div class="trig-insp__btn-row">
        <button
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': b.drawMode }"
          @click="b.toggleDraw()"
        >✎ {{ t('winterboard.trigCircle.sinusoid') }}</button>
        <button
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': b.animating }"
          @click="b.toggleAnimate()"
        >▶ {{ t('winterboard.trigCircle.rotation') }}</button>
        <button
          type="button"
          class="trig-insp__btn"
          :class="{ 'is-active': b.local.snapPi12 }"
          @click="b.toggle('snapPi12')"
        >snap π/12</button>
      </div>

      <!-- Швидкість -->
      <label class="trig-insp__speed">
        <span class="trig-insp__speed-label">{{ t('winterboard.trigCircle.speedLabel') }}</span>
        <input
          type="range"
          class="trig-insp__slider"
          min="0.1"
          max="3"
          step="0.05"
          :value="b.local.speed"
          @input="onSpeedInput"
        />
        <span class="trig-insp__speed-val">{{ speedLabel }}</span>
      </label>
    </div>

    <!-- Пресети кутів -->
    <div class="trig-insp__section">
      <div class="trig-insp__section-label">{{ t('winterboard.trigCircle.angleLabel') }}</div>
      <div class="trig-insp__btn-row trig-insp__btn-row--wrap">
        <button
          v-for="p in ANGLE_PRESETS"
          :key="p.label"
          type="button"
          class="trig-insp__btn trig-insp__btn--angle"
          @click="b.jumpTo(p.t)"
        >{{ p.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { trigCircleUiState } from '../../board/state/trigCircleUiState'

const { t } = useI18n()

// Non-null — component shown only when bridge is registered
const b = computed(() => trigCircleUiState.bridge!)

const FUNC_TOGGLES = [
  { key: 'showSin', label: 'sin' },
  { key: 'showCos', label: 'cos' },
  { key: 'showTan', label: 'tg'  },
  { key: 'showCot', label: 'ctg' },
]

const LABEL_TOGGLES = computed(() => [
  { key: 'showDeg',       label: t('winterboard.trigCircle.degrees') },
  { key: 'showRad',       label: t('winterboard.trigCircle.radians') },
  { key: 'showRefLabels', label: t('winterboard.trigCircle.values') },
])

const GRID_TOGGLES = computed(() => [
  { key: 'showExactGrid',     label: t('winterboard.trigCircle.exactGrid') },
  { key: 'showInscribed',     label: t('winterboard.trigCircle.inscribed') },
  { key: 'showSpecialPoints', label: t('winterboard.trigCircle.specialPoints') },
])

const ANGLE_PRESETS = [
  { label: '0',    t: 0 },
  { label: 'π/6',  t: Math.PI / 6 },
  { label: 'π/4',  t: Math.PI / 4 },
  { label: 'π/3',  t: Math.PI / 3 },
  { label: 'π/2',  t: Math.PI / 2 },
  { label: '2π/3', t: 2 * Math.PI / 3 },
  { label: '3π/4', t: 3 * Math.PI / 4 },
  { label: 'π',    t: Math.PI },
  { label: '3π/2', t: 3 * Math.PI / 2 },
] as const

const speedLabel = computed(() =>
  (b.value.local.speed ?? 1).toFixed(1).replace('.', ',') + '×',
)

function onSpeedInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  b.value.setSpeed(v)
}
</script>

<style scoped>
.trig-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.trig-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e8b4c4;
  background: #f9edf2;
}

.trig-insp__title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #5c1f33;
  line-height: 1.3;
}

/* ── Section ── */
.trig-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #f3dce6;
}

.trig-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b86882;
  margin-bottom: 6px;
}

/* ── Button row ── */
.trig-insp__btn-row {
  display: flex;
  gap: 4px;
}

.trig-insp__btn-row--wrap {
  flex-wrap: wrap;
}

.trig-insp__btn {
  font-size: 10.5px;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid rgba(168, 58, 91, 0.3);
  border-radius: 4px;
  background: #fffaf0;
  color: #5a4a3a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
}

.trig-insp__btn:hover {
  background: #f3dce6;
  border-color: #a83a5b;
}

.trig-insp__btn.is-active {
  background: #a83a5b;
  border-color: #a83a5b;
  color: #fffaf0;
}

.trig-insp__btn--angle {
  padding: 4px 5px;
  min-width: 30px;
  text-align: center;
  font-size: 10px;
}

/* ── Speed row ── */
.trig-insp__speed {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.trig-insp__speed-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #7a5a68;
  white-space: nowrap;
  flex-shrink: 0;
}

.trig-insp__slider {
  flex: 1;
  height: 3px;
  accent-color: #a83a5b;
  cursor: pointer;
}

.trig-insp__speed-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #a83a5b;
  min-width: 28px;
  text-align: right;
  white-space: nowrap;
}
</style>
