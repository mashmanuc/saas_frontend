<!--
  Phase O PR-O3: SolidCardRenderer.vue — adapter (one-way binding) + toolbar wiring.

  Refs:
    - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2 + PR-O3
    - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1

  HARD RULES (CHECKPOINTS 1-4 of PR-O3, plus PR-O2 invariants):
    - card.set() ТІЛЬКИ у applyState() (one callsite — toolbar/slider/buttons NEVER call set())
    - NO read-back від `card.state` → store (single source of truth = WBAsset.data.state)
    - NO local state mirror (no `ref` holding asset state — computed `state` reads props)
    - NO diff/comparison у applyState — full apply кожен раз
    - Restricted API surface — constructor + set + destroy лише
    - showNet ⟂ showCut mutex enforced FE (toggleNet clears showCut, toggleCut clears showNet)
    - cutHeight slider debounced 50ms (≤20 ops/sec per SSOT throttling invariant)
    - Toolbar emits `update:asset` event з повним spread asset object —
      boardStore wins → watch fires → applyState reapplies → SolidCard.set()
    - NO drag/drop / delete / replay / fullscreen logic (PR-O4/O5 scope)
-->

<template>
  <div class="solid-card-renderer">
    <div ref="container" class="solid-canvas" />

    <div v-if="!asset.locked" class="solid-toolbar" data-testid="solid-toolbar">
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

const props = defineProps<{ asset: SolidAsset }>()
const emit = defineEmits<{
  'update:asset': [asset: SolidAsset]
  delete: []
}>()

const container = ref<HTMLElement | null>(null)
let card: SolidCardInstance | null = null

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
})

watch(
  () => props.asset.data.state,
  (s) => applyState(s),
  { deep: true },
)

onUnmounted(() => {
  if (_slideTimer) {
    clearTimeout(_slideTimer)
    _slideTimer = null
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
}

.solid-canvas {
  width: 100%;
  height: 100%;
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
  z-index: 2;
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
</style>
