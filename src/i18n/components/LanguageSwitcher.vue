<script setup lang="ts">
// F4: Language Switcher Component
import { storeToRefs } from 'pinia'
import { useLocaleStore } from '../stores/localeStore'

const store = useLocaleStore()
const { currentLocale, activeLocales } = storeToRefs(store)
const { changeLocale } = store
</script>

<template>
  <div class="language-switcher">
    <button
      v-for="locale in activeLocales"
      :key="locale.code"
      :class="['locale-btn', { active: currentLocale === locale.code }]"
      :title="locale.native_name"
      @click="changeLocale(locale.code)"
    >
      {{ locale.code.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.language-switcher {
  display: flex;
  gap: 4px;
}

.locale-btn {
  padding: 6px 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  transition: all 0.15s;
}

.locale-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.locale-btn.active {
  background: var(--color-primary, #3b82f6);
  color: white;
  border-color: var(--color-primary, #3b82f6);
}
</style>
