<template>
  <div class="i18n-missing-translations">
    <div class="header">
      <h1>{{ $t('admin.i18n.missingTranslations.title') }}</h1>
      <p class="subtitle">{{ $t('admin.i18n.missingTranslations.subtitle') }}</p>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label for="locale-select">{{ $t('admin.i18n.missingTranslations.locale') }}</label>
        <select id="locale-select" v-model="selectedLocale" @change="fetchMissing">
          <option v-for="locale in locales" :key="locale.code" :value="locale.code">
            {{ locale.native_name }} ({{ locale.code }})
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label for="search-input">{{ $t('common.search') }}</label>
        <input
          id="search-input"
          v-model="searchQuery"
          type="text"
          :placeholder="$t('admin.i18n.missingTranslations.searchPlaceholder')"
        />
      </div>

      <button @click="exportCSV" class="btn-export" :disabled="isLoading">
        {{ $t('admin.i18n.missingTranslations.exportCSV') }}
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="fetchMissing">{{ $t('common.retry') }}</button>
    </div>

    <div v-else-if="filteredMissing.length === 0" class="empty">
      <p>{{ $t('admin.i18n.missingTranslations.noMissing') }}</p>
    </div>

    <div v-else class="table-container">
      <table class="missing-table">
        <thead>
          <tr>
            <th>{{ $t('admin.i18n.missingTranslations.key') }}</th>
            <th>{{ $t('admin.i18n.missingTranslations.namespace') }}</th>
            <th>{{ $t('admin.i18n.missingTranslations.defaultValue') }}</th>
            <th>{{ $t('admin.i18n.missingTranslations.description') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paginatedMissing" :key="item.key">
            <td class="key-cell">{{ item.key }}</td>
            <td>{{ item.namespace || '-' }}</td>
            <td>{{ item.default_value || '-' }}</td>
            <td>{{ item.description || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button @click="prevPage" :disabled="currentPage === 1">
          {{ $t('common.back') }}
        </button>
        <span>{{ $t('common.showing') }} {{ startIndex + 1 }}-{{ endIndex }} {{ $t('common.of') }} {{ filteredMissing.length }}</span>
        <button @click="nextPage" :disabled="currentPage >= totalPages">
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { i18nApi } from '@/modules/admin/api/i18nApi'

interface MissingTranslation {
  key: string
  namespace: string | null
  default_value: string | null
  description: string | null
}

interface Locale {
  code: string
  name: string
  native_name: string
}

const locales = ref<Locale[]>([])
const selectedLocale = ref('en')
const missing = ref<MissingTranslation[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 50

const filteredMissing = computed(() => {
  if (!searchQuery.value) return missing.value
  const query = searchQuery.value.toLowerCase()
  return missing.value.filter(item =>
    item.key.toLowerCase().includes(query) ||
    (item.namespace?.toLowerCase().includes(query)) ||
    (item.default_value?.toLowerCase().includes(query)) ||
    (item.description?.toLowerCase().includes(query))
  )
})

const totalPages = computed(() => Math.ceil(filteredMissing.value.length / itemsPerPage))
const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage)
const endIndex = computed(() => Math.min(startIndex.value + itemsPerPage, filteredMissing.value.length))

const paginatedMissing = computed(() => {
  return filteredMissing.value.slice(startIndex.value, endIndex.value)
})

async function fetchLocales() {
  try {
    const response = await i18nApi.getLocales()
    locales.value = response
  } catch (err) {
    console.error('Failed to fetch locales:', err)
  }
}

async function fetchMissing() {
  isLoading.value = true
  error.value = null
  currentPage.value = 1

  try {
    const response = await i18nApi.getMissingTranslations(selectedLocale.value)
    missing.value = response.items || []
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to fetch missing translations'
  } finally {
    isLoading.value = false
  }
}

function exportCSV() {
  const headers = ['Key', 'Namespace', 'Default Value', 'Description']
  const rows = filteredMissing.value.map(item => [
    item.key,
    item.namespace || '',
    item.default_value || '',
    item.description || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `missing-translations-${selectedLocale.value}.csv`
  link.click()
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

onMounted(async () => {
  await fetchLocales()
  await fetchMissing()
})
</script>

<style scoped>
.i18n-missing-translations {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--color-text-muted);
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
}

.filter-group select,
.filter-group input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  min-width: 200px;
}

.btn-export {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
}

.btn-export:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}

.error button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.table-container {
  background: var(--color-surface);
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.missing-table {
  width: 100%;
  border-collapse: collapse;
}

.missing-table thead {
  background: var(--color-surface-elevated);
}

.missing-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--color-border);
}

.missing-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.missing-table tbody tr:hover {
  background: var(--color-surface-hover);
}

.key-cell {
  font-family: monospace;
  font-weight: 500;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}

.pagination button {
  padding: 0.5rem 1rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
