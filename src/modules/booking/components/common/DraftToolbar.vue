<template>
  <div v-if="patchCount > 0" class="draft-toolbar">
    <div class="draft-info">
      <span class="draft-count">{{ patchCount }} changes</span>
    </div>
    
    <div class="draft-actions">
      <button
        class="btn btn-primary"
        :disabled="isApplying"
        @click="handleApply"
      >
        {{ isApplying ? 'Applying...' : 'Apply' }}
      </button>
      
      <button
        class="btn btn-secondary"
        :disabled="isApplying"
        @click="handleReset"
      >
        Reset
      </button>
      
      <button
        class="btn btn-template"
        :disabled="isApplying"
        @click="handleSaveAsTemplate"
      >
        Save as Template
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import { useConfirm } from '@/composables/useConfirm'

const draftStore = useDraftStore()
const confirmService = useConfirm()
const isApplying = ref(false)

const patchCount = computed(() => {
  return draftStore.getAllPatches().length
})

async function handleApply() {
  isApplying.value = true
  try {
    const result = await draftStore.applyPatches()
    
    // Show notifications based on result
    if (result && typeof result === 'object' && 'summary' in result) {
      const { summary } = result as any
      if (summary.rejected === 0) {
        // Success notification would go here
        console.log(`Застосовано ${summary.applied} змін`)
      } else {
        // Warning notification would go here
        console.log(`${summary.rejected} відхилено`)
      }
    }
  } catch (err: any) {
    // Error notification would go here
    console.error('Apply error:', err)
  } finally {
    isApplying.value = false
  }
}

async function handleReset() {
  const confirmed = await confirmService.confirm('Clear all changes?')
  if (confirmed) {
    draftStore.clearAllPatches()
    // Info notification would go here
    console.log('Changes cleared')
  }
}

function handleSaveAsTemplate() {
  // Template save logic
}
</script>

<style scoped>
.draft-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  gap: 16px;
}

.draft-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.draft-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--accent);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--accent-hover, #2563eb);
}

.btn--secondary {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.btn--secondary:hover:not(:disabled) {
  background-color: var(--bg-tertiary, #d1d5db);
}

.btn--danger {
  background-color: var(--danger);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background-color: var(--danger-hover, #dc2626);
}
</style>
