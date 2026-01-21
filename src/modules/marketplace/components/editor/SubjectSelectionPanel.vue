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

// Основні предмети (не мови)
const basicSubjects = computed(() => 
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
    <!-- Основні предмети (математика, фізика тощо) -->
    <section class="selection-section">
      <h3>{{ t('marketplace.subjects.basicTitle') }}</h3>
      <div class="subject-grid">
        <button
          v-for="subject in basicSubjects"
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

    <!-- Популярні європейські мови (як предмети викладання) -->
    <section class="selection-section">
      <h3>{{ t('marketplace.subjects.popularLanguagesTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.popularLanguagesHint') }}</p>
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
    </section>

    <!-- Інші мови (collapsible) -->
    <section class="selection-section">
      <button
        type="button"
        class="category-toggle"
        @click="isOtherLanguagesExpanded = !isOtherLanguagesExpanded"
      >
        <span class="toggle-icon">{{ isOtherLanguagesExpanded ? '▼' : '▶' }}</span>
        <h3>{{ t('marketplace.subjects.otherLanguagesTitle') }}</h3>
      </button>
      
      <div v-show="isOtherLanguagesExpanded" class="collapsible-content">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('marketplace.languages.searchPlaceholder')"
          class="language-search"
        />
        <div class="language-list">
          <button
            v-for="lang in otherLanguageSubjects"
            :key="lang.code"
            type="button"
            class="language-item"
            :class="{ 'is-selected': selectedSubjects.includes(`language_${lang.code}`) }"
            @click="handleSelectLanguageSubject(lang.code)"
          >
            {{ lang.title }}
          </button>
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

.language-search {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  margin-bottom: var(--space-md);
}

.language-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 300px;
  overflow-y: auto;
}

.language-item {
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.language-item:hover {
  background: var(--surface-card-muted);
}

.language-item.is-selected {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
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

.category-toggle h3 {
  margin: 0;
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
</style>
