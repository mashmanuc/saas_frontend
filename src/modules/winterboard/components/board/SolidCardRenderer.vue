<!--
  Phase O PR-O2: SolidCardRenderer.vue — adapter (one-way binding).

  Refs:
    - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2
    - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1

  HARD RULES (CHECKPOINTS 2-4):
    - card.set() ТІЛЬКИ у applyState() (one callsite)
    - NO read-back від `card.state` → store (single source of truth = WBAsset.data.state)
    - NO diff/comparison у applyState — full apply кожен раз
    - Restricted API surface — constructor + set + destroy лише
    - NO toolbar / drag / replay / fullscreen logic (PR-O3/O4/O5 scope)
-->

<template>
  <div ref="container" class="solid-card-renderer" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { SolidAsset, SolidAssetState } from '@/modules/winterboard/types/winterboard'
import {
  loadSolidCard,
  type SolidCardInstance,
} from '../../services/solidCardLoader'

const props = defineProps<{ asset: SolidAsset }>()

const container = ref<HTMLElement | null>(null)
let card: SolidCardInstance | null = null

/**
 * Applies state ONE WAY: store → SolidCard.
 *
 * INVARIANTS:
 *  - НЕ читаємо card.state (single source of truth = props.asset.data.state)
 *  - НЕ робимо diff (full re-apply кожен watch fire — store wins divergence)
 *  - НЕ викликаємо card.set() поза цією функцією (single callsite)
 */
function applyState(state: SolidAssetState): void {
  if (!card) return
  // Iterate всі ключі state object — Vue reactive proxy ok для for-in.
  // No diff: every key applied щоразу. Якщо SolidCard internal state
  // diverged (manual mutation, race) → next watch fire reverts (store wins).
  const bag = state as unknown as Record<string, unknown>
  for (const key in bag) {
    card.set(key, bag[key])
  }
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
  (state) => applyState(state),
  { deep: true },
)

onUnmounted(() => {
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
</style>
