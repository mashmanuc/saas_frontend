<template>
  <Modal
    :open="open"
    :title="t('lessons.homework.assign')"
    size="md"
    @close="$emit('close')"
  >
    <div class="space-y-4">
      <!-- Instructions -->
      <Textarea
        v-model="form.instructions"
        :label="t('lessons.homework.instructions')"
        :rows="4"
        :maxlength="5000"
        required
        data-test="hw-modal-instructions"
      />

      <!-- Due date -->
      <Input
        v-model="form.due_date"
        :label="t('lessons.homework.dueDate')"
        type="datetime-local"
        data-test="hw-modal-due-date"
      />

      <!-- Content items (IDs input — simplified picker) -->
      <div class="space-y-1">
        <label class="text-sm font-medium text-foreground">
          {{ t('lessons.homework.contentItems') }}
        </label>
        <p class="text-xs text-muted">
          {{ t('lessons.homework.contentItemsHint') }}
        </p>
        <input
          v-model="contentItemsRaw"
          class="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          :placeholder="t('lessons.homework.contentItemsPlaceholder')"
          data-test="hw-modal-content-items"
        />
      </div>
    </div>

    <template #footer>
      <Button
        variant="ghost"
        size="sm"
        :disabled="submitting"
        data-test="hw-modal-cancel"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="sm"
        :loading="submitting"
        :disabled="!form.instructions.trim()"
        data-test="hw-modal-submit"
        @click="handleSubmit"
      >
        {{ t('lessons.homework.assign') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import Textarea from '@/ui/Textarea.vue'
import { lessonsTemplateApi } from '../api/lessonsTemplateApi'
import { notifyError, notifySuccess } from '@/utils/notify'
import type { LessonHomeworkCreatePayload } from '../types/lessonTypes'

const props = defineProps<{
  open: boolean
  lessonId: number
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const { t } = useI18n()
const submitting = ref(false)

const form = reactive({
  instructions: '',
  due_date: '',
})

const contentItemsRaw = ref('')

const parsedContentItems = computed((): number[] => {
  if (!contentItemsRaw.value.trim()) return []
  return contentItemsRaw.value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
})

// Reset form when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.instructions = ''
      form.due_date = ''
      contentItemsRaw.value = ''
    }
  },
)

async function handleSubmit() {
  if (!form.instructions.trim()) return

  submitting.value = true
  try {
    const payload: LessonHomeworkCreatePayload = {
      instructions: form.instructions.trim(),
      content_items: parsedContentItems.value,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    }
    await lessonsTemplateApi.createHomework(props.lessonId, payload)
    notifySuccess(t('lessons.homework.assignSuccess'))
    emit('created')
    emit('close')
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
      t('lessons.homework.assignError')
    notifyError(message)
  } finally {
    submitting.value = false
  }
}
</script>
