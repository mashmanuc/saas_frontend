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
      <button
        v-if="micSupported"
        type="button"
        class="chat-mic"
        :class="{ listening: micListening }"
        :disabled="disabled || sending"
        :title="micListening ? 'Зупинити диктовку' : 'Диктувати голосом'"
        aria-label="Голосовий ввід"
        @click="toggleMic"
      >🎤</button>
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
import { useVoiceDictation } from '@/composables/useVoiceDictation'

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

// Голосова диктовка — той самий рушій, що в Інтегралику (composable). Пише в `text`,
// дописує до набраного; speech-to-text локально, нічого не йде у зовнішні сервіси.
const { supported: micSupported, listening: micListening, toggle: micToggle, reset: micReset } = useVoiceDictation()
function toggleMic(): void { micToggle(text) }

const canSend = computed(() => {
  return text.value.trim().length > 0 && !props.disabled && !props.sending
})

function handleSend(): void {
  if (!canSend.value) return

  emit('send', text.value.trim())
  text.value = ''
  micReset()   // після відправки голос диктує з чистого, не дописує надіслане

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
  border-top: 1px solid var(--border-color);
  background: var(--card-bg);
}

.chat-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 150px;
  resize: none;
  border-radius: 1.25rem;
  padding: 0.75rem 1rem;
  line-height: 1.5;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.chat-textarea:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent);
}

/* Мікрофон диктовки — узгоджений з інпутом; пульсує під час слухання */
.chat-mic {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.chat-mic:hover { border-color: var(--accent); }
.chat-mic:disabled { opacity: 0.5; cursor: default; }
.chat-mic.listening {
  background: rgba(239, 68, 68, 0.12);
  border-color: #ef4444;
  animation: chat-mic-pulse 1.1s ease-in-out infinite;
}
@keyframes chat-mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}
</style>
