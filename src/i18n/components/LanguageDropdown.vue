<script setup lang="ts">
// F5: Language Dropdown Component
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Globe, ChevronDown, Check } from 'lucide-vue-next'
import { useLocaleStore } from '../stores/localeStore'

const store = useLocaleStore()
const { currentLocale, currentLocaleInfo, activeLocales } = storeToRefs(store)
const { changeLocale } = store

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function selectLocale(code: string) {
  changeLocale(code)
  close()
}
</script>

<template>
  <div class="language-dropdown" v-click-outside="close">
    <button class="dropdown-trigger" @click="toggle">
      <Globe :size="18" />
      <span class="current-locale">{{ currentLocaleInfo?.native || currentLocale }}</span>
      <ChevronDown :size="16" :class="['chevron', { open: isOpen }]" />
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <button
          v-for="locale in activeLocales"
          :key="locale.code"
          :class="['dropdown-item', { active: currentLocale === locale.code }]"
          @click="selectLocale(locale.code)"
        >
          <span class="locale-native">{{ locale.native_name }}</span>
          <span class="locale-name">{{ locale.name }}</span>
          <Check v-if="currentLocale === locale.code" :size="16" class="check-icon" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.language-dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  transition: all 0.15s;
}

.dropdown-trigger:hover {
  border-color: var(--color-primary, #3b82f6);
}

.dropdown-trigger svg {
  color: var(--color-text-secondary, #6b7280);
}

.chevron {
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 180px;
  padding: 4px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.dropdown-item.active {
  background: var(--color-primary-light, #eff6ff);
}

.locale-native {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.locale-name {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.check-icon {
  color: var(--color-primary, #3b82f6);
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
