<template>
  <Modal
    :open="isOpen"
    :title="$t('staff.reports.detailsTitle')"
    size="md"
    @close="handleClose"
  >
    <div class="report-modal-body">
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
              <Button 
                variant="secondary"
                :disabled="isResolving"
                @click="handleResolve('DISMISSED')"
              >
                {{ $t('staff.reports.dismiss') }}
              </Button>
              <Button 
                variant="primary"
                :disabled="isResolving"
                @click="handleResolve('ACTIONED')"
              >
                {{ $t('staff.reports.actioned') }}
              </Button>
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
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
.report-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.report-info,
.resolution-info {
  margin-bottom: var(--space-lg);
}

.info-row {
  display: flex;
  margin-bottom: var(--space-sm);
  gap: var(--space-xs);
}

.info-row .label {
  font-weight: 600;
  min-width: 120px;
  color: var(--text-secondary);
}

.status-badge {
  display: inline-block;
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 500;
}

.status-open {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
}

.status-dismissed {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
}

.status-actioned {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}

.report-details {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.report-details h3 {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--text-base);
  font-weight: 600;
}

.report-details p {
  margin: 0;
  white-space: pre-wrap;
}

.resolution-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-color);
}

.resolution-section h3 {
  margin: 0 0 var(--space-md) 0;
  font-size: var(--text-base);
  font-weight: 600;
}

.resolution-note {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  resize: vertical;
  margin-bottom: var(--space-md);
  background: var(--card-bg);
  color: var(--text-primary);
}

.resolution-note:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.action-buttons {
  display: flex;
  gap: var(--space-md);
}
</style>
