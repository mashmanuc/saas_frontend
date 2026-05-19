<!--
  TrigSolverRenderer — trig_solver asset HTML overlay (§3.7.7).
  Unified elementary trig equations & inequalities card.

  Engine: vendor/trig/trig-equations.js → window.TrigEquation.
  API: new TrigEquation(container, { type, rel, a, snapSpecial, showGraph, showAllSolutions })
  Methods: setType(t) · setRel(rel) · setA(a) · setOption(k,v) · destroy()
  Event:   card.onChange — fires on each change (drag, setA, setRel, setType)

  POINTER-EVENTS MODEL:
    Root .trig-solver           = pointer-events:none  → outer wrapper handles drag/select.
    .teq-stage (interactive)    = pointer-events:auto  → engine canvas receives drag.
    .teq-stage.readonly         = pointer-events:none  → canvas doesn't swallow events.
    Toolbar                     = pointer-events:auto  → controls work only in select mode.

  PERSISTENCE:
    local state → engine → onChange → 300ms debounce → emit update:asset.
    Remote ops  → watch(props.asset.data.*) → engine.set* + local mirror.
-->
<template>
  <div
    class="trig-solver trig-eq-card"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-solver-${asset.id}`"
  >
    <!-- Header -->
    <div class="teq-head">
      <span class="teq-num">{{ relLabel }}</span>
      <h2 class="teq-title">Тригонометрія</h2>
      <span class="teq-formula">{{ typeLabel }}(x) {{ relLabel }} a</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-slv-delete"
        title="Видалити"
        @click.stop="emit('delete')"
        @pointerdown.stop
        @mousedown.stop
      >×</button>
    </div>

    <!-- Canvas stage — engine draws here -->
    <div
      ref="stageRef"
      class="teq-stage"
      :class="{ 'teq-stage--readonly': !interactive }"
    />

    <!-- Toolbar (hidden in readonly / pen mode) -->
    <div v-if="interactive" class="teq-tools">

      <!-- Function type -->
      <div class="teq-group">
        <span class="teq-group-label">f:</span>
        <div class="calc-segmented">
          <button
            v-for="t in TYPE_OPTS"
            :key="t.v"
            :class="{ active: local.type === t.v }"
            @click.stop="setType(t.v)"
            @pointerdown.stop
            @mousedown.stop
          >{{ t.lab }}</button>
        </div>
      </div>

      <!-- Relation (equation / inequality) -->
      <div class="teq-group">
        <span class="teq-group-label">знак:</span>
        <div class="calc-segmented">
          <button
            v-for="r in REL_OPTS"
            :key="r.v"
            :class="{ active: local.rel === r.v }"
            @click.stop="setRel(r.v)"
            @pointerdown.stop
            @mousedown.stop
          >{{ r.lab }}</button>
        </div>
      </div>

      <!-- Slider a -->
      <div class="calc-slider">
        <label>a =</label>
        <input
          type="range"
          :min="aMin"
          :max="aMax"
          step="0.01"
          :value="local.a"
          @input="onSlider"
          @pointerdown.stop
          @mousedown.stop
        >
        <span class="calc-slider-val">{{ roundedA }}</span>
      </div>

      <!-- Quick presets -->
      <div class="calc-presets">
        <button
          v-for="p in currentPresets"
          :key="p.label"
          class="calc-preset"
          @click.stop="setA(p.v)"
          @pointerdown.stop
          @mousedown.stop
        >{{ p.label }}</button>
      </div>

      <!-- Options row -->
      <div class="teq-opts-row">
        <button
          class="teq-opt-btn"
          :class="{ active: local.snapSpecial }"
          title="Прилипати до табличних значень"
          @click.stop="toggleSnap"
          @pointerdown.stop
          @mousedown.stop
        >⊙ snap</button>
        <button
          class="teq-opt-btn"
          :class="{ active: local.showGraph }"
          title="Показати графік"
          @click.stop="toggleGraph"
          @pointerdown.stop
          @mousedown.stop
        >~ графік</button>
        <button
          class="teq-opt-btn"
          :class="{ active: local.showAllSolutions }"
          title="Показати всі розв'язки"
          @click.stop="toggleAllSolutions"
          @pointerdown.stop
          @mousedown.stop
        >∞ всі</button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { TrigSolverAsset, TrigFuncType, TrigRelation } from '../../../types/trigSolver'
import type { TrigEquationInstance } from '../../../vendor/trig/index'

// CSS for the library card components (non-scoped, namespaced under .trig-eq-card)
import '../../../vendor/trig/trig-equations.css'

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
  type:            props.asset.data.type,
  rel:             props.asset.data.rel,
  a:               props.asset.data.a,
  snapSpecial:     props.asset.data.snapSpecial,
  showGraph:       props.asset.data.showGraph,
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
  { label: '−√3/2', v: -Math.sqrt(3) / 2 },
  { label: '−√2/2', v: -Math.SQRT2 / 2 },
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
  { label: '−√3/3', v: -1 / Math.sqrt(3) },
  { label: '0',   v: 0 },
  { label: '√3/3', v: 1 / Math.sqrt(3) },
  { label: '1',   v: 1 },
  { label: '√3',  v: Math.sqrt(3) },
]

const currentPresets = computed(() =>
  local.type === 'sin' || local.type === 'cos' ? SIN_COS_PRESETS : TAN_COT_PRESETS,
)

const aMin = computed(() => local.type === 'sin' || local.type === 'cos' ? -1 : -5)
const aMax = computed(() => local.type === 'sin' || local.type === 'cos' ?  1 :  5)

const roundedA = computed(() => {
  const r = Math.round(local.a * 100) / 100
  return r.toString().replace('.', ',')
})

const typeLabel = computed(() => {
  const t = TYPE_OPTS.find(o => o.v === local.type)
  return t ? t.lab : local.type
})

const relLabel = computed(() => {
  const r = REL_OPTS.find(o => o.v === local.rel)
  return r ? r.lab : local.rel
})

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
  engine = new W.TrigEquation(stageRef.value, {
    type:            local.type,
    rel:             local.rel,
    a:               local.a,
    snapSpecial:     local.snapSpecial,
    showGraph:       local.showGraph,
    showAllSolutions: local.showAllSolutions,
  })
  engine.onChange = () => scheduleSnapshot()
}

onMounted(() => { void mountEngine() })
onUnmounted(() => { destroyEngine() })

// Remount on resize so canvas pixel buffer is correct
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
    emitSnapshot()
  }, SNAPSHOT_MS)
}

function emitSnapshot(): void {
  emit('update:asset', {
    ...props.asset,
    data: {
      version: 1,
      type:            local.type,
      rel:             local.rel,
      a:               local.a,
      snapSpecial:     local.snapSpecial,
      showGraph:       local.showGraph,
      showAllSolutions: local.showAllSolutions,
    },
  })
}

// ── Toolbar handlers ──────────────────────────────────────────────────────

function setType(t: TrigFuncType): void {
  local.type = t
  engine?.setType(t)
  // sync slider a to clamped range after type switch
  const newA = engine?.opts.a ?? local.a
  local.a = newA
  scheduleSnapshot()
}

function setRel(r: TrigRelation): void {
  local.rel = r
  engine?.setRel(r)
  scheduleSnapshot()
}

function setA(v: number): void {
  local.a = v
  engine?.setA(v)
  scheduleSnapshot()
}

function onSlider(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  setA(v)
}

function toggleSnap(): void {
  local.snapSpecial = !local.snapSpecial
  engine?.setOption('snapSpecial', local.snapSpecial)
  scheduleSnapshot()
}

function toggleGraph(): void {
  local.showGraph = !local.showGraph
  engine?.setOption('showGraph', local.showGraph)
  scheduleSnapshot()
}

function toggleAllSolutions(): void {
  local.showAllSolutions = !local.showAllSolutions
  engine?.setOption('showAllSolutions', local.showAllSolutions)
  scheduleSnapshot()
}

// ── Replay sync: store → engine ───────────────────────────────────────────

watch(() => props.asset.data.type, (v) => {
  if (local.type === v || !engine) return
  local.type = v
  engine.setType(v)
})

watch(() => props.asset.data.rel, (v) => {
  if (local.rel === v || !engine) return
  local.rel = v
  engine.setRel(v)
})

watch(() => props.asset.data.a, (v) => {
  if (!engine) return
  local.a = v
  engine.setA(v)
})

watch(() => props.asset.data.snapSpecial, (v) => {
  if (!engine) return
  local.snapSpecial = v
  engine.setOption('snapSpecial', v)
})

watch(() => props.asset.data.showGraph, (v) => {
  if (!engine) return
  local.showGraph = v
  engine.setOption('showGraph', v)
})

watch(() => props.asset.data.showAllSolutions, (v) => {
  if (!engine) return
  local.showAllSolutions = v
  engine.setOption('showAllSolutions', v)
})
</script>

<style scoped>
/*
  Component-level overrides.
  Library base styles (.trig-eq-card, .teq-*, .calc-*) are in
  vendor/trig/trig-equations.css, imported globally in <script>.
*/

.trig-solver {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* pointer-events:none so the outer wrapper (WBCanvas) handles drag/select */
  pointer-events: none;
}

/* Stage fills remaining space (overrides aspect-ratio from library CSS) */
.trig-solver .teq-stage {
  flex: 1;
  min-height: 0;
  aspect-ratio: unset;
  /* engine canvas interactive by default */
  pointer-events: auto;
}

/* In readonly / pen mode: canvas must NOT capture events */
.trig-solver .teq-stage--readonly {
  pointer-events: none;
}

/* Toolbar needs pointer-events for buttons/inputs */
.trig-solver .teq-tools {
  pointer-events: auto;
  flex-shrink: 0;
}

/* Header needs pointer-events for delete button */
.trig-solver .teq-head {
  pointer-events: auto;
  flex-shrink: 0;
}

/* Delete button */
.trig-slv-delete {
  width: 22px;
  height: 22px;
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #dc2626;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-left: auto;
}
.trig-slv-delete:hover { background: #fee2e2; }

/* Options row (snap / graph / all solutions) */
.teq-opts-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.teq-opt-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 4px 8px;
  background: var(--teq-paper, #fffaf0);
  border: 1px solid var(--teq-line, rgba(43,33,24,0.14));
  border-radius: 6px;
  cursor: pointer;
  color: var(--teq-ink-3, #8a7860);
}
.teq-opt-btn.active {
  background: var(--teq-ink, #2b2118);
  color: var(--teq-paper, #fffaf0);
  border-color: var(--teq-ink, #2b2118);
}

/* Selection ring (matches amber accent) */
.trig-solver.is-selected .teq-head {
  background: linear-gradient(180deg, rgba(196,98,42,0.08), rgba(196,98,42,0.15));
}

/* Hide toolbar and header in readonly */
.trig-solver.is-readonly .teq-tools,
.trig-solver.is-readonly .trig-slv-delete {
  display: none;
}
</style>
