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
    :class="[
        { 'is-selected': isSelected, 'is-readonly': !interactive },
        `preset-${effectivePreset || 'default'}`,
      ]"
    :style="{ '--accent': presetStyle.accent, '--preset-border': presetStyle.border, '--preset-shadow': presetStyle.accent + '14' }"
    :data-testid="`theory-card-${asset.id}`"
  >
    <div class="theory-card__accent-bar" :style="{ background: presetStyle.accent }" />

    <header class="theory-card__header" :style="{ background: presetStyle.accent + '10' }">
      <span class="theory-card__icon">{{ presetStyle.icon }}</span>
      <span class="theory-card__badge" :style="{ color: presetStyle.badge }">{{ data.badge || 'Теорія' }}</span>
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
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBAsset, TheoryCardData } from '../../../types/winterboard'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { detectCardPreset } from '../../../utils/detectCardPreset'

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

/** N1 Фаза 3.5: рекомендовані стартові розміри за пресетом (2026-08-07).
 *  Картка починається з цього розміру, потім автоадаптується під контент. */
const PRESET_SIZES: Record<string, { w: number; h: number }> = {
  definition:      { w: 520, h: 340 },
  rule:            { w: 520, h: 340 },
  proof:           { w: 520, h: 420 },
  tip:             { w: 440, h: 280 },
  'common mistake': { w: 480, h: 300 },
  remember:        { w: 440, h: 260 },
  example:         { w: 520, h: 340 },
  'life example':  { w: 520, h: 360 },
  algorithm:       { w: 540, h: 460 },
  summary:         { w: 480, h: 240 },
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

const presetStyle = computed(() => {
  const p = effectivePreset.value
  return (p && PRESET_STYLES[p]) ? PRESET_STYLES[p] : PRESET_STYLES.definition
})

const presetSize = computed(() => {
  const p = data.value.preset
  return (p && PRESET_SIZES[p]) ? PRESET_SIZES[p] : { w: 520, h: 380 }
})

// N1 Фаза 3.5: автоадаптація розміру картки під контент (2026-08-07).
// Алгоритм: h↑ → w↑ → scrollbar (лише як останній засіб).
const HEADER_H = 42   // theory-card__header висота + padding
const BODY_PAD = 40   // theory-card__body padding (18+22)
const MAX_H = 800
const MAX_W = 700
const H_STEP = 80
const W_STEP = 100

// Останній розмір, який ПОСТАВИВ САМ tryFit — не «бажаний», а фактично
// застосований. Порівнюємо з ним у watcher нижче: якщо asset.w/h відхилились
// від цього значення (а не від tryFit) — розмір змінив юзер (ручка ресайзу),
// і з ЦЬОГО моменту авто-фіт більше не чіпає картку (issue власника
// 2026-08-07: «дозволити юзеру вручну міняти розмір, як було»).
const lastAutoSize = ref<{ w: number; h: number } | null>(null)
const userResized = ref(false)

function tryFit() {
  if (userResized.value) return   // юзер уже сам обрав розмір — не втручаємось
  const el = rootEl.value
  if (!el) return
  const body = el.querySelector('.theory-card__body') as HTMLElement | null
  if (!body) return

  // Тимчасово прибрати overflow щоб виміряти реальну висоту
  const prevOverflow = body.style.overflowY
  body.style.overflowY = 'visible'

  nextTick(() => {
    const contentH = body.scrollHeight
    const availH = props.asset.h - HEADER_H - BODY_PAD

    if (contentH <= availH + 2) {
      // Влазить — повертаємо overflow як було
      lastAutoSize.value = { w: props.asset.w, h: props.asset.h }
      body.style.overflowY = prevOverflow || 'hidden'
      return
    }

    // Не влазить — пробуємо збільшити h
    let newH = props.asset.h
    let newW = props.asset.w

    // Спроба 1: збільшити висоту
    while (newH < MAX_H && contentH > (newH - HEADER_H - BODY_PAD)) {
      newH = Math.min(newH + H_STEP, MAX_H)
    }

    // Спроба 2: якщо висоти недостатньо — збільшити ширину (ширша картка →
    // текст перерозподіляється → менша висота). Уже на MAX_W — розширювати
    // нема куди, це термінальний стан, одразу scrollbar.
    if (newH >= MAX_H && contentH > (MAX_H - HEADER_H - BODY_PAD) && newW < MAX_W) {
      newW = Math.min(newW + W_STEP, MAX_W)
      lastAutoSize.value = { w: newW, h: newH }
      emit('update:asset', { ...props.asset, w: newW, h: newH })
      // watcher нижче на [asset.w, asset.h] сам перезапустить tryFit
      // після реального рендеру на новій ширині — рекурсивний домір,
      // не одноразова спроба (тут раніше був баг: return без домірювання).
      return
    }

    // Застосовуємо новий розмір (або лишається як є — Спроба 2 вже стоїть
    // на MAX_W і більше рости нема куди)
    if (newH !== props.asset.h || newW !== props.asset.w) {
      lastAutoSize.value = { w: newW, h: newH }
      emit('update:asset', { ...props.asset, w: newW, h: newH })
    } else {
      lastAutoSize.value = { w: newW, h: newH }
    }

    // Якщо навіть після збільшення не влазить — дозволяємо scrollbar
    // (останній засіб, а не мовчазне обрізання, як було до Фази 3.5)
    if (contentH > (newH - HEADER_H - BODY_PAD) + 2) {
      body.style.overflowY = 'auto'
    } else {
      body.style.overflowY = prevOverflow || 'hidden'
    }
  })
}

// Запускаємо після монтування і при зміні body
onMounted(() => {
  nextTick(() => tryFit())
})

watch(() => data.value.body, () => {
  nextTick(() => tryFit())
})

// Також перевіряємо при зміні preset (бо розмір може відрізнятись)
watch(() => data.value.preset, () => {
  nextTick(() => tryFit())
})

// N1 Фаза 3.5 fix (2026-08-07): переміряти при зміні розміру картки — але
// ЛИШЕ якщо розмір змінив сам tryFit (домір після власного розширення
// ширини), а не юзер ручкою resize. Порівнюємо з lastAutoSize: збіг —
// це наш власний крок, продовжуємо ланцюжок; розбіжність — юзер узяв
// контроль над розміром, більше НІКОЛИ не втручаємось для цієї картки
// (issue власника 2026-08-07: «дозволити юзеру вручну міняти розмір,
// як було» — раніше цей watcher існував ПОДВІЙНО і перебивав будь-який
// ручний resize назад, незалежно від намірів юзера).
watch(() => [props.asset.w, props.asset.h] as const, ([w, h]) => {
  if (userResized.value) return
  if (lastAutoSize.value && (w !== lastAutoSize.value.w || h !== lastAutoSize.value.h)) {
    userResized.value = true
    return
  }
  nextTick(() => tryFit())
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
  overflow-y: hidden;  /* N1 Фаза 3.5: auto-size керує, scrollbar — лише при переповненні */
  padding: 18px 24px 22px;
  pointer-events: auto;            /* скрол/виділення тексту */
}

.theory-card__section { margin-bottom: 18px; }
.theory-card__title {
  font-size: 20px; font-weight: 700; color: #1e1b4b;
  line-height: 1.3; margin: 0 0 12px 0; letter-spacing: -0.01em;
}
.theory-card__text { font-size: 15px; line-height: 1.7; color: #374151; }
.theory-card__text :deep(table),
.theory-card__hint :deep(table) {
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 14px;
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

/* N1 Фаза 3: пресети картки теорії — per-preset border */

</style>
