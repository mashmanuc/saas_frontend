<script setup lang="ts">
// TASK MF7: CatalogFilters component
import { ref, watch } from 'vue'
import { X, Filter } from 'lucide-vue-next'
import type { CatalogFilters, FilterOptions } from '../../api/marketplace'

interface Props {
  filters: CatalogFilters
  options: FilterOptions | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update', filters: CatalogFilters): void
  (e: 'clear'): void
}>()

const localFilters = ref<CatalogFilters>({ ...props.filters })

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
          v-for="opt in options?.subjects"
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
          v-for="opt in options?.countries"
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
          v-for="opt in options?.languages"
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
          v-model.number="localFilters.min_price"
          type="number"
          placeholder="Min"
          min="0"
          @change="applyFilters"
        />
        <span>—</span>
        <input
          v-model.number="localFilters.max_price"
          type="number"
          placeholder="Max"
          min="0"
          @change="applyFilters"
        />
      </div>
    </div>

    <div class="filter-group">
      <label>Minimum Rating</label>
      <select v-model.number="localFilters.min_rating" @change="applyFilters">
        <option value="">Any Rating</option>
        <option :value="4">4+ Stars</option>
        <option :value="4.5">4.5+ Stars</option>
        <option :value="5">5 Stars</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="checkbox-label">
        <input
          v-model="localFilters.has_video"
          type="checkbox"
          @change="applyFilters"
        />
        Has Video Introduction
      </label>
    </div>

    <div class="filter-group">
      <label class="checkbox-label">
        <input
          v-model="localFilters.is_verified"
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
