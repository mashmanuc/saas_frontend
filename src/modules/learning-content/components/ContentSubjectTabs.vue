<template>
  <div class="lc-subject-tabs" role="tablist" :aria-label="t('learningContent.panel.subjects')">
    <button
      v-for="subject in subjects"
      :key="subject.slug"
      role="tab"
      class="lc-subject-tab"
      :class="{ active: store.selectedSubject === subject.slug }"
      :aria-selected="store.selectedSubject === subject.slug"
      :aria-label="subject.name"
      @click="store.selectSubject(subject.slug)"
    >
      <span v-if="subject.icon" class="lc-subject-icon">{{ subject.icon }}</span>
      {{ subject.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import type { Subject } from '../types/learningContent'

defineProps<{ subjects: Subject[] }>()
const { t } = useI18n()
const store = useContentLibraryStore()
</script>

<style scoped>
.lc-subject-tabs {
  display: flex;
  gap: 4px;
  padding: 8px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
}
.lc-subject-tab {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--card-bg);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.lc-subject-tab:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.lc-subject-tab.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: var(--accent);
}
.lc-subject-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.lc-subject-icon {
  margin-right: 4px;
}
</style>
