<template>
  <div class="text-center py-12 px-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
    <div class="text-4xl mb-4" aria-hidden="true">🎓</div>
    <h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
      {{ t('knowledge.hub.emptyTitle') }}
    </h2>
    <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
      {{ t('knowledge.hub.emptyDescription') }}
    </p>
    <ol class="space-y-3 text-left max-w-xs mx-auto mb-8" aria-label="steps">
      <li class="flex items-center gap-3">
        <span
          class="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-semibold"
        >1</span>
        <span class="text-gray-700 dark:text-gray-300">{{ t('knowledge.hub.emptyStep1') }}</span>
      </li>
      <li class="flex items-center gap-3">
        <span
          class="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-semibold"
        >2</span>
        <span class="text-gray-700 dark:text-gray-300">{{ t('knowledge.hub.emptyStep2') }}</span>
      </li>
      <li class="flex items-center gap-3">
        <span
          class="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-semibold"
        >3</span>
        <span class="text-gray-700 dark:text-gray-300">{{ t('knowledge.hub.emptyStep3') }}</span>
      </li>
    </ol>
    <div class="flex flex-col sm:flex-row justify-center gap-3">
      <router-link
        to="/winterboard/new"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
      >
        <PenLine :size="18" />
        {{ t('knowledge.hub.createBoard') }}
      </router-link>
      <router-link
        to="/knowledge/library"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
      >
        <BookOpen :size="18" />
        {{ t('knowledge.hub.catalogTemplates') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PenLine, BookOpen } from 'lucide-vue-next'

const { t } = useI18n()
</script>
