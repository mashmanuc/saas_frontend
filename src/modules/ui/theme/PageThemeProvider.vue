<template>
  <div
    class="page-theme-provider"
    :class="[`theme-${themeId}`, { 'theme-dark': isDark }]"
    :style="cssVarsStyle"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from './themeStore'
import { themes, themeToCssVars, defaultThemeId } from './themes'
import type { ThemeId } from './themes'

interface Props {
  themeId?: ThemeId
}

const props = withDefaults(defineProps<Props>(), {
  themeId: undefined,
})

const route = useRoute()
const themeStore = useThemeStore()

const resolveThemeId = (candidate?: ThemeId | null): ThemeId | undefined => {
  if (candidate && themes[candidate as ThemeId]) return candidate as ThemeId
  return undefined
}

const activeThemeId = computed<ThemeId>(() => {
  const fromProps = resolveThemeId(props.themeId)
  if (fromProps) return fromProps

  const fromRoute = resolveThemeId(route.meta?.themeId as ThemeId | undefined)
  if (fromRoute) return fromRoute

  const fromStore = resolveThemeId(themeStore.currentThemeId)
  if (fromStore) return fromStore

  return defaultThemeId
})

const isDark = computed(() => activeThemeId.value === 'themeB')

const cssVarsStyle = computed(() => {
  const theme = themes[activeThemeId.value as ThemeId] ?? themes[defaultThemeId]
  return themeToCssVars(theme)
})

// Sync with store when theme changes
watch(activeThemeId, (newId) => {
  if (newId !== themeStore.currentThemeId) {
    themeStore.setTheme(newId)
  }
})

onMounted(() => {
  // Apply theme on mount
  themeStore.applyTheme()
})
</script>

<style scoped>
.page-theme-provider {
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-fg);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Dark theme adjustments */
.theme-dark {
  color-scheme: dark;
}

/* Ensure full height */
.page-theme-provider {
  display: flex;
  flex-direction: column;
}
</style>
