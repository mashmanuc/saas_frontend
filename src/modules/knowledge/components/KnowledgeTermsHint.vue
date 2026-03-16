<template>
  <div
    v-if="!isDismissed"
    class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-opacity duration-200"
    role="complementary"
    :aria-label="t('knowledge.terms.title')"
  >
    <div class="flex justify-between items-start">
      <h3 class="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-1.5">
        <Lightbulb :size="16" class="text-blue-600 dark:text-blue-400" />
        {{ t('knowledge.terms.title') }}
      </h3>
      <button
        @click="dismiss"
        class="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 p-0.5 rounded transition-colors"
        :aria-label="t('knowledge.terms.hide')"
      >
        <X :size="16" />
      </button>
    </div>
    <ul class="space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
      <li class="flex gap-2">
        <BookOpen :size="14" class="flex-shrink-0 mt-0.5" />
        <span>{{ t('knowledge.terms.lesson') }}</span>
      </li>
      <li class="flex gap-2">
        <FileText :size="14" class="flex-shrink-0 mt-0.5" />
        <span>{{ t('knowledge.terms.template') }}</span>
      </li>
      <li class="flex gap-2">
        <Package :size="14" class="flex-shrink-0 mt-0.5" />
        <span>{{ t('knowledge.terms.pack') }}</span>
      </li>
      <li class="flex gap-2">
        <GitFork :size="14" class="flex-shrink-0 mt-0.5" />
        <span>{{ t('knowledge.terms.fork') }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Lightbulb, BookOpen, FileText, Package, GitFork } from 'lucide-vue-next'

const { t } = useI18n()

const STORAGE_KEY = 'kb:terms-hint-dismissed'
const isDismissed = ref(false)

onMounted(() => {
  isDismissed.value = localStorage.getItem(STORAGE_KEY) === 'true'
})

function dismiss() {
  isDismissed.value = true
  localStorage.setItem(STORAGE_KEY, 'true')
}
</script>
