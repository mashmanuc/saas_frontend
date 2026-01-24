<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Language } from '../../api/languages'

interface Subject {
  code: string
  title: string
  is_popular?: boolean
  category?: string
}

interface Props {
  subjects: Subject[]
  languages: Language[]
  selectedSubjects: string[]
  selectedLanguages: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select-subject', code: string): void
  (e: 'select-language', code: string): void
}>()

const { t } = useI18n()

const searchQuery = ref('')
const isOtherLanguagesExpanded = ref(false)

// Популярні предмети (не мови)
const popularSubjects = computed(() => 
  props.subjects.filter(s => s.is_popular && s.category !== 'languages').slice(0, 12)
)

// Популярні європейські мови (як предмети)
const popularLanguageSubjects = computed(() =>
  props.languages.filter(l => l.is_popular).slice(0, 15)
)

// Інші мови (непопулярні)
const otherLanguageSubjects = computed(() => {
  const others = props.languages.filter(l => !l.is_popular)
  
  if (!searchQuery.value) return others
  
  const query = searchQuery.value.toLowerCase()
  return others.filter(l => 
    l.title.toLowerCase().includes(query) || 
    l.code.toLowerCase().includes(query)
  )
})

function handleSelectSubject(code: string) {
  emit('select-subject', code)
}

function handleSelectLanguageSubject(code: string) {
  // Мови як предмети також емітимо через select-subject
  emit('select-subject', `language_${code}`)
}
</script>

<template>
  <div class="subject-selection-panel" data-test="subject-selection-panel">
    <!-- Предмети -->
    <section class="selection-section">
      <h3>{{ t('marketplace.subjects.title') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.basicSubjectsHint') }}</p>
      
      <!-- Популярні предмети (чіпси) -->
      <h4 class="subsection-title">{{ t('marketplace.subjects.popularSubjectsTitle') }}</h4>
      <div class="subject-grid">
        <button
          v-for="subject in popularSubjects"
          :key="subject.code"
          type="button"
          class="subject-chip"
          :class="{ 'is-selected': selectedSubjects.includes(subject.code) }"
          @click="handleSelectSubject(subject.code)"
        >
          {{ subject.title }}
        </button>
      </div>
      
    </section>

    <!-- Мови для вивчення -->
    <section v-if="languages.length > 0" class="selection-section">
      <h3>{{ t('marketplace.subjects.languagesAsSubjectsTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.popularLanguagesHint') }}</p>
      
      <!-- Популярні мови (чіпси) -->
      <h4 class="subsection-title">{{ t('marketplace.subjects.popularLanguagesTitle') }}</h4>
      <div class="language-chips">
        <button
          v-for="lang in popularLanguageSubjects"
          :key="lang.code"
          type="button"
          class="language-chip"
          :class="{ 'is-selected': selectedSubjects.includes(`language_${lang.code}`) }"
          @click="handleSelectLanguageSubject(lang.code)"
        >
          {{ lang.title }}
        </button>
      </div>
      
      <!-- Інші мови (collapsible) -->
      <div class="other-items-section">
        <button
          type="button"
          class="category-toggle"
          @click="isOtherLanguagesExpanded = !isOtherLanguagesExpanded"
        >
          <span class="toggle-icon">{{ isOtherLanguagesExpanded ? '▼' : '▶' }}</span>
          <span class="toggle-text">{{ t('marketplace.subjects.otherLanguagesTitle') }}</span>
        </button>
        
        <div v-show="isOtherLanguagesExpanded" class="collapsible-content">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('marketplace.languages.searchPlaceholder')"
            class="search-input"
          />
          <div class="items-list">
            <button
              v-for="lang in otherLanguageSubjects"
              :key="lang.code"
              type="button"
              class="list-item"
              :class="{ 'is-selected': selectedSubjects.includes(`language_${lang.code}`) }"
              @click="handleSelectLanguageSubject(lang.code)"
            >
              {{ lang.title }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.subject-selection-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.selection-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

.subject-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-sm);
}

.subject-chip,
.language-chip {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.subject-chip:hover,
.language-chip:hover {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}

.subject-chip.is-selected,
.language-chip.is-selected {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: white;
}

.language-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.category-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.toggle-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.toggle-icon {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.collapsible-content {
  margin-top: var(--space-md);
}

.section-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
}

.subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
  margin-top: var(--space-md);
}
</style>
