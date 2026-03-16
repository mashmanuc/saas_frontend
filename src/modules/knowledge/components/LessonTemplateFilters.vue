<!-- Knowledge: Template library filters — subjects, difficulty, sort
     Ref: Phase 14 B1.2 -->
<template>
  <div class="template-filters space-y-3">
    <!-- Subject chips (multi-select) -->
    <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('knowledge.template.subjectLabel')">
      <button
        v-for="subject in subjects"
        :key="subject"
        type="button"
        role="checkbox"
        :aria-checked="selectedSubjects.includes(subject)"
        :class="[
          'px-3 py-1 rounded-full text-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
          selectedSubjects.includes(subject)
            ? 'bg-primary-100 border-primary-300 text-primary-700'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
        ]"
        @click="toggleSubject(subject)"
      >
        {{ $t(`subject.${subject}`, subject) }}
      </button>
    </div>

    <!-- Difficulty range -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-600">{{ $t('knowledge.library.difficulty') }}:</span>
      <DifficultyStars
        :level="difficultyMin"
        interactive
        @change="v => $emit('update:difficultyMin', v)"
      />
      <span class="text-gray-400">—</span>
      <DifficultyStars
        :level="difficultyMax"
        interactive
        @change="v => $emit('update:difficultyMax', v)"
      />
    </div>

    <!-- Sort -->
    <div class="flex items-center gap-2">
      <label for="template-sort" class="text-sm text-gray-600">{{ $t('knowledge.library.sortBy') }}:</label>
      <select
        id="template-sort"
        :value="sort"
        class="text-sm border rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        @change="$emit('update:sort', ($event.target as HTMLSelectElement).value)"
      >
        <option value="popular">{{ $t('knowledge.library.sortPopular') }}</option>
        <option value="newest">{{ $t('knowledge.library.sortNewest') }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import DifficultyStars from './DifficultyStars.vue'

const SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics', 'other',
] as const

const subjects = [...SUBJECTS]

const props = defineProps<{
  selectedSubjects: string[]
  difficultyMin: number
  difficultyMax: number
  sort: string
}>()

const emit = defineEmits<{
  'update:selectedSubjects': [subjects: string[]]
  'update:difficultyMin': [level: number]
  'update:difficultyMax': [level: number]
  'update:sort': [sort: string]
}>()

function toggleSubject(subject: string): void {
  const current = [...props.selectedSubjects]
  const idx = current.indexOf(subject)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(subject)
  }
  emit('update:selectedSubjects', current)
}
</script>
