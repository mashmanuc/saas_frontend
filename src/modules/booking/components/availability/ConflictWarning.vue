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
        <Button
          v-if="showResolveButton"
          variant="primary"
          @click="$emit('resolve')"
          data-testid="resolve-conflicts"
        >
          {{ t('calendar.conflicts.resolveAnyway') }}
        </Button>
        
        <Button
          variant="outline"
          @click="$emit('cancel')"
        >
          {{ t('common.cancel') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle as AlertTriangleIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
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

/* Responsive */
@media (max-width: 640px) {
  .conflict-warning {
    flex-direction: column;
    gap: 8px;
  }
  
  .conflict-actions {
    flex-direction: column;
  }
  
  :deep(.btn) {
    width: 100%;
  }
}
</style>
