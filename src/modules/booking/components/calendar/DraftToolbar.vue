<template>
  <div v-if="isDirty" class="draft-toolbar">
    <div class="draft-info">
      <AlertCircleIcon class="w-5 h-5 text-amber-600" />
      <span>
        {{ $t('booking.draft.changesCount', { count: patchCount }) }}
      </span>
    </div>
    
    <div class="draft-actions">
      <button @click="handleReset" class="btn-secondary">
        {{ $t('common.reset') }}
      </button>
      <button
        @click="handleApply"
        :disabled="applying"
        class="btn-primary"
      >
        <LoaderIcon v-if="applying" class="w-4 h-4 animate-spin" />
        {{ $t('common.apply') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertCircle as AlertCircleIcon, Loader as LoaderIcon } from 'lucide-vue-next'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import { useToast } from '@/composables/useToast'

const draftStore = useDraftStore()
const { success, error, warning, info } = useToast()

const applying = ref(false)

const isDirty = computed(() => draftStore.isDirty)
const patchCount = computed(() => draftStore.getAllPatches().length)

async function handleApply() {
  applying.value = true
  
  try {
    const result = await draftStore.applyPatches()
    
    if (result.summary.rejected > 0) {
      warning(`Застосовано ${result.summary.applied} змін. ${result.summary.rejected} відхилено через конфлікти.`)
    } else {
      success(`Застосовано ${result.summary.applied} змін`)
    }
    
  } catch (err) {
    error('Помилка при застосуванні змін')
  } finally {
    applying.value = false
  }
}

function handleReset() {
  if (confirm('Скасувати всі зміни?')) {
    draftStore.clearAllPatches()
    info('Зміни скасовано')
  }
}
</script>

<style scoped>
.draft-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  margin-bottom: 16px;
}

.draft-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #92400e;
}

.draft-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
