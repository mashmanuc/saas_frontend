<template>
  <div class="chat-input-wrapper">
    <div class="relative flex items-end gap-3">
      <textarea
        ref="inputRef"
        v-model="text"
        class="input chat-textarea"
        :placeholder="placeholder"
        :disabled="disabled || sending"
        rows="1"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      />
      <Button
        variant="primary"
        size="md"
        :loading="sending"
        :disabled="!canSend"
        @click="handleSend"
      >
        {{ sending ? 'Надсилаю...' : 'Надіслати' }}
      </Button>
    </div>
    <p class="mt-2 text-xs" style="color: var(--text-secondary);">
      Enter - надіслати
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  disabled?: boolean
  sending?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const text = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() => {
  return text.value.trim().length > 0 && !props.disabled && !props.sending
})

function handleSend(): void {
  if (!canSend.value) return

  emit('send', text.value.trim())
  text.value = ''

  // ✅ Фокус залишається в input (НЕ злітає!)
  nextTick(() => {
    inputRef.value?.focus()
    autoResize()
  })
}

function autoResize(): void {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 150) + 'px'
}

// Public method for parent to focus
function focus(): void {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.chat-input-wrapper {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-subtle, rgba(7, 15, 30, 0.08));
  background: var(--surface-bg, white);
}

.chat-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 150px;
  resize: none;
  border-radius: 1.25rem;
  padding: 0.75rem 1rem;
  line-height: 1.5;
}

.chat-textarea:focus {
  outline: none;
  ring: 2px;
  ring-color: var(--accent, #2563eb);
}
</style>
