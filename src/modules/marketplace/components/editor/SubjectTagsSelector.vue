<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, X, GripVertical, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useCatalog } from '../../composables/useCatalog'
import type { TagGroup } from '../../api/marketplace'
import { getErrorForField, formatErrorMessages, type NestedError } from '../../utils/nestedErrorMapper'

interface SubjectItem {
  code: string
  tags: string[]
  custom_direction_text: string
}

interface Props {
  modelValue: SubjectItem[]
  errors?: Record<string, string>
  nestedErrorMap?: Map<string, NestedError[]>
}

interface Emits {
  (e: 'update:modelValue', value: SubjectItem[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { subjects, tags, loading, loadSubjects, loadTags, getTagsByGroup } = useCatalog()

const localSubjects = ref<SubjectItem[]>([...props.modelValue])
const expandedSubjects = ref<Set<string>>(new Set())
const newSubjectCode = ref('')
const isUpdatingFromProps = ref(false)

const TAG_GROUPS: TagGroup[] = ['grades', 'exams', 'levels', 'goals', 'formats', 'audience']

// v0.83.0: Fallback subjects when API doesn't return data
const FALLBACK_SUBJECTS = [
  { code: 'mathematics', title: '' },
  { code: 'physics', title: '' },
  { code: 'chemistry', title: '' },
  { code: 'biology', title: '' },
  { code: 'english', title: '' },
  { code: 'ukrainian', title: '' },
  { code: 'german', title: '' },
  { code: 'french', title: '' },
  { code: 'spanish', title: '' },
  { code: 'polish', title: '' },
  { code: 'chinese', title: '' },
  { code: 'japanese', title: '' },
  { code: 'computer-science', title: '' },
  { code: 'business-english', title: '' },
  { code: 'marketing', title: '' },
  { code: 'finance', title: '' },
  { code: 'management', title: '' },
  { code: 'piano', title: '' },
  { code: 'guitar', title: '' },
  { code: 'drawing', title: '' },
  { code: 'photography', title: '' },
  { code: 'ielts', title: '' },
  { code: 'toefl', title: '' },
  { code: 'sat', title: '' },
  { code: 'gre', title: '' },
].map(s => ({
  code: s.code,
  title: t(`marketplace.subjects.${s.code}`, s.code),
}))

onMounted(async () => {
  await Promise.all([loadSubjects(), loadTags()])
})

// Watch props to sync external changes
watch(
  () => props.modelValue,
  (newVal) => {
    // Only update if actually different to avoid loops
    if (JSON.stringify(newVal) !== JSON.stringify(localSubjects.value)) {
      isUpdatingFromProps.value = true
      localSubjects.value = [...newVal]
      nextTick(() => {
        isUpdatingFromProps.value = false
      })
    }
  },
  { deep: true }
)

// Emit changes to parent
watch(
  localSubjects,
  (newVal) => {
    if (!isUpdatingFromProps.value) {
      emit('update:modelValue', [...newVal])
    }
  },
  { deep: true }
)

// v0.83.1: Merge API subjects with fallback for complete list
const availableSubjects = computed(() => {
  const selectedCodes = new Set(localSubjects.value.map((s) => s.code))
  
  // Merge API subjects with fallback, API takes precedence
  const apiCodes = new Set(subjects.value.map(s => s.code))
  const merged = [
    ...subjects.value,
    ...FALLBACK_SUBJECTS.filter(f => !apiCodes.has(f.code))
  ]
  
  return merged.filter((s) => !selectedCodes.has(s.code))
})

function addSubject() {
  if (!newSubjectCode.value) return
  
  localSubjects.value.push({
    code: newSubjectCode.value,
    tags: [],
    custom_direction_text: '',
  })
  
  newSubjectCode.value = ''
  expandedSubjects.value.add(localSubjects.value[localSubjects.value.length - 1].code)
}

function removeSubject(index: number) {
  const code = localSubjects.value[index].code
  localSubjects.value.splice(index, 1)
  expandedSubjects.value.delete(code)
}

function toggleExpanded(code: string) {
  if (expandedSubjects.value.has(code)) {
    expandedSubjects.value.delete(code)
  } else {
    expandedSubjects.value.add(code)
  }
}

function isExpanded(code: string): boolean {
  return expandedSubjects.value.has(code)
}

function getSubjectTitle(code: string): string {
  const subject = subjects.value.find((s) => s.code === code)
  if (subject?.title) return subject.title
  // v0.83.0: Try i18n fallback
  const i18nTitle = t(`marketplace.subjects.${code}`, code)
  return i18nTitle !== code ? i18nTitle : code
}

function getTagLabel(code: string): string {
  const tag = tags.value.find((t) => t.code === code)
  return tag?.label || code
}

function toggleTag(subjectIndex: number, tagCode: string) {
  const subject = localSubjects.value[subjectIndex]
  const tagIndex = subject.tags.indexOf(tagCode)
  
  if (tagIndex >= 0) {
    subject.tags.splice(tagIndex, 1)
  } else {
    subject.tags.push(tagCode)
  }
}

function isTagSelected(subjectIndex: number, tagCode: string): boolean {
  return localSubjects.value[subjectIndex].tags.includes(tagCode)
}

function moveSubject(fromIndex: number, toIndex: number) {
  const item = localSubjects.value.splice(fromIndex, 1)[0]
  localSubjects.value.splice(toIndex, 0, item)
}

function validateCustomText(text: string): string | null {
  if (!text) return null
  if (text.length < 50) return t('marketplace.profile.editor.customTextTooShort')
  if (text.length > 800) return t('marketplace.profile.editor.customTextTooLong')
  return null
}
</script>

<template>
  <div class="subject-tags-selector">
    <div class="add-subject-row">
      <select
        v-model="newSubjectCode"
        :disabled="loading"
        data-test="subject-selector-add"
      >
        <option value="">{{ t('marketplace.profile.editor.selectSubject') }}</option>
        <option
          v-for="subject in availableSubjects"
          :key="subject.code"
          :value="subject.code"
        >
          {{ subject.title }}
        </option>
      </select>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="!newSubjectCode || loading"
        @click="addSubject"
      >
        <Plus :size="16" />
        {{ t('marketplace.profile.editor.add') }}
      </button>
    </div>

    <div v-if="localSubjects.length" class="subjects-list">
      <div
        v-for="(subject, index) in localSubjects"
        :key="subject.code"
        class="subject-item"
        :data-test="`subject-item-${subject.code}`"
      >
        <div class="subject-header">
          <button
            type="button"
            class="drag-handle"
            :title="t('marketplace.profile.editor.dragToReorder')"
          >
            <GripVertical :size="16" />
          </button>
          
          <span class="subject-title">{{ getSubjectTitle(subject.code) }}</span>
          
          <button
            type="button"
            class="btn-icon"
            @click="toggleExpanded(subject.code)"
          >
            <ChevronDown v-if="!isExpanded(subject.code)" :size="16" />
            <ChevronUp v-else :size="16" />
          </button>
          
          <button
            type="button"
            class="btn-icon btn-remove"
            @click="removeSubject(index)"
          >
            <X :size="16" />
          </button>
        </div>

        <div v-if="isExpanded(subject.code)" class="subject-details">
          <div class="tags-section">
            <label>{{ t('marketplace.profile.editor.selectTags') }}</label>
            
            <div
              v-for="group in TAG_GROUPS"
              :key="group"
              class="tag-group"
            >
              <div class="tag-group-label">
                {{ t(`marketplace.tagGroups.${group}`) }}
              </div>
              
              <div class="tag-group-items">
                <label
                  v-for="tag in getTagsByGroup(group)"
                  :key="tag.code"
                  class="tag-checkbox"
                >
                  <input
                    type="checkbox"
                    :checked="isTagSelected(index, tag.code)"
                    @change="toggleTag(index, tag.code)"
                  />
                  <span>{{ tag.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="custom-text-section">
            <label>
              {{ t('marketplace.profile.editor.customDirectionText') }}
              <span class="char-count">
                {{ subject.custom_direction_text.length }} / 800
              </span>
            </label>
            <textarea
              v-model="subject.custom_direction_text"
              :placeholder="t('marketplace.profile.editor.customDirectionTextPlaceholder')"
              rows="4"
              maxlength="800"
              :data-test="`custom-text-${subject.code}`"
              :class="{ 'has-error': validateCustomText(subject.custom_direction_text) || getErrorForField(props.nestedErrorMap || new Map(), 'subjects', index, 'custom_direction_text') }"
            />
            <!-- Client-side validation error -->
            <div
              v-if="validateCustomText(subject.custom_direction_text)"
              class="field-error"
            >
              {{ validateCustomText(subject.custom_direction_text) }}
            </div>
            <!-- Backend validation error -->
            <div
              v-else-if="props.nestedErrorMap && getErrorForField(props.nestedErrorMap, 'subjects', index, 'custom_direction_text')"
              class="field-error"
              :data-test="`custom-text-error-${subject.code}`"
            >
              {{ formatErrorMessages(getErrorForField(props.nestedErrorMap, 'subjects', index, 'custom_direction_text')!.messages) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>{{ t('marketplace.profile.editor.noSubjectsSelected') }}</p>
    </div>

    <div v-if="props.errors?.subjects" class="field-error">
      {{ props.errors.subjects }}
    </div>
  </div>
</template>

<style scoped>
.subject-tags-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.add-subject-row {
  display: flex;
  gap: 0.5rem;
}

.add-subject-row select {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  font-size: 0.875rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--secondary-bg, #f5f5f5);
  color: var(--text-primary, #333);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--secondary-hover, #e0e0e0);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subjects-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.subject-item {
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  padding: 1rem;
  background: var(--bg-secondary, #fafafa);
}

.subject-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.drag-handle {
  cursor: grab;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
}

.drag-handle:active {
  cursor: grabbing;
}

.subject-title {
  flex: 1;
  font-weight: 600;
}

.btn-icon {
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #666);
  display: flex;
  align-items: center;
}

.btn-icon:hover {
  color: var(--text-primary, #333);
}

.btn-remove {
  color: var(--error-color, #dc2626);
}

.subject-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #ddd);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tags-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tags-section > label {
  font-weight: 600;
  font-size: 0.875rem;
}

.tag-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tag-group-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary, #666);
  text-transform: uppercase;
}

.tag-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-primary, #fff);
}

.tag-checkbox:hover {
  background: var(--bg-hover, #f5f5f5);
}

.tag-checkbox input[type="checkbox"] {
  margin: 0;
}

.custom-text-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.custom-text-section label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.char-count {
  font-size: 0.875rem;
  font-weight: normal;
  color: var(--text-secondary, #666);
}

.custom-text-section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.custom-text-section textarea.has-error {
  border-color: var(--color-error, #dc2626);
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary, #666);
  border: 2px dashed var(--border-color, #ddd);
  border-radius: 8px;
}

.field-error {
  color: var(--error-color, #dc2626);
  font-size: 0.875rem;
}
</style>
