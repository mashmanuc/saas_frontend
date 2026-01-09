<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">{{ t('marketplace.title') }}</h1>
    
    <!-- Filters -->
    <Card class="p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Subjects Multi-Select -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('marketplace.filters.subjects') }}</label>
          <MultiSelect
            v-model="selectedSubjects"
            :options="subjectOptions"
            :placeholder="t('marketplace.filters.selectSubjects')"
          />
        </div>
        
        <!-- Price Range -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('marketplace.filters.priceRange') }}</label>
          <div class="flex gap-2">
            <Input
              v-model.number="filters.min_rate"
              type="number"
              :placeholder="t('marketplace.filters.min')"
            />
            <Input
              v-model.number="filters.max_rate"
              type="number"
              :placeholder="t('marketplace.filters.max')"
            />
          </div>
        </div>
        
        <!-- Min Rating -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('marketplace.filters.minRating') }}</label>
          <Select v-model="filters.min_rating">
            <option :value="undefined">{{ t('marketplace.filters.any') }}</option>
            <option :value="4.5">4.5+</option>
            <option :value="4.0">4.0+</option>
            <option :value="3.5">3.5+</option>
          </Select>
        </div>
        
        <!-- Sort By -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('marketplace.filters.sortBy') }}</label>
          <Select v-model="filters.sort_by">
            <option value="rating_desc">{{ t('marketplace.filters.ratingDesc') }}</option>
            <option value="rate_asc">{{ t('marketplace.filters.priceAsc') }}</option>
            <option value="rate_desc">{{ t('marketplace.filters.priceDesc') }}</option>
            <option value="newest">{{ t('marketplace.filters.newest') }}</option>
          </Select>
        </div>
      </div>
      
      <div class="flex gap-2 mt-4">
        <Button @click="applyFilters" variant="primary">
          {{ t('marketplace.filters.apply') }}
        </Button>
        <Button @click="resetFilters" variant="outline">
          {{ t('marketplace.filters.reset') }}
        </Button>
      </div>
    </Card>
    
    <!-- Results -->
    <div v-if="isLoading" class="text-center py-12">
      <Spinner size="lg" />
    </div>
    
    <Alert v-else-if="error" variant="error">
      {{ error }}
    </Alert>
    
    <div v-else-if="tutors.length === 0" class="text-center py-12">
      <p class="text-muted">{{ t('marketplace.noResults') }}</p>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <TutorCard
        v-for="tutor in tutors"
        :key="tutor.id"
        :tutor="tutor"
        @request="handleRequestTutor"
      />
    </div>
    
    <!-- Load More -->
    <div v-if="nextCursor" class="text-center mt-8">
      <Button @click="loadMore" :loading="isLoading" variant="outline">
        {{ t('marketplace.loadMore') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMarketplaceStore } from '@/stores/marketplaceStore'
import { useRelationsStore } from '@/stores/relationsStore'
import type { TutorSearchParams } from '@/types/relations'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import MultiSelect from '@/components/ui/MultiSelect.vue'
import Alert from '@/components/ui/Alert.vue'
import Spinner from '@/components/ui/Spinner.vue'
import TutorCard from '@/components/marketplace/TutorCard.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const marketplaceStore = useMarketplaceStore()
const relationsStore = useRelationsStore()

const filters = reactive<{
  min_rate?: number
  max_rate?: number
  min_rating?: number
  sort_by: 'rating_desc' | 'rate_asc' | 'rate_desc' | 'newest'
}>({
  min_rate: undefined,
  max_rate: undefined,
  min_rating: undefined,
  sort_by: 'rating_desc'
})

// Правка 2: Локальний array для MultiSelect, API очікує CSV
const selectedSubjects = ref<string[]>([])

const subjectOptions = [
  { value: 'Math', label: 'Математика' },
  { value: 'Physics', label: 'Фізика' },
  { value: 'English', label: 'Англійська' },
  { value: 'Ukrainian', label: 'Українська' },
  { value: 'Chemistry', label: 'Хімія' },
  { value: 'Biology', label: 'Біологія' },
]

const tutors = computed(() => marketplaceStore.tutors)
const isLoading = computed(() => marketplaceStore.isLoading)
const error = computed(() => marketplaceStore.error)
const nextCursor = computed(() => marketplaceStore.nextCursor)

onMounted(() => {
  loadFiltersFromURL()
  applyFilters()
})

function loadFiltersFromURL() {
  // Правка 2: subjects приходить як CSV string, конвертуємо в array
  if (typeof route.query.subjects === 'string') {
    selectedSubjects.value = route.query.subjects.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (route.query.min_rate) filters.min_rate = Number(route.query.min_rate)
  if (route.query.max_rate) filters.max_rate = Number(route.query.max_rate)
  if (route.query.min_rating) filters.min_rating = Number(route.query.min_rating)
  if (route.query.sort_by && typeof route.query.sort_by === 'string') {
    filters.sort_by = route.query.sort_by as 'rating_desc' | 'rate_asc' | 'rate_desc' | 'newest'
  }
}

function applyFilters() {
  // Правка 2: Конвертуємо selectedSubjects array в CSV для API
  const params: TutorSearchParams = {
    ...filters,
    subjects: selectedSubjects.value.length ? selectedSubjects.value.join(',') : undefined
  }
  
  // Оновити URL через serializeFilters
  router.replace({ query: marketplaceStore.serializeFilters(params) })
  
  // Виконати пошук з правильним форматом
  marketplaceStore.searchTutors(params)
}

function resetFilters() {
  selectedSubjects.value = []
  filters.min_rate = undefined
  filters.max_rate = undefined
  filters.min_rating = undefined
  filters.sort_by = 'rating_desc'
  
  applyFilters()
}

function loadMore() {
  marketplaceStore.loadMore()
}

async function handleRequestTutor(tutorId: string) {
  try {
    await relationsStore.requestTutor(tutorId)
    // Success handled by store
  } catch (err) {
    // Error handled by store
  }
}
</script>
