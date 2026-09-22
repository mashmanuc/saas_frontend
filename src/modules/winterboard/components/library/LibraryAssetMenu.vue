<template>
  <!-- Одна кнопка «…» замість п'яти іконок на hover (візуальний розбір
       «Матеріалів» 2026-09-22, п. 4): іконки лягали поверх назви файлу,
       а на планшеті hover немає зовсім. Меню — поза карткою (Teleport),
       бо картка обрізає вміст (overflow: hidden). -->
  <button
    ref="triggerRef"
    type="button"
    class="lib-asset-menu__trigger"
    :class="{ 'lib-asset-menu__trigger--open': open }"
    :aria-label="t('winterboard.library.moreActions')"
    :title="t('winterboard.library.moreActions')"
    aria-haspopup="menu"
    :aria-expanded="open"
    data-testid="asset-menu-trigger"
    @click.stop="toggle"
    @pointerdown.stop
  >
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
    </svg>
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuRef"
      class="lib-asset-menu"
      role="menu"
      :style="menuStyle"
      data-testid="asset-menu"
      @click.stop
    >
      <!-- Ф6-4: «прочитати» лише коли сервер сказав, що читання ввімкнене. -->
      <button
        v-if="canReadMaterial"
        type="button"
        role="menuitem"
        class="lib-asset-menu__item"
        data-action="read-material"
        @click="pick('read-material')"
      >📖 {{ t('winterboard.materials.readAsset') }}</button>
      <button type="button" role="menuitem" class="lib-asset-menu__item" data-action="toggle-favorite" @click="pick('toggle-favorite')">
        {{ asset.is_favorite ? '★' : '☆' }}
        {{ asset.is_favorite ? t('winterboard.library.unfavorite') : t('winterboard.library.favorite') }}
      </button>
      <button type="button" role="menuitem" class="lib-asset-menu__item" data-action="rename" @click="pick('rename')">
        ✎ {{ t('winterboard.library.renameAsset') }}
      </button>
      <button
        v-if="canMove"
        type="button"
        role="menuitem"
        class="lib-asset-menu__item"
        data-action="move"
        data-testid="move-asset-btn"
        @click="pick('move')"
      >⇢ {{ t('winterboard.library.moveToFolder') }}</button>
      <div class="lib-asset-menu__sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        class="lib-asset-menu__item lib-asset-menu__item--danger"
        data-action="delete"
        @click="pick('delete')"
      >🗄 {{ t('winterboard.library.archiveAction') }}</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LibraryAsset } from '../../types/library'

type Action = 'read-material' | 'toggle-favorite' | 'rename' | 'move' | 'delete'

withDefaults(defineProps<{
  asset: LibraryAsset
  canReadMaterial?: boolean
  canMove?: boolean
}>(), { canReadMaterial: false, canMove: true })

const emit = defineEmits<{ action: [action: Action, anchorRect: DOMRect] }>()

const { t } = useI18n()
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })
const MENU_W = 220

const menuStyle = computed(() => ({ top: `${pos.value.top}px`, left: `${pos.value.left}px`, width: `${MENU_W}px` }))

function place(): void {
  const r = triggerRef.value?.getBoundingClientRect()
  if (!r) return
  const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8))
  let top = r.bottom + 4
  const h = menuRef.value?.offsetHeight ?? 200
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
  pos.value = { top, left }
}

function onDocPointer(e: Event): void {
  const t = e.target as Node
  if (menuRef.value?.contains(t) || triggerRef.value?.contains(t)) return
  close()
}
function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') close() }

function listen(on: boolean): void {
  const fn = on ? window.addEventListener : window.removeEventListener
  fn('pointerdown', onDocPointer, true)
  fn('keydown', onKey)
  fn('scroll', close, true)
  fn('resize', close)
}

async function toggle(): Promise<void> {
  if (open.value) { close(); return }
  open.value = true
  place()
  listen(true)
  await nextTick()
  place()
}

function close(): void {
  if (!open.value) return
  open.value = false
  listen(false)
}

function pick(action: Action): void {
  const rect = triggerRef.value?.getBoundingClientRect() ?? new DOMRect()
  close()
  emit('action', action, rect)
}

onBeforeUnmount(() => listen(false))
defineExpose({ close })
</script>

<style scoped>
.lib-asset-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.92);
  color: var(--wb-fg-secondary, #475569);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.lib-asset-menu__trigger:hover,
.lib-asset-menu__trigger--open {
  background: #fff;
  border-color: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg, #0f172a);
}
.lib-asset-menu__trigger:focus-visible {
  outline: 2px solid var(--wb-brand, #0f766e);
  outline-offset: 1px;
}
</style>

<style>
/* Меню телепортоване в body — стилі не scoped. */
.lib-asset-menu {
  position: fixed;
  z-index: 1000;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
}
.lib-asset-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  text-align: left;
  cursor: pointer;
}
.lib-asset-menu__item:hover,
.lib-asset-menu__item:focus-visible {
  background: var(--wb-canvas-bg, #f1f5f9);
  outline: none;
}
.lib-asset-menu__item--danger { color: #b91c1c; }
.lib-asset-menu__sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--wb-toolbar-border, #e2e8f0);
}
@media (hover: none) {
  .lib-asset-menu__item { padding: 11px 12px; font-size: 14px; }
}
</style>
