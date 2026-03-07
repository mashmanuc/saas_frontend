<template>
  <div class="lc-search-bar">
    <input
      :value="store.searchQuery"
      type="search"
      :placeholder="t('learningContent.search.placeholder')"
      class="lc-search-input"
      :aria-label="t('learningContent.search.placeholder')"
      @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
      @keydown.escape="store.clearSearch"
    />
    <div v-if="store.searchMode" class="lc-search-filters">
      <select
        :value="store.searchParams.difficulty ?? ''"
        class="lc-filter-select"
        :aria-label="t('learningContent.search.difficulty')"
        @change="onDifficultyChange"
      >
        <option value="">{{ t('learningContent.search.difficulty') }}</option>
        <option v-for="d in [1, 2, 3, 4, 5]" :key="d" :value="d">
          {{ t(`learningContent.difficulty.${d}`) }}
        </option>
      </select>
      <select
        :value="store.searchParams.language ?? ''"
        class="lc-filter-select"
        :aria-label="t('learningContent.search.language')"
        @change="onLanguageChange"
      >
        <option value="">{{ t('learningContent.language.all') }}</option>
        <option value="uk">{{ t('learningContent.language.uk') }}</option>
        <option value="en">{{ t('learningContent.language.en') }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'

const { t } = useI18n()
const store = useContentLibraryStore()

function onDifficultyChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  store.searchParams.difficulty = val ? Number(val) : undefined
  if (store.searchQuery) {
    store.searchItems({ ...store.searchParams, q: store.searchQuery })
  }
}

function onLanguageChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  store.searchParams.language = (val || undefined) as typeof store.searchParams.language
  if (store.searchQuery) {
    store.searchItems({ ...store.searchParams, q: store.searchQuery })
  }
}
</script>

<style scoped>
.lc-search-bar {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid #e5e7eb;
}
.lc-search-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.lc-search-input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}
.lc-search-filters {
  display: flex;
  gap: 6px;
}
.lc-filter-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  color: #374151;
  background: white;
  outline: none;
  cursor: pointer;
}
.lc-filter-select:focus {
  border-color: #4f46e5;
}
</style>
