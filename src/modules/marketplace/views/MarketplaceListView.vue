<template>
  <div class="marketplace-page">
    <header class="marketplace-page__header">
      <div>
        <h1>Знайдіть свого тьютора</h1>
        <p class="subtitle">Пошук, фільтри та рейтинг — усе в одному місці.</p>
      </div>
      <div class="actions">
        <button class="ghost" @click="resetFilters" :disabled="isLoading || isDefaultFilters">
          Скинути фільтри
        </button>
      </div>
    </header>

    <section class="marketplace-layout">
      <TutorFilterPanel>
        <div class="filter-block">
          <label class="filter-label">Пошук</label>
          <Input v-model="searchTerm" placeholder="Введіть ім'я або предмет" />
        </div>

        <div class="filter-block">
          <label class="filter-label">Предмети</label>
          <Select
            v-model="filters.subjects"
            placeholder="Оберіть предмети"
            multiple
            :options="subjectOptions"
          />
        </div>

        <div class="filter-inline">
          <div class="filter-block">
            <label class="filter-label">Мін. ціна</label>
            <Input v-model="priceMin" type="number" min="0" placeholder="0" />
          </div>
          <div class="filter-block">
            <label class="filter-label">Макс. ціна</label>
            <Input v-model="priceMax" type="number" min="0" placeholder="200" />
          </div>
        </div>

        <div class="filter-block">
          <label class="filter-label">Досвід</label>
          <Select v-model="filters.experience" :options="experienceOptions" placeholder="Від 3 років" />
        </div>

        <div class="filter-block">
          <label class="filter-label">Мова викладання</label>
          <Select v-model="filters.language" :options="languageOptions" placeholder="Українська" />
        </div>

        <div class="filter-block">
          <label class="filter-label">Сортування</label>
          <Select v-model="filters.sort" :options="sortOptions" />
        </div>
      </TutorFilterPanel>

      <section class="marketplace-results">
        <div class="results-header">
          <p v-if="tutors.length">{{ tutors.length }} тьюторів</p>
          <p v-else-if="!isLoading">Не знайдено. Спробуйте інші фільтри.</p>
        </div>

        <div v-if="isLoading" class="loader">
          <span>Завантаження...</span>
        </div>

        <div v-else class="cards-grid">
          <TutorCard
            v-for="tutor in tutors"
            :key="tutor.id"
            :tutor="tutor"
            @click="openTutor(tutor.id)"
          >
            <template #actions>
              <button class="primary ghost" @click.stop="openTutor(tutor.id)">Переглянути</button>
            </template>
          </TutorCard>
        </div>

        <div class="pagination" v-if="hasMore">
          <button class="ghost" :disabled="isLoading" @click="loadMore">Показати ще</button>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Input from '../../../ui/Input.vue'
import Select from '../../../ui/Select.vue'
import TutorCard from '../components/TutorCard.vue'
import TutorFilterPanel from '../components/TutorFilterPanel.vue'
import { useMarketplaceStore } from '../store/marketplaceStore'
import { telemetry } from '../../../services/telemetry'
import { debounce } from '../../../utils/debounce'
import { getLanguageOptions } from '../../../config/languages'

const store = useMarketplaceStore()
const router = useRouter()
const route = useRoute()

const searchTerm = ref(store.filters.search || '')
const priceMin = ref(store.filters.price_min || '')
const priceMax = ref(store.filters.price_max || '')

const filters = computed(() => store.filters)
const tutors = computed(() => store.tutors)
const hasMore = computed(() => store.hasMore)
const isLoading = computed(() => store.loading)

const subjectOptions = [
  { label: 'Математика', value: 'math' },
  { label: 'Українська', value: 'ukrainian' },
  { label: 'Англійська', value: 'english' },
]

// Language options from centralized config
const languageOptions = getLanguageOptions()

const experienceOptions = [
  { label: '1+ років', value: '1' },
  { label: '3+ років', value: '3' },
  { label: '5+ років', value: '5' },
  { label: '10+ років', value: '10' },
]

const sortOptions = [
  { label: 'За релевантністю', value: 'relevance' },
  { label: 'Ціна ↑', value: 'price_asc' },
  { label: 'Ціна ↓', value: 'price_desc' },
  { label: 'Досвід', value: 'experience' },
]

const isDefaultFilters = computed(() => {
  const defaultValues = {
    search: '',
    subjects: [],
    price_min: null,
    price_max: null,
    experience: null,
    language: null,
    sort: 'relevance',
  }
  return JSON.stringify(filters.value) === JSON.stringify(defaultValues)
})

const syncFiltersFromRoute = () => {
  const query = route.query || {}
  const parsed = {
    search: query.search || '',
    subjects: query.subjects ? [].concat(query.subjects) : [],
    price_min: query.price_min ? Number(query.price_min) : null,
    price_max: query.price_max ? Number(query.price_max) : null,
    experience: query.experience || null,
    language: query.language || null,
    sort: query.sort || 'relevance',
  }
  store.setFilters(parsed)
  searchTerm.value = parsed.search
  priceMin.value = parsed.price_min || ''
  priceMax.value = parsed.price_max || ''
}

const pushFiltersToRoute = () => {
  const query = { ...filters.value }
  if (!query.search) delete query.search
  if (!query.experience) delete query.experience
  if (!query.language) delete query.language
  if (!query.subjects?.length) delete query.subjects
  if (!query.price_min) delete query.price_min
  if (!query.price_max) delete query.price_max

  router.replace({ query })
}

const debouncedSearch = debounce(() => {
  store.setFilters({ search: searchTerm.value })
  telemetry.trigger('marketplace.search', { search: searchTerm.value })
  pushFiltersToRoute()
  store.loadTutors()
}, 300)

watch(searchTerm, debouncedSearch)

watch([priceMin, priceMax], () => {
  store.setFilters({
    price_min: priceMin.value ? Number(priceMin.value) : null,
    price_max: priceMax.value ? Number(priceMax.value) : null,
  })
  pushFiltersToRoute()
})

watch(
  () => route.query,
  () => {
    syncFiltersFromRoute()
    store.loadTutors()
  },
  { deep: true },
)

function resetFilters() {
  store.resetFilters()
  searchTerm.value = ''
  priceMin.value = ''
  priceMax.value = ''
  pushFiltersToRoute()
  store.loadTutors()
  telemetry.trigger('marketplace.filter.reset')
}

function loadMore() {
  store.loadMore()
  telemetry.trigger('marketplace.pagination.more', { cursor: store.cursor })
}

function openTutor(id) {
  telemetry.trigger('marketplace.click.cta', { tutor_id: id })
  router.push({ name: 'marketplace-tutor', params: { id } })
}

onMounted(async () => {
  syncFiltersFromRoute()
  await store.loadTutors()
})
</script>
