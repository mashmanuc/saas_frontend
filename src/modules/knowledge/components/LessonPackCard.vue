<!-- Knowledge: Lesson pack (series) card
     Ref: Phase 14 B2.3 -->
<template>
  <router-link
    :to="`/pack/${pack.tutor_slug}/${pack.slug}`"
    class="lesson-pack-card block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    :aria-label="pack.title"
  >
    <!-- Thumbnail grid: 2×2 from first 4 lessons -->
    <div class="grid grid-cols-2 aspect-video">
      <div v-for="i in 4" :key="i" class="bg-gray-100 overflow-hidden">
        <img
          v-if="thumbnails[i - 1]"
          :src="thumbnails[i - 1]"
          class="w-full h-full object-cover"
          :alt="`${pack.title} thumbnail ${i}`"
          loading="lazy"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
          <LayoutDashboard :size="24" />
        </div>
      </div>
    </div>

    <div class="p-3">
      <h3 class="font-semibold text-sm line-clamp-1">{{ pack.title }}</h3>
      <div class="flex items-center gap-1.5 mt-1">
        <span class="text-xs text-gray-600">{{ pack.tutor_name }}</span>
      </div>
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-500">
          {{ $t('knowledge.pack.lessonCount', { count: pack.lesson_count }) }}
        </span>
        <span
          :class="[
            'text-xs px-2 py-0.5 rounded-full',
            pack.status === 'public'
              ? 'bg-green-100 text-green-700'
              : pack.status === 'hidden'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600',
          ]"
        >
          {{ $t(`knowledge.pack.status.${pack.status}`) }}
        </span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { LayoutDashboard } from 'lucide-vue-next'
import type { LessonPack } from '../api/templateApi'

withDefaults(defineProps<{
  pack: LessonPack
  thumbnails?: string[]
}>(), {
  thumbnails: () => [],
})
</script>
