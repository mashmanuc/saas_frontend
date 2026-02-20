<template>
  <div class="theme-switcher">
    <button
      v-for="theme in themes"
      :key="theme.id"
      class="theme-btn"
      :class="{ 'theme-btn--active': currentThemeId === theme.id }"
      :aria-pressed="currentThemeId === theme.id"
      :title="theme.label"
      @click="setTheme(theme.id)"
    >
      <component :is="theme.icon" class="theme-btn__icon" />
      <span class="theme-btn__label">{{ theme.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from './themeStore'
import type { ThemeId } from './themeStore'

// Icons
import IconSun from './icons/IconSun.vue'
import IconMoon from './icons/IconMoon.vue'
import IconSunset from './icons/IconSunset.vue'

const themeStore = useThemeStore()

const currentThemeId = computed(() => themeStore.theme)

const themes = [
  { id: 'light' as ThemeId, label: 'Light', icon: IconSun },
  { id: 'dark' as ThemeId, label: 'Dark', icon: IconMoon },
  { id: 'classic' as ThemeId, label: 'Classic', icon: IconSunset },
]

function setTheme(themeId: ThemeId): void {
  themeStore.setTheme(themeId)
}
</script>

<style scoped>
.theme-switcher {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: var(--radius-md, 8px);
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-fg-secondary, #475569);
  transition: all 0.15s ease;
}

.theme-btn:hover {
  background: var(--color-bg-hover, #f1f5f9);
  color: var(--color-fg, #0f172a);
}

.theme-btn--active {
  background: var(--color-brand-light, #dbeafe);
  color: var(--color-brand, #2563eb);
}

.theme-btn__icon {
  width: 16px;
  height: 16px;
}

.theme-btn__label {
  display: none;
}

@media (min-width: 640px) {
  .theme-btn__label {
    display: inline;
  }
}
</style>
