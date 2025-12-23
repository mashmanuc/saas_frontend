<script setup lang="ts">
import { computed } from 'vue'
import { Search, SlidersHorizontal, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { CatalogFilters, FilterOptions } from '../../api/marketplace'

interface Props {
  filters: CatalogFilters
  options: FilterOptions | null
  activeFiltersCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update', filters: Partial<CatalogFilters>): void
  (e: 'clear'): void
  (e: 'openAdvanced'): void
}>()

const { t } = useI18n()

const localSearch = computed({
  get: () => props.filters.q || '',
  set: (v) => emit('update', { q: v })
})

const selectedSubject = computed({
  get: () => {
    const raw = props.filters.subject
    return Array.isArray(raw) ? raw[0] : raw || ''
  },
  set: (v) => emit('update', { subject: v || null })
})

const selectedLanguage = computed({
  get: () => {
    const raw = props.filters.language
    return Array.isArray(raw) ? raw[0] : raw || ''
  },
  set: (v) => emit('update', { language: v || null })
})

const selectedCountry = computed({
  get: () => props.filters.country || '',
  set: (v) => emit('update', { country: v || null })
})

const priceMin = computed({
  get: () => props.filters.price_min ?? '',
  set: (v) => emit('update', { price_min: v ? Number(v) : null })
})

const priceMax = computed({
  get: () => props.filters.price_max ?? '',
  set: (v) => emit('update', { price_max: v ? Number(v) : null })
})

const subjectOptions = computed(() => props.options?.subjects || [])
const languageOptions = computed(() => props.options?.languages || [])
const countryOptions = computed(() => props.options?.countries || [])

function handleClear() {
  emit('clear')
}
</script>

<template>
  <div class="catalog-filter-bar">
    <div class="filter-bar-container">
      <!-- Search -->
      <div class="filter-group search-group">
        <div class="search-input-wrapper">
          <Search :size="18" class="search-icon" />
          <input
            v-model="localSearch"
            type="text"
            :placeholder="t('marketplace.filters.searchPlaceholder')"
            class="search-input"
          />
        </div>
      </div>

      <!-- Top Filters Grid -->
      <div class="filters-grid">
        <!-- Subject -->
        <div class="filter-group">
          <label class="filter-label">{{ t('marketplace.filters.subject') }}</label>
          <select v-model="selectedSubject" class="filter-select">
            <option value="">{{ t('marketplace.filters.any') }}</option>
            <option
              v-for="opt in subjectOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Language -->
        <div class="filter-group">
          <label class="filter-label">{{ t('marketplace.filters.language') }}</label>
          <select v-model="selectedLanguage" class="filter-select">
            <option value="">{{ t('marketplace.filters.any') }}</option>
            <option
              v-for="opt in languageOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Country -->
        <div class="filter-group">
          <label class="filter-label">{{ t('marketplace.filters.country') }}</label>
          <select v-model="selectedCountry" class="filter-select">
            <option value="">{{ t('marketplace.filters.allCountries') }}</option>
            <option
              v-for="opt in countryOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Price Range -->
        <div class="filter-group price-group">
          <label class="filter-label">{{ t('marketplace.filters.price') }}</label>
          <div class="price-inputs">
            <input
              v-model="priceMin"
              type="number"
              :placeholder="t('marketplace.filters.min')"
              class="price-input"
              min="0"
            />
            <span class="price-separator">—</span>
            <input
              v-model="priceMax"
              type="number"
              :placeholder="t('marketplace.filters.max')"
              class="price-input"
              min="0"
            />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="filter-actions">
        <button
          class="btn-advanced"
          @click="emit('openAdvanced')"
          :title="t('marketplace.filters.title')"
        >
          <SlidersHorizontal :size="18" />
          <span v-if="activeFiltersCount" class="badge">{{ activeFiltersCount }}</span>
        </button>
        <button
          v-if="activeFiltersCount"
          class="btn-clear"
          @click="handleClear"
          :title="t('marketplace.filters.clearAll')"
        >
          <X :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-filter-bar {
  background: white;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.filter-bar-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.search-group {
  flex: 1;
  min-width: 240px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted, #6b7280);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.625rem 0.75rem 0.625rem 2.5rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 1rem;
  flex: 2;
}

@media (max-width: 1200px) {
  .filters-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .filter-bar-container {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .search-group {
    min-width: auto;
  }
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #374151);
}

.filter-select {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  font-size: 0.9375rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.price-group {
  grid-column: span 1;
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-input {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  font-size: 0.9375rem;
  min-width: 0;
}

.price-input:focus {
  outline: none;
  border-color: var(--accent-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.price-separator {
  color: var(--text-muted, #6b7280);
  font-weight: 500;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-advanced,
.btn-clear {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: white;
  color: var(--text-primary, #111827);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-advanced:hover,
.btn-clear:hover {
  background: var(--surface-hover, #f9fafb);
  border-color: var(--accent-primary, #3b82f6);
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary, #3b82f6);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 9px;
}
</style>
