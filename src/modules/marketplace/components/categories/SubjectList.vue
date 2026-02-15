<script setup lang="ts">
// TASK F14: SubjectList component
import { useI18n } from 'vue-i18n'
import type { SubjectCatalog } from '../../api/marketplace'

defineProps<{
  subjects: SubjectCatalog[]
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
      class="chip"
      :class="{ 'is-selected': selected === null }"
      @click="handleSelect(null)"
    >
      {{ t('marketplace.categories.all') }}
    </button>
    <button
      v-for="subject in subjects"
      :key="subject.code"
      class="chip"
      :class="{ 'is-selected': selected === subject.title }"
      @click="handleSelect(subject.title)"
    >
      {{ subject.title }}
    </button>
  </div>
</template>

<style scoped>
.subject-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Chip стилі — використовуються глобальні .chip з main.css */

.count {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
