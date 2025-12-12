<script setup lang="ts">
// F29: Onboarding Modal Component
import { X } from 'lucide-vue-next'

defineProps<{
  show: boolean
  title?: string
  closable?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function handleBackdropClick() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="handleBackdropClick">
        <div class="modal-container">
          <button v-if="closable" class="modal-close" @click="emit('close')">
            <X :size="20" />
          </button>

          <div v-if="title" class="modal-header">
            <h2>{{ title }}</h2>
          </div>

          <div class="modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.modal-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  padding: 8px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  z-index: 1;
}

.modal-close:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.modal-header {
  padding: 24px 24px 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 0 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
