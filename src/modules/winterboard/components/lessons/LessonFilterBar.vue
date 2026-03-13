<!-- WB B21: LessonFilterBar — search + categories + tags + clear
     Ref: DAY23_AGENT-B.md B21
     TODO: replace mock categories with GET /api/v1/lessons/categories/ when endpoint exists -->
<template>
  <div class="lesson-filter-bar" role="search" :aria-label="t('lessons.filterLabel')">
    <!-- Search -->
    <div class="lesson-filter-bar__search">
      <input
        v-model="localSearch"
        type="search"
        class="lesson-filter-bar__input"
        :placeholder="t('lessons.searchPlaceholder')"
        aria-label="Search lessons"
        data-testid="lesson-search"
        @input="onSearchChange"
      />
    </div>

    <!-- Category filter -->
    <div v-if="categories.length > 0" class="lesson-filter-bar__categories">
      <button
        type="button"
        class="lesson-filter-bar__chip"
        :class="{ active: selectedCategory === null }"
        data-testid="category-all"
        @click="selectCategory(null)"
      >
        {{ t('lessons.allCategories') }}
      </button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="lesson-filter-bar__chip"
        :class="{ active: selectedCategory === cat.id }"
        :data-testid="`category-${cat.slug}`"
        @click="selectCategory(cat.id)"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- Tag filter (multi-select) -->
    <div v-if="availableTags.length > 0" class="lesson-filter-bar__tags">
      <button
        v-for="tag in availableTags"
        :key="tag"
        type="button"
        class="lesson-filter-bar__tag"
        :class="{ active: selectedTags.includes(tag) }"
        :data-testid="`tag-${tag}`"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <!-- Active filters summary -->
    <div v-if="hasActiveFilters" class="lesson-filter-bar__active">
      <span class="lesson-filter-bar__count">
        {{ t('lessons.filtered', { count: filteredCount }) }}
      </span>
      <button
        type="button"
        class="lesson-filter-bar__clear"
        data-testid="clear-filters"
        @click="clearAll"
      >
        {{ t('lessons.clearFilters') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// B21: LessonFilterBar — search + category + tags + clear
// Ref: DAY23_AGENT-B.md

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Category {
  id: number | string
  name: string
  slug: string
}

const props = defineProps<{
  categories: Category[]
  availableTags: string[]
  filteredCount: number
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:category': [value: number | string | null]
  'update:tags': [value: string[]]
  clear: []
}>()

const localSearch = ref('')
const selectedCategory = ref<number | string | null>(null)
const selectedTags = ref<string[]>([])

const hasActiveFilters = computed(
  () =>
    localSearch.value !== '' ||
    selectedCategory.value !== null ||
    selectedTags.value.length > 0,
)

// Native 300ms debounce (no @vueuse/core dependency)
let _searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (_searchTimer) clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => {
    emit('update:search', localSearch.value)
  }, 300)
}

function selectCategory(id: number | string | null) {
  selectedCategory.value = id
  emit('update:category', id)
}

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1) {
    selectedTags.value = [...selectedTags.value, tag]
  } else {
    selectedTags.value = selectedTags.value.filter((t) => t !== tag)
  }
  emit('update:tags', selectedTags.value)
}

function clearAll() {
  localSearch.value = ''
  selectedCategory.value = null
  selectedTags.value = []
  emit('clear')
}
</script>

<style scoped>
.lesson-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--wb-card-bg, #fff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  margin-bottom: 20px;
}

.lesson-filter-bar__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-canvas-bg, #f8fafc);
  outline: none;
  box-sizing: border-box;
}

.lesson-filter-bar__input:focus {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.1);
}

.lesson-filter-bar__categories,
.lesson-filter-bar__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lesson-filter-bar__chip,
.lesson-filter-bar__tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  background: transparent;
  color: var(--wb-fg, #0f172a);
  transition: all 0.15s;
  line-height: 1.5;
}

.lesson-filter-bar__chip.active,
.lesson-filter-bar__tag.active {
  background: var(--wb-brand, #0066ff);
  border-color: var(--wb-brand, #0066ff);
  color: #fff;
}

.lesson-filter-bar__tag {
  background: var(--wb-canvas-bg, #f8fafc);
  font-size: 12px;
}

.lesson-filter-bar__tag.active {
  background: var(--wb-brand, #0066ff);
  border-color: var(--wb-brand, #0066ff);
  color: #fff;
}

.lesson-filter-bar__active {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.lesson-filter-bar__clear {
  color: var(--wb-brand, #0066ff);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.lesson-filter-bar__clear:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .lesson-filter-bar {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lesson-filter-bar__chip,
  .lesson-filter-bar__tag {
    transition: none;
  }
}
</style>
