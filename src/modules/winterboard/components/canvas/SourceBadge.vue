<template>
  <div ref="rootEl" class="wb-source-badge">
    <button
      type="button"
      class="wb-source-badge__pill"
      :aria-expanded="open"
      data-testid="source-badge"
      @click.stop="open = !open"
      @mousedown.stop
      @pointerdown.stop
    >{{ labels.source }}</button>
    <!-- Повна атрибуція (TASL): назва-посилання, провайдер, автор, ліцензія. -->
    <div
      v-if="open"
      class="wb-source-badge__card"
      data-testid="source-badge-card"
      @click.stop
      @mousedown.stop
      @pointerdown.stop
    >
      <a
        class="wb-source-badge__title"
        :href="source.url"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >{{ source.title || hostOf(source.url) }}</a>
      <span v-if="source.provider" class="wb-source-badge__meta">{{ source.provider }}</span>
      <span v-if="source.author" class="wb-source-badge__meta">{{ labels.author }}: {{ source.author }}</span>
      <span v-if="source.license" class="wb-source-badge__meta">
        {{ labels.license }}:
        <a
          v-if="source.licenseUrl"
          :href="source.licenseUrl"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >{{ source.license }}</a>
        <template v-else>{{ source.license }}</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: SourceBadge — маленька кнопка «Джерело» в правому нижньому куті картинки
// Інтегралика (LAW §9 v1.22, власник 2026-09-29). Замінює підпис-штрих під картинкою:
// дошка чиста, а повна атрибуція — за натиском. У PNG/PDF атрибуцію пише сервер
// текстом під сторінкою (INV-EP-9), бо цей шар у знімок не потрапляє.
//
// Контейнер у WBCanvas має pointer-events: none — клікабельні лише кнопка й картка.
// Натиск нічого не пише в дошку: стан «відкрито» локальний, у ops і Replay не йде.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { SOURCE_BADGE_LABELS, type ImageSource } from '../../board/materialAttribution'
import { hostOf } from '../../utils/urlSafety'

const props = defineProps<{ source: ImageSource }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const labels = computed(() => SOURCE_BADGE_LABELS[props.source.language])

// Закривається натиском повз картку чи Esc — як спливне вікно, а не як панель.
function onOutsidePointer(e: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
function unlisten() {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  document.removeEventListener('keydown', onKey)
}
watch(open, (isOpen) => {
  unlisten()
  if (isOpen) {
    document.addEventListener('pointerdown', onOutsidePointer, true)
    document.addEventListener('keydown', onKey)
  }
})
onBeforeUnmount(unlisten)
</script>

<style scoped>
.wb-source-badge {
  position: relative;
}

.wb-source-badge__pill {
  pointer-events: auto;
  padding: 1px 7px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
  color: #475569;
  font: 500 11px/16px system-ui, sans-serif;
  cursor: pointer;
  white-space: nowrap;
}

.wb-source-badge__pill:hover,
.wb-source-badge__pill[aria-expanded='true'] {
  background: #fff;
  color: #1e293b;
}

.wb-source-badge__card {
  pointer-events: auto;
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  width: max-content;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
  color: #475569;
  font: 12px/1.4 system-ui, sans-serif;
  overflow-wrap: anywhere;
  cursor: default;
}

.wb-source-badge__title {
  color: #2563eb;
  font-weight: 500;
}

.wb-source-badge__card a {
  color: #2563eb;
}
</style>
