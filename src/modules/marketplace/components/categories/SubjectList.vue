<script setup lang="ts">
// TASK F14: SubjectList component
import type { SubjectOption } from '../../api/marketplace'

defineProps<{
  subjects: SubjectOption[]
  selected: string | null
}>()

const emit = defineEmits<{
  select: [subject: string | null]
}>()

const handleSelect = (subject: string | null) => {
  emit('select', subject)
}
</script>

<template>
  <div class="subject-list">
    <button
      class="subject-chip"
      :class="{ 'is-selected': selected === null }"
      @click="handleSelect(null)"
    >
      All
    </button>
    <button
      v-for="subject in subjects"
      :key="subject.slug"
      class="subject-chip"
      :class="{ 'is-selected': selected === subject.name }"
      @click="handleSelect(subject.name)"
    >
      {{ subject.name }}
      <span class="count">({{ subject.tutor_count }})</span>
    </button>
  </div>
</template>

<style scoped>
.subject-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subject-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.subject-chip:hover {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}

.subject-chip.is-selected {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: white;
}

.subject-chip.is-selected .count {
  color: rgba(255, 255, 255, 0.8);
}

.count {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
