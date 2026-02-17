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
  set: (v) => emit('update', { subject: v ? [v] : null })
})

const selectedLanguage = computed({
  get: () => {
    const raw = props.filters.language
    return Array.isArray(raw) ? raw[0] : raw || ''
  },
  set: (v) => emit('update', { language: v ? [v] : null })
})

const selectedCountry = computed({
  get: () => props.filters.country || '',
  set: (v) => emit('update', { country: v || null })
})

const selectedCity = computed({
  get: () => props.filters.city || '',
  set: (v) => emit('update', { city: v || undefined })
})

const selectedFormat = computed({
  get: () => props.filters.format || '',
  set: (v) => emit('update', { format: (v || undefined) as any })
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
const cityOptions = computed(() => (props.options as any)?.cities || [])

function handleClear() {
  emit('clear')
}
</script>

<template>
  <div class="filters-wrap">
    <div class="filters-hint">
      {{ t('marketplace.filters.hint') }}
    </div>

    <!-- Row 1: Subject, Language, Country, Format -->
    <div class="filter-row filter-row--main">
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

      <div class="filter-group">
        <label class="filter-label">{{ t('marketplace.filters.format') }}</label>
        <select v-model="selectedFormat" class="filter-select">
          <option value="">{{ t('marketplace.filters.any') }}</option>
          <option value="online">{{ t('marketplace.filters.formatOnline') }}</option>
          <option value="offline">{{ t('marketplace.filters.formatOffline') }}</option>
          <option value="hybrid">{{ t('marketplace.filters.formatHybrid') }}</option>
        </select>
      </div>
    </div>

    <!-- Row 2: Search + Price + Actions -->
    <div class="filter-row filter-row--secondary">
      <div class="filter-group">
        <label class="filter-label">{{ t('marketplace.filters.searchLabel') }}</label>
        <div class="search-input-wrapper">
          <Search :size="16" class="search-icon" />
          <input
            v-model="localSearch"
            type="text"
            :placeholder="t('marketplace.filters.searchPlaceholder')"
            class="filter-input search-input"
          />
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label">{{ t('marketplace.filters.price') }}</label>
        <div class="price-range">
          <input
            v-model="priceMin"
            type="number"
            :placeholder="t('marketplace.filters.min')"
            class="filter-input"
            min="0"
          />
          <span class="price-sep">&mdash;</span>
          <input
            v-model="priceMax"
            type="number"
            :placeholder="t('marketplace.filters.max')"
            class="filter-input"
            min="0"
          />
        </div>
      </div>

      <div class="filter-group filter-group--actions">
        <label class="filter-label filter-label--spacer">&nbsp;</label>
        <div class="filter-actions">
          <button
            v-if="activeFiltersCount"
            class="btn-reset"
            @click="handleClear"
          >
            {{ t('marketplace.filters.clearAll') }}
          </button>
          <button
            class="btn-advanced"
            @click="emit('openAdvanced')"
            :title="t('marketplace.filters.title')"
          >
            <SlidersHorizontal :size="16" />
            <span v-if="activeFiltersCount" class="adv-badge">{{ activeFiltersCount }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters-wrap {
  background: var(--white, #ffffff);
  border: 1px solid var(--border, #e0ece5);
  border-radius: 18px;
  padding: 24px 28px;
  margin-bottom: 24px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  animation: fadeUp 0.3s ease 0.1s both;
}

.filters-hint {
  font-size: 12px;
  font-weight: 700;
  color: var(--green-dark, #158f3e);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.filter-row {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.filter-row--main {
  grid-template-columns: 2fr 1fr 1fr 1fr;
}

.filter-row--secondary {
  grid-template-columns: 2fr 2fr auto;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group--actions {
  justify-content: flex-end;
}

.filter-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted, #7a9186);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.filter-label--spacer {
  opacity: 0;
}

.filter-select,
.filter-input {
  border: 1.5px solid var(--border, #e0ece5);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #111816);
  font-family: inherit;
  background: var(--bg, #f5f7f6);
  transition: all 0.15s;
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: var(--green-mid, #c8ecd8);
  background: var(--white, #ffffff);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--muted, #7a9186);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 2.25rem;
}

.price-range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
}

.price-sep {
  font-size: 12px;
  color: var(--muted, #7a9186);
  font-weight: 600;
}

.filter-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-reset {
  background: transparent;
  color: var(--muted, #7a9186);
  border: 1px solid var(--border, #e0ece5);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.btn-reset:hover {
  border-color: var(--green-mid, #c8ecd8);
  color: var(--green-dark, #158f3e);
}

.btn-advanced {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--border, #e0ece5);
  border-radius: 10px;
  background: var(--bg, #f5f7f6);
  color: var(--muted, #7a9186);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-advanced:hover {
  border-color: var(--green-mid, #c8ecd8);
  color: var(--green-dark, #158f3e);
}

.adv-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--green, #1DB954);
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 9px;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 900px) {
  .filter-row--main {
    grid-template-columns: 1fr 1fr;
  }
  .filter-row--secondary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .filters-wrap {
    padding: 16px 16px;
    border-radius: 14px;
  }
  .filter-row--main {
    grid-template-columns: 1fr;
  }
}
</style>
