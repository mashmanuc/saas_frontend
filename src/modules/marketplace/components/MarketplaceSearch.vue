<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import marketplaceApi from '../api/marketplace'
import { Search, Filter, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const { t } = useI18n()

const searchQuery = ref('')
const filters = ref({
  languages: [] as string[],
  subjects: [] as string[],
  experience_min: null as number | null,
  price_range: { min: null, max: null } as { min: number | null; max: number | null },
  rating_min: null as number | null,
  availability: { weekday: null, hour: null } as { weekday: string | null; hour: number | null }
})

const results = ref<any[]>([])
const totalCount = ref(0)
const loading = ref(false)
const showFilters = ref(false)

const availableLanguages = ['English', 'Ukrainian', 'Spanish', 'French', 'German', 'Polish']
const availableSubjects = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Programming', 'Music']
const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

async function search() {
  loading.value = true
  try {
    const params: any = {
      q: searchQuery.value || undefined,
      languages: filters.value.languages.length > 0 ? filters.value.languages : undefined,
      subjects: filters.value.subjects.length > 0 ? filters.value.subjects : undefined,
      experience_min: filters.value.experience_min || undefined,
      price_min: filters.value.price_range.min || undefined,
      price_max: filters.value.price_range.max || undefined,
      rating_min: filters.value.rating_min || undefined,
      availability_weekday: filters.value.availability.weekday || undefined,
      availability_hour: filters.value.availability.hour || undefined
    }

    const data = await marketplaceApi.search(params)
    results.value = data.results || []
    totalCount.value = data.count || 0
  } finally {
    loading.value = false
  }
}

function toggleLanguage(lang: string) {
  const idx = filters.value.languages.indexOf(lang)
  if (idx > -1) {
    filters.value.languages.splice(idx, 1)
  } else {
    filters.value.languages.push(lang)
  }
}

function toggleSubject(subject: string) {
  const idx = filters.value.subjects.indexOf(subject)
  if (idx > -1) {
    filters.value.subjects.splice(idx, 1)
  } else {
    filters.value.subjects.push(subject)
  }
}

function clearFilters() {
  filters.value = {
    languages: [],
    subjects: [],
    experience_min: null,
    price_range: { min: null, max: null },
    rating_min: null,
    availability: { weekday: null, hour: null }
  }
  search()
}

onMounted(() => {
  search()
})
</script>

<template>
  <div class="marketplace-search">
    <div class="search-bar">
      <div class="search-input-wrapper">
        <Search :size="20" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('marketplace.search.placeholder')"
          @keydown.enter="search"
        />
      </div>
      <Button variant="primary" @click="search">
        {{ t('marketplace.search.search') }}
      </Button>
      <Button variant="outline" @click="showFilters = !showFilters">
        <template #iconLeft>
          <Filter :size="18" />
        </template>
        {{ t('marketplace.search.filters') }}
      </Button>
    </div>

    <div v-if="showFilters" class="filters-panel">
      <div class="filter-section">
        <h4>{{ t('marketplace.search.languages') }}</h4>
        <div class="filter-chips">
          <button
            v-for="lang in availableLanguages"
            :key="lang"
            :class="['chip', { active: filters.languages.includes(lang) }]"
            @click="toggleLanguage(lang)"
          >
            {{ lang }}
          </button>
        </div>
      </div>

      <div class="filter-section">
        <h4>{{ t('marketplace.search.subjects') }}</h4>
        <div class="filter-chips">
          <button
            v-for="subject in availableSubjects"
            :key="subject"
            :class="['chip', { active: filters.subjects.includes(subject) }]"
            @click="toggleSubject(subject)"
          >
            {{ subject }}
          </button>
        </div>
      </div>

      <div class="filter-section">
        <h4>{{ t('marketplace.search.experience') }}</h4>
        <input
          v-model.number="filters.experience_min"
          type="number"
          :placeholder="t('marketplace.search.minYears')"
          class="input"
        />
      </div>

      <div class="filter-section">
        <h4>{{ t('marketplace.search.priceRange') }}</h4>
        <div class="price-inputs">
          <input
            v-model.number="filters.price_range.min"
            type="number"
            :placeholder="t('marketplace.search.min')"
            class="input"
          />
          <span>—</span>
          <input
            v-model.number="filters.price_range.max"
            type="number"
            :placeholder="t('marketplace.search.max')"
            class="input"
          />
        </div>
      </div>

      <div class="filter-section">
        <h4>{{ t('marketplace.search.rating') }}</h4>
        <input
          v-model.number="filters.rating_min"
          type="number"
          step="0.1"
          min="0"
          max="5"
          :placeholder="t('marketplace.search.minRating')"
          class="input"
        />
      </div>

      <div class="filter-actions">
        <Button variant="outline" @click="clearFilters">
          <template #iconLeft>
            <X :size="18" />
          </template>
          {{ t('marketplace.search.clearFilters') }}
        </Button>
        <Button variant="primary" @click="search">
          {{ t('marketplace.search.apply') }}
        </Button>
      </div>
    </div>

    <div class="results-header">
      <p>{{ t('marketplace.search.resultsCount', { count: totalCount }) }}</p>
    </div>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="results.length === 0" class="empty">
      {{ t('marketplace.search.noResults') }}
    </div>

    <div v-else class="results-grid">
      <div v-for="tutor in results" :key="tutor.slug" class="tutor-card">
        <div class="tutor-header">
          <h3>{{ tutor.tutor_summary?.name }}</h3>
          <span v-if="tutor.tutor_summary?.rating" class="rating">
            ⭐ {{ tutor.tutor_summary.rating }}
          </span>
        </div>
        <p class="bio">{{ tutor.tutor_summary?.bio }}</p>
        <div class="meta">
          <span v-if="tutor.tutor_summary?.experience_years">
            {{ t('marketplace.search.experience') }}: {{ tutor.tutor_summary.experience_years }} {{ t('common.years') }}
          </span>
          <span v-if="tutor.tutor_summary?.hourly_rate">
            {{ tutor.tutor_summary.hourly_rate }} {{ t('common.currency') }}/{{ t('common.hour') }}
          </span>
        </div>
        <div v-if="tutor.availability_peek?.length" class="availability">
          <span>{{ t('marketplace.search.availableSlots') }}: {{ tutor.availability_peek.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marketplace-search {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.search-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background: var(--surface-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
}

.search-input-wrapper input {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.9375rem;
  color: var(--text-primary);
  outline: none;
}

.btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.filters-panel {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filter-section h4 {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Chip стилі — використовуються глобальні .chip з main.css */

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  background: var(--surface-input);
  color: var(--text-primary);
  width: 100%;
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.price-inputs .input {
  flex: 1;
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.results-header {
  margin-bottom: 1rem;
}

.results-header p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.tutor-card {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  transition: all 0.2s;
  cursor: pointer;
}

.tutor-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tutor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tutor-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.rating {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.bio {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.meta span {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.availability span {
  font-size: 0.8125rem;
  color: var(--success, #10b981);
}
</style>
