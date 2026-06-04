<!--
  TrigCircle renderer — trig_circle asset HTML overlay.

  Mirror pattern: CalculusRenderer.vue (bundle-backed, HTML overlay, Konva proxy
  catches selection, draw-tools пропускаються наскрізь у read-only).

  Bundle: vendor/trig/* — window.TrigCircle exposed after side-effect import.

  POINTER-EVENTS MODEL:
    - Root .trig-circle-renderer = pointer-events:none → Konva proxy catches drag/select.
    - Stage canvas = auto (drag point P).
    - Toolbar = auto (toggles / sliders / presets).
    - У read-only mode: all = none.

  PERSISTENCE:
    opts → onChange callback → debounce 300ms → emit asset_update.
    animate + partialCurves — local-only (not persisted).

  LOCAL STATE RATIONALE:
    toggle() / jumpTo() / onSpeedInput() читають та оновлюють `local` reactive mirror
    миттєво, не чекаючи 300мс snapshot → store → props cycle.
    Без цього швидкий подвійний клік читає застарілий props.asset.data і
    обидва кліки йдуть в одну сторону (один з них — no-op).
    remote ops sync: watch на props.asset.data → оновлює local + engine.
-->
<template>
  <div
    class="trig-circle-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
      'is-expanded': isExpanded,
    }"
    :data-testid="`trig-circle-renderer-${asset.id}`"
  >
    <header class="trig-circle-header">
      <span class="trig-circle-title">{{ t('winterboard.trigCircle.cardTitle') }}</span>
      <!-- HUD toggle — show/hide values overlay (θ, sin, cos, tg, ctg) -->
      <button
        type="button"
        class="trig-circle-hud-toggle"
        :class="{ 'is-active': local.showHud }"
        :title="local.showHud ? 'Приховати значення' : 'Показати значення'"
        @click.stop="toggle('showHud')"
        @mousedown.stop
        @pointerdown.stop
      >ⓘ</button>
      <!-- Expand / collapse button — always visible -->
      <button
        type="button"
        class="trig-circle-expand"
        :title="isExpanded ? 'Згорнути' : 'Розгорнути на цілу дошку'"
        @click.stop="$emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <button
        v-if="!asset.locked && isSelected && !isExpanded"
        type="button"
        class="trig-circle-delete"
        :title="t('common.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <!-- Stage — canvas mounted by bundle's TrigCircle. -->
    <div
      ref="stageRef"
      class="trig-circle-stage"
      :class="{ 'trig-hud-off': !local.showHud }"
      data-testid="trig-circle-stage"
    />

    <!-- Toolbar hidden: controls moved to TrigCircleInspector sidebar.
         Card shows only the visualization — inspector in sidebar handles all interactions. -->
    <div v-if="false" class="trig-toolbar">
      <!-- Рядок 1: функції + підписи + сітка -->
      <div class="trig-toolbar__row">
        <span class="trig-group-label">функції:</span>
        <button
          v-for="fn in FUNC_TOGGLES"
          :key="fn.key"
          type="button"
          class="trig-btn"
          :class="{ 'is-active': !!local[fn.key] }"
          @click.stop="toggle(fn.key)"
          @mousedown.stop
          @pointerdown.stop
        >{{ fn.label }}</button>

        <span class="trig-sep" />

        <span class="trig-group-label">підписи:</span>
        <button
          v-for="lb in LABEL_TOGGLES"
          :key="lb.key"
          type="button"
          class="trig-btn"
          :class="{ 'is-active': !!local[lb.key] }"
          @click.stop="toggle(lb.key)"
          @mousedown.stop
          @pointerdown.stop
        >{{ lb.label }}</button>

        <span class="trig-sep" />

        <span class="trig-group-label">сітка:</span>
        <button
          v-for="gr in GRID_TOGGLES"
          :key="gr.key"
          type="button"
          class="trig-btn"
          :class="{ 'is-active': !!local[gr.key] }"
          @click.stop="toggle(gr.key)"
          @mousedown.stop
          @pointerdown.stop
        >{{ gr.label }}</button>
      </div>

      <!-- Рядок 2: рух + швидкість + пресети кутів -->
      <div class="trig-toolbar__row">
        <span class="trig-group-label">рух:</span>

        <button
          type="button"
          class="trig-btn"
          :class="{ 'is-active': drawMode }"
          @click.stop="toggleDraw"
          @mousedown.stop
          @pointerdown.stop
        >✎ Синусоїда</button>

        <button
          type="button"
          class="trig-btn"
          :class="{ 'is-active': animating }"
          @click.stop="toggleAnimate"
          @mousedown.stop
          @pointerdown.stop
        >▶ Обертання</button>

        <button
          type="button"
          class="trig-btn"
          :class="{ 'is-active': local.snapPi12 }"
          @click.stop="toggle('snapPi12')"
          @mousedown.stop
          @pointerdown.stop
        >snap π/12</button>

        <span class="trig-sep" />

        <label class="trig-slider">
          <span>швидкість</span>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            :value="local.speed"
            @input="onSpeedInput"
            @mousedown.stop
            @pointerdown.stop
          />
          <span class="trig-slider-val">{{ speedLabel }}</span>
        </label>

        <span class="trig-sep" />

        <span class="trig-group-label">θ→</span>
        <button
          v-for="p in ANGLE_PRESETS"
          :key="p.label"
          type="button"
          class="trig-btn trig-btn--angle"
          @click.stop="jumpTo(p.t)"
          @mousedown.stop
          @pointerdown.stop
        >{{ p.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrigCircleAsset, TrigCircleData } from '../../../types/trigCircle'
import type { TrigCircleInstance } from '../../../vendor/trig'
import { registerTrigCircle, unregisterTrigCircle } from '../../../board/state/trigCircleUiState'
import type { TrigCircleBridge } from '../../../board/state/trigCircleUiState'
// EXPORT_PREPARATION_SSOT (Stage 1 PR-2): thin-adapter widget snapshot.
// INV-EP-8: NO widget business logic — only DOM canvas/svg snapshot.
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: TrigCircleAsset
    isSelected?: boolean
    interactive?: boolean
    isExpanded?: boolean
  }>(),
  { isSelected: false, interactive: true, isExpanded: false },
)

const emit = defineEmits<{
  'update:asset': [asset: TrigCircleAsset]
  delete: []
  expand: []
}>()

const stageRef = ref<HTMLElement | null>(null)

// EXPORT_PREPARATION_SSOT INV-EP-8: thin adapter — snapshotElement лише
// grabs первого canvas/svg всередині stageRef. NO business logic тут.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

let trig: TrigCircleInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_DEBOUNCE_MS = 300

/** Local-only runtime state — not persisted. */
const animating = ref(false)
const drawMode  = ref(false)

/**
 * LOCAL STATE MIRROR — читати/писати тільки звідси у toggle/jumpTo/onSpeedInput.
 *
 * Чому потрібно: props.asset.data оновлюється лише після 300мс snapshot → emit → store.
 * Якщо toggle читає props.asset.data, то 2-й швидкий клік бачить застарілий стан і
 * йде в ту ж сторону що й 1-й (no-op). local оновлюється миттєво → кнопки реагують.
 *
 * Синхронізація:
 *   local → engine:  toggle() / jumpTo() / onSpeedInput()
 *   engine → store:  onChange() → scheduleSnapshot() → emit (300ms debounce)
 *   store → local:   watch(props.asset.data SYNC_KEYS) → оновити local + engine
 */
type LocalState = {
  showSin: boolean; showCos: boolean; showTan: boolean; showCot: boolean
  showSpecialPoints: boolean; showRefLabels: boolean
  showDeg: boolean; showRad: boolean
  showExactGrid: boolean; showInscribed: boolean
  showGraphs: boolean; snapPi12: boolean; showHud: boolean; speed: number
}

const local = reactive<LocalState>({
  showSin:           props.asset.data.showSin,
  showCos:           props.asset.data.showCos,
  showTan:           props.asset.data.showTan,
  showCot:           props.asset.data.showCot,
  showSpecialPoints: props.asset.data.showSpecialPoints,
  showRefLabels:     props.asset.data.showRefLabels,
  showDeg:           props.asset.data.showDeg,
  showRad:           props.asset.data.showRad,
  showExactGrid:     props.asset.data.showExactGrid,
  showInscribed:     props.asset.data.showInscribed,
  showGraphs:        props.asset.data.showGraphs,
  snapPi12:          props.asset.data.snapPi12,
  // Older assets may not have showHud → default to true (backward compat).
  showHud:           props.asset.data.showHud ?? true,
  speed:             props.asset.data.speed,
})

/* ────── toolbar definitions ────── */

const FUNC_TOGGLES = [
  { key: 'showSin' as const, label: 'sin' },
  { key: 'showCos' as const, label: 'cos' },
  { key: 'showTan' as const, label: 'tg'  },
  { key: 'showCot' as const, label: 'ctg' },
]

const LABEL_TOGGLES = [
  { key: 'showDeg'       as const, label: 'градуси'  },
  { key: 'showRad'       as const, label: 'радіани'  },
  { key: 'showRefLabels' as const, label: 'значення' },
]

const GRID_TOGGLES = [
  { key: 'showExactGrid'     as const, label: 'осі ½·√2/2·√3/2' },
  { key: 'showInscribed'     as const, label: 'вписані фігури'  },
  { key: 'showSpecialPoints' as const, label: 'особл. точки'    },
]

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
  local.speed.toFixed(1).replace('.', ',') + '×',
)

/* ────── lifecycle ────── */

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return
  const W = window as unknown as { TrigCircle: new (
    el: HTMLElement,
    o: import('../../../vendor/trig').TrigCircleOpts,
  ) => TrigCircleInstance }

  const d = props.asset.data
  trig = new W.TrigCircle(stageRef.value, {
    theta:             d.theta,
    showSin:           d.showSin,
    showCos:           d.showCos,
    showTan:           d.showTan,
    showCot:           d.showCot,
    showSpecialPoints: d.showSpecialPoints,
    showRefLabels:     d.showRefLabels,
    showDeg:           d.showDeg,
    showRad:           d.showRad,
    showExactGrid:     d.showExactGrid,
    showInscribed:     d.showInscribed,
    showGraphs:        d.showGraphs,
    snapPi12:          d.snapPi12,
    showHud:           d.showHud ?? true,
    animate:           false,  // never auto-start on mount
    speed:             d.speed,
    partialCurves:     false,
  })

  trig.onChange = () => scheduleSnapshot()
  // Sync pointer-events after vendor canvas is created (draw-mode isolation).
  syncCanvasPointerEvents()
  // Register for inspector if already selected when mounted.
  if (props.isSelected) registerTrigCircle(props.asset.id, _bridge)
}

// ── Draw-mode canvas isolation ────────────────────────────────────────────
// When the user is in pen/draw mode (props.interactive === false), the vendor
// canvas inside stageRef must NOT capture pointer events so pen strokes pass
// through. CSS `pointer-events: none` on parent div doesn't suppress HTML
// <canvas> children (pointer-events doesn't inherit in HTML), so set inline.
function syncCanvasPointerEvents(): void {
  const el = stageRef.value
  if (!el) return
  const val = props.interactive ? '' : 'none'
  // Set on the container div itself (CSS cascade base) AND all descendants
  // explicitly — vendor libraries may create intermediate wrapper divs that
  // have pointer-events:auto by default, and may set inline pointer-events
  // on their canvas elements. querySelectorAll('canvas') is not enough.
  ;(el as HTMLElement).style.pointerEvents = val
  el.querySelectorAll('*').forEach((child) => {
    ;(child as HTMLElement).style.pointerEvents = val
  })
}

watch(() => props.interactive, syncCanvasPointerEvents)

function destroyTrig(): void {
  animating.value = false
  drawMode.value  = false
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (trig) {
    try { trig.destroy() } catch { /* idempotent */ }
    trig = null
  }
}

function _onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && props.isExpanded) emit('expand') }

onMounted(() => {
  void mount()
  window.addEventListener('keydown', _onEsc)
})
onUnmounted(() => {
  destroyTrig()
  window.removeEventListener('keydown', _onEsc)
  unregisterTrigCircle(props.asset.id)
})

/* ────── remote-op sync: store → local + engine ────── */

const SYNC_KEYS: (keyof LocalState)[] = [
  'showSin', 'showCos', 'showTan', 'showCot',
  'showSpecialPoints', 'showRefLabels',
  'showDeg', 'showRad',
  'showExactGrid', 'showInscribed',
  'showGraphs', 'snapPi12', 'showHud', 'speed',
]

watch(
  () => SYNC_KEYS.map((k) => props.asset.data[k]),
  () => {
    if (!trig) return
    const d = props.asset.data
    for (const k of SYNC_KEYS) {
      const storeVal = d[k]
      if (storeVal === undefined) continue
      if ((local[k] as unknown) !== storeVal) {
        // Update local mirror first (no reactivity loop — watch reads props not local)
        (local as Record<string, unknown>)[k] = storeVal
      }
      if ((trig.opts as Record<string, unknown>)[k as string] !== storeVal) {
        trig.setOption(k as never, storeVal as never)
      }
    }
  },
)

watch(
  () => props.asset.data.theta,
  (next) => {
    if (!trig) return
    if (Math.abs(trig.opts.theta - next) > 0.0001) trig.setTheta(next)
  },
)

/* ────── toolbar handlers ────── */

/** Toggle boolean opt: updates local mirror immediately, engine syncs, onChange → snapshot. */
function toggle(key: keyof LocalState): void {
  if (!trig) return
  const next = !local[key]
  ;(local as Record<string, unknown>)[key] = next  // immediate UI update
  trig.setOption(key as never, next as never)       // onChange → scheduleSnapshot
}

function jumpTo(theta: number): void {
  if (!trig) return
  if (drawMode.value) {
    drawMode.value = false
    trig.setOption('partialCurves', false)
    trig.setOption('animate', false)
    animating.value = false
  }
  trig.setTheta(theta)
}

function toggleAnimate(): void {
  if (!trig) return
  if (drawMode.value) {
    drawMode.value = false
    trig.setOption('partialCurves', false)
  }
  const next = !animating.value
  animating.value = next
  trig.setOption('animate', next)
}

function toggleDraw(): void {
  if (!trig) return
  const next = !drawMode.value
  drawMode.value = next
  if (next) {
    if (animating.value) { animating.value = false; trig.setOption('animate', false) }
    trig.setTheta(0)
    trig.setOption('partialCurves', true)
    trig.setOption('animate', true)
    animating.value = true
  } else {
    trig.setOption('partialCurves', false)
    trig.setOption('animate', false)
    animating.value = false
  }
}

function onSpeedInput(e: Event): void {
  if (!trig) return
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  local.speed = v                    // immediate label update
  trig.setOption('speed', v)         // onChange → scheduleSnapshot
}

/** Called by TrigCircleInspector slider via bridge. */
function setSpeed(v: number): void {
  if (!trig) return
  local.speed = v
  trig.setOption('speed', v)
}

/* ── Inspector bridge ─────────────────────────────────────────────────────
   Registered when isSelected=true; TrigCircleInspector reads reactive state
   and calls action methods. Pattern mirrors Nmt3dRenderer._registerInspector.
──────────────────────────────────────────────────────────────────────────── */
const _bridge: TrigCircleBridge = reactive({
  local,          // already reactive — Inspector reads local.showSin etc. live
  animating: false,    // synced via watchEffect below
  drawMode: false,     // synced via watchEffect below
  toggle,
  jumpTo,
  setSpeed,
  toggleAnimate,
  toggleDraw,
})

// Keep bridge.animating / bridge.drawMode in sync with the Ref values.
watchEffect(() => {
  _bridge.animating = animating.value
  _bridge.drawMode  = drawMode.value
})

// Register / unregister inspector when selection changes.
watch(() => props.isSelected, (sel) => {
  if (sel) registerTrigCircle(props.asset.id, _bridge)
  else unregisterTrigCircle(props.asset.id)
})

/* ────── snapshot → store ────── */

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!trig) return
    const o = trig.opts
    const patched: TrigCircleAsset = {
      ...props.asset,
      data: {
        version:           1,
        theta:             o.theta,
        showSin:           o.showSin,
        showCos:           o.showCos,
        showTan:           o.showTan,
        showCot:           o.showCot,
        showSpecialPoints: o.showSpecialPoints,
        showRefLabels:     o.showRefLabels,
        showDeg:           o.showDeg,
        showRad:           o.showRad,
        showExactGrid:     o.showExactGrid,
        showInscribed:     o.showInscribed,
        showGraphs:        o.showGraphs,
        snapPi12:          o.snapPi12,
        showHud:           o.showHud,
        speed:             o.speed,
      },
    }
    emit('update:asset', patched)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
.trig-circle-renderer {
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

.trig-circle-renderer.is-readonly {
  background: transparent;
}
.trig-circle-renderer.is-readonly .trig-circle-stage {
  pointer-events: none;
}
.trig-circle-renderer.is-readonly .trig-circle-header,
.trig-circle-renderer.is-readonly .trig-toolbar {
  display: none;
}

/* ── Header ── */
.trig-circle-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(168, 58, 91, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  cursor: grab;
  user-select: none;
}

.trig-circle-renderer.is-selected .trig-circle-header {
  background: rgba(168, 58, 91, 0.16);
}

.trig-circle-title {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}

/* ── Stage ── */
.trig-circle-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

/* ── HUD (values overlay injected by vendor TrigCircle into stageRef) ──
   Provide own positioning so this component does NOT depend on calculus.css
   being loaded (calculus.css loads only when a CalculusCard is on the board).
   Uses :deep() to pierce the Vue scoping boundary (vendor-created DOM node). */
.trig-circle-stage :deep(.calc-hud) {
  position: absolute;
  top: 10px;
  left: 10px;
  pointer-events: none;
  z-index: 4;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.55;
  background: rgba(255, 250, 240, 0.88);
  border: 1px solid rgba(43, 33, 24, 0.10);
  border-radius: 8px;
  padding: 8px 10px;
  backdrop-filter: blur(4px);
  max-width: 340px;
  color: #2b2118;
}
.trig-circle-stage :deep(.calc-hud .calc-line) {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}
.trig-circle-stage :deep(.calc-hud .calc-line span) {
  color: #8a7860;
  font-size: 11px;
  margin-right: 2px;
}
.trig-circle-stage :deep(.calc-hud .calc-line.key) {
  font-weight: 600;
  margin-top: 2px;
}
.trig-circle-stage :deep(.calc-hud .calc-line.key span) {
  color: #c4622a;
  font-weight: 600;
}
.trig-circle-stage :deep(.calc-hud .calc-line small) {
  color: #8a7860;
  font-size: 10px;
  margin-left: 4px;
}
/* Hide HUD when trig-hud-off class is present */
.trig-circle-stage.trig-hud-off :deep(.calc-hud) {
  display: none;
}

/* ── Toolbar ── */
.trig-toolbar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 7px;
  background: rgba(168, 58, 91, 0.04);
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  pointer-events: auto;
}

.trig-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

.trig-group-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8a7860;
  margin-right: 1px;
  white-space: nowrap;
  flex-shrink: 0;
}

.trig-sep {
  width: 1px;
  height: 16px;
  background: rgba(43, 33, 24, 0.15);
  margin: 0 3px;
  flex-shrink: 0;
}

.trig-btn {
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

.trig-btn:hover {
  background: #f1e4d6;
  border-color: #a83a5b;
}

.trig-btn.is-active {
  background: #a83a5b;
  border-color: #a83a5b;
  color: #fffaf0;
}

.trig-btn--angle {
  padding: 3px 5px;
  min-width: 26px;
  text-align: center;
  font-size: 10px;
}

.trig-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 10px 'JetBrains Mono', monospace;
  color: #5a4a3a;
}

.trig-slider input[type=range] {
  width: 72px;
  accent-color: #a83a5b;
}

.trig-slider-val {
  min-width: 26px;
  text-align: right;
  color: #a83a5b;
  font-size: 10px;
}

.trig-circle-delete {
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

.trig-circle-renderer.is-readonly .trig-circle-delete {
  pointer-events: none;
  opacity: 0.4;
}

.trig-circle-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}

/* ── HUD toggle button ── */
.trig-circle-hud-toggle {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.25);
  color: rgba(248, 250, 252, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.trig-circle-hud-toggle.is-active {
  background: rgba(15, 23, 42, 0.55);
  color: #f8fafc;
  border-color: rgba(148, 163, 184, 0.4);
}
.trig-circle-hud-toggle:hover {
  background: #475569;
  color: #f8fafc;
  border-color: #94a3b8;
}
.trig-circle-renderer.is-readonly .trig-circle-hud-toggle {
  display: none;
}

/* ── Expand button ── */
.trig-circle-expand {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.trig-circle-expand:hover {
  background: #475569;
  border-color: #94a3b8;
}
.trig-circle-renderer.is-readonly .trig-circle-expand {
  pointer-events: none;
  opacity: 0.35;
}

/* ── Board-expanded (overlay розширено WBCanvas до inset:0) ── */
.trig-circle-renderer.is-expanded {
  border-radius: 0;
}
.trig-circle-renderer.is-expanded .trig-circle-header {
  cursor: default;
  padding: 6px 12px;
  font-size: 13px;
  background: rgba(168, 58, 91, 0.14);
}
.trig-circle-renderer.is-expanded .trig-circle-expand {
  width: 24px;
  height: 24px;
  font-size: 13px;
}
.trig-circle-renderer.is-expanded .trig-toolbar {
  padding: 7px 10px;
}
</style>
