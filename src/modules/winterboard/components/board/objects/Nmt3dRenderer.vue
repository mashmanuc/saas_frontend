<!--
  Nmt3dRenderer — NMT3D stereometry widget HTML overlay.

  Mounts window.NMT3D.Workspace on stageRef.
  Two modes: 'adapt' (3D orbit + parametric handles) / 'draw' (frozen shape + pen layer).

  POINTER-EVENTS MODEL:
    - Root = pointer-events:none → Konva proxy catches drag/select.
    - Stage div = pointer-events:auto when (interactive AND isSelected) OR isExpanded.
        - Not selected, not expanded → clicks fall through to Konva → selection.
        - Selected or expanded → stage captures events → 3D orbit / draw strokes.
    - Header = pointer-events:none (falls through to Konva for card drag).
    - Expand button = pointer-events:auto (always — CSS override on header).
    - Mode toggle + delete = pointer-events:auto ONLY when isSelected=true.
    - Non-interactive (read-only / pen mode): stage = pointer-events:none always.
-->
<template>
  <div
    class="nmt3d-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
      'is-expanded': isExpanded,
    }"
    :data-testid="`nmt3d-renderer-${asset.id}`"
  >
    <!-- Header — pointer-events:none so card dragging works outside mode toggle -->
    <header class="nmt3d-header">
      <span class="nmt3d-card-title">{{ cardTitle }}</span>

      <!-- Expand / collapse — always visible, pointer-events:auto overrides header none -->
      <button
        type="button"
        class="nmt3d-expand-btn"
        :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
        @click.stop="$emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>

      <!-- Mode toggle — only visible when interactive AND this object is selected -->
      <div v-if="interactive && isSelected" class="nmt3d-mode-toggle" @mousedown.stop @pointerdown.stop>
        <button
          type="button"
          class="nmt3d-mode-btn"
          :class="{ 'is-active': localMode === 'adapt' }"
          :title="t('winterboard.widget.nmt3d.adaptHint')"
          @click.stop="setMode('adapt')"
        >{{ t('winterboard.widget.nmt3d.adaptMode') }}</button>
        <button
          type="button"
          class="nmt3d-mode-btn"
          :class="{ 'is-active': localMode === 'draw' }"
          :title="t('winterboard.widget.nmt3d.drawHint')"
          @click.stop="setMode('draw')"
        >{{ t('winterboard.widget.nmt3d.drawMode') }}</button>
      </div>

      <!-- Mode badge (read-only) -->
      <span v-else class="nmt3d-mode-badge">
        {{ localMode === 'draw' ? t('winterboard.widget.nmt3d.drawMode') : t('winterboard.widget.nmt3d.adaptMode') }}
      </span>

      <!-- Delete (selected + not locked + not expanded) -->
      <button
        v-if="!asset.locked && isSelected && !isExpanded"
        type="button"
        class="nmt3d-delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="$emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <!-- 3D workspace container -->
    <div
      ref="stageRef"
      class="nmt3d-stage"
      :data-testid="`nmt3d-stage-${asset.id}`"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Nmt3dAsset } from '../../../types/nmt3d'
import { NMT3D_TEMPLATE_LABELS } from '../../../constants/nmt3dDefaults'
import { registerNmt3dWorkspace, unregisterNmt3dWorkspace, nmt3dUiState } from '../../../board/state/nmt3dUiState'
import { getNmt3dEphemeralState, setNmt3dEphemeralState } from '../../../board/state/nmt3dEphemeralState'
// EXPORT_PREPARATION_SSOT (Stage 1 PR-2): thin-adapter widget snapshot.
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const props = withDefaults(
  defineProps<{
    asset: Nmt3dAsset
    isSelected?: boolean
    interactive?: boolean
    isExpanded?: boolean
    /**
     * Board mode passed from WBCanvas — 'edit' | 'replay' | etc.
     * REQUIRED for correct store→engine sync gate.
     *
     * Gate semantics:
     *   boardMode === 'edit'  → engine is source of truth (user drives params via NMT3D handles).
     *                           Params watcher MUST NOT call ws.setParams() — would create
     *                           feedback loop: setParams → onParamsChanged → store update →
     *                           watcher fires again → corrupt state after recording save.
     *   boardMode !== 'edit'  → store is source of truth (replay applier drives params).
     *                           Params watcher MUST call ws.setParams() to keep canvas in sync.
     *
     * NOTE: `interactive` prop alone is NOT sufficient as a gate — it becomes false also
     * when the user switches to draw/pen tool during live recording (currentTool !== 'select'),
     * which is NOT a replay scenario. Using boardMode eliminates this ambiguity.
     */
    boardMode?: string
  }>(),
  { isSelected: false, interactive: true, isExpanded: false, boardMode: 'edit' },
)

const emit = defineEmits<{
  'update:asset': [asset: Nmt3dAsset]
  delete: []
  expand: []
}>()

const stageRef = ref<HTMLElement | null>(null)

// EXPORT_PREPARATION_SSOT INV-EP-8: thin adapter, no business logic here.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

/** Local mode mirror — reflects asset.data.mode, updated immediately on toggle. */
const localMode = ref<'adapt' | 'draw'>(props.asset.data.mode)

let ws: any = null  // window.NMT3D.Workspace instance
let bundleReady = false

// ─── Camera persistence (interaction-end → emit asset_update with data.cam) ──
// Tracks last cam state we emitted to avoid duplicate ops when nothing changed.
let _lastEmittedCam: { yaw: number; pitch: number; scale: number } | null = null
// Wheel zoom debounce timer — wheel events have no native "end" event.
let _wheelDebounceTimer: number | null = null
const WHEEL_DEBOUNCE_MS = 150
// Track if the current pointer interaction STARTED inside our stage.
// Orbit gestures often end outside the stage div (user drags past the edge) —
// so checking e.target in pointerup is wrong. Instead track pointerdown origin.
let _orbitStartedInStage = false

function _camEqual(
  a: { yaw: number; pitch: number; scale: number } | null,
  b: { yaw: number; pitch: number; scale: number } | null,
): boolean {
  if (!a || !b) return false
  // Float epsilon: yaw/pitch ~1e-3 (radians), scale ~0.5 (display units)
  return Math.abs(a.yaw - b.yaw) < 0.001
    && Math.abs(a.pitch - b.pitch) < 0.001
    && Math.abs(a.scale - b.scale) < 0.5
}

/** Capture current ws.cam → emit asset_update with data.cam (if changed + edit mode). */
function _emitCamIfChanged(): void {
  if (!ws || !ws.cam) return
  if (props.boardMode !== 'edit') return
  const newCam = {
    yaw: ws.cam.yaw,
    pitch: ws.cam.pitch,
    scale: ws.cam.scale,
  }
  if (_camEqual(_lastEmittedCam, newCam)) return
  _lastEmittedCam = newCam
  // Read opts from engine (consistent with onParamsChanged fix).
  const currentOpts: Record<string, boolean> | undefined =
    ws?.opts && Object.keys(ws.opts).length > 0
      ? { ...ws.opts }
      : props.asset.data.opts
  emit('update:asset', {
    ...props.asset,
    data: {
      ...props.asset.data,
      cam: newCam,
      ...(currentOpts !== undefined ? { opts: currentOpts } : {}),
    },
  })
}

/**
 * Track pointerdown origin — orbit gestures often end outside the stage div
 * (user drags past the edge), so pointerup.target is the Konva canvas, not the
 * NMT3D canvas. Checking pointerup.target would always miss.
 * Instead: mark that the interaction STARTED inside our stage on pointerdown,
 * then emit cam on any pointerup that follows such a start.
 */
function _onWindowPointerDown(e: PointerEvent): void {
  if (!ws || !stageRef.value) return
  const target = e.target as Node | null
  _orbitStartedInStage = !!target && stageRef.value.contains(target)
}

function _onWindowPointerUp(_e: PointerEvent): void {
  if (!ws) return
  const wasOrbit = _orbitStartedInStage
  _orbitStartedInStage = false
  if (!wasOrbit) return
  _emitCamIfChanged()
}

function _onStageWheel(_e: WheelEvent): void {
  // Wheel = zoom. No "wheelend" event; debounce 150ms after last wheel.
  if (_wheelDebounceTimer !== null) {
    window.clearTimeout(_wheelDebounceTimer)
  }
  _wheelDebounceTimer = window.setTimeout(() => {
    _wheelDebounceTimer = null
    _emitCamIfChanged()
  }, WHEEL_DEBOUNCE_MS)
}

const { t, te } = useI18n()

const cardTitle = computed(() => {
  // i18n-first (2026-07-16): vendor TEMPLATES.name — укр хардкод, не перекладався
  // на en/ru. Ключі winterboard.nmt3d.template.<key> ×3 локалі; vendor = fallback
  // для шаблонів, яких ще нема у словнику.
  const key = props.asset.data.templateKey
  const i18nKey = `winterboard.nmt3d.template.${key}`
  if (te(i18nKey)) return t(i18nKey)
  const W = window as any
  return W.NMT3D?.TEMPLATES?.[key]?.name
    ?? NMT3D_TEMPLATE_LABELS[key]
    ?? key
})

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  // Mirror helix pattern: lazy import the vendor index.ts (side-effect imports inside)
  await import('../../../vendor/nmt3d')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return  // guard re-check after async

  const W = window as any
  if (!W.NMT3D?.Workspace) {
    console.warn('[Nmt3dRenderer] NMT3D.Workspace not available after load')
    return
  }

  // Guard: missing data/templateKey would make the vendor constructor read
  // `.params` off undefined and throw (nmt-3d.js:2404). Skip gracefully —
  // critical during export capture, where a thrown mount() became an
  // Uncaught promise rejection and could abort the whole capture phase.
  const data = props.asset?.data
  if (!data || !data.templateKey) {
    console.warn('[Nmt3dRenderer] missing data/templateKey — skip mount', props.asset?.id)
    return
  }

  // Vendor calls wrapped: a vendor-internal throw must not crash the host
  // (off-screen capture mount can hit vendor edge cases). On failure the
  // widget renders empty rather than killing capture.
  try {
    ws = new W.NMT3D.Workspace(stageRef.value, data.templateKey)
    ws.setMode(localMode.value)
    if (data.params) ws.setParams(data.params)
    if (data.opts) {
      for (const [k, v] of Object.entries(data.opts)) ws.setOpt(k, v)
    }
  } catch (err) {
    console.warn('[Nmt3dRenderer] vendor Workspace init failed — skip', props.asset?.id, err)
    ws = null
    return
  }

  // ─── PATCH: Disable vendor auto-refit on container resize ─────────────────
  //
  // ROOT CAUSE (atomic-level, 2026-05-30):
  //   Vendor nmt-3d.js:3119-3122 installs a ResizeObserver:
  //     this._ro = new ResizeObserver(() => { this._needsFit = true; this._render(); });
  //   When the host container resizes by even 1px, the vendor sets _needsFit=true
  //   and calls _render() → _autoFit() (nmt-3d.js:2626-2631) recalculates cam.scale:
  //     this.cam.scale = Math.max(40, Math.min(220, s * 0.92))
  //   This causes visible zoom shift any time surrounding UI changes (toolbar,
  //   sidebar inspector, popups, REC indicator etc.). Most visible at recording
  //   stop: NMT3D deselects → Inspector hides → Tools panel shows → canvas resizes
  //   → vendor refits camera → user perceives "shape changed".
  //
  // This is NOT a data corruption issue — asset.data.params in the store are
  // correct. It's pure vendor visual behavior.
  //
  // FIX:
  //   Disconnect the vendor's ResizeObserver and install our own that calls
  //   _render() (so SVG redraws at new container size) but WITHOUT setting
  //   _needsFit=true (so cam.scale is preserved). _autoFit() still re-centers
  //   the bbox (always runs in _render()), but the user-chosen zoom is kept.
  //
  // TRADE-OFF: if container shrinks dramatically, shape may extend past edges.
  // Acceptable — user can manually trigger fit via resetView button.
  if (ws._ro && typeof ws._ro.disconnect === 'function') {
    try { ws._ro.disconnect() } catch { /* idempotent */ }
    ws._ro = new ResizeObserver(() => {
      if (ws && typeof ws._render === 'function') ws._render()
    })
    try { ws._ro.observe(stageRef.value) } catch { /* node detached during reroute */ }
  }

  // Persist params changes to store via update:asset.
  //
  // OPTS SAFETY: use ws.opts (engine source of truth) instead of props.asset.data.opts.
  // props.asset is the Vue reactive prop — it lags behind by one RAF cycle (~16ms).
  // If the user checks an inspector checkbox and then immediately rotates the 3D shape,
  // onParamsChanged fires before Vue propagates the opts change to props.asset.data.opts.
  // Using stale props.asset.data.opts in this emit would overwrite the opts change in
  // the RAF batcher (last-wins), silently dropping the checkbox state.
  // ws.opts is always current because ws.setOpt() is called synchronously in Inspector.onOptChange.
  ws.onParamsChanged = (params: Record<string, number>) => {
    nmt3dUiState.latestParams = { ...params }
    // Read opts from engine (always fresh) — not from props (may lag one Vue tick)
    const currentOpts: Record<string, boolean> | undefined =
      ws?.opts && Object.keys(ws.opts).length > 0
        ? { ...ws.opts }
        : props.asset.data.opts
    emit('update:asset', {
      ...props.asset,
      data: {
        ...props.asset.data,
        params: { ...params },
        ...(currentOpts !== undefined ? { opts: currentOpts } : {}),
      },
    })
  }

  // ─── RESTORE camera state ──────────────────────────────────────────────────
  //
  // Camera (yaw/pitch/scale) priority on mount:
  //   1. Ephemeral cache (current session, per asset.id) — covers remount within
  //      same tab (page switch, deselect→select). Most recent live state.
  //   2. asset.data.cam (persisted in ops, survives recording → replay) — covers
  //      replay viewers and reload-from-snapshot. Board-level strokes drawn over
  //      NMT3D were aligned with this orientation, so replay MUST restore it.
  //   3. Vendor default (yaw:-0.5, pitch:0.28, scale:auto-fit) — first-ever mount.
  //
  // Order matters: must come AFTER setParams/setOpt (which set _needsFit=true
  // and call _autoFit() that recomputes cam.scale). We override after.
  // _autoFit() ALSO recomputes offsetX/offsetY on every _render() — so we don't
  // bother saving those (they're a function of yaw/pitch/scale + bbox).
  const cached = getNmt3dEphemeralState(props.asset.id)
  const persistedCam = props.asset.data.cam
  // Effective cam: ephemeral cache wins (live state), falls back to persisted data.cam.
  const effectiveCam = cached?.cam ?? persistedCam ?? null
  if (effectiveCam && ws.cam) {
    ws.cam.yaw = effectiveCam.yaw
    ws.cam.pitch = effectiveCam.pitch
    ws.cam.scale = effectiveCam.scale
    ws._needsFit = false  // prevent _autoFit from recomputing scale
  }
  if (cached) {
    if (Array.isArray(cached.strokes)) {
      ws.strokes = [...cached.strokes]
    }
    if (typeof cached.autoOrbit === 'boolean') {
      ws.autoOrbit = cached.autoOrbit
    }
  }
  if (effectiveCam || cached) {
    if (typeof ws._render === 'function') ws._render()
  }

  // ─── Persist camera state to data.cam on interaction-end ───────────────────
  //
  // ROOT CAUSE FIX (2026-05-31): orbit gestures often end OUTSIDE the stage div —
  // the user drags past the NMT3D boundary while orbiting. In that case pointerup
  // fires on the Konva canvas (e.target = CANVAS, not NMT3D vendor canvas), so
  // checking e.target in pointerup always returns false → emit was silently dropped.
  //
  // Fix: track the ORIGIN of the drag (pointerdown target). If the drag started
  // inside our stage, emit cam on the following pointerup regardless of release point.
  window.addEventListener('pointerdown', _onWindowPointerDown, { capture: true })
  window.addEventListener('pointerup', _onWindowPointerUp, { capture: true })
  // Wheel listener stays on stage (only fires when pointer events enabled, which is OK
  // for zoom — vendor only zooms when stage is interactive anyway).
  if (stageRef.value) {
    stageRef.value.addEventListener('wheel', _onStageWheel, { passive: true })
  }

  syncCanvasPointerEvents()

  // Register for inspector if already selected when mounted
  if (props.isSelected) _registerInspector()
}

function _registerInspector(): void {
  if (!ws) return
  registerNmt3dWorkspace(
    props.asset.id,
    ws,
    (opts) => {
      emit('update:asset', {
        ...props.asset,
        data: { ...props.asset.data, opts },
      })
    },
  )
}

function destroyWs(): void {
  if (ws) {
    // Cleanup listeners before destroying ws/element refs
    try {
      window.removeEventListener('pointerdown', _onWindowPointerDown, { capture: true } as any)
      window.removeEventListener('pointerup', _onWindowPointerUp, { capture: true } as any)
      _orbitStartedInStage = false
      if (stageRef.value) {
        stageRef.value.removeEventListener('wheel', _onStageWheel)
      }
      if (_wheelDebounceTimer !== null) {
        window.clearTimeout(_wheelDebounceTimer)
        _wheelDebounceTimer = null
      }
      // Final cam emit if pointerup was missed (e.g. user navigated mid-drag).
      // Same gate as _emitCamIfChanged — only in edit mode.
      _emitCamIfChanged()
    } catch { /* defensive */ }
    // SAVE ephemeral state (cam, strokes, autoOrbit) to module cache BEFORE
    // ws.destroy(). The next mount() for this asset.id will restore it.
    // Without this save: page switch / deselect / templateKey-change loses
    // user's rotation/zoom/internal-strokes (all are vendor-internal, not in data).
    try {
      if (ws.cam) {
        setNmt3dEphemeralState(props.asset.id, {
          cam: {
            yaw: ws.cam.yaw,
            pitch: ws.cam.pitch,
            scale: ws.cam.scale,
          },
          strokes: Array.isArray(ws.strokes) ? [...ws.strokes] : undefined,
          autoOrbit: !!ws.autoOrbit,
        })
      }
    } catch { /* defensive — never block destroy on cache save */ }
    try { ws.destroy() } catch { /* idempotent */ }
    ws = null
  }
}

// ESC — collapse expanded overlay (mirrors TrigCircleRenderer)
function _onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && props.isExpanded) emit('expand') }

onMounted(() => {
  // .catch: mount() is async; an unhandled rejection here surfaced as an
  // Uncaught (in promise) during export capture. Swallow → widget skips.
  mount().catch((err) => {
    console.warn('[Nmt3dRenderer] mount() rejected', props.asset?.id, err)
  })
  window.addEventListener('keydown', _onEsc)
})
onUnmounted(() => {
  window.removeEventListener('keydown', _onEsc)
  unregisterNmt3dWorkspace(props.asset.id)
  destroyWs()
})

// Notify NMT3D engine after expand/collapse so it can resize its SVG
watch(() => props.isExpanded, () => {
  if (!ws) return
  nextTick(() => {
    // NMT3D engine may expose resize(); if not, trigger a window resize event
    if (typeof ws.resize === 'function') {
      ws.resize()
    } else {
      window.dispatchEvent(new Event('resize'))
    }
  })
})

// ── Pointer-events sync ────────────────────────────────────────────────────
// Stage captures events ONLY when interactive=true AND isSelected=true.
//
// IMPORTANT — two separate branches:
//
//   ENABLE (interactive + selected):
//     • Stage inline style → 'auto' (overrides CSS default 'none').
//     • Children → clear inline 'none' (remove inline style = '').
//       NMT3D engine sets its own pointer-events on SVG handles (e.g. 'all');
//       we MUST NOT overwrite them — just remove our own forced 'none'.
//
//   DISABLE (not interactive OR not selected):
//     • Stage + all children → forced 'none'.
//       Must block NMT3D's own interactive SVG elements too.
function syncCanvasPointerEvents(): void {
  const el = stageRef.value
  if (!el) return

  // INV-OVERLAY-CLICK v2 крок 2 (2026-07-16): тіло ЗАВЖДИ auto у select-режимі
  // (interactive) — orbit одним жестом (wrapper-capture guard виділяє тим самим
  // дотиком). isSelected прибрано з умови; expanded лишається окремим тригером.
  // Pen/readonly (interactive=false) → none (гілка else), ink поверх.
  if (props.interactive || props.isExpanded) {
    // Enable: stage = auto; clear our forced 'none' from children
    ;(el as HTMLElement).style.pointerEvents = 'auto'
    el.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.pointerEvents = ''  // remove inline → NMT3D engine's own values apply
    })
  } else {
    // Disable: block everything (including NMT3D's SVG handles)
    ;(el as HTMLElement).style.pointerEvents = 'none'
    el.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.pointerEvents = 'none'
    })
  }
}

watch(() => [props.interactive, props.isSelected, props.isExpanded] as const, syncCanvasPointerEvents)

// Register/unregister inspector when selection changes.
// syncCanvasPointerEvents is already called by the [interactive, isSelected] watcher above.
watch(() => props.isSelected, (sel) => {
  if (sel) _registerInspector()
  else unregisterNmt3dWorkspace(props.asset.id)
})

// ── Mode toggle ──────────────────────────────────────────────────────────────
function setMode(m: 'adapt' | 'draw'): void {
  if (localMode.value === m) return
  localMode.value = m
  if (ws) ws.setMode(m)
  // Persist mode to store
  emit('update:asset', {
    ...props.asset,
    data: { ...props.asset.data, mode: m },
  })
}

// ── Sync from remote ops (store → local + engine) ───────────────────────────
watch(
  () => props.asset.data.mode,
  (newMode) => {
    if (newMode === localMode.value) return
    localMode.value = newMode
    if (ws) ws.setMode(newMode)
  },
)

// Sync params from store → engine (replay / remote read-only path).
//
// GATE uses boardMode, NOT interactive:
//   - boardMode === 'edit': engine drives params (user manipulates via NMT3D handles).
//     DO NOT sync store → engine here — would create feedback loop:
//     ws.setParams() → onParamsChanged() → store update → watcher fires → ws.setParams()...
//     This loop was corrupting board state after recording save when pen tool was active
//     (interactive=false, but boardMode still 'edit').
//   - boardMode !== 'edit' (replay, view, etc.): store drives params (replay applier).
//     MUST sync store → engine so NMT3D canvas follows recorded ops.
//
// Without this watch, replay asset_update ops update store but NMT3D canvas stays frozen.
watch(
  () => props.asset.data.params,
  (newParams) => {
    if (!ws || !newParams || props.boardMode === 'edit') return
    ws.setParams(newParams)
  },
)

// Sync opts from store → engine (replay / remote read-only path).
// Same boardMode gate — opts feedback loop identical in structure to params loop.
watch(
  () => props.asset.data.opts,
  (newOpts) => {
    if (!ws || !newOpts || props.boardMode === 'edit') return
    for (const [k, v] of Object.entries(newOpts)) ws.setOpt(k, v)
  },
)

// Sync camera (yaw/pitch/scale) from store → engine in REPLAY mode.
// This is the critical path for replay accuracy: when applyReplayOperation applies
// an `asset_update` op containing data.cam, the watcher fires here and rotates
// the engine to match — so 2D board strokes drawn over the 3D shape align with
// the same orientation the recording author had.
//
// Same boardMode gate as params/opts: edit mode = engine drives (user orbits manually),
// replay/readonly = store drives (applier sets cam via op).
watch(
  () => props.asset.data.cam,
  (newCam) => {
    if (!ws || !newCam || props.boardMode === 'edit') return
    if (ws.cam) {
      ws.cam.yaw = newCam.yaw
      ws.cam.pitch = newCam.pitch
      ws.cam.scale = newCam.scale
      ws._needsFit = false
      if (typeof ws._render === 'function') ws._render()
    }
  },
)

// If templateKey changes (unlikely but defensive) — remount
watch(
  () => props.asset.data.templateKey,
  async (newKey, oldKey) => {
    if (newKey === oldKey) return
    destroyWs()
    localMode.value = props.asset.data.mode
    await mount()
  },
)
</script>

<style scoped>
.nmt3d-renderer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fffaf0;
  border-radius: 6px;
  overflow: hidden;
  pointer-events: none;
}

.nmt3d-renderer.is-selected {
  outline: 2px solid #c4622a;
  outline-offset: 1px;
}

/* ── Header ── */
.nmt3d-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f4ede0;
  border-bottom: 1px solid #d6c8b2;
  min-height: 28px;
  flex-shrink: 0;
  pointer-events: none;  /* falls through to Konva for card drag */
}

.nmt3d-card-title {
  font-size: 11px;
  font-weight: 700;
  color: #3a2f24;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

/* ── Mode toggle ── */
.nmt3d-mode-toggle {
  display: inline-flex;
  background: #ede3d0;
  border: 1px solid #d6c8b2;
  border-radius: 6px;
  overflow: hidden;
  padding: 2px;
  gap: 2px;
  pointer-events: auto;
  flex-shrink: 0;
  /* no margin-left:auto — expand button already pushes right with its own margin-left:auto */
}

.nmt3d-mode-btn {
  background: transparent;
  border: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #6a594a;
  line-height: 1;
  white-space: nowrap;
  transition: background 0.1s, color 0.1s;
}

.nmt3d-mode-btn:hover {
  color: #3a2f24;
  background: rgba(196, 98, 42, 0.08);
}

.nmt3d-mode-btn.is-active {
  background: #3a2f24;
  color: #fffaf0;
}

.nmt3d-mode-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #9a8674;
  margin-left: auto;
  flex-shrink: 0;
}

/* ── Expand button ── */
.nmt3d-expand-btn {
  background: transparent;
  border: 1px solid #d6c8b2;
  border-radius: 4px;
  color: #9a8674;
  font-size: 13px;
  line-height: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  pointer-events: auto;  /* overrides header pointer-events:none */
  padding: 0;
  margin-left: auto;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.nmt3d-expand-btn:hover {
  background: #ede3d0;
  border-color: #c4622a;
  color: #c4622a;
}

/* ── Delete button ── */
.nmt3d-delete {
  background: transparent;
  border: 1px solid #d6c8b2;
  border-radius: 4px;
  color: #9a8674;
  font-size: 14px;
  line-height: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  pointer-events: auto;
  padding: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.nmt3d-delete:hover {
  background: #fde8e8;
  border-color: #dc2626;
  color: #dc2626;
}

/* ── 3D Stage ── */
.nmt3d-stage {
  flex: 1;
  overflow: hidden;
  background: #fffaf0;
  background-image: radial-gradient(rgba(106, 89, 74, 0.06) 1px, transparent 1px);
  background-size: 22px 22px;
  background-position: center;
  cursor: grab;
  /* Default: none — clicks fall through to Konva for selection.
     syncCanvasPointerEvents() sets 'auto' via inline style when interactive+selected. */
  pointer-events: none;
  touch-action: none;
  /* Фікс 2026-08-19: підписи вершин — це SVG <text> (`nmt-3d.js:3184`), і при
     перетягуванні фігури браузер починав виділяти їх як звичайний текст —
     вершини підсвічувались синім. `touch-action` це не покриває: він про
     жести, не про виділення. Сусідні віджети (Graphmash3d, Geomash) малюють
     підписи на canvas (`fillText`), тож там виділяти нічого — їх не чіпаємо. */
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}

/* Stage in draw mode — crosshair cursor */
.nmt3d-renderer:has(.nmt3d-mode-btn.is-active:last-child) .nmt3d-stage {
  cursor: crosshair;
}

/* NMT3D injects its SVG into the stage div — fill available space */
.nmt3d-stage :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

/* ── Board-expanded state ── */
.nmt3d-renderer.is-expanded {
  border-radius: 0;
}

.nmt3d-renderer.is-expanded .nmt3d-header {
  cursor: default;
  padding: 5px 12px;
  background: rgba(196, 98, 42, 0.10);
}

.nmt3d-renderer.is-expanded .nmt3d-expand-btn {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.nmt3d-renderer.is-expanded .nmt3d-mode-toggle {
  margin-left: 8px;  /* expand button already took margin-left:auto */
}
</style>
