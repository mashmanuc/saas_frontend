<!-- Knowledge: Template library empty state
     Ref: Phase 14 B1.4 -->
<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <BookOpen :size="64" class="text-gray-300 mb-4" />
    <h3 class="text-lg font-semibold text-gray-700">{{ $t('knowledge.library.emptyTitle') }}</h3>
    <p class="text-sm text-gray-500 mt-1 max-w-md">{{ $t('knowledge.library.emptySubtitle') }}</p>
    <router-link
      to="/winterboard"
      class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      {{ $t('knowledge.library.emptyAction') }}
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
</script>
