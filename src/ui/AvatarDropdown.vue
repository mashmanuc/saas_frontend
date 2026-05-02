<template>
  <div class="relative" ref="rootRef">
    <!-- Trigger: Avatar button -->
    <button
      type="button"
      class="avatar-trigger"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      :aria-label="$t('nav.avatar.ariaLabel')"
      @click="toggle"
    >
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
        style="background: var(--accent); color: var(--accent-contrast);"
      >
        {{ userInitials }}
      </div>
      <span class="hidden md:inline text-sm" style="color: var(--text-primary);">
        {{ userName }}
      </span>
      <ChevronDown
        :size="14"
        class="transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        style="color: var(--text-secondary);"
      />
    </button>

    <!-- Mobile: bottom sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="isOpen && isMobile" class="avatar-sheet-overlay" @click="close">
          <div class="avatar-sheet" @click.stop>
            <div class="avatar-sheet-handle" />
            <div class="dropdown-header">
              <p class="text-sm font-medium text-body truncate">{{ userName }}</p>
              <p class="text-xs text-muted truncate">{{ userEmail }}</p>
            </div>
            <div class="dropdown-divider" role="separator" />
            <router-link to="/settings" class="dropdown-item" role="menuitem" @click="close">
              <Settings :size="16" />
              <span>{{ $t('nav.avatar.settings') }}</span>
            </router-link>
            <div class="dropdown-divider" role="separator" />
            <div class="dropdown-section">
              <span class="dropdown-section-label">{{ $t('nav.avatar.theme') }}</span>
              <div class="theme-options">
                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  type="button"
                  class="theme-option"
                  :class="{ active: currentTheme === option.value }"
                  :title="$t(option.labelKey)"
                  :aria-pressed="currentTheme === option.value"
                  role="menuitemradio"
                  @click="setTheme(option.value)"
                >
                  <component :is="option.icon" :size="14" />
                  <span class="text-xs">{{ $t(option.labelKey) }}</span>
                </button>
              </div>
            </div>
            <div class="dropdown-divider" role="separator" />
            <div class="dropdown-section">
              <span class="dropdown-section-label">{{ $t('nav.avatar.language') }}</span>
              <div class="language-options">
                <button
                  v-for="locale in localeOptions"
                  :key="locale.code"
                  type="button"
                  class="language-option"
                  :class="{ active: currentLocale === locale.code }"
                  :aria-pressed="currentLocale === locale.code"
                  role="menuitemradio"
                  @click="changeLocale(locale.code)"
                >
                  {{ locale.label }}
                </button>
              </div>
            </div>
            <div class="dropdown-divider" role="separator" />
            <button
              type="button"
              class="dropdown-item dropdown-item--danger"
              role="menuitem"
              @click="handleLogout"
            >
              <LogOut :size="16" />
              <span>{{ $t('nav.logout') }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Desktop: positioned dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen && !isMobile"
        class="dropdown-panel"
        role="menu"
        :aria-label="$t('nav.avatar.menuLabel')"
      >
        <div class="dropdown-header">
          <p class="text-sm font-medium text-body truncate">{{ userName }}</p>
          <p class="text-xs text-muted truncate">{{ userEmail }}</p>
        </div>
        <div class="dropdown-divider" role="separator" />
        <router-link to="/settings" class="dropdown-item" role="menuitem" @click="close">
          <Settings :size="16" />
          <span>{{ $t('nav.avatar.settings') }}</span>
        </router-link>
        <div class="dropdown-divider" role="separator" />
        <div class="dropdown-section">
          <span class="dropdown-section-label">{{ $t('nav.avatar.theme') }}</span>
          <div class="theme-options">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="theme-option"
              :class="{ active: currentTheme === option.value }"
              :title="$t(option.labelKey)"
              :aria-pressed="currentTheme === option.value"
              role="menuitemradio"
              @click="setTheme(option.value)"
            >
              <component :is="option.icon" :size="14" />
              <span class="text-xs">{{ $t(option.labelKey) }}</span>
            </button>
          </div>
        </div>
        <div class="dropdown-divider" role="separator" />
        <div class="dropdown-section">
          <span class="dropdown-section-label">{{ $t('nav.avatar.language') }}</span>
          <div class="language-options">
            <button
              v-for="locale in localeOptions"
              :key="locale.code"
              type="button"
              class="language-option"
              :class="{ active: currentLocale === locale.code }"
              :aria-pressed="currentLocale === locale.code"
              role="menuitemradio"
              @click="changeLocale(locale.code)"
            >
              {{ locale.label }}
            </button>
          </div>
        </div>
        <div class="dropdown-divider" role="separator" />
        <button
          type="button"
          class="dropdown-item dropdown-item--danger"
          role="menuitem"
          @click="handleLogout"
        >
          <LogOut :size="16" />
          <span>{{ $t('nav.logout') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, Settings, LogOut, Sun, Moon, GraduationCap } from 'lucide-vue-next'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const settings = useSettingsStore()

// Layout SSoT — Stage 5 migration (saas_docs/plans/LAYOUT_SSOT_2026-05-02.md).
const layout = useLayoutStore()
const { isMobile } = storeToRefs(layout)

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const userInitials = computed(() => {
  if (!auth.user) return '?'
  const f = auth.user.first_name?.[0] ?? ''
  const l = auth.user.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
})

const userName = computed(() => {
  if (!auth.user) return ''
  return auth.user.first_name || auth.user.email || ''
})

const userEmail = computed(() => auth.user?.email || '')

const currentTheme = computed(() => theme.theme)

const themeOptions = [
  { value: 'light', icon: Sun, labelKey: 'nav.theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'nav.theme.dark' },
  { value: 'classic', icon: GraduationCap, labelKey: 'nav.theme.classic' },
]

function setTheme(value: string) {
  theme.setTheme(value)
}

const currentLocale = computed(() => settings.locale)

const localeOptions = [
  { code: 'uk', label: 'UK' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
]

function changeLocale(locale: string) {
  if (locale === currentLocale.value) return
  settings.setLocale(locale)
}

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

async function handleLogout() {
  close()
  try {
    await auth.logout()
  } finally {
    router.push('/auth/login').catch(() => {})
  }
}

function handleClickOutside(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.avatar-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  border-radius: 9999px;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: background 0.15s;
}

.avatar-trigger:hover {
  background: var(--bg-hover);
}

.avatar-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.dropdown-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 280px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--dropdown-bg);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--text-primary, #000) 12%, transparent);
  z-index: 50;
  overflow: hidden;
}

.dropdown-header {
  padding: 0.75rem 1rem;
}

.dropdown-divider {
  height: 1px;
  background: var(--border-color);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  text-decoration: none;
  transition: background 0.15s;
  cursor: pointer;
  width: 100%;
  border: none;
  background: transparent;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  background: var(--bg-hover);
}

.dropdown-item--danger {
  color: var(--danger-bg);
}

.dropdown-item--danger:hover {
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 8%, transparent);
}

.dropdown-section {
  padding: 0.5rem 1rem;
}

.dropdown-section-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.theme-options,
.language-options {
  display: flex;
  gap: 0.25rem;
}

.theme-option,
.language-option {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.theme-option:hover,
.language-option:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.theme-option:focus-visible,
.language-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.theme-option.active,
.language-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: var(--accent);
}

/* Transition — desktop dropdown */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Mobile bottom sheet ── */
.avatar-sheet-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--text-primary, #000) 40%, transparent);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}

.avatar-sheet {
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--dropdown-bg);
  border-radius: 16px 16px 0 0;
  padding: 0.5rem 1rem 1rem;
  padding-bottom: env(safe-area-inset-bottom, 1rem);
}

.avatar-sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  margin: 0.5rem auto 0.75rem;
}

.avatar-sheet .dropdown-item {
  min-height: var(--touch-target-min, 44px);
}

.avatar-sheet .theme-option,
.avatar-sheet .language-option {
  min-height: var(--touch-target-min, 44px);
  padding: 0.5rem 0.75rem;
}

/* Transition — mobile sheet */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .avatar-sheet,
.sheet-leave-active .avatar-sheet {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .avatar-sheet,
.sheet-leave-to .avatar-sheet {
  transform: translateY(100%);
}
</style>
