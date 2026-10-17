<template>
  <Modal :open="open" :title="title" size="sm" :stacked="stacked" @close="$emit('cancel')">
    <p class="confirm-modal__message">{{ message }}</p>
    <slot />
    <template #footer>
      <Button variant="outline" @click="$emit('cancel')">{{ cancelText }}</Button>
      <Button :variant="variant" :loading="loading" @click="$emit('confirm')">
        {{ confirmText }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import Modal from './Modal.vue'
import Button from './Button.vue'

defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  // Поверх іншого вікна вищого шару (вікно уроку в розкладі — z-index 1000), 2026-10-17: інакше
  // «Ви впевнені…» відкривалось ПІД ним і урок не можна було видалити.
  stacked: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Підтвердження',
  },
  message: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: 'Підтвердити',
  },
  cancelText: {
    type: String,
    default: 'Скасувати',
  },
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'danger'].includes(v),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.confirm-modal__message {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}
</style>
