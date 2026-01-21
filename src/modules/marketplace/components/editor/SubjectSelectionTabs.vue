<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SubjectSelectionPanel from './SubjectSelectionPanel.vue'
import SubjectCardList from './SubjectCardList.vue'
import type { Language } from '../../api/languages'
import type { LanguageTag } from '../../api/languages'

interface SubjectOption {
  value: string
  label: string
}

interface SelectedSubjectEntry {
  code: string
  tags: string[]
  custom_direction_text: string
}

const props = defineProps<{
  subjectOptions: SubjectOption[]
  languages: Language[]
  subjects: SelectedSubjectEntry[]
  subjectTags: LanguageTag[]
  getSubjectLabel: (code: string) => string
}>()

const emit = defineEmits<{
  (e: 'select-subject', code: string): void
  (e: 'update:subjects', subjects: SelectedSubjectEntry[]): void
}>()

const { t } = useI18n()

const basicSubjectCodes = computed(() => props.subjects.filter((s) => !s.code.startsWith('language_')).map((s) => s.code))
const languageSubjectCodes = computed(() => props.subjects.filter((s) => s.code.startsWith('language_')).map((s) => s.code))

function handleSelect(code: string) {
  emit('select-subject', code)
}

function handleUpdateSubjects(updated: Array<{ code: string; title: string; tags: string[]; custom_direction_text: string }>) {
  emit(
    'update:subjects',
    updated.map((s) => ({
      code: s.code,
      tags: s.tags,
      custom_direction_text: s.custom_direction_text,
    }))
  )
}

const mappedSubjects = computed(() =>
  props.subjects.map((s) => ({
    code: s.code,
    title: props.getSubjectLabel(s.code),
    tags: s.tags || [],
    custom_direction_text: s.custom_direction_text || '',
  }))
)
</script>

<template>
  <div class="subject-selection-tabs">
    <div class="subject-selection-area">
      <h3>{{ t('marketplace.subjects.basicSubjectsTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.basicSubjectsHint') }}</p>

      <SubjectSelectionPanel
        :subjects="subjectOptions.map((o) => ({ code: o.value, title: o.label, is_popular: true }))"
        :languages="[]"
        :selected-subjects="basicSubjectCodes"
        :selected-languages="[]"
        @select-subject="handleSelect"
        @select-language="() => {}"
      />
    </div>

    <div class="subject-selection-area">
      <h3>{{ t('marketplace.subjects.popularLanguagesTitle') }}</h3>
      <p class="section-hint">{{ t('marketplace.subjects.popularLanguagesHint') }}</p>

      <SubjectSelectionPanel
        :subjects="[]"
        :languages="languages"
        :selected-subjects="languageSubjectCodes"
        :selected-languages="[]"
        @select-subject="handleSelect"
        @select-language="() => {}"
      />
    </div>

    <div v-if="subjects.length > 0" class="selected-subjects-area">
      <h3>{{ t('marketplace.subjects.selectedTitle') }}</h3>

      <SubjectCardList
        :subjects="mappedSubjects"
        :languages="[]"
        :subject-tags="subjectTags"
        :language-tags="[]"
        @update:subjects="handleUpdateSubjects"
        @update:languages="() => {}"
      />
    </div>
  </div>
</template>

<style scoped>
.subject-selection-tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.subject-selection-area {
  margin-bottom: var(--space-lg);
}

.selected-subjects-area {
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 2px solid var(--border-color);
}
</style>
