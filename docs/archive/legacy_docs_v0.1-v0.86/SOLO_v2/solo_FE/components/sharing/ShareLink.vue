<template>
  <div class="share-link">
    <input
      ref="inputRef"
      type="text"
      :value="url"
      readonly
      class="share-link__input"
      @focus="selectAll"
    />
    <button
      class="share-link__btn"
      @click="copyToClipboard"
      :title="$t('common.copy')"
    >
      {{ copied ? '✓' : '📋' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  url: string
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const copied = ref(false)

function selectAll(): void {
  inputRef.value?.select()
}

async function copyToClipboard(): Promise<void> {
  if (!inputRef.value) return

  try {
    await navigator.clipboard.writeText(inputRef.value.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback for older browsers
    inputRef.value.select()
    document.execCommand('copy')
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}
</script>

<style scoped>
.share-link {
  display: flex;
  gap: 0.5rem;
}

.share-link__input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
  background: var(--bg-secondary, #f9fafb);
}

.share-link__input:focus {
  outline: none;
  border-color: var(--accent-color, #3b82f6);
}

.share-link__btn {
  padding: 0.75rem 1rem;
  background: var(--accent-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  min-width: 48px;
}

.share-link__btn:hover {
  opacity: 0.9;
}
</style>
