<script setup lang="ts">
// TASK F14: SubjectList component
import { useI18n } from 'vue-i18n'
import type { SubjectOption } from '../../api/marketplace'

defineProps<{
  subjects: SubjectOption[]
  selected: string | null
}>()

const { t } = useI18n()

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
      {{ t('marketplace.categories.all') }}
    </button>
    <button
      v-for="subject in subjects"
      :key="subject.slug"
      class="subject-chip"
      :class="{ 'is-selected': selected === subject.name }"
      @click="handleSelect(subject.name)"
    >
      {{ t(`marketplace.categories.${subject.name}`) }}
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
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.subject-chip:hover {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.subject-chip.is-selected {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--text-on-accent);
}

.subject-chip.is-selected .count {
  color: rgba(255, 255, 255, 0.8);
}

.count {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
