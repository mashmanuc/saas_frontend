<template>
  <Transition name="slide-down">
    <div 
      v-if="hasUnsavedChanges" 
      class="draft-changes-bar"
      data-testid="draft-changes-bar"
    >
      <div class="draft-changes-content">
        <div class="draft-changes-info">
          <AlertCircle class="w-5 h-5 text-warning" />
          <span class="draft-changes-text">
            {{ t('calendar.draftChanges.unsavedChanges') }}
          </span>
          <span v-if="changesCount > 0" class="draft-changes-count">
            {{ t('calendar.draftChanges.changesCount', { count: changesCount }) }}
          </span>
        </div>
        
        <div class="draft-changes-actions">
          <button
            class="btn btn-secondary btn-sm"
            :disabled="isLoading"
            @click="handleDiscard"
            data-testid="discard-changes"
          >
            {{ t('common.cancel') }}
          </button>
          
          <button
            class="btn btn-primary btn-sm"
            :disabled="isLoading"
            @click="handleApply"
            data-testid="apply-changes"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <Check v-else class="w-4 h-4" />
            {{ t('calendar.draftChanges.apply') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, Check, Loader2 } from 'lucide-vue-next'
import { useSlotEditor } from '@/modules/booking/composables/useSlotEditor'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()
const { hasUnsavedChanges, draftState, isLoading, applyDraft, clearDraft } = useSlotEditor()

const changesCount = computed(() => {
  return draftState.value.toAdd.length + draftState.value.toRemove.length
})

async function handleApply() {
  try {
    await applyDraft()
  } catch (error: any) {
    console.error('[DraftChangesBar] Apply error:', error)
    
    if (error.conflicts && error.conflicts.length > 0) {
      toast.error(t('calendar.draftChanges.conflictsDetected'))
    }
  }
}

function handleDiscard() {
  const confirmed = window.confirm(t('calendar.draftChanges.discardConfirm'))
  if (!confirmed) return
  
  clearDraft()
  toast.info(t('calendar.draftChanges.discarded'))
}
</script>

<style scoped>
.draft-changes-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(to right, var(--color-warning-light), var(--color-warning-lighter));
  border-bottom: 2px solid var(--color-warning);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 1rem 1.5rem;
}

.draft-changes-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.draft-changes-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.draft-changes-text {
  font-weight: 600;
  color: var(--color-text-primary);
}

.draft-changes-count {
  padding: 0.25rem 0.5rem;
  background: var(--color-warning);
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.draft-changes-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .draft-changes-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .draft-changes-info {
    width: 100%;
  }
  
  .draft-changes-actions {
    width: 100%;
    justify-content: stretch;
  }
  
  .draft-changes-actions button {
    flex: 1;
  }
}
</style>
