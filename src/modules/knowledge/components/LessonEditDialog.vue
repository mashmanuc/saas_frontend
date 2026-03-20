<!-- Phase 25 B1: Edit lesson metadata dialog
     INVARIANT: Edits ONLY metadata (title, description, subject_tag).
     Snapshot content is IMMUTABLE — never modified through this dialog.
     RISK #6: Edit UI must NOT touch snapshot data. -->
<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="close"
    >
      <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t('knowledge.lesson.editTitle') }}
        </h3>

        <form @submit.prevent="save">
          <!-- Title -->
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('knowledge.lesson.edit.titleLabel') }}
            </label>
            <input
              v-model="form.title"
              type="text"
              maxlength="255"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :placeholder="$t('knowledge.lesson.edit.titlePlaceholder')"
            />
          </div>

          <!-- Description -->
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('knowledge.lesson.edit.descriptionLabel') }}
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="5000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              :placeholder="$t('knowledge.lesson.edit.descriptionPlaceholder')"
            />
          </div>

          <!-- Subject tag -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('knowledge.lesson.edit.subjectLabel') }}
            </label>
            <input
              v-model="form.subject_tag"
              type="text"
              maxlength="50"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :placeholder="$t('knowledge.lesson.edit.subjectPlaceholder')"
            />
          </div>

          <!-- Error -->
          <p v-if="error" class="text-sm text-red-600 mb-3">{{ error }}</p>

          <!-- Buttons -->
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="close"
            >
              {{ $t('knowledge.lesson.edit.cancel') }}
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              :disabled="isSaving || !form.title.trim()"
            >
              {{ isSaving
                ? $t('knowledge.lesson.edit.saving')
                : $t('knowledge.lesson.edit.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { MyLesson } from '../api/lessonSaveApi'

const props = defineProps<{
  modelValue: boolean
  lesson: MyLesson | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [lesson: MyLesson]
}>()

const { t } = useI18n()

const form = ref({
  title: '',
  description: '',
  subject_tag: '',
})
const isSaving = ref(false)
const error = ref<string | null>(null)

// Sync form with lesson prop
watch(() => props.lesson, (lesson) => {
  if (lesson) {
    form.value = {
      title: lesson.title,
      description: lesson.description || '',
      subject_tag: lesson.subject_tag || '',
    }
    error.value = null
  }
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
}

async function save() {
  if (!props.lesson || !form.value.title.trim()) return

  isSaving.value = true
  error.value = null

  try {
    // INVARIANT: PATCH sends ONLY metadata fields
    // NEVER send snapshot data here (RISK #6)
    const body: Record<string, string> = {}

    if (form.value.title.trim() !== props.lesson.title) {
      body.title = form.value.title.trim()
    }
    if (form.value.description.trim() !== (props.lesson.description || '')) {
      body.description = form.value.description.trim()
    }
    if (form.value.subject_tag.trim() !== (props.lesson.subject_tag || '')) {
      body.subject_tag = form.value.subject_tag.trim()
    }

    // Only send if something changed
    if (Object.keys(body).length === 0) {
      close()
      return
    }

    const updated = await lessonSaveApi.updateLesson(props.lesson.id, body)

    // Emit updated lesson back to parent
    emit('saved', {
      ...props.lesson,
      title: updated.title ?? form.value.title.trim(),
      description: updated.description ?? form.value.description.trim(),
      subject_tag: updated.subject_tag ?? form.value.subject_tag.trim(),
    })

    close()
  } catch (err: unknown) {
    console.error('[LessonEditDialog] Save failed:', err)
    const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    error.value = message || t('knowledge.lesson.edit.error')
  } finally {
    isSaving.value = false
  }
}
</script>
