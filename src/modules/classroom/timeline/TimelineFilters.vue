<template>
  <div class="timeline-filters p-3 border-b border-gray-700 flex flex-wrap gap-2">
    <button
      v-for="filter in filters"
      :key="filter.type"
      :class="[
        'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
        isSelected(filter.type)
          ? 'bg-primary-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      ]"
      @click="toggleFilter(filter.type)"
    >
      <component :is="filter.icon" class="w-3 h-3" />
      {{ filter.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { TIMELINE_FILTERS } from './filterUtils'

interface Props {
  selected: string[]
  availableTypes: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void
  (e: 'change'): void
}>()

const filters = TIMELINE_FILTERS

function isSelected(type: string): boolean {
  return props.selected.includes(type)
}

function toggleFilter(type: string): void {
  const newSelected = isSelected(type)
    ? props.selected.filter((t) => t !== type)
    : [...props.selected, type]

  emit('update:selected', newSelected)
  emit('change')
}
</script>
