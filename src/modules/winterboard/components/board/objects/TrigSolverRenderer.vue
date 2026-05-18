<!--
  TrigSolverRenderer — trig_solver asset HTML overlay (§3.7.7).
  Unified equation + inequality solver in one card.

  Engine: vendor/trig/trig-solver.js → window.TrigEquation | window.TrigInequality.

  POINTER-EVENTS MODEL (matches TrigCircleRenderer — critical for drag/select):
    Root .trig-solver           = pointer-events:none  → Konva proxy rect catches drag/select.
    .is-readonly .trig-slv-stage = pointer-events:none  → canvas doesn't swallow events.
    .trig-slv-stage (interactive) = pointer-events:auto (canvas is presentational).
    Toolbar                     = pointer-events:auto (controls only when interactive).

  PERSISTENCE:
    local state → engine → onChange → 300ms debounce → emit update:asset.
    Remote ops  → watch(props.asset.data.*) → setOption + local mirror (replay sync).

  MODE SWITCH:
    Switching equation ↔ inequality destroys the current engine and re-mounts the
    correct class (TrigEquation vs TrigInequality) since they have different APIs.
-->
<template>
  <div
    class="trig-solver"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-solver-${asset.id}`"
  >
    <header class="trig-slv-header">
      <span class="trig-slv-title">Тригонометрія</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-slv-delete"
        title="Видалити"
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <!-- Canvas stage — engine draws here. -->
    <div ref="stageRef" class="trig-slv-stage" />

    <!-- Toolbar (hidden in readonly / pen mode) -->
    <div class="trig-slv-toolbar">
      <!-- Row 1: mode · func · sign (ineq only) · info toggle -->
      <div class="trig-slv-row">
        <!-- Mode toggle -->
        <button
          type="button"
          class="trig-slv-btn trig-slv-btn--mode"
          :class="{ 'is-active': local.mode === 'equation' }"
          title="Рівняння"
          @click.stop="setMode('equation')"
          @mousedown.stop
          @pointerdown.stop
        >=</button>
        <button
          type="button"
          class="trig-slv-btn trig-slv-btn--mode"
          :class="{ 'is-active': local.mode === 'inequality' }"
          title="Нерівність"
          @click.stop="setMode('inequality')"
          @mousedown.stop
          @pointerdown.stop
        >≷</button>

        <span class="trig-slv-sep" />

        <!-- Function selector -->
        <button
          v-for="fn in FUNC_OPTS"
          :key="fn"
          type="button"
          class="trig-slv-btn"
          :class="{ 'is-active': local.func === fn }"
          @click.stop="setFunc(fn)"
          @mousedown.stop
          @pointerdown.stop
        >{{ fn }}</button>

        <!-- Sign selector (inequality mode only) -->
        <template v-if="local.mode === 'inequality'">
          <span class="trig-slv-sep" />
          <button
            v-for="s in SIGN_OPTS"
            :key="s"
            type="button"
            class="trig-slv-btn trig-slv-btn--sign"
            :class="{ 'is-active': local.sign === s }"
            @click.stop="setSign(s)"
            @mousedown.stop
            @pointerdown.stop
          >{{ s }}</button>
        </template>

        <span class="trig-slv-sep" />

        <!-- Info panel toggle -->
        <button
          type="button"
          class="trig-slv-btn"
          :class="{ 'is-active': local.showInfo }"
          @click.stop="toggleInfo()"
          @mousedown.stop
          @pointerdown.stop
        >{{ local.mode === 'equation' ? 'формула' : 'інтервал' }}</button>
      </div>

      <!-- Row 2: value slider + number + presets -->
      <div class="trig-slv-row">
        <span class="trig-slv-group-label">a =</span>
        <input
          type="range"
          class="trig-slv-slider"
          :min="sliderMin"
          :max="sliderMax"
          step="0.01"
          :value="local.value"
          @input="onSlider"
          @mousedown.stop
          @pointerdown.stop
        />
        <input
          type="number"
          class="trig-slv-input"
          :min="sliderMin"
          :max="sliderMax"
          step="0.01"
          :value="roundedValue"
          @change="onInput"
          @mousedown.stop
          @pointerdown.stop
        />
        <span class="trig-slv-sep" />
        <button
          v-for="p in specialPresets"
          :key="p.label"
          type="button"
          class="trig-slv-btn trig-slv-btn--preset"
          @click.stop="setValue(p.v)"
          @mousedown.stop
          @pointerdown.stop
        >{{ p.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { TrigSolverAsset, TrigSolverFunc, TrigSolverSign, TrigSolverMode } from '../../../types/trigSolver'
import type { TrigSolverOpts, TrigInequalityOpts } from '../../../vendor/trig'

/** Minimal engine interface shared by TrigEquation and TrigInequality.
 *  Using a structural subtype avoids TS union-overload errors on setOption. */
interface SolverEngine {
  setOption(key: string, value: unknown): void
  destroy(): void
  onChange?: (() => void) | null
}

const props = withDefaults(
  defineProps<{
    asset: TrigSolverAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: TrigSolverAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let engine: SolverEngine | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_MS = 300

// ── Local state mirror ────────────────────────────────────────────────────

type LocalState = {
  mode: TrigSolverMode
  func: TrigSolverFunc
  sign: TrigSolverSign
  value: number
  showInfo: boolean
}

const local = reactive<LocalState>({
  mode:     props.asset.data.mode     as TrigSolverMode,
  func:     props.asset.data.func     as TrigSolverFunc,
  sign:     props.asset.data.sign     as TrigSolverSign,
  value:    props.asset.data.value,
  showInfo: props.asset.data.showInfo,
})

// ── Constants ─────────────────────────────────────────────────────────────

const FUNC_OPTS: TrigSolverFunc[] = ['sin', 'cos', 'tan', 'cot']
const SIGN_OPTS: TrigSolverSign[] = ['>', '<', '≥', '≤']

// Special value presets — depend on current function
const specialPresets = computed(() => {
  const fn = local.func
  if (fn === 'sin' || fn === 'cos') {
    return [
      { label: '0',    v: 0 },
      { label: '½',    v: 0.5 },
      { label: '√2/2', v: Math.SQRT2 / 2 },
      { label: '√3/2', v: Math.sqrt(3) / 2 },
      { label: '1',    v: 1 },
      { label: '−½',   v: -0.5 },
      { label: '−1',   v: -1 },
    ]
  }
  return [
    { label: '0',   v: 0 },
    { label: '1',   v: 1 },
    { label: '√3',  v: Math.sqrt(3) },
    { label: '−1',  v: -1 },
    { label: '−√3', v: -Math.sqrt(3) },
  ]
})

const sliderMin = computed(() => (local.func === 'sin' || local.func === 'cos') ? -1 : -5)
const sliderMax = computed(() => (local.func === 'sin' || local.func === 'cos') ?  1 :  5)
const roundedValue = computed(() => Math.round(local.value * 100) / 100)

// ── Engine lifecycle ──────────────────────────────────────────────────────

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

type TrigWindow = Window & {
  TrigEquation: new (el: HTMLElement, opts: TrigSolverOpts) => SolverEngine
  TrigInequality: new (el: HTMLElement, opts: TrigInequalityOpts) => SolverEngine
}

function destroyEngine(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (engine) {
    try { engine.destroy() } catch { /* idempotent */ }
    engine = null
  }
}

async function mountEngine(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value || engine) return

  const W = window as unknown as TrigWindow
  const d = props.asset.data

  if (local.mode === 'equation') {
    engine = new W.TrigEquation(stageRef.value, {
      func:        d.func,
      value:       d.value,
      showFormula: d.showInfo,
    })
  } else {
    engine = new W.TrigInequality(stageRef.value, {
      func:         d.func,
      sign:         d.sign,
      value:        d.value,
      showInterval: d.showInfo,
    })
  }
  engine.onChange = () => scheduleSnapshot()
}

onMounted(() => { void mountEngine() })
onUnmounted(() => { destroyEngine() })

// ── Persistence ───────────────────────────────────────────────────────────

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    emitSnapshot()
  }, SNAPSHOT_MS)
}

function emitSnapshot(): void {
  const updated: TrigSolverAsset = {
    ...props.asset,
    data: {
      version: 1,
      mode:     local.mode,
      func:     local.func,
      sign:     local.sign,
      value:    local.value,
      showInfo: local.showInfo,
    },
  }
  emit('update:asset', updated)
}

// ── Toolbar handlers ──────────────────────────────────────────────────────

async function setMode(m: TrigSolverMode): Promise<void> {
  if (local.mode === m) return
  local.mode = m
  destroyEngine()
  await mountEngine()
  scheduleSnapshot()
}

function setFunc(fn: TrigSolverFunc): void {
  local.func = fn
  // Clamp value for sin/cos range
  if (fn === 'sin' || fn === 'cos') {
    local.value = Math.max(-1, Math.min(1, local.value))
  }
  engine?.setOption('func', fn)
  engine?.setOption('value', local.value)
  scheduleSnapshot()
}

function setSign(s: TrigSolverSign): void {
  local.sign = s
  engine?.setOption('sign', s)
  scheduleSnapshot()
}

function setValue(v: number): void {
  local.value = v
  engine?.setOption('value', v)
  scheduleSnapshot()
}

function onSlider(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  setValue(v)
}

function onInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  const clamped = (local.func === 'sin' || local.func === 'cos')
    ? Math.max(-1, Math.min(1, v))
    : Math.max(-10, Math.min(10, v))
  setValue(clamped)
}

function toggleInfo(): void {
  local.showInfo = !local.showInfo
  if (local.mode === 'equation') {
    engine?.setOption('showFormula', local.showInfo)
  } else {
    engine?.setOption('showInterval', local.showInfo)
  }
  scheduleSnapshot()
}

// ── Replay sync: store → engine ───────────────────────────────────────────

watch(() => props.asset.data.mode, async (v) => {
  if (local.mode === v) return
  local.mode = v
  destroyEngine()
  await mountEngine()
})

watch(() => props.asset.data.func, (v) => {
  if (!engine) return
  local.func = v
  engine.setOption('func', v)
})

watch(() => props.asset.data.sign, (v) => {
  if (!engine) return
  local.sign = v
  engine.setOption('sign', v)
})

watch(() => props.asset.data.value, (v) => {
  if (!engine) return
  local.value = v
  engine.setOption('value', v)
})

watch(() => props.asset.data.showInfo, (v) => {
  if (!engine) return
  local.showInfo = v
  if (local.mode === 'equation') {
    engine.setOption('showFormula', v)
  } else {
    engine.setOption('showInterval', v)
  }
})
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────────
   ROOT — pointer-events:none is critical:
   the Konva proxy rect below catches drag/select events.
   Children override to auto only where user interaction is needed.
───────────────────────────────────────────────────────────────────────── */
.trig-solver {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fffaf0;
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* ── Header ── */
.trig-slv-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #fff7ed;
  border-bottom: 1px solid rgba(196, 98, 42, 0.2);
  min-height: 28px;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-slv-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  user-select: none;
}

.trig-slv-delete {
  width: 20px; height: 20px;
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
.trig-slv-delete:hover { background: #fee2e2; }

/* ── Stage ── */
.trig-slv-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}
.trig-slv-stage canvas { display: block; width: 100%; height: 100%; }

/* CRITICAL: readonly / pen-mode → canvas must NOT capture events
   (matches TrigCircleRenderer pattern — without this, drag/select breaks). */
.trig-solver.is-readonly .trig-slv-stage {
  pointer-events: none;
}

/* ── Toolbar ── */
.trig-slv-toolbar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 6px;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-slv-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
}

.trig-slv-group-label {
  font-size: 10px;
  color: #94a3b8;
  user-select: none;
  white-space: nowrap;
}

.trig-slv-sep {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
  flex-shrink: 0;
  margin: 0 2px;
}

.trig-slv-btn {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  user-select: none;
}
.trig-slv-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
.trig-slv-btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fff;
}

/* Mode buttons get rounded pill style */
.trig-slv-btn--mode {
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  padding: 2px 6px;
  border-radius: 5px;
}

/* Sign buttons */
.trig-slv-btn--sign {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  min-width: 22px;
  padding: 2px 5px;
}
.trig-slv-btn--sign.is-active {
  background: #3a8a4f;
  border-color: #3a8a4f;
}

/* Preset buttons */
.trig-slv-btn--preset {
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 5px;
  font-size: 9.5px;
}

.trig-slv-slider {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
  height: 4px;
  accent-color: #c4622a;
  cursor: pointer;
  pointer-events: auto;
}

.trig-slv-input {
  width: 52px;
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #1e293b;
  background: #fff;
  text-align: center;
}
.trig-slv-input:focus { outline: none; border-color: #c4622a; }

/* ── Read-only (pen/eraser mode) — hide controls ── */
.trig-solver.is-readonly .trig-slv-header,
.trig-solver.is-readonly .trig-slv-toolbar {
  display: none;
}

/* ── Selection ring ── */
.trig-solver.is-selected .trig-slv-stage {
  box-shadow: inset 0 0 0 2px rgba(196, 98, 42, 0.3);
}
</style>
