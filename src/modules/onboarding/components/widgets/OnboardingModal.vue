<script setup lang="ts">
// F29: Onboarding Modal Component
import { X } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'

defineProps<{
  show: boolean
  title?: string
  closable?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Modal
    :open="show"
    :title="title"
    size="md"
    @close="emit('close')"
  >
    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </Modal>
</template>
