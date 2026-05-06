<!--
  Phase G — GraphCalculatorRenderer.vue

  Interactive graph_calculator asset renderer.

  HARD RULES (per OPS_SYNC_SSOT.md INV-21 + FE-RULE 1-12):
    - Engine = dumb renderer; store = SSoT (FE-RULE-1)
    - setState idempotent + full replace + suppress events (FE-RULE-2/6)
    - Cheap stable signature for skip (FE-RULE-7)
    - Version gate: skip applies if incomingSeq < lastAppliedSeq (FE-RULE-8)
    - UUIDs assigned by store / this wrapper, never by engine (FE-RULE-3)
    - onChange ignored під час setState (FE-RULE-4) via isApplyingExternalState
    - asset_update = debounce 150ms; graph_param_set = throttle 33ms (FE-RULE-5)
    - Param emits raw value, no read-back (FE-RULE-9)
    - Unmount = flush + destroy (FE-RULE-10)
    - Pan/zoom snapshot ТІЛЬКИ on pointerup/wheel-end (FE-RULE-11)
    - Initial mount має isApplyingExternalState=true (FE-RULE-12)
    - Animation у replay disabled (inv-21.13) via opts.disableAnimation
-->

<template>
  <div
    class="graph-calc-renderer"
    :class="{ 'is-readonly': !interactive, 'is-selected': isSelected }"
  >
    <!-- Phase G3 v1 review: floating label під час drag-param (dp_inv_3:
         param value MUST be visible during drag). -->
    <div
      v-if="activeDragParam"
      class="gc-drag-param-label"
      data-testid="graph-calc-drag-param-label"
    >
      <span class="gc-drag-param-icon">↕</span>
      <span class="gc-drag-param-text">{{ activeDragParam.name }} = {{ activeDragParam.value.toFixed(2) }}</span>
    </div>

    <header class="gc-header">
      <span class="gc-title">f(x)</span>
      <button
        v-if="interactive && !asset.locked"
        type="button"
        class="gc-delete"
        title="Delete"
        data-testid="graph-calc-delete"
        @click="$emit('delete', asset.id)"
      >×</button>
    </header>

    <div class="gc-body">
      <aside class="gc-panel" v-if="interactive">
        <div class="gc-expr-list">
          <div
            v-for="(expr, idx) in displayExpressions"
            :key="expr.id"
            class="gc-expr"
            :class="{ 'is-param': expr.isParam }"
          >
            <span
              class="gc-swatch"
              :style="{ background: expr.color, opacity: expr.hidden ? 0.3 : 1 }"
              title="Приховати / показати"
              @click.left.stop="onToggleHidden(expr.id)"
              @contextmenu.prevent
            />
            <input
              type="text"
              class="gc-input"
              :value="expr.src"
              :placeholder="idx === 0 ? 'y = x^2' : ''"
              @input="onSrcInput(expr.id, ($event.target as HTMLInputElement).value)"
              @blur="onExpressionCommit(expr.id)"
              @keydown.enter.prevent="onExpressionCommit(expr.id)"
              @keydown.stop
              @keypress.stop
              @keyup.stop
            />
            <!-- Phase G: inline slider removed; sliders rendered ТІЛЬКИ у
                 окремій gc-params section (single source per state.params). -->

            <button
              type="button"
              class="gc-row-del"
              title="Видалити"
              @click="onRemoveExpression(expr.id)"
            >−</button>
            <!-- Phase G2 review #3: hint для ambiguous multi-letter tokens.
                 Click → rewrite expression. NO auto-rewrite. -->
            <div
              v-if="expressionHints[expr.id]?.length"
              class="gc-hint-row"
            >
              <template v-for="h in expressionHints[expr.id]" :key="h.token">
                <button
                  type="button"
                  class="gc-hint-btn"
                  :title="`Замінити «${h.token}» на «${h.suggestion}»`"
                  @click.stop="applyHint(expr.id, h)"
                >
                  {{ h.token }} → {{ h.suggestion }}
                </button>
              </template>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="gc-add-btn"
          data-testid="graph-calc-add-expr"
          @click="onAddExpression"
        >+ add</button>

        <!-- Phase G2: interactive points. List + add button. Drag mechanism — engine canvas. -->
        <div v-if="pointEntries.length > 0 || canAddPoints" class="gc-points">
          <div class="gc-points-header">Точки</div>
          <div
            v-for="p in pointEntries"
            :key="p.id"
            class="gc-point-row"
          >
            <span class="gc-point-mark" :class="{ 'is-on-curve': p.mode === 'onCurve' }" />
            <span class="gc-point-coords">({{ p.x.toFixed(2) }}, {{ p.y.toFixed(2) }})</span>
            <button
              type="button"
              class="gc-point-del"
              title="Видалити точку"
              @click.stop="onDeletePoint(p.id)"
            >−</button>
          </div>
          <button
            type="button"
            class="gc-add-btn"
            data-testid="graph-calc-add-point"
            @click="onAddPointAtCenter"
          >+ point</button>
        </div>

        <!-- Phase G: auto-detected param sliders. Renders from store state.params
             (SSoT per FE-RULE-1). Slider drag → emit('param-set', ...) per
             STORE-RULE-5 (coalesce per name). Click on name → expand row to
             reveal range editor (min/max/step). -->
        <div v-if="paramEntries.length > 0" class="gc-params" data-testid="graph-calc-params">
          <div class="gc-params-header">
            Параметри
            <span
              v-if="paramEntries.length === 1"
              class="gc-params-hint"
              title="Shift+drag по графіку керує параметром"
            >Shift-drag</span>
            <span
              v-else
              class="gc-params-hint gc-params-hint--disabled"
              title="Drag-param доступний тільки для 1 параметра"
            >Shift-drag (1 param)</span>
          </div>
          <div
            v-for="p in paramEntries"
            :key="p.name"
            class="gc-param-row"
            :class="{ 'is-expanded': !!paramExpanded[p.name] }"
          >
            <button
              type="button"
              class="gc-param-name"
              :title="paramExpanded[p.name] ? 'Згорнути' : 'Налаштувати діапазон'"
              @click.stop="toggleParamExpand(p.name)"
            >{{ p.name }} =</button>
            <input
              type="range"
              class="gc-slider"
              :min="p.min"
              :max="p.max"
              :step="p.step"
              :value="p.value"
              @input="onSliderInput(p.name, ($event.target as HTMLInputElement).valueAsNumber)"
              @pointerup="flushParam()"
              @keydown.stop
              @keypress.stop
              @keyup.stop
            />
            <span class="gc-param-value">{{ p.value.toFixed(2) }}</span>

            <div v-if="paramExpanded[p.name]" class="gc-range-editor">
              <label class="gc-range-field">
                <span>min</span>
                <input
                  type="number"
                  class="gc-range-input"
                  :value="p.min"
                  step="any"
                  @change="onRangeMinChange(p.name, ($event.target as HTMLInputElement).value)"
                  @keydown.stop
                  @keypress.stop
                  @keyup.stop
                />
              </label>
              <label class="gc-range-field">
                <span>max</span>
                <input
                  type="number"
                  class="gc-range-input"
                  :value="p.max"
                  step="any"
                  @change="onRangeMaxChange(p.name, ($event.target as HTMLInputElement).value)"
                  @keydown.stop
                  @keypress.stop
                  @keyup.stop
                />
              </label>
              <label class="gc-range-field">
                <span>step</span>
                <input
                  type="number"
                  class="gc-range-input"
                  :value="p.step"
                  step="any"
                  min="0"
                  @change="onRangeStepChange(p.name, ($event.target as HTMLInputElement).value)"
                  @keydown.stop
                  @keypress.stop
                  @keyup.stop
                />
              </label>
            </div>
          </div>
        </div>
      </aside>

      <div ref="plotEl" class="gc-plot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GraphCalculator, GraphCalc } from '../../../vendor/graph_calculator/graph-calculator.js'
import type { WBAsset } from '../../../types/winterboard'
import type {
  GraphCalculatorState,
  GraphExpression,
} from '../../../types/graphCalculator'
import {
  GRAPH_THROTTLE_PARAM_MS,
  GRAPH_THROTTLE_SNAPSHOT_MS,
} from '../../../constants/graphCalculatorDefaults'
import {
  extractParamsFromAll,
  detectAmbiguousImplicitMultiply,
  type ImplicitMultiplyHint,
} from '../../../utils/graphCalculatorUtils'

interface Props {
  asset: WBAsset
  isSelected?: boolean
  /** Interactive mode (live edit). False = read-only (replay, students). */
  interactive?: boolean
  /** Disable internal animation rAF loop (set TRUE during replay per inv-21.13). */
  disableAnimation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  interactive: true,
  disableAnimation: false,
})

const emit = defineEmits<{
  /** Full snapshot — boardStore wires to asset_update via debounced wrap */
  (e: 'update:asset', asset: WBAsset): void
  /** High-frequency param delta — boardStore wires to graph_param_set */
  (e: 'param-set', name: string, value: number, baseSeq: number): void
  /**
   * Sync `state.params` to match union of params used across all expressions.
   * Renderer emits this on every expression commit / removal — store
   * adds missing, removes unused, fires single asset_update snapshot.
   * Per Phase G architectural rule: params = derived from expressions.
   */
  (e: 'param-sync', usedNames: string[]): void
  /**
   * User-driven slider range update — store does asset_update snapshot.
   */
  (e: 'range-set', name: string, range: { min: number; max: number; step: number }): void
  /** Phase G2: interactive points (drag-bound) */
  (e: 'point-add', id: string, x: number, y: number, mode: 'free' | 'onCurve', curveExprId?: string): void
  (e: 'point-set', id: string, x: number, y: number, baseSeq: number): void
  (e: 'point-delete', id: string): void
  /** Phase G3: snap-on-release auto-promote free → onCurve (mode change) */
  (e: 'point-promote', id: string, curveExprId: string): void
  /** Delete request */
  (e: 'delete', assetId: string): void
}>()

// ─── Refs / state ──────────────────────────────────────────────────────
const plotEl = ref<HTMLDivElement | null>(null)
let calc: InstanceType<typeof GraphCalculator> | null = null

/** FE-RULE-4 / FE-RULE-6: suppress onChange echoes during setState. */
let isApplyingExternalState = false

/** FE-RULE-8: version gate — monotonic seq from asset.data.meta.last_snapshot_seq. */
let lastAppliedSeq = 0

/** FE-RULE-7: cheap signature for skip identical applies. */
let lastAppliedSignature = ''

/** Pending debounce timer for snapshot emit. */
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
/** Pending throttle state for param emits. */
const paramThrottle = new Map<string, { lastEmitMs: number; pending?: number; timer?: ReturnType<typeof setTimeout> }>()

/** During pan/zoom drag — defer snapshot emits per FE-RULE-11. */
let isPointerActive = false

// ─── Display state (Vue reactive snapshot for UI only) ─────────────────
interface DisplayExpr extends GraphExpression {
  isParam: boolean
  paramName?: string
  paramValue?: number
}
const displayExpressions = ref<DisplayExpr[]>([])

/** Parameter sliders rendered from store state.params (SSoT per FE-RULE-1). */
const paramEntries = computed(() => {
  type ParamEntry = { value: number; min: number; max: number; step: number }
  const data = props.asset.data as { state?: { params?: Record<string, ParamEntry> } } | undefined
  const params = data?.state?.params || {}
  return Object.entries(params).map(([name, entry]) => {
    const e = entry as Partial<ParamEntry> | number
    // Defensive: handle legacy flat-number snapshots (old prod data) gracefully.
    if (typeof e === 'number') {
      return { name, value: Number.isFinite(e) ? e : 0, min: -10, max: 10, step: 0.1 }
    }
    return {
      name,
      value: Number.isFinite(e?.value) ? (e!.value as number) : 0,
      min: Number.isFinite(e?.min) ? (e!.min as number) : -10,
      max: Number.isFinite(e?.max) ? (e!.max as number) : 10,
      step: Number.isFinite(e?.step) && (e!.step as number) > 0 ? (e!.step as number) : 0.1,
    }
  })
})

/** Per-param expand state (collapsed by default; click name → reveal range editor). */
const paramExpanded = ref<Record<string, boolean>>({})

/** Phase G3 v1 review (dp_inv_3): floating label state during drag-param. */
const activeDragParam = ref<{ name: string; value: number } | null>(null)

/**
 * Phase G review #3 (2026-05-06): per-expression UX hints for ambiguous
 * multi-letter identifiers (e.g. `2ax` → suggest `2*a*x`). Pure render —
 * no auto-rewrite of user input. Click hint → optional `applyHint` callback.
 */
const expressionHints = computed<Record<string, ImplicitMultiplyHint[]>>(() => {
  const out: Record<string, ImplicitMultiplyHint[]> = {}
  const knownParams = paramEntries.value.map((p) => p.name)
  for (const e of displayExpressions.value) {
    if (!e.src) continue
    const hints = detectAmbiguousImplicitMultiply(e.src, knownParams)
    if (hints.length > 0) out[e.id] = hints
  }
  return out
})

function applyHint(exprId: string, hint: ImplicitMultiplyHint) {
  if (!calc || !props.interactive) return
  const expr = displayExpressions.value.find((e) => e.id === exprId)
  if (!expr) return
  // Replace hint token with suggestion. Word-boundary to avoid partial match.
  const re = new RegExp(`\\b${hint.token}\\b`, 'g')
  const newSrc = expr.src.replace(re, hint.suggestion)
  if (newSrc === expr.src) return
  calc.updateExpression(exprId, newSrc)
  // Trigger sync after rewrite (snapshot debounce + param-sync)
  scheduleSyncParams()
}

function toggleParamExpand(name: string) {
  paramExpanded.value = { ...paramExpanded.value, [name]: !paramExpanded.value[name] }
}

function onRangeMinChange(name: string, raw: string) {
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return
  const cur = paramEntries.value.find((p) => p.name === name)
  if (!cur) return
  if (v >= cur.max) return
  emit('range-set', name, { min: v, max: cur.max, step: cur.step })
}

function onRangeMaxChange(name: string, raw: string) {
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return
  const cur = paramEntries.value.find((p) => p.name === name)
  if (!cur) return
  if (v <= cur.min) return
  emit('range-set', name, { min: cur.min, max: v, step: cur.step })
}

function onRangeStepChange(name: string, raw: string) {
  const v = parseFloat(raw)
  if (!Number.isFinite(v) || v <= 0) return
  const cur = paramEntries.value.find((p) => p.name === name)
  if (!cur) return
  emit('range-set', name, { min: cur.min, max: cur.max, step: v })
}

// Note: outer overlay у WBCanvas already positions та sizes
// (.wb-graph-calculator-overlay style: left/top/width/height per asset
// + zoom). Inner renderer fills 100% of outer; NO own position style —
// інакше double-positioning robить HTML overlay зміщеним від Konva proxy.

// Note: tooltips використовують inline UA strings; full i18n integration —
// окремий PR. У цьому компоненті НЕ потрібен t() — pure tooltip strings.

// ─── Helpers: signature & snapshot building ────────────────────────────

function snapshotSignature(s: GraphCalculatorState): string {
  // FE-RULE-7: cheap stable signature (length + ids/src/color/hidden + sorted params + viewport tuple)
  const exprPart = s.expressions
    .map((e) => `${e.id}:${e.src}:${e.color}:${e.hidden ? 1 : 0}`)
    .join('|')
  const paramKeys = Object.keys(s.params).sort()
  const paramPart = paramKeys.map((k) => `${k}=${s.params[k]}`).join(',')
  const vpPart = `${s.viewport.cx},${s.viewport.cy},${s.viewport.scale}`
  return `${s.expressions.length}#${exprPart}#${paramPart}#${vpPart}`
}

function buildSnapshotAsset(): WBAsset {
  // FE-RULE-9: NO read-back of partial fields — full engine.getState() snapshot.
  // FE-RULE-1: store wins; engine snapshot used only as new state delta.
  if (!calc) return props.asset
  const liveState = calc.getState() as GraphCalculatorState
  const prevData = (props.asset.data || {}) as { meta?: { last_snapshot_seq?: number } }
  return {
    ...props.asset,
    // Replace data.state but preserve data.meta (BE-managed, ours not to touch)
    data: {
      version: 1 as const,
      state: liveState,
      ...(prevData.meta ? { meta: prevData.meta } : {}),
    },
  }
}

// ─── Snapshot debounce + flush (FE-RULE-5, FE-RULE-10, FE-RULE-11) ────

function scheduleSnapshot() {
  if (!props.interactive) return
  if (isApplyingExternalState) return
  if (isPointerActive) return // FE-RULE-11: defer until pointer release
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!calc) return
    const asset = buildSnapshotAsset()
    // Update local signature so the inbound watch (echo) is suppressed.
    const sig = snapshotSignature(asset.data!.state as GraphCalculatorState)
    lastAppliedSignature = sig
    emit('update:asset', asset)
  }, GRAPH_THROTTLE_SNAPSHOT_MS)
}

/** FE-RULE-10: synchronously flush pending debounced snapshot (e.g. before unmount, blur). */
function flushSnapshot() {
  if (snapshotTimer != null) {
    clearTimeout(snapshotTimer)
    snapshotTimer = null
    if (!calc) return
    const asset = buildSnapshotAsset()
    lastAppliedSignature = snapshotSignature(asset.data!.state as GraphCalculatorState)
    emit('update:asset', asset)
  }
}

// ─── Param throttle ───────────────────────────────────────────────────

function emitParamSetThrottled(name: string, value: number) {
  if (!props.interactive) return
  if (isApplyingExternalState) return
  const now = performance.now()
  const baseSeq = lastAppliedSeq
  let entry = paramThrottle.get(name)
  if (!entry) {
    entry = { lastEmitMs: 0 }
    paramThrottle.set(name, entry)
  }
  const elapsed = now - entry.lastEmitMs
  if (elapsed >= GRAPH_THROTTLE_PARAM_MS) {
    entry.lastEmitMs = now
    entry.pending = undefined
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = undefined
    }
    emit('param-set', name, value, baseSeq)
  } else {
    // Coalesce trailing — last value wins.
    entry.pending = value
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (entry!.pending !== undefined) {
        const v = entry!.pending
        entry!.lastEmitMs = performance.now()
        entry!.pending = undefined
        entry!.timer = undefined
        emit('param-set', name, v, baseSeq)
      }
    }, GRAPH_THROTTLE_PARAM_MS - elapsed)
  }
}

function flushParam() {
  // pointerup on slider — emit pending value immediately
  for (const [name, entry] of paramThrottle.entries()) {
    if (entry.pending !== undefined) {
      const v = entry.pending
      entry.pending = undefined
      entry.lastEmitMs = performance.now()
      if (entry.timer) {
        clearTimeout(entry.timer)
        entry.timer = undefined
      }
      emit('param-set', name, v, lastAppliedSeq)
    }
  }
}

// Phase G2: per-point throttle (analog paramThrottle), key=pointId
const pointThrottle = new Map<string, {
  lastEmitMs: number
  pending?: { x: number; y?: number }
  timer?: ReturnType<typeof setTimeout>
}>()

function emitPointSetThrottled(id: string, x: number, y: number | undefined) {
  if (!props.interactive) return
  const now = performance.now()
  const baseSeq = lastAppliedSeq
  let entry = pointThrottle.get(id)
  if (!entry) { entry = { lastEmitMs: 0 }; pointThrottle.set(id, entry) }
  const elapsed = now - entry.lastEmitMs
  if (elapsed >= GRAPH_THROTTLE_PARAM_MS) {
    entry.lastEmitMs = now
    entry.pending = undefined
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined }
    emit('point-set', id, x, y === undefined ? Number.NaN : y, baseSeq)
  } else {
    entry.pending = { x, y }
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (entry!.pending) {
        const { x: px, y: py } = entry!.pending
        entry!.lastEmitMs = performance.now()
        entry!.pending = undefined
        entry!.timer = undefined
        emit('point-set', id, px, py === undefined ? Number.NaN : py, baseSeq)
      }
    }, GRAPH_THROTTLE_PARAM_MS - elapsed)
  }
}

function flushPointSet(id: string, x: number, y: number | undefined) {
  const entry = pointThrottle.get(id)
  if (entry?.timer) { clearTimeout(entry.timer); entry.timer = undefined }
  if (entry) { entry.pending = undefined; entry.lastEmitMs = performance.now() }
  emit('point-set', id, x, y === undefined ? Number.NaN : y, lastAppliedSeq)
}

/** Phase G2 onCurve mode: evaluate Y given X для expression with id=curveExprId.
 *  Returns null if not an explicitY function or evaluation fails. */
function computeYFromCurve(curveExprId: string, x: number): number | null {
  if (!calc) return null
  const expr = (calc as any).expressions?.find((e: any) => e.id === curveExprId)
  if (!expr || !expr.classified || expr.classified.kind !== 'explicitY') return null
  try {
    const env: any = {}
    const params = (calc as any).params || {}
    for (const k of Object.keys(params)) {
      const p = params[k]
      env[k] = (p && typeof p === 'object' && Number.isFinite(p.value)) ? p.value : (typeof p === 'number' ? p : 0)
    }
    env.x = x
    const y = (GraphCalc as any).evalAst(expr.classified.ast, env)
    return Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

// ─── Apply external state (FE-RULE-2/6/8/12) ───────────────────────────

function applyExternalState(state: GraphCalculatorState, seq: number) {
  if (!calc) return
  // FE-RULE-8: version gate — older snapshot must NOT roll back local view.
  if (seq > 0 && seq < lastAppliedSeq) return
  // FE-RULE-7: skip identical apply.
  const sig = snapshotSignature(state)
  if (sig === lastAppliedSignature) return
  // FE-RULE-6 / FE-RULE-12: suppress echo during setState (initial mount + watch).
  isApplyingExternalState = true
  try {
    calc.setState(state)
  } finally {
    isApplyingExternalState = false
  }
  lastAppliedSeq = seq || lastAppliedSeq
  lastAppliedSignature = sig
  refreshDisplayExpressions()
}

// Derive Vue-side display data from engine state (read-only — for UI binding).
function refreshDisplayExpressions() {
  if (!calc) return
  const exprs = (calc.expressions as Array<any>) || []
  const params = (calc.params as Record<string, number>) || {}
  displayExpressions.value = exprs.map((e) => {
    const isParam = e.classified?.kind === 'param'
    const paramName: string | undefined = isParam ? e.classified.name : undefined
    return {
      id: e.id,
      src: e.src,
      color: e.color,
      hidden: !!e.hidden,
      paramRange: e.paramRange ? { ...e.paramRange } : undefined,
      isParam,
      paramName,
      paramValue: paramName ? params[paramName] : undefined,
    }
  })
}

// ─── Engine mounting / patching ────────────────────────────────────────

function mountEngine() {
  if (!plotEl.value) return
  // FE-RULE-12: initial mount race — set flag BEFORE creating engine
  // (constructor does not call onChange itself, but defensive against future changes).
  isApplyingExternalState = true
  try {
    calc = new GraphCalculator(plotEl.value, {
      disableAnimation: props.disableAnimation,
    })
  } finally {
    isApplyingExternalState = false
  }

  // FE-RULE-6: install onChange via property guard so card.js (or any other
  // future code) cannot overwrite our wrapper. Internal vendor мутації
  // (наприклад _kickAnimLoop) тригерять calc.onChange — наш wrapper.
  let userOnChange: (() => void) | null = null
  Object.defineProperty(calc, 'onChange', {
    configurable: false,
    get: () => onChangeWrapper,
    set: (fn: (() => void) | null) => { userOnChange = fn },
  })

  function onChangeWrapper() {
    // Refresh UI list (cheap; reads engine state for binding).
    refreshDisplayExpressions()
    if (userOnChange) {
      try { userOnChange() } catch (_) {}
    }
    if (isApplyingExternalState) return // FE-RULE-4 / FE-RULE-6
    scheduleSnapshot()
  }

  // FE-RULE-9: intercept setParamValue для emit param-set throttled.
  // Vendor's _kickAnimLoop проходить через setParamValue (Phase G patch),
  // тож animation теж генерує param-set ops.
  const origSetParam = calc.setParamValue.bind(calc)
  calc.setParamValue = (name: string, value: number) => {
    origSetParam(name, value)
    if (!isApplyingExternalState) {
      emitParamSetThrottled(name, value)
    }
  }

  // Phase G2 review #4 (2026-05-06): drag callback EMITS only — engine NEVER
  // mutates points у onDrag. Engine.points = render cache, updated через
  // setState (props watch) when store mutation propagates. SSoT = store.
  // For free mode: emit (x, y) — store mutates → props update → setState.
  // For onCurve mode: emit (x) only — y derived at render via curveExprId.
  ;(calc as any).onPointDrag = (id: string, mathX: number, mathY: number) => {
    if (!props.interactive) return
    if (isApplyingExternalState) return
    const pt = (calc as any).points?.[id]
    if (!pt) return
    if (pt.mode === 'onCurve') {
      // y omitted — derived from curveExprId at render time per review #4.
      emitPointSetThrottled(id, mathX, undefined)
      return
    }
    // Phase G3 (2026-05-06): snap-to-curve for free-mode points.
    // UX only — does NOT change point.mode, does NOT create ops.
    // If cursor is within 8px of a curve, emit snapped (x, y).
    const snap = (calc as any)._snapToCurve(mathX, mathY)
    if (snap && Number.isFinite(snap.x) && Number.isFinite(snap.y)) {
      emitPointSetThrottled(id, snap.x, snap.y)
    } else {
      emitPointSetThrottled(id, mathX, mathY)
    }
  }
  // Phase G3 v1 — drag-param (Shift+drag): emit graph_param_set throttled
  // через ту саму paramThrottle map (≤30 ops/sec per param).
  // Engine call this with already-clamped value (clamp inside engine using
  // param.min/max). Renderer mutates engine.params для immediate feedback
  // (engine.params is render cache, не SSoT).
  ;(calc as any).onParamDrag = (name: string, value: number) => {
    if (!props.interactive) return
    if (isApplyingExternalState) return
    if (!Number.isFinite(value)) return
    // Early exit якщо delta tiny (UX-INV avoid emit storm).
    const cur = (calc as any).params?.[name]
    const curValue = (cur && typeof cur === 'object' && Number.isFinite(cur.value))
      ? cur.value : (typeof cur === 'number' ? cur : NaN)
    if (Number.isFinite(curValue) && Math.abs(value - curValue) < 1e-4) return
    // Phase G3 v1.1 polish: visual LERP 0.2 (smooth feel). LERP applies ONLY
    // to engine.params[name].value (display) — emit goes RAW value (deterministic
    // replay). Inv: store and ops use unsmoothed; only screen pixels lerped.
    const LERP = 0.2
    const lerpedValue = Number.isFinite(curValue)
      ? curValue + (value - curValue) * LERP
      : value
    // Mutate engine (render cache) for immediate visual feedback (lerped).
    ;(calc as any).setParamValue(name, lerpedValue)
    // dp_inv_3: floating label показує lerped value (matches what user sees).
    activeDragParam.value = { name, value: lerpedValue }
    // Emit RAW target value — deterministic for replay.
    emitParamSetThrottled(name, value)
  }
  ;(calc as any).onParamDragEnd = (name: string | undefined) => {
    if (!name) return
    flushParam()
    // Hide floating label
    activeDragParam.value = null
  }

  ;(calc as any).onPointDragEnd = (id: string, mathX: number, mathY: number) => {
    if (!props.interactive) return
    if (isApplyingExternalState) return
    const pt = (calc as any).points?.[id]
    if (!pt) return
    if (pt.mode === 'onCurve') {
      flushPointSet(id, mathX, undefined)
      return
    }
    // Phase G3 review (2026-05-06): snap-on-release auto-promotes free →
    // onCurve so y stays derived (per HARD INV: "y always derived for snap").
    // Final flow:
    //   1. Flush throttled point_set with snapped (x, y) — broadcast complete.
    //   2. Emit point-promote → store does asset_update {mode:'onCurve',
    //      curveExprId, removes y}. Going forward, point follows curve через
    //      params changes.
    const snap = (calc as any)._snapToCurve(mathX, mathY)
    if (snap && Number.isFinite(snap.x) && Number.isFinite(snap.y)) {
      flushPointSet(id, snap.x, snap.y)
      // Phase G3 review: auto-promote ONLY якщо strong pull (≥0.5).
      // Прибирає false-positives від casual brushing near curve.
      if ((snap.strength ?? 0) >= 0.5) {
        emit('point-promote', id, snap.curveId)
      }
    } else {
      flushPointSet(id, mathX, mathY)
    }
  }

  // Track pointer-active windows (FE-RULE-11): skip snapshot during drag/zoom.
  if (plotEl.value) {
    plotEl.value.addEventListener('pointerdown', onPointerDown)
    plotEl.value.addEventListener('pointerup', onPointerUp)
    plotEl.value.addEventListener('pointercancel', onPointerUp)
    plotEl.value.addEventListener('wheel', onWheel, { passive: true })
  }

  // Initial state apply (cast: data union includes GraphCalculatorData when type='graph_calculator')
  const data = props.asset.data as { state?: GraphCalculatorState; meta?: { last_snapshot_seq?: number } } | undefined
  const state = data?.state
  const seq = data?.meta?.last_snapshot_seq ?? 0
  if (state) applyExternalState(state, seq)
}

let wheelTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown() {
  isPointerActive = true
}
function onPointerUp() {
  isPointerActive = false
  // After release — schedule one debounced snapshot for whatever moved.
  scheduleSnapshot()
}
function onWheel() {
  // Wheel "stable" debounce: defer snapshot until ~200ms quiet (per FE-RULE-11).
  isPointerActive = true
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    wheelTimer = null
    isPointerActive = false
    scheduleSnapshot()
  }, 200)
}

function unmountEngine() {
  if (plotEl.value) {
    plotEl.value.removeEventListener('pointerdown', onPointerDown)
    plotEl.value.removeEventListener('pointerup', onPointerUp)
    plotEl.value.removeEventListener('pointercancel', onPointerUp)
    plotEl.value.removeEventListener('wheel', onWheel)
  }
  if (wheelTimer) {
    clearTimeout(wheelTimer)
    wheelTimer = null
  }
  if (calc) {
    try { calc.destroy() } catch (_) {}
    calc = null
  }
}

// ─── User actions (panel) ──────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'expr-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function onAddExpression() {
  if (!calc || !props.interactive) return
  // FE-RULE-3: store/wrapper assigns id.
  const id = genId()
  // Flush pending snapshot before adding new expression so snapshot ordering
  // matches inv-21.11 (snapshot before any param_set on new expression).
  flushSnapshot()
  calc.addExpression('', id)
  // calc.onChange wrapper auto-fires snapshot debounce.
}

function onRemoveExpression(id: string) {
  if (!calc || !props.interactive) return
  calc.removeExpression(id)
  // params sync after removal — drop params that були used ONLY by removed expr.
  scheduleSyncParams()
}

function onSrcInput(id: string, src: string) {
  if (!calc || !props.interactive) return
  calc.updateExpression(id, src)
}

/**
 * Phase G refactored 2026-05-06: sync params on commit (blur / Enter) AND
 * on expression removal. Detection runs ON COMMIT, not on keystroke.
 *
 * Architecture rule: params = derived from expressions.
 *   - Commit triggers extraction of ALL params used across ALL expressions
 *   - Single emit('param-sync', usedNames) — store decides add/remove/no-op
 *   - No manual add/delete buttons for params — fully automatic
 */
function syncParamsFromAllExpressions() {
  if (!props.interactive) return
  // Flush pending snapshot first so latest src is in store before detection.
  flushSnapshot()
  const exprs = displayExpressions.value
  const sources = exprs.map((e) => e.src || '').filter((s) => s.length > 0)
  const usedNames = extractParamsFromAll(sources)
  // ANTI-FLICKER (Phase G review #3): null means parse-fail у at least one
  // expression — preserve current params (do NOT sync to []). Renderer skip emit.
  if (usedNames === null) return
  emit('param-sync', usedNames)
}

// Phase G review #3 (2026-05-06): debounce 50ms — досить щоб об'єднати
// каскад швидких blur (Tab Tab Tab по полях), але без помітного UX-лагу.
// Раніше було 250ms — користувач бачив відставання slider-а від blur.
let syncTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSyncParams() {
  if (!props.interactive) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncParamsFromAllExpressions()
  }, 50)
}
function flushSyncParams() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
    syncParamsFromAllExpressions()
  }
}

function onExpressionCommit(_id: string) {
  scheduleSyncParams()
}

function onToggleHidden(id: string) {
  if (!calc || !props.interactive) return
  const expr = displayExpressions.value.find((x) => x.id === id)
  if (!expr || expr.isParam) return
  calc.setHidden(id, !expr.hidden)
}

function onSliderInput(name: string, value: number) {
  if (!calc || !props.interactive) return
  // setParamValue → goes through our throttle interceptor.
  calc.setParamValue(name, value)
}

// Phase G2: points UI list + add/delete actions.
const canAddPoints = computed(() => props.interactive)
const pointEntries = computed(() => {
  const data = props.asset.data as { state?: { points?: Record<string, any> } } | undefined
  const pts = data?.state?.points || {}
  return Object.entries(pts).map(([id, p]) => {
    const pp = p as Partial<{ x: number; y: number; mode: 'free' | 'onCurve'; curveExprId: string }>
    return {
      id,
      x: Number.isFinite(pp.x) ? (pp.x as number) : 0,
      y: Number.isFinite(pp.y) ? (pp.y as number) : 0,
      mode: pp.mode === 'onCurve' ? 'onCurve' as const : 'free' as const,
      curveExprId: pp.curveExprId,
    }
  })
})

function onAddPointAtCenter() {
  if (!props.interactive || !calc) return
  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const vp = (calc as any).viewport || { cx: 0, cy: 0 }
  emit('point-add', id, vp.cx, vp.cy, 'free', undefined)
}

function onDeletePoint(id: string) {
  if (!props.interactive) return
  emit('point-delete', id)
}

// ─── Lifecycle ─────────────────────────────────────────────────────────

onMounted(() => {
  mountEngine()
  // Flush hooks (FE-RULE-10 partial — visibilitychange + beforeunload).
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
  // FE-RULE-10: order matters — flush BEFORE destroy.
  flushSyncParams()
  flushSnapshot()
  flushParam()
  unmountEngine()
})

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushSyncParams()
    flushSnapshot()
    flushParam()
  }
}
function onBeforeUnload() {
  flushSyncParams()
  flushSnapshot()
  flushParam()
}

// ─── Watchers ──────────────────────────────────────────────────────────

// FE-RULE-2/8: react to props.asset.data.state changes (incoming broadcast).
watch(
  () => {
    const d = props.asset.data as { state?: GraphCalculatorState; meta?: { last_snapshot_seq?: number } } | undefined
    return [d?.state, d?.meta?.last_snapshot_seq ?? 0] as const
  },
  ([state, seq]) => {
    if (!state) return
    applyExternalState(state, Number(seq) || 0)
  },
  { deep: true },
)

// React to disableAnimation toggle (e.g., entering replay mode).
watch(
  () => props.disableAnimation,
  (newVal) => {
    if (calc && (calc as any).opts) {
      ;(calc as any).opts.disableAnimation = !!newVal
    }
  },
)

// Expose imperative test hook (used by Vitest).
defineExpose({
  flushSnapshot,
  flushParam,
  flushSyncParams,
})
</script>

<style scoped>
.graph-calc-renderer {
  /* full size of overlay (set by parent via positionStyle) */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  border: 1px solid rgba(43, 33, 24, 0.15);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  user-select: none;
  /* Bug fix (2026-05-06): outer container НЕ перехоплює pointer events —
     Konva proxy внизу ловить drag/select. Тільки interactive children
     (header buttons, panel inputs, plot canvas) re-enable pointer-events:auto. */
  pointer-events: none;
}

.graph-calc-renderer.is-selected {
  outline: 2px solid #3b7b9b;
  outline-offset: 1px;
}

.graph-calc-renderer.is-readonly {
  pointer-events: none;
}

/* Re-enable pointer events for interactive parts (delete button, panel
   inputs, slider, plot canvas). Header itself stays passive (drag goes
   через Konva proxy). */
.gc-delete,
.gc-input,
.gc-slider,
.gc-row-del,
.gc-add-btn,
.gc-swatch,
.gc-plot {
  pointer-events: auto;
}

.gc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(43, 33, 24, 0.05);
  font-size: 12px;
  font-weight: 600;
  color: #2b2118;
}

.gc-delete {
  cursor: pointer;
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  color: #a83a5b;
  padding: 0 4px;
}

.gc-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.gc-panel {
  width: 200px;
  display: flex;
  flex-direction: column;
  padding: 6px;
  border-right: 1px solid rgba(43, 33, 24, 0.1);
  overflow-y: auto;
}

.gc-expr {
  display: grid;
  grid-template-columns: 14px 1fr auto 16px;
  gap: 4px;
  align-items: center;
  margin-bottom: 4px;
}

.gc-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.gc-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  border: 1px solid rgba(43, 33, 24, 0.2);
  border-radius: 3px;
  padding: 2px 4px;
  background: #fff;
  min-width: 0;
}

.gc-slider {
  grid-column: 2 / -1;
  width: 100%;
}

.gc-row-del {
  cursor: pointer;
  background: transparent;
  border: none;
  color: #a83a5b;
  font-size: 14px;
  line-height: 1;
}

/* Phase G3 v1: floating label under drag-param (dp_inv_3 visible feedback) */
.gc-drag-param-label {
  position: absolute;
  top: 26px;
  right: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #fffaf0;
  background: rgba(43, 33, 24, 0.85);
  padding: 4px 10px;
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.gc-drag-param-icon {
  font-size: 14px;
  color: #c4d3df;
  animation: gc-drag-pulse 1.2s ease-in-out infinite;
}
.gc-drag-param-text { white-space: nowrap; }
@keyframes gc-drag-pulse {
  0%, 100% { opacity: 0.5; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-1px); }
}

/* Phase G2 review #3: hint row for ambiguous tokens (2ax → 2*a*x) */
.gc-hint-row {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}
.gc-hint-btn {
  cursor: pointer;
  background: rgba(196, 98, 42, 0.08);
  border: 1px dashed rgba(196, 98, 42, 0.4);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #c4622a;
  pointer-events: auto;
}
.gc-hint-btn:hover {
  background: rgba(196, 98, 42, 0.18);
}

.gc-add-btn {
  margin-top: 4px;
  cursor: pointer;
  background: rgba(59, 123, 155, 0.1);
  border: 1px dashed rgba(59, 123, 155, 0.4);
  border-radius: 4px;
  padding: 4px;
  font-size: 12px;
  color: #3b7b9b;
}

.gc-plot {
  flex: 1;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
}

/* Phase G2 — interactive points */
.gc-points {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(43, 33, 24, 0.1);
}
.gc-points-header {
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.gc-point-row {
  display: grid;
  grid-template-columns: 12px 1fr 16px;
  gap: 4px;
  align-items: center;
  margin-bottom: 3px;
  font-size: 11px;
}
.gc-point-mark {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #c4622a;
  border: 1px solid #fffaf0;
}
.gc-point-mark.is-on-curve { background: #3b7b9b; }
.gc-point-coords {
  font-family: 'JetBrains Mono', monospace;
  color: #2b2118;
}
.gc-point-del {
  cursor: pointer;
  background: transparent;
  border: none;
  color: #a83a5b;
  font-size: 14px;
  line-height: 1;
}

/* Phase G — auto-param sliders */
.gc-params {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(43, 33, 24, 0.1);
}
.gc-params-header {
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
}
.gc-params-hint {
  font-size: 9px;
  font-weight: 500;
  color: #3b7b9b;
  text-transform: none;
  letter-spacing: 0;
  background: rgba(59, 123, 155, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  cursor: help;
}
.gc-params-hint--disabled {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}
.gc-param-row {
  display: grid;
  grid-template-columns: 32px 1fr 36px;
  gap: 4px;
  align-items: center;
  margin-bottom: 3px;
}
.gc-param-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #2b2118;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  pointer-events: auto;
  user-select: none;
}
.gc-param-name:hover {
  color: #3b7b9b;
  text-decoration: underline dotted;
}
.gc-param-row.is-expanded .gc-param-name {
  color: #3b7b9b;
  font-weight: 600;
}
.gc-param-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #5a4a3a;
  text-align: right;
}

.gc-range-editor {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 4px;
  padding: 4px;
  background: rgba(43, 33, 24, 0.04);
  border-radius: 4px;
}
.gc-range-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
  color: #5a4a3a;
}
.gc-range-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  width: 100%;
  padding: 1px 3px;
  border: 1px solid rgba(43, 33, 24, 0.2);
  border-radius: 3px;
  background: #fff;
  pointer-events: auto;
  box-sizing: border-box;
}
</style>
