<!-- Knowledge: Lesson template card for library grid
     Ref: Phase 14 B1.1 -->
<template>
  <article
    class="lesson-template-card group cursor-pointer rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    :aria-label="template.source_lesson_title"
  >
    <!-- Thumbnail -->
    <div class="aspect-video bg-gray-100 relative">
      <img
        v-if="template.board_thumbnail_url"
        :src="template.board_thumbnail_url"
        :alt="template.source_lesson_title"
        class="w-full h-full object-cover"
        loading="lazy"
        @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
        <LayoutDashboard :size="48" />
      </div>
      <!-- Subject badge -->
      <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        {{ $t(`subject.${template.subject_tag}`, template.subject_tag) }}
      </span>
      <!-- Community badge -->
      <span
        v-if="template.is_community"
        class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"
      >
        {{ $t('knowledge.template.community') }}
      </span>
    </div>

    <!-- Content -->
    <div class="p-3">
      <h3 class="font-semibold text-sm line-clamp-2">{{ template.source_lesson_title }}</h3>

      <!-- Fork badge -->
      <ForkBadge v-if="template.parent_lesson" :parent-lesson="template.parent_lesson" class="mt-1" />

      <!-- Author -->
      <div class="flex items-center gap-1.5 mt-1.5">
        <img
          :src="template.tutor_avatar_url || '/default-avatar.svg'"
          class="w-5 h-5 rounded-full object-cover"
          :alt="template.tutor_name"
          @error="onAvatarError"
        />
        <router-link
          v-if="template.tutor_slug"
          :to="`/marketplace/${template.tutor_slug}`"
          class="text-xs text-gray-600 hover:text-primary-600 hover:underline"
          @click.stop
        >
          {{ template.tutor_name }}
        </router-link>
        <span v-else class="text-xs text-gray-600">{{ template.tutor_name }}</span>
      </div>

      <!-- Meta row -->
      <div class="flex items-center justify-between mt-2">
        <DifficultyStars :level="template.difficulty_level" />
        <span class="text-xs text-gray-500">
          {{ $t('knowledge.template.usedCount', { count: template.used_count }) }}
        </span>
      </div>

      <!-- Rating -->
      <RatingSummary
        v-if="template.average_rating"
        :average-rating="template.average_rating"
        :rating-count="template.rating_count || 0"
        size="sm"
        class="mt-1.5"
      />

      <!-- CTA -->
      <button
        type="button"
        class="mt-3 w-full py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        @click.stop="$emit('clone', template.id)"
      >
        {{ $t('knowledge.template.useButton') }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { LayoutDashboard } from 'lucide-vue-next'
import DifficultyStars from './DifficultyStars.vue'
import ForkBadge from './ForkBadge.vue'
import RatingSummary from './RatingSummary.vue'

export interface LessonTemplateParent {
  tutor_name: string
  tutor_slug: string
  slug: string
}

export interface LessonTemplate {
  id: string
  source_lesson_title: string
  source_lesson_slug: string
  tutor_name: string
  tutor_slug: string
  tutor_avatar_url: string | null
  is_community: boolean
  used_count: number
  subject_tag: string
  difficulty_level: number
  board_thumbnail_url: string | null
  created_at: string
  parent_lesson?: LessonTemplateParent | null
  average_rating?: number | null
  rating_count?: number
}

defineProps<{
  template: LessonTemplate
}>()

defineEmits<{
  clone: [templateId: string]
}>()

function onAvatarError(e: Event): void {
  const img = e.target as HTMLImageElement
  img.src = '/default-avatar.svg'
}
</script>
