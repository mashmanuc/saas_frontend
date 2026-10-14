<template>
  <Card class="space-y-4" data-testid="student-lesson-records">
    <Heading :level="2">
      {{ $t('studentDashboard.lessonRecords.title') }}
    </Heading>

    <!-- Loading State -->
    <div v-if="loading" class="text-sm text-muted">
      {{ $t('loader.loading') }}
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!hasRecords"
      class="rounded-2xl border border-dashed border-default bg-surface-soft p-4 space-y-1"
    >
      <p class="text-sm font-semibold text-body">
        {{ $t('studentDashboard.lessonRecords.empty.title') }}
      </p>
      <p class="text-sm text-muted">
        {{ $t('studentDashboard.lessonRecords.empty.description') }}
      </p>
    </div>

    <!-- Records List: записи МОЇХ уроків, які вчитель лишив видимими мені (2026-10-14) -->
    <ul v-else class="space-y-2">
      <li
        v-for="record in records"
        :key="record.id"
        class="rounded-2xl border border-default bg-card p-3 flex items-center gap-3"
        data-testid="student-lesson-record"
      >
        <img
          v-if="record.thumbnail_url"
          :src="record.thumbnail_url"
          alt=""
          class="w-20 h-12 rounded-lg object-cover bg-surface flex-none"
          loading="lazy"
        >
        <div class="flex-1 min-w-0 space-y-0.5">
          <p class="font-semibold text-sm text-body truncate">
            {{ record.title || $t('studentDashboard.lessonRecords.untitled') }}
          </p>
          <p class="text-xs text-muted">
            <span v-if="record.tutor?.name">{{ record.tutor.name }} · </span>
            <span>{{ formatDate(record.recorded_at) }}</span>
            <span v-if="record.duration_ms > 0"> · {{ formatDuration(record.duration_ms) }}</span>
          </p>
        </div>
        <router-link
          :to="{ name: 'winterboard-replay-owner', params: { replayId: record.id } }"
          class="flex-none text-sm font-medium text-accent hover:underline"
        >
          {{ $t('studentDashboard.lessonRecords.watch') }}
        </router-link>
      </li>
    </ul>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import type { StudentReplay } from '@/modules/winterboard/api/replayLifecycleApi'
import { activeLocale } from '@/utils/i18nDate'

interface Props {
  records: StudentReplay[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const { t } = useI18n()

const hasRecords = computed(() => props.records.length > 0)

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(activeLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  return t('studentDashboard.lessonRecords.minutes', { n: minutes })
}
</script>
