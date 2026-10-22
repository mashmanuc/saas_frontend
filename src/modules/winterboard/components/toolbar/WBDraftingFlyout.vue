<!-- WBDraftingFlyout — меню «Креслярські інструменти» лівої панелі (власник 2026-10-22: «так, роби кнопку
     зліва… і туди лінійку й циркуль»). Кнопка живе в самій WBToolbar (її розмір, підказка й підпис —
     спільні стилі панелі); тут — лише меню. Пункти — ті самі записи реєстру, що й плитки «Геометрія →
     Креслярські інструменти» праворуч (family 'instruments'): новий інструмент з'являється в обох
     місцях сам. Вставка — той самий шлях, що «+» плитки: addTool(mime, payload) → addAtPosition у центр
     видимої частини дошки. Меню — у <body>, як у WBColorFlyout: панель має overflow. -->
<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="wb-drafting__panel"
      :style="panelStyle"
      role="menu"
      :aria-label="t('winterboard.insertTiles.instruments')"
      data-testid="wb-drafting-menu"
      @keydown.escape="close"
    >
      <div class="wb-drafting__title">{{ t('winterboard.insertTiles.instruments') }}</div>
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        role="menuitem"
        class="wb-drafting__item"
        :data-testid="`wb-drafting-${entry.id}`"
        @click="insert(entry)"
      >
        <span class="wb-drafting__icon" aria-hidden="true">
          <InsertIcon :family="entry.family" :icon-key="entry.iconKey" />
        </span>
        <span class="wb-drafting__text">
          <span class="wb-drafting__name">{{ t(entry.labelKey, entry.labelFallback) }}</span>
          <span v-if="entry.sublabelKey" class="wb-drafting__sub">{{ t(entry.sublabelKey, entry.sublabel ?? '') }}</span>
        </span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AddToolFn } from '../../composables/useAddToolToBoard'
import { allInserts, type InsertEntry } from '../sidebar/insertRegistry'
import { InsertIcon } from '../sidebar/insertIcons'

const props = withDefaults(defineProps<{
  open: boolean
  /** Кнопка панелі, біля якої відкривається меню. */
  anchor: HTMLElement | null
  addTool: AddToolFn
  /** Панель унизу (телефон) — меню над кнопкою, збоку — праворуч від неї. */
  dock?: 'side' | 'bottom'
}>(), { dock: 'side' })

const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const { t } = useI18n()

const entries: InsertEntry[] = allInserts().filter((e) => e.family === 'instruments')

const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function close(): void {
  emit('update:open', false)
  props.anchor?.focus()
}

function insert(entry: InsertEntry): void {
  props.addTool(entry.dragMime, entry.payload)
  emit('update:open', false)
}

// pointerdown у фазі перехоплення — закривається й тоді, коли вчитель починає писати пером
// (як у WBColorFlyout: mousedown від пера не приходить, Konva зупиняє подію).
function onPointerDownOutside(e: PointerEvent): void {
  if (!props.open) return
  const target = e.target as Node
  if (props.anchor?.contains(target) || panelRef.value?.contains(target)) return
  emit('update:open', false)
}

function placePanel(): void {
  const rect = props.anchor?.getBoundingClientRect()
  if (!rect) return
  panelStyle.value = props.dock === 'bottom' || window.innerWidth <= 768
    ? { left: `${Math.max(4, rect.left)}px`, bottom: `${window.innerHeight - rect.top + 10}px` }
    : { left: `${rect.right + 10}px`, top: `${rect.top}px` }
}

watch(() => props.open, (open) => {
  if (open) nextTick(placePanel)
})

onMounted(() => document.addEventListener('pointerdown', onPointerDownOutside, true))
onUnmounted(() => document.removeEventListener('pointerdown', onPointerDownOutside, true))
</script>

<style scoped>
.wb-drafting__panel {
  position: fixed;
  z-index: 1000;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 8px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-drafting__title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 2px 6px 6px;
}

.wb-drafting__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: #0f172a;
}

.wb-drafting__item:hover,
.wb-drafting__item:focus-visible {
  background: #f1f5f9;
}

.wb-drafting__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #eef4fd;
  color: #2f6fd0;
}

.wb-drafting__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wb-drafting__name {
  font-size: 13px;
  font-weight: 600;
}

.wb-drafting__sub {
  font-size: 11px;
  color: #64748b;
}
</style>
