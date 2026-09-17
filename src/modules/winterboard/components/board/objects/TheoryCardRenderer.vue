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

  TLV2-05C · СТАНДАРТ ПОДАННЯ (SYSTEM_LAW §9.C, SSOT INV-25). Власної підгонки розміру в картці більше немає:
    • висота — спільний шлях `request-height → nextAutoFitHeight → asset_update`
      (`useCardContentFit`), той самий, що в картки задачі;
    • тіло скролиться (`overflow-y: auto`) — текст ніколи не обрізається мовчки;
    • масштаб — `data.presentationScale` через `--wb-card-text-scale` на всю типографіку.
-->
<template>
  <div
    ref="rootEl"
    class="theory-card"
    :class="[
        { 'is-selected': isSelected, 'is-readonly': !interactive },
        `preset-${effectivePreset || 'default'}`,
      ]"
    :style="{
      '--accent': presetStyle.accent,
      '--preset-border': presetStyle.border,
      '--preset-shadow': presetStyle.accent + '14',
      ...textScaleStyle,
    }"
    :data-testid="`theory-card-${asset.id}`"
  >
    <div class="theory-card__accent-bar" :style="{ background: presetStyle.accent }" />

    <header class="theory-card__header" :style="{ background: presetStyle.accent + '10' }">
      <span class="theory-card__icon">{{ presetStyle.icon }}</span>
      <span class="theory-card__badge" :style="{ color: presetStyle.badge }">{{ data.badge || 'Теорія' }}</span>
      <button
        v-if="!hostWindowControls && (!asset.locked && isSelected)"
        type="button"
        class="theory-card__delete-btn"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div ref="bodyEl" class="theory-card__body">
      <!-- TLV2-05C: природний потік вмісту — його висоту міряє спільна авто-висота. -->
      <div ref="flowEl" class="theory-card__flow">
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
      <!-- H0: доказові джерела змісту. Службові підписи — мовою МАТЕРІАЛУ
           (data.content_language), а не UI-локалі: англомовна картка не має
           раптом підписуватись українською (ТЗ §2.3, паритет uk/en). -->
      <div v-if="sources.length" class="theory-card__sources">
        <button
          type="button"
          class="theory-card__sources-toggle"
          :aria-expanded="sourcesOpen"
          @click.stop="sourcesOpen = !sourcesOpen"
          @mousedown.stop
          @pointerdown.stop
        >{{ sourceLabels.sources }}: {{ sources.length }}</button>
        <ol v-if="sourcesOpen" class="theory-card__sources-list">
          <li v-for="(ref, i) in sources" :key="i" class="theory-card__source">
            <a
              class="theory-card__source-title"
              :href="ref.url"
              target="_blank"
              rel="noopener noreferrer nofollow"
              @click.stop
              @mousedown.stop
              @pointerdown.stop
            >{{ ref.title }}</a>
            <span v-if="ref.author" class="theory-card__source-meta">{{ sourceLabels.author }}: {{ ref.author }}</span>
            <span v-if="ref.license" class="theory-card__source-meta">{{ sourceLabels.license }}: {{ ref.license }}</span>
            <span v-if="ref.retrieved_at" class="theory-card__source-meta">{{ sourceLabels.retrieved }}: {{ ref.retrieved_at.slice(0, 10) }}</span>
          </li>
        </ol>
      </div>
      </div><!-- /.theory-card__flow -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBAsset, TheoryCardData } from '../../../types/winterboard'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { detectCardPreset } from '../../../utils/detectCardPreset'
import { cardTextScaleStyle, presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'

const { t } = useI18n()

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
  /** TLV2-05C: скільки пікселів висоти треба вмісту (спільна авто-висота). */
  'request-height': [neededPx: number]
}>()

const rootEl = ref<HTMLElement | null>(null)


/** N1 Фаза 3: пресети картки теорії (2026-08-07).
 *  Мінімум 3 пресети візуально відрізняються (колір акцент-бару + іконка).
 *  Усі 10 пресетів — предметно-нейтральні. */
const PRESET_STYLES: Record<string, { icon: string; accent: string; border: string; badge: string }> = {
  definition:      { icon: '📘', accent: '#2563eb', border: '#bfdbfe', badge: '#1e40af' },
  rule:            { icon: '📏', accent: '#16a34a', border: '#bbf7d0', badge: '#15803d' },
  proof:           { icon: '🔬', accent: '#7c3aed', border: '#ddd6fe', badge: '#5b21b6' },
  tip:             { icon: '💡', accent: '#eab308', border: '#fde68a', badge: '#a16207' },
  'common mistake': { icon: '⚠️', accent: '#dc2626', border: '#fecaca', badge: '#b91c1c' },
  remember:        { icon: '⭐', accent: '#f97316', border: '#fed7aa', badge: '#c2410c' },
  example:         { icon: '💬', accent: '#0891b2', border: '#a5f3fc', badge: '#155e75' },
  'life example':  { icon: '🌳', accent: '#059669', border: '#a7f3d0', badge: '#065f46' },
  algorithm:       { icon: '🔢', accent: '#6b7280', border: '#e5e7eb', badge: '#374151' },
  summary:         { icon: '✅', accent: '#1e3a5f', border: '#93c5fd', badge: '#0f172a' },
}

const data = computed<TheoryCardData>(() => (props.asset.data as TheoryCardData) ?? {
  version: 1, title: '', body: '',
})

// N1 Фаза 3: render-time fallback для СТАРИХ карток без data.preset —
// той самий keyword-match, що на BE (detectCardPreset = дзеркало
// parser.py _detect_preset), виконується на льоту при рендері.
// Збережений стан дошки НЕ мутується — суто відображення.
const effectivePreset = computed(() =>
  data.value.preset
  || detectCardPreset(data.value.title, data.value.body, data.value.badge)
  || undefined,
)

// ── H0 · доказові джерела ────────────────────────────────────────────────────
// Підписи мовою матеріалу, не UI-локалі: дзеркало `material_labels.py` на BE.
// Через vue-i18n це зробити не можна — він дає локаль ІНТЕРФЕЙСУ, а ТЗ вимагає
// мову самого матеріалу (англійська картка → `Sources`, навіть коли UI український).
const SOURCE_LABELS: Record<string, { sources: string; author: string; license: string; retrieved: string }> = {
  uk: { sources: 'Джерела', author: 'Автор', license: 'Ліцензія', retrieved: 'Отримано' },
  en: { sources: 'Sources', author: 'Author', license: 'License', retrieved: 'Retrieved' },
}
const sources = computed(() => {
  const list = (data.value as TheoryCardData).sources
  return Array.isArray(list) ? list : []
})
const sourceLabels = computed(() => {
  const lang = (props.asset.data as { content_language?: string } | undefined)?.content_language
  return SOURCE_LABELS[lang === 'en' ? 'en' : 'uk']
})
const sourcesOpen = ref(false)

const presetStyle = computed(() => {
  const p = effectivePreset.value
  return (p && PRESET_STYLES[p]) ? PRESET_STYLES[p] : PRESET_STYLES.definition
})

// ── TLV2-05C · подання картки ────────────────────────────────────────────────
// Масштаб усієї типографіки — спільний учительський (`data.presentationScale`).
const textScaleStyle = computed(() => cardTextScaleStyle(props.asset))

// Висота під вміст — спільний шлях (SSOT INV-25). Попередня власна підгонка після
// будь-якої зовнішньої зміни розміру назавжди вимикалась, а тіло лишалось без
// прокрутки — текст обрізався мовчки.
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  // Перо, replay, учень і згорнута в трей картка операцій не породжують.
  canMeasure: () => props.interactive && !isMinimizedOnBoard(props.asset),
  sources: [
    () => data.value.title,
    () => data.value.body,
    () => data.value.hint,
    () => data.value.badge,
    () => data.value.preset,
    () => data.value.formulaTitle,
    () => JSON.stringify(data.value.formulas ?? []),
    () => presentationScaleOf(props.asset),
    () => props.asset.w,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

// Export capture: theory_card is a draggable WBAsset, so it snapshots by its
// own asset.id like other widgets (the export engine embeds it at the card's
// x/y/w/h). KaTeX renders cyrillic-in-formula via web fonts — server-side
// MathJax SVG can't. Registered exactly like trig_circle / graph widgets.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)

// TLV2-05B.2: у режимі стандарту карток ⛶/× малює спільна група полотна (WBCardWindowControls) — власні кнопки ховаються, щоб не було двох.
const hostWindowControls = useHostWindowControls()
</script>

<style scoped>
.theory-card {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.98);
  border: 1.5px solid var(--preset-border, #e0e7ff);
  border-radius: 16px;
  box-shadow: 0 4px 24px var(--preset-shadow, rgba(99, 102, 241, 0.08));
  overflow: hidden;
  pointer-events: none;            /* Konva proxy ловить drag/select */
  box-sizing: border-box;
}
.theory-card.is-selected {
  border-color: var(--preset-border, #6366f1);
  box-shadow: 0 0 0 3px var(--preset-shadow, rgba(99, 102, 241, 0.18));
}
/* readonly (pen/highlighter/eraser) — прозорий фон, ink проступає; body click-through */
.theory-card.is-readonly { background: rgba(255, 255, 255, 0.0); }
.theory-card.is-readonly .theory-card__body { pointer-events: none; }

.theory-card__accent-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 7px;
  border-radius: 4px 0 0 4px;
}

.theory-card__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 16px;
  border-bottom: 2px solid var(--accent, #eef2ff);
  pointer-events: none;
  transition: background 0.2s;            /* drag-handle через Konva proxy */
  user-select: none;
}
.theory-card__icon { font-size: calc(15px * var(--wb-card-text-scale, 1)); }
.theory-card__badge {
  font-size: calc(12px * var(--wb-card-text-scale, 1));
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
  /* TLV2-05C: спершу картка росте вниз (спільна авто-висота), на межі сторінки — скрол.
     `hidden` тут мовчки різав текст, коли підгонка вимикалась. */
  overflow-y: auto;
  padding: 18px 24px 22px;
  pointer-events: auto;            /* скрол/виділення тексту */
}

/* flow-root: поля останнього блоку входять у виміряну висоту потоку. */
.theory-card__flow { display: flow-root; }

.theory-card__section { margin-bottom: 18px; }
/* H0 · джерела. pointer-events:auto — інакше клік з'їдає Konva-проксі над карткою. */
.theory-card__sources { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; pointer-events: auto; }
.theory-card__sources-toggle {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: calc(12px * var(--wb-card-text-scale, 1)); color: #64748b; text-decoration: underline dotted;
}
.theory-card__sources-list { margin: 6px 0 0; padding-left: 18px; }
.theory-card__source { margin-bottom: 4px; font-size: calc(11px * var(--wb-card-text-scale, 1)); color: #64748b; }
.theory-card__source-title { color: #2563eb; }
.theory-card__source-meta { display: block; }
.theory-card__title {
  font-size: calc(20px * var(--wb-card-text-scale, 1)); font-weight: 700; color: #1e1b4b;
  line-height: 1.3; margin: 0 0 12px 0; letter-spacing: -0.01em;
}
.theory-card__text { font-size: calc(15px * var(--wb-card-text-scale, 1)); line-height: 1.7; color: #374151; }
.theory-card__text :deep(table),
.theory-card__hint :deep(table) {
  border-collapse: collapse;
  margin: 10px 0;
  font-size: calc(14px * var(--wb-card-text-scale, 1));
}
.theory-card__text :deep(th),
.theory-card__text :deep(td),
.theory-card__hint :deep(th),
.theory-card__hint :deep(td) {
  border: 1px solid #e0e7ff;
  padding: 4px 10px;
  text-align: center;
}
.theory-card__text :deep(th),
.theory-card__hint :deep(th) {
  background: #f5f3ff;
  color: #4338ca;
  font-weight: 600;
}
.theory-card__hint {
  margin-top: 14px; font-size: calc(13px * var(--wb-card-text-scale, 1)); color: #6b7280; font-style: italic;
  padding-top: 12px; border-top: 1px solid #e5e7eb;
}

.theory-card__formula-title {
  font-size: calc(15px * var(--wb-card-text-scale, 1)); font-weight: 600; color: #4338ca; margin: 0 0 14px 0;
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
.theory-card__formula-latex { font-size: calc(15px * var(--wb-card-text-scale, 1)); color: #1e1b4b; line-height: 1.4; }
.theory-card__formula-label {
  font-size: calc(11px * var(--wb-card-text-scale, 1)); color: #7c3aed; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.04em;
}
:deep(math) { font-size: 1em; }

/* N1 Фаза 3: пресети картки теорії — per-preset border */

</style>
