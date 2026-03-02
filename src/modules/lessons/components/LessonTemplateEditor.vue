<template>
  <div class="space-y-5" data-test="lesson-template-editor">
    <!-- Title -->
    <Input
      v-model="form.title"
      :label="t('common.title')"
      required
      data-test="template-title"
    />

    <!-- Description -->
    <Textarea
      v-model="form.description"
      :label="t('common.description')"
      :rows="3"
      :maxlength="2000"
      data-test="template-description"
    />

    <!-- Subject -->
    <Input
      v-model="form.subject"
      :label="t('lessons.templates.subject')"
      data-test="template-subject"
    />

    <!-- Lesson type -->
    <Select
      v-model="form.lesson_type"
      :label="t('lessons.templates.lessonType')"
      :options="lessonTypeOptions"
      data-test="template-lesson-type"
    />

    <!-- Structure JSON editor -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">
        {{ t('lessons.templates.structure') }}
      </label>
      <div class="space-y-2">
        <div
          v-for="(value, key) in form.structure_json"
          :key="key"
          class="flex items-center gap-2"
        >
          <input
            :value="key"
            class="w-1/3 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            readonly
            data-test="structure-key"
          />
          <input
            :value="value"
            class="flex-1 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            data-test="structure-value"
            @input="updateStructureValue(key as string, ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="rounded p-1 text-xs text-danger hover:bg-red-50"
            data-test="structure-remove"
            @click="removeStructureKey(key as string)"
          >
            &times;
          </button>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newStructureKey"
            :placeholder="t('lessons.templates.structureKeyPlaceholder')"
            class="w-1/3 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            data-test="structure-new-key"
          />
          <input
            v-model="newStructureValue"
            :placeholder="t('lessons.templates.structureValuePlaceholder')"
            class="flex-1 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            data-test="structure-new-value"
          />
          <Button
            variant="ghost"
            size="sm"
            :disabled="!newStructureKey.trim()"
            data-test="structure-add"
            @click="addStructureEntry"
          >
            +
          </Button>
        </div>
      </div>
    </div>

    <!-- Homework template section -->
    <div class="rounded-lg border border-border-subtle p-4 space-y-3">
      <h4 class="text-sm font-semibold text-foreground">
        {{ t('lessons.homework.title') }}
      </h4>

      <Textarea
        v-model="form.homework_instructions"
        :label="t('lessons.homework.instructions')"
        :rows="2"
        :maxlength="5000"
        data-test="template-hw-instructions"
      />
    </div>

    <!-- Moderation info (read-only) -->
    <div v-if="isEditing" class="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span>
        {{ t('lessons.templates.moderationStatus') }}:
        <Badge :variant="moderationBadgeVariant">
          {{ moderationLabel }}
        </Badge>
      </span>
      <span v-if="detail?.is_published" class="text-success">
        {{ t('lessons.templates.published') }}
      </span>
      <span>v{{ detail?.version }}</span>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-2">
      <Button
        variant="ghost"
        size="sm"
        :disabled="saving"
        data-test="template-cancel"
        @click="$emit('cancel')"
      >
        {{ t('common.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="sm"
        :loading="saving"
        :disabled="!form.title.trim()"
        data-test="template-save"
        @click="handleSave"
      >
        {{ t('common.save') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Input from '@/ui/Input.vue'
import Textarea from '@/ui/Textarea.vue'
import Select from '@/ui/Select.vue'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import type {
  LessonTemplateDetail,
  LessonTemplateCreatePayload,
  LessonType,
  ModerationStatus,
} from '../types/lessonTypes'

const props = defineProps<{
  detail?: LessonTemplateDetail | null
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [payload: LessonTemplateCreatePayload]
  cancel: []
}>()

const { t } = useI18n()

const isEditing = computed(() => Boolean(props.detail?.id))

const LESSON_TYPES: LessonType[] = [
  'PLANNED',
  'INSTANT',
  'TEMPLATE_BASED',
  'PRE_BUILT',
  'DYNAMIC',
  'PACKAGE',
  'PROGRAM',
]

const lessonTypeOptions = computed(() =>
  LESSON_TYPES.map((type) => ({
    value: type,
    label: t(`lessons.type.${type}`),
  })),
)

const form = reactive({
  title: '',
  description: '',
  subject: '',
  lesson_type: 'PLANNED' as LessonType,
  structure_json: {} as Record<string, string>,
  homework_instructions: '',
})

const newStructureKey = ref('')
const newStructureValue = ref('')

// Populate form when detail prop changes (edit mode)
watch(
  () => props.detail,
  (d) => {
    if (d) {
      form.title = d.title ?? ''
      form.description = d.description ?? ''
      form.subject = d.subject ?? ''
      form.lesson_type = d.lesson_type ?? 'PLANNED'
      form.structure_json = { ...(d.structure_json ?? {}) }
      form.homework_instructions = d.homework_template?.instructions ?? ''
    }
  },
  { immediate: true },
)

function updateStructureValue(key: string, value: string) {
  form.structure_json[key] = value
}

function removeStructureKey(key: string) {
  const copy = { ...form.structure_json }
  delete copy[key]
  form.structure_json = copy
}

function addStructureEntry() {
  const key = newStructureKey.value.trim()
  if (!key) return
  form.structure_json = {
    ...form.structure_json,
    [key]: newStructureValue.value,
  }
  newStructureKey.value = ''
  newStructureValue.value = ''
}

function handleSave() {
  const payload: LessonTemplateCreatePayload = {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    subject: form.subject.trim() || undefined,
    lesson_type: form.lesson_type,
    structure_json: Object.keys(form.structure_json).length ? form.structure_json : undefined,
  }
  if (form.homework_instructions.trim()) {
    payload.homework_template = {
      instructions: form.homework_instructions.trim(),
      content_items: props.detail?.homework_template?.content_items ?? [],
    }
  }
  emit('save', payload)
}

// Moderation display (read-only)
const MODERATION_VARIANT_MAP: Record<ModerationStatus, string> = {
  DRAFT: 'muted',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
}

const moderationBadgeVariant = computed(() =>
  props.detail ? (MODERATION_VARIANT_MAP[props.detail.moderation_status] ?? 'muted') : 'muted',
)

const moderationLabel = computed(() => {
  if (!props.detail) return ''
  return props.detail.moderation_status
})
</script>
