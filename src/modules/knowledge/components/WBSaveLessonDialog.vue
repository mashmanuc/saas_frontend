<!-- Phase 21: Save session as draft lesson dialog
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="save-lesson-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
      @keydown.escape="close"
    >
      <div
        ref="dialogRef"
        class="save-lesson-dialog bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('winterboard.lesson.saveTitle')"
        tabindex="-1"
      >
        <h2 class="text-lg font-bold text-gray-900">{{ $t('winterboard.lesson.saveTitle') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ $t('winterboard.lesson.saveSubtitle') }}</p>

        <!-- Title input -->
        <div class="mt-4">
          <label for="lesson-title" class="block text-sm font-medium text-gray-700">
            {{ $t('winterboard.lesson.titleLabel') }}
          </label>
          <input
            id="lesson-title"
            ref="titleInput"
            v-model="title"
            class="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            :placeholder="$t('winterboard.lesson.titlePlaceholder')"
            maxlength="255"
            @keydown.enter="save"
          />
          <p class="mt-1 text-xs text-gray-400 text-right">{{ title.length }}/255</p>
        </div>

        <!-- Error -->
        <p v-if="saveError" class="mt-2 text-sm text-red-600" role="alert">{{ saveError }}</p>

        <!-- Actions -->
        <div class="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            @click="close"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="isSaving || !title.trim()"
            class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            @click="save"
          >
            {{ isSaving ? $t('winterboard.lesson.saving') : $t('winterboard.lesson.saveButton') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { lessonSaveApi } from '../api/lessonSaveApi'

const props = defineProps<{
  modelValue: boolean
  sessionId: string
  defaultTitle?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [lesson: { id: string; title: string }]
}>()

const dialogRef = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Reset form when dialog opens
watch(() => props.modelValue, (open) => {
  if (open) {
    title.value = props.defaultTitle || ''
    saveError.value = null
    isSaving.value = false
    nextTick(() => {
      dialogRef.value?.focus()
      titleInput.value?.focus()
    })
  }
})

function close(): void {
  emit('update:modelValue', false)
}

async function save(): Promise<void> {
  const trimmed = title.value.trim()
  if (!trimmed || isSaving.value) return

  isSaving.value = true
  saveError.value = null

  try {
    const lesson = await lessonSaveApi.saveLessonFromSession({
      session_id: props.sessionId,
      title: trimmed,
    })
    emit('saved', { id: lesson.id, title: lesson.title })
    close()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { error?: string } } }
    saveError.value = axiosErr?.response?.data?.error || 'Failed to save lesson'
    console.error('[WBSaveLessonDialog] save error:', err)
  } finally {
    isSaving.value = false
  }
}

// Focus trap
function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !props.modelValue || !dialogRef.value) return
  const focusable = dialogRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
</script>

<style scoped>
@media (max-width: 640px) {
  .save-lesson-dialog {
    @apply rounded-none max-w-none m-0 min-h-screen;
  }
  .save-lesson-overlay {
    @apply items-stretch;
  }
}
</style>
