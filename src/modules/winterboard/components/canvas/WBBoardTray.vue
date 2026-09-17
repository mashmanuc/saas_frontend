<!--
  TLV2-05B · нижній трей згорнутих карток поточної сторінки.
  TLV2-RC1.1 · кожна вкладка — мінікартка згорнутого вікна, меню — поза скролом трею.

  Лише вигляд: які вкладки показати, вирішує host (`WBCanvas` + `board/boardTray.ts`),
  а дії йдуть назад подіями — `restore` і `delete`. Трей нічого не пише сам:
  host перетворює їх на штатні `asset-update` / `asset-delete`.

  Мінікартка: маркер типу, назва, тип другорядним підписом і окрема кнопка «⋯».
  Основна частина повертає картку на те саме місце; «⋯» або правий клік відкривають
  одне меню «Повернути на дошку · Видалити з дошки» (заблоковану видалити не можна — як на полотні).

  Чому меню в `Teleport`: скрол вкладок (`__rail`, `overflow-x: auto`) обрізає все,
  що виходить за його межі, тож меню всередині нього було невидиме. Тепер меню —
  `position: fixed` у `body`, над мінікарткою й у межах viewport.
-->
<template>
  <nav
    class="wb-board-tray"
    data-testid="wb-board-tray"
    :aria-label="t('winterboard.tray.label')"
    @pointerdown.stop
    @mousedown.stop
    @wheel.stop
  >
    <div
      class="wb-board-tray__rail"
      data-testid="wb-board-tray-rail"
      @scroll.passive="positionMenu"
    >
      <div
        v-for="item in items"
        :key="item.id"
        :ref="(el) => setRef(cardEls, item.id, el)"
        class="wb-board-tray__card"
        :class="[
          `wb-board-tray__card--${trayCardFamily(item.type)}`,
          { 'wb-board-tray__card--menu-open': menuItemId === item.id },
        ]"
        data-testid="wb-board-tray-tab"
        :data-asset-id="item.id"
        :data-asset-type="item.type"
        :data-family="trayCardFamily(item.type)"
        @contextmenu.prevent.stop="openMenu(item.id)"
      >
        <button
          :ref="(el) => setRef(restoreEls, item.id, el)"
          type="button"
          class="wb-board-tray__restore"
          data-testid="wb-board-tray-restore"
          :title="t('winterboard.tray.restore')"
          :aria-label="t('winterboard.tray.restoreNamed', { name: cardName(item) })"
          @click.stop="restore(item.id)"
        >
          <span class="wb-board-tray__marker" data-testid="wb-board-tray-marker" aria-hidden="true">
            {{ trayMonogram(kindLabel(item.type)) }}
          </span>
          <span class="wb-board-tray__text">
            <span class="wb-board-tray__title" data-testid="wb-board-tray-title">{{ cardName(item) }}</span>
            <span
              v-if="trayTitle(item)"
              class="wb-board-tray__kind"
              data-testid="wb-board-tray-kind"
            >{{ kindLabel(item.type) }}</span>
          </span>
        </button>
        <button
          :ref="(el) => setRef(menuButtonEls, item.id, el)"
          type="button"
          class="wb-board-tray__menu-btn"
          data-testid="wb-board-tray-menu"
          aria-haspopup="menu"
          :aria-expanded="menuItemId === item.id ? 'true' : 'false'"
          :aria-controls="menuItemId === item.id ? menuDomId : undefined"
          :title="t('winterboard.tray.menu')"
          :aria-label="t('winterboard.tray.menuFor', { name: cardName(item) })"
          @click.stop="toggleMenu(item.id)"
        >
          <MoreHorizontalIcon :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="menuItem"
        :id="menuDomId"
        ref="menuEl"
        class="wb-board-tray-menu"
        data-testid="wb-board-tray-popup"
        role="menu"
        :data-asset-id="menuItem.id"
        :data-placement="menuPlacement?.placement ?? 'pending'"
        :aria-label="t('winterboard.tray.menuFor', { name: cardName(menuItem) })"
        :style="menuStyle"
        @contextmenu.prevent
        @keydown="onMenuKeydown"
      >
        <button
          type="button"
          role="menuitem"
          class="wb-board-tray-menu__item"
          data-testid="wb-board-tray-menu-restore"
          @click.stop="restore(menuItem.id)"
        >
          <ArrowUpFromLineIcon :size="16" aria-hidden="true" />
          <span>{{ t('winterboard.tray.restore') }}</span>
        </button>
        <div role="separator" class="wb-board-tray-menu__separator" />
        <button
          type="button"
          role="menuitem"
          class="wb-board-tray-menu__item wb-board-tray-menu__item--danger"
          data-testid="wb-board-tray-delete"
          :disabled="!canDelete(menuItem)"
          :aria-describedby="canDelete(menuItem) ? undefined : lockedHintId"
          @click.stop="remove(menuItem.id)"
        >
          <Trash2Icon :size="16" aria-hidden="true" />
          <span>{{ t('winterboard.tray.delete') }}</span>
        </button>
        <p
          v-if="!canDelete(menuItem)"
          :id="lockedHintId"
          class="wb-board-tray-menu__hint"
          data-testid="wb-board-tray-delete-locked"
        >{{ t('winterboard.tray.deleteLocked') }}</p>
      </div>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpFromLineIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-vue-next'
import type { WBAsset } from '../../types/winterboard'
import { trayTitle } from '../../board/boardTray'
import {
  trayCardFamily,
  trayMenuPosition,
  trayMonogram,
  type TrayMenuPlacement,
} from '../../board/boardTrayPresentation'

const props = defineProps<{
  /** Згорнуті картки поточної сторінки в порядку шарів (`trayItems`). */
  items: WBAsset[]
}>()

const emit = defineEmits<{ restore: [assetId: string]; delete: [assetId: string] }>()

const { t, te } = useI18n()

const domId = `wb-board-tray-${Math.random().toString(36).slice(2, 10)}`
const menuDomId = `${domId}-menu`
const lockedHintId = `${domId}-locked`

const cardEls = new Map<string, HTMLElement>()
const restoreEls = new Map<string, HTMLElement>()
const menuButtonEls = new Map<string, HTMLElement>()

function setRef(store: Map<string, HTMLElement>, id: string, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLElement) store.set(id, el)
  else store.delete(id)
}

/** Одна мить — одне меню: id картки, чиє меню відкрите. */
const menuItemId = ref<string | null>(null)
const menuItem = computed(() => props.items.find(item => item.id === menuItemId.value) ?? null)
const menuEl = ref<HTMLElement | null>(null)
const menuPlacement = ref<TrayMenuPlacement | null>(null)

const menuStyle = computed(() => (menuPlacement.value
  ? { left: `${menuPlacement.value.left}px`, top: `${menuPlacement.value.top}px` }
  : { left: '0px', top: '0px', visibility: 'hidden' as const }))

function kindLabel(type: string): string {
  const key = `winterboard.tray.kind.${type}`
  return te(key) ? t(key) : t('winterboard.tray.kindFallback')
}

function cardName(item: WBAsset): string {
  return trayTitle(item) || kindLabel(item.type)
}

/** Як і «×» на полотні: заблоковану картку видалити не можна. */
function canDelete(item: WBAsset): boolean {
  return item.locked !== true
}

function positionMenu(): void {
  const id = menuItemId.value
  const anchor = id ? cardEls.get(id) : undefined
  const menu = menuEl.value
  if (!anchor || !menu) return
  menuPlacement.value = trayMenuPosition(
    anchor.getBoundingClientRect(),
    { width: menu.offsetWidth, height: menu.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  )
}

function openMenu(id: string): void {
  if (menuItemId.value !== id) {
    menuItemId.value = id
    menuPlacement.value = null
  }
  void nextTick(() => {
    positionMenu()
    menuEl.value?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
  })
}

function closeMenu(options: { focusButton?: boolean } = {}): void {
  const id = menuItemId.value
  if (!id) return
  menuItemId.value = null
  menuPlacement.value = null
  if (options.focusButton) void nextTick(() => menuButtonEls.get(id)?.focus())
}

function toggleMenu(id: string): void {
  if (menuItemId.value === id) closeMenu({ focusButton: true })
  else openMenu(id)
}

/** Після того як картка піде з трею, фокус переходить на логічно наступну вкладку. */
let focusAfterLeave: { id: string; index: number } | null = null

function rememberNeighbour(id: string): void {
  const index = props.items.findIndex(item => item.id === id)
  focusAfterLeave = index >= 0 ? { id, index } : null
}

function restore(id: string): void {
  rememberNeighbour(id)
  closeMenu()
  emit('restore', id)
}

function remove(id: string): void {
  const item = props.items.find(candidate => candidate.id === id)
  if (!item || !canDelete(item)) return
  rememberNeighbour(id)
  closeMenu()
  emit('delete', id)
}

function menuItems(): HTMLElement[] {
  return Array.from(menuEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
}

function onMenuKeydown(event: KeyboardEvent): void {
  const entries = menuItems()
  if (!entries.length) return
  const current = entries.indexOf(document.activeElement as HTMLElement)
  let next = -1
  if (event.key === 'ArrowDown') next = (current + 1) % entries.length
  else if (event.key === 'ArrowUp') next = (current - 1 + entries.length) % entries.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = entries.length - 1
  else if (event.key === 'Tab') {
    event.preventDefault()
    closeMenu({ focusButton: true })
    return
  }
  if (next < 0) return
  event.preventDefault()
  entries[next].focus()
}

function onDocumentPointerDown(event: Event): void {
  const target = event.target as Node | null
  const id = menuItemId.value
  if (!id || !target) return
  if (menuEl.value?.contains(target)) return
  if (menuButtonEls.get(id)?.contains(target)) return
  closeMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !menuItemId.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMenu({ focusButton: true })
}

function listen(on: boolean): void {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown, true)
  document[method]('keydown', onDocumentKeydown, true)
  window[method]('resize', positionMenu)
}

watch(menuItemId, (id, previous) => {
  if (id && !previous) listen(true)
  else if (!id && previous) listen(false)
})

onBeforeUnmount(() => {
  if (menuItemId.value) listen(false)
})

// Вкладка зникла (відновлено, видалено, інша сторінка) — меню не висить у повітрі,
// а фокус не губиться: переходить на вкладку, що стала на її місце.
watch(
  () => props.items.map(item => item.id),
  (ids) => {
    if (menuItemId.value && !ids.includes(menuItemId.value)) closeMenu()
    const pending = focusAfterLeave
    if (!pending || ids.includes(pending.id)) return
    focusAfterLeave = null
    const nextId = ids[Math.min(pending.index, ids.length - 1)]
    if (nextId) void nextTick(() => restoreEls.get(nextId)?.focus())
  },
)
</script>

<style scoped>
.wb-board-tray {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 60;
  max-width: calc(100% - 24px);
  padding: 4px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14);
  pointer-events: auto;
}

/* Скрол вкладок — окремий внутрішній rail; меню в нього не входить (див. коментар угорі). */
.wb-board-tray__rail {
  display: flex;
  gap: 8px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 3px;
  scrollbar-width: thin;
}

.wb-board-tray__card {
  --tray-accent: #475569;
  --tray-accent-soft: #f1f5f9;
  position: relative;
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  box-sizing: border-box;
  height: 44px;
  min-width: 160px;
  max-width: 260px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wb-board-tray__card::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--tray-accent);
}

.wb-board-tray__card--text { --tray-accent: #047857; --tray-accent-soft: #ecfdf5; }
.wb-board-tray__card--task { --tray-accent: #b45309; --tray-accent-soft: #fffbeb; }
.wb-board-tray__card--math { --tray-accent: #1d4ed8; --tray-accent-soft: #eff6ff; }
.wb-board-tray__card--animation { --tray-accent: #6d28d9; --tray-accent-soft: #f5f3ff; }
.wb-board-tray__card--media { --tray-accent: #0e7490; --tray-accent-soft: #ecfeff; }

.wb-board-tray__card:hover,
.wb-board-tray__card--menu-open {
  border-color: var(--tray-accent);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
}

.wb-board-tray__restore {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0 6px 0 10px;
  border: none;
  background: transparent;
  color: #0f172a;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.wb-board-tray__restore:hover {
  background: var(--tray-accent-soft);
}

.wb-board-tray__restore:focus-visible,
.wb-board-tray__menu-btn:focus-visible {
  outline: 2px solid var(--wb-brand, #047857);
  outline-offset: -2px;
}

.wb-board-tray__marker {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--tray-accent-soft);
  color: var(--tray-accent);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.wb-board-tray__text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  line-height: 1.25;
}

.wb-board-tray__title {
  overflow: hidden;
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-board-tray__kind {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-board-tray__menu-btn {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  margin: 0;
  padding: 0;
  border: none;
  border-left: 1px solid #eef2f7;
  background: transparent;
  color: #475569;
  cursor: pointer;
}

.wb-board-tray__menu-btn:hover,
.wb-board-tray__menu-btn[aria-expanded='true'] {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-board-tray-menu {
  position: fixed;
  z-index: 9999;
  box-sizing: border-box;
  min-width: 212px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font-size: 13px;
}

.wb-board-tray-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #0f172a;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.wb-board-tray-menu__item:hover:not(:disabled) {
  background: #f1f5f9;
}

.wb-board-tray-menu__item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--wb-brand, #047857);
}

.wb-board-tray-menu__item--danger {
  color: #b91c1c;
}

.wb-board-tray-menu__item--danger:hover:not(:disabled) {
  background: #fef2f2;
}

.wb-board-tray-menu__item:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.wb-board-tray-menu__separator {
  height: 1px;
  margin: 4px 6px;
  background: #e2e8f0;
}

.wb-board-tray-menu__hint {
  margin: 0 10px 6px 34px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.3;
}
</style>
