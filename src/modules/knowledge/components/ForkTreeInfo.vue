<!-- Knowledge: Fork tree info — shows fork count + expandable list
     Ref: Phase 14 B2.4 -->
<template>
  <div v-if="forkCount > 0" class="fork-tree-info">
    <button
      type="button"
      class="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 transition-colors"
      :aria-expanded="expanded"
      aria-controls="fork-tree-list"
      :aria-label="$t('knowledge.fork.treeCount', { count: forkCount })"
      @click="expanded = !expanded"
    >
      <GitFork :size="16" />
      {{ $t('knowledge.fork.treeCount', { count: forkCount }) }}
      <ChevronDown
        :size="14"
        :class="expanded ? 'rotate-180' : ''"
        class="transition-transform"
      />
    </button>

    <Transition name="slide">
      <ul v-if="expanded" id="fork-tree-list" aria-live="polite" class="mt-2 space-y-2 ml-4">
        <li v-for="fork in forks" :key="fork.id" class="flex items-center gap-2">
          <router-link
            :to="`/lesson/${fork.tutor_slug}/${fork.slug}`"
            class="text-sm text-primary-600 hover:underline"
          >
            {{ fork.title }}
          </router-link>
          <span class="text-xs text-gray-400">{{ fork.tutor_name }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GitFork, ChevronDown } from 'lucide-vue-next'

export interface ForkItem {
  id: string
  title: string
  tutor_name: string
  tutor_slug: string
  slug: string
}

defineProps<{
  forkCount: number
  forks: ForkItem[]
}>()

const expanded = ref(false)
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
