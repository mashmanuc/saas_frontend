<template>
  <div class="wb-theory-overlay">
    <div ref="contentEl" class="wb-theory-content">
      <!-- Theory block: title + body + hint -->
      <div v-if="theoryBlock" class="wb-theory-section">
        <h2
          class="wb-theory-title"
          v-html="renderTextWithLatex(theoryBlock.title)"
        />
        <div
          class="wb-theory-body"
          v-html="renderTextWithLatex(theoryBlock.body)"
        />
        <div
          v-if="theoryBlock.hint"
          class="wb-theory-hint"
          v-html="renderTextWithLatex(theoryBlock.hint)"
        />
      </div>

      <!-- Formula block: title + formula grid -->
      <div v-if="formulaBlock" ref="formulaEl" class="wb-formula-section">
        <h3 class="wb-formula-title">{{ formulaBlock.title }}</h3>
        <div class="wb-formula-grid">
          <div
            v-for="(entry, i) in formulaBlock.formulas"
            :key="i"
            class="wb-formula-card"
          >
            <div
              class="wb-formula-latex"
              v-html="renderTextWithLatex('$' + entry.latex + '$')"
            />
            <div
              v-if="entry.label && entry.label !== 'placeholder'"
              class="wb-formula-label"
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
import { ref } from 'vue'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBTheoryBlock, WBFormulaBlock } from '../../types/winterboard'
import { useExportCapture } from '../../composables/useExportCapture'
import { snapshotElement } from '../../utils/snapshotElement'

const props = defineProps<{
  theoryBlock?: WBTheoryBlock
  formulaBlock?: WBFormulaBlock
  /** Current page id — used to build the synthetic export-preview id
   *  `theory-<pageId>` so the export engine can embed this snapshot.
   *  Theory is page-level (not an asset), hence the synthetic id. */
  pageId?: string
}>()

// Export capture: snapshot the WHOLE theory overlay (title + body + formula
// cards) under `theory-<pageId>`. V1.5 export composites this snapshot at the
// top of the page — the browser already laid it out beautifully (KaTeX,
// cyrillic, cards), so the screenshot is the "glamorous" result we want.
// Theory is page-level (not an asset), hence the synthetic id.
const contentEl = ref<HTMLElement | null>(null)
const formulaEl = ref<HTMLElement | null>(null)
useExportCapture(
  () => (props.pageId && (props.theoryBlock || props.formulaBlock) ? `theory-${props.pageId}` : undefined),
  (signal) => snapshotElement(contentEl.value, signal),
)
</script>

<style scoped>
.wb-theory-overlay {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  pointer-events: none;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 48px;
  box-sizing: border-box;
}

.wb-theory-content {
  width: 100%;
  max-width: 820px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ── Theory section ── */
.wb-theory-section {
  background: rgba(255, 255, 255, 0.96);
  border: 1.5px solid #e0e7ff;
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.07);
  backdrop-filter: blur(4px);
}

.wb-theory-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e1b4b;
  line-height: 1.3;
  margin: 0 0 16px 0;
  letter-spacing: -0.01em;
}

.wb-theory-body {
  font-size: 15px;
  line-height: 1.75;
  color: #374151;
}

.wb-theory-hint {
  margin-top: 16px;
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

/* ── Formula section ── */
.wb-formula-section {
  background: rgba(255, 255, 255, 0.96);
  border: 1.5px solid #ddd6fe;
  border-radius: 16px;
  padding: 28px 40px;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.06);
  backdrop-filter: blur(4px);
}

.wb-formula-title {
  font-size: 16px;
  font-weight: 600;
  color: #4338ca;
  margin: 0 0 20px 0;
  letter-spacing: -0.01em;
}

.wb-formula-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.wb-formula-card {
  background: #f5f3ff;
  border: 1px solid #ede9fe;
  border-radius: 10px;
  padding: 16px 12px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.wb-formula-latex {
  font-size: 16px;
  color: #1e1b4b;
  line-height: 1.4;
}

.wb-formula-label {
  font-size: 11px;
  color: #7c3aed;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* KaTeX / MathML base adjustments */
:deep(math) {
  font-size: 1em;
}
</style>
