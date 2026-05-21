<!--
  Nmt3dRenderer — NMT3D stereometry widget HTML overlay.

  Mounts window.NMT3D.Workspace on stageRef.
  Two modes: 'adapt' (3D orbit + parametric handles) / 'draw' (frozen shape + pen layer).

  POINTER-EVENTS MODEL (mirrors HelixRenderer):
    - Root = pointer-events:none → Konva proxy catches drag/select.
    - Stage div = pointer-events:auto (3D orbit + draw strokes).
    - Header = pointer-events:none (falls through to Konva for card drag).
    - Mode toggle + delete = pointer-events:auto when interactive/selected.
    - Read-only mode: stage = pointer-events:none (pen strokes pass through).
-->
<template>
  <div
    class="nmt3d-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`nmt3d-renderer-${asset.id}`"
  >
    <!-- Header — pointer-events:none so card dragging works outside mode toggle -->
    <header class="nmt3d-header">
      <span class="nmt3d-card-title">{{ cardTitle }}</span>

      <!-- Mode toggle — opt into pointer-events when interactive -->
      <div v-if="interactive" class="nmt3d-mode-toggle" @mousedown.stop @pointerdown.stop>
        <button
          type="button"
          class="nmt3d-mode-btn"
          :class="{ 'is-active': localMode === 'adapt' }"
          title="Адаптація: обертай 3D, тягни ручки"
          @click.stop="setMode('adapt')"
        >⚙ адаптація</button>
        <button
          type="button"
          class="nmt3d-mode-btn"
          :class="{ 'is-active': localMode === 'draw' }"
          title="Малювання: малюй по фігурі як на дошці"
          @click.stop="setMode('draw')"
        >✎ малювання</button>
      </div>

      <!-- Mode badge (read-only) -->
      <span v-else class="nmt3d-mode-badge">
        {{ localMode === 'draw' ? '✎ малювання' : '⚙ адаптація' }}
      </span>

      <!-- Delete (selected + not locked) -->
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="nmt3d-delete"
        title="Видалити"
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Nmt3dAsset } from '../../../types/nmt3d'
import { NMT3D_TEMPLATE_LABELS } from '../../../constants/nmt3dDefaults'
import { registerNmt3dWorkspace, unregisterNmt3dWorkspace, nmt3dUiState } from '../../../board/state/nmt3dUiState'

const props = withDefaults(
  defineProps<{
    asset: Nmt3dAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: Nmt3dAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)

/** Local mode mirror — reflects asset.data.mode, updated immediately on toggle. */
const localMode = ref<'adapt' | 'draw'>(props.asset.data.mode)

let ws: any = null  // window.NMT3D.Workspace instance
let bundleReady = false

const cardTitle = computed(() => {
  const W = window as any
  return W.NMT3D?.TEMPLATES?.[props.asset.data.templateKey]?.name
    ?? NMT3D_TEMPLATE_LABELS[props.asset.data.templateKey]
    ?? props.asset.data.templateKey
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

  ws = new W.NMT3D.Workspace(stageRef.value, props.asset.data.templateKey)
  ws.setMode(localMode.value)

  // Restore persisted params + opts (if saved)
  if (props.asset.data.params) ws.setParams(props.asset.data.params)
  if (props.asset.data.opts) {
    for (const [k, v] of Object.entries(props.asset.data.opts)) ws.setOpt(k, v)
  }

  // Persist params changes to store via update:asset
  ws.onParamsChanged = (params: Record<string, number>) => {
    nmt3dUiState.latestParams = { ...params }
    emit('update:asset', {
      ...props.asset,
      data: { ...props.asset.data, params: { ...params } },
    })
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
    try { ws.destroy() } catch { /* idempotent */ }
    ws = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => {
  unregisterNmt3dWorkspace(props.asset.id)
  destroyWs()
})

// ── Pointer-events sync (draw mode isolation) ─────────────────────────────
// When interactive=false (pen/draw tool active), stage must not capture events.
function syncCanvasPointerEvents(): void {
  const el = stageRef.value
  if (!el) return
  const val = props.interactive ? '' : 'none'
  ;(el as HTMLElement).style.pointerEvents = val
  el.querySelectorAll<HTMLElement>('*').forEach((child) => {
    child.style.pointerEvents = val
  })
}

watch(() => props.interactive, syncCanvasPointerEvents)

// Register/unregister inspector when selection changes
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
  margin-left: auto;
  flex-shrink: 0;
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
  pointer-events: auto;
  touch-action: none;
  position: relative;
}

/* Stage in draw mode — crosshair cursor */
.nmt3d-renderer:has(.nmt3d-mode-btn.is-active:last-child) .nmt3d-stage {
  cursor: crosshair;
}

/* Read-only: stage pointer-events managed by syncCanvasPointerEvents() */
.nmt3d-renderer.is-readonly .nmt3d-stage {
  pointer-events: none;
}

/* NMT3D injects its SVG into the stage div — fill available space */
.nmt3d-stage :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
