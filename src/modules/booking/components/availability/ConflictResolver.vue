<template>
  <div class="conflict-resolver" data-testid="conflict-resolver">
    <div class="conflict-header">
      <AlertCircle class="conflict-icon" :size="24" />
      <h4 class="conflict-title">{{ t('calendar.conflicts.errorTitle') }}</h4>
    </div>

    <div class="conflicts-list">
      <div
        v-for="(conflict, index) in conflicts"
        :key="index"
        class="conflict-item"
        :class="`severity-${conflict.severity}`"
        :data-testid="`conflict-${index}`"
      >
        <div class="conflict-info">
          <div class="conflict-type">
            <component :is="getConflictIcon(conflict.type)" :size="16" />
            <span class="conflict-type-label">{{ getConflictTypeLabel(conflict.type) }}</span>
          </div>
          <p class="conflict-message">{{ conflict.message }}</p>
          
          <!-- Additional details based on conflict type -->
          <div v-if="conflict.studentName" class="conflict-details">
            <User :size="14" />
            <span>{{ t('calendar.conflicts.student') }}: {{ conflict.studentName }}</span>
          </div>
          <div v-if="conflict.lessonId" class="conflict-details">
            <BookOpen :size="14" />
            <span>{{ t('calendar.conflicts.lesson') }}: #{{ conflict.lessonId }}</span>
          </div>
        </div>

        <!-- Resolution options for this conflict -->
        <div v-if="showResolutionOptions" class="conflict-resolution">
          <label class="resolution-option">
            <input
              type="radio"
              :name="`resolution-${index}`"
              value="skip"
              v-model="resolutions[index]"
              :data-testid="`resolution-skip-${index}`"
            />
            <span>{{ t('calendar.conflicts.resolution.skip') }}</span>
          </label>
          <label class="resolution-option">
            <input
              type="radio"
              :name="`resolution-${index}`"
              value="override"
              v-model="resolutions[index]"
              :data-testid="`resolution-override-${index}`"
            />
            <span>{{ t('calendar.conflicts.resolution.override') }}</span>
          </label>
          <label v-if="conflict.type === 'template_overlap'" class="resolution-option">
            <input
              type="radio"
              :name="`resolution-${index}`"
              value="update_template"
              v-model="resolutions[index]"
              :data-testid="`resolution-template-${index}`"
            />
            <span>{{ t('calendar.conflicts.resolution.updateTemplate') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="conflict-actions">
      <Button
        variant="outline"
        @click="handleCancel"
        :disabled="isResolving"
        data-testid="cancel-resolution"
      >
        {{ t('common.cancel') }}
      </Button>
      
      <Button
        v-if="!showResolutionOptions"
        variant="danger"
        @click="handleResolveAnyway"
        :disabled="isResolving || hasErrorConflicts"
        data-testid="resolve-anyway"
      >
        {{ t('calendar.conflicts.resolveAnyway') }}
      </Button>
      
      <Button
        v-else
        variant="primary"
        @click="handleApplyResolutions"
        :disabled="!allResolutionsSelected"
        :loading="isResolving"
        data-testid="apply-resolutions"
      >
        {{ t('calendar.conflicts.resolution.apply') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  AlertCircle, 
  User, 
  BookOpen, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Loader 
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import type { Conflict } from '@/modules/booking/types/slot'

interface Props {
  conflicts: Conflict[]
  showResolutionOptions?: boolean
}

interface Emits {
  resolve: [resolutions?: Record<number, string>]
  cancel: []
}

const props = withDefaults(defineProps<Props>(), {
  showResolutionOptions: false
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

const isResolving = ref(false)
const resolutions = ref<Record<number, string>>({})

// Initialize resolutions with default values
props.conflicts.forEach((_, index) => {
  resolutions.value[index] = 'skip'
})

const hasErrorConflicts = computed(() => {
  return props.conflicts.some(c => c.severity === 'error')
})

const allResolutionsSelected = computed(() => {
  return props.conflicts.every((_, index) => resolutions.value[index])
})

function getConflictIcon(type: string) {
  switch (type) {
    case 'booked_overlap':
      return BookOpen
    case 'slot_overlap':
      return Clock
    case 'template_overlap':
      return Calendar
    default:
      return AlertTriangle
  }
}

function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'booked_overlap': t('calendar.conflicts.types.bookedOverlap'),
    'slot_overlap': t('calendar.conflicts.types.slotOverlap'),
    'template_overlap': t('calendar.conflicts.types.templateOverlap')
  }
  return labels[type] || type
}

function handleCancel() {
  emit('cancel')
}

function handleResolveAnyway() {
  if (hasErrorConflicts.value) {
    return
  }
  emit('resolve')
}

async function handleApplyResolutions() {
  isResolving.value = true
  try {
    emit('resolve', resolutions.value)
  } finally {
    isResolving.value = false
  }
}
</script>

<style scoped>
.conflict-resolver {
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-error);
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.conflict-icon {
  color: var(--color-error);
  flex-shrink: 0;
}

.conflict-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.conflict-item {
  padding: 16px;
  background: var(--color-bg-primary);
  border-radius: 8px;
  border-left: 4px solid;
}

.conflict-item.severity-error {
  border-left-color: var(--color-error);
  background: var(--color-error-light, #fef2f2);
}

.conflict-item.severity-warning {
  border-left-color: var(--color-warning);
  background: var(--color-warning-light, #fef3c7);
}

.conflict-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conflict-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.conflict-type-label {
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.conflict-message {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.conflict-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.conflict-resolution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.resolution-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.resolution-option:hover {
  background: var(--color-bg-tertiary);
}

.resolution-option input[type="radio"] {
  margin: 0;
}

.conflict-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
}

.btn-warning {
  background: var(--color-warning);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: var(--color-warning-dark, #d97706);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 640px) {
  .conflict-resolver {
    padding: 16px;
  }
  
  .conflict-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
