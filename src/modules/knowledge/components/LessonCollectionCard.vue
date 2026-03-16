<!-- Knowledge: Collection card — thumbnail grid, title, featured badge
     Ref: Phase 15 B1.3 -->
<template>
  <router-link
    :to="`/knowledge/collections/${collection.slug}`"
    class="lesson-collection-card block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    :aria-label="collection.title"
  >
    <!-- Thumbnail grid: 2×2 -->
    <div class="grid grid-cols-2 aspect-video">
      <div v-for="i in 4" :key="i" class="bg-gray-100 flex items-center justify-center">
        <img v-if="thumbnails[i-1]" :src="thumbnails[i-1]" class="w-full h-full object-cover" alt="" loading="lazy" />
        <LayoutDashboard v-else :size="24" class="text-gray-300" />
      </div>
    </div>

    <div class="p-3">
      <div class="flex items-center gap-2">
        <span v-if="collection.is_featured" class="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
          {{ $t('knowledge.collection.featured') }}
        </span>
      </div>
      <h3 class="font-semibold text-sm line-clamp-1 mt-1">{{ collection.title }}</h3>
      <p v-if="collection.description" class="text-xs text-gray-500 line-clamp-2 mt-0.5">{{ collection.description }}</p>
      <span class="text-xs text-gray-400 mt-1 block">
        {{ $t('knowledge.collection.lessonCount', { count: collection.lesson_count }) }}
      </span>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { LayoutDashboard } from 'lucide-vue-next'

export interface LessonCollection {
  id: string
  title: string
  description: string
  slug: string
  is_featured: boolean
  lesson_count: number
}

withDefaults(defineProps<{
  collection: LessonCollection
  thumbnails?: string[]
}>(), {
  thumbnails: () => [],
})
</script>
