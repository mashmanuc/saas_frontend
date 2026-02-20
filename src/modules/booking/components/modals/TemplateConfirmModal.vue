<template>
  <Modal :open="visible" :title="$t('booking.template.saveAsTemplate')" size="md" @close="handleClose">
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

    <template #footer>
      <Button variant="outline" @click="handleClose">
        {{ $t('common.cancel') }}
      </Button>
      <Button variant="primary" :loading="saving" @click="handleConfirm">
        {{ $t('booking.template.confirmSave') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Info as InfoIcon,
  Check as CheckIcon,
  Ban as BanIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

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

</style>
