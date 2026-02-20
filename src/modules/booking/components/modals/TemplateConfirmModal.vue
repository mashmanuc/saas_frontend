<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ $t('booking.template.saveAsTemplate') }}</h2>
        <button @click="handleClose" class="close-btn">
          <XIcon class="w-5 h-5" />
        </button>
      </div>
      
      <div class="modal-content">
        <div class="info-section">
          <InfoIcon class="w-12 h-12 text-blue-500" />
          <p class="info-text">
            {{ $t('booking.template.confirmMessage') }}
          </p>
        </div>
        
        <div class="changes-preview">
          <h3>{{ $t('booking.template.changesPreview') }}</h3>
          <div class="changes-list">
            <div
              v-for="(patch, index) in patches"
              :key="index"
              class="change-item"
            >
              <div class="change-icon" :class="`status-${patch.newStatus}`">
                <CheckIcon v-if="patch.newStatus === 'available'" class="w-4 h-4" />
                <BanIcon v-else class="w-4 h-4" />
              </div>
              <div class="change-details">
                <span class="change-time">{{ formatTime(patch.startAtUTC) }}</span>
                <span class="change-status">{{ $t(`booking.status.${patch.newStatus}`) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="warning-section">
          <AlertCircleIcon class="w-5 h-5 text-amber-500" />
          <p class="warning-text">
            {{ $t('booking.template.warningMessage') }}
          </p>
        </div>
      </div>
      
      <div class="modal-actions">
        <button @click="handleClose" class="btn-secondary">
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="handleConfirm"
          :disabled="saving"
          class="btn-primary"
        >
          <LoaderIcon v-if="saving" class="w-4 h-4 animate-spin" />
          {{ $t('booking.template.confirmSave') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  X as XIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Ban as BanIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-vue-next'

interface DraftPatch {
  startAtUTC: string
  newStatus: 'available' | 'blocked'
  originalStatus?: string
}

const props = defineProps<{
  visible: boolean
  patches: DraftPatch[]
}>()

const emit = defineEmits<{
  confirm: []
  close: []
}>()

const saving = ref(false)

function handleConfirm() {
  emit('confirm')
}

function handleClose() {
  emit('close')
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleString('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
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

.modal-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  padding: 4px;
  border-radius: var(--radius-md);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-secondary);
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 16px;
  background-color: var(--accent-bg, #eff6ff);
  border-radius: var(--radius-md);
}

.info-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.changes-preview {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.changes-preview h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.change-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.change-icon.status-available {
  background-color: var(--success-bg, #d1fae5);
  color: var(--success);
}

.change-icon.status-blocked {
  background-color: var(--danger-bg, #fee2e2);
  color: var(--danger);
}

.change-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.change-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.change-status {
  font-size: 12px;
  color: var(--text-secondary);
}

.warning-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background-color: var(--warning-bg, #fffbeb);
  border: 1px solid var(--warning, #fbbf24);
  border-radius: var(--radius-md);
}

.warning-text {
  font-size: 13px;
  color: var(--warning);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--accent-hover, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: var(--bg-secondary);
}
</style>
