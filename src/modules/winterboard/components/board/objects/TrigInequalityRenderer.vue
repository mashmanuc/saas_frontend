<!--
  TrigInequalityRenderer — trig_inequality asset HTML overlay.

  Bundle: vendor/trig/trig-solver.js → window.TrigInequality.
  Mirror pattern: TrigEquationRenderer.vue.

  POINTER-EVENTS MODEL: same as TrigEquationRenderer.
  is-readonly: header + toolbar hidden (pen/eraser mode).
-->
<template>
  <div
    class="trig-ineq-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-ineq-renderer-${asset.id}`"
  >
    <header class="trig-ineq-header">
      <span class="trig-ineq-title">Тригонометрична нерівність</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-ineq-delete"
        title="Видалити"
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <div ref="stageRef" class="trig-ineq-stage" />

    <div class="trig-ineq-toolbar">
      <!-- Row 1: function + sign + toggles -->
      <div class="trig-ineq-row">
        <span class="trig-ineq-group-label">функція:</span>
        <button
          v-for="fn in FUNC_OPTS"
          :key="fn"
          type="button"
          class="trig-ineq-btn"
          :class="{ 'is-active': local.func === fn }"
          @click.stop="setFunc(fn)"
          @mousedown.stop
          @pointerdown.stop
        >{{ fn }}</button>

        <span class="trig-sep" />

        <span class="trig-ineq-group-label">знак:</span>
        <button
          v-for="s in SIGN_OPTS"
          :key="s"
          type="button"
          class="trig-ineq-btn trig-ineq-btn--sign"
          :class="{ 'is-active': local.sign === s }"
          @click.stop="setSign(s)"
          @mousedown.stop
          @pointerdown.stop
        >{{ s }}</button>

        <span class="trig-sep" />

        <button
          type="button"
          class="trig-ineq-btn"
          :class="{ 'is-active': local.showInterval }"
          @click.stop="toggleInterval()"
          @mousedown.stop
          @pointerdown.stop
        >відповідь</button>
      </div>

      <!-- Row 2: value slider + input + presets -->
      <div class="trig-ineq-row">
        <span class="trig-ineq-group-label">a =</span>
        <input
          type="range"
          class="trig-ineq-slider"
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
          class="trig-ineq-input"
          :min="sliderMin"
          :max="sliderMax"
          step="0.01"
          :value="roundedValue"
          @change="onInput"
          @mousedown.stop
          @pointerdown.stop
        />

        <span class="trig-sep" />
        <span class="trig-ineq-group-label">швидкий вибір:</span>
        <button
          v-for="p in specialPresets"
          :key="p.label"
          type="button"
          class="trig-ineq-btn trig-ineq-btn--preset"
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
import type { TrigInequalityAsset } from '../../../types/trigInequality'
import type { TrigInequalityInstance, TrigFunc, IneqSign } from '../../../vendor/trig'

const props = withDefaults(
  defineProps<{
    asset: TrigInequalityAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: TrigInequalityAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let engine: TrigInequalityInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_MS = 300

type LocalState = {
  func: TrigFunc
  sign: IneqSign
  value: number
  showInterval: boolean
}

const local = reactive<LocalState>({
  func:         props.asset.data.func        as TrigFunc,
  sign:         props.asset.data.sign        as IneqSign,
  value:        props.asset.data.value,
  showInterval: props.asset.data.showInterval,
})

const FUNC_OPTS: TrigFunc[] = ['sin', 'cos', 'tan', 'cot']
const SIGN_OPTS: IneqSign[] = ['>', '<', '≥', '≤']

const specialPresets = computed(() => {
  const fn = local.func
  if (fn === 'sin' || fn === 'cos') {
    return [
      { label: '0',    v: 0 },
      { label: '½',    v: 0.5 },
      { label: '√2/2', v: Math.SQRT2 / 2 },
      { label: '√3/2', v: Math.sqrt(3) / 2 },
      { label: '−½',   v: -0.5 },
    ]
  }
  return [
    { label: '0',   v: 0   },
    { label: '1',   v: 1   },
    { label: '√3',  v: Math.sqrt(3) },
    { label: '−1',  v: -1  },
  ]
})

const sliderMin = computed(() => (local.func === 'sin' || local.func === 'cos') ? -1 : -5)
const sliderMax = computed(() => (local.func === 'sin' || local.func === 'cos') ?  1 :  5)
const roundedValue = computed(() => Math.round(local.value * 100) / 100)

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value || engine) return

  const W = window as unknown as { TrigInequality: new (
    el: HTMLElement,
    opts: import('../../../vendor/trig').TrigInequalityOpts,
  ) => TrigInequalityInstance }

  const d = props.asset.data
  engine = new W.TrigInequality(stageRef.value, {
    func:         d.func as TrigFunc,
    sign:         d.sign as IneqSign,
    value:        d.value,
    showInterval: d.showInterval,
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

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => { snapshotTimer = null; emitSnapshot() }, SNAPSHOT_MS)
}

function emitSnapshot(): void {
  emit('update:asset', {
    ...props.asset,
    data: {
      version: 1,
      func:         local.func,
      sign:         local.sign,
      value:        local.value,
      showInterval: local.showInterval,
    },
  })
}

function setFunc(fn: TrigFunc): void {
  local.func = fn
  if (fn === 'sin' || fn === 'cos') {
    local.value = Math.max(-1, Math.min(1, local.value))
  }
  engine?.setOption('func', fn)
  engine?.setOption('value', local.value)
  scheduleSnapshot()
}

function setSign(s: IneqSign): void {
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
  if (Number.isFinite(v)) setValue(v)
}

function onInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  const clamped = (local.func === 'sin' || local.func === 'cos')
    ? Math.max(-1, Math.min(1, v))
    : Math.max(-10, Math.min(10, v))
  setValue(clamped)
}

function toggleInterval(): void {
  local.showInterval = !local.showInterval
  engine?.setOption('showInterval', local.showInterval)
  scheduleSnapshot()
}

// ── Replay sync ───────────────────────────────────────────────────────────

watch(() => props.asset.data.func,         (v) => { if (!engine) return; local.func = v as TrigFunc; engine.setOption('func', v as TrigFunc) })
watch(() => props.asset.data.sign,         (v) => { if (!engine) return; local.sign = v as IneqSign; engine.setOption('sign', v as IneqSign) })
watch(() => props.asset.data.value,        (v) => { if (!engine) return; local.value = v;            engine.setOption('value', v) })
watch(() => props.asset.data.showInterval, (v) => { if (!engine) return; local.showInterval = v;     engine.setOption('showInterval', v) })
</script>

<style scoped>
.trig-ineq-renderer {
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

.trig-ineq-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f0fdf4;
  border-bottom: 1px solid rgba(58,138,79,0.25);
  min-height: 28px;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-ineq-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #166534;
  user-select: none;
}

.trig-ineq-delete {
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
.trig-ineq-delete:hover { background: #fee2e2; }

.trig-ineq-stage {
  flex: 1;
  min-height: 0;
  pointer-events: auto;
  position: relative;
}
.trig-ineq-stage canvas { display: block; width: 100%; height: 100%; }

.trig-ineq-toolbar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 6px;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  pointer-events: auto;
}

.trig-ineq-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
}

.trig-ineq-group-label {
  font-size: 10px;
  color: #94a3b8;
  user-select: none;
  white-space: nowrap;
}

.trig-sep {
  width: 1px; height: 14px;
  background: #e2e8f0;
  flex-shrink: 0;
  margin: 0 2px;
}

.trig-ineq-btn {
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
.trig-ineq-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
.trig-ineq-btn.is-active {
  background: #3a8a4f;
  border-color: #3a8a4f;
  color: #fff;
}

.trig-ineq-btn--sign {
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}

.trig-ineq-btn--preset {
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 5px;
  font-size: 9.5px;
}

.trig-ineq-slider {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
  height: 4px;
  accent-color: #3a8a4f;
  cursor: pointer;
  pointer-events: auto;
}

.trig-ineq-input {
  width: 52px;
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #1e293b;
  background: #fff;
  text-align: center;
}
.trig-ineq-input:focus { outline: none; border-color: #3a8a4f; }

/* ── Read-only ── */
.trig-ineq-renderer.is-readonly .trig-ineq-header,
.trig-ineq-renderer.is-readonly .trig-ineq-toolbar {
  display: none;
}

/* ── Selection ring ── */
.trig-ineq-renderer.is-selected .trig-ineq-stage {
  box-shadow: inset 0 0 0 2px rgba(58, 138, 79, 0.3);
}
</style>
