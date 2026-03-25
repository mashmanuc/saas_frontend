<template>
  <div class="properties-panel">
    <!-- Phase 36: Multi-select properties (replaces Phase 34 MultiSelectInfo) -->
    <MultiSelectProperties
      v-if="isMultiSelect"
      :store="store"
      @delete-selected="emit('delete-selected')"
    />

    <!-- Phase 34 B1: Single object properties -->
    <component
      v-else-if="selectedObject && propertiesComponent"
      :is="propertiesComponent"
      :object="selectedObject"
      :object-type="objectType"
      :is-locked="isLocked"
      :store="store"
    />

    <!-- Fallback: nothing selected (shouldn't happen — sidebar toggles to materials) -->
    <div v-else class="properties-panel__empty">
      No selection
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B1: PropertiesPanel — головний контейнер для properties sidebar
 * 
 * Dispatch до правильного properties-компонента залежно від objectType.
 * Для multi-select показує MultiSelectInfo.
 */
import { computed } from 'vue'
import type { useWBStore } from '../../board/state/boardStore'
import MultiSelectProperties from './properties/MultiSelectProperties.vue'
import StrokeProperties from './properties/StrokeProperties.vue'
import TextProperties from './properties/TextProperties.vue'
import StickyProperties from './properties/StickyProperties.vue'
import ShapeProperties from './properties/ShapeProperties.vue'
import ImageProperties from './properties/ImageProperties.vue'
import AssetProperties from './properties/AssetProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

const emit = defineEmits<{
  'delete-selected': []
}>()

const selectedObject = computed(() => {
  if (props.store.selectedIds.length !== 1) return null
  return props.store.getObjectById(props.store.selectedIds[0])
})

const objectType = computed(() => {
  if (!selectedObject.value) return null
  return props.store.getObjectType(selectedObject.value)
})

const isMultiSelect = computed(() => props.store.selectedIds.length > 1)

const isLocked = computed(() => {
  if (props.store.selectedIds.length !== 1) return false
  return props.store.isItemLocked(props.store.selectedIds[0])
})

// Phase 34 B1: dispatch to correct properties component
const COMPONENT_MAP: Record<string, unknown> = {
  pen: StrokeProperties,
  highlighter: StrokeProperties,
  text: TextProperties,
  sticky: StickyProperties,
  rectangle: ShapeProperties,
  circle: ShapeProperties,
  line: ShapeProperties,
  image: ImageProperties,
  pdf: AssetProperties,
  audio_player: AssetProperties,
  video_player: AssetProperties,
  youtube_player: AssetProperties,
}

const propertiesComponent = computed(() => {
  if (!objectType.value) return null
  return COMPONENT_MAP[objectType.value] ?? null
})
</script>

<style scoped>
.properties-panel {
  padding: 12px;
  overflow-y: auto;
  height: 100%;
}

.properties-panel__empty {
  color: var(--wb-text-secondary, #6b7280);
  text-align: center;
  padding: 24px 12px;
  font-size: 13px;
}
</style>
