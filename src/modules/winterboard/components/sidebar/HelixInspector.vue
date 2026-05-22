<!--
  HelixInspector — contextual sidebar panel for selected Helix asset.

  Shown by GroupContentSidebar when helixUiState.bridge !== null.
  Reads reactive state from bridge.local + bridge.animating/animatingCam.
  Calls bridge.toggle(), bridge.setView(), bridge.jumpTo(), bridge.setSpeed(), etc.

  Pattern: mirrors Nmt3dInspector.vue.
-->
<template>
  <div class="helix-insp">
    <!-- Header -->
    <div class="helix-insp__header">
      <span class="helix-insp__title">Гелікс</span>
    </div>

    <!-- Огляд (view presets) -->
    <div class="helix-insp__section">
      <div class="helix-insp__section-label">Огляд</div>
      <div class="helix-insp__btn-row">
        <button
          v-for="v in VIEW_PRESETS"
          :key="v.name"
          type="button"
          class="helix-insp__btn"
          @click="b.setView(v.name)"
        >{{ v.label }}</button>
      </div>
    </div>

    <!-- Тіні -->
    <div class="helix-insp__section">
      <div class="helix-insp__section-label">Тіні</div>
      <div class="helix-insp__btn-row">
        <button
          v-for="s in SHADOW_TOGGLES"
          :key="s.key"
          type="button"
          class="helix-insp__btn"
          :class="{ 'is-active': !!b.local[s.key] }"
          @click="b.toggle(s.key)"
        >{{ s.label }}</button>
      </div>
    </div>

    <!-- Вигляд -->
    <div class="helix-insp__section">
      <div class="helix-insp__section-label">Вигляд</div>
      <div class="helix-insp__btn-row">
        <button
          v-for="d in DISPLAY_TOGGLES"
          :key="d.key"
          type="button"
          class="helix-insp__btn"
          :class="{ 'is-active': !!b.local[d.key] }"
          @click="b.toggle(d.key)"
        >{{ d.label }}</button>
      </div>
    </div>

    <!-- Рух -->
    <div class="helix-insp__section">
      <div class="helix-insp__section-label">Рух</div>
      <div class="helix-insp__btn-row">
        <button
          type="button"
          class="helix-insp__btn"
          :class="{ 'is-active': b.animating }"
          @click="b.toggleAnimate()"
        >▶ обертати θ</button>
        <button
          type="button"
          class="helix-insp__btn"
          :class="{ 'is-active': b.animatingCam }"
          @click="b.toggleAnimateCam()"
        >↻ камеру</button>
        <button
          type="button"
          class="helix-insp__btn"
          :class="{ 'is-active': b.local.emitMode }"
          @click="b.toggle('emitMode')"
        >⤴ хвиля</button>
      </div>

      <!-- Швидкість -->
      <label class="helix-insp__speed">
        <span class="helix-insp__speed-label">Швидкість</span>
        <input
          type="range"
          class="helix-insp__slider"
          min="0.1"
          max="3"
          step="0.05"
          :value="b.local.speed"
          @input="onSpeedInput"
        />
        <span class="helix-insp__speed-val">{{ speedLabel }}</span>
      </label>
    </div>

    <!-- Пресети кутів -->
    <div class="helix-insp__section">
      <div class="helix-insp__section-label">Кут θ</div>
      <div class="helix-insp__btn-row helix-insp__btn-row--wrap">
        <button
          v-for="p in ANGLE_PRESETS"
          :key="p.label"
          type="button"
          class="helix-insp__btn helix-insp__btn--angle"
          @click="b.jumpTo(p.t)"
        >{{ p.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { helixUiState } from '../../board/state/helixUiState'
import type { HelixViewName } from '../../vendor/helix'

// Non-null — component shown only when bridge is registered
const b = computed(() => helixUiState.bridge!)

const VIEW_PRESETS: { name: HelixViewName; label: string }[] = [
  { name: '3d',     label: '3D'    },
  { name: 'iso',    label: 'ізо'   },
  { name: 'circle', label: '○ коло' },
  { name: 'sin',    label: '∿ sin' },
  { name: 'cos',    label: '∿ cos' },
]

const SHADOW_TOGGLES = [
  { key: 'showHelix',  label: 'гелікс' },
  { key: 'showSin',    label: 'sin'    },
  { key: 'showCos',    label: 'cos'    },
  { key: 'showCircle', label: 'коло'   },
]

const DISPLAY_TOGGLES = [
  { key: 'showWalls',      label: 'стіни'         },
  { key: 'showDropLines',  label: 'лінії скидання' },
  { key: 'showAxisLabels', label: 'підписи θ'     },
]

const ANGLE_PRESETS = [
  { label: '0',    t: 0 },
  { label: 'π/6',  t: Math.PI / 6 },
  { label: 'π/4',  t: Math.PI / 4 },
  { label: 'π/3',  t: Math.PI / 3 },
  { label: 'π/2',  t: Math.PI / 2 },
  { label: '2π/3', t: 2 * Math.PI / 3 },
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
.helix-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.helix-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5c99a;
  background: #f4ede0;
}

.helix-insp__title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #3a2f24;
  line-height: 1.3;
}

/* ── Section ── */
.helix-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ede3d0;
}

.helix-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a8674;
  margin-bottom: 6px;
}

/* ── Button row ── */
.helix-insp__btn-row {
  display: flex;
  gap: 4px;
}

.helix-insp__btn-row--wrap {
  flex-wrap: wrap;
}

.helix-insp__btn {
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

.helix-insp__btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}

.helix-insp__btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}

.helix-insp__btn--angle {
  padding: 4px 5px;
  min-width: 30px;
  text-align: center;
  font-size: 10px;
}

/* ── Speed row ── */
.helix-insp__speed {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.helix-insp__speed-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8a7860;
  white-space: nowrap;
  flex-shrink: 0;
}

.helix-insp__slider {
  flex: 1;
  height: 3px;
  accent-color: #c4622a;
  cursor: pointer;
}

.helix-insp__speed-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #c4622a;
  min-width: 28px;
  text-align: right;
  white-space: nowrap;
}
</style>
