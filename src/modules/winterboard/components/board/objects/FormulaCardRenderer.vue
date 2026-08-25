<!--
  FormulaCardRenderer — formula_card renderer (§3.7.11).
  KaTeX-rendered LaTeX formula у draggable HTML overlay.

  POINTER-EVENTS MODEL (mirror QuadraticRenderer):
    - Root .formula-card-renderer = pointer-events:none → Konva proxy handles drag/select.
    - Delete/Edit кнопки = pointer-events:auto (видимі лише коли isSelected && interactive).

  EDITING: Не inline — через emit('request-edit') → батьківський компонент відкриває modal.
-->
<template>
  <div
    class="formula-card-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`formula-card-renderer-${asset.id}`"
  >
    <!-- Formula display area -->
    <div
      class="formula-card-renderer__display"
      :style="{ fontSize: `${asset.data?.fontSize ?? 22}px`, color: asset.data?.color ?? '#1e293b' }"
    >
      <span
        v-if="renderedFormula"
        v-html="renderedFormula"
      />
      <span v-else class="formula-card-renderer__placeholder">
        ƒ(x) — натисніть ✎ щоб ввести формулу
      </span>
    </div>

    <!-- Controls: visible only when selected + interactive -->
    <div v-if="isSelected && interactive" class="formula-card-renderer__controls">
      <button
        type="button"
        class="formula-card-renderer__btn formula-card-renderer__btn--edit"
        :title="t('winterboard.widget.formula.edit')"
        @click.stop="emit('request-edit')"
      >✎</button>
      <button
        v-if="!asset.locked"
        type="button"
        class="formula-card-renderer__btn formula-card-renderer__btn--delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
      >×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { FormulaCardAsset } from '../../../types/formulaCard'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: FormulaCardAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'request-edit': []
  'delete': []
}>()

/**
 * Рендеримо формулу у display-режимі KaTeX.
 * Якщо formula порожня — повертаємо пустий рядок → показується placeholder.
 */
const renderedFormula = computed((): string => {
  const formula = props.asset.data?.formula ?? ''
  if (!formula.trim()) return ''
  // Використовуємо display mode ($$) для великого центрованого відображення
  return renderTextWithLatex(`$$${formula}$$`)
})
</script>

<style scoped>
.formula-card-renderer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: var(--formula-bg, #f8fafc);
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  user-select: none;
}

.formula-card-renderer.is-selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
}

.formula-card-renderer__display {
  flex: 1;
  display: flex;
  align-items: center;
  /* `safe center` замість `center` — правило власника 2026-08-16 «висота не
     дозволяє → скрол». Живий прогін: формула
     `f(x)/g(x) ≤ 0 ⇔ f(x)·g(x) ≤ 0, g(x) ≠ 0` ширша за картку, і при
     звичайному `center` вона обрізалась з ОБОХ боків — початок виїжджав у
     недосяжну від'ємну зону скролу (класика flexbox: центрований
     overflow не доскролити). `safe` переносить вирівнювання на start, щойно
     вміст перестає вміщатись, — і тоді скрол справді доїжджає до початку. */
  justify-content: safe center;
  padding: 12px 16px;
  width: 100%;
  text-align: center;
  line-height: 1.4;
  /* Обрізання замінене на прокрутку. ⚠️ `pointer-events` НЕ вмикаємо:
     корінь навмисно `none`, щоб драг/вибір ловив Konva-проксі (див.
     POINTER-EVENTS MODEL угорі файлу). Скрол колесом тут ціною зламаного
     перетягування картки — погана угода; головне вже зробив `safe center`
     (початок формули видно) і повна ширина смуги з BE. */
  overflow: auto;
  scrollbar-width: thin;
}

.formula-card-renderer__placeholder {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

/* Controls */
.formula-card-renderer__controls {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  pointer-events: auto;
}

.formula-card-renderer__btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.formula-card-renderer__btn--edit {
  background: #e0e7ff;
  color: #4338ca;
}
.formula-card-renderer__btn--edit:hover {
  background: #c7d2fe;
}

.formula-card-renderer__btn--delete {
  background: #fee2e2;
  color: #dc2626;
}
.formula-card-renderer__btn--delete:hover {
  background: #fecaca;
}

/* KaTeX MathML adjustments */
:deep(math) {
  font-size: 1em;
}
:deep(.lc-display-math) {
  display: inline;
  margin: 0;
}
</style>
