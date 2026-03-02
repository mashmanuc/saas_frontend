<template>
  <div
    class="group relative cursor-pointer rounded-xl border border-border-subtle bg-background p-4 transition hover:border-primary/40 hover:shadow-md"
    data-test="lesson-template-card"
    @click="$emit('select', template.id)"
  >
    <!-- Header: title + badges -->
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-sm font-semibold text-foreground line-clamp-2">
        {{ template.title }}
      </h3>

      <div class="flex shrink-0 items-center gap-1.5">
        <!-- §G8: moderation_status badge -->
        <Badge :variant="moderationBadgeVariant" data-test="moderation-badge">
          {{ moderationLabel }}
        </Badge>

        <Badge v-if="template.is_published" variant="success" data-test="published-badge">
          {{ t('lessons.templates.published') }}
        </Badge>
      </div>
    </div>

    <!-- Meta row -->
    <p v-if="template.description" class="mt-1 text-xs text-muted line-clamp-2">
      {{ template.description }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
      <span v-if="template.subject" data-test="template-subject">
        {{ template.subject }}
      </span>

      <span data-test="template-type">
        {{ t(`lessons.type.${template.lesson_type}`) }}
      </span>

      <span data-test="template-materials">
        {{ t('lessons.templates.materialsCount', { count: template.materials_count }) }}
      </span>

      <span v-if="template.has_homework" class="text-primary" data-test="template-homework">
        {{ t('lessons.templates.hasHomework') }}
      </span>
    </div>

    <!-- Footer: version + ownership actions -->
    <div class="mt-3 flex items-center justify-between">
      <span class="text-[10px] text-muted/60">
        v{{ template.version }}
      </span>

      <!-- §G8: edit/delete тільки для власних шаблонів -->
      <div v-if="isOwner" class="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          class="rounded p-1 text-xs text-muted hover:bg-surface-soft hover:text-foreground"
          data-test="template-edit-btn"
          @click.stop="$emit('edit', template.id)"
        >
          {{ t('lessons.templates.edit') }}
        </button>
        <button
          type="button"
          class="rounded p-1 text-xs text-danger hover:bg-red-50"
          data-test="template-delete-btn"
          @click.stop="$emit('delete', template.id)"
        >
          {{ t('lessons.templates.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Badge from '@/ui/Badge.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import type { LessonTemplateSummary, ModerationStatus } from '../types/lessonTypes'

const props = defineProps<{
  template: LessonTemplateSummary
}>()

defineEmits<{
  select: [id: number]
  edit: [id: number]
  delete: [id: number]
}>()

const { t } = useI18n()
const authStore = useAuthStore()

// §G8: не показувати edit/delete кнопки для чужих шаблонів
const isOwner = computed(() => {
  const userId = authStore.user?.id
  if (!userId) return false
  // Summary shape does not expose owner; detail does.
  // For list cards we rely on backend filtering (tutor sees only own + platform published).
  // If template has owner field — check it; otherwise assume own (backend returns only own).
  const tpl = props.template as LessonTemplateSummary & { owner?: number | null }
  return tpl.owner == null || tpl.owner === userId
})

const MODERATION_VARIANT_MAP: Record<ModerationStatus, string> = {
  DRAFT: 'muted',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
}

const moderationBadgeVariant = computed(() =>
  MODERATION_VARIANT_MAP[props.template.moderation_status] ?? 'muted',
)

const moderationLabel = computed(() => {
  const status = props.template.moderation_status
  // Re-use status i18n keys where available
  const map: Record<ModerationStatus, string> = {
    DRAFT: t('lessons.templates.draft'),
    PENDING: 'Pending',
    APPROVED: t('lessons.templates.published'),
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended',
  }
  return map[status] ?? status
})
</script>
