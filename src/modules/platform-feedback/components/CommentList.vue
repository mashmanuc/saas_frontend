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
        :maxlength="COMMENT_MAX_LENGTH"
        data-test="comment-input"
        @input="error = ''"
      />
      <!-- Відмова сервера — тут, біля форми; текст коментаря лишається в полі. -->
      <p v-if="error" class="text-sm text-rose-600" role="alert" data-test="comment-error">{{ $t(error) }}</p>
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-500">
          {{ draft.length }}/{{ COMMENT_MAX_LENGTH }}
          <span v-if="tooShort" class="ml-2" data-test="comment-min-hint">· {{ $t('feedback.comments.minLengthHint') }}</span>
        </span>
        <button
          type="submit"
          :disabled="!canSubmit"
          class="px-4 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
          data-test="comment-send"
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
import { computed, ref } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { activeLocale } from '@/utils/i18nDate'
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH, commentErrorKey, commentLength } from '../feedbackErrors'

const props = defineProps({
  thread: { type: Object, required: true },
  comments: { type: Array, default: () => [] },
  /**
   * Надіслати коментар: async (content) => void, кидає помилку сервера.
   * Функцією, а не подією: `await emit(...)` нічого не чекає — відмова сервера пролітала повз
   * форму до AppErrorBoundary («Щось пішло не так»), а поле очищувалось і при помилці.
   */
  send: { type: Function, required: true },
})
defineEmits(['delete'])

const auth = useAuthStore()
const draft = ref('')
const submitting = ref(false)
/** Ключ перекладу причини відмови; порожньо — помилки немає. */
const error = ref('')

const length = computed(() => commentLength(draft.value))
// Підказка — лише коли людина вже почала писати: порожнє поле не сварить.
const tooShort = computed(() => length.value > 0 && length.value < COMMENT_MIN_LENGTH)
const canSubmit = computed(() => !submitting.value && length.value >= COMMENT_MIN_LENGTH)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    await props.send(draft.value.trim())
    draft.value = ''
  } catch (err) {
    error.value = commentErrorKey(err)
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
    return new Date(iso).toLocaleString(activeLocale(), { dateStyle: 'short', timeStyle: 'short' })
  } catch (e) {
    return iso
  }
}
</script>
