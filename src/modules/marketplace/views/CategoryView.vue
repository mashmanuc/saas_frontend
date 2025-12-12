<script setup lang="ts">
// TASK F3: Category View
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { BookOpen } from 'lucide-vue-next'
import { useSearchStore } from '../stores/searchStore'

// Components
import SubjectList from '../components/categories/SubjectList.vue'
import CatalogSort from '../components/catalog/CatalogSort.vue'
import TutorGrid from '../components/catalog/TutorGrid.vue'

const route = useRoute()
const store = useSearchStore()

const categorySlug = computed(() => route.params.slug as string)

const category = computed(() =>
  store.filterOptions?.categories.find((c) => c.slug === categorySlug.value)
)

const subjects = computed(
  () =>
    store.filterOptions?.subjects.filter((s) => s.category === categorySlug.value) || []
)

const selectedSubject = ref<string | null>(null)
const { results: tutors, isLoading, hasMore, sortBy } = storeToRefs(store)

onMounted(async () => {
  await store.loadFilterOptions()
  store.setFilter('category', categorySlug.value)
})

watch(categorySlug, (newSlug) => {
  selectedSubject.value = null
  store.setFilter('category', newSlug)
})

const handleSubjectSelect = (subject: string | null) => {
  selectedSubject.value = subject
  store.setFilter('subject', subject)
}

const handleSortUpdate = (sort: string) => {
  store.setSort(sort)
}

const loadMore = () => {
  store.loadMore()
}

// Get category icon dynamically
const getCategoryColor = computed(() => category.value?.color || '#3b82f6')
</script>

<template>
  <div class="category-view">
    <!-- Category Header -->
    <header class="category-header" :style="{ '--category-color': getCategoryColor }">
      <div class="category-icon">
        <BookOpen :size="48" />
      </div>
      <div class="category-info">
        <h1>{{ category?.name || 'Category' }}</h1>
        <p>{{ category?.tutor_count || 0 }} tutors available</p>
      </div>
    </header>

    <!-- Subjects in Category -->
    <section v-if="subjects.length > 0" class="subjects-section">
      <h2>Subjects</h2>
      <SubjectList
        :subjects="subjects"
        :selected="selectedSubject"
        @select="handleSubjectSelect"
      />
    </section>

    <!-- Tutors -->
    <section class="tutors-section">
      <div class="section-header">
        <h2>
          {{ selectedSubject ? `${selectedSubject} Tutors` : 'All Tutors' }}
        </h2>
        <CatalogSort :value="sortBy" @update="handleSortUpdate" />
      </div>

      <TutorGrid :tutors="tutors" :loading="isLoading" />

      <button
        v-if="hasMore"
        class="btn btn-secondary load-more"
        :disabled="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? 'Loading...' : 'Load More' }}
      </button>

      <!-- Empty State -->
      <div v-if="!isLoading && tutors.length === 0" class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No tutors in this category yet</h3>
        <p>Check back later or explore other categories</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.category-view {
  min-height: 100vh;
  background: var(--color-bg-secondary, #f5f5f5);
}

.category-header {
  background: linear-gradient(135deg, var(--category-color) 0%, color-mix(in srgb, var(--category-color) 80%, black) 100%);
  color: white;
  padding: 48px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.category-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}

.category-info h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.category-info p {
  font-size: 1.125rem;
  opacity: 0.9;
  margin: 0;
}

.subjects-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.subjects-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--color-text-primary, #111827);
}

.tutors-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary, #111827);
}

.load-more {
  display: block;
  margin: 32px auto 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--color-bg-primary, white);
  color: var(--color-text-primary, #111827);
  border: 1px solid var(--color-border, #e5e7eb);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text-primary, #111827);
}

.empty-state p {
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

@media (max-width: 640px) {
  .category-header {
    flex-direction: column;
    text-align: center;
    padding: 32px 16px;
  }

  .category-info h1 {
    font-size: 1.5rem;
  }

  .subjects-section,
  .tutors-section {
    padding-left: 16px;
    padding-right: 16px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
