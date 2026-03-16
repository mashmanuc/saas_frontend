<template>
  <nav
    v-if="items.length > 0"
    aria-label="Breadcrumb"
    class="text-sm text-gray-500 dark:text-gray-400 mb-4"
  >
    <ol class="flex items-center gap-1 flex-wrap">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-1"
      >
        <ChevronRight
          v-if="index > 0"
          :size="14"
          class="text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <router-link
          v-if="item.to"
          :to="item.to"
          class="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {{ item.label }}
        </router-link>
        <span
          v-else
          class="text-gray-700 dark:text-gray-200 font-medium"
          aria-current="page"
        >
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

export interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>
