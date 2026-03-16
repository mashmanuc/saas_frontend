<!-- Knowledge: Save lesson as template dialog
     Ref: Phase 14 B2.1 -->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="save-template-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
      @keydown.escape="close"
    >
      <div
        ref="dialogRef"
        class="save-template-dialog bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('knowledge.template.saveTitle')"
        tabindex="-1"
      >
        <h2 class="text-lg font-bold">{{ $t('knowledge.template.saveTitle') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ $t('knowledge.template.saveSubtitle') }}</p>

        <!-- Title (prefilled) -->
        <div class="mt-4">
          <label for="template-title" class="block text-sm font-medium text-gray-700">
            {{ $t('knowledge.template.titleLabel') }}
          </label>
          <input
            id="template-title"
            v-model="form.title"
            class="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <!-- Subject -->
        <div class="mt-3">
          <label for="template-subject" class="block text-sm font-medium text-gray-700">
            {{ $t('knowledge.template.subjectLabel') }}
          </label>
          <select
            id="template-subject"
            v-model="form.subject_tag"
            class="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option v-for="s in subjects" :key="s" :value="s">
              {{ $t(`subject.${s}`, s) }}
            </option>
          </select>
        </div>

        <!-- Difficulty (1-5 interactive stars) -->
        <div class="mt-3">
          <label class="block text-sm font-medium text-gray-700">
            {{ $t('knowledge.template.difficultyLabel') }}
          </label>
          <DifficultyStars
            :level="form.difficulty_level"
            interactive
            :size="20"
            class="mt-1"
            @change="v => form.difficulty_level = v"
          />
        </div>

        <!-- Community toggle -->
        <div class="mt-3 flex items-center gap-2">
          <input
            id="is_community"
            v-model="form.is_community"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label for="is_community" class="text-sm text-gray-700">
            {{ $t('knowledge.template.communityToggle') }}
          </label>
        </div>
        <p class="text-xs text-gray-400 mt-1">{{ $t('knowledge.template.communityHint') }}</p>

        <!-- Preview thumbnail (read-only) -->
        <div v-if="thumbnailUrl" class="mt-3 rounded-lg overflow-hidden border">
          <img :src="thumbnailUrl" class="w-full aspect-video object-cover" :alt="form.title" />
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
            :disabled="isSaving || !form.title.trim()"
            class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            @click="save"
          >
            {{ isSaving ? $t('knowledge.template.saving') : $t('knowledge.template.saveButton') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick, onUnmounted } from 'vue'
import { templateApi } from '../api/templateApi'
import type { LessonTemplate } from '../api/templateApi'
import DifficultyStars from './DifficultyStars.vue'

const SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics', 'other',
] as const

const subjects = [...SUBJECTS]

const props = defineProps<{
  modelValue: boolean
  lessonId: string
  lessonTitle: string
  subjectTag: string
  thumbnailUrl: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [template: LessonTemplate]
}>()

const dialogRef = ref<HTMLElement | null>(null)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

const form = reactive({
  title: '',
  subject_tag: '',
  difficulty_level: 3,
  is_community: true,
})

// Prefill form when dialog opens
watch(() => props.modelValue, (open) => {
  if (open) {
    form.title = props.lessonTitle
    form.subject_tag = props.subjectTag || 'other'
    form.difficulty_level = 3
    form.is_community = true
    saveError.value = null
    nextTick(() => dialogRef.value?.focus())
  }
})

function close(): void {
  emit('update:modelValue', false)
}

async function save(): Promise<void> {
  if (!form.title.trim() || isSaving.value) return
  isSaving.value = true
  saveError.value = null
  try {
    const template = await templateApi.saveAsTemplate({
      lesson_id: props.lessonId,
      is_community: form.is_community,
      difficulty_level: form.difficulty_level,
    })
    emit('saved', template)
    close()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    saveError.value = msg || 'Failed to save template'
    console.error('[SaveAsTemplateDialog] save error:', err)
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
  .save-template-dialog {
    @apply rounded-none max-w-none m-0 min-h-screen;
  }
  .save-template-overlay {
    @apply items-stretch;
  }
}
</style>
