<template>
  <button
    type="button"
    :disabled="loading || disabled"
    :class="[
      'flex flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 transition',
      voted ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700',
      (loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click.stop="handleClick"
    :title="disabled ? $t('feedback.vote.locked') : ($t(voted ? 'feedback.vote.remove' : 'feedback.vote.add'))"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M7 14l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="text-sm font-semibold">{{ count }}</span>
  </button>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({
  voted: Boolean,
  count: { type: Number, default: 0 },
  disabled: Boolean,
})
const emit = defineEmits(['toggle'])

const loading = ref(false)
async function handleClick() {
  if (loading.value || props.disabled) return
  loading.value = true
  try {
    await emit('toggle')
  } finally {
    loading.value = false
  }
}
</script>
