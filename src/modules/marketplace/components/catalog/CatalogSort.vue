<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

interface Props {
  value: string
}

defineProps<Props>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'update', sort: string): void
}>()

const sortOptions = computed(() => [
  { value: 'recommended', label: t('marketplace.sort.default') },
  { value: 'rating', label: t('marketplace.sort.rating') },
  { value: 'price_asc', label: t('marketplace.sort.price_asc') },
  { value: 'price_desc', label: t('marketplace.sort.price_desc') },
  { value: 'experience_desc', label: t('marketplace.sort.experience_desc') },
])

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update', target.value)
}
</script>

<template>
  <div class="catalog-sort" data-test="marketplace-sort">
    <ArrowUpDown :size="16" class="icon" />
    <select :value="value" data-test="marketplace-sort-select" @change="handleChange">
      <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.catalog-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon {
  color: var(--text-muted);
}

select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--surface-card);
  cursor: pointer;
}

select:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
