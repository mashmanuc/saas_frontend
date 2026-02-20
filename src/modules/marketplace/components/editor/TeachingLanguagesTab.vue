<script setup lang="ts">
/**
 * TeachingLanguagesTab.vue - v0.84.0
 *
 * Вкладка "Мова викладання" в редакторі профілю тьютора.
 * Тут тьютор обирає мови, ЯКИМИ ВІН ВИКЛАДАЄ (не мови як предмети).
 *
 * Source of truth: formData.teaching_languages
 * Рівні: basic, conversational, fluent, native
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Language } from '../../api/languages'
import type { LanguageLevel } from '../../api/marketplace'
import Button from '@/ui/Button.vue'

interface TeachingLanguage {
  code: string
  level: LanguageLevel
}

const props = defineProps<{
  languages: Language[]
  teachingLanguages: TeachingLanguage[]
  languageLevels: Array<{ value: LanguageLevel; label: string }>
  newLanguageCode: string
  newLanguageLevel: LanguageLevel
  getLanguageTitle: (code: string) => string
  errors?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'update:newLanguageCode', value: string): void
  (e: 'update:newLanguageLevel', value: LanguageLevel): void
  (e: 'add-language'): void
  (e: 'remove-language', code: string): void
  (e: 'update-language-level', code: string, level: LanguageLevel): void
}>()

const { t } = useI18n()

const languageSearchQuery = ref('')

// v0.84.0: Фільтрований список мов з пошуком
const filteredLanguages = computed(() => {
  if (!languageSearchQuery.value.trim()) {
    return props.languages
  }
  const query = languageSearchQuery.value.toLowerCase().trim()
  return props.languages.filter(lang =>
    lang.title.toLowerCase().includes(query) ||
    lang.code.toLowerCase().includes(query)
  )
})

// v0.84.0: Перевірка чи мова вже додана (анти-дубль)
function isLanguageAlreadyAdded(code: string): boolean {
  return props.teachingLanguages.some(tl => tl.code === code)
}

// v0.84.0: Список доступних мов (без вже доданих)
const availableLanguages = computed(() =>
  filteredLanguages.value.filter(lang => !isLanguageAlreadyAdded(lang.code))
)

function handleAddLanguage() {
  emit('add-language')
  languageSearchQuery.value = ''
}

function handleRemoveLanguage(code: string) {
  emit('remove-language', code)
}

function handleUpdateLevel(code: string, level: LanguageLevel) {
  emit('update-language-level', code, level)
}

// v0.84.0: Quick add language від пошуку
function handleQuickAddLanguage(langCode: string) {
  if (isLanguageAlreadyAdded(langCode)) return
  emit('update:newLanguageCode', langCode)
  // Emit add-language after code is set
  setTimeout(() => {
    emit('add-language')
    languageSearchQuery.value = ''
  }, 0)
}
</script>

<template>
  <div class="teaching-languages-tab" data-test="teaching-languages-tab">
    <!-- Секція додавання нової мови -->
    <section class="add-language-section" aria-labelledby="add-language-title">
      <h4 id="add-language-title" class="section-title">
        {{ t('marketplace.profile.editor.addTeachingLanguage') || 'Додати мову викладання' }}
      </h4>

      <!-- Search & Select -->
      <div class="language-selector-row">
        <div class="language-select-wrapper">
          <input
            v-model="languageSearchQuery"
            type="text"
            :placeholder="t('marketplace.languages.searchPlaceholder')"
            class="language-search-input"
            :aria-label="t('marketplace.languages.searchPlaceholder')"
          />
          <select
            :value="newLanguageCode"
            class="language-select"
            :aria-label="t('marketplace.profile.editor.selectLanguage')"
            @change="emit('update:newLanguageCode', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('marketplace.profile.editor.selectLanguage') }}</option>
            <option
              v-for="lang in availableLanguages"
              :key="lang.code"
              :value="lang.code"
            >
              {{ lang.title }}
            </option>
          </select>
        </div>

        <select
          :value="newLanguageLevel"
          class="level-select"
          :aria-label="t('marketplace.profile.editor.selectLevel') || 'Оберіть рівень'"
          @change="emit('update:newLanguageLevel', ($event.target as HTMLSelectElement).value as LanguageLevel)"
        >
          <option v-for="level in languageLevels" :key="level.value" :value="level.value">
            {{ level.label }}
          </option>
        </select>

        <Button
          variant="primary"
          class="add-btn"
          :disabled="!newLanguageCode || isLanguageAlreadyAdded(newLanguageCode)"
          @click="handleAddLanguage"
        >
          {{ t('marketplace.profile.editor.add') }}
        </Button>
      </div>

      <!-- Hint text -->
      <p class="hint-text">
        {{ t('marketplace.profile.editor.teachingLanguagesAddHint') || 'Оберіть мови, якими ви проводите уроки, та ваш рівень володіння' }}
      </p>
    </section>

    <!-- Список доданих мов викладання -->
    <section v-if="teachingLanguages.length > 0" class="teaching-languages-list-section" aria-labelledby="teaching-languages-list-title">
      <h4 id="teaching-languages-list-title" class="section-title">
        {{ t('marketplace.profile.editor.yourTeachingLanguages') || 'Ваші мови викладання' }}
        <span class="count-badge">{{ teachingLanguages.length }}</span>
      </h4>

      <ul class="teaching-languages-list" role="list">
        <li
          v-for="tl in teachingLanguages"
          :key="tl.code"
          class="teaching-language-item"
          role="listitem"
        >
          <span class="language-name">{{ getLanguageTitle(tl.code) }}</span>

          <select
            :value="tl.level"
            class="level-select-inline"
            :aria-label="`${t('marketplace.profile.editor.levelFor') || 'Рівень для'} ${getLanguageTitle(tl.code)}`"
            @change="handleUpdateLevel(tl.code, ($event.target as HTMLSelectElement).value as LanguageLevel)"
          >
            <option v-for="level in languageLevels" :key="level.value" :value="level.value">
              {{ level.label }}
            </option>
          </select>

          <Button
            variant="ghost"
            class="btn-remove"
            :aria-label="`${t('marketplace.profile.editor.remove')} ${getLanguageTitle(tl.code)}`"
            @click="handleRemoveLanguage(tl.code)"
          >
            <span aria-hidden="true">✕</span>
            <span class="visually-hidden">{{ t('marketplace.profile.editor.remove') }}</span>
          </Button>
        </li>
      </ul>
    </section>

    <!-- Empty state -->
    <div v-else class="empty-state" role="status">
      <p>{{ t('marketplace.profile.editor.noTeachingLanguages') || 'Ви ще не додали мови викладання' }}</p>
      <p class="empty-hint">{{ t('marketplace.profile.editor.noTeachingLanguagesHint') || 'Додайте хоча б одну мову, якою ви проводите уроки' }}</p>
    </div>

    <!-- Validation error -->
    <div v-if="errors?.teaching_languages" class="field-error" role="alert">
      {{ errors.teaching_languages }}
    </div>
  </div>
</template>

<style scoped>
/* v0.84.0: TeachingLanguagesTab - redesigned UX */
.teaching-languages-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Add language section */
.add-language-section {
  padding: var(--space-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
}

.language-selector-row {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-sm);
}

.language-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex: 2;
  min-width: 200px;
}

.language-search-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
}

.language-search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.language-select,
.level-select {
  flex: 1;
  min-width: 150px;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  background: var(--surface-base);
}

.language-select:focus,
.level-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.add-btn {
  white-space: nowrap;
  align-self: flex-end;
}

.hint-text {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
}

/* Teaching languages list */
.teaching-languages-list-section {
  padding: var(--space-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
}

.teaching-languages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.teaching-language-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-base);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.teaching-language-item:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.language-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.level-select-inline {
  min-width: 140px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  background: var(--surface-card);
}

.level-select-inline:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-remove {
  padding: 0.4rem 0.6rem;
  color: var(--text-muted);
  transition: color 0.2s;
}

.btn-remove:hover {
  color: var(--danger);
}

/* Empty state */
.empty-state {
  padding: var(--space-xl);
  text-align: center;
  color: var(--text-muted);
  background: var(--surface-card-muted);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
}

.empty-state p {
  margin: 0;
}

.empty-state p:first-child {
  font-size: 0.9375rem;
  font-weight: 500;
  margin-bottom: var(--space-xs);
}

.empty-hint {
  font-size: 0.8125rem;
}

/* Field error */
.field-error {
  padding: var(--space-sm) var(--space-md);
  background: var(--error-bg, #fef2f2);
  color: var(--error-text, #dc2626);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

/* Accessibility */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .language-selector-row {
    flex-direction: column;
  }

  .language-select-wrapper,
  .level-select {
    min-width: 100%;
  }

  .add-btn {
    width: 100%;
  }

  .teaching-language-item {
    flex-wrap: wrap;
  }

  .language-name {
    flex: 1 1 100%;
    margin-bottom: var(--space-sm);
  }

  .level-select-inline {
    flex: 1;
  }
}
</style>
