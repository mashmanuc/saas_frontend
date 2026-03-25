<template>
  <div class="asset-properties">
    <!-- Phase 34 B3.6: Asset properties -->
    <div class="asset-properties__section">
      <div class="asset-properties__label">{{ assetTypeLabel }}</div>
      
      <!-- Read-only type info -->
      <div class="asset-properties__info">
        <span class="asset-properties__info-label">Type:</span>
        <span class="asset-properties__info-value">{{ assetTypeInfo }}</span>
      </div>
    </div>

    <!-- Phase 34 B3.6: Common properties -->
    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="object.x"
      :y="object.y"
      :width="object.w"
      :height="object.h"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B3.6: AssetProperties — для pdf, video, youtube, audio, presentation assets
 * 
 * Мінімальний компонент — read-only type badge + CommonProperties.
 */
import { computed } from 'vue'
import type { useWBStore } from '../../../board/state/boardStore'
import type { WBAsset } from '../../../types/winterboard'
import CommonProperties from './CommonProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{
  object: WBAsset
  objectType: string
  isLocked: boolean
  store: WBStore
}>()

// Phase 34 B3.6: Dynamic asset type label
const assetTypeLabel = computed(() => {
  const typeMap: Record<string, string> = {
    pdf: 'PDF',
    video: 'VIDEO',
    youtube: 'YOUTUBE',
    audio: 'AUDIO',
    presentation: 'PRESENTATION',
  }
  return typeMap[props.objectType] || 'ASSET'
})

const assetTypeInfo = computed(() => {
  return props.objectType.toUpperCase()
})
</script>

<style scoped>
.asset-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.asset-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.asset-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.asset-properties__info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--wb-bg-secondary, #f3f4f6);
  border-radius: 6px;
  font-size: 13px;
}

.asset-properties__info-label {
  color: var(--wb-text-secondary, #6b7280);
  font-weight: 500;
}

.asset-properties__info-value {
  color: var(--wb-text-primary, #111827);
  font-weight: 600;
}
</style>
