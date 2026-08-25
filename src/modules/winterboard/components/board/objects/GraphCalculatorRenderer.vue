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
    ref="rootEl"
    :class="{
      'is-readonly': !interactive,
      'is-selected': isSelected,
      'is-presenting': uiState.presenting,
      'is-compact': isCompact,
    }"
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
      <!-- Expand to fill board canvas (mirrors nmt3d/trig_circle/helix pattern).
           Незалежна від presenting mode — expand завжди доступний. -->
      <button
        type="button"
        class="gc-expand-btn"
        :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
        data-testid="graph-calc-expand-btn"
        @click.stop="$emit('expand')"
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <!-- P2 (2026-05-08): режим презентації — приховує панель, plot 100%.
           Module-level UI state (NOT persisted, NOT replayed). -->
      <button
        v-if="interactive"
        type="button"
        class="gc-present-btn"
        :class="{ 'is-active': uiState.presenting }"
        :title="uiState.presenting
          ? 'Вийти з режиму презентації'
          : 'Режим презентації — приховати панель, plot на весь розмір'"
        data-testid="graph-calc-present-btn"
        @click.stop="onTogglePresenting"
      >{{ uiState.presenting ? '◧' : '◨' }}</button>
      <!-- Phase G4 (2026-05-06): param-mode toggle button (Shift-equivalent).
           2026-08-16: доступна, коли є хоч одна крива від рівно одного параметра
           (dragParamNames) — не «рівно 1 повзунок на дошці». Підпис — імена
           параметрів, якими можна тягнути (a·b, якщо їх кілька), а не жорстке 'a'. -->
      <button
        v-if="interactive"
        type="button"
        class="gc-param-mode-btn"
        :class="{ 'is-active': uiState.paramMode }"
        :disabled="!paramModeAvailable"
        :title="paramModeAvailable
          ? (uiState.paramMode
              ? `Керування параметром drag-ом УВІМКНЕНО (${dragParamNames.join(', ')}). Клік — вимкнути.`
              : `Клік — керувати параметром drag-ом по графіку (${dragParamNames.join(', ')}). Або тримайте Shift.`)
          : 'Drag-параметр недоступний: жодна крива не залежить рівно від одного параметра'"
        data-testid="graph-calc-param-mode-btn"
        @click.stop="onToggleParamMode"
      >
        <span class="gc-param-mode-icon">↕</span>
        <span class="gc-param-mode-label">{{ dragParamNames.length ? dragParamNames.join('·') : '—' }}</span>
      </button>
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
      <!-- Expression panel hidden when selected — controls move to GraphCalcInspector
           sidebar. Розгортання тепер авто-виділяє об'єкт (WBOverlayLayer.toggleExpand)
           → інспектор з'являється у сайтбарі (не перекритий) → панель НЕ дублюємо на
           оверлеї, інакше були б дві копії контролів. -->
      <aside class="gc-panel" v-if="interactive && !isSelected">
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
              :title="t('winterboard.widget.graphCalc.toggleVisibility')"
              @click.left.stop="onToggleHidden(expr.id)"
              @contextmenu.prevent
            />
            <input
              type="text"
              class="gc-input"
              :value="expr.src"
              :placeholder="idx === 0 ? t('winterboard.widget.graphCalc.exprPlaceholder') : ''"
              @input="onSrcInput(expr.id, ($event.target as HTMLInputElement).value)"
              @blur="onInputBlur(expr.id)"
              @keydown.enter.prevent="onEnterPress(expr.id)"
              @keydown.down.prevent="onArrowNav(expr.id, 1)"
              @keydown.up.prevent="onArrowNav(expr.id, -1)"
              @keydown.esc="closeSlashPopup"
              @keydown.stop
              @keypress.stop
              @keyup.stop
            />

            <!-- P2 #9 (2026-05-08): slash-command popup. Активний тільки для
                 input з матчевим exprId. ↓/↑ — навігація, Enter — apply,
                 Esc / blur — close. -->
            <div
              v-if="slashPopup?.exprId === expr.id"
              class="gc-slash-popup"
              role="listbox"
              data-testid="graph-calc-slash-popup"
              @mousedown.prevent
            >
              <div
                v-for="(tpl, tplIdx) in slashFilteredTemplates"
                :key="tpl.id"
                class="gc-slash-item"
                :class="{ 'is-selected': tplIdx === slashPopup.selectedIdx }"
                role="option"
                :aria-selected="tplIdx === slashPopup.selectedIdx"
                :data-testid="`graph-calc-slash-item-${tpl.id}`"
                @click.stop="applySlashTemplate(expr.id, tpl)"
                @mouseenter="slashPopup && (slashPopup.selectedIdx = tplIdx)"
              >
                <span class="gc-slash-item-key">/{{ tpl.id }}</span>
                <span class="gc-slash-item-label">{{ tpl.label }}</span>
              </div>
              <div v-if="slashFilteredTemplates.length === 0" class="gc-slash-empty">
                Нема шаблонів за «{{ slashPopup.query }}»
              </div>
            </div>
            <!-- Phase G: inline slider removed; sliders rendered ТІЛЬКИ у
                 окремій gc-params section (single source per state.params). -->

            <button
              type="button"
              class="gc-row-del"
              :title="t('winterboard.widget.delete')"
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

        <!-- Phase G4: inline quick-add templates (заміщає sidebar context panel).
             Compact pill buttons під «+ add» — не ламає layout, лишається у renderer. -->
        <div class="gc-quick-add">
          <button
            v-for="tpl in QUICK_TEMPLATES"
            :key="tpl.src"
            type="button"
            class="gc-quick-btn"
            :title="`Додати: ${tpl.src}`"
            :data-testid="`graph-calc-quick-${tpl.id}`"
            @click="onQuickAdd(tpl.src)"
          >{{ tpl.label }}</button>
        </div>

        <!-- Phase G4: help hint під параметрами (видно тільки коли є params). -->
        <div v-if="paramEntries.length > 0" class="gc-help-hint">
          <span class="gc-help-hint__icon">💡</span>
          <!-- i18n: рядок цілісний, з kbd-слотами — інакше переклад
               довелось би різати на шматки навколо клавіш. -->
          <i18n-t keypath="winterboard.widget.graphCalc.paramHelp" tag="span" scope="global">
            <template #shift><kbd>Shift</kbd></template>
            <template #icon><kbd>↕</kbd></template>
          </i18n-t>
        </div>

        <!-- Phase G2: interactive points. List + add button. Drag mechanism — engine canvas. -->
        <div v-if="pointEntries.length > 0 || canAddPoints" class="gc-points">
          <div class="gc-points-header">{{ t('winterboard.widget.graphCalc.points') }}</div>
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
              :title="t('winterboard.widget.graphCalc.deletePoint')"
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
             reveal range editor (min/max/step).
             Hidden when isSelected=true: params move to GraphCalcInspector sidebar
             (розгортання авто-виділяє → інспектор у сайтбарі, на оверлеї не дублюємо). -->
        <div v-if="paramEntries.length > 0 && !isSelected" class="gc-params" data-testid="graph-calc-params">
          <div class="gc-params-header">
            Параметри
            <span
              v-if="dragParamNames.length"
              class="gc-params-hint"
              :title="t('winterboard.widget.graphCalc.paramDragTitle', { names: dragParamNames.join(', ') })"
            >Shift-drag</span>
            <span
              v-else
              class="gc-params-hint gc-params-hint--disabled"
              title="Drag-параметр недоступний: жодна крива не залежить рівно від одного параметра"
            >Shift-drag —</span>
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
              :title="paramExpanded[p.name] ? t('winterboard.widget.graphCalc.rangeCollapse') : t('winterboard.widget.graphCalc.rangeExpand')"
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
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
  extractParams,
  extractParamsFromAll,
  detectAmbiguousImplicitMultiply,
  type ImplicitMultiplyHint,
} from '../../../utils/graphCalculatorUtils'
// Phase G4: shared per-asset UI state (toggle param mode).
// Module-level reactive — renderer + sidebar context panel see same value.
import { getGraphCalcUi, toggleGraphCalcParamMode, toggleGraphCalcPresenting } from '../../../board/state/graphCalculatorUiState'
// Inspector bridge — param sliders move to GraphCalcInspector sidebar when selected.
import { registerGraphCalcInspector, unregisterGraphCalcInspector } from '../../../board/state/graphCalcInspectorState'
import type { GraphCalcInspectorBridge } from '../../../board/state/graphCalcInspectorState'
// EXPORT_PREPARATION_SSOT (Stage 1 PR-2): thin-adapter widget snapshot.
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

interface Props {
  asset: WBAsset
  isSelected?: boolean
  /** Interactive mode (live edit). False = read-only (replay, students). */
  interactive?: boolean
  /** Disable internal animation rAF loop (set TRUE during replay per inv-21.13). */
  disableAnimation?: boolean
  /** True when overlay is expanded to fill the whole board canvas. */
  isExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  interactive: true,
  disableAnimation: false,
  isExpanded: false,
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
  /** Expand / collapse to fill the full board canvas */
  (e: 'expand'): void
}>()

// ─── Refs / state ──────────────────────────────────────────────────────
const plotEl = ref<HTMLDivElement | null>(null)

// EXPORT_PREPARATION_SSOT INV-EP-8: thin adapter — snapshot of the inner
// plot canvas only (rootEl has toolbar + controls we don't want in export).
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(plotEl.value, signal),
)

let calc: InstanceType<typeof GraphCalculator> | null = null
/** Phase G3 hotfix: original engine.setParamValue (pre-monkey-patch). Used
 *  by onParamDrag to bypass monkey-patch (avoids double-emit).
 *  Set у mountEngine. */
let origSetParamRef: ((name: string, value: number) => void) | null = null

/** FE-RULE-4 / FE-RULE-6: suppress onChange echoes during setState. */
let isApplyingExternalState = false

/** FE-RULE-8: version gate — monotonic seq from asset.data.meta.last_snapshot_seq. */
let lastAppliedSeq = 0

/** FE-RULE-7: cheap signature for skip identical applies. */
let lastAppliedSignature = ''

/** Expressions+viewport signature from last apply — used to detect params-only changes.
 *  Empty string = no previous apply (first mount → always full setState). */
let lastExprVpSignature = ''

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

// ─── Phase G4: param-mode toggle (g4_inv_1..10) ───────────────────────
// uiState shared via module — sidebar context panel reads/writes same entry.
const uiState = computed(() => getGraphCalcUi(props.asset.id))

/** Shift key state — tracked at document level. */
const shiftKeyHeld = ref(false)

/** Effective mode = Shift OR toggle (g4_inv_3: Shift wins у конфлікті
 *  технічно — обидва шляхи дають 'param', тож пріоритет тривіальний). */
const effectiveMode = computed<'normal' | 'param'>(() =>
  shiftKeyHeld.value || uiState.value.paramMode ? 'param' : 'normal',
)

/** Параметри, якими справді можна керувати перетягуванням: ті, від яких
 *  якась видима крива залежить РІВНО одна. Дзеркало правила рушія
 *  (`_findParamDragCandidate`, 2026-08-16): однозначність вирішує КРИВА, а
 *  не лічильник повзунків. Раніше тут стояло `paramEntries.length === 1` —
 *  і кнопка ↕ гасла, щойно на дошці два повзунки, хоча парабола від `a` і
 *  коло від `b` тягнуться кожне за своїм (живий прогін власника). */
const dragParamNames = computed<string[]>(() => {
  const data = props.asset.data as
    { state?: { expressions?: Array<{ src?: string; hidden?: boolean }> } } | undefined
  const known = new Set(paramEntries.value.map((p) => p.name))
  const out = new Set<string>()
  for (const e of data?.state?.expressions ?? []) {
    if (!e?.src || e.hidden) continue
    const used = extractParams(e.src).filter((n) => known.has(n))
    if (used.length === 1) out.add(used[0])
  }
  return [...out]
})
const paramModeAvailable = computed(() => dragParamNames.value.length > 0)

function onToggleParamMode() {
  if (!props.interactive) return
  if (!paramModeAvailable.value) return
  toggleGraphCalcParamMode(props.asset.id)
}

function onTogglePresenting() {
  if (!props.interactive) return
  toggleGraphCalcPresenting(props.asset.id)
}

// ─── P2 #8 (2026-05-08): responsive layout ────────────────────────────
// Коли width < COMPACT_THRESHOLD_PX, layout перевертається на column-reverse
// (plot зверху, панель внизу як bottom-sheet). НЕ персиститься — суто візуальне.
const rootEl = ref<HTMLElement | null>(null)
const isCompact = ref(false)
const COMPACT_THRESHOLD_PX = 360
let resizeObserver: ResizeObserver | null = null

function onWindowKeyDown(e: KeyboardEvent) {
  if (e.key === 'Shift' && !shiftKeyHeld.value) shiftKeyHeld.value = true
}
function onWindowKeyUp(e: KeyboardEvent) {
  if (e.key === 'Shift') shiftKeyHeld.value = false
}
function onWindowBlur() {
  // Window lost focus mid-drag (e.g., Alt+Tab) — release Shift state.
  shiftKeyHeld.value = false
  // Phase G4 hardening (2026-05-06): also flush any pending param/sync/snapshot.
  // Window blur може настати mid-drag без pointerup (Alt+Tab, OS notification,
  // app switch on tablet) → engine.onParamDragEnd НЕ викликається → pending
  // throttle лежить у setTimeout. Flush явно щоб final value лендився як op.
  flushParam()
  flushSyncParams()
  flushSnapshot()
}

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

/* ── GraphCalc Inspector bridge ───────────────────────────────────────────
   Registered when isSelected=true; GraphCalcInspector reads paramEntries,
   paramExpanded, displayExpressions reactively; calls all action methods.
   State synced via watchEffect (params computed + paramExpanded ref +
   displayExpressions ref + slashPopup ref + slashFilteredTemplates computed).
──────────────────────────────────────────────────────────────────────────── */

/** Bridge-compatible wrapper for applySlashTemplate (uses GcSlashTemplate without `keyword`). */
function bridgeApplySlashTemplate(exprId: string, tpl: import('../../../board/state/graphCalcInspectorState').GcSlashTemplate): void {
  if (!tpl || !calc || !props.interactive) return
  calc.updateExpression(exprId, tpl.src)
  slashPopup.value = null
  scheduleSyncParams()
}

const _gcBridge = reactive<GraphCalcInspectorBridge>({
  // Params
  paramEntries: [],
  dragParamNames: [],
  paramExpanded: {},
  onSliderInput,
  flushParam,
  toggleParamExpand,
  onRangeMinChange,
  onRangeMaxChange,
  onRangeStepChange,
  // Expression editing
  displayExpressions: [],
  slashPopup: null,
  slashFilteredTemplates: [],
  onSrcInput,
  onInputBlur,
  onEnterPress,
  onArrowNav,
  onToggleHidden,
  onRemoveExpression,
  onAddExpression,
  onQuickAdd,
  applySlashTemplate: bridgeApplySlashTemplate,
  closeSlashPopup,
  setSlashSelectedIdx: (idx: number) => {
    if (slashPopup.value) slashPopup.value.selectedIdx = idx
  },
  isExpanded: false,
  toggleExpand: () => emit('expand'),
})

// Keep bridge state in sync — watchEffect живе нижче, після оголошень
// slashPopup/slashFilteredTemplates (TDZ: синхронний перший запуск).

// Register / unregister when selection changes.
watch(() => props.isSelected, (sel) => {
  if (sel) registerGraphCalcInspector(props.asset.id, _gcBridge)
  else unregisterGraphCalcInspector(props.asset.id)
})

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
  // BUG FIX: s.params[k] is {value, min, max, step} object — must extract .value,
  // otherwise `${obj}` → "[object Object]" and ALL param sigs become identical,
  // causing applyExternalState to skip engine update on every graph_param_set replay op.
  const paramPart = paramKeys.map((k) => {
    const p = s.params[k]
    const v = (p && typeof p === 'object') ? (p as { value?: number }).value ?? '' : p
    return `${k}=${v}`
  }).join(',')
  const vpPart = `${s.viewport.cx},${s.viewport.cy},${s.viewport.scale}`
  return `${s.expressions.length}#${exprPart}#${paramPart}#${vpPart}`
}

/** Signature over expressions + viewport only (excludes params).
 *  Compared against lastExprVpSignature to detect params-only state changes —
 *  enables fast-path in applyExternalState (avoids full setState + animation cancel). */
function exprVpSignature(s: GraphCalculatorState): string {
  const exprPart = s.expressions
    .map((e) => `${e.id}:${e.src}:${e.color}:${e.hidden ? 1 : 0}`)
    .join('|')
  const vpPart = `${s.viewport.cx},${s.viewport.cy},${s.viewport.scale}`
  return `${s.expressions.length}#${exprPart}#${vpPart}`
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
    // Update local signatures so the inbound watch (echo) is suppressed.
    const state = (asset.data as { state: GraphCalculatorState }).state
    lastAppliedSignature = snapshotSignature(state)
    lastExprVpSignature = exprVpSignature(state)
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
    const state = (asset.data as { state: GraphCalculatorState }).state
    lastAppliedSignature = snapshotSignature(state)
    lastExprVpSignature = exprVpSignature(state)
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

/** Точка onCurve на НЕЯВНІЙ кривій (2026-08-16): найближча до (x, y) точка
 *  кривої, або null, якщо крива явна (тоді діє старий шлях «лише x») чи не
 *  бере точку. Делегує рушію (`_projectToCurve`) — одна реалізація на рендер,
 *  hit-test і перетягування, щоб гілка ніде не розійшлась. */
function onCurveProjection(curveExprId: string | undefined, x: number, y: number)
  : { x: number; y: number } | null {
  if (!calc || !curveExprId) return null
  const expr = (calc as any).expressions?.find((e: any) => e.id === curveExprId)
  if (!expr || expr.classified?.kind !== 'implicit') return null
  const proj = (calc as any)._projectToCurve?.(expr, x, y)
  return proj && Number.isFinite(proj.x) && Number.isFinite(proj.y) ? proj : null
}

// ─── Apply external state (FE-RULE-2/6/8/12) ───────────────────────────

function applyExternalState(state: GraphCalculatorState, seq: number) {
  if (!calc) return
  // FE-RULE-8: version gate — older snapshot must NOT roll back local view.
  if (seq > 0 && seq < lastAppliedSeq) return
  // FE-RULE-7: skip identical apply.
  const sig = snapshotSignature(state)
  if (sig === lastAppliedSignature) return
  // Fast path: when only params changed (expressions + viewport unchanged),
  // use origSetParamRef instead of calc.setState() to avoid cancelling the
  // animation rAF loop (per inv-21.13). lastExprVpSignature === '' on first
  // mount → always falls through to full setState (correct for initial load).
  const newExprVpSig = exprVpSignature(state)
  const onlyParamsChanged = lastExprVpSignature !== '' && newExprVpSig === lastExprVpSignature
  // FE-RULE-6 / FE-RULE-12: suppress echo during setState (initial mount + watch).
  isApplyingExternalState = true
  try {
    if (onlyParamsChanged && origSetParamRef) {
      // Fast path: update individual param values without full state replace.
      for (const [k, entry] of Object.entries(state.params)) {
        const val = (entry && typeof entry === 'object')
          ? (entry as { value?: number }).value
          : (typeof entry === 'number' ? entry : undefined)
        if (val !== undefined && Number.isFinite(val)) origSetParamRef(k, val)
      }
    } else {
      calc.setState(state)
    }
  } finally {
    isApplyingExternalState = false
  }
  lastAppliedSeq = seq || lastAppliedSeq
  lastAppliedSignature = sig
  lastExprVpSignature = newExprVpSig
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
      // Phase G4: initial interactionMode (subsequent changes via watch).
      interactionMode: effectiveMode.value,
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
  // Phase G3 hotfix (2026-05-06): origSetParam exposed via closure so що
  // onParamDrag callback може mutate engine WITHOUT triggering double emit
  // (monkey-patched setParamValue would emit too — race з explicit emit).
  const origSetParam = calc.setParamValue.bind(calc)
  origSetParamRef = origSetParam
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
      // Неявна крива (2026-08-16): одного x замало (у кола дві гілки) — тягнемо
      // точку по кривій, проєктуючи КУРСОР на неї; старт з курсора = найближча
      // гілка = «точка тримається гілки, не стрибає» (правило власника).
      // Емітимо (x, y) — стейт несе опорну точку, рушій проєктує при рендері.
      const proj = onCurveProjection(pt.curveExprId, mathX, mathY)
      if (proj) { emitPointSetThrottled(id, proj.x, proj.y); return }
      // Явна крива — як і було: y omitted, derived from curveExprId at render
      // time per review #4.
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
    // dp_inv_5: NaN/Infinity → no emit (already guarded above).
    // Early exit якщо delta tiny (UX-INV avoid emit storm).
    const cur = (calc as any).params?.[name]
    const curValue = (cur && typeof cur === 'object' && Number.isFinite(cur.value))
      ? cur.value : (typeof cur === 'number' ? cur : NaN)
    if (Number.isFinite(curValue) && Math.abs(value - curValue) < 1e-4) return

    // Phase G3 hotfix (2026-05-06): SINGLE emit pipeline.
    // BYPASS monkey-patched setParamValue (would emit duplicate). Use
    // origSetParam directly — engine internal mutation для immediate render,
    // NO automatic emit (we explicitly emit below).
    if (origSetParamRef) origSetParamRef(name, value)
    else (calc as any).params[name].value = value  // fallback

    // dp_inv_3: floating label з actual emit value (matches user expectation).
    activeDragParam.value = { name, value }
    // Single emit per drag tick — deterministic for replay.
    emitParamSetThrottled(name, value)
  }
  ;(calc as any).onParamDragEnd = (name: string | undefined) => {
    if (!name) return
    // CRITICAL: flush pending throttle so final value lands як op.
    // Without flush — last drag tick stuck у timeout, replay misses end state.
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
      const proj = onCurveProjection(pt.curveExprId, mathX, mathY)
      if (proj) { flushPointSet(id, proj.x, proj.y); return }
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
  // J-1 FIX: update lastAppliedSignature/lastAppliedSeq щоб перший snapshot
  // round-trip не викликав calc.setState (який перебудовував DOM і втрачав фокус).
  lastAppliedSignature = snapshotSignature(calc.getState() as GraphCalculatorState)
  const d = props.asset.data as { meta?: { last_snapshot_seq?: number } } | undefined
  lastAppliedSeq = (d && d.meta && d.meta.last_snapshot_seq) || lastAppliedSeq
  // calc.onChange wrapper auto-fires snapshot debounce.
}

// Phase G4: inline quick-add templates (під «+ add» button).
// Click → calc.addExpression(src, uuid) — same path як manual add, тільки src
// preset. Renderer's existing onChange → debounced snapshot → asset_update op.
// Param-sync triggered automatically через scheduleSyncParams (existing flow).
const QUICK_TEMPLATES = [
  { id: 'linear',   label: 'a·x',    src: 'y = a*x' },
  { id: 'sin',      label: 'a·sin',  src: 'y = a*sin(x)' },
  { id: 'parabola', label: 'a·x²',   src: 'y = a*x^2' },
  { id: 'circle',   label: 'circle', src: '(x)^2 + (y)^2 = r^2' },
] as const

function onQuickAdd(src: string) {
  if (!calc || !props.interactive) return
  const id = genId()
  flushSnapshot()
  calc.addExpression(src, id)
  // Trigger param-sync after expression with vars added (a, r, etc.).
  scheduleSyncParams()
}

function onRemoveExpression(id: string) {
  if (!calc || !props.interactive) return
  calc.removeExpression(id)
  // params sync after removal — drop params that були used ONLY by removed expr.
  scheduleSyncParams()
}

// P2 #9 (2026-05-08): inline slash-command templates. Trigger — input starts
// with `/`. Filter by query, navigate Up/Down/Enter/Esc, click to apply.
// Більший набір ніж видимі quick-add chips (8 vs 4) — chips для discoverability,
// slash для швидкого pro-flow без дотягування миші.
const SLASH_TEMPLATES = [
  { id: 'linear',   label: 'a·x',           keyword: 'linear line',          src: 'y = a*x' },
  { id: 'sin',      label: 'a·sin(x)',      keyword: 'sin sine',             src: 'y = a*sin(x)' },
  { id: 'cos',      label: 'a·cos(x)',      keyword: 'cos cosine',           src: 'y = a*cos(x)' },
  { id: 'parabola', label: 'a·x²',          keyword: 'parabola poly2 quad',  src: 'y = a*x^2' },
  { id: 'cubic',    label: 'a·x³',          keyword: 'cubic poly3',          src: 'y = a*x^3' },
  { id: 'sqrt',     label: '√x',            keyword: 'sqrt root',            src: 'y = sqrt(x)' },
  { id: 'log',      label: 'log(x)',        keyword: 'log',                  src: 'y = log(x)' },
  { id: 'circle',   label: 'x² + y² = r²',  keyword: 'circle',               src: '(x)^2 + (y)^2 = r^2' },
] as const
type SlashTemplate = typeof SLASH_TEMPLATES[number]

const slashPopup = ref<{ exprId: string; query: string; selectedIdx: number } | null>(null)

const slashFilteredTemplates = computed<readonly SlashTemplate[]>(() => {
  if (!slashPopup.value) return []
  const q = slashPopup.value.query.toLowerCase().trim()
  if (!q) return SLASH_TEMPLATES
  return SLASH_TEMPLATES.filter((t) =>
    t.id.toLowerCase().includes(q) ||
    t.keyword.toLowerCase().includes(q),
  )
})

// Keep bridge state in sync with reactive refs + computeds. Оголошено ПІСЛЯ
// slashPopup/slashFilteredTemplates: watchEffect запускається синхронно при
// створенні, розміщення вище цих const → TDZ ReferenceError на mount.
watchEffect(() => {
  _gcBridge.paramEntries = paramEntries.value.map((p) => ({ ...p }))
  _gcBridge.dragParamNames = [...dragParamNames.value]
  _gcBridge.paramExpanded = { ...paramExpanded.value }
  _gcBridge.displayExpressions = displayExpressions.value.map((e) => ({
    id: e.id,
    src: e.src,
    color: e.color,
    hidden: e.hidden,
    isParam: e.isParam,
  }))
  _gcBridge.slashPopup = slashPopup.value ? { ...slashPopup.value } : null
  _gcBridge.slashFilteredTemplates = slashFilteredTemplates.value.map((t) => ({
    id: t.id,
    label: t.label,
    src: t.src,
  }))
  _gcBridge.isExpanded = props.isExpanded ?? false
})

function applySlashTemplate(exprId: string, tpl: SlashTemplate | undefined) {
  if (!tpl || !calc || !props.interactive) return
  // Engine update fires onChange → displayExpressions re-derived → input
  // :value reflects new src reactively (FE-RULE-2/4 path).
  calc.updateExpression(exprId, tpl.src)
  slashPopup.value = null
  scheduleSyncParams()
}

function closeSlashPopup() {
  slashPopup.value = null
}

function onInputBlur(exprId: string) {
  // Delay close to allow click on popup item to fire first.
  setTimeout(() => {
    if (slashPopup.value?.exprId === exprId) slashPopup.value = null
  }, 120)
  onExpressionCommit(exprId)
}

function onEnterPress(exprId: string) {
  if (slashPopup.value?.exprId === exprId) {
    const items = slashFilteredTemplates.value
    applySlashTemplate(exprId, items[slashPopup.value.selectedIdx])
    return
  }
  onExpressionCommit(exprId)
}

function onArrowNav(exprId: string, delta: 1 | -1) {
  if (slashPopup.value?.exprId !== exprId) return
  const len = slashFilteredTemplates.value.length
  if (len === 0) return
  const next = (slashPopup.value.selectedIdx + delta + len) % len
  slashPopup.value.selectedIdx = next
}

function onSrcInput(id: string, src: string) {
  if (!calc || !props.interactive) return
  // P2 #9: leading-slash → open/update popup, skip engine update.
  // (Engine would mark expression invalid for `/foo` syntax — visually
  // distracting за popup'ом.)
  if (src.startsWith('/')) {
    const query = src.slice(1)
    if (slashPopup.value?.exprId === id) {
      slashPopup.value.query = query
      slashPopup.value.selectedIdx = 0
    } else {
      slashPopup.value = { exprId: id, query, selectedIdx: 0 }
    }
    return
  }
  // Closed popup if value no longer starts with '/'.
  if (slashPopup.value?.exprId === id) slashPopup.value = null
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
  // Sync canvas pointer-events immediately after vendor canvas is created.
  syncCanvasPointerEvents()
  // Register bridge if already selected on mount.
  if (props.isSelected) registerGraphCalcInspector(props.asset.id, _gcBridge)
  // Flush hooks (FE-RULE-10 partial — visibilitychange + beforeunload).
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('beforeunload', onBeforeUnload)
  // Phase G4: track Shift у window scope (canvas can lose focus during drag).
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('keyup', onWindowKeyUp)
  window.addEventListener('blur', onWindowBlur)
  // P2 #8: responsive — switch до compact (panel-bottom) layout при <360px.
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        isCompact.value = entry.contentRect.width < COMPACT_THRESHOLD_PX
      }
    })
    resizeObserver.observe(rootEl.value)
  }
})

onBeforeUnmount(() => {
  unregisterGraphCalcInspector(props.asset.id)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('keyup', onWindowKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  // P2 #8: disconnect RO BEFORE unmountEngine — RO must not fire on tear-down.
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  // FE-RULE-10: order matters — flush BEFORE destroy.
  flushSyncParams()
  flushSnapshot()
  flushParam()
  unmountEngine()
})

// Phase G4: sync effectiveMode → engine.opts.interactionMode (read by
// pointerdown handler у engine). Engine stays stateless about UI toggle —
// receives runtime opt only (g4_inv_2).
//
// Phase G4 hardening (2026-05-06): when leaving 'param' mode mid-drag
// (e.g., Shift released without pointerup, toggle clicked off mid-drag),
// flush pending throttle so final value не губиться. Engine's local
// `mode` resets only at pointerup, so onParamDragEnd is the canonical
// flush path — this watch is belt-and-suspenders for edge cases де
// pointerup ніколи не fired (window blur вже handled окремо).
//
// Known limitation (Risk 4 — animation × drag): engine has internal rAF
// animation (setParamAnimating(id, on) API), але у поточному UI ми її
// НЕ експонуємо (немає ▶ button у нашому renderer panel). Animation × drag
// conflict thus unreachable у v1.
//
// 🚨 GATE для майбутнього: якщо додаєш UI control для запуску animation
// (slider play button, або auto-animate checkbox) — MUST disable / hide
// той control коли effectiveMode === 'param', або викликати
// calc.setParamAnimating(exprId, false) у watch effectiveMode при entry.
// Інакше: animation rAF (~60fps) + drag throttle (~30fps) → race,
// останній value wins per throttle pending → jittery emits.
watch(
  effectiveMode,
  (mode, prev) => {
    if (calc && (calc as any).opts) {
      ;(calc as any).opts.interactionMode = mode
    }
    if (prev === 'param' && mode !== 'param') {
      flushParam()
    }
  },
  { immediate: true },
)

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

// ─── Draw-mode canvas isolation (pointer-events sync) ─────────────────
// When the user switches to pen/draw tool (props.interactive → false), the
// vendor canvas inside gc-plot must NOT capture pointer events — otherwise
// pen strokes get eaten by the graph renderer.
// CSS `pointer-events: none` on a parent div does NOT suppress HTML <canvas>
// children (pointer-events doesn't inherit in HTML, unlike SVG), so we set
// inline styles directly — same approach as Geometry2DRenderer.syncPointerEvents.
function syncCanvasPointerEvents(): void {
  const el = plotEl.value
  if (!el) return
  const val = props.interactive ? '' : 'none'
  // Override `.gc-plot { pointer-events: auto }` AND explicitly set all
  // descendants — vendor may create intermediate wrapper divs with pointer-
  // events:auto by default, and may set inline styles on canvas elements.
  // querySelectorAll('canvas') misses those intermediate divs.
  ;(el as HTMLElement).style.pointerEvents = val
  el.querySelectorAll('*').forEach((child) => {
    ;(child as HTMLElement).style.pointerEvents = val
  })
}

watch(() => props.interactive, syncCanvasPointerEvents)

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
  background: var(--gc-paper, #fffaf0);
  border: 1px solid var(--gc-line, rgba(43, 33, 24, 0.15));
  border-radius: var(--gc-radius-card, 6px);
  box-shadow: var(--gc-shadow-card, 0 2px 6px rgba(0, 0, 0, 0.08));
  overflow: hidden;
  user-select: none;
  /* Bug fix (2026-05-06): outer container НЕ перехоплює pointer events —
     Konva proxy внизу ловить drag/select. Тільки interactive children
     (header buttons, panel inputs, plot canvas) re-enable pointer-events:auto. */
  pointer-events: none;
}

.graph-calc-renderer.is-selected {
  outline: 2px solid var(--gc-accent-2, #3b7b9b);
  outline-offset: 1px;
}

.graph-calc-renderer.is-readonly {
  pointer-events: none;
}
.graph-calc-renderer.is-readonly .gc-header {
  display: none;
}

/* P2 (2026-05-08): режим презентації — панель прихована, plot заповнює body.
   Header ховається, окрім toggle-кнопки яка стає floating top-right glass-pill,
   щоб учитель міг повернутись до edit-режиму. */
.graph-calc-renderer.is-presenting .gc-panel {
  display: none;
}
.graph-calc-renderer.is-presenting .gc-title,
.graph-calc-renderer.is-presenting .gc-param-mode-btn,
.graph-calc-renderer.is-presenting .gc-delete {
  display: none;
}
.graph-calc-renderer.is-presenting .gc-header {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 6;
  padding: 0;
  background: transparent;
  border-bottom: 0;
}
.graph-calc-renderer.is-presenting .gc-present-btn {
  background: var(--gc-glass-bg, rgba(255, 250, 240, 0.92));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--gc-accent-2, #3b7b9b);
  border-color: var(--gc-line, rgba(43, 33, 24, 0.15));
}

/* P2 #8 (2026-05-08): responsive — на overlay шириною <360px перевертаємо
   gc-body у column-reverse: plot зверху (математика у фокусі), панель з
   виразами знизу як bottom-sheet з власним вертикальним скролом. */
.graph-calc-renderer.is-compact .gc-body {
  flex-direction: column-reverse;
}
.graph-calc-renderer.is-compact .gc-panel {
  width: 100%;
  max-height: 50%;
  border-right: 0;
  border-top: 1px solid var(--gc-line-soft, rgba(43, 33, 24, 0.1));
  padding: 4px 6px;
}
.graph-calc-renderer.is-compact .gc-plot {
  min-height: 50%;
}

/* P2 #9 (2026-05-08): slash-command popup. Floating під рядком expression,
   glass-pill estetiка узгоджена з drag-param-label. Selected item — accent-2-soft
   bg, mono key зліва (типу VS Code command palette). */
.gc-slash-popup {
  grid-column: 2 / -1;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 3px;
  background: var(--gc-glass-bg, rgba(255, 250, 240, 0.92));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--gc-line, rgba(43, 33, 24, 0.15));
  border-radius: var(--gc-radius-btn, 4px);
  box-shadow: var(--gc-shadow-card, 0 2px 6px rgba(0, 0, 0, 0.08));
  pointer-events: auto;
  z-index: 4;
  max-height: 200px;
  overflow-y: auto;
}
.gc-slash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  border-radius: var(--gc-radius-input, 3px);
  cursor: pointer;
  font-size: 11px;
  color: var(--gc-ink-2, #5a4a3a);
  transition: background var(--gc-transition, 120ms ease);
}
.gc-slash-item.is-selected {
  background: var(--gc-accent-2-soft, rgba(59, 123, 155, 0.1));
  color: var(--gc-accent-2, #3b7b9b);
}
.gc-slash-item-key {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  color: var(--gc-ink-3, #8a7860);
  font-feature-settings: "tnum";
}
.gc-slash-item.is-selected .gc-slash-item-key {
  color: var(--gc-accent-2, #3b7b9b);
}
.gc-slash-item-label {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-feature-settings: "tnum";
  text-align: right;
}
.gc-slash-empty {
  padding: 6px 6px;
  font-size: 10px;
  color: var(--gc-ink-3, #8a7860);
  text-align: center;
  font-style: italic;
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
.gc-plot,
.gc-param-mode-btn,
.gc-present-btn,
.gc-expand-btn {
  pointer-events: auto;
}

.gc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  /* P1 (2026-05-08): прибрано background — header розчиняється у paper.
     Замість контрастної смуги — лише hairline divider знизу. */
  background: transparent;
  border-bottom: 1px solid var(--gc-line-soft, rgba(43, 33, 24, 0.1));
  font-size: 12px;
  font-weight: 600;
  color: var(--gc-ink, #2b2118);
}

.gc-delete {
  cursor: pointer;
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  color: var(--gc-error, #a83a5b);
  padding: 0 4px;
}

/* Expand-to-board button — mirrors nmt3d ⛶ pattern. Завжди видимий (не тільки
   при interactive), бо expand = navigation, не редагування. */
.gc-expand-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  margin-right: 4px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--gc-line, rgba(43, 33, 24, 0.15));
  border-radius: var(--gc-radius-btn, 4px);
  background: transparent;
  font-size: 13px;
  line-height: 1;
  color: var(--gc-ink-2, #5a4a3a);
  transition: background var(--gc-transition, 120ms ease), color var(--gc-transition, 120ms ease);
}
.gc-expand-btn:hover {
  background: var(--gc-accent-2-faint, rgba(59, 123, 155, 0.08));
  color: var(--gc-accent-2, #3b7b9b);
  border-color: var(--gc-accent-2-strong, rgba(59, 123, 155, 0.4));
}
/* Якщо expand-btn перший у header, gc-present-btn не потребує margin-left:auto */
.gc-expand-btn ~ .gc-present-btn {
  margin-left: 0;
}

/* P2 (2026-05-08): presentation toggle — той самий visual stack що й
   gc-param-mode-btn, але icon-only, gap 4px перед param-mode/delete. */
.gc-present-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  margin-right: 4px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--gc-line, rgba(43, 33, 24, 0.15));
  border-radius: var(--gc-radius-btn, 4px);
  background: transparent;
  font-size: 12px;
  line-height: 1;
  color: var(--gc-ink-2, #5a4a3a);
  transition: background var(--gc-transition, 120ms ease), color var(--gc-transition, 120ms ease);
}
.gc-present-btn:hover {
  background: var(--gc-accent-2-faint, rgba(59, 123, 155, 0.08));
  color: var(--gc-accent-2, #3b7b9b);
  border-color: var(--gc-accent-2-strong, rgba(59, 123, 155, 0.4));
}
.gc-present-btn.is-active {
  background: var(--gc-accent-2, #3b7b9b);
  color: var(--gc-paper, #fffaf0);
  border-color: var(--gc-accent-2, #3b7b9b);
}
/* Якщо present-btn активний, наступний margin-left:auto уже не потрібен,
   бо gc-present-btn сам розіпхався. Скасуємо у sibling param-mode-btn. */
.gc-present-btn ~ .gc-param-mode-btn {
  margin-left: 0;
}

/* Phase G4: param-mode toggle button */
.gc-param-mode-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  margin-right: 4px;
  padding: 2px 8px;
  border: 1px solid var(--gc-accent-2-strong, rgba(59, 123, 155, 0.4));
  border-radius: var(--gc-radius-pill, 10px);
  background: transparent;
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 600;
  color: var(--gc-ink-2, #5a4a3a);
  line-height: 1.2;
  transition: background var(--gc-transition, 120ms ease), color var(--gc-transition, 120ms ease);
}
.gc-param-mode-btn:hover:not(:disabled) {
  background: var(--gc-accent-2-faint, rgba(59, 123, 155, 0.08));
  color: var(--gc-accent-2, #3b7b9b);
}
.gc-param-mode-btn.is-active {
  background: var(--gc-accent-2, #3b7b9b);
  color: var(--gc-paper, #fffaf0);
  border-color: var(--gc-accent-2, #3b7b9b);
  animation: gc-param-mode-pulse 1.4s ease-in-out infinite;
}
.gc-param-mode-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.gc-param-mode-icon {
  font-size: 12px;
  line-height: 1;
}
.gc-param-mode-label {
  letter-spacing: 0.02em;
}
@keyframes gc-param-mode-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--gc-accent-2-strong, rgba(59, 123, 155, 0.4)); }
  50% { box-shadow: 0 0 0 4px rgba(59, 123, 155, 0); }
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
  border-right: 1px solid var(--gc-line-soft, rgba(43, 33, 24, 0.1));
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
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 12px;
  border: 1px solid var(--gc-line-strong, rgba(43, 33, 24, 0.2));
  border-radius: var(--gc-radius-input, 3px);
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
  color: var(--gc-error, #a83a5b);
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
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 13px;
  font-weight: 600;
  /* P1 (2026-05-08): glass-pill — світла warm-paper з blur замість dark
     toast. Не схоже на error-notification, у дусі brand. */
  color: var(--gc-ink, #2b2118);
  background: var(--gc-glass-bg, rgba(255, 250, 240, 0.92));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--gc-line, rgba(43, 33, 24, 0.15));
  padding: 4px 10px;
  border-radius: var(--gc-radius-pill, 10px);
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.02em;
  box-shadow: var(--gc-shadow-toast, 0 2px 4px rgba(0, 0, 0, 0.2));
}
.gc-drag-param-icon {
  font-size: 14px;
  color: var(--gc-accent-2, #3b7b9b);
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
  background: var(--gc-accent-soft, rgba(196, 98, 42, 0.08));
  border: 1px dashed var(--gc-accent-strong, rgba(196, 98, 42, 0.4));
  border-radius: var(--gc-radius-input, 3px);
  padding: 1px 5px;
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  color: var(--gc-accent, #c4622a);
  pointer-events: auto;
}
.gc-hint-btn:hover {
  background: var(--gc-accent-hover, rgba(196, 98, 42, 0.18));
}

.gc-add-btn {
  margin-top: 4px;
  cursor: pointer;
  /* P1 (2026-05-08): solid soft fill, no dashed border — outlinkий "drop zone"
     vibe замінено на native pill button. */
  background: var(--gc-accent-2-soft, rgba(59, 123, 155, 0.1));
  border: 0;
  border-radius: var(--gc-radius-pill, 10px);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gc-accent-2, #3b7b9b);
  transition: background var(--gc-transition, 120ms ease);
}
.gc-add-btn:hover { background: var(--gc-accent-2-faint, rgba(59, 123, 155, 0.16)); }

/* Phase G4: inline quick-add templates row (під «+ add») */
.gc-quick-add {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
  pointer-events: auto;
}
.gc-quick-btn {
  cursor: pointer;
  /* P1 (2026-05-08): chips — pill, no border, tabular nums for monospace формули. */
  background: var(--gc-accent-soft, rgba(196, 98, 42, 0.08));
  border: 0;
  border-radius: var(--gc-radius-pill, 10px);
  padding: 2px 8px;
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-feature-settings: "tnum";
  font-size: 10px;
  color: var(--gc-accent, #c4622a);
  pointer-events: auto;
  transition: background var(--gc-transition, 120ms ease);
}
.gc-quick-btn:hover { background: var(--gc-accent-active, rgba(196, 98, 42, 0.16)); }

/* Phase G4: help hint під params section */
.gc-help-hint {
  margin-top: 6px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--gc-ink-2, #5a4a3a);
  background: var(--gc-line-faintest, rgba(43, 33, 24, 0.04));
  border-radius: var(--gc-radius-input, 3px);
  line-height: 1.3;
}
.gc-help-hint__icon { font-size: 11px; }
.gc-help-hint kbd {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  padding: 0 3px;
  background: var(--gc-line-soft, rgba(43, 33, 24, 0.1));
  border-radius: 2px;
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
  border-top: 1px solid var(--gc-line-soft, rgba(43, 33, 24, 0.1));
}
.gc-points-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--gc-ink-2, #5a4a3a);
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
  background: var(--gc-accent, #c4622a);
  border: 1px solid var(--gc-paper, #fffaf0);
}
.gc-point-mark.is-on-curve { background: var(--gc-accent-2, #3b7b9b); }
.gc-point-coords {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  color: var(--gc-ink, #2b2118);
}
.gc-point-del {
  cursor: pointer;
  background: transparent;
  border: none;
  color: var(--gc-error, #a83a5b);
  font-size: 14px;
  line-height: 1;
}

/* Phase G — auto-param sliders */
.gc-params {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--gc-line-soft, rgba(43, 33, 24, 0.1));
}
.gc-params-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--gc-ink-2, #5a4a3a);
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
  color: var(--gc-accent-2, #3b7b9b);
  text-transform: none;
  letter-spacing: 0;
  background: var(--gc-accent-2-soft, rgba(59, 123, 155, 0.1));
  padding: 1px 5px;
  border-radius: var(--gc-radius-input, 3px);
  cursor: help;
}
.gc-params-hint--disabled {
  color: var(--gc-mute-fg, #94a3b8);
  background: var(--gc-mute-bg, rgba(148, 163, 184, 0.1));
}
.gc-param-row {
  display: grid;
  grid-template-columns: 32px 1fr 36px;
  gap: 4px;
  align-items: center;
  margin-bottom: 3px;
}
.gc-param-name {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  color: var(--gc-ink, #2b2118);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  pointer-events: auto;
  user-select: none;
}
.gc-param-name:hover {
  color: var(--gc-accent-2, #3b7b9b);
  text-decoration: underline dotted;
}
.gc-param-row.is-expanded .gc-param-name {
  color: var(--gc-accent-2, #3b7b9b);
  font-weight: 600;
}
.gc-param-value {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  color: var(--gc-ink-2, #5a4a3a);
  text-align: right;
}

.gc-range-editor {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 4px;
  padding: 4px;
  background: var(--gc-line-faintest, rgba(43, 33, 24, 0.04));
  border-radius: var(--gc-radius-btn, 4px);
}
.gc-range-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
  color: var(--gc-ink-2, #5a4a3a);
}
.gc-range-input {
  font-family: var(--gc-font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  width: 100%;
  padding: 1px 3px;
  border: 1px solid var(--gc-line-strong, rgba(43, 33, 24, 0.2));
  border-radius: var(--gc-radius-input, 3px);
  background: #fff;
  pointer-events: auto;
  box-sizing: border-box;
}
</style>
