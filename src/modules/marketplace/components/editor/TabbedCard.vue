<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LanguageTag } from '../../api/languages'
import type { SpecialtyTagCatalog } from '../../api/marketplace'

interface Tab {
  id: string
  title: string
}

interface Props {
  title: string
  tabs: Tab[]
  tags: LanguageTag[]
  availableTags?: SpecialtyTagCatalog[]
  selectedTags: string[]
  description: string
  type: 'subject' | 'language'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle-tag', code: string): void
  (e: 'update:description', value: string): void
  (e: 'remove'): void
}>()

const { t } = useI18n()
const activeTab = ref(props.tabs[0]?.id || '')
const isExpanded = ref(true)

const tagsForCurrentTab = computed(() => {
  if (activeTab.value === 'description') return []
  
  // If availableTags is provided (for subjects with tag map), use it
  if (props.availableTags !== undefined) {
    const availableCodes = new Set(props.availableTags.map(t => t.code))
    return props.tags.filter(tag => 
      tag.category === activeTab.value && availableCodes.has(tag.code)
    )
  }
  
  // Otherwise use all tags (for languages or backward compatibility)
  return props.tags.filter(tag => tag.category === activeTab.value)
})

const hasTagMapConfiguration = computed(() => {
  // If availableTags is explicitly provided and is empty array, subject has no tag map config
  return props.availableTags === undefined || props.availableTags.length > 0
})

const showTagMapWarning = computed(() => {
  return props.availableTags !== undefined &&
         props.availableTags.length === 0 &&
         activeTab.value !== 'description'
})

function handleToggleTag(code: string) {
  emit('toggle-tag', code)
}

function handleDescriptionChange(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:description', target.value)
}
</script>

<template>
  <div class="tabbed-card">
    <div class="card-header">
      <button
        type="button"
        class="expand-toggle"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? '▼' : '▶' }}
      </button>
      <h4>{{ title }}</h4>
      <button
        type="button"
        class="btn-remove"
        @click="emit('remove')"
      >
        ✕
      </button>
    </div>

    <div v-show="isExpanded" class="card-body">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="tab"
          :class="{ 'is-active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.title }}
        </button>
      </div>

      <div v-if="activeTab !== 'description'" class="tag-grid">
        <!-- Warning: Subject has no tag map configuration -->
        <div v-if="showTagMapWarning" class="tag-map-warning" role="alert">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <strong>{{ t('marketplace.editor.tagMapNotConfigured') || 'Теги не налаштовані' }}</strong>
            <p>{{ t('marketplace.editor.tagMapNotConfiguredHint') || 'Для цього предмета ще не налаштовано список доступних тегів. Ви можете заповнити опис у вкладці "Опис".' }}</p>
          </div>
        </div>
        
        <!-- Tags grid (only if tags available) -->
        <template v-else>
          <button
            v-for="tag in tagsForCurrentTab"
            :key="tag.code"
            type="button"
            class="chip"
            :class="{ 'is-active': selectedTags.includes(tag.code) }"
            @click="handleToggleTag(tag.code)"
          >
            {{ tag.title }}
          </button>
          <p v-if="tagsForCurrentTab.length === 0" class="empty-state">
            {{ t('marketplace.editor.noTagsAvailable') }}
          </p>
        </template>
      </div>

      <div v-else class="description-section">
        <textarea
          :value="description"
          :placeholder="type === 'subject' 
            ? t('marketplace.subjects.descriptionPlaceholder') 
            : t('marketplace.languages.descriptionPlaceholder')"
          maxlength="800"
          rows="4"
          class="description-textarea"
          @input="handleDescriptionChange"
        />
        <span class="char-count">{{ description.length }}/800</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabbed-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.card-header h4 {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.expand-toggle,
.btn-remove {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
}

.expand-toggle:hover,
.btn-remove:hover {
  color: var(--text-primary);
}

.btn-remove:hover {
  color: var(--danger);
}

.card-body {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.is-active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  min-height: 60px;
}

/* Chip стилі — використовуються глобальні .chip з main.css */

.tag-map-warning {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent);
  border-radius: var(--radius-md);
  width: 100%;
}

.warning-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
}

.warning-content strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.9375rem;
  margin-bottom: 0.25rem;
}

.warning-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.empty-state {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-style: italic;
}

.description-section {
  position: relative;
}

.description-textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  resize: vertical;
  font-family: inherit;
}

.description-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
</style>
