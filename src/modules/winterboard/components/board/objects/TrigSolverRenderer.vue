<!--
  TrigSolverRenderer — trig_solver asset HTML overlay (§3.7.7).
  Unified elementary trig equations & inequalities.

  Mirror pattern: TrigCircleRenderer.vue — Konva proxy catches drag/select/resize,
  header has pointer-events:none so clicks fall through to the proxy.

  Engine: vendor/trig/trig-equations.js → window.TrigEquation.
  API: new TrigEquation(container, { type, rel, a, snapSpecial, showGraph, showAllSolutions })
  Methods: setType(t) · setRel(rel) · setA(a) · setOption(k, v) · destroy()

  POINTER-EVENTS MODEL:
    Root .trig-slv           = pointer-events:none → Konva proxy catches drag/select.
    .trig-slv-head           = pointer-events:none → also falls through to Konva proxy.
    .trig-slv-stage          = pointer-events:auto → engine canvas gets drag interaction.
    .trig-slv-stage.readonly = pointer-events:none → canvas doesn't swallow events.
    .trig-slv-tools          = pointer-events:auto → toolbar buttons/sliders work.
    is-readonly: header+toolbar hidden, stage pointer-events:none.
-->
<template>
  <div
    class="trig-slv"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-solver-${asset.id}`"
  >
    <!-- Header — pointer-events:none so clicks fall through to Konva proxy -->
    <header class="trig-slv-head">
      <span class="trig-slv-title">{{ typeLabel }}(x) {{ relLabel }} a</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-slv-delete"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <!-- Stage — engine renders circle + graph here -->
    <div ref="stageRef" class="trig-slv-stage" />

    <!-- Toolbar (hidden in readonly) -->
    <div class="trig-slv-tools">
      <!-- Function type -->
      <div class="trig-slv-group">
        <span class="trig-slv-label">f:</span>
        <button
          v-for="t in TYPE_OPTS"
          :key="t.v"
          type="button"
          class="trig-slv-btn"
          :class="{ 'is-active': local.type === t.v }"
          @click.stop="setType(t.v)"
          @mousedown.stop
          @pointerdown.stop
        >{{ t.lab }}</button>
      </div>

      <span class="trig-slv-sep" />

      <!-- Relation -->
      <div class="trig-slv-group">
        <span class="trig-slv-label">знак:</span>
        <button
          v-for="r in REL_OPTS"
          :key="r.v"
          type="button"
          class="trig-slv-btn"
          :class="{ 'is-active': local.rel === r.v }"
          @click.stop="setRel(r.v)"
          @mousedown.stop
          @pointerdown.stop
        >{{ r.lab }}</button>
      </div>

      <span class="trig-slv-sep" />

      <!-- Slider a -->
      <label class="trig-slv-slider">
        <span>a =</span>
        <input
          type="range"
          :min="aMin"
          :max="aMax"
          step="0.01"
          :value="local.a"
          @input="onSlider"
          @mousedown.stop
          @pointerdown.stop
        >
        <span class="trig-slv-slider-val">{{ roundedA }}</span>
      </label>

      <span class="trig-slv-sep" />

      <!-- Quick presets -->
      <div class="trig-slv-group trig-slv-presets">
        <button
          v-for="p in currentPresets"
          :key="p.label"
          type="button"
          class="trig-slv-btn trig-slv-btn--preset"
          @click.stop="setA(p.v)"
          @mousedown.stop
          @pointerdown.stop
        >{{ p.label }}</button>
      </div>

      <span class="trig-slv-sep" />

      <!-- Options -->
      <button
        type="button"
        class="trig-slv-btn"
        :class="{ 'is-active': local.snapSpecial }"
        title="Snap до табличних значень"
        @click.stop="toggleOpt('snapSpecial')"
        @mousedown.stop
        @pointerdown.stop
      >⊙ snap</button>

      <button
        type="button"
        class="trig-slv-btn"
        :class="{ 'is-active': local.showGraph }"
        title="Показати графік"
        @click.stop="toggleOpt('showGraph')"
        @mousedown.stop
        @pointerdown.stop
      >~ графік</button>

      <button
        type="button"
        class="trig-slv-btn"
        :class="{ 'is-active': local.showAllSolutions }"
        title="Показати всі розв'язки"
        @click.stop="toggleOpt('showAllSolutions')"
        @mousedown.stop
        @pointerdown.stop
      >∞ всі</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { TrigSolverAsset, TrigFuncType, TrigRelation } from '../../../types/trigSolver'
import type { TrigEquationInstance } from '../../../vendor/trig/index'

const props = defineProps<{
  asset: TrigSolverAsset
  isSelected: boolean
  interactive: boolean
}>()

const emit = defineEmits<{
  'update:asset': [asset: TrigSolverAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let engine: TrigEquationInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_MS = 300

// ── Local state mirror ────────────────────────────────────────────────────

type LocalState = {
  type: TrigFuncType
  rel: TrigRelation
  a: number
  snapSpecial: boolean
  showGraph: boolean
  showAllSolutions: boolean
}

const local = reactive<LocalState>({
  type:             props.asset.data.type,
  rel:              props.asset.data.rel,
  a:                props.asset.data.a,
  snapSpecial:      props.asset.data.snapSpecial,
  showGraph:        props.asset.data.showGraph,
  showAllSolutions: props.asset.data.showAllSolutions,
})

// ── Constants ─────────────────────────────────────────────────────────────

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
  { label: '−1',    v: -1 },
  { label: '−½',    v: -0.5 },
  { label: '0',     v: 0 },
  { label: '½',     v: 0.5 },
  { label: '√2/2',  v: Math.SQRT2 / 2 },
  { label: '√3/2',  v: Math.sqrt(3) / 2 },
  { label: '1',     v: 1 },
]
const TAN_COT_PRESETS = [
  { label: '−√3', v: -Math.sqrt(3) },
  { label: '−1',  v: -1 },
  { label: '0',   v: 0 },
  { label: '1',   v: 1 },
  { label: '√3',  v: Math.sqrt(3) },
]

const currentPresets = computed(() =>
  local.type === 'sin' || local.type === 'cos' ? SIN_COS_PRESETS : TAN_COT_PRESETS,
)

const aMin = computed(() => local.type === 'sin' || local.type === 'cos' ? -1 : -5)
const aMax = computed(() => local.type === 'sin' || local.type === 'cos' ?  1 :  5)

const roundedA = computed(() =>
  (Math.round(local.a * 100) / 100).toString().replace('.', ','),
)

const typeLabel = computed(() => TYPE_OPTS.find(o => o.v === local.type)?.lab ?? local.type)
const relLabel  = computed(() => REL_OPTS.find(o => o.v === local.rel)?.lab  ?? local.rel)

// ── Engine lifecycle ──────────────────────────────────────────────────────

type TrigWindow = Window & {
  TrigEquation: new (el: HTMLElement, opts: Record<string, unknown>) => TrigEquationInstance
}

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

function destroyEngine(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (engine) { try { engine.destroy() } catch { /* idempotent */ }; engine = null }
}

async function mountEngine(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value || engine) return
  const W = window as unknown as TrigWindow
  engine = new W.TrigEquation(stageRef.value, {
    type:             local.type,
    rel:              local.rel,
    a:                local.a,
    snapSpecial:      local.snapSpecial,
    showGraph:        local.showGraph,
    showAllSolutions: local.showAllSolutions,
  })
  engine.onChange = () => scheduleSnapshot()
}

onMounted(() => { void mountEngine() })
onUnmounted(() => { destroyEngine() })

// Remount on card resize so canvas pixel buffer refreshes at correct size
watch([() => props.asset.w, () => props.asset.h], async () => {
  destroyEngine()
  await nextTick()
  await mountEngine()
})

// ── Persistence ───────────────────────────────────────────────────────────

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!engine) return
    // Read from engine.opts (source of truth), NOT from `local`.
    // When the user drags the value line directly on the canvas, the engine
    // updates opts.a internally and fires onChange — but local.a is still
    // the old value (only toolbar handlers call setA → local.a = ...).
    // Reading local here would record the stale value into the op, making
    // the replay replay the wrong position.
    const o = engine.opts
    // Keep local mirror in sync so subsequent toolbar reads are accurate.
    local.a = o.a as number
    emit('update:asset', {
      ...props.asset,
      data: {
        version:          1,
        type:             o.type as TrigFuncType,
        rel:              o.rel as TrigRelation,
        a:                o.a as number,
        snapSpecial:      o.snapSpecial as boolean,
        showGraph:        o.showGraph as boolean,
        showAllSolutions: o.showAllSolutions as boolean,
      },
    })
  }, SNAPSHOT_MS)
}

// ── Toolbar handlers ──────────────────────────────────────────────────────

function setType(t: TrigFuncType): void {
  if (!engine) return
  local.type = t
  engine.setType(t)
  local.a = engine.opts.a  // engine clamps to new range
  scheduleSnapshot()
}

function setRel(r: TrigRelation): void {
  if (!engine) return
  local.rel = r
  engine.setRel(r)
  scheduleSnapshot()
}

function setA(v: number): void {
  local.a = v
  engine?.setA(v)
  scheduleSnapshot()
}

function onSlider(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) setA(v)
}

function toggleOpt(key: 'snapSpecial' | 'showGraph' | 'showAllSolutions'): void {
  if (!engine) return
  const next = !local[key]
  local[key] = next
  engine.setOption(key, next)
  scheduleSnapshot()
}

// ── Replay sync ────────────────────────────────────────────────────────────

const SYNC_KEYS: (keyof LocalState)[] = ['type', 'rel', 'a', 'snapSpecial', 'showGraph', 'showAllSolutions']

watch(
  () => SYNC_KEYS.map(k => (props.asset.data as unknown as Record<string, unknown>)[k]),
  () => {
    if (!engine) return
    const d = props.asset.data as unknown as Record<string, unknown>
    for (const k of SYNC_KEYS) {
      const v = d[k]
      if (v === undefined || (local as Record<string, unknown>)[k] === v) continue
      ;(local as Record<string, unknown>)[k] = v
      if (k === 'type')      engine.setType(v as TrigFuncType)
      else if (k === 'rel')  engine.setRel(v as TrigRelation)
      else if (k === 'a')    engine.setA(v as number)
      else                   engine.setOption(k, v)
    }
  },
)
</script>

<style scoped>
/* ── Root — pointer-events:none so Konva proxy below catches drag/select ── */
.trig-slv {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}

.trig-slv.is-readonly .trig-slv-head,
.trig-slv.is-readonly .trig-slv-tools {
  display: none;
}
.trig-slv.is-readonly .trig-slv-stage {
  pointer-events: none;
}

/* ── Header — pointer-events:none (inherited) → clicks fall through to Konva proxy ── */
.trig-slv-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(196, 98, 42, 0.08);
  border-bottom: 1px solid rgba(196, 98, 42, 0.18);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  user-select: none;
}

.trig-slv.is-selected .trig-slv-head {
  background: rgba(196, 98, 42, 0.16);
}

.trig-slv-title {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Stage — auto so canvas engine receives drag ── */
.trig-slv-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

/* HUD injected by engine inside the stage */
.trig-slv-stage :deep(.calc-hud) {
  position: absolute;
  top: 8px;
  left: 10px;
  pointer-events: none;
  z-index: 4;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(255, 250, 240, 0.90);
  border: 1px solid rgba(43, 33, 24, 0.12);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 11.5px;
  line-height: 1.55;
  color: #2b2118;
  backdrop-filter: blur(4px);
  max-width: 380px;
}
.trig-slv-stage :deep(.calc-hud .calc-line) {
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
.trig-slv-stage :deep(.calc-hud .calc-line span) {
  color: #8a7860;
  font-size: 10.5px;
  margin-right: 2px;
}
.trig-slv-stage :deep(.calc-hud .calc-line.key) {
  font-weight: 600;
  color: #2b2118;
  margin-top: 2px;
}
.trig-slv-stage :deep(.calc-hud .calc-line.key span) {
  color: #c4622a;
  font-weight: 600;
}
.trig-slv-stage :deep(.calc-hud .calc-line.sub) {
  font-size: 10px;
  color: #8a7860;
  font-style: italic;
}
.trig-slv-stage :deep(.calc-hud .calc-line.err) { color: #a83a5b; }

/* ── Toolbar ── */
.trig-slv-tools {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  padding: 5px 7px;
  background: rgba(196, 98, 42, 0.04);
  border-top: 1px solid rgba(196, 98, 42, 0.14);
  pointer-events: auto;
}

.trig-slv-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.trig-slv-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8a7860;
  margin-right: 2px;
  white-space: nowrap;
}

.trig-slv-sep {
  width: 1px;
  height: 16px;
  background: rgba(43, 33, 24, 0.15);
  margin: 0 2px;
  flex-shrink: 0;
}

.trig-slv-btn {
  font-size: 10.5px;
  line-height: 1;
  padding: 3px 7px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 4px;
  background: #fffaf0;
  color: #5a4a3a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
}
.trig-slv-btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}
.trig-slv-btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}
.trig-slv-btn--preset {
  padding: 3px 5px;
  font-size: 10px;
}

/* ── Slider ── */
.trig-slv-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 10px 'JetBrains Mono', monospace;
  color: #5a4a3a;
}
.trig-slv-slider input[type=range] {
  width: 80px;
  accent-color: #c4622a;
}
.trig-slv-slider-val {
  min-width: 28px;
  text-align: right;
  color: #c4622a;
  font-size: 10px;
}

/* ── Delete button ── */
.trig-slv-delete {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.78);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 50%;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.trig-slv-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
