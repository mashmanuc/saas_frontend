<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from '@/core/board/types'

interface Props {
  selectedComponents: Component[]
}

const props = defineProps<Props>()

const singleSelection = computed(() => props.selectedComponents.length === 1)
const selectedComponent = computed(() => props.selectedComponents[0])

const componentType = computed(() => {
  if (!singleSelection.value) return 'Multiple'
  return selectedComponent.value?.type ?? 'Unknown'
})
</script>

<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>Properties</h3>
      <span class="selection-count">{{ selectedComponents.length }} selected</span>
    </div>

    <div class="properties-content">
      <div class="property-group">
        <label>Type</label>
        <span class="property-value">{{ componentType }}</span>
      </div>

      <template v-if="singleSelection && selectedComponent">
        <div class="property-group">
          <label>Position</label>
          <div class="property-row">
            <div class="property-field">
              <span class="field-label">X</span>
              <input type="number" :value="Math.round(selectedComponent.x)" readonly />
            </div>
            <div class="property-field">
              <span class="field-label">Y</span>
              <input type="number" :value="Math.round(selectedComponent.y)" readonly />
            </div>
          </div>
        </div>

        <div v-if="selectedComponent.width && selectedComponent.height" class="property-group">
          <label>Size</label>
          <div class="property-row">
            <div class="property-field">
              <span class="field-label">W</span>
              <input type="number" :value="Math.round(selectedComponent.width)" readonly />
            </div>
            <div class="property-field">
              <span class="field-label">H</span>
              <input type="number" :value="Math.round(selectedComponent.height)" readonly />
            </div>
          </div>
        </div>

        <div class="property-group">
          <label>Rotation</label>
          <input type="number" :value="selectedComponent.rotation" readonly />
        </div>

        <div class="property-group">
          <label>Layer</label>
          <span class="property-value">Layer {{ selectedComponent.layerId }}</span>
        </div>
      </template>

      <template v-else>
        <div class="multi-selection-info">
          <p>{{ selectedComponents.length }} objects selected</p>
          <p class="hint">Select a single object to edit properties</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e0e0e0;
  max-height: 300px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.selection-count {
  font-size: 0.75rem;
  color: #666;
}

.properties-content {
  padding: 1rem;
  overflow-y: auto;
}

.property-group {
  margin-bottom: 1rem;
}

.property-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.property-value {
  font-size: 0.875rem;
  text-transform: capitalize;
}

.property-row {
  display: flex;
  gap: 0.5rem;
}

.property-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.75rem;
  color: #999;
  width: 16px;
}

.property-field input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 0.8125rem;
  width: 100%;
}

.property-field input:focus {
  outline: none;
  border-color: #3b82f6;
}

.multi-selection-info {
  text-align: center;
  padding: 1rem;
}

.multi-selection-info p {
  margin: 0;
  font-size: 0.875rem;
}

.multi-selection-info .hint {
  color: #999;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
</style>
