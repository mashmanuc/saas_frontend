<script setup lang="ts">
// TASK F9: FilterChips component
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import type { SearchFilters, ExtendedFilterOptions } from '../../api/marketplace'

const props = defineProps<{
  filters: SearchFilters
  options: ExtendedFilterOptions | null
}>()

const emit = defineEmits<{
  remove: [key: string]
  clear: []
}>()

interface Chip {
  key: string
  label: string
  value: string
}

const activeChips = computed<Chip[]>(() => {
  const chips: Chip[] = []

  if (props.filters.subject) {
    chips.push({
      key: 'subject',
      label: 'Subject',
      value: props.filters.subject,
    })
  }

  if (props.filters.category) {
    const cat = props.options?.categories.find((c) => c.slug === props.filters.category)
    chips.push({
      key: 'category',
      label: 'Category',
      value: cat?.name || props.filters.category,
    })
  }

  if (props.filters.country) {
    const country = props.options?.countries.find((c) => c.code === props.filters.country)
    chips.push({
      key: 'country',
      label: 'Country',
      value: country?.name || props.filters.country,
    })
  }

  if (props.filters.language) {
    const lang = props.options?.languages.find((l) => l.code === props.filters.language)
    chips.push({
      key: 'language',
      label: 'Language',
      value: lang?.name || props.filters.language,
    })
  }

  if (props.filters.minPrice !== null || props.filters.maxPrice !== null) {
    const min = props.filters.minPrice ?? 0
    const max = props.filters.maxPrice ?? '∞'
    chips.push({
      key: 'price',
      label: 'Price',
      value: `$${min} - $${max}`,
    })
  }

  if (props.filters.minRating !== null) {
    chips.push({
      key: 'minRating',
      label: 'Rating',
      value: `${props.filters.minRating}+ stars`,
    })
  }

  if (props.filters.hasVideo) {
    chips.push({
      key: 'hasVideo',
      label: 'Video',
      value: 'Has video intro',
    })
  }

  if (props.filters.isVerified) {
    chips.push({
      key: 'isVerified',
      label: 'Verified',
      value: 'Verified only',
    })
  }

  return chips
})

const handleRemove = (key: string) => {
  // Handle compound keys
  if (key === 'price') {
    emit('remove', 'minPrice')
    emit('remove', 'maxPrice')
  } else {
    emit('remove', key)
  }
}
</script>

<template>
  <div v-if="activeChips.length > 0" class="filter-chips">
    <div class="chips-list">
      <div
        v-for="chip in activeChips"
        :key="chip.key"
        class="chip"
      >
        <span class="chip-label">{{ chip.label }}:</span>
        <span class="chip-value">{{ chip.value }}</span>
        <button
          class="chip-remove"
          type="button"
          @click="handleRemove(chip.key)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
    <button class="clear-all" type="button" @click="emit('clear')">
      Clear all
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--color-bg-primary, white);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-wrap: wrap;
}

.chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 20px;
  font-size: 13px;
}

.chip-label {
  color: var(--color-text-secondary, #6b7280);
}

.chip-value {
  color: var(--color-text-primary, #111827);
  font-weight: 500;
}

.chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--color-text-secondary, #6b7280);
  border-radius: 50%;
  transition: all 0.15s;
}

.chip-remove:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-primary, #111827);
}

.clear-all {
  background: none;
  border: none;
  color: var(--color-primary, #3b82f6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.clear-all:hover {
  text-decoration: underline;
}
</style>
