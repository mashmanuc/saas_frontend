<template>
  <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
    <div ref="dialogRef" class="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-modal="true">
      <div class="confirm-header">
        <h3 id="confirm-title">{{ title }}</h3>
      </div>
      
      <div class="confirm-body">
        <p>{{ message }}</p>
      </div>
      
      <div class="confirm-actions">
        <button
          @click="handleCancel"
          class="btn-secondary"
          :disabled="isProcessing"
        >
          {{ cancelText }}
        </button>
        <button
          @click="handleConfirm"
          :class="['btn-primary', variantClass]"
          :disabled="isProcessing"
        >
          <LoaderIcon v-if="isProcessing" class="w-4 h-4 animate-spin" />
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loader as LoaderIcon } from 'lucide-vue-next'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}>(), {
  confirmText: 'Підтвердити',
  cancelText: 'Скасувати',
  variant: 'primary',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const isProcessing = ref(false)

useFocusTrap(dialogRef, {
  onEscape: handleCancel,
  initialFocus: true,
})

const variantClass = computed(() => {
  return props.variant === 'danger' ? 'btn-danger' : ''
})

function handleConfirm() {
  if (isProcessing.value) return
  isProcessing.value = true
  emit('confirm')
}

function handleCancel() {
  if (isProcessing.value) return
  emit('cancel')
}
</script>

<script lang="ts">
import { computed } from 'vue'
export default {
  name: 'ConfirmDialog'
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  max-width: 450px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.confirm-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.confirm-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.confirm-body {
  padding: 20px 24px;
}

.confirm-body p {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-primary,
.btn-danger {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #dc2626;
  color: white;
  border: none;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
