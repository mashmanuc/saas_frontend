<template>
  <teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>{{ $t('staff.reports.detailsTitle') }}</h2>
          <button 
            @click="handleClose" 
            class="close-button"
            :aria-label="$t('common.close')"
          >
            ×
          </button>
        </div>

        <div class="modal-body">
          <div class="report-info">
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.reporter') }}:</span>
              <span>{{ report.reporter_name || report.reporter_id }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.target') }}:</span>
              <span>{{ report.target_name || report.target_id }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.categoryLabel') }}:</span>
              <span>{{ $t(`staff.reports.category.${report.category}`) }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.created') }}:</span>
              <span>{{ formatDate(report.created_at) }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.status') }}:</span>
              <span :class="`status-badge status-${report.status.toLowerCase()}`">
                {{ $t(`staff.reports.status${report.status}`) }}
              </span>
            </div>
          </div>

          <div v-if="report.details" class="report-details">
            <h3>{{ $t('staff.reports.details') }}</h3>
            <p>{{ report.details }}</p>
          </div>

          <div v-if="report.status === 'OPEN'" class="resolution-section">
            <h3>{{ $t('staff.reports.resolveTitle') }}</h3>
            <textarea
              v-model="resolutionNote"
              :placeholder="$t('staff.reports.resolutionNotePlaceholder')"
              rows="3"
              class="resolution-note"
            />
            <div class="action-buttons">
              <button 
                @click="handleResolve('DISMISSED')"
                :disabled="isResolving"
                class="btn btn-dismiss"
              >
                {{ $t('staff.reports.dismiss') }}
              </button>
              <button 
                @click="handleResolve('ACTIONED')"
                :disabled="isResolving"
                class="btn btn-action"
              >
                {{ $t('staff.reports.actioned') }}
              </button>
            </div>
          </div>

          <div v-if="report.resolved_at" class="resolution-info">
            <h3>{{ $t('staff.reports.resolutionInfo') }}</h3>
            <div class="info-row">
              <span class="label">{{ $t('staff.reports.resolvedAt') }}:</span>
              <span>{{ formatDate(report.resolved_at) }}</span>
            </div>
            <div v-if="report.resolved_by" class="info-row">
              <span class="label">{{ $t('staff.reports.resolvedBy') }}:</span>
              <span>{{ report.resolved_by }}</span>
            </div>
            <div v-if="report.resolution_note" class="info-row">
              <span class="label">{{ $t('staff.reports.note') }}:</span>
              <span>{{ report.resolution_note }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { StaffReport } from '@/types/staff'

interface Props {
  report: StaffReport
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'resolve', status: 'DISMISSED' | 'ACTIONED', note?: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const resolutionNote = ref('')
const isResolving = ref(false)

function handleClose() {
  emit('close')
  resolutionNote.value = ''
}

async function handleResolve(status: 'DISMISSED' | 'ACTIONED') {
  isResolving.value = true
  try {
    emit('resolve', status, resolutionNote.value || undefined)
  } finally {
    isResolving.value = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #000;
}

.modal-body {
  padding: 1.5rem;
}

.report-info,
.resolution-info {
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
}

.info-row .label {
  font-weight: 600;
  min-width: 120px;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-open {
  background-color: #fff3cd;
  color: #856404;
}

.status-dismissed {
  background-color: #d1ecf1;
  color: #0c5460;
}

.status-actioned {
  background-color: #d4edda;
  color: #155724;
}

.report-details {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.report-details h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.report-details p {
  margin: 0;
  white-space: pre-wrap;
}

.resolution-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
}

.resolution-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.resolution-note {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-dismiss {
  background-color: #6c757d;
  color: white;
}

.btn-dismiss:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-action {
  background-color: #28a745;
  color: white;
}

.btn-action:hover:not(:disabled) {
  background-color: #218838;
}
</style>
