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
import { Users, Pencil, Video, Settings, AlertCircle } from 'lucide-vue-next'

interface Props {
  selected: string[]
  availableTypes: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void
  (e: 'change'): void
}>()

const filters = [
  {
    type: 'participants',
    label: 'Учасники',
    icon: Users,
    types: ['participant_join', 'participant_leave', 'participant_reconnect'],
  },
  {
    type: 'board',
    label: 'Дошка',
    icon: Pencil,
    types: ['board_stroke', 'board_object_create', 'board_object_delete', 'board_clear'],
  },
  {
    type: 'media',
    label: 'Медіа',
    icon: Video,
    types: ['media_toggle', 'screen_share_start', 'screen_share_stop'],
  },
  {
    type: 'system',
    label: 'Система',
    icon: Settings,
    types: ['session_start', 'session_end', 'session_pause', 'session_resume'],
  },
  {
    type: 'errors',
    label: 'Помилки',
    icon: AlertCircle,
    types: ['error'],
  },
]

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

/**
 * Get event types for selected filter categories.
 */
export function getEventTypesForFilters(selectedFilters: string[]): string[] {
  if (selectedFilters.length === 0) return []

  const types: string[] = []
  for (const filter of filters) {
    if (selectedFilters.includes(filter.type)) {
      types.push(...filter.types)
    }
  }
  return types
}
</script>
