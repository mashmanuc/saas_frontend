<!--
  InsertTileWithAdd — плитка «Інструментів» (InsertResultTile) + «+» у кутку.
  Власник 2026-10-21: «немає + який додає картку на дошку — для сенсорних дошок це херово» — як у треях графіків.
  «+» і клік по плитці — той самий шлях useAddToolToBoard (MIME + payload → addAtPosition); перетягування — у плитці.
  Миша — «+» при наведенні; дотик (any-pointer: coarse) — завжди видно, 30×30.
-->
<template>
  <div class="tile-add">
    <InsertResultTile :entry="entry" />
    <button
      type="button"
      class="tile-add__btn"
      :data-testid="`insert-add-${entry.id}`"
      :title="title"
      :aria-label="title"
      @click.stop="addTool(entry.dragMime, entry.payload)"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import InsertResultTile from './InsertResultTile.vue'
import type { InsertEntry } from './insertRegistry'

const props = defineProps<{ entry: InsertEntry }>()

const { t, te } = useI18n()
const addTool = useAddToolToBoard()

const name = computed(() =>
  props.entry.labelKey && te(props.entry.labelKey) ? t(props.entry.labelKey) : props.entry.labelFallback,
)
const title = computed(() => t('winterboard.nmt3d.addToBoard', { name: name.value }))
</script>

<style scoped>
.tile-add { position: relative; display: flex; }
.tile-add > .insert-tile { flex: 1; min-width: 0; }
.tile-add__btn {
  position: absolute; top: 3px; right: 3px; z-index: 2;
  width: 20px; height: 20px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: #f5f3ff; color: #6366f1; border: 1px solid #c7d2fe; border-radius: 5px;
  font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer;
  opacity: 0; pointer-events: none; transition: opacity 0.12s, background 0.12s;
}
.tile-add:hover .tile-add__btn, .tile-add__btn:focus-visible { opacity: 1; pointer-events: auto; }
.tile-add__btn:hover { background: #ede9fe; border-color: #818cf8; color: #4338ca; }
@media (any-pointer: coarse) {
  .tile-add__btn { opacity: 1; pointer-events: auto; width: 30px; height: 30px; font-size: 20px; border-radius: 7px; }
}
</style>
