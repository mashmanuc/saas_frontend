<!--
  TheoryCardRenderer — рухома картка теорії+формул як WBAsset (§3.7.12).

  Замінює page-level theoryBlock/formulaBlock (WBTheoryOverlay) на повноцінний
  draggable/resizable/selectable/copyable об'єкт. Контент рендериться так само
  (KaTeX через renderTextWithLatex), але всередині картки з position з asset.x/y/w/h.

  POINTER-EVENTS MODEL (дзеркало nmt_task §3.7.9):
    .theory-card (root)        pointer-events:none → Konva proxy ловить drag/select/resize
    .theory-card__body         pointer-events:auto → скрол/виділення тексту
    .theory-card__body[readonly] pointer-events:none → у draw/pen режимі ink проходить крізь
    .theory-card__delete-btn   pointer-events:auto + stop → видалення коли selected
-->
<template>
  <div
    ref="rootEl"
    class="theory-card"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive }"
    :data-testid="`theory-card-${asset.id}`"
  >
    <div class="theory-card__accent-bar" />

    <header class="theory-card__header">
      <span class="theory-card__icon">📖</span>
      <span class="theory-card__badge">{{ data.badge || 'Теорія' }}</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="theory-card__delete-btn"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div class="theory-card__body">
      <!-- Theory: title + body + hint -->
      <div v-if="data.title || data.body" class="theory-card__section">
        <h2
          v-if="data.title"
          class="theory-card__title"
          v-html="renderTextWithLatex(data.title)"
        />
        <div
          v-if="data.body"
          class="theory-card__text"
          v-html="renderTextWithLatex(data.body)"
        />
        <div
          v-if="data.hint"
          class="theory-card__hint"
          v-html="renderTextWithLatex(data.hint)"
        />
      </div>

      <!-- Formula grid -->
      <div v-if="data.formulas && data.formulas.length" class="theory-card__formula-section">
        <h3 v-if="data.formulaTitle" class="theory-card__formula-title">{{ data.formulaTitle }}</h3>
        <div class="theory-card__formula-grid">
          <div
            v-for="(entry, i) in data.formulas"
            :key="i"
            class="theory-card__formula-card"
          >
            <div
              class="theory-card__formula-latex"
              v-html="renderTextWithLatex('$' + entry.latex + '$')"
            />
            <div
              v-if="entry.label && entry.label !== 'placeholder'"
              class="theory-card__formula-label"
            >
              {{ entry.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBAsset, TheoryCardData } from '../../../types/winterboard'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  delete: []
}>()

const rootEl = ref<HTMLElement | null>(null)

const data = computed<TheoryCardData>(() => (props.asset.data as TheoryCardData) ?? {
  version: 1, title: '', body: '',
})

// Export capture: theory_card is a draggable WBAsset, so it snapshots by its
// own asset.id like other widgets (the export engine embeds it at the card's
// x/y/w/h). KaTeX renders cyrillic-in-formula via web fonts — server-side
// MathJax SVG can't. Registered exactly like trig_circle / graph widgets.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)
</script>

<style scoped>
.theory-card {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.98);
  border: 1.5px solid #e0e7ff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.08);
  overflow: hidden;
  pointer-events: none;            /* Konva proxy ловить drag/select */
  box-sizing: border-box;
}
.theory-card.is-selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
/* readonly (pen/highlighter/eraser) — прозорий фон, ink проступає; body click-through */
.theory-card.is-readonly { background: rgba(255, 255, 255, 0.0); }
.theory-card.is-readonly .theory-card__body { pointer-events: none; }

.theory-card__accent-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 5px;
  background: #6366f1;
}

.theory-card__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 16px;
  border-bottom: 1px solid #eef2ff;
  pointer-events: none;            /* drag-handle через Konva proxy */
  user-select: none;
}
.theory-card__icon { font-size: 15px; }
.theory-card__badge {
  font-size: 12px;
  font-weight: 600;
  color: #4338ca;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex: 1 1 auto;
}
.theory-card__delete-btn {
  flex: 0 0 auto;
  width: 20px; height: 20px;
  padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, 0.78);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 50%;
  font-size: 14px; line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.theory-card__delete-btn:hover { background: #dc2626; border-color: #f87171; }
.theory-card.is-readonly .theory-card__delete-btn { pointer-events: none; opacity: 0.4; }

.theory-card__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px 22px;
  pointer-events: auto;            /* скрол/виділення тексту */
}

.theory-card__section { margin-bottom: 18px; }
.theory-card__title {
  font-size: 20px; font-weight: 700; color: #1e1b4b;
  line-height: 1.3; margin: 0 0 12px 0; letter-spacing: -0.01em;
}
.theory-card__text { font-size: 15px; line-height: 1.7; color: #374151; }
.theory-card__hint {
  margin-top: 14px; font-size: 13px; color: #6b7280; font-style: italic;
  padding-top: 12px; border-top: 1px solid #e5e7eb;
}

.theory-card__formula-title {
  font-size: 15px; font-weight: 600; color: #4338ca; margin: 0 0 14px 0;
}
.theory-card__formula-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.theory-card__formula-card {
  background: #f5f3ff; border: 1px solid #ede9fe; border-radius: 10px;
  padding: 14px 10px 10px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.theory-card__formula-latex { font-size: 15px; color: #1e1b4b; line-height: 1.4; }
.theory-card__formula-label {
  font-size: 11px; color: #7c3aed; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.04em;
}
:deep(math) { font-size: 1em; }
</style>
