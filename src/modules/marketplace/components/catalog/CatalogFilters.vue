<script setup lang="ts">
// TASK MF7 + F8: CatalogFilters component (enhanced for v0.20.0)
import { ref, watch, computed } from 'vue'
import { X, Filter } from 'lucide-vue-next'
import type { CatalogFilters, FilterOptions, ExtendedFilterOptions, SearchFilters } from '../../api/marketplace'
import { useI18n } from 'vue-i18n'
import { getLanguageName } from '@/config/languages'

// Support both old CatalogFilters and new SearchFilters
type AnyFilters = CatalogFilters | SearchFilters
type AnyOptions = FilterOptions | ExtendedFilterOptions | null

interface Props {
  filters: AnyFilters
  options: AnyOptions
  loading?: boolean
}

const props = defineProps<Props>()

const { t, locale } = useI18n()
const useNativeLanguageNames = computed(() => locale.value === 'uk')

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
      label: getLanguageName(l.code, useNativeLanguageNames.value),
      count: l.count,
    }))
  }
  return (props.options as FilterOptions).languages.map((l) => ({
    ...l,
    label: getLanguageName(l.value, useNativeLanguageNames.value),
  }))
})

// Get cities
const cityOptions = computed(() => {
  if (!props.options) return []
  if (isExtendedOptions.value) {
    const opts = props.options as ExtendedFilterOptions
    return (opts.cities || []).map((c) => ({
      value: c.slug,
      label: c.name,
      count: c.count,
    }))
  }
  return []
})

// Get categories (only for extended)
const filteredSubjects = computed(() => subjectOptions.value)

const localFilters = ref<Record<string, any>>({ ...(props.filters as any) })

const priceMin = computed({
  get: () => (localFilters.value as any).price_min ?? null,
  set: (v) => {
    ;(localFilters.value as any).price_min = v
  },
})

const priceMax = computed({
  get: () => (localFilters.value as any).price_max ?? null,
  set: (v) => {
    ;(localFilters.value as any).price_max = v
  },
})

const selectedLanguages = computed({
  get: () => {
    const raw = (localFilters.value as any).language
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw.length > 0) return [raw]
    return []
  },
  set: (v: string[]) => {
    if (Array.isArray((props.filters as any).language)) {
      ;(localFilters.value as any).language = v
    } else {
      ;(localFilters.value as any).language = v[0] ?? null
    }
  },
})

const selectedSubjects = computed({
  get: () => {
    const raw = (localFilters.value as any).subject
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw.length > 0) return [raw]
    return []
  },
  set: (v: string[]) => {
    if (Array.isArray((props.filters as any).subject)) {
      ;(localFilters.value as any).subject = v
    } else {
      ;(localFilters.value as any).subject = v[0] ?? null
    }
  },
})

watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...(newFilters as any) }
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
    <div class="filters-header" data-test="marketplace-filters">
      <h3>
        <Filter :size="18" />
        {{ t('marketplace.filters.title') }}
      </h3>
      <button v-if="hasActiveFilters()" class="clear-btn" type="button" @click="clearFilters">
        <X :size="14" />
        {{ t('marketplace.filters.clear') }}
      </button>
    </div>

    <div class="filters-body">
      <div class="filter-group">
        <label>{{ t('marketplace.filters.search') }}</label>
        <input
          v-model="localFilters.q"
          type="text"
          :placeholder="t('marketplace.filters.searchPlaceholder')"
          data-test="marketplace-filter-q"
          @change="applyFilters"
        />
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.subject') }}</label>
        <select v-model="selectedSubjects" multiple data-test="marketplace-filter-subject" @change="applyFilters">
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
        <label>{{ t('marketplace.filters.country') }}</label>
        <select v-model="localFilters.country" data-test="marketplace-filter-country" @change="applyFilters">
          <option value="">{{ t('marketplace.filters.allCountries') }}</option>
          <option
            v-for="opt in countryOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }} ({{ opt.count }})
          </option>
        </select>
      </div>

      <div v-if="cityOptions.length > 0" class="filter-group">
        <label>{{ t('marketplace.filters.city') }}</label>
        <select v-model="localFilters.city" data-test="marketplace-filter-city" @change="applyFilters">
          <option value="">{{ t('marketplace.filters.cityAll') }}</option>
          <option
            v-for="opt in cityOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }} <template v-if="opt.count > 0">({{ opt.count }})</template>
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.language') }}</label>
        <select v-model="selectedLanguages" multiple data-test="marketplace-filter-language" @change="applyFilters">
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
        <label>{{ t('marketplace.filters.priceRangeLabel') }}</label>
        <div class="price-inputs">
          <input
            v-model.number="priceMin"
            type="number"
            :placeholder="t('marketplace.filters.min')"
            min="0"
            data-test="marketplace-filter-price-min"
            @change="applyFilters"
          />
          <span class="dash">—</span>
          <input
            v-model.number="priceMax"
            type="number"
            :placeholder="t('marketplace.filters.max')"
            min="0"
            data-test="marketplace-filter-price-max"
            @change="applyFilters"
          />
        </div>
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.experience') }}</label>
        <input
          v-model.number="localFilters.experience_min"
          type="number"
          min="0"
          :placeholder="t('marketplace.filters.experiencePlaceholder')"
          data-test="marketplace-filter-experience-min"
          @change="applyFilters"
        />
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.experienceMax') }}</label>
        <input
          v-model.number="localFilters.experience_max"
          type="number"
          min="0"
          :placeholder="t('marketplace.filters.experienceMaxPlaceholder')"
          data-test="marketplace-filter-experience-max"
          @change="applyFilters"
        />
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.direction') }}</label>
        <select v-model="localFilters.direction" data-test="marketplace-filter-direction" @change="applyFilters">
          <option value="">{{ t('marketplace.filters.any') }}</option>
          <option value="nmt">{{ t('marketplace.filters.directionNmt') }}</option>
          <option value="dpa">{{ t('marketplace.filters.directionDpa') }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.format') }}</label>
        <select v-model="localFilters.format" data-test="marketplace-filter-format" @change="applyFilters">
          <option value="">{{ t('marketplace.filters.any') }}</option>
          <option value="online">{{ t('marketplace.filters.formatOnline') }}</option>
          <option value="offline">{{ t('marketplace.filters.formatOffline') }}</option>
          <option value="hybrid">{{ t('marketplace.filters.formatHybrid') }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label>{{ t('marketplace.filters.timezone') }}</label>
        <input
          v-model="localFilters.timezone"
          type="text"
          :placeholder="t('marketplace.filters.timezonePlaceholder')"
          data-test="marketplace-filter-timezone"
          @change="applyFilters"
        />
      </div>

      <div class="filter-group">
        <label class="checkbox-label">
          <input
            v-model="localFilters.has_certifications"
            type="checkbox"
            data-test="marketplace-filter-has-certifications"
            @change="applyFilters"
          />
          {{ t('marketplace.filters.hasCertifications') }}
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-filters {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  box-shadow: var(--shadow-card);
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-color);
}

.filters-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  border-radius: var(--radius-full);
}

.clear-btn:hover {
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-primary) 25%, transparent);
  color: var(--text-primary);
}

.filter-group {
  margin-bottom: 0;
}

.filter-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: var(--space-xs);
}

.filter-group select,
.filter-group input[type='text'],
.filter-group input[type='number'] {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--surface-card);
  color: var(--text-primary);
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-primary) 60%, var(--border-color));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent);
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dash {
  width: 1rem;
  text-align: center;
}

.price-inputs input {
  flex: 1;
}

.price-inputs span {
  color: var(--text-muted);
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
