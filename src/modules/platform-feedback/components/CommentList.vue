<template>
  <section class="mt-6">
    <h3 class="text-lg font-semibold text-slate-900 mb-3">
      💬 {{ $t('feedback.comments.title') }} ({{ comments.length }})
    </h3>

    <form
      v-if="!thread.is_locked && !thread.is_hidden && !thread.is_terminal"
      class="mb-4 flex flex-col gap-2"
      @submit.prevent="submit"
    >
      <textarea
        v-model="draft"
        rows="3"
        class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        :placeholder="$t('feedback.comments.placeholder')"
        maxlength="2000"
      />
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-500">{{ draft.length }}/2000</span>
        <button
          type="submit"
          :disabled="!draft.trim() || submitting"
          class="px-4 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {{ submitting ? $t('feedback.comments.sending') : $t('feedback.comments.send') }}
        </button>
      </div>
    </form>
    <p v-else class="mb-4 text-sm text-slate-500 italic">
      {{ thread.is_terminal ? $t('feedback.comments.terminal') : $t('feedback.comments.locked') }}
    </p>

    <p v-if="!comments.length" class="text-sm text-slate-500 italic">
      {{ $t('feedback.comments.empty') }}
    </p>

    <ul class="space-y-3">
      <li v-for="c in comments" :key="c.id" class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-slate-900">
            {{ c.author?.display_name || `User#${c.author?.id}` }}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">
              {{ formatDate(c.created_at) }}
            </span>
            <button
              v-if="canDelete(c)"
              type="button"
              class="text-xs text-rose-600 hover:underline"
              @click="$emit('delete', c.id)"
            >
              {{ $t('feedback.comments.delete') }}
            </button>
          </div>
        </div>
        <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ c.content }}</p>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

const props = defineProps({
  thread: { type: Object, required: true },
  comments: { type: Array, default: () => [] },
})
const emit = defineEmits(['submit', 'delete'])

const auth = useAuthStore()
const draft = ref('')
const submitting = ref(false)

async function submit() {
  if (!draft.value.trim()) return
  submitting.value = true
  try {
    await emit('submit', draft.value.trim())
    draft.value = ''
  } finally {
    submitting.value = false
  }
}

function canDelete(c) {
  return auth.user?.id === c.author?.id
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
  } catch (e) {
    return iso
  }
}
</script>
