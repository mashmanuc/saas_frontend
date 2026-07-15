<template>
  <!-- Local Workspace: перемикач мови для гостя (немає сторінки налаштувань).
       Guest-safe: тільки setLocale з @/i18n (localStorage), ЖОДНИХ API-викликів —
       localeStore.changeLocale смикає i18nApi.setUserLocale, що для гостя = 401. -->
  <div class="wb-lang">
    <!-- Стилі повністю власні: батьківський .wb-header-btn — SCOPED у WBSoloRoom
         і на дочірній компонент не поширюється (кнопка була б сирою/розваленою). -->
    <button
      type="button"
      class="wb-lang__btn"
      :aria-expanded="open"
      :title="t('winterboard.localWorkspace.language')"
      @click="open = !open"
    >
      {{ currentShort }}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <!-- Backdrop на pointerdown: закриття «поза меню» дружнє до пера/планшета -->
    <div v-if="open" class="wb-lang__backdrop" @pointerdown="open = false" />
    <div v-if="open" class="wb-lang__menu" role="menu">
      <button
        v-for="lang in LANGS"
        :key="lang.code"
        type="button"
        class="wb-lang__option"
        :class="{ 'wb-lang__option--active': locale === lang.code }"
        role="menuitem"
        @click="pick(lang.code)"
      >
        <span>{{ lang.label }}</span>
        <span v-if="locale === lang.code" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const LANGS = [
  { code: 'uk', label: 'Українська', short: 'УКР' },
  { code: 'en', label: 'English', short: 'ENG' },
  { code: 'ru', label: 'Русский', short: 'РУС' },
] as const

const { t, locale } = useI18n()
const open = ref(false)

const currentShort = computed(
  () => LANGS.find(l => l.code === locale.value)?.short ?? 'УКР',
)

async function pick(code: string): Promise<void> {
  await setLocale(code)
  open.value = false
}
</script>

<style scoped>
.wb-lang {
  position: relative;
  display: inline-flex;
}

.wb-lang__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  flex-shrink: 0;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  transition: background 0.15s ease;
}

.wb-lang__btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.wb-lang__backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.wb-lang__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 91;
  min-width: 160px;
  background: #ffffff;
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
}

.wb-lang__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: #0f172a;
  cursor: pointer;
  text-align: left;
}

.wb-lang__option:hover {
  background: #f1f5f9;
}

.wb-lang__option--active {
  font-weight: 600;
  color: #17a34a;
}
</style>
