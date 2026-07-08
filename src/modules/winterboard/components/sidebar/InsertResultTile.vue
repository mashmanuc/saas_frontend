<!--
  InsertResultTile — плитка результату пошуку в табі «Інструменти» (Фаза 1).
  Рендерить один InsertEntry (insertRegistry). Вставка = ТОЙ САМИЙ контракт, що трей:
    - drag: dataTransfer.setData(dragMime, payload) + touch через useTouchDragFromTray
    - click: useAddToolToBoard()(dragMime, payload) → addAtPosition у центр вьюпорта
  Жодної логіки створення ассета тут — лише MIME+payload (HARD RULE useAddToolToBoard).
-->
<template>
  <button
    type="button"
    class="insert-tile"
    :draggable="true"
    :title="label"
    :data-insert-id="entry.id"
    @dragstart="onDragStart"
    @click.stop="addTool(entry.dragMime, entry.payload)"
    v-bind="dragHandlers(entry.dragMime, entry.payload, label)"
  >
    <span class="insert-tile__icon" aria-hidden="true">{{ familyIcon }}</span>
    <span class="insert-tile__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'
import type { InsertEntry } from './insertRegistry'

const props = defineProps<{ entry: InsertEntry }>()

const { t, te } = useI18n()
const addTool = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

/** i18n-ключ якщо є й присутній, інакше статичний UA-фолбек. */
const label = computed(() =>
  props.entry.labelKey && te(props.entry.labelKey)
    ? t(props.entry.labelKey)
    : props.entry.labelFallback,
)

const FAMILY_ICON: Record<string, string> = {
  stereo: '◳', planimetry: '△', analysis: 'ƒ', quadratic: '∆', trig: '◠',
  '2d': '∿', '3d': '⬙', geomash: '⬡', other: '▪',
}
const familyIcon = computed(() => FAMILY_ICON[props.entry.family] ?? '▪')

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(props.entry.dragMime, props.entry.payload)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.insert-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  cursor: grab;
  transition: background 0.12s, border-color 0.12s;
  min-height: 58px;
  text-align: center;
}
.insert-tile:hover {
  background: #e0f2fe;
  border-color: #7dd3fc;
}
.insert-tile:active {
  cursor: grabbing;
}
.insert-tile__icon {
  font-size: 18px;
  line-height: 1;
  color: #2563eb;
}
.insert-tile__label {
  font-size: 10px;
  line-height: 1.15;
  color: #475569;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
</style>
