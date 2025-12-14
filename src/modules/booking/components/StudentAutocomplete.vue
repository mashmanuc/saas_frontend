<template>
  <div class="student-autocomplete" :class="{ 'student-autocomplete--open': isOpen }">
    <label v-if="label" :for="inputId" class="autocomplete-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>

    <!-- Selected Student Display -->
    <div v-if="selectedStudent" class="selected-student">
      <div class="selected-student__avatar">
        <img
          v-if="selectedStudent.avatar"
          :src="selectedStudent.avatar"
          :alt="displayName(selectedStudent)"
        />
        <span v-else class="avatar-placeholder">
          {{ initials(selectedStudent) }}
        </span>
      </div>
      <div class="selected-student__info">
        <span class="selected-student__name">{{ displayName(selectedStudent) }}</span>
        <span class="selected-student__email">{{ selectedStudent.email }}</span>
      </div>
      <button
        type="button"
        class="selected-student__clear"
        @click="clearSelection"
        :aria-label="$t('common.clear')"
      >
        ×
      </button>
    </div>

    <!-- Search Input -->
    <div v-else class="autocomplete-input-wrapper">
      <input
        :id="inputId"
        ref="inputRef"
        type="text"
        class="autocomplete-input"
        :class="{ 'autocomplete-input--error': hasError }"
        :placeholder="placeholder"
        :value="searchQuery"
        :aria-expanded="isOpen"
        :aria-describedby="hasError ? `${inputId}-error` : undefined"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        role="combobox"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <span v-if="isLoading" class="autocomplete-spinner" />
    </div>

    <!-- Error Message -->
    <p v-if="hasError" :id="`${inputId}-error`" class="autocomplete-error" role="alert">
      {{ errorMessage }}
    </p>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen && !selectedStudent"
        ref="dropdownRef"
        class="autocomplete-dropdown"
        role="listbox"
        :aria-label="$t('booking.selectStudent')"
      >
        <!-- Loading -->
        <div v-if="isLoading" class="dropdown-loading">
          {{ $t('common.loading') }}
        </div>

        <!-- Results -->
        <template v-else-if="students.length > 0">
          <button
            v-for="(student, index) in students"
            :key="student.id"
            type="button"
            class="dropdown-item"
            :class="{ 'dropdown-item--focused': focusedIndex === index }"
            role="option"
            :aria-selected="focusedIndex === index"
            @click="selectStudent(student)"
            @mouseenter="focusedIndex = index"
          >
            <div class="dropdown-item__avatar">
              <img
                v-if="student.avatar"
                :src="student.avatar"
                :alt="displayName(student)"
              />
              <span v-else class="avatar-placeholder">
                {{ initials(student) }}
              </span>
            </div>
            <div class="dropdown-item__info">
              <span class="dropdown-item__name">{{ displayName(student) }}</span>
              <span class="dropdown-item__email">{{ student.email }}</span>
            </div>
          </button>
        </template>

        <!-- Empty State -->
        <div v-else-if="searchQuery.length >= 2" class="dropdown-empty">
          <p>{{ $t('booking.noStudentsFound') }}</p>
          <button
            v-if="showInviteCta"
            type="button"
            class="invite-cta"
            @click="$emit('invite')"
          >
            {{ $t('booking.inviteStudent') }}
          </button>
        </div>

        <!-- Hint -->
        <div v-else class="dropdown-hint">
          {{ $t('booking.typeToSearch') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { studentsApi, type StudentListItem } from '../api/studentsApi'

interface Props {
  modelValue?: number | null
  label?: string
  placeholder?: string
  required?: boolean
  showInviteCta?: boolean
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  label: '',
  placeholder: 'Search by name or email...',
  required: false,
  showInviteCta: true,
  errorMessage: '',
})

const emit = defineEmits<{
  'update:modelValue': [id: number | null]
  invite: []
}>()

const { t } = useI18n()

// Unique ID for accessibility
const inputId = `student-autocomplete-${Math.random().toString(36).slice(2, 9)}`

// Refs
const inputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

// State
const searchQuery = ref('')
const students = ref<StudentListItem[]>([])
const selectedStudent = ref<StudentListItem | null>(null)
const isOpen = ref(false)
const isLoading = ref(false)
const focusedIndex = ref(-1)
const debounceTimer = ref<number | null>(null)

// Computed
const hasError = computed(() => !!props.errorMessage)

// Methods
function displayName(student: StudentListItem): string {
  if (student.first_name || student.last_name) {
    return `${student.first_name || ''} ${student.last_name || ''}`.trim()
  }
  return student.email.split('@')[0]
}

function initials(student: StudentListItem): string {
  const name = displayName(student)
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function handleInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  searchQuery.value = value
  focusedIndex.value = -1

  // Debounce search
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  if (value.length >= 2) {
    debounceTimer.value = window.setTimeout(() => {
      searchStudents(value)
    }, 300)
  } else {
    students.value = []
  }
}

async function searchStudents(query: string): Promise<void> {
  isLoading.value = true

  try {
    const response = await studentsApi.listStudents(query)
    students.value = response.results
  } catch (error) {
    console.error('[StudentAutocomplete] Search failed:', error)
    students.value = []
  } finally {
    isLoading.value = false
  }
}

function selectStudent(student: StudentListItem): void {
  selectedStudent.value = student
  searchQuery.value = ''
  isOpen.value = false
  emit('update:modelValue', student.id)
  console.log('[ui.student_selected]', { studentId: student.id })
}

function clearSelection(): void {
  selectedStudent.value = null
  emit('update:modelValue', null)
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleFocus(): void {
  isOpen.value = true
}

function handleBlur(): void {
  // Delay to allow click on dropdown items
  setTimeout(() => {
    isOpen.value = false
  }, 200)
}

function handleKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, students.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      break
    case 'Enter':
      event.preventDefault()
      if (focusedIndex.value >= 0 && students.value[focusedIndex.value]) {
        selectStudent(students.value[focusedIndex.value])
      }
      break
    case 'Escape':
      isOpen.value = false
      break
  }
}

// Load initial student if modelValue is provided
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue && !selectedStudent.value) {
      try {
        const student = await studentsApi.getStudent(newValue)
        selectedStudent.value = student
      } catch (error) {
        console.error('[StudentAutocomplete] Failed to load student:', error)
      }
    }
  },
  { immediate: true }
)

// Cleanup
onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
})
</script>

<style scoped>
.student-autocomplete {
  position: relative;
}

.autocomplete-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-fg, #0f172a);
}

.required-mark {
  color: var(--color-error, #dc2626);
  margin-left: 2px;
}

.autocomplete-input-wrapper {
  position: relative;
}

.autocomplete-input {
  width: 100%;
  padding: 10px 12px;
  padding-right: 36px;
  background: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  font-size: 0.9375rem;
  color: var(--color-fg, #0f172a);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.autocomplete-input:focus {
  outline: none;
  border-color: var(--color-brand, #2563eb);
  box-shadow: 0 0 0 3px var(--color-brand-light, #dbeafe);
}

.autocomplete-input--error {
  border-color: var(--color-error, #dc2626);
}

.autocomplete-input--error:focus {
  box-shadow: 0 0 0 3px var(--color-error-light, #fee2e2);
}

.autocomplete-spinner {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border, #e2e8f0);
  border-top-color: var(--color-brand, #2563eb);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: translateY(-50%) rotate(360deg); }
}

.autocomplete-error {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: var(--color-error, #dc2626);
}

/* Selected Student */
.selected-student {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
}

.selected-student__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.selected-student__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-light, #dbeafe);
  color: var(--color-brand, #2563eb);
  font-size: 0.75rem;
  font-weight: 600;
}

.selected-student__info {
  flex: 1;
  min-width: 0;
}

.selected-student__name {
  display: block;
  font-weight: 500;
  color: var(--color-fg, #0f172a);
}

.selected-student__email {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-fg-secondary, #475569);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-student__clear {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--color-fg-tertiary, #94a3b8);
  transition: all 0.15s ease;
}

.selected-student__clear:hover {
  background: var(--color-bg-hover, #f1f5f9);
  color: var(--color-fg, #0f172a);
}

/* Dropdown */
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  max-height: 280px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-loading,
.dropdown-empty,
.dropdown-hint {
  padding: 16px;
  text-align: center;
  color: var(--color-fg-secondary, #475569);
  font-size: 0.875rem;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dropdown-item:hover,
.dropdown-item--focused {
  background: var(--color-bg-hover, #f1f5f9);
}

.dropdown-item__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.dropdown-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dropdown-item__info {
  flex: 1;
  min-width: 0;
}

.dropdown-item__name {
  display: block;
  font-weight: 500;
  color: var(--color-fg, #0f172a);
}

.dropdown-item__email {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-fg-secondary, #475569);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-cta {
  margin-top: 8px;
  padding: 8px 16px;
  background: var(--color-brand, #2563eb);
  border: none;
  border-radius: var(--radius-md, 8px);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.invite-cta:hover {
  background: var(--color-brand-dark, #1d4ed8);
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
