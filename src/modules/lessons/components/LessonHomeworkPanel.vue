<template>
  <div class="space-y-4" data-test="lesson-homework-panel">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-foreground">
        {{ t('lessons.homework.title') }}
      </h3>
      <Button
        variant="primary"
        size="sm"
        data-test="assign-homework-btn"
        @click="$emit('assign')"
      >
        {{ t('lessons.homework.assign') }}
      </Button>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-background px-3 py-4 text-center text-sm text-muted"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="!items.length"
      icon="📝"
      :title="t('lessons.homework.empty')"
      :description="''"
    />

    <!-- Homework list -->
    <div v-else class="space-y-3">
      <div
        v-for="hw in items"
        :key="hw.id"
        class="rounded-lg border border-border-subtle bg-background p-4 space-y-2"
        data-test="homework-item"
      >
        <!-- Header: status + due date -->
        <div class="flex items-center justify-between gap-2">
          <Badge :variant="statusBadgeVariant(hw.status)" data-test="hw-status-badge">
            {{ t(`lessons.homework.status.${hw.status}`) }}
          </Badge>
          <span v-if="hw.due_date" class="text-xs text-muted" data-test="hw-due-date">
            {{ t('lessons.homework.dueDate') }}: {{ formatDate(hw.due_date) }}
          </span>
        </div>

        <!-- Instructions -->
        <p class="text-sm text-foreground whitespace-pre-line" data-test="hw-instructions">
          {{ hw.instructions }}
        </p>

        <!-- Content items thumbnails -->
        <div v-if="hw.content_items?.length" class="flex flex-wrap gap-2">
          <div
            v-for="item in hw.content_items"
            :key="item.id"
            class="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-soft px-2 py-1 text-xs"
            data-test="hw-content-item"
          >
            <img
              v-if="item.thumbnail_url"
              :src="item.thumbnail_url"
              :alt="item.title"
              class="h-5 w-5 rounded object-cover"
            />
            <span class="text-muted">{{ item.title }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import EmptyState from '@/ui/EmptyState.vue'
import type { LessonHomework, HomeworkStatus } from '../types/lessonTypes'

defineProps<{
  items: LessonHomework[]
  loading?: boolean
}>()

defineEmits<{
  assign: []
}>()

const { t } = useI18n()

const STATUS_VARIANT_MAP: Record<HomeworkStatus, string> = {
  ASSIGNED: 'default',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'default',
  REVIEWED: 'success',
  RETURNED: 'danger',
}

function statusBadgeVariant(status: HomeworkStatus): string {
  return STATUS_VARIANT_MAP[status] ?? 'muted'
}

function formatDate(iso: string): string {
  return dayjs(iso).format('DD MMM YYYY HH:mm')
}
</script>
