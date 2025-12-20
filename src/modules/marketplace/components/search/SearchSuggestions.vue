<script setup lang="ts">
// TASK F5: Search Suggestions Component
import { User, BookOpen, FolderOpen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Suggestion } from '../../api/marketplace'

defineProps<{
  suggestions: Suggestion[]
  selectedIndex: number
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [suggestion: Suggestion]
}>()

const { t } = useI18n()

const getIcon = (type: string) => {
  switch (type) {
    case 'tutor':
      return User
    case 'category':
      return FolderOpen
    default:
      return BookOpen
  }
}
</script>

<template>
  <div class="suggestions-list">
    <div v-if="loading" class="loading">
      <div class="spinner" />
      {{ t('common.loading') }}
    </div>

    <ul v-else>
      <li
        v-for="(suggestion, index) in suggestions"
        :key="`${suggestion.type}-${suggestion.text}`"
        class="suggestion-item"
        :class="{ 'is-selected': index === selectedIndex }"
        @click="emit('select', suggestion)"
      >
        <div class="suggestion-icon">
          <component :is="getIcon(suggestion.type)" :size="18" />
        </div>
        <div class="suggestion-content">
          <span class="suggestion-text">{{ suggestion.text }}</span>
          <span v-if="suggestion.category" class="suggestion-category">
            {{ suggestion.category }}
          </span>
        </div>
        <img
          v-if="suggestion.photo"
          :src="suggestion.photo"
          :alt="suggestion.text"
          class="suggestion-photo"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.suggestions-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--text-muted);
  font-size: 14px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.suggestion-item:hover,
.suggestion-item.is-selected {
  background: var(--surface-card-muted);
}

.suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface-card-muted);
  border-radius: 8px;
  color: var(--text-muted);
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-text {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-category {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.suggestion-photo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
