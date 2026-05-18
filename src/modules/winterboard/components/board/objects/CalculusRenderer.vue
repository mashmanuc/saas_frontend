<!--
  Phase Calculus — calculus_card renderer (derivative + integral modes).

  Mirror pattern: Geometry2DRenderer.vue (bundle-backed, HTML overlay, Konva proxy
  catches selection, draw-tools пропускаються наскрізь у read-only).

  Bundle: vendor/calculus/* — window.CalculusCard exposed after side-effect import.
  Depends on window.GraphCalc (parse/evalAst) — loaded transitively.

  POINTER-EVENTS MODEL (mirror geometry/graph_calc 2026-05 fix):
    - Root .calculus-renderer = pointer-events:none → Konva proxy catches drag/select.
    - Header bg = inherit none → drag handle картки.
    - Stage canvas = auto (drag дотичної/меж).
    - Toolbar = auto (toggles).
    - У read-only mode (pen/highlighter active): all = none, pen draws over card.

  PERSISTENCE: opts → onChange callback → emit asset_update з patched data.
  Mirror graph_calculator pattern (debounce 150ms).
-->
<template>
  <div
    class="calculus-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
      [`mode-${asset.data.mode}`]: true,
    }"
    :data-testid="`calculus-renderer-${asset.id}`"
  >
    <header class="calculus-header">
      <span class="calculus-title">{{ modeLabel }}</span>
      <input
        v-if="isSelected"
        v-model="exprDraft"
        type="text"
        class="calculus-expr-input"
        spellcheck="false"
        autocomplete="off"
        :placeholder="t('winterboard.calculus.exprPlaceholder')"
        @input="onExprInput"
        @keydown.enter="onExprCommit"
        @blur="onExprCommit"
        @mousedown.stop
        @pointerdown.stop
      />
      <span v-else class="calculus-expr-readonly">y = {{ asset.data.expr }}</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="calculus-delete"
        :title="t('common.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <!-- Stage — canvas mounted by bundle's CalculusCard. -->
    <div ref="stageRef" class="calculus-stage" data-testid="calculus-stage" />

    <!-- Toolbar (always visible — consistent з standalone bundle UX). -->
    <div class="calculus-toolbar">
      <!-- Expression presets -->
      <div class="calculus-toolbar__row">
        <button
          v-for="p in exprPresets"
          :key="p.expr"
          type="button"
          class="calc-preset"
          :class="{ 'is-active': asset.data.expr === p.expr }"
          @click.stop="onExprPreset(p.expr)"
        >{{ p.label }}</button>
      </div>

      <!-- Derivative-specific controls -->
      <div v-if="asset.data.mode === 'derivative'" class="calculus-toolbar__row">
        <button
          type="button"
          class="calc-tool"
          :class="{ 'is-active': !!asset.data.showSecant }"
          @click.stop="toggle('showSecant')"
        >{{ t('winterboard.calculus.toggle.secant') }}</button>
        <button
          type="button"
          class="calc-tool"
          :class="{ 'is-active': !!asset.data.showDerivTrace }"
          @click.stop="toggle('showDerivTrace')"
        >{{ t('winterboard.calculus.toggle.derivTrace') }}</button>
        <label v-if="asset.data.showSecant" class="calc-slider">
          <span>h =</span>
          <input
            type="range"
            min="0.02"
            max="2"
            step="0.01"
            :value="asset.data.h ?? 0.5"
            @input="onHChange"
            @mousedown.stop
            @pointerdown.stop
          />
          <span class="calc-slider-val">{{ (asset.data.h ?? 0.5).toFixed(2) }}</span>
        </label>
      </div>

      <!-- Integral-specific controls -->
      <div v-if="asset.data.mode === 'integral'" class="calculus-toolbar__row">
        <span class="calc-mini-label">Σ:</span>
        <button
          v-for="mode in riemannModes"
          :key="mode"
          type="button"
          class="calc-tool calc-tool--seg"
          :class="{ 'is-active': (asset.data.riemann ?? 'off') === mode }"
          @click.stop="setRiemann(mode)"
        >{{ riemannLabel(mode) }}</button>
        <label class="calc-slider">
          <span>N =</span>
          <input
            type="range"
            min="2"
            max="200"
            step="1"
            :value="asset.data.N ?? 12"
            @input="onNChange"
            @mousedown.stop
            @pointerdown.stop
          />
          <span class="calc-slider-val">{{ asset.data.N ?? 12 }}</span>
        </label>
        <button
          type="button"
          class="calc-tool"
          :class="{ 'is-active': !!asset.data.showF }"
          @click.stop="toggle('showF')"
        >{{ t('winterboard.calculus.toggle.antiderivative') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CalculusAsset } from '../../../types/calculus'
import type { CalculusCardInstance, RiemannMode } from '../../../vendor/calculus'
import { CALCULUS_EXPR_PRESETS } from '../../../constants/calculusDefaults'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: CalculusAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: CalculusAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let card: CalculusCardInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_DEBOUNCE_MS = 150

const exprDraft = ref(props.asset.data.expr)
const exprPresets = CALCULUS_EXPR_PRESETS
const riemannModes: RiemannMode[] = ['off', 'left', 'mid', 'right']

const modeLabel = computed(() => t(`winterboard.calculus.mode.${props.asset.data.mode}.full`))

function riemannLabel(mode: RiemannMode): string {
  const map: Record<RiemannMode, string> = { off: '—', left: 'L', mid: 'M', right: 'R' }
  return map[mode]
}

/* ────── lifecycle ────── */

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/calculus')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return
  const W = window as unknown as { CalculusCard: new (
    el: HTMLElement,
    o: Partial<CalculusAsset['data']>,
  ) => CalculusCardInstance }

  card = new W.CalculusCard(stageRef.value, { ...props.asset.data })
  if (props.asset.data.viewport) {
    card.viewport = { ...props.asset.data.viewport }
  }
  // Mirror standalone bundle: onChange fires on drag (x0 / a / b) — debounced
  // snapshot to store via asset_update op.
  card.onChange = () => scheduleSnapshot()
}

function destroyCard(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (card) {
    try { card.destroy() } catch { /* idempotent */ }
    card = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => { destroyCard() })

// Mode hot-swap — rebuild card (rare).
watch(() => props.asset.data.mode, async (next, prev) => {
  if (next === prev) return
  destroyCard()
  await mount()
})

// Sync expr окремим watch — flush:'sync' гарантує одразу після reactive change
// (без чекання на microtask), а deep compare unneeded — рядок vs рядок.
watch(
  () => props.asset.data.expr,
  (next) => {
    if (!card || typeof next !== 'string') return
    // Якщо input у фокусі — НЕ перетираємо exprDraft (user пише). Engine
    // оновити можна — двостороння sync.
    if (document.activeElement?.tagName !== 'INPUT') {
      exprDraft.value = next
    }
    if (card.opts.expr !== next) card.setExpression(next)
  },
  { flush: 'sync' },
)

// Решта state-полів — звичайний watch на arr.
watch(
  () => [
    props.asset.data.x0,
    props.asset.data.showSecant,
    props.asset.data.h,
    props.asset.data.showDerivTrace,
    props.asset.data.a,
    props.asset.data.b,
    props.asset.data.riemann,
    props.asset.data.N,
    props.asset.data.showF,
  ],
  () => {
    if (!card) return
    const d = props.asset.data
    const keys: (keyof typeof d)[] = ['x0', 'showSecant', 'h', 'showDerivTrace', 'a', 'b', 'riemann', 'N', 'showF']
    for (const k of keys) {
      const v = d[k as keyof typeof d]
      if (v !== undefined && (card.opts as Record<string, unknown>)[k as string] !== v) {
        card.setOption(k as never, v as never)
      }
    }
  },
)

/* ────── emit helpers ────── */

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!card) return
    // ВАЖЛИВО: включаємо expr щоб live-editing (live `card.setExpression`)
    // не перетирався back-watch-ем після emit. Раніше snapshot містив тільки
    // x0/a/b/viewport, а watch порівнював `card.opts.expr` (cos(x)) з
    // `props.asset.data.expr` (x^2) → відрізнялось → resetting expr назад.
    const patched: CalculusAsset = {
      ...props.asset,
      data: {
        ...props.asset.data,
        expr: card.opts.expr,
        x0: card.opts.x0,
        a: card.opts.a,
        b: card.opts.b,
        viewport: { ...card.viewport },
      },
    }
    emit('update:asset', patched)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function patch(updates: Partial<CalculusAsset['data']>): void {
  emit('update:asset', {
    ...props.asset,
    data: { ...props.asset.data, ...updates },
  })
}

function toggle(key: 'showSecant' | 'showDerivTrace' | 'showF'): void {
  patch({ [key]: !props.asset.data[key] } as Partial<CalculusAsset['data']>)
}

function setRiemann(mode: RiemannMode): void {
  patch({ riemann: mode })
}

function onHChange(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) patch({ h: v })
}

function onNChange(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (Number.isFinite(v)) patch({ N: v })
}

function onExprInput(): void {
  // Direct engine update — instant graph redraw на кожен символ.
  // Bundle's setExpression parse-ить + scheduleRender(rAF) — graph оновлюється
  // у наступному frame (~16ms). Snapshot емітиться через card.onChange →
  // scheduleSnapshot (150ms debounce), тому store не страждає від типу-flood.
  if (card) card.setExpression(exprDraft.value)
}

function onExprCommit(): void {
  if (exprDraft.value !== props.asset.data.expr) {
    patch({ expr: exprDraft.value })
  }
}

function onExprPreset(expr: string): void {
  // Update input value, engine directly, AND store — all three sync щоб
  // не чекати reactive flush. Раніше тільки patch() → watch → setExpression
  // мав delay у який graph не оновлювався поки watch не fired.
  exprDraft.value = expr
  if (card) card.setExpression(expr)
  patch({ expr })
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
.calculus-renderer {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}

/* Read-only (pen/highlighter/etc.) — overlay прозорий + всі pointer-events: none. */
.calculus-renderer.is-readonly {
  background: transparent;
}
.calculus-renderer.is-readonly .calculus-stage {
  pointer-events: none;
}
.calculus-renderer.is-readonly .calculus-header,
.calculus-renderer.is-readonly .calculus-toolbar {
  display: none;
}

.calculus-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(196, 98, 42, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  cursor: grab;
  user-select: none;
}

.calculus-renderer.is-selected .calculus-header {
  background: rgba(196, 98, 42, 0.16);
}

.calculus-title {
  flex: 0 0 auto;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}

.calculus-expr-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 4px;
  font: 12px 'JetBrains Mono', monospace;
  background: #fffaf0;
  color: #1e293b;
  pointer-events: auto;
  outline: none;
}

.calculus-expr-input:focus { border-color: #c4622a; }

.calculus-expr-readonly {
  flex: 1 1 auto;
  min-width: 0;
  font: 12px 'JetBrains Mono', monospace;
  color: #5a4a3a;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calculus-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

.calculus-toolbar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: rgba(196, 98, 42, 0.04);
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  pointer-events: auto;
}

.calculus-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.calc-preset, .calc-tool {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 4px;
  background: #fffaf0;
  color: #5a4a3a;
  cursor: pointer;
  user-select: none;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.calc-preset:hover, .calc-tool:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}

.calc-preset.is-active, .calc-tool.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}

.calc-tool--seg {
  min-width: 26px;
  text-align: center;
}

.calc-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 11px 'JetBrains Mono', monospace;
  color: #5a4a3a;
}

.calc-slider input[type=range] {
  width: 80px;
  accent-color: #c4622a;
}

.calc-slider-val {
  min-width: 30px;
  text-align: right;
  color: #c4622a;
}

.calc-mini-label {
  font: 11px 'JetBrains Mono', monospace;
  color: #5a4a3a;
}

.calculus-delete {
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

.calculus-renderer.is-readonly .calculus-delete {
  pointer-events: none;
  opacity: 0.4;
}

.calculus-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
