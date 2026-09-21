<!--
  HistoryCardRenderer — довідкова картка історичної сутності як WBAsset.

  ОДИН компонент на три подання (особа / подія / пам'ятка): змінюється вміст
  зон, не їхній порядок і не стилі. Окремий рендерер під кожне подання
  заборонений тим самим правилом, що й для шкали.

  ⚠️ ТЕХНІЧНИХ НАЗВ НА КАРТЦІ НЕМАЄ (вимога власника 2026-09-20). Ні кодів
  властивостей (`P18`, `P569`), ні ідентифікаторів, ні службових підписів полів.
  Сервер кладе в пайлоад уже людські підписи мовою матеріалу; `entity_ref` живе
  в даних лише для переходу на суміжну картку, ніколи не рендериться й не
  тлумачиться — це непрозоре посилання (інваріант `CLAUDE_RULES.md`).

  УСПАДКОВАНО З `theory_card` (THEORY_CARD_BASELINE.md, знято з коду):
    ширина 520 · accent-bar 7px · header 8/12/8/16 · body 18/24/22
    title 20/700 #1e1b4b · text 15/1.7 #374151 · badge 12/600 #4338ca
    sources 11 #64748b · attribution 10 · усі кеглі × --wb-card-text-scale
    висота через request-height → nextAutoFitHeight → asset_update

  POINTER-EVENTS (дзеркало theory_card):
    .history-card             pointer-events:none → Konva proxy ловить drag/select
    .history-card__body       pointer-events:auto → скрол і кліки
    [is-readonly] body        pointer-events:none → під олівцем ink проходить крізь
-->
<template>
  <div
    ref="rootEl"
    class="history-card"
    :class="[{ 'is-selected': isSelected, 'is-readonly': !interactive }, `variant-${data.variant}`]"
    :style="{ '--accent': variantStyle.accent, '--preset-border': variantStyle.border, ...textScaleStyle }"
  >
    <div class="history-card__accent-bar" :style="{ background: variantStyle.accent }" />

    <header class="history-card__header">
      <span class="history-card__icon" aria-hidden="true">{{ variantStyle.icon }}</span>
      <span class="history-card__badge">{{ variantStyle.badge }}</span>
      <button
        v-if="interactive && isSelected"
        type="button"
        class="history-card__delete-btn"
        :aria-label="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <div ref="bodyEl" class="history-card__body">
      <div ref="flowEl" class="history-card__flow">
        <!-- 1 · медіа. Немає зображення — зони немає разом із відступом. -->
        <figure v-if="image" class="history-card__media">
          <img
            class="history-card__image"
            :src="image.url"
            :alt="data.title"
            loading="lazy"
          >
          <figcaption class="history-card__attribution">
            <button
              type="button"
              class="history-card__attribution-toggle"
              :aria-expanded="attributionOpen"
              @click.stop="attributionOpen = !attributionOpen"
            >{{ attributionOpen ? '⌄' : '›' }} {{ shortAuthor }}</button>
            <span v-if="attributionOpen" class="history-card__attribution-full">{{ image.attribution }}</span>
          </figcaption>
        </figure>

        <!-- 2 · заголовок. Уся зона — перемикач стану. -->
        <button
          type="button"
          class="history-card__heading"
          :aria-expanded="isExpanded"
          @click.stop="toggleExpanded"
        >
          <span class="history-card__title">{{ data.title }}</span>
          <span v-if="data.subtitle" class="history-card__subtitle">{{ data.subtitle }}</span>
        </button>

        <!-- 3 · поля. Порожнє поле сюди не потрапляє: сервер його не кладе. -->
        <dl v-if="visibleFields.length" class="history-card__fields">
          <template v-for="(field, fi) in visibleFields" :key="fi">
            <dt class="history-card__field-label">{{ field.label }}</dt>
            <dd class="history-card__field-value">
              <!-- ⚠️ Теги всередині значення стоять ВПРИТУЛ навмисно: перенос
                   рядка між ними Vue лишає текстовим вузлом, і кома-роздільник
                   відривалась від значення («Полтава ,»). -->
              <span
                v-for="(value, vi) in shownValues(field, fi)"
                :key="vi"
                class="history-card__value"
              >
                <button
                  v-if="value.entity_ref && canOpenEntity"
                  type="button"
                  class="history-card__link"
                  @click.stop="emit('open-entity', value.entity_ref, value.label)"
                >{{ valueText(value, field, fi, vi) }}</button><span v-else>{{ valueText(value, field, fi, vi) }}</span><button
                  v-if="value.old_style"
                  type="button"
                  class="history-card__hint"
                  :aria-label="labels.oldStyle"
                  @click.stop="toggleOldStyle(fi, vi)"
                >?</button><span
                  v-if="openOldStyle === `${fi}:${vi}`"
                  class="history-card__old-style"
                >{{ value.old_style }} — {{ labels.oldStyle }}</span><button
                  v-if="canPin(value)"
                  type="button"
                  class="history-card__pin"
                  :aria-label="labels.toMap"
                  @click.stop="emit('to-map', value.lat as number, value.lon as number, value.label)"
                >⌖</button><span
                  v-if="value.note"
                  class="history-card__note"
                >{{ value.note }}</span></span>
              <button
                v-if="hiddenCount(field, fi) > 0"
                type="button"
                class="history-card__more"
                @click.stop="expandField(fi)"
              >+{{ hiddenCount(field, fi) }}</button>
              <button
                v-if="field.status === 'mixed'"
                type="button"
                class="history-card__mixed"
                :aria-expanded="openMixed === fi"
                @click.stop="openMixed = openMixed === fi ? null : fi"
              >{{ labels.mixed }}</button>
              <ul v-if="openMixed === fi" class="history-card__mixed-list">
                <li v-for="(value, vi) in field.values" :key="vi">{{ valueText(value) }}</li>
              </ul>
            </dd>
          </template>
        </dl>

        <!-- 3½ · що показати далі (Next Actions V1). Кнопки жива картка питає
             в бекенду за своїм entity_ref (у даних картки їх немає) і лише
             тоді, коли за ними є дані; у Replay і під олівцем їх немає.
             Результат кліку — новий об'єкт дошки. -->
        <div v-if="teachingActions.length" class="history-card__actions" role="group"
             :aria-label="labels.nextActions">
          <button
            v-for="action in teachingActions"
            :key="action.id"
            type="button"
            class="history-card__action"
            @click.stop="emit('run-action', action)"
          >{{ action.label }}</button>
        </div>

        <!-- 4 · підвал джерел — той самий вигляд, що в theory_card. -->
        <div v-if="sources.length" class="history-card__sources">
          <button
            type="button"
            class="history-card__sources-toggle"
            :aria-expanded="sourcesOpen"
            :aria-label="sourceToggleLabel"
            :title="sourceToggleLabel"
            @click.stop="sourcesOpen = !sourcesOpen"
          ><span aria-hidden="true">ⓘ</span><span>{{ sources.length }}</span></button>
          <ol v-if="sourcesOpen" class="history-card__sources-list">
            <li v-for="(ref, i) in sources" :key="i" class="history-card__source">
              <!-- Клікабельно лише справжнє веб-посилання: інакше `javascript:`
                   з чужих метаданих став би активним у картці вчителя. -->
              <a v-if="isWebUrl(ref.url)" :href="ref.url" target="_blank" rel="noopener noreferrer">{{ ref.title || ref.url }}</a>
              <span v-else>{{ ref.title }}</span>
              <span v-if="ref.license" class="history-card__source-meta">
                · <a v-if="isWebUrl(ref.license_url)" :href="ref.license_url" target="_blank" rel="noopener noreferrer">{{ ref.license }}</a>
                <span v-else>{{ ref.license }}</span>
              </span>
              <span v-if="retrievedDay(ref.retrieved_at)" class="history-card__source-meta">
                · {{ labels.retrieved }} {{ retrievedDay(ref.retrieved_at) }}
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  EntityRef,
  WBTeachingAction,
  HistoryCardData,
  HistoryCardField,
  HistoryCardValue,
  WBAsset,
} from '../../../types/winterboard'
import { cardTextScaleStyle, presentationScaleOf } from '../../../board/cardPresentation'
import { isMinimizedOnBoard } from '../../../board/objectStandard'
import { useCardContentFit } from '../../../composables/useCardContentFit'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
    /** Чи є куди відкрити суміжну картку. Без обробника значення лишається
     *  звичайним текстом: кнопка, яка нічого не робить, гірша за її
     *  відсутність. */
    canOpenEntity?: boolean
    /** Чи є на дошці карта, куди лягла б шпилька. */
    canPinToMap?: boolean
    /** Хто скаже, які дії «що далі» є в цієї сутності. Є лише в живому
     *  редагуванні тьютора — у Replay і в учня немає, тож і запиту немає. */
    loadActions?: (ref: EntityRef) => Promise<WBTeachingAction[]>
  }>(),
  { isSelected: false, interactive: true, canOpenEntity: false, canPinToMap: false,
    loadActions: undefined },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  delete: []
  'request-height': [neededPx: number]
  /** Клік на сутність — картка суміжної сутності поруч, поточна лишається. */
  'open-entity': [ref: EntityRef, label: string]
  /** Шпилька на карту дошки. Лише коли координата справді місце події. */
  'to-map': [lat: number, lon: number, label: string]
  /** Дія «що далі» — виконує кімната/шар через бекенд, картка лише просить. */
  'run-action': [action: WBTeachingAction]
}>()

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const flowEl = ref<HTMLElement | null>(null)

const EMPTY: HistoryCardData = { version: 1, variant: 'person', title: '', primary: [] }
const data = computed<HistoryCardData>(() => (props.asset.data as HistoryCardData) ?? EMPTY)

/** Дії «що далі» — НЕ стан картки (слово власника 2026-09-21): жива картка
 *  питає їх за своїм entity_ref. Немає даних — немає кнопки; жодних
 *  «вимкнених» заглушок. Під олівцем приховані, але не перепитуються. */
const loadedActions = ref<WBTeachingAction[]>([])
const entityKey = computed(() => {
  const r = data.value.entity_ref
  return r?.provider && r?.id ? `${r.provider}:${r.id}` : ''
})
let actionsRequest = 0
watch([() => props.loadActions, entityKey], ([load, key]) => {
  const ticket = ++actionsRequest
  loadedActions.value = []
  const ref0 = data.value.entity_ref
  if (typeof load !== 'function' || !key || !ref0) return
  load(ref0).then((list) => {
    if (ticket === actionsRequest) loadedActions.value = Array.isArray(list) ? list : []
  })
}, { immediate: true })
const teachingActions = computed<WBTeachingAction[]>(() =>
  props.interactive ? loadedActions.value : [])

/** Подання відрізняються лише акцентом, іконкою й підписом у шапці. */
const VARIANT_STYLES = {
  person:   { icon: '◍', accent: '#4338ca', border: '#c7d2fe', badge_uk: 'Особа',   badge_en: 'Person' },
  event:    { icon: '◈', accent: '#b45309', border: '#fde68a', badge_uk: 'Подія',   badge_en: 'Event' },
  monument: { icon: '▣', accent: '#047857', border: '#a7f3d0', badge_uk: "Пам'ятка", badge_en: 'Monument' },
  polity:   { icon: '⬢', accent: '#9f1239', border: '#fecdd3', badge_uk: 'Держава', badge_en: 'State' },
} as const

/** Підписи мовою МАТЕРІАЛУ, не UI-локалі — дзеркало theory_card. */
const LABELS: Record<string, { mixed: string; oldStyle: string; toMap: string; retrieved: string;
  nextActions: string }> = {
  uk: { mixed: 'джерела розходяться', oldStyle: 'за старим стилем', toMap: 'на карту', retrieved: 'отримано',
        nextActions: 'Що показати далі' },
  en: { mixed: 'sources disagree', oldStyle: 'old style', toMap: 'to map', retrieved: 'retrieved',
        nextActions: 'What to show next' },
}
const lang = computed(() => (data.value.content_language === 'en' ? 'en' : 'uk'))
const labels = computed(() => LABELS[lang.value])

const variantStyle = computed(() => {
  const v = VARIANT_STYLES[data.value.variant] ?? VARIANT_STYLES.person
  return { icon: v.icon, accent: v.accent, border: v.border, badge: lang.value === 'en' ? v.badge_en : v.badge_uk }
})

/** Зображення показуємо ЛИШЕ з автором і ліцензією — гейт §6.1. */
const image = computed(() => {
  const img = data.value.image
  return img && img.url && img.author && img.license ? img : null
})
const attributionOpen = ref(false)
const shortAuthor = computed(() => image.value?.author ?? '')

// ── стан картки ─────────────────────────────────────────────────────────────
// Живе в асеті, а не в компоненті: переживає reload, replay і класну кімнату.
const isExpanded = computed(() => data.value.expanded === true)

function patch(next: Partial<HistoryCardData>) {
  emit('update:asset', { ...props.asset, data: { ...data.value, ...next } })
}
function toggleExpanded() {
  if (!props.interactive) return
  patch({ expanded: !isExpanded.value })
}

const visibleFields = computed<HistoryCardField[]>(() => {
  const primary = Array.isArray(data.value.primary) ? data.value.primary : []
  if (!isExpanded.value) return primary
  const secondary = Array.isArray(data.value.secondary) ? data.value.secondary : []
  return [...primary, ...secondary]
})

// ── кілька значень: до 3, далі «+N» ─────────────────────────────────────────
const SHOWN = 3
const fieldsOpen = ref<Set<number>>(new Set())
const openMixed = ref<number | null>(null)
const openOldStyle = ref<string | null>(null)

function shownValues(field: HistoryCardField, index: number): HistoryCardValue[] {
  const all = Array.isArray(field.values) ? field.values : []
  return fieldsOpen.value.has(index) ? all : all.slice(0, SHOWN)
}
function hiddenCount(field: HistoryCardField, index: number): number {
  if (fieldsOpen.value.has(index)) return 0
  const total = field.total ?? (field.values?.length ?? 0)
  return Math.max(0, total - SHOWN)
}
function expandField(index: number) {
  const next = new Set(fieldsOpen.value)
  next.add(index)
  fieldsOpen.value = next
}
function toggleOldStyle(fi: number, vi: number) {
  const key = `${fi}:${vi}`
  openOldStyle.value = openOldStyle.value === key ? null : key
}
/**
 * Текст значення РАЗОМ із комою-роздільником.
 *
 * ⚠️ Кома навмисно всередині тексту, а не окремим вузлом і не через
 * `::after`. Обидва варіанти пробували: Vue лишає між елементами значення
 * службові вузли `<!--v-if-->` з переносами рядків, і кома відривалась —
 * «диктатор , квестор». Усередині інтерполяції взятися пробілу нізвідки.
 */
function valueText(
  value: HistoryCardValue,
  field?: HistoryCardField,
  fieldIndex?: number,
  valueIndex?: number,
): string {
  const text = value.display || value.label || ''
  if (!field || fieldIndex === undefined || valueIndex === undefined) return text
  const last = valueIndex === shownValues(field, fieldIndex).length - 1
  return last ? text : `${text},`
}
/**
 * Шпилька лише коли (а) координата справді є — центроїд країни сервер не
 * кладе; і (б) на дошці є карта, куди її поставити. Друга умова так само
 * важлива: кнопка без адресата виглядає робочою й нічого не робить.
 */
function canPin(value: HistoryCardValue): boolean {
  return props.canPinToMap
    && typeof value.lat === 'number' && typeof value.lon === 'number'
}

// ── джерела — той самий блок, що в theory_card ──────────────────────────────
const WEB_URL = /^https?:\/\/.+/i
const isWebUrl = (url: unknown) => typeof url === 'string' && WEB_URL.test(url.trim())
function retrievedDay(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? '' : new Date(ts).toISOString().slice(0, 10)
}
const sources = computed(() => (Array.isArray(data.value.sources) ? data.value.sources : []))
const sourcesOpen = ref(false)
const sourceToggleLabel = computed(
  () => `${lang.value === 'en' ? 'Sources' : 'Джерела'}: ${sources.value.length}`,
)

// ── подання: спільний масштаб і спільна авто-висота ─────────────────────────
const textScaleStyle = computed(() => cardTextScaleStyle(props.asset))

useCardContentFit({
  root: rootEl,
  body: bodyEl,
  flow: flowEl,
  canMeasure: () => props.interactive && !isMinimizedOnBoard(props.asset),
  // Стежимо за ВМІСТОМ, не за кількістю: розкриття будь-якого блоку робить
  // картку вищою, згортання повертає висоту назад.
  sources: [
    () => data.value.title,
    () => data.value.subtitle,
    () => data.value.variant,
    () => JSON.stringify(data.value.image ?? null),
    () => JSON.stringify(data.value.primary ?? []),
    () => JSON.stringify(data.value.secondary ?? []),
    () => JSON.stringify(data.value.sources ?? []),
    () => isExpanded.value,
    () => sourcesOpen.value,
    () => attributionOpen.value,
    () => openMixed.value,
    () => openOldStyle.value,
    () => [...fieldsOpen.value].join(','),
    () => data.value.content_language,
    () => presentationScaleOf(props.asset),
    // Рядок «що показати далі» приходить із бекенду вже ПІСЛЯ монтування —
    // без цього джерела картка не перемірялась, і кнопки ховались під скрол.
    () => teachingActions.value.map((a) => a.id).join(','),
    () => props.asset.w,
  ],
  emitHeight: (neededPx) => emit('request-height', neededPx),
})

useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)
</script>

<style scoped>
/* Конверт — один в один із theory_card (THEORY_CARD_BASELINE.md). */
.history-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid var(--preset-border, #c7d2fe);
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}
.history-card.is-selected {
  border-color: var(--accent, #4338ca);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
/* Під олівцем/маркером/гумкою ink проходить крізь картку. */
.history-card.is-readonly { background: rgba(255, 255, 255, 0); }
.history-card.is-readonly .history-card__body { pointer-events: none; }

.history-card__accent-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 7px;
  border-radius: 4px 0 0 4px;
}

.history-card__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 16px;
  border-bottom: 2px solid var(--preset-border, #eef2ff);
  pointer-events: none;
  user-select: none;
}
.history-card__icon { font-size: calc(15px * var(--wb-card-text-scale, 1)); }
.history-card__badge {
  font-size: calc(12px * var(--wb-card-text-scale, 1));
  font-weight: 600;
  color: var(--accent, #4338ca);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex: 1 1 auto;
}
.history-card__delete-btn {
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
.history-card__delete-btn:hover { background: #dc2626; border-color: #f87171; }
.history-card.is-readonly .history-card__delete-btn { pointer-events: none; opacity: 0.4; }

.history-card__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px 22px;
  pointer-events: auto;
}
.history-card__flow { display: flow-root; }

/* 1 · медіа */
/* Стеля картинки — частка ШИРИНИ картки, а не 260 екранних px (власник
   2026-09-21: «при збільшенні/зменшенні картинка ховається»). Картка на екрані
   ширшає зі зумом, а фіксована стеля лишалась 260 px — `cover` обрізав портрет
   до смужки очей. Тепер пропорція кадру не залежить від зуму, а `contain`
   показує портрет цілим (поля — фоном), пейзаж і так вміщається без полів. */
.history-card__body { container-type: inline-size; }
.history-card__media { margin: 0 0 14px; }
.history-card__image {
  display: block;
  width: 100%;
  max-height: 260px;
  max-height: 62cqw;
  object-fit: contain;
  border-radius: 3px;
  background: #f1f5f9;
}
.history-card__attribution {
  margin-top: 4px;
  font-size: calc(10px * var(--wb-card-text-scale, 1));
  line-height: 1.35;
  color: #64748b;
}
.history-card__attribution-toggle {
  background: none; border: none; padding: 2px 4px; cursor: pointer;
  font: inherit; color: inherit;
}
.history-card__attribution-full { display: block; padding: 2px 4px; }

/* 2 · заголовок — уся зона перемикає стан */
.history-card__heading {
  display: block;
  width: 100%;
  text-align: left;
  background: none; border: none; padding: 0 0 12px; cursor: pointer;
  /* Ціль торкання пера й пульта — не менша за 44px (ТЗ §7). */
  min-height: 44px;
}
.history-card__title {
  display: block;
  font-size: calc(20px * var(--wb-card-text-scale, 1));
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: #1e1b4b;
}
.history-card__subtitle {
  display: block;
  margin-top: 4px;
  font-size: calc(15px * var(--wb-card-text-scale, 1));
  line-height: 1.5;
  color: #6b7280;
}

/* 3 · поля */
.history-card__fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 14px;
  margin: 0;
  align-items: baseline;
}
.history-card__field-label {
  font-size: calc(13px * var(--wb-card-text-scale, 1));
  color: #6b7280;
  white-space: nowrap;
}
.history-card__field-value {
  margin: 0;
  font-size: calc(15px * var(--wb-card-text-scale, 1));
  line-height: 1.6;
  color: #374151;
}
.history-card__value + .history-card__value { margin-left: 4px; }

.history-card__link {
  background: none; border: none; padding: 0; cursor: pointer;
  font: inherit; color: #4338ca;
  border-bottom: 1px dotted currentColor;
}
.history-card__hint,
.history-card__pin,
.history-card__more,
.history-card__mixed {
  background: none; border: none; cursor: pointer;
  font-family: inherit;
  padding: 2px 6px;
  margin-left: 4px;
  border-radius: 3px;
}
.history-card__hint, .history-card__pin {
  font-size: calc(12px * var(--wb-card-text-scale, 1));
  color: #64748b;
  background: #f1f5f9;
}
.history-card__more {
  font-size: calc(12px * var(--wb-card-text-scale, 1));
  color: #4338ca;
  background: #eef2ff;
}
.history-card__mixed {
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  color: #92400e;
  background: #fef3c7;
}
.history-card__old-style,
.history-card__note {
  display: inline-block;
  margin-left: 6px;
  font-size: calc(12px * var(--wb-card-text-scale, 1));
  color: #6b7280;
  font-style: italic;
}
.history-card__mixed-list {
  margin: 6px 0 0; padding-left: 18px;
  font-size: calc(13px * var(--wb-card-text-scale, 1));
  color: #6b7280;
}

/* 4 · джерела — вигляд theory_card, площа торкання більша (ТЗ §7) */
.history-card__actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 12px; pointer-events: auto;
}
.history-card__action {
  display: inline-flex; align-items: center;
  min-height: 32px; padding: 4px 12px;
  border: 1px solid var(--preset-border, #e2e8f0); border-radius: 999px;
  background: #fff; cursor: pointer;
  font-size: calc(13px * var(--wb-card-text-scale, 1)); font-weight: 600;
  color: var(--accent, #4338ca);
}
.history-card__action:hover,
.history-card__action:focus-visible { background: #f8fafc; }
.history-card__sources {
  display: flex; justify-content: flex-end;
  margin-top: 10px; pointer-events: auto;
}
.history-card__sources:has(.history-card__sources-list) { display: block; }
.history-card__sources-toggle {
  display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px;
  background: none; border: none; cursor: pointer;
  padding: 2px 4px;
  min-height: 44px;
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  color: #64748b;
}
.history-card__sources-toggle:hover,
.history-card__sources-toggle:focus-visible,
.history-card__sources-toggle[aria-expanded='true'] { opacity: 0.9; background: #f8fafc; }
.history-card__sources-list { margin: 6px 0 0; padding-left: 18px; }
.history-card__source {
  margin-bottom: 4px;
  font-size: calc(11px * var(--wb-card-text-scale, 1));
  color: #64748b;
}
.history-card__source-meta { color: #94a3b8; }
</style>
