<script setup lang="ts">
// TASK MF7 + F8: CatalogFilters component (enhanced for v0.20.0)
import { ref, watch, computed } from 'vue'
import { X, Filter } from 'lucide-vue-next'
import type {
  CatalogFilters,
  FilterOptions,
  SearchFilters,
  ExtendedFilterOptions,
} from '../../api/marketplace'
import FilterSection from './FilterSection.vue'
import PriceRangeSlider from './PriceRangeSlider.vue'
import RatingFilter from './RatingFilter.vue'

// Support both old CatalogFilters and new SearchFilters
type AnyFilters = CatalogFilters | SearchFilters
type AnyOptions = FilterOptions | ExtendedFilterOptions | null

interface Props {
  filters: AnyFilters
  options: AnyOptions
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update', filters: Partial<AnyFilters>): void
  (e: 'clear'): void
}>()

// Detect if using new extended options
const isExtendedOptions = computed(() => {
  return props.options && 'categories' in props.options
})

// Get subjects based on options type
const subjectOptions = computed(() => {
  if (!props.options) return []
  if (isExtendedOptions.value) {
    const opts = props.options as ExtendedFilterOptions
    return opts.subjects.map((s) => ({
      value: s.name,
      label: s.name,
      count: s.tutor_count,
      category: s.category,
    }))
  }
  return (props.options as FilterOptions).subjects
})

// Get countries
const countryOptions = computed(() => {
  if (!props.options) return []
  if (isExtendedOptions.value) {
    const opts = props.options as ExtendedFilterOptions
    return opts.countries.map((c) => ({
      value: c.code,
      label: c.name,
      count: c.count,
    }))
  }
  return (props.options as FilterOptions).countries
})

// Get languages
const languageOptions = computed(() => {
  if (!props.options) return []
  if (isExtendedOptions.value) {
    const opts = props.options as ExtendedFilterOptions
    return opts.languages.map((l) => ({
      value: l.code,
      label: l.name,
      count: l.count,
    }))
  }
  return (props.options as FilterOptions).languages
})

// Get categories (only for extended)
const categoryOptions = computed(() => {
  if (!props.options || !isExtendedOptions.value) return []
  return (props.options as ExtendedFilterOptions).categories
})

// Filter subjects by selected category
const filteredSubjects = computed(() => {
  const category = (props.filters as SearchFilters).category
  if (!category || !isExtendedOptions.value) return subjectOptions.value
  return subjectOptions.value.filter((s: any) => s.category === category)
})

// Price range
const priceRange = computed(() => {
  if (!props.options) return { min: 0, max: 200 }
  return props.options.priceRange
})

const localFilters = ref<AnyFilters>({ ...props.filters })

// Normalized accessors for mixed property names
const minPrice = computed({
  get: () => (localFilters.value as any).min_price ?? (localFilters.value as any).minPrice ?? null,
  set: (v) => {
    if ('minPrice' in localFilters.value) {
      (localFilters.value as any).minPrice = v
    } else {
      (localFilters.value as any).min_price = v
    }
  },
})

const maxPrice = computed({
  get: () => (localFilters.value as any).max_price ?? (localFilters.value as any).maxPrice ?? null,
  set: (v) => {
    if ('maxPrice' in localFilters.value) {
      (localFilters.value as any).maxPrice = v
    } else {
      (localFilters.value as any).max_price = v
    }
  },
})

const minRating = computed({
  get: () => (localFilters.value as any).min_rating ?? (localFilters.value as any).minRating ?? null,
  set: (v) => {
    if ('minRating' in localFilters.value) {
      (localFilters.value as any).minRating = v
    } else {
      (localFilters.value as any).min_rating = v
    }
  },
})

const hasVideo = computed({
  get: () => (localFilters.value as any).has_video ?? (localFilters.value as any).hasVideo ?? false,
  set: (v) => {
    if ('hasVideo' in localFilters.value) {
      (localFilters.value as any).hasVideo = v
    } else {
      (localFilters.value as any).has_video = v
    }
  },
})

const isVerified = computed({
  get: () => (localFilters.value as any).is_verified ?? (localFilters.value as any).isVerified ?? false,
  set: (v) => {
    if ('isVerified' in localFilters.value) {
      (localFilters.value as any).isVerified = v
    } else {
      (localFilters.value as any).is_verified = v
    }
  },
})

watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters }
  }
)

function applyFilters() {
  emit('update', { ...localFilters.value })
}

function clearFilters() {
  localFilters.value = {}
  emit('clear')
}

function hasActiveFilters(): boolean {
  return Object.values(localFilters.value).some((v) => v !== undefined && v !== '')
}
</script>

<template>
  <div class="catalog-filters">
    <div class="filters-header">
      <h3>
        <Filter :size="18" />
        Filters
      </h3>
      <button v-if="hasActiveFilters()" class="clear-btn" @click="clearFilters">
        <X :size="14" />
        Clear
      </button>
    </div>

    <div class="filter-group">
      <label>Subject</label>
      <select v-model="localFilters.subject" @change="applyFilters">
        <option value="">All Subjects</option>
        <option
          v-for="opt in filteredSubjects"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }} ({{ opt.count }})
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>Country</label>
      <select v-model="localFilters.country" @change="applyFilters">
        <option value="">All Countries</option>
        <option
          v-for="opt in countryOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }} ({{ opt.count }})
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>Language</label>
      <select v-model="localFilters.language" @change="applyFilters">
        <option value="">All Languages</option>
        <option
          v-for="opt in languageOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }} ({{ opt.count }})
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>Price Range</label>
      <div class="price-inputs">
        <input
          v-model.number="minPrice"
          type="number"
          placeholder="Min"
          min="0"
          @change="applyFilters"
        />
        <span>—</span>
        <input
          v-model.number="maxPrice"
          type="number"
          placeholder="Max"
          min="0"
          @change="applyFilters"
        />
      </div>
    </div>

    <div class="filter-group">
      <label>Minimum Rating</label>
      <select v-model.number="minRating" @change="applyFilters">
        <option value="">Any Rating</option>
        <option :value="4">4+ Stars</option>
        <option :value="4.5">4.5+ Stars</option>
        <option :value="5">5 Stars</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="checkbox-label">
        <input
          v-model="hasVideo"
          type="checkbox"
          @change="applyFilters"
        />
        Has Video Introduction
      </label>
    </div>

    <div class="filter-group">
      <label class="checkbox-label">
        <input
          v-model="isVerified"
          type="checkbox"
          @change="applyFilters"
        />
        Verified Tutors Only
      </label>
    </div>
  </div>
</template>

<style scoped>
.catalog-filters {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.filters-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 0.8125rem;
  cursor: pointer;
  border-radius: 4px;
}

.clear-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.filter-group {
  margin-bottom: 1rem;
}

.filter-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.filter-group select,
.filter-group input[type='number'] {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-inputs input {
  flex: 1;
}

.price-inputs span {
  color: #9ca3af;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
