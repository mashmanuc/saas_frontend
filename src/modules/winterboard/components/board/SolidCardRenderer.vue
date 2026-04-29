<!--
  Phase O PR-O3 + Phase O P0 fix: SolidCardRenderer.vue — adapter (one-way
  binding) + toolbar wiring + ALT/toggle rotation pipeline.

  Refs:
    - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2 + PR-O3
    - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1

  HARD RULES (CHECKPOINTS 1-4 of PR-O3, plus PR-O2 invariants):
    - card.set() ТІЛЬКИ у applyState() (one callsite — toolbar/slider/buttons NEVER call set())
    - NO read-back від `card.state` → store (single source of truth = WBAsset.data.state)
    - NO local state mirror (no `ref` holding asset state — computed `state` reads props)
    - NO diff/comparison у applyState — full apply кожен раз
    - Restricted API surface — constructor + set + destroy + rotate лише
    - showNet ⟂ showCut mutex enforced FE (toggleNet clears showCut, toggleCut clears showNet)
    - cutHeight slider debounced 50ms (≤20 ops/sec per SSOT throttling invariant)
    - Toolbar emits `update:asset` event з повним spread asset object —
      boardStore wins → watch fires → applyState reapplies → SolidCard.set()
    - NO drag/drop / delete / replay / fullscreen logic (PR-O4/O5 scope)
    - Rotation visual-only: NO ops emitted, NO global store, local ref only
-->

<template>
  <div
    class="solid-card-renderer"
    :class="{
      'is-toolbar-visible': toolbarVisible,
      'is-rotating': isRotating,
      'is-rotate-mode': rotateMode,
    }"
  >
    <div ref="container" class="solid-canvas" />

    <!--
      Phase O Task 2 + P0 fix — rotation overlay.
      Активна (pointer-events:auto) коли isSelected && (altPressed || rotateMode || isRotating).
      Без ALT та без rotateMode → pointer-events:none → події проходять до Konva proxy.
      Без isSelected → overlay не рендериться. Видалена клавіша ALT під час drag
      зупиняє rotation тільки якщо НЕ у rotateMode (window-level listeners + pointer
      capture гарантує smooth tracking).
    -->
    <div
      v-if="isSelected"
      ref="rotateOverlay"
      class="solid-rotate-overlay"
      :class="{ 'is-active': altPressed || rotateMode || isRotating }"
      data-testid="solid-rotate-overlay"
      @pointerdown="onRotationPointerDown"
    />

    <!-- Phase O PR-O4: delete button — emits 'delete', parent dispatches asset_delete op.
         Phase O PR-O4.3: visible only when selected OR hovered. -->
    <button
      v-if="!asset.locked && toolbarVisible"
      type="button"
      class="solid-delete"
      data-testid="solid-delete"
      aria-label="Delete solid"
      title="Delete"
      @click="onDelete"
    >
      ×
    </button>

    <div v-if="!asset.locked && toolbarVisible" class="solid-toolbar" data-testid="solid-toolbar">
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.showFaces }"
        :aria-pressed="state.showFaces"
        data-testid="solid-toggle-faces"
        @click="toggleField('showFaces')"
      >
        Faces
      </button>
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.showEdges }"
        :aria-pressed="state.showEdges"
        data-testid="solid-toggle-edges"
        @click="toggleField('showEdges')"
      >
        Edges
      </button>
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.showVertices }"
        :aria-pressed="state.showVertices"
        data-testid="solid-toggle-vertices"
        @click="toggleField('showVertices')"
      >
        Vertices
      </button>
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.transparent }"
        :aria-pressed="state.transparent"
        data-testid="solid-toggle-transparent"
        @click="toggleField('transparent')"
      >
        Transparent
      </button>
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.showNet }"
        :aria-pressed="state.showNet"
        data-testid="solid-toggle-net"
        @click="toggleNet"
      >
        Net
      </button>
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': state.showCut }"
        :aria-pressed="state.showCut"
        data-testid="solid-toggle-cut"
        @click="toggleCut"
      >
        Cut
      </button>
      <!-- Phase O P0 fix — rotateMode toggle (alternative до ALT key).
           Коли активний → drag без ALT rotates. Local ref, NOT persisted,
           автоматично resets на deselect. -->
      <button
        type="button"
        class="solid-toolbar__btn"
        :class="{ 'is-active': rotateMode }"
        :aria-pressed="rotateMode"
        data-testid="solid-toggle-rotate"
        title="Rotate (or hold Alt and drag)"
        @click="toggleRotateMode"
      >
        ↻ Rotate
      </button>

      <input
        v-if="state.showCut"
        type="range"
        min="0"
        max="1"
        step="0.01"
        class="solid-toolbar__slider"
        data-testid="solid-cut-slider"
        :value="state.cutHeight"
        @input="onCutHeightInput($event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  SolidAsset,
  SolidAssetData,
  SolidAssetState,
} from '@/modules/winterboard/types/winterboard'
import {
  loadSolidCard,
  type SolidCardInstance,
} from '../../services/solidCardLoader'

const props = withDefaults(
  defineProps<{ asset: SolidAsset; isSelected?: boolean }>(),
  { isSelected: false },
)
const emit = defineEmits<{
  'update:asset': [asset: SolidAsset]
  delete: []
}>()

const container = ref<HTMLElement | null>(null)
const rotateOverlay = ref<HTMLElement | null>(null)
let card: SolidCardInstance | null = null

/**
 * Phase O Task 2 + P0 fix — rotation state (visual-only, NOT emitted as op).
 *
 * Strategy:
 *  - Track ALT via window keydown/keyup (toggles overlay pointer-events:auto)
 *  - rotateMode = local ref toggle button (alternative до ALT key,
 *    необов'язковий ALT якщо rotateMode=true)
 *  - When (altKey OR rotateMode) + isSelected → overlay catches pointerdown → start
 *  - setPointerCapture(pointerId) — CRITICAL для smooth tracking, гарантує
 *    що pointermove та pointerup доходять до того ж елемента навіть якщо
 *    pointer виходить за overlay bounds (швидкий drag, scroll, etc.)
 *  - Window-level pointermove/pointerup listeners — defense-in-depth для
 *    edge cases (jsdom тестового середовища без pointer capture, browsers
 *    які не fully implement)
 *  - Frame-to-frame delta calculation (lastX/Y stored), NOT cumulative-from-start
 *  - rotateMode resets on deselect (watch isSelected)
 *  - NO op emitted — rotation lives тільки у SolidCard internal `root.rotation`
 *  - NO global store — local ref only, NOT persisted across sessions
 */
const altPressed = ref(false)
const isRotating = ref(false)
const rotateMode = ref(false)
// Frame-delta state — оновлюється на кожен pointermove (не cumulative).
const _rotState = { lastX: 0, lastY: 0, pointerId: -1 }

function onAltKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Alt') altPressed.value = true
}
function onAltKeyUp(e: KeyboardEvent): void {
  if (e.key === 'Alt') altPressed.value = false
}

/**
 * Determines if a pointerdown should trigger rotation.
 * Priority:
 *   - rotateMode=true → rotate (no ALT needed)
 *   - altKey=true → rotate (existing PR-B behavior)
 *   - else → fall through (Konva proxy gets event for move/select)
 * Always requires isSelected (overlay не існує без selection).
 */
function shouldRotate(e: { altKey?: boolean }): boolean {
  if (!props.isSelected) return false
  return rotateMode.value || !!e.altKey
}

function onRotationPointerMove(e: PointerEvent): void {
  if (!isRotating.value || !card) return
  // Frame-to-frame delta — last position stored on previous event.
  const dx = e.clientX - _rotState.lastX
  const dy = e.clientY - _rotState.lastY
  _rotState.lastX = e.clientX
  _rotState.lastY = e.clientY
  card.rotate(dx, dy)
}

function onRotationPointerUp(e?: PointerEvent): void {
  if (!isRotating.value) return
  isRotating.value = false
  // Release pointer capture якщо был набутий на pointerdown.
  if (
    e &&
    rotateOverlay.value &&
    typeof rotateOverlay.value.releasePointerCapture === 'function' &&
    _rotState.pointerId >= 0
  ) {
    try {
      rotateOverlay.value.releasePointerCapture(_rotState.pointerId)
    } catch {
      // Already released (pointercancel etc.) — silently ignore.
    }
  }
  _rotState.pointerId = -1
  // Cleanup mirrors addEventListener (same references).
  window.removeEventListener('pointermove', onRotationPointerMove)
  window.removeEventListener('pointerup', onRotationPointerUp)
  window.removeEventListener('pointercancel', onRotationPointerUp)
}

function onRotationPointerDown(e: PointerEvent): void {
  // Triple guard: must be left-click, isSelected, AND (altKey OR rotateMode).
  // If ANY guard fails → do NOT stop propagation → event flows нижче.
  if (e.button !== 0) return
  if (!shouldRotate(e)) return
  // Stop propagation so Konva proxy не починає drag/select.
  e.stopPropagation()
  e.preventDefault()
  isRotating.value = true
  _rotState.lastX = e.clientX
  _rotState.lastY = e.clientY
  _rotState.pointerId = e.pointerId ?? -1
  // CRITICAL: setPointerCapture гарантує що подальші pointermove + pointerup
  // event'и приходять на ЦЕЙ елемент навіть якщо pointer leaves bounds.
  // Без capture: швидкий drag → pointer leaves overlay → events go elsewhere
  // → rotation feels broken / stops mid-gesture.
  if (
    rotateOverlay.value &&
    typeof rotateOverlay.value.setPointerCapture === 'function' &&
    _rotState.pointerId >= 0
  ) {
    try {
      rotateOverlay.value.setPointerCapture(_rotState.pointerId)
    } catch {
      // jsdom або older browsers may throw — fallback to window listeners.
    }
  }
  // Window-level listeners — defense-in-depth (works in jsdom без pointer
  // capture support; survives navigation between elements у edge cases).
  window.addEventListener('pointermove', onRotationPointerMove)
  window.addEventListener('pointerup', onRotationPointerUp)
  window.addEventListener('pointercancel', onRotationPointerUp)
}

function toggleRotateMode(): void {
  rotateMode.value = !rotateMode.value
}

/**
 * Phase O PR-O4.3: toolbar visibility driven by selection state from store.
 *
 * Hover-based reveal не реалізовано у цій PR — overlay container має
 * `pointer-events:none` (щоб Konva proxy під ним catch'ив drag/resize/click).
 * Hover events на самому container не fire'илися б, а ставити overlay у
 * pointer-events:auto зламає Konva interaction layer (overlay перехопить
 * mousedown → no drag).
 *
 * Альтернативний UX: toolbar з'являється коли user clicks на solid → store
 * sets selectedIds → isSelected=true → toolbar visible. Click outside →
 * deselect → toolbar hidden. Це reuse'ує existing selection wiring (LAW
 * compliance — no custom interaction logic).
 */
const toolbarVisible = computed(() => props.isSelected)

/**
 * Computed read-only view of state — direct prop reference, NOT a local mirror.
 * Toolbar UI binds через цей computed. Будь-який emit повертає новий повний
 * asset object → store → watch fires → applyState reapplies.
 */
const state = computed<SolidAssetState>(() => props.asset.data.state)

/**
 * Slider debounce timer — only UI throttle for native 60Hz input.
 * НЕ є state mirror — це pure debounce control.
 */
let _slideTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Applies state ONE WAY: store → SolidCard.
 *
 * INVARIANTS:
 *  - НЕ читаємо card.state (single source of truth = props.asset.data.state)
 *  - НЕ робимо diff (full re-apply кожен watch fire — store wins divergence)
 *  - НЕ викликаємо card.set() поза цією функцією (single callsite — PR-O3 CHECKPOINT 1)
 */
function applyState(s: SolidAssetState): void {
  if (!card) return
  // Iterate всі ключі state object — Vue reactive proxy ok для for-in.
  // No diff: every key applied щоразу. Якщо SolidCard internal state
  // diverged (manual mutation, race) → next watch fire reverts (store wins).
  const bag = s as unknown as Record<string, unknown>
  for (const key in bag) {
    card.set(key, bag[key])
  }
}

/**
 * Emits a state patch as full SolidAsset (spread immutable update).
 * Vue watch у PR-O2 deep-watches `props.asset.data.state` → fires applyState.
 * Per SSOT §3.7.1: toolbar action → asset_update op → store → watch → SolidCard.set().
 */
function emitStatePatch(patch: Partial<SolidAssetState>): void {
  const nextData: SolidAssetData = {
    version: 1,
    state: {
      ...props.asset.data.state,
      ...patch,
    },
  }
  emit('update:asset', {
    ...props.asset,
    data: nextData,
  })
}

function toggleField(key: keyof SolidAssetState): void {
  // Boolean fields only — cutHeight handled separately via slider.
  const current = state.value[key]
  if (typeof current !== 'boolean') return
  emitStatePatch({ [key]: !current } as Partial<SolidAssetState>)
}

/**
 * showNet ⟂ showCut mutex (PR-O3 CHECKPOINT 4) — enforce FE-side для immediate UX.
 * BE serializer (PR-O1) також validates → defense-in-depth.
 */
function toggleNet(): void {
  emitStatePatch({
    showNet: !state.value.showNet,
    showCut: false,
  })
}

function toggleCut(): void {
  emitStatePatch({
    showCut: !state.value.showCut,
    showNet: false,
  })
}

/**
 * Slider input — debounce 50ms per SSOT throttling invariant (≤20 ops/sec).
 * Native input fires ~60Hz → debounce reduces до ≤20 ops/sec без втрати fidelity.
 */
/**
 * Phase O PR-O4: delete button handler — pure emit. Parent (WBCanvas) wires
 * `@delete="emit('asset-delete', asset.id)"` → view → store.deleteAsset → asset_delete op.
 * NO local mutation, NO calling card.set().
 */
function onDelete(): void {
  emit('delete')
}

function onCutHeightInput(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const value = target.valueAsNumber
  if (Number.isNaN(value)) return
  if (_slideTimer) clearTimeout(_slideTimer)
  _slideTimer = setTimeout(() => {
    emitStatePatch({ cutHeight: value })
    _slideTimer = null
  }, 50)
}

onMounted(async () => {
  const { SolidCard } = await loadSolidCard()
  // Component може unmount протягом await — guard.
  if (!container.value) return
  card = new SolidCard(container.value, { type: props.asset.src })
  applyState(props.asset.data.state)
  // Phase O Task 2 — ALT key tracking для rotation overlay activation.
  window.addEventListener('keydown', onAltKeyDown)
  window.addEventListener('keyup', onAltKeyUp)
  // Blur reset (alt може бути "stuck" якщо вікно втратило фокус).
  window.addEventListener('blur', resetAltOnBlur)
})

function resetAltOnBlur(): void {
  altPressed.value = false
}

watch(
  () => props.asset.data.state,
  (s) => applyState(s),
  { deep: true },
)

/**
 * Phase O P0 fix — auto-reset rotateMode on deselect.
 * Selection-driven UX: коли user clicks outside → isSelected→false →
 * rotateMode скидається. Гарантує що toggle стан не "stuck" between selections.
 */
watch(
  () => props.isSelected,
  (sel) => {
    if (!sel) rotateMode.value = false
  },
)

onUnmounted(() => {
  if (_slideTimer) {
    clearTimeout(_slideTimer)
    _slideTimer = null
  }
  // Phase O Task 2 — cleanup global listeners (defensive: rotation теж зніметься).
  window.removeEventListener('keydown', onAltKeyDown)
  window.removeEventListener('keyup', onAltKeyUp)
  window.removeEventListener('blur', resetAltOnBlur)
  if (isRotating.value) {
    window.removeEventListener('pointermove', onRotationPointerMove)
    window.removeEventListener('pointerup', onRotationPointerUp)
    window.removeEventListener('pointercancel', onRotationPointerUp)
    isRotating.value = false
  }
  card?.destroy()
  card = null
})
</script>

<style scoped>
.solid-card-renderer {
  width: 100%;
  height: 100%;
  position: relative;
  /* PR-O4.3: wrapper stays pointer-events:none — Konva proxy
     (invisible v-rect у assetsLayerRef) catches drag/resize/click через
     existing handleAssetDragEnd / handleAssetTransformEnd / handleAssetClick.
     Visible toolbar/delete children opt back in via pointer-events:auto
     below (only when shown). */
  pointer-events: none;
}

.solid-canvas {
  width: 100%;
  height: 100%;
  /* PR-O4.3: Three.js canvas never captures pointer events — Konva proxy
     in the assets layer catches all drag/resize/select. */
  pointer-events: none;
}

.solid-canvas :deep(canvas) {
  pointer-events: none;
}

/* Phase O Task 2 + P0 fix — rotation overlay.
   Default pointer-events:none → події проходять до Konva proxy (drag/select/resize).
   Активний (.is-active) → pointer-events:auto → перехоплює ALT+drag або rotateMode drag.
   `.is-rotating` на root встановлює курсор на час rotation (smooth UX).
   z-index BUMPED до 5 щоб гарантовано бути над Konva proxy під час
   active rotation (Konva stage container зазвичай z-auto/0; HTML overlays
   stacking context керується parent .wb-solid-overlay z-index:4). */
.solid-rotate-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5; /* над canvas + Konva proxy, під toolbar (z:6) та delete (z:7) */
  background: transparent;
  touch-action: none; /* запобігаємо native touch scroll/zoom під час rotation */
}

.solid-rotate-overlay.is-active {
  pointer-events: auto;
  cursor: grab;
}

.solid-card-renderer.is-rotating .solid-rotate-overlay,
.solid-card-renderer.is-rotate-mode .solid-rotate-overlay.is-active {
  cursor: grabbing;
}

.solid-toolbar {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: rgba(15, 23, 42, 0.78);
  border-radius: 6px;
  pointer-events: auto;
  z-index: 6;
  max-width: calc(100% - 16px);
}

.solid-toolbar__btn {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.8);
  color: #e2e8f0;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.solid-toolbar__btn:hover {
  background: rgba(51, 65, 85, 0.85);
}

.solid-toolbar__btn.is-active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #f8fafc;
}

.solid-toolbar__slider {
  width: 110px;
  margin-left: 4px;
  cursor: ew-resize;
}

.solid-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.78);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  /* PR-O4.3: opt back into pointer events when visible (parent has none) */
  pointer-events: auto;
  z-index: 7;
  transition: background 120ms ease, border-color 120ms ease;
}

.solid-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
