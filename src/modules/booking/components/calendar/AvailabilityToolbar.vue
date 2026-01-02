<template>
  <div class="availability-toolbar" role="toolbar" :aria-label="$t('calendar.availability.toolbar.label')">
    <div class="toolbar-header">
      <h3 class="toolbar-title">{{ $t('calendar.availability.header.title') }}</h3>
      <button
        class="btn-icon btn-close"
        @click="$emit('exit')"
        :aria-label="$t('calendar.availability.exit')"
      >
        ×
      </button>
    </div>

    <div v-if="workloadProgress" class="workload-section">
      <div class="workload-header">
        <span class="workload-label">{{ $t('calendar.availability.workload.label') }}</span>
        <span class="workload-hours">
          {{ workloadProgress.currentHours }} / {{ workloadProgress.targetHours }} {{ $t('calendar.availability.hours') }}
        </span>
      </div>
      
      <div class="progress-bar-container">
        <div 
          class="progress-bar"
          :class="`status-${workloadProgress.status}`"
          :style="{ width: `${progressPercentage}%` }"
          role="progressbar"
          :aria-valuenow="workloadProgress.currentHours"
          :aria-valuemin="0"
          :aria-valuemax="workloadProgress.targetHours"
        />
      </div>
      
      <p v-if="workloadProgress.status === 'needs_more'" class="workload-message warning">
        {{ $t('calendar.availability.progress.needs_more', { hours: hoursNeeded }) }}
      </p>
      <p v-else-if="workloadProgress.status === 'ok'" class="workload-message success">
        {{ $t('calendar.availability.progress.ok') }}
      </p>
      <p v-else-if="workloadProgress.status === 'exceeded'" class="workload-message info">
        {{ $t('calendar.availability.progress.exceeded') }}
      </p>
    </div>

    <div v-if="hasChanges" class="changes-summary">
      <div class="summary-item">
        <span class="summary-icon add">+</span>
        <span>{{ addedCount }} {{ $t('calendar.availability.slots.added') }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-icon remove">−</span>
        <span>{{ removedCount }} {{ $t('calendar.availability.slots.removed') }}</span>
      </div>
      <div class="summary-item total">
        <span class="summary-label">{{ $t('calendar.availability.hours.delta') }}:</span>
        <span :class="{ positive: hoursDelta > 0, negative: hoursDelta < 0 }">
          {{ hoursDelta > 0 ? '+' : '' }}{{ hoursDelta.toFixed(1) }}{{ $t('calendar.availability.hours.short') }}
        </span>
      </div>
    </div>

    <div v-if="error" class="error-banner" role="alert">
      <span class="error-icon">⚠</span>
      <span class="error-message">{{ error }}</span>
      <button class="btn-link" @click="$emit('retry')">
        {{ $t('calendar.availability.retry') }}
      </button>
    </div>

    <div class="toolbar-actions">
      <button
        class="btn-secondary"
        @click="$emit('cancel')"
        :disabled="isSaving"
      >
        {{ $t('calendar.availability.cancel') }}
      </button>
      
      <button
        class="btn-primary"
        @click="$emit('save')"
        :disabled="!hasChanges || isSaving || hasConflicts"
        :aria-busy="isSaving"
      >
        <span v-if="isSaving" class="spinner" />
        {{ isSaving ? $t('calendar.availability.saving') : $t('calendar.availability.save') }}
      </button>
    </div>

    <div class="toolbar-footer">
      <button class="btn-link" @click="$emit('show-legend')">
        {{ $t('calendar.availability.legend.show') }}
      </button>
      <button v-if="canUndo" class="btn-link" @click="$emit('undo')">
        {{ $t('calendar.availability.undo') }}
      </button>
      <button v-if="canRedo" class="btn-link" @click="$emit('redo')">
        {{ $t('calendar.availability.redo') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkloadProgress } from '@/modules/booking/api/calendarAvailabilityApi'

const props = defineProps<{
  workloadProgress: WorkloadProgress | null
  hasChanges: boolean
  addedCount: number
  removedCount: number
  hoursDelta: number
  isSaving: boolean
  hasConflicts: boolean
  error: string | null
  canUndo: boolean
  canRedo: boolean
}>()

defineEmits<{
  'save': []
  'cancel': []
  'exit': []
  'retry': []
  'show-legend': []
  'undo': []
  'redo': []
}>()

const progressPercentage = computed(() => {
  if (!props.workloadProgress) return 0
  const percentage = (props.workloadProgress.currentHours / props.workloadProgress.targetHours) * 100
  return Math.min(percentage, 100)
})

const hoursNeeded = computed(() => {
  if (!props.workloadProgress) return 0
  return Math.max(0, props.workloadProgress.minHours - props.workloadProgress.currentHours)
})
</script>

<style scoped>
.availability-toolbar {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
}

.btn-close {
  font-size: 28px;
  line-height: 1;
  color: #666;
  padding: 4px 8px;
}

.workload-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.workload-label {
  color: #666;
}

.workload-hours {
  font-weight: 600;
  color: #1a1a1a;
}

.progress-bar-container {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 4px;
}

.progress-bar.status-needs_more {
  background: #ff9800;
}

.progress-bar.status-ok {
  background: #4caf50;
}

.progress-bar.status-exceeded {
  background: #2196f3;
}

.workload-message {
  font-size: 13px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 4px;
}

.workload-message.warning {
  background: #fff3e0;
  color: #e65100;
}

.workload-message.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.workload-message.info {
  background: #e3f2fd;
  color: #1565c0;
}

.changes-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.summary-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
}

.summary-icon.add {
  background: #e8f5e9;
  color: #4caf50;
}

.summary-icon.remove {
  background: #ffebee;
  color: #f44336;
}

.summary-item.total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #ddd;
  font-weight: 600;
}

.positive {
  color: #4caf50;
}

.negative {
  color: #f44336;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #ffebee;
  border-radius: 6px;
  color: #c62828;
}

.error-icon {
  font-size: 20px;
}

.error-message {
  flex: 1;
  font-size: 14px;
}

.toolbar-actions {
  display: flex;
  gap: 12px;
}

.toolbar-actions button {
  flex: 1;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.toolbar-footer {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.btn-link {
  background: none;
  border: none;
  color: #2196f3;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  text-decoration: none;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-icon:hover {
  opacity: 0.7;
}
</style>
