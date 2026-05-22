<!--
  Helix renderer — helix asset HTML overlay.
  Mirror pattern: TrigCircleRenderer.vue (local reactive state, debounce snapshot).

  POINTER-EVENTS MODEL:
    - Root = pointer-events:none → Konva proxy catches drag/select.
    - Stage canvas = auto (drag camera / click point).
    - Toolbar = auto.
    - Read-only mode: all = none.

  LOCAL STATE: local reactive mirror оновлюється миттєво при кліку (без 300мс лагу).
  animate + animateCamera — local-only (не персистяться).
-->
<template>
  <div
    class="helix-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
      'is-expanded': isExpanded,
    }"
    :data-testid="`helix-renderer-${asset.id}`"
  >
    <header class="helix-header">
      <span class="helix-title">{{ t('winterboard.helix.cardTitle') }}</span>
      <!-- Expand / collapse button — always visible -->
      <button
        type="button"
        class="helix-expand"
        :title="isExpanded ? 'Згорнути' : 'Розгорнути на цілу дошку'"
        @click.stop="$emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <button
        v-if="!asset.locked && isSelected && !isExpanded"
        type="button"
        class="helix-delete"
        :title="t('common.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <div ref="stageRef" class="helix-stage" data-testid="helix-stage" />

    <!-- Toolbar hidden: controls moved to HelixInspector sidebar.
         Card shows only the visualization — inspector in sidebar handles all interactions. -->
    <div v-if="false" class="helix-toolbar">
      <!-- Рядок 1: огляд + тіні + допоміжне -->
      <div class="helix-toolbar__row">
        <span class="helix-glabel">огляд:</span>
        <button
          v-for="v in VIEW_PRESETS"
          :key="v.name"
          type="button"
          class="helix-btn"
          @click.stop="setView(v.name)"
          @mousedown.stop
          @pointerdown.stop
        >{{ v.label }}</button>

        <span class="helix-sep" />

        <span class="helix-glabel">тіні:</span>
        <button
          v-for="s in SHADOW_TOGGLES"
          :key="s.key"
          type="button"
          class="helix-btn"
          :class="{ 'is-active': !!local[s.key] }"
          @click.stop="toggle(s.key)"
          @mousedown.stop
          @pointerdown.stop
        >{{ s.label }}</button>

        <span class="helix-sep" />

        <span class="helix-glabel">вигляд:</span>
        <button
          v-for="d in DISPLAY_TOGGLES"
          :key="d.key"
          type="button"
          class="helix-btn"
          :class="{ 'is-active': !!local[d.key] }"
          @click.stop="toggle(d.key)"
          @mousedown.stop
          @pointerdown.stop
        >{{ d.label }}</button>
      </div>

      <!-- Рядок 2: рух + швидкість + пресети θ -->
      <div class="helix-toolbar__row">
        <span class="helix-glabel">рух:</span>

        <button
          type="button"
          class="helix-btn"
          :class="{ 'is-active': animating }"
          @click.stop="toggleAnimate"
          @mousedown.stop
          @pointerdown.stop
        >▶ обертати θ</button>

        <button
          type="button"
          class="helix-btn"
          :class="{ 'is-active': animatingCam }"
          @click.stop="toggleAnimateCam"
          @mousedown.stop
          @pointerdown.stop
        >↻ камеру</button>

        <button
          type="button"
          class="helix-btn"
          :class="{ 'is-active': local.emitMode }"
          @click.stop="toggle('emitMode')"
          @mousedown.stop
          @pointerdown.stop
        >⤴ хвиля з точки</button>

        <span class="helix-sep" />

        <label class="helix-slider">
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
          <span class="helix-slider-val">{{ speedLabel }}</span>
        </label>

        <span class="helix-sep" />

        <span class="helix-glabel">θ→</span>
        <button
          v-for="p in ANGLE_PRESETS"
          :key="p.label"
          type="button"
          class="helix-btn helix-btn--angle"
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
import type { HelixAsset, HelixData } from '../../../types/helix'
import type { HelixInstance, HelixViewName } from '../../../vendor/helix'
import { registerHelix, unregisterHelix } from '../../../board/state/helixUiState'
import type { HelixBridge } from '../../../board/state/helixUiState'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: HelixAsset
    isSelected?: boolean
    interactive?: boolean
    isExpanded?: boolean
  }>(),
  { isSelected: false, interactive: true, isExpanded: false },
)

const emit = defineEmits<{
  'update:asset': [asset: HelixAsset]
  delete: []
  expand: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let helix: HelixInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_DEBOUNCE_MS = 300

/** Local-only runtime state — не персистяться. */
const animating    = ref(false)
const animatingCam = ref(false)

/* ────── toolbar definitions ────── */

type LocalState = Omit<HelixData, 'version' | 'theta' | 'phi' | 'pitch'>

const VIEW_PRESETS: { name: HelixViewName; label: string }[] = [
  { name: '3d',     label: '3D'    },
  { name: 'iso',    label: 'ізо'   },
  { name: 'circle', label: '○ коло' },
  { name: 'sin',    label: '∿ sin' },
  { name: 'cos',    label: '∿ cos' },
]

const SHADOW_TOGGLES = [
  { key: 'showHelix'  as const, label: 'гелікс' },
  { key: 'showSin'    as const, label: 'sin'    },
  { key: 'showCos'    as const, label: 'cos'    },
  { key: 'showCircle' as const, label: 'коло'   },
]

const DISPLAY_TOGGLES = [
  { key: 'showWalls'      as const, label: 'стіни'         },
  { key: 'showDropLines'  as const, label: 'лінії скидання' },
  { key: 'showAxisLabels' as const, label: 'підписи θ'     },
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

/**
 * LOCAL STATE MIRROR — mirror pattern від TrigCircleRenderer.
 * Оновлюється миттєво при кліку, без 300мс лагу snapshot → store → props.
 * Sync: watch(props.asset.data) → local + engine (remote ops).
 */
const local = reactive<LocalState>({
  showHelix:      props.asset.data.showHelix,
  showSin:        props.asset.data.showSin,
  showCos:        props.asset.data.showCos,
  showCircle:     props.asset.data.showCircle,
  showWalls:      props.asset.data.showWalls,
  showDropLines:  props.asset.data.showDropLines,
  showAxisLabels: props.asset.data.showAxisLabels,
  emitMode:       props.asset.data.emitMode,
  speed:          props.asset.data.speed,
})

const speedLabel = computed(() =>
  local.speed.toFixed(1).replace('.', ',') + '×',
)

/* ────── lifecycle ────── */

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/helix')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return
  const W = window as unknown as { HelixView: new (
    el: HTMLElement,
    o: import('../../../vendor/helix').HelixOpts,
  ) => HelixInstance }

  const d = props.asset.data
  helix = new W.HelixView(stageRef.value, {
    theta:          d.theta,
    phi:            d.phi,
    pitch:          d.pitch,
    showHelix:      d.showHelix,
    showSin:        d.showSin,
    showCos:        d.showCos,
    showCircle:     d.showCircle,
    showWalls:      d.showWalls,
    showDropLines:  d.showDropLines,
    showAxisLabels: d.showAxisLabels,
    animate:        false,         // never auto-start
    animateCamera:  false,
    emitMode:       d.emitMode,
    speed:          d.speed,
  })

  helix.onChange = () => scheduleSnapshot()
  // Sync pointer-events after vendor canvas is created (draw-mode isolation).
  syncCanvasPointerEvents()
  // Register for inspector if already selected when mounted.
  if (props.isSelected) registerHelix(props.asset.id, _bridge)
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

function destroyHelix(): void {
  animating.value    = false
  animatingCam.value = false
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (helix) {
    try { helix.destroy() } catch { /* idempotent */ }
    helix = null
  }
}

function _onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && props.isExpanded) emit('expand') }

onMounted(() => {
  void mount()
  window.addEventListener('keydown', _onEsc)
})
onUnmounted(() => {
  destroyHelix()
  window.removeEventListener('keydown', _onEsc)
  unregisterHelix(props.asset.id)
})

/* ────── remote-op sync: store → local + engine ────── */

const SYNC_KEYS: (keyof LocalState)[] = [
  'showHelix', 'showSin', 'showCos', 'showCircle',
  'showWalls', 'showDropLines', 'showAxisLabels',
  'emitMode', 'speed',
]

watch(
  () => SYNC_KEYS.map((k) => props.asset.data[k]),
  () => {
    if (!helix) return
    const d = props.asset.data
    for (const k of SYNC_KEYS) {
      const storeVal = d[k]
      if (storeVal === undefined) continue
      if ((local[k] as unknown) !== storeVal) {
        (local as Record<string, unknown>)[k] = storeVal
      }
      if ((helix.opts as Record<string, unknown>)[k as string] !== storeVal) {
        helix.setOption(k as never, storeVal as never)
      }
    }
  },
)

watch(() => props.asset.data.theta, (next) => {
  if (!helix) return
  if (Math.abs(helix.opts.theta - next) > 0.0001) helix.setTheta(next)
})

watch(() => [props.asset.data.phi, props.asset.data.pitch], ([phi, pitch]) => {
  if (!helix) return
  if (Math.abs(helix.opts.phi - phi) > 0.1) helix.setOption('phi', phi)
  if (Math.abs(helix.opts.pitch - pitch) > 0.1) helix.setOption('pitch', pitch)
})

/* ────── toolbar handlers ────── */

function toggle(key: keyof LocalState): void {
  if (!helix) return
  const next = !local[key]
  ;(local as Record<string, unknown>)[key] = next
  helix.setOption(key as never, next as never)
  // onChange → scheduleSnapshot
}

function setView(name: HelixViewName): void {
  if (!helix) return
  helix.setView(name)
  // setView does animated transition — snapshot fires via onChange when render calls onChange
  // Schedule manually since setView doesn't call onChange directly
  scheduleSnapshot()
}

function jumpTo(theta: number): void {
  if (!helix) return
  helix.setTheta(theta)
}

function toggleAnimate(): void {
  if (!helix) return
  const next = !animating.value
  animating.value = next
  helix.setOption('animate', next)
}

function toggleAnimateCam(): void {
  if (!helix) return
  const next = !animatingCam.value
  animatingCam.value = next
  helix.setOption('animateCamera', next)
}

function onSpeedInput(e: Event): void {
  if (!helix) return
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  local.speed = v
  helix.setOption('speed', v)
}

/** Called by HelixInspector slider via bridge. */
function setSpeed(v: number): void {
  if (!helix) return
  local.speed = v
  helix.setOption('speed', v)
}

/* ── Inspector bridge ─────────────────────────────────────────────────────
   Registered when isSelected=true; HelixInspector reads reactive state
   and calls action methods. Pattern mirrors TrigCircleRenderer.
──────────────────────────────────────────────────────────────────────────── */
const _bridge: HelixBridge = reactive({
  local,            // already reactive — Inspector reads local.showHelix etc. live
  animating: false, // synced via watchEffect below
  animatingCam: false,
  toggle,
  setView,
  jumpTo,
  setSpeed,
  toggleAnimate,
  toggleAnimateCam,
})

// Keep bridge.animating / animatingCam in sync with Ref values.
watchEffect(() => {
  _bridge.animating    = animating.value
  _bridge.animatingCam = animatingCam.value
})

// Register / unregister inspector when selection changes.
watch(() => props.isSelected, (sel) => {
  if (sel) registerHelix(props.asset.id, _bridge)
  else unregisterHelix(props.asset.id)
})

/* ────── snapshot → store ────── */

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!helix) return
    const o = helix.opts
    const patched: HelixAsset = {
      ...props.asset,
      data: {
        version:        1,
        theta:          o.theta,
        phi:            o.phi,
        pitch:          o.pitch,
        showHelix:      o.showHelix,
        showSin:        o.showSin,
        showCos:        o.showCos,
        showCircle:     o.showCircle,
        showWalls:      o.showWalls,
        showDropLines:  o.showDropLines,
        showAxisLabels: o.showAxisLabels,
        emitMode:       o.emitMode,
        speed:          o.speed,
      },
    }
    emit('update:asset', patched)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
.helix-renderer {
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

.helix-renderer.is-readonly {
  background: transparent;
}
.helix-renderer.is-readonly .helix-stage {
  pointer-events: none;
}
.helix-renderer.is-readonly .helix-header,
.helix-renderer.is-readonly .helix-toolbar {
  display: none;
}

/* ── Header ── */
.helix-header {
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
.helix-renderer.is-selected .helix-header {
  background: rgba(196, 98, 42, 0.16);
}
.helix-title {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}

/* ── Stage ── */
.helix-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

/* ── Toolbar ── */
.helix-toolbar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 7px;
  background: rgba(196, 98, 42, 0.04);
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  pointer-events: auto;
}
.helix-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}
.helix-glabel {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8a7860;
  margin-right: 1px;
  white-space: nowrap;
  flex-shrink: 0;
}
.helix-sep {
  width: 1px;
  height: 16px;
  background: rgba(43, 33, 24, 0.15);
  margin: 0 3px;
  flex-shrink: 0;
}
.helix-btn {
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
.helix-btn:hover {
  background: #f1e4d6;
  border-color: #c4622a;
}
.helix-btn.is-active {
  background: #c4622a;
  border-color: #c4622a;
  color: #fffaf0;
}
.helix-btn--angle {
  padding: 3px 5px;
  min-width: 26px;
  text-align: center;
  font-size: 10px;
}
.helix-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 10px 'JetBrains Mono', monospace;
  color: #5a4a3a;
}
.helix-slider input[type=range] {
  width: 72px;
  accent-color: #c4622a;
}
.helix-slider-val {
  min-width: 26px;
  text-align: right;
  color: #c4622a;
  font-size: 10px;
}
.helix-delete {
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
.helix-renderer.is-readonly .helix-delete {
  pointer-events: none;
  opacity: 0.4;
}
.helix-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}

/* ── Expand button ── */
.helix-expand {
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
.helix-expand:hover {
  background: #475569;
  border-color: #94a3b8;
}
.helix-renderer.is-readonly .helix-expand {
  pointer-events: none;
  opacity: 0.35;
}

/* ── Board-expanded (overlay розширено WBCanvas до inset:0) ── */
.helix-renderer.is-expanded {
  border-radius: 0;
}
.helix-renderer.is-expanded .helix-header {
  cursor: default;
  padding: 6px 12px;
  font-size: 13px;
  background: rgba(196, 98, 42, 0.14);
}
.helix-renderer.is-expanded .helix-expand {
  width: 24px;
  height: 24px;
  font-size: 13px;
}
.helix-renderer.is-expanded .helix-toolbar {
  padding: 7px 10px;
}
</style>
