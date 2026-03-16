<!-- Knowledge: Fork badge — inline link to original lesson
     Ref: Phase 14 B1.3 -->
<template>
  <router-link
    v-if="parentLesson"
    :to="`/lesson/${parentLesson.tutor_slug}/${parentLesson.slug}`"
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs hover:bg-purple-100 transition-colors"
  >
    <GitFork :size="12" />
    {{ $t('knowledge.fork.badge', { author: parentLesson.tutor_name }) }}
  </router-link>
</template>

<script setup lang="ts">
import { GitFork } from 'lucide-vue-next'

export interface ParentLesson {
  tutor_name: string
  tutor_slug: string
  slug: string
}

defineProps<{
  parentLesson: ParentLesson | null
}>()
</script>
