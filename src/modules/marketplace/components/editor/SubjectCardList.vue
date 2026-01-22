<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TabbedCard from './TabbedCard.vue'
import type { LanguageTag } from '../../api/languages'
import type { SpecialtyTagCatalog } from '../../api/marketplace'

interface SubjectCard {
  code: string
  title: string
  tags: string[]
  custom_direction_text: string
  availableTags?: SpecialtyTagCatalog[]
}

interface LanguageCard {
  code: string
  title: string
  level: string
  tags: string[]
  description: string
}

interface Props {
  subjects: SubjectCard[]
  languages: LanguageCard[]
  subjectTagCatalog: SpecialtyTagCatalog[]
  languageTags: LanguageTag[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:subjects', value: SubjectCard[]): void
  (e: 'update:languages', value: LanguageCard[]): void
}>()

const { t } = useI18n()

const SUBJECT_GROUP_TO_TAB: Record<string, string> = {
  grades: 'class',
  exams: 'exam',
  goals: 'goal',
  formats: 'format',
  audience: 'audience',
}

const subjectTags = computed<LanguageTag[]>(() =>
  props.subjectTagCatalog.map((tag) => ({
    code: tag.code,
    title: tag.label,
    category: (SUBJECT_GROUP_TO_TAB[tag.group] ?? tag.group) as LanguageTag['category'],
    order: tag.sort_order ?? 0,
  }))
)

const subjectTabs = computed(() => [
  { id: 'class', title: t('marketplace.subjects.tabs.classes') },
  { id: 'exam', title: t('marketplace.subjects.tabs.exams') },
  { id: 'goal', title: t('marketplace.subjects.tabs.goals') },
  { id: 'format', title: t('marketplace.subjects.tabs.format') },
  { id: 'audience', title: t('marketplace.subjects.tabs.audience') },
  { id: 'description', title: t('marketplace.subjects.tabs.description') },
])

const languageTabs = computed(() => [
  { id: 'level', title: t('marketplace.languages.tabs.level') },
  { id: 'format', title: t('marketplace.languages.tabs.format') },
  { id: 'goal', title: t('marketplace.languages.tabs.goals') },
  { id: 'audience', title: t('marketplace.languages.tabs.audience') },
  { id: 'description', title: t('marketplace.languages.tabs.description') },
])

function handleToggleSubjectTag(subjectCode: string, tagCode: string) {
  const updated = props.subjects.map(s => {
    if (s.code !== subjectCode) return s
    
    const tags = s.tags.includes(tagCode)
      ? s.tags.filter(t => t !== tagCode)
      : [...s.tags, tagCode]
    
    return { ...s, tags }
  })
  
  emit('update:subjects', updated)
}

function handleUpdateSubjectDescription(subjectCode: string, description: string) {
  const updated = props.subjects.map(s => 
    s.code === subjectCode 
      ? { ...s, custom_direction_text: description }
      : s
  )
  
  emit('update:subjects', updated)
}

function handleRemoveSubject(subjectCode: string) {
  const updated = props.subjects.filter(s => s.code !== subjectCode)
  emit('update:subjects', updated)
}

function handleToggleLanguageTag(languageCode: string, tagCode: string) {
  const updated = props.languages.map(l => {
    if (l.code !== languageCode) return l
    
    const tags = l.tags.includes(tagCode)
      ? l.tags.filter(t => t !== tagCode)
      : [...l.tags, tagCode]
    
    return { ...l, tags }
  })
  
  emit('update:languages', updated)
}

function handleUpdateLanguageDescription(languageCode: string, description: string) {
  const updated = props.languages.map(l => 
    l.code === languageCode 
      ? { ...l, description }
      : l
  )
  
  emit('update:languages', updated)
}

function handleRemoveLanguage(languageCode: string) {
  const updated = props.languages.filter(l => l.code !== languageCode)
  emit('update:languages', updated)
}
</script>

<template>
  <div class="subject-card-list">
    <section v-if="subjects.length > 0" class="card-section">
      <h3>{{ t('marketplace.subjects.selectedTitle') }}</h3>
      <TabbedCard
        v-for="subject in subjects"
        :key="subject.code"
        :title="subject.title"
        :tabs="subjectTabs"
        :tags="subjectTags"
        :available-tags="subject.availableTags"
        :selected-tags="subject.tags"
        :description="subject.custom_direction_text"
        type="subject"
        @toggle-tag="(code) => handleToggleSubjectTag(subject.code, code)"
        @update:description="(desc) => handleUpdateSubjectDescription(subject.code, desc)"
        @remove="handleRemoveSubject(subject.code)"
      />
      <p v-if="subjects.length === 0" class="empty-state">
        {{ t('marketplace.subjects.emptyState') }}
      </p>
    </section>

    <section v-if="languages.length > 0" class="card-section">
      <h3>{{ t('marketplace.languages.selectedTitle') }}</h3>
      <TabbedCard
        v-for="language in languages"
        :key="language.code"
        :title="`${language.title} (${language.level || t('marketplace.languages.levelNotSet')})`"
        :tabs="languageTabs"
        :tags="languageTags"
        :selected-tags="language.tags"
        :description="language.description"
        type="language"
        @toggle-tag="(code) => handleToggleLanguageTag(language.code, code)"
        @update:description="(desc) => handleUpdateLanguageDescription(language.code, desc)"
        @remove="handleRemoveLanguage(language.code)"
      />
      <p v-if="languages.length === 0" class="empty-state">
        {{ t('marketplace.languages.emptyState') }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.subject-card-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.card-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

.empty-state {
  padding: var(--space-lg);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-style: italic;
  background: var(--surface-card-muted);
  border-radius: var(--radius-md);
}
</style>
