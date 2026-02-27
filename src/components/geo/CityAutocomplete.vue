<template>
  <div class="city-autocomplete" data-test="city-autocomplete">
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
      <!-- Inline spinner — absolute, no layout shift -->
      <span v-if="loading" class="input-spinner" aria-hidden="true" />
      <button
        v-if="selectedCity && !loading"
        type="button"
        class="clear-btn"
        @click="clearSelection"
        :aria-label="$t('common.clear')"
      >
        ×
      </button>
    </div>
    
    <!-- Dropdown: position absolute, capped height, never in normal flow -->
    <div
      v-if="showDropdown && (cities.length || hasPendingSearch)"
      class="dropdown"
      role="listbox"
    >
      <div
        v-for="city in cities"
        :key="city.code"
        class="dropdown-item"
        role="option"
        @mousedown.prevent="selectCity(city)"
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
    <div v-else-if="hasUnmatchedInput && !showDropdown" class="unmatched-warning">
      {{ $t('tutor.city.unmatched_warning') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
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
const { fetchCities, cancelPending, loading, error: apiError } = useGeoApi()

const searchQuery = ref('')
const showDropdown = ref(false)
const cities = ref<City[]>([])
const selectedCity = ref<City | null>(null)
const hasUnmatchedInput = ref(false)
// Track whether a search is pending (debounce queued OR request in-flight)
const hasPendingSearch = computed(() => loading.value || searchQuery.value.length >= 2)

const error = computed(() => {
  if (apiError.value) return apiError.value
  return ''
})

// Debounced search — 350ms to reduce API calls while typing
const debouncedSearch = debounce(async (query: string) => {
  if (!query || query.length < 2) {
    // Only clear results when query is explicitly too short — not during loading
    cities.value = []
    return
  }
  
  try {
    const result = await fetchCities({
      country: props.countryCode,
      query: query
    })
    // Only update cities if we got a real result (aborted requests return [])
    // Keep previous results visible while a new request is in-flight
    if (result.length > 0 || !loading.value) {
      cities.value = result
    }
  } catch {
    // Don't clear cities on error — keep stale results visible
  }
}, 350)

function onSearchInput() {
  // If user cleared selection by typing, reset selectedCity
  if (selectedCity.value && searchQuery.value !== selectedCity.value.name) {
    selectedCity.value = null
    emit('update:modelValue', null)
  }
  showDropdown.value = true
  debouncedSearch(searchQuery.value)
}

function onFocus() {
  showDropdown.value = true
  if (searchQuery.value.length >= 2 && !selectedCity.value) {
    debouncedSearch(searchQuery.value)
  }
}

function onBlur() {
  // Delay hiding to allow click on dropdown items (mousedown.prevent helps too)
  setTimeout(() => {
    showDropdown.value = false
    // If user typed something but didn't select from dropdown — clear city_code and show warning
    if (searchQuery.value.length >= 2 && !selectedCity.value) {
      hasUnmatchedInput.value = true
      emit('update:modelValue', null)
    } else {
      hasUnmatchedInput.value = false
    }
  }, 200)
}

function selectCity(city: City) {
  selectedCity.value = city
  searchQuery.value = city.name
  hasUnmatchedInput.value = false
  emit('update:modelValue', city.code)
  showDropdown.value = false
  // Cancel any pending search — user made a choice
  debouncedSearch.cancel?.()
  cancelPending()
}

function clearSelection() {
  selectedCity.value = null
  searchQuery.value = ''
  cities.value = []
  hasUnmatchedInput.value = false
  emit('update:modelValue', null)
  debouncedSearch.cancel?.()
  cancelPending()
}

// Cleanup on unmount
onBeforeUnmount(() => {
  debouncedSearch.cancel?.()
  cancelPending()
})

// Load city details if modelValue provided externally
// Guard: skip re-fetch if selected city already matches the code
watch(() => props.modelValue, async (code, oldCode) => {
  if (!code) {
    selectedCity.value = null
    searchQuery.value = ''
    return
  }
  
  // Skip if already selected with matching code (prevents flash on autosave)
  if (selectedCity.value?.code === code) return
  
  // Skip if code hasn't actually changed (reactive re-trigger)
  if (code === oldCode) return
  
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
}, { immediate: true })
</script>

<style scoped lang="scss">
.city-autocomplete {
  position: relative;
}

.input-wrapper {
  position: relative;
}

.input-spinner {
  position: absolute;
  right: 12px;
  bottom: 10px;
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: city-spin 0.6s linear infinite;
  pointer-events: none;
}

@keyframes city-spin {
  to { transform: rotate(360deg); }
}

.clear-btn {
  position: absolute;
  right: 8px;
  bottom: 6px;
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
  margin-top: 4px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overscroll-behavior: contain;
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.1s ease;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &:active {
    background: #e8e8e8;
  }
  
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

.unmatched-warning {
  margin-top: 8px;
  font-size: 13px;
  color: #b45309;
  background: #fef3c7;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #fcd34d;
}
</style>
