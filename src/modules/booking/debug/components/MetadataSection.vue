<template>
  <div class="metadata-section">
    <div class="section-header">
      <h3>Metadata & Dictionaries</h3>
      <div class="section-actions">
        <button @click="copyMetadata" class="btn-icon" title="Copy JSON">
          <CopyIcon :size="16" />
        </button>
        <button @click="toggleExpanded" class="btn-icon" title="Toggle expand">
          <ChevronDownIcon :size="16" :class="{ 'rotated': isExpanded }" />
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="section-content">
      <div class="metadata-grid">
        <div class="metadata-block">
          <h4>Meta Info</h4>
          <div class="metadata-item">
            <span class="label">Tutor ID:</span>
            <span class="value">{{ meta?.tutorId || 'N/A' }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Week Start:</span>
            <span class="value">{{ meta?.weekStart || 'N/A' }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Week End:</span>
            <span class="value">{{ meta?.weekEnd || 'N/A' }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Timezone:</span>
            <span class="value">{{ meta?.timezone || 'N/A' }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Current Time:</span>
            <span class="value">{{ formatTime(meta?.currentTime) }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">ETag:</span>
            <span class="value code">{{ meta?.etag || 'N/A' }}</span>
          </div>
        </div>

        <div class="metadata-block">
          <h4>Dictionaries</h4>
          <div class="metadata-item">
            <span class="label">No-Show Reasons:</span>
            <span class="value">{{ Object.keys(dictionaries?.noShowReasons || {}).length }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Cancel Reasons:</span>
            <span class="value">{{ Object.keys(dictionaries?.cancelReasons || {}).length }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Block Reasons:</span>
            <span class="value">{{ Object.keys(dictionaries?.blockReasons || {}).length }}</span>
          </div>
        </div>

        <div class="metadata-block">
          <h4>Statistics</h4>
          <div class="metadata-item">
            <span class="label">Total Events:</span>
            <span class="value">{{ stats.v055EventsCount }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Total Accessible:</span>
            <span class="value">{{ stats.v055AccessibleCount }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Blocked Ranges:</span>
            <span class="value">{{ stats.v055BlockedRangesCount }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">API Logs:</span>
            <span class="value">{{ stats.apiLogsCount }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">WS Logs:</span>
            <span class="value">{{ stats.wsLogsCount }}</span>
          </div>
        </div>
      </div>

      <div class="json-viewer">
        <pre>{{ formattedMetadata }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Copy as CopyIcon, ChevronDown as ChevronDownIcon } from 'lucide-vue-next'

interface Props {
  meta: any
  dictionaries: any
  stats: any
}

const props = defineProps<Props>()

const isExpanded = ref(true)

const formattedMetadata = computed(() => {
  try {
    return JSON.stringify({
      meta: props.meta,
      dictionaries: props.dictionaries,
      stats: props.stats,
    }, null, 2)
  } catch {
    return 'Error formatting metadata'
  }
})

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

async function copyMetadata() {
  try {
    await navigator.clipboard.writeText(formattedMetadata.value)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return 'N/A'
  try {
    return new Date(isoString).toLocaleString('uk-UA')
  } catch {
    return isoString
  }
}
</script>

<style scoped>
.metadata-section {
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

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.metadata-block {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
}

.metadata-block h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #e5e7eb;
}

.metadata-item:last-child {
  border-bottom: none;
}

.metadata-item .label {
  font-size: 12px;
  color: #6b7280;
}

.metadata-item .value {
  font-size: 12px;
  font-weight: 500;
  color: #111827;
}

.metadata-item .value.code {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 3px;
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
