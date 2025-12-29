<template>
  <div class="snapshot-section">
    <div class="section-header">
      <h3>V0.55 Snapshot</h3>
      <div class="section-actions">
        <button @click="copySnapshot" class="btn-icon" title="Copy JSON">
          <CopyIcon :size="16" />
        </button>
        <button @click="toggleExpanded" class="btn-icon" title="Toggle expand">
          <ChevronDownIcon :size="16" :class="{ 'rotated': isExpanded }" />
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="section-content">
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Events:</span>
          <span class="stat-value">{{ snapshot.events?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Accessible:</span>
          <span class="stat-value">{{ snapshot.accessible?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Blocked:</span>
          <span class="stat-value">{{ snapshot.blockedRanges?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Days:</span>
          <span class="stat-value">{{ snapshot.days?.length || 0 }}</span>
        </div>
      </div>

      <div class="json-viewer">
        <pre>{{ formattedSnapshot }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Copy as CopyIcon, ChevronDown as ChevronDownIcon } from 'lucide-vue-next'

interface Props {
  snapshot: any
}

const props = defineProps<Props>()

const isExpanded = ref(true)

const formattedSnapshot = computed(() => {
  try {
    return JSON.stringify(props.snapshot, null, 2)
  } catch {
    return 'Error formatting snapshot'
  }
})

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

async function copySnapshot() {
  try {
    await navigator.clipboard.writeText(formattedSnapshot.value)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.snapshot-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background: #e5e7eb;
}

.rotated {
  transform: rotate(180deg);
  transition: transform 0.2s;
}

.section-content {
  padding: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.json-viewer {
  max-height: 400px;
  overflow: auto;
  background: #1f2937;
  border-radius: 6px;
  padding: 12px;
}

.json-viewer pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #d1d5db;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
