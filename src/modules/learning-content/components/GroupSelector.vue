<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLearningGroupStore } from '../stores/learningGroupStore'
import type { LearningGroup } from '../types/learningContent'

const { t } = useI18n()
const store = useLearningGroupStore()

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const selectedId = computed({
  get: () => props.modelValue ?? null,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div class="group-selector">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ t('learningContent.groups.selectGroup') }}
    </label>

    <!-- IMPLICIT groups -->
    <div v-if="store.implicitGroups.length > 0" class="mt-2">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {{ t('learningContent.groups.implicitLabel') }}
      </p>
      <button
        v-for="group in store.implicitGroups"
        :key="group.id"
        class="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
        :class="selectedId === group.id
          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
        @click="selectedId = group.id"
      >
        {{ group.title }}
        <span class="text-xs text-gray-400 ml-1">
          ({{ group.material_count }} {{ t('learningContent.groups.materials') }})
        </span>
      </button>
    </div>

    <!-- EXPLICIT groups -->
    <div v-if="store.explicitGroups.length > 0" class="mt-3">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {{ t('learningContent.groups.explicitLabel') }}
      </p>
      <button
        v-for="group in store.explicitGroups"
        :key="group.id"
        class="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
        :class="selectedId === group.id
          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
        @click="selectedId = group.id"
      >
        {{ group.title }}
        <span class="text-xs text-gray-400 ml-1">
          ({{ group.student_count }} {{ t('learningContent.groups.students') }},
           {{ group.material_count }} {{ t('learningContent.groups.materials') }})
        </span>
      </button>
    </div>

    <!-- Empty state -->
    <p
      v-if="store.groups.length === 0 && !store.isLoading"
      class="text-sm text-gray-400 mt-2"
    >
      {{ t('learningContent.groups.empty') }}
    </p>
  </div>
</template>
