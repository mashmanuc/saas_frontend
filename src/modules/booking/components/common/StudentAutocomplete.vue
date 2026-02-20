<template>
  <div class="student-autocomplete">
    <input
      ref="inputRef"
      v-model="searchQuery"
      type="text"
      :placeholder="$t('booking.manualBooking.searchStudent')"
      class="autocomplete-input"
      @focus="showDropdown = true"
      @input="handleInput"
    />
    
    <div v-if="showDropdown && (recentStudents.length > 0 || displayResults.length > 0)" class="dropdown">
      <div v-if="searchQuery === '' && recentStudents.length > 0" class="dropdown-section">
        <div class="section-label">{{ $t('booking.manualBooking.recentStudents') }}</div>
        <button
          v-for="student in recentStudents"
          :key="student.id"
          class="dropdown-item"
          @click="selectStudent(student)"
        >
          <UserIcon class="w-4 h-4" />
          <span>{{ student.name }}</span>
        </button>
      </div>
      
      <div v-if="searchQuery !== ''" class="dropdown-section">
        <div v-if="searching" class="dropdown-item">
          <LoaderIcon class="w-4 h-4 animate-spin" />
          <span>{{ $t('common.searching') }}</span>
        </div>
        
        <div v-else-if="displayResults.length === 0" class="dropdown-item text-gray-500">
          {{ $t('booking.manualBooking.noStudentsFound') }}
        </div>
        
        <button
          v-else
          v-for="student in displayResults"
          :key="student.id"
          class="dropdown-item"
          @click="selectStudent(student)"
        >
          <UserIcon class="w-4 h-4" />
          <span>{{ student.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { User as UserIcon, Loader as LoaderIcon } from 'lucide-vue-next'
import { useClickOutside } from '@/composables/useClickOutside'

interface Student {
  id: number
  name: string
}

const props = defineProps<{
  modelValue: Student | null
  recentStudents: Student[]
  searchResults?: Student[]
}>()

const emit = defineEmits<{
  'update:modelValue': [student: Student | null]
  search: [query: string]
}>()

const inputRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const showDropdown = ref(false)
const searching = ref(false)

const displayResults = computed(() => props.searchResults || [])

let searchTimeout: ReturnType<typeof setTimeout> | null = null

useClickOutside(inputRef, () => {
  showDropdown.value = false
})

watch(() => props.modelValue, (student) => {
  if (student) {
    searchQuery.value = student.name
    showDropdown.value = false
  }
})

function handleInput() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  if (searchQuery.value === '') {
    searching.value = false
    return
  }
  
  searching.value = true
  
  searchTimeout = setTimeout(async () => {
    emit('search', searchQuery.value)
    searching.value = false
  }, 300)
}

function selectStudent(student: Student) {
  emit('update:modelValue', student)
  searchQuery.value = student.name
  showDropdown.value = false
}
</script>

<style scoped>
.student-autocomplete {
  position: relative;
}

.autocomplete-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 0.15s;
}

.autocomplete-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-section {
  padding: 4px;
}

.section-label {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  text-align: left;
  transition: background-color 0.15s;
  font-size: 14px;
}

.dropdown-item:hover {
  background-color: var(--bg-secondary);
}
</style>
