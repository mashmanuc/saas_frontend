<template>
  <div class="conflict-warning" :class="severity" data-testid="conflict-warning">
    <div class="conflict-icon">
      <AlertTriangleIcon v-if="severity === 'error'" class="w-5 h-5" />
      <AlertCircleIcon v-else class="w-5 h-5" />
    </div>
    
    <div class="conflict-content">
      <h4 class="conflict-title" data-testid="conflict-title">
        {{ severity === 'error' ? t('calendar.conflicts.errorTitle') : t('calendar.conflicts.warningTitle') }}
      </h4>
      
      <div class="conflict-list">
        <div v-for="conflict in conflicts" :key="conflict.slotId || conflict.lessonId" class="conflict-item">
          <div class="conflict-message" data-testid="conflict-message">{{ conflict.message }}</div>
          <div v-if="conflict.studentName" class="conflict-student" data-testid="conflict-student">
            {{ t('calendar.conflicts.student') }}: {{ conflict.studentName }}
          </div>
          <div v-if="conflict.lessonId" class="conflict-lesson" data-testid="conflict-lesson">
            {{ t('calendar.conflicts.lesson') }}: #{{ conflict.lessonId }}
          </div>
        </div>
      </div>
      
      <div class="conflict-actions">
        <button
          v-if="showResolveButton"
          class="btn btn-primary"
          @click="$emit('resolve')"
          data-testid="resolve-conflicts"
        >
          {{ t('calendar.conflicts.resolveAnyway') }}
        </button>
        
        <button
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle as AlertTriangleIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import type { Conflict } from '@/modules/booking/types/slot'

interface Props {
  conflicts: Conflict[]
  showResolveButton?: boolean
}

interface Emits {
  resolve: []
  cancel: []
}

const props = withDefaults(defineProps<Props>(), {
  showResolveButton: true
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

// Determine overall severity based on conflicts
const severity = computed<'error' | 'warning'>(() => {
  return props.conflicts.some(c => c.severity === 'error') ? 'error' : 'warning'
})
</script>

<style scoped>
.conflict-warning {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}

.conflict-warning.error {
  background: var(--color-error-light);
  border: 1px solid var(--color-error);
}

.conflict-warning.warning {
  background: var(--color-warning-light);
  border: 1px solid var(--color-warning);
}

.conflict-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.conflict-warning.error .conflict-icon {
  color: var(--color-error);
}

.conflict-warning.warning .conflict-icon {
  color: var(--color-warning);
}

.conflict-content {
  flex: 1;
}

.conflict-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text-primary);
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.conflict-item {
  padding: 8px 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.conflict-message {
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.conflict-student,
.conflict-lesson {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.conflict-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}

/* Responsive */
@media (max-width: 640px) {
  .conflict-warning {
    flex-direction: column;
    gap: 8px;
  }
  
  .conflict-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
