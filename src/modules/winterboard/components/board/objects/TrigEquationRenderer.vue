<!--
  TrigEquationRenderer — trig_equation asset HTML overlay.

  Bundle: vendor/trig/trig-solver.js → window.TrigEquation.

  POINTER-EVENTS MODEL:
    - Root .trig-eq-renderer  = pointer-events:none → Konva proxy catches drag/select.
    - Stage canvas             = pointer-events:auto (canvas is presentational only).
    - Toolbar                  = pointer-events:auto (controls visible when interactive).
    - is-readonly: header + toolbar hidden (pen/eraser mode — show only canvas).

  PERSISTENCE:
    local state → engine → onChange → 300ms debounce → emit asset_update.
    Remote ops  → watch(props.asset.data.*) → setOption + local mirror (replay sync).

  LOCAL STATE RATIONALE:
    toolbar buttons read `local` mirror to avoid 300ms delay between click and visible
    state update. See TrigCircleRenderer.vue for full explanation.
-->
<template>
  <div
    class="trig-eq-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-eq-renderer-${asset.id}`"
  >
    <header class="trig-eq-header">
      <span class="trig-eq-title">Тригонометричне рівняння</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-eq-delete"
        title="Видалити"
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <!-- Canvas stage — TrigEquation draws here. -->
    <div ref="stageRef" class="trig-eq-stage" />

    <!-- Toolbar -->
    <div class="trig-eq-toolbar">
      <!-- Row 1: function selector -->
      <div class="trig-eq-row">
        <span class="trig-eq-group-label">функція:</span>
        <button
          v-for="fn in FUNC_OPTS"
          :key="fn"
          type="button"
          class="trig-eq-btn"
          :class="{ 'is-active': local.func === fn }"
          @click.stop="setFunc(fn)"
          @mousedown.stop
          @pointerdown.stop
        >{{ fn }}</button>

        <span class="trig-sep" />

        <button
          type="button"
          class="trig-eq-btn"
          :class="{ 'is-active': local.showFormula }"
          @click.stop="toggleFormula()"
          @mousedown.stop
          @pointerdown.stop
        >формула</button>

        <button
          type="button"
          class="trig-eq-btn"
          :class="{ 'is-active': local.showAngles }"
          @click.stop="toggleAngles()"
          @mousedown.stop
          @pointerdown.stop
        >кути</button>
      </div>

      <!-- Row 2: value slider + input -->
      <div class="trig-eq-row">
        <span class="trig-eq-group-label">a =</span>
        <input
          type="range"
          class="trig-eq-slider"
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
          class="trig-eq-input"
          :min="sliderMin"
          :max="sliderMax"
          step="0.01"
          :value="roundedValue"
          @change="onInput"
          @mousedown.stop
          @pointerdown.stop
        />

        <!-- Special value presets -->
        <span class="trig-sep" />
        <span class="trig-eq-group-label">швидкий вибір:</span>
        <button
          v-for="p in specialPresets"
          :key="p.label"
          type="button"
          class="trig-eq-btn trig-eq-btn--preset"
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
import type { TrigEquationAsset } from '../../../types/trigEquation'
import type { TrigEquationInstance, TrigFunc } from '../../../vendor/trig'

const props = withDefaults(
  defineProps<{
    asset: TrigEquationAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: TrigEquationAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let engine: TrigEquationInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_MS = 300

// ── Local state mirror ────────────────────────────────────────────────────

type LocalState = {
  func: TrigFunc
  value: number
  showFormula: boolean
  showAngles: boolean
}

const local = reactive<LocalState>({
  func:        props.asset.data.func        as TrigFunc,
  value:       props.asset.data.value,
  showFormula: props.asset.data.showFormula,
  showAngles:  props.asset.data.showAngles,
})

// ── Toolbar metadata ──────────────────────────────────────────────────────

const FUNC_OPTS: TrigFunc[] = ['sin', 'cos', 'tan', 'cot']

// Special value presets — depend on current function
const specialPresets = computed(() => {
  const fn = local.func
  if (fn === 'sin' || fn === 'cos') {
    return [
      { label: '0',     v: 0     },
      { label: '½',     v: 0.5   },
      { label: '√2/2',  v: Math.SQRT2 / 2 },
      { label: '√3/2',  v: Math.sqrt(3) / 2 },
      { label: '1',     v: 1     },
      { label: '−½',    v: -0.5  },
      { label: '−1',    v: -1    },
    ]
  }
  // tan/cot: common integer/half-integer values
  return [
    { label: '0',   v: 0   },
    { label: '1',   v: 1   },
    { label: '√3',  v: Math.sqrt(3) },
    { label: '−1',  v: -1  },
    { label: '−√3', v: -Math.sqrt(3) },
  ]
})

const sliderMin = computed(() => (local.func === 'sin' || local.func === 'cos') ? -1 : -5)
const sliderMax = computed(() => (local.func === 'sin' || local.func === 'cos') ?  1 :  5)

const roundedValue = computed(() => Math.round(local.value * 100) / 100)

// ── Lifecycle ─────────────────────────────────────────────────────────────

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value || engine) return

  const W = window as unknown as { TrigEquation: new (
    el: HTMLElement,
    opts: import('../../../vendor/trig').TrigSolverOpts,
  ) => TrigEquationInstance }

  const d = props.asset.data
  engine = new W.TrigEquation(stageRef.value, {
    func:        d.func as TrigFunc,
    value:       d.value,
    showFormula: d.showFormula,
    showAngles:  d.showAngles,
  })
  engine.onChange = () => scheduleSnapshot()
}

function destroyEngine(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (engine) {
    try { engine.destroy() } catch { /* idempotent */ }
    engine = null
  }
}

onMounted(() => { void mount() })
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
  const updated: TrigEquationAsset = {
    ...props.asset,
    data: {
      version: 1,
      func:        local.func,
      value:       local.value,
      showFormula: local.showFormula,
      showAngles:  local.showAngles,
    },
  }
  emit('update:asset', updated)
}

// ── Toolbar handlers ──────────────────────────────────────────────────────

function setFunc(fn: TrigFunc): void {
  local.func = fn
  // Clamp value for sin/cos
  if (fn === 'sin' || fn === 'cos') {
    local.value = Math.max(-1, Math.min(1, local.value))
  }
  engine?.setOption('func', fn)
  engine?.setOption('value', local.value)
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

function toggleFormula(): void {
  local.showFormula = !local.showFormula
  engine?.setOption('showFormula', local.showFormula)
  scheduleSnapshot()
}

function toggleAngles(): void {
  local.showAngles = !local.showAngles
  engine?.setOption('showAngles', local.showAngles)
  scheduleSnapshot()
}

// ── Replay sync: store → engine ───────────────────────────────────────────

watch(() => props.asset.data.func, (v) => {
  if (!engine) return
  local.func = v as TrigFunc
  engine.setOption('func', v as TrigFunc)
})

watch(() => props.asset.data.value, (v) => {
  if (!engine) return
  local.value = v
  engine.setOption('value', v)
})

watch(() => props.asset.data.showFormula, (v) => {
  if (!engine) return
  local.showFormula = v
  engine.setOption('showFormula', v)
})

watch(() => props.asset.data.showAngles, (v) => {
  if (!engine) return
  local.showAngles = v
  engine.setOption('showAngles', v)
})
</script>

<style scoped>
.trig-eq-renderer {
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
.trig-eq-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #fff7ed;
  border-bottom: 1px solid rgba(196,98,42,0.2);
  min-height: 28px;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-eq-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  user-select: none;
}

.trig-eq-delete {
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
.trig-eq-delete:hover { background: #fee2e2; }

/* ── Stage ── */
.trig-eq-stage {
  flex: 1;
  min-height: 0;
  pointer-events: auto;
  position: relative;
}
.trig-eq-stage canvas { display: block; width: 100%; height: 100%; }

/* ── Toolbar ── */
.trig-eq-toolbar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 6px;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-eq-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
}

.trig-eq-group-label {
  font-size: 10px;
  color: #94a3b8;
  user-select: none;
  white-space: nowrap;
}

.trig-sep {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
  flex-shrink: 0;
  margin: 0 2px;
}

.trig-eq-btn {
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
.trig-eq-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
.trig-eq-btn.is-active {
  background: #a83a5b;
  border-color: #a83a5b;
  color: #fff;
}

.trig-eq-btn--preset {
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 5px;
  font-size: 9.5px;
}

.trig-eq-slider {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
  height: 4px;
  accent-color: #a83a5b;
  cursor: pointer;
  pointer-events: auto;
}

.trig-eq-input {
  width: 52px;
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #1e293b;
  background: #fff;
  text-align: center;
}
.trig-eq-input:focus { outline: none; border-color: #a83a5b; }

/* ── Read-only (pen/eraser mode) ── */
.trig-eq-renderer.is-readonly .trig-eq-header,
.trig-eq-renderer.is-readonly .trig-eq-toolbar {
  display: none;
}

/* ── Selection ring ── */
.trig-eq-renderer.is-selected .trig-eq-stage {
  box-shadow: inset 0 0 0 2px rgba(168, 58, 91, 0.3);
}
</style>
