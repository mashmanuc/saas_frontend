<script setup lang="ts">
/**
 * SubjectsTab.vue - v0.84.0
 *
 * Вкладка "Предмети" в редакторі профілю тьютора.
 * Включає:
 * - Основні предмети (математика, фізика тощо)
 * - Мови як предмети для вивчення (language_<iso> коди)
 *
 * Source of truth: formData.subjects
 */
import { computed, ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SubjectSelectionPanel from './SubjectSelectionPanel.vue'
import SubjectCardList from './SubjectCardList.vue'
import type { Language, LanguageTag } from '../../api/languages'
import type { SpecialtyTagCatalog } from '../../api/marketplace'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import Button from '@/ui/Button.vue'
import { filterTagsForSubjectSafe } from '../../utils/subjectTagResolver'

// v0.86: Subject tab mode (subjects vs languages as subjects)
type SubjectTabMode = 'subjects' | 'languages'
const STORAGE_KEY = 'marketplace_subject_tab_mode_v1'

interface SubjectOption {
  value: string
  label: string
}

interface SelectedSubject {
  code: string
  tags: string[]
  custom_direction_text: string
}

const props = defineProps<{
  subjectOptions: SubjectOption[]
  allSubjectOptions?: SubjectOption[] // v0.88: dropdown with all other subjects
  languages: Language[]
  subjects: SelectedSubject[]
  subjectTags: LanguageTag[]
  subjectTagCatalog: SpecialtyTagCatalog[]
  languageTags: LanguageTag[]
  getSubjectLabel: (code: string) => string
}>()

// v0.85: Access store for subject tag map
const marketplaceStore = useMarketplaceStore()

const emit = defineEmits<{
  (e: 'select-subject', code: string): void
  (e: 'update:subjects', subjects: SelectedSubject[]): void
}>()

const { t } = useI18n()

// v0.86: Mode selection state with localStorage persistence
const selectedMode = ref<SubjectTabMode>('subjects')
const selectedSubjectCode = ref('')
const selectedLanguageCode = ref('')
const isOtherLanguagesExpanded = ref(false)
const languageSearchQuery = ref('')

// v0.86: Load mode from localStorage on mount
// v0.87: Ensure subject tag map is loaded before rendering tags
onMounted(async () => {
  // Load subject tag map (idempotent, won't reload if already loaded)
  await marketplaceStore.loadFilterOptions()
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'subjects' || stored === 'languages') {
    selectedMode.value = stored
  } else {
    // Smart default: if user has language subjects but no basic subjects, default to languages
    if (languageSubjectCodes.value.length > 0 && basicSubjectCodes.value.length === 0) {
      selectedMode.value = 'languages'
    }
  }
})

// v0.86: Persist mode to localStorage on change
watch(selectedMode, (newMode) => {
  localStorage.setItem(STORAGE_KEY, newMode)
})

// v0.86: Mode switch handler
function handleModeSwitch(mode: SubjectTabMode) {
  selectedMode.value = mode
}

// v0.84.0: Popular learning languages (ISO codes)
// Фіксований список популярних мов для швидкого вибору
const POPULAR_LANGUAGE_CODES = [
  'en', 'de', 'pl', 'fr', 'es', 'it', 'cs', 'sk', 'ro', 'hu',
  'nl', 'pt', 'tr', 'zh', 'ja', 'ko', 'el', 'sv', 'no', 'uk'
] as const

const basicSubjectCodes = computed(() =>
  props.subjects.filter(s => !s.code.startsWith('language_')).map(s => s.code)
)

const languageSubjectCodes = computed(() =>
  props.subjects.filter(s => s.code.startsWith('language_')).map(s => s.code)
)

// v0.84.0: Популярні мови для швидкого вибору
const popularLanguages = computed(() => {
  return props.languages.filter(lang =>
    POPULAR_LANGUAGE_CODES.includes(lang.code as typeof POPULAR_LANGUAGE_CODES[number])
  ).sort((a, b) => {
    const aIdx = POPULAR_LANGUAGE_CODES.indexOf(a.code as typeof POPULAR_LANGUAGE_CODES[number])
    const bIdx = POPULAR_LANGUAGE_CODES.indexOf(b.code as typeof POPULAR_LANGUAGE_CODES[number])
    return aIdx - bIdx
  })
})

// v0.84.0: Інші мови (не популярні) з пошуком
const otherLanguages = computed(() => {
  const popularCodes = new Set(POPULAR_LANGUAGE_CODES)
  let others = props.languages.filter(lang => !popularCodes.has(lang.code as any))

  if (languageSearchQuery.value.trim()) {
    const query = languageSearchQuery.value.toLowerCase().trim()
    others = others.filter(lang =>
      lang.title.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    )
  }

  return others
})

// v0.89: Маппінг ISO кодів мов → subject codes в subject_tag_map.json
const LANGUAGE_ISO_TO_SUBJECT: Record<string, string> = {
  'en': 'english-language',
  'de': 'german-language',
  'pl': 'polish-language',
  'uk': 'ukrainian-language',
  'fr': 'english-language',   // fallback to english-language config
  'es': 'english-language',
  'it': 'english-language',
  'pt': 'english-language',
  'cs': 'english-language',
  'sk': 'english-language',
  'ro': 'english-language',
  'hu': 'english-language',
  'nl': 'english-language',
  'tr': 'english-language',
  'zh': 'english-language',
  'ja': 'english-language',
  'ko': 'english-language',
  'el': 'english-language',
  'sv': 'english-language',
  'no': 'english-language',
}

// v0.87: FAIL-CLOSED - Get available tags for a specific subject
// Returns empty array if map not loaded or subject not configured
// This prevents showing incorrect tags (e.g., language tags for STEM)
function getAvailableTagsForSubject(subjectCode: string): SpecialtyTagCatalog[] {
  const tagMap = marketplaceStore.subjectTagMap

  // v0.89: Resolve language_* codes to *-language subject codes
  let resolvedCode = subjectCode
  if (subjectCode.startsWith('language_')) {
    const isoCode = subjectCode.replace('language_', '')
    resolvedCode = LANGUAGE_ISO_TO_SUBJECT[isoCode] || 'english-language'
  }

  // FAIL-CLOSED: Use safe filter that returns [] if map not ready
  return filterTagsForSubjectSafe(
    resolvedCode,
    props.subjectTagCatalog,
    tagMap
  )
}

// v0.84.0: Розділяємо основні предмети та мови для SubjectCardList
const basicSubjects = computed(() =>
  props.subjects
    .filter(s => !s.code.startsWith('language_'))
    .map(s => ({
      code: s.code,
      title: props.getSubjectLabel(s.code),
      tags: s.tags || [],
      custom_direction_text: s.custom_direction_text || '',
      // v0.87: Pass available tags (FAIL-CLOSED - returns [] if map not ready)
      availableTags: getAvailableTagsForSubject(s.code),
    }))
)

const languageSubjects = computed(() =>
  props.subjects
    .filter(s => s.code.startsWith('language_'))
    .map(s => ({
      code: s.code,
      title: props.getSubjectLabel(s.code),
      level: '',
      tags: s.tags || [],
      description: s.custom_direction_text || '',
      // v0.89: Pass available tags for language subjects (resolved via ISO→subject mapping)
      availableTags: getAvailableTagsForSubject(s.code),
    }))
)

// v0.84.0: Перевірка чи мова вже додана (анти-дубль)
function isLanguageSubjectSelected(langCode: string): boolean {
  return languageSubjectCodes.value.includes(`language_${langCode}`)
}

function handleSelect(code: string) {
  emit('select-subject', code)
}

function handleUpdateSubjects(updated: Array<{ code: string; title: string; tags: string[]; custom_direction_text: string }>) {
  // Оновлюємо тільки основні предмети, зберігаючи мови
  const languages = props.subjects.filter(s => s.code.startsWith('language_'))
  const updatedBasic = updated.map(s => ({
    code: s.code,
    tags: s.tags,
    custom_direction_text: s.custom_direction_text,
  }))
  emit('update:subjects', [...updatedBasic, ...languages])
}

function handleUpdateLanguageSubjects(updated: Array<{ code: string; title: string; level: string; tags: string[]; description: string }>) {
  // Оновлюємо тільки мови, зберігаючи основні предмети
  const basic = props.subjects.filter(s => !s.code.startsWith('language_'))
  const updatedLanguages = updated.map(s => ({
    code: s.code,
    tags: s.tags,
    custom_direction_text: s.description,
  }))
  emit('update:subjects', [...basic, ...updatedLanguages])
}

function handleAddSubjectFromSelect() {
  if (!selectedSubjectCode.value) return
  handleSelect(selectedSubjectCode.value)
  selectedSubjectCode.value = ''
}

// v0.84.0: Toggle language chip (add/remove)
function handleTogglePopularLanguage(langCode: string) {
  const subjectCode = `language_${langCode}`
  if (isLanguageSubjectSelected(langCode)) {
    // Remove language from subjects
    const updated = props.subjects.filter(s => s.code !== subjectCode)
    emit('update:subjects', updated)
  } else {
    // Add language to subjects
    handleSelect(subjectCode)
  }
}
</script>

<template>
  <div class="subjects-tab" data-test="subjects-tab">
    <!-- v0.86: Mode selector -->
    <section class="mode-selector-section" aria-labelledby="mode-selector-title">
      <h3 id="mode-selector-title">{{ t('marketplace.subjects.modeSelector.title') }}</h3>
      
      <div class="mode-selector" role="radiogroup" :aria-label="t('marketplace.subjects.modeSelector.title')">
        <button
          type="button"
          class="mode-option"
          :class="{ 'is-active': selectedMode === 'subjects' }"
          role="radio"
          :aria-checked="selectedMode === 'subjects'"
          @click="handleModeSwitch('subjects')"
        >
          {{ t('marketplace.subjects.modeSelector.subjects') }}
        </button>
        <button
          type="button"
          class="mode-option"
          :class="{ 'is-active': selectedMode === 'languages' }"
          role="radio"
          :aria-checked="selectedMode === 'languages'"
          @click="handleModeSwitch('languages')"
        >
          {{ t('marketplace.subjects.modeSelector.languagesAsSubjects') }}
        </button>
      </div>
      
      <p class="mode-hint">
        {{ t('marketplace.subjects.modeSelector.teachingLanguageHint') }}
      </p>
    </section>

    <!-- Секція 1: Основні предмети (показується тільки в режимі 'subjects') -->
    <section v-if="selectedMode === 'subjects'" class="subject-selection-area" aria-labelledby="basic-subjects-title">
      <h3 id="basic-subjects-title">{{ t('marketplace.subjects.basicSubjectsTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.basicSubjectsHint') }}</p>

      <div class="subject-picker-row">
        <select
          v-model="selectedSubjectCode"
          class="subject-select"
        >
          <option value="">{{ t('marketplace.profile.editor.selectSubject') }}</option>
          <option
            v-for="option in (allSubjectOptions && allSubjectOptions.length > 0 ? allSubjectOptions : subjectOptions)"
            :key="option.value"
            :value="option.value"
            :disabled="basicSubjectCodes.includes(option.value)"
          >
            {{ option.label }}
          </option>
        </select>
        <Button
          variant="secondary"
          :disabled="!selectedSubjectCode || basicSubjectCodes.includes(selectedSubjectCode)"
          @click="handleAddSubjectFromSelect"
        >
          {{ t('marketplace.profile.editor.add') }}
        </Button>
      </div>

      <SubjectSelectionPanel
        :subjects="subjectOptions.map(o => ({ code: o.value, title: o.label, is_popular: true }))"
        :languages="[]"
        :selected-subjects="basicSubjectCodes"
        :selected-languages="[]"
        :show-languages="false"
        @select-subject="handleSelect"
        @select-language="() => {}"
      />
    </section>

    <!-- Секція 2: Мови для вивчення (показується тільки в режимі 'languages') -->
    <section v-if="selectedMode === 'languages'" class="subject-selection-area language-subjects-area" aria-labelledby="language-subjects-title">
      <h3 id="language-subjects-title">{{ t('marketplace.subjects.languagesAsSubjectsTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.languagesAsSubjectsHint') }}</p>

      <!-- v0.84.0: Popular languages chips для швидкого вибору (toggle-логіка) -->
      <div class="popular-languages-chips" role="group" :aria-label="t('marketplace.subjects.popularLanguagesTitle')">
        <button
          v-for="lang in popularLanguages"
          :key="lang.code"
          type="button"
          class="chip"
          :class="{
            'is-selected': isLanguageSubjectSelected(lang.code),
          }"
          :aria-pressed="isLanguageSubjectSelected(lang.code)"
          :aria-label="`${lang.title}${isLanguageSubjectSelected(lang.code) ? ' - ' + t('common.selected') : ''}`"
          @click="handleTogglePopularLanguage(lang.code)"
        >
          {{ lang.title }}
          <span v-if="isLanguageSubjectSelected(lang.code)" class="chip-check" aria-hidden="true">✓</span>
        </button>
      </div>

      <!-- v0.84.0: Collapsible section for other languages -->
      <div class="other-languages-section">
        <button
          type="button"
          class="category-toggle"
          :aria-expanded="isOtherLanguagesExpanded"
          @click="isOtherLanguagesExpanded = !isOtherLanguagesExpanded"
        >
          <span class="toggle-icon" aria-hidden="true">{{ isOtherLanguagesExpanded ? '▼' : '▶' }}</span>
          <span>{{ t('marketplace.subjects.otherLanguagesTitle') }}</span>
          <span class="other-count">({{ otherLanguages.length }})</span>
        </button>

        <div v-show="isOtherLanguagesExpanded" class="collapsible-content">
          <input
            v-model="languageSearchQuery"
            type="text"
            :placeholder="t('marketplace.languages.searchPlaceholder')"
            class="language-search"
            :aria-label="t('marketplace.languages.searchPlaceholder')"
          />
          <div class="language-list" role="listbox">
            <button
              v-for="lang in otherLanguages"
              :key="lang.code"
              type="button"
              role="option"
              class="language-item"
              :class="{ 'is-selected': isLanguageSubjectSelected(lang.code) }"
              :aria-selected="isLanguageSubjectSelected(lang.code)"
              @click="handleTogglePopularLanguage(lang.code)"
            >
              {{ lang.title }}
              <span v-if="isLanguageSubjectSelected(lang.code)" class="item-check" aria-hidden="true">✓</span>
            </button>
            <p v-if="otherLanguages.length === 0 && languageSearchQuery" class="no-results">
              {{ t('common.noResults') || 'Нічого не знайдено' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Секція 3: Обрані предмети з картками і тегами -->
    <section v-if="subjects.length > 0" class="selected-subjects-area" aria-labelledby="selected-subjects-title">
      <h3 id="selected-subjects-title">{{ t('marketplace.subjects.selectedTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.selectedHint') || 'Налаштуйте теги та опис для кожного предмету' }}</p>

      <SubjectCardList
        :subjects="basicSubjects"
        :languages="languageSubjects"
        :subject-tags="subjectTags"
        :subject-tag-catalog="subjectTagCatalog"
        :language-tags="languageTags"
        @update:subjects="handleUpdateSubjects"
        @update:languages="handleUpdateLanguageSubjects"
      />
    </section>

    <!-- Empty state -->
    <div v-if="subjects.length === 0" class="empty-state" role="status">
      <p>{{ t('marketplace.subjects.emptyState') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* v0.84.0: SubjectsTab - redesigned UX */
/* v0.86: Added mode selector */
.subjects-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* v0.86: Mode selector section */
.mode-selector-section {
  margin-bottom: var(--space-lg);
}

.mode-selector-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

.mode-selector {
  display: inline-flex;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-card);
  margin-bottom: var(--space-sm);
}

.mode-option {
  padding: 0.625rem 1.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.mode-option:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 25%;
  height: 50%;
  width: 1px;
  background: var(--border-color);
}

.mode-option:hover {
  background: var(--surface-card-muted);
}

.mode-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  z-index: 1;
}

.mode-option.is-active {
  background: var(--accent);
  color: white;
  font-weight: 600;
}

.mode-option.is-active::after {
  display: none;
}

.mode-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: var(--space-sm);
}

.subject-selection-area {
  margin-bottom: var(--space-lg);
}

.subject-selection-area h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.section-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
}

.subject-picker-row {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.subject-picker-row select {
  flex: 1;
  min-width: 220px;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  background: var(--surface-base);
}

.subject-picker-row button {
  white-space: nowrap;
}

/* v0.84.0: Popular languages chips */
.popular-languages-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

/* Chip стилі — використовуються глобальні .chip з main.css */

.chip-check,
.item-check {
  font-size: 0.75rem;
  font-weight: 600;
}

/* v0.84.0: Other languages collapsible section */
.other-languages-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  overflow: hidden;
}

.category-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md);
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: background 0.2s;
}

.category-toggle:hover {
  background: var(--surface-card-muted);
}

.toggle-icon {
  font-size: 0.75rem;
  color: var(--text-muted);
  width: 1rem;
  text-align: center;
}

.other-count {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 400;
}

.collapsible-content {
  padding: 0 var(--space-md) var(--space-md);
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.language-search {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  margin-bottom: var(--space-md);
}

.language-search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.language-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 250px;
  overflow-y: auto;
}

.language-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.language-item:hover {
  background: var(--surface-card-muted);
}

.language-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.language-item.is-selected {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 500;
}

.no-results {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-style: italic;
}

/* Selected subjects area */
.selected-subjects-area {
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 2px solid var(--border-color);
}

.selected-subjects-area h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

/* Empty state */
.empty-state {
  padding: var(--space-xl);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9375rem;
  background: var(--surface-card-muted);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
}

/* Responsive */
@media (max-width: 640px) {
  .subject-picker-row {
    flex-direction: column;
  }

  .subject-picker-row select {
    min-width: 100%;
  }

  .popular-languages-chips {
    gap: 0.4rem;
  }

  .chip {
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
  }
}
</style>
