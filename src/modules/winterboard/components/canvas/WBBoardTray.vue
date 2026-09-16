<!--
  TLV2-05B · нижній трей згорнутих карток поточної сторінки.

  Лише вигляд: які вкладки показати, вирішує host (`WBCanvas` + `board/boardTray.ts`),
  а дії йдуть назад подіями — `restore` і `delete`. Трей нічого не пише сам:
  host перетворює їх на штатні `asset-update` / `asset-delete`.

  Кожна вкладка — тип і назва картки. Клік повертає картку на те саме місце;
  «⋯» відкриває меню з видаленням (заблоковану картку видалити не можна — як і на полотні).
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
      v-for="item in items"
      :key="item.id"
      class="wb-board-tray__tab"
      data-testid="wb-board-tray-tab"
      :data-asset-id="item.id"
      :data-asset-type="item.type"
    >
      <button
        type="button"
        class="wb-board-tray__restore"
        data-testid="wb-board-tray-restore"
        :title="t('winterboard.tray.restore')"
        @click.stop="restore(item.id)"
      >
        <span class="wb-board-tray__kind">{{ kindLabel(item.type) }}</span>
        <span v-if="trayTitle(item)" class="wb-board-tray__title">{{ trayTitle(item) }}</span>
      </button>
      <button
        type="button"
        class="wb-board-tray__menu-btn"
        data-testid="wb-board-tray-menu"
        :aria-expanded="openMenuId === item.id"
        :title="t('winterboard.tray.menu')"
        @click.stop="toggleMenu(item.id)"
      >⋯</button>
      <div v-if="openMenuId === item.id" class="wb-board-tray__menu" role="menu">
        <button
          type="button"
          role="menuitem"
          class="wb-board-tray__delete"
          data-testid="wb-board-tray-delete"
          :disabled="item.locked === true"
          @click.stop="remove(item.id)"
        >{{ t('winterboard.tray.delete') }}</button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset } from '../../types/winterboard'
import { trayTitle } from '../../board/boardTray'

const props = defineProps<{
  /** Згорнуті картки поточної сторінки в порядку шарів (`trayItems`). */
  items: WBAsset[]
}>()

const emit = defineEmits<{ restore: [assetId: string]; delete: [assetId: string] }>()

const { t, te } = useI18n()

const openMenuId = ref<string | null>(null)

function kindLabel(type: string): string {
  const key = `winterboard.tray.kind.${type}`
  return te(key) ? t(key) : type
}

function toggleMenu(id: string): void {
  openMenuId.value = openMenuId.value === id ? null : id
}

function restore(id: string): void {
  openMenuId.value = null
  emit('restore', id)
}

function remove(id: string): void {
  openMenuId.value = null
  emit('delete', id)
}

// Вкладка зникла (відновлено, видалено, інша сторінка) — меню не висить у повітрі.
watch(
  () => props.items.map(item => item.id),
  (ids) => {
    if (openMenuId.value && !ids.includes(openMenuId.value)) openMenuId.value = null
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
  display: flex;
  gap: 6px;
  max-width: calc(100% - 24px);
  overflow-x: auto;
  padding: 6px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
}

.wb-board-tray__tab {
  position: relative;
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.wb-board-tray__restore {
  display: flex;
  align-items: baseline;
  gap: 6px;
  max-width: 240px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: #0f172a;
}

.wb-board-tray__kind {
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.wb-board-tray__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-board-tray__menu-btn {
  padding: 0 6px;
  border: none;
  border-left: 1px solid #e2e8f0;
  background: transparent;
  cursor: pointer;
  color: #64748b;
}

.wb-board-tray__menu {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.wb-board-tray__delete {
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: #dc2626;
  font-size: 12px;
}

.wb-board-tray__delete:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
