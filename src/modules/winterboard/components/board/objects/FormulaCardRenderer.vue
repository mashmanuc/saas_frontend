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
    ref="rootEl"
    class="formula-card-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :style="{ '--fc-k': String(textScale) }"
    :data-testid="`formula-card-renderer-${asset.id}`"
  >
    <!-- Формула з бібліотеки Інтегралика: назва зверху, позначення знизу (пакет 2, 19.10). -->
    <div
      v-if="renderedTitle"
      class="formula-card-renderer__title"
      v-html="renderedTitle"
    />

    <!-- Formula display area -->
    <div
      class="formula-card-renderer__display"
      :style="{ fontSize: `${(asset.data?.fontSize ?? 22) * textScale}px`, color: asset.data?.color ?? '#1e293b' }"
    >
      <span
        v-if="renderedFormula"
        v-html="renderedFormula"
      />
      <span v-else class="formula-card-renderer__placeholder">
        ƒ(x) — натисніть ✎ щоб ввести формулу
      </span>
    </div>

    <div
      v-if="renderedNotation"
      class="formula-card-renderer__notation"
      v-html="renderedNotation"
    />

    <!-- Controls: visible only when selected + interactive -->
    <div v-if="isSelected && interactive" class="formula-card-renderer__controls">
      <button
        type="button"
        class="formula-card-renderer__btn formula-card-renderer__btn--edit"
        :title="t('winterboard.widget.formula.edit')"
        @click.stop="emit('request-edit')"
      >✎</button>
      <button
        v-if="!hostWindowControls && (!asset.locked)"
        type="button"
        class="formula-card-renderer__btn formula-card-renderer__btn--delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
      >×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderMathField } from '@/modules/intent/math/renderMathContent'
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
  return renderMathField(props.asset.data, 'formula', formula, true)
})

const renderedTitle = computed((): string => {
  const title = props.asset.data?.title ?? ''
  return title.trim() ? renderMathField(props.asset.data, 'title', title) : ''
})

const renderedNotation = computed((): string => {
  const notation = props.asset.data?.notation ?? ''
  return notation.trim() ? renderMathField(props.asset.data, 'notation', notation) : ''
})

/**
 * Масштаб тексту картки з бібліотеки = зум дошки (ширина рамки / ширина в одиницях аркуша).
 * Рамка оверлею масштабується з дошкою, а пікселі шрифту — ні: на зумі 0.5 назва, формула
 * й позначення не влазили б у половинну рамку. Тому картка з назвою чи позначеннями тягне
 * весь свій текст за зумом, як будь-який об'єкт аркуша. Звичайна картка формули — як була
 * (масштаб 1), висота жодної картки від зуму не залежить.
 */
const rootEl = ref<HTMLElement | null>(null)
const frameScale = ref(1)
const fromLibrary = computed(() => Boolean(props.asset.data?.title || props.asset.data?.notation))
const textScale = computed(() => (fromLibrary.value ? frameScale.value : 1))
let frameObserver: ResizeObserver | null = null

function measureFrame(): void {
  const w = props.asset.w
  const el = rootEl.value
  if (el && w > 0 && el.offsetWidth > 0) frameScale.value = el.offsetWidth / w
}

onMounted(() => {
  measureFrame()
  if (typeof ResizeObserver === 'undefined' || !rootEl.value) return
  frameObserver = new ResizeObserver(measureFrame)
  frameObserver.observe(rootEl.value)
})
onBeforeUnmount(() => frameObserver?.disconnect())

// TLV2-05B.2: у режимі стандарту карток ⛶/× малює спільна група полотна (WBCardWindowControls) — власні кнопки ховаються, щоб не було двох.
const hostWindowControls = useHostWindowControls()
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
  padding: calc(12px * var(--fc-k, 1)) calc(16px * var(--fc-k, 1));
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

/* Назва й позначення — дрібно, не відбирають місця у формули (пакет 2, 19.10). */
.formula-card-renderer__title {
  flex: 0 0 auto;
  width: 100%;
  padding: calc(8px * var(--fc-k, 1)) calc(16px * var(--fc-k, 1)) 0;
  font-size: calc(13px * var(--fc-k, 1));
  font-weight: 600;
  line-height: 1.3;
  color: #475569;
  text-align: center;
}

.formula-card-renderer__notation {
  flex: 0 0 auto;
  width: 100%;
  padding: 0 calc(16px * var(--fc-k, 1)) calc(10px * var(--fc-k, 1));
  font-size: calc(12px * var(--fc-k, 1));
  line-height: 1.4;
  color: #64748b;
  text-align: center;
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
