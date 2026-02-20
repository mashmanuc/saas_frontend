<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
}>()

const { t } = useI18n()

const pages = computed(() => {
  const current = props.currentPage
  const total = props.totalPages
  const delta = 2
  const range: number[] = []
  const rangeWithDots: (number | string)[] = []

  for (
    let i = Math.max(2, current - delta);
    i <= Math.min(total - 1, current + delta);
    i++
  ) {
    range.push(i)
  }

  if (current - delta > 2) {
    rangeWithDots.push(1, '...')
  } else {
    rangeWithDots.push(1)
  }

  rangeWithDots.push(...range)

  if (current + delta < total - 1) {
    rangeWithDots.push('...', total)
  } else if (total > 1) {
    rangeWithDots.push(total)
  }

  return rangeWithDots
})

const startItem = computed(() => (props.currentPage - 1) * props.pageSize + 1)
const endItem = computed(() => Math.min(props.currentPage * props.pageSize, props.totalCount))

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('update:page', page)
  }
}

function previousPage() {
  if (props.currentPage > 1) {
    goToPage(props.currentPage - 1)
  }
}

function nextPage() {
  if (props.currentPage < props.totalPages) {
    goToPage(props.currentPage + 1)
  }
}
</script>

<template>
  <div class="catalog-pagination">
    <div class="pagination-info">
      <span class="info-text">
        {{ t('common.showing') }} {{ startItem }}–{{ endItem }} {{ t('common.of') }} {{ totalCount }}
      </span>
    </div>

    <nav class="pagination-nav" aria-label="Pagination">
      <button
        class="pagination-btn prev"
        :disabled="currentPage === 1"
        @click="previousPage"
        :aria-label="t('common.previous')"
      >
        <ChevronLeft :size="18" />
      </button>

      <button
        v-for="(page, index) in pages"
        :key="index"
        class="pagination-btn page"
        :class="{ active: page === currentPage, dots: page === '...' }"
        :disabled="page === '...'"
        @click="typeof page === 'number' ? goToPage(page) : null"
      >
        {{ page }}
      </button>

      <button
        class="pagination-btn next"
        :disabled="currentPage === totalPages"
        @click="nextPage"
        :aria-label="t('common.next')"
      >
        <ChevronRight :size="18" />
      </button>
    </nav>
  </div>
</template>

<style scoped>
.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 0;
  gap: 1rem;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--text-muted, #6b7280);
}

.pagination-nav {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 0.5rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary, #111827);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled):not(.dots) {
  background: var(--surface-hover, #f9fafb);
  border-color: var(--accent);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.pagination-btn.dots {
  border: none;
  cursor: default;
}

.pagination-btn.dots:hover {
  background: transparent;
}

@media (max-width: 640px) {
  .catalog-pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-nav {
    justify-content: center;
  }

  .pagination-info {
    text-align: center;
  }
}
</style>
