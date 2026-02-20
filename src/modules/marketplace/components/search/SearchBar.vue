<script setup lang="ts">
// TASK F4: Search Bar Component
import { ref, computed, watch } from 'vue'
import { Search, X, ArrowRight, Loader2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useSearchStore } from '../../stores/searchStore'
import SearchHistory from './SearchHistory.vue'
import SearchSuggestions from './SearchSuggestions.vue'
import type { Suggestion } from '../../api/marketplace'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    loading?: boolean
  }>(),
  {
    placeholder: undefined,
    loading: false,
  }
)

const { t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [query: string]
  clear: []
}>()

const store = useSearchStore()
const { suggestions, isLoadingSuggestions, searchHistory } = storeToRefs(store)
const router = useRouter()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const selectedIndex = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const showHistory = computed(() => !props.modelValue)
const showDropdown = computed(
  () => isFocused.value && (showHistory.value || props.modelValue.length >= 2)
)

const totalItems = computed(
  () =>
    (showHistory.value ? searchHistory.value.length : 0) + suggestions.value.length
)

// Debounced suggestions fetch
watch(
  () => props.modelValue,
  (newValue) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    if (newValue.length >= 2) {
      debounceTimer = setTimeout(() => {
        store.getSuggestions(newValue)
      }, 300)
    } else {
      suggestions.value = []
    }
    selectedIndex.value = -1
  }
)

const handleInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  // Delay to allow click on dropdown
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

const handleSubmit = () => {
  if (selectedIndex.value >= 0) {
    // Select highlighted item
    if (showHistory.value && selectedIndex.value < searchHistory.value.length) {
      handleHistorySelect(searchHistory.value[selectedIndex.value])
    } else {
      const suggestionIndex =
        selectedIndex.value - (showHistory.value ? searchHistory.value.length : 0)
      if (suggestions.value[suggestionIndex]) {
        handleSuggestionSelect(suggestions.value[suggestionIndex])
      }
    }
  } else {
    emit('search', props.modelValue)
  }
  isFocused.value = false
}

const handleEscape = () => {
  isFocused.value = false
  inputRef.value?.blur()
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

const handleArrowDown = () => {
  if (selectedIndex.value < totalItems.value - 1) {
    selectedIndex.value++
  }
}

const handleArrowUp = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

const handleHistorySelect = (query: string) => {
  emit('update:modelValue', query)
  emit('search', query)
  isFocused.value = false
}

const handleHistoryRemove = (query: string) => {
  store.removeFromHistory(query)
}

const clearHistory = () => {
  store.clearSearchHistory()
}

const handleSuggestionSelect = (suggestion: Suggestion) => {
  if (suggestion.type === 'tutor' && suggestion.slug) {
    // Navigate to tutor profile
    router.push(`/marketplace/tutors/${suggestion.slug}`)
  } else {
    emit('update:modelValue', suggestion.text)
    emit('search', suggestion.text)
  }
  isFocused.value = false
}
</script>

<template>
  <div class="search-bar" :class="{ 'is-focused': isFocused }">
    <div class="search-input-wrapper">
      <Search class="search-icon" :size="20" />

      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        :placeholder="placeholder || t('marketplace.search.placeholder')"
        class="search-input"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="handleSubmit"
        @keydown.escape="handleEscape"
        @keydown.down.prevent="handleArrowDown"
        @keydown.up.prevent="handleArrowUp"
      />

      <button v-if="modelValue" class="clear-btn" type="button" @click="handleClear">
        <X :size="18" />
      </button>

      <button
        class="submit-btn"
        type="button"
        :disabled="loading"
        @click="handleSubmit"
      >
        <Loader2 v-if="loading" :size="18" class="animate-spin" />
        <ArrowRight v-else :size="18" />
      </button>
    </div>

    <!-- Suggestions Dropdown -->
    <Transition name="dropdown">
      <div v-if="showDropdown" class="search-dropdown">
        <!-- Search History -->
        <div
          v-if="showHistory && searchHistory.length > 0"
          class="dropdown-section"
        >
          <div class="section-header">
            <span>{{ t('marketplace.search.recentTitle') }}</span>
            <button class="clear-history" type="button" @click="clearHistory">
              {{ t('marketplace.filters.clear') }}
            </button>
          </div>
          <SearchHistory
            :history="searchHistory"
            :selected-index="selectedIndex"
            @select="handleHistorySelect"
            @remove="handleHistoryRemove"
          />
        </div>

        <!-- Suggestions -->
        <div v-if="suggestions.length > 0" class="dropdown-section">
          <div class="section-header">{{ t('marketplace.search.suggestionsTitle') }}</div>
          <SearchSuggestions
            :suggestions="suggestions"
            :selected-index="selectedIndex - searchHistory.length"
            :loading="isLoadingSuggestions"
            @select="handleSuggestionSelect"
          />
        </div>

        <!-- No Results -->
        <div
          v-if="modelValue && !isLoadingSuggestions && suggestions.length === 0"
          class="no-suggestions"
        >
          {{ t('marketplace.search.pressEnter', { query: modelValue }) }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--surface-card);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 0 16px;
  transition: all 0.2s ease;
}

.search-bar.is-focused .search-input-wrapper {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  padding: 14px 12px;
  font-size: 16px;
  outline: none;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn,
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
}

.clear-btn:hover,
.submit-btn:hover {
  color: var(--text-primary);
}

.submit-btn {
  background: var(--accent);
  color: white;
  border-radius: 8px;
  margin-left: 8px;
}

.submit-btn:hover {
  background: color-mix(in srgb, var(--accent) 86%, transparent);
  color: white;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.dropdown-section {
  padding: 8px 0;
}

.dropdown-section + .dropdown-section {
  border-top: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.clear-history {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  text-transform: none;
}

.clear-history:hover {
  text-decoration: underline;
}

.no-suggestions {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
