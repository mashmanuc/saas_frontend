<script setup lang="ts">
// TASK F9: FilterChips component
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import type { SearchFilters, ExtendedFilterOptions } from '../../api/marketplace'
import { useI18n } from 'vue-i18n'
import { getLanguageName } from '@/config/languages'

const props = defineProps<{
  filters: SearchFilters
  options: ExtendedFilterOptions | null
}>()

const { t } = useI18n()

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
      label: t('marketplace.filters.subject'),
      value: props.filters.subject,
    })
  }

  if (props.filters.category) {
    const cat = props.options?.categories.find((c) => c.slug === props.filters.category)
    chips.push({
      key: 'category',
      label: t('marketplace.filters.category'),
      value: cat?.name || props.filters.category,
    })
  }

  if (props.filters.country) {
    const country = props.options?.countries.find((c) => c.code === props.filters.country)
    chips.push({
      key: 'country',
      label: t('marketplace.filters.country'),
      value: country?.name || props.filters.country,
    })
  }

  if (props.filters.language) {
    chips.push({
      key: 'language',
      label: t('marketplace.filters.language'),
      value: getLanguageName(String(props.filters.language)),
    })
  }

  if (props.filters.minPrice !== null || props.filters.maxPrice !== null) {
    const min = props.filters.minPrice ?? 0
    const max = props.filters.maxPrice ?? '∞'
    chips.push({
      key: 'price',
      label: t('marketplace.filters.price'),
      value: t('marketplace.filters.priceRange', { min, max }),
    })
  }

  if (props.filters.minRating !== null) {
    chips.push({
      key: 'minRating',
      label: t('marketplace.filters.rating'),
      value: t('marketplace.filters.ratingMin', { rating: props.filters.minRating }),
    })
  }

  if (props.filters.hasVideo) {
    chips.push({
      key: 'hasVideo',
      label: t('marketplace.filters.video'),
      value: t('marketplace.filters.hasVideo'),
    })
  }

  if (props.filters.isVerified) {
    chips.push({
      key: 'isVerified',
      label: t('marketplace.filters.verified'),
      value: t('marketplace.filters.verifiedOnly'),
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
      {{ t('marketplace.filters.clearAll') }}
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-color);
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
  background: var(--surface-card-muted);
  border-radius: 20px;
  font-size: 13px;
}

.chip-label {
  color: var(--text-muted);
}

.chip-value {
  color: var(--text-primary);
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
  color: var(--text-muted);
  border-radius: 50%;
  transition: all 0.15s;
}

.chip-remove:hover {
  background: color-mix(in srgb, var(--border-color) 65%, transparent);
  color: var(--text-primary);
}

.clear-all {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.clear-all:hover {
  text-decoration: underline;
}
</style>
