<template>
  <div class="city-autocomplete">
    <div class="input-wrapper">
      <Input
        v-model="searchQuery"
        :label="label || $t('tutor.city.label')"
        :placeholder="placeholder || $t('tutor.city.placeholder')"
        :error="error"
        @input="onSearchInput"
        @focus="onFocus"
        @blur="onBlur"
        autocomplete="off"
      />
      <button
        v-if="selectedCity"
        type="button"
        class="clear-btn"
        @click="clearSelection"
      >
        ×
      </button>
    </div>
    
    <div
      v-if="showDropdown && (cities.length || loading)"
      class="dropdown"
    >
      <div v-if="loading" class="dropdown-item loading">
        {{ $t('common.loading') }}
      </div>
      <div
        v-for="city in cities"
        :key="city.code"
        class="dropdown-item"
        @mousedown="selectCity(city)"
      >
        <span class="city-name">{{ city.name }}</span>
        <span v-if="city.country_code !== 'UA'" class="country-badge">
          {{ city.country_code }}
        </span>
      </div>
      <div v-if="!loading && !cities.length && searchQuery.length >= 2" class="dropdown-item no-results">
        {{ $t('tutor.city.no_results') }}
      </div>
    </div>
    
    <div v-if="selectedCity && !showDropdown" class="selected-hint">
      <span class="hint-label">{{ $t('tutor.city.selected') }}:</span>
      <span class="hint-value">{{ selectedCity.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Input from '@/components/ui/Input.vue'
import { useGeoApi } from '@/composables/useGeoApi'
import { debounce } from '@/utils/debounce'

interface City {
  code: string
  name: string
  name_uk: string
  slug: string
  country_code: string
}

interface Props {
  modelValue: string | null
  countryCode?: string
  label?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  countryCode: 'UA'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { t } = useI18n()
const { fetchCities, loading, error: apiError } = useGeoApi()

const searchQuery = ref('')
const showDropdown = ref(false)
const cities = ref<City[]>([])
const selectedCity = ref<City | null>(null)

const error = computed(() => {
  if (apiError.value) return apiError.value
  return ''
})

// Debounced search
const debouncedSearch = debounce(async (query: string) => {
  if (!query || query.length < 2) {
    cities.value = []
    return
  }
  
  try {
    cities.value = await fetchCities({
      country: props.countryCode,
      query: query
    })
  } catch {
    cities.value = []
  }
}, 300)

function onSearchInput() {
  debouncedSearch(searchQuery.value)
}

function onFocus() {
  showDropdown.value = true
  if (searchQuery.value.length >= 2 && !selectedCity.value) {
    debouncedSearch(searchQuery.value)
  }
}

function onBlur() {
  // Delay hiding to allow click on dropdown items
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

function selectCity(city: City) {
  selectedCity.value = city
  searchQuery.value = city.name
  emit('update:modelValue', city.code)
  showDropdown.value = false
}

function clearSelection() {
  selectedCity.value = null
  searchQuery.value = ''
  cities.value = []
  emit('update:modelValue', null)
}

// Load city details if modelValue provided externally
watch(() => props.modelValue, async (code) => {
  if (!code) {
    selectedCity.value = null
    searchQuery.value = ''
    return
  }
  
  if (!selectedCity.value || selectedCity.value.code !== code) {
    // Fetch city by code
    try {
      const result = await fetchCities({ country: props.countryCode, query: code })
      const city = result.find(c => c.code === code)
      if (city) {
        selectedCity.value = city
        searchQuery.value = city.name
      }
    } catch {
      // Silent fail - city not found
    }
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.city-autocomplete {
  position: relative;
}

.input-wrapper {
  position: relative;
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  
  &:hover {
    color: #666;
  }
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &.loading,
  &.no-results {
    color: #999;
    cursor: default;
    justify-content: center;
  }
}

.city-name {
  font-weight: 500;
}

.country-badge {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.selected-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.hint-label {
  font-weight: 500;
}

.hint-value {
  color: #333;
}
</style>
