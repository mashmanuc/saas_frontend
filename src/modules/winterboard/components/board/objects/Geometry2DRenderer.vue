<!--
  Phase G v2 — Geometry 2D v2 renderer (bundle-backed).

  Refs:
    - vendor/geo2d/index.ts — engine entry (lazy-loaded on mount)
    - Mirror pattern: GraphCalculatorRenderer.vue (selection-driven toolbar)
    - Solids SolidCardRenderer.vue (Konva proxy + invisible Transformer overlay)

  POINTER-EVENTS MODEL (mirror GraphCalc 2026-05-06 bug fix):
    - Root container = pointer-events: none → Konva proxy ловить drag/move/resize/select.
    - Header bg / footer = inherit none → "пустий простір" як drag handle картки.
    - Interactive children opt-in pointer-events:auto:
        · delete button
        · stage (JSXGraph svg — drag free points)
        · toolbar buttons
    - Selection works через "empty header zone" → click passes to Konva proxy.

  PERSISTENCE MODEL:
    - Toolbar toggles → emit asset_update з updated `toggles`.
    - Free-point drag → debounced 400ms → emit asset_update з `pointsSnapshot`
      (PR-G5: GeoCard.onPointMove callback wired у wirePointMovePersistence).
    - On mount: applyPersistedPoints() restores snapshot via GeoCard.setFreePoints().
    - Collaboration sync via standard asset_update broadcast (ws relay).
-->
<template>
  <div
    ref="rootEl"
    class="geo2dv2-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-preset="asset.data.preset"
  >
    <!-- Header bar: pointer-events:none на bg (drag-handle для Konva proxy).
         Title + delete = auto. Mirror .gc-header pattern. -->
    <header class="geo2dv2-header">
      <span class="geo2dv2-title">{{ presetLabel }}</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="geo2dv2-delete"
        data-testid="geometry-2d-v2-delete"
        aria-label="Delete geometry"
        :title="t('winterboard.widget.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <!-- Stage — JSXGraph-style SVG live engine. pointer-events:auto всередині
         потрібно для drag free points. Сам stage container НЕ є drag-zone картки.
         pointerdown.capture — WYSIWYG-гард перекриття (overlayTopHit) ПЕРЕД
         vendor-обробниками JSXGraph (mirror GeomashRenderer.onStagePointerDown). -->
    <div
      ref="stageRef"
      class="geo2dv2-stage geo-stage"
      data-testid="geometry-2d-v2-board"
      @pointerdown.capture="onStagePointerDownCapture"
    />

    <!-- Toolbar host — bundle inject-ить туди button.tool elements (preset toggles:
         Медіани · Висоти · Бісектриси · Медіатриси · Вписане · Описане · Сер. лінія
         + Сітка · Осі · Скинути). Видимий лише при is-selected — без вибору
         показуємо тільки малюнок (CSS: :not(.is-selected) → display:none). -->
    <div
      ref="toolbarRef"
      class="geo2dv2-toolbar-host"
      data-testid="geometry-2d-v2-toolbar"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Geometry2DV2Asset } from '../../../types/geometry2dV2'
import type { GeoCardInstance, GeoPresetMeta } from '../../../vendor/geo2d'
// EXPORT_PREPARATION_SSOT (Stage 1 PR-2): thin-adapter widget snapshot.
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { topmostForeignOverlayAssetId } from '../../../utils/overlayTopHit'
import {
  registerGeo2dInspector,
  unregisterGeo2dInspector,
} from '../../../board/state/geo2dInspectorState'

const { t, te, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: Geometry2DV2Asset
    isSelected?: boolean
    interactive?: boolean
    disableAnimation?: boolean
  }>(),
  { isSelected: false, interactive: true, disableAnimation: false },
)

const emit = defineEmits<{
  'update:asset': [asset: Geometry2DV2Asset]
  delete: []
  'select-other': [assetId: string]
}>()

const rootEl = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)

/**
 * WYSIWYG при перекритті (mirror GeomashRenderer): stage має pointer-events:auto
 * на ВСІЙ площі (JSXGraph drag), тому без гарда з'їдає кліки навіть там, де
 * ВІЗУАЛЬНО зверху лежить інша картка (її обгортка pointer-events:none —
 * hit-test її не бачить). Якщо в точці кліку чужа картка намальована вище —
 * клік належить ЇЙ: перемикаємо виділення, JSXGraph події не отримує (capture+stop).
 */
function onStagePointerDownCapture(ev: PointerEvent) {
  const other = topmostForeignOverlayAssetId(ev.clientX, ev.clientY, rootEl.value)
  if (other) {
    ev.stopPropagation()
    ev.preventDefault()
    emit('select-other', other)
    return
  }
  // INV-OVERLAY-CLICK v2 п.2: pointerdown по тілу = виділення + взаємодія ОДНИМ
  // жестом — картка виділяється (транзієнт z:5, «вискакує» наверх), а JSXGraph
  // далі обробляє той самий дотик (без stopPropagation). Той самий selectItems-шлях.
  if (!props.isSelected) emit('select-other', props.asset.id)
}

// EXPORT_PREPARATION_SSOT INV-EP-8: thin adapter, no business logic here.
// JSXGraph renders SVG inside stageRef — snapshotElement picks first <svg>.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

let card: GeoCardInstance | null = null
let toolbarEl: HTMLElement | null = null
let bundleReady = false
let _pointMoveTimer: ReturnType<typeof setTimeout> | null = null

const presetLabel = computed(() => {
  // i18n-first (2026-07-16): vendor GEO_PRESETS.full — укр хардкод; переклади
  // winterboard.geo2dV2.preset.<key>.full давно існують ×3 локалі, але не читались.
  const preset = props.asset.data.preset
  const i18nKey = `winterboard.geo2dV2.preset.${preset}.full`
  if (preset && te(i18nKey)) return t(i18nKey)
  const meta = (window.GEO_PRESETS || []).find((m: GeoPresetMeta) => m.type === preset)
  return meta?.full || preset || 'Геометрія'
})

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/geo2d')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return
  const W = window as unknown as {
    GeoCard: new (el: HTMLElement, o: { type: string; i18n?: (key: string) => string | null }) => GeoCardInstance
    makeGeoToolbar: (c: GeoCardInstance, h: HTMLElement) => HTMLDivElement
  }
  const rawPreset = props.asset.data.preset
  let presetKey: string
  if (rawPreset && window.Geo2D?.PRESETS?.[rawPreset]) {
    // Валідний preset (включно з явним 'blank' — graph paper).
    presetKey = rawPreset
  } else {
    // Відсутній або невідомий preset. Стара/бита картка-компаньйон (data без
    // поля preset, напр. старий {version:2} формат) → показуємо 'triangle'
    // (видима геометрія) замість порожнечі. Явний 'blank' йде гілкою вище.
    presetKey = 'triangle'
    if (rawPreset) console.warn('[Geometry2DRenderer] Unknown preset:', rawPreset, '-> triangle')
  }
  card = new W.GeoCard(stageRef.value, {
    type: presetKey,
    // i18n (2026-08-19): підказки всередині полотна («G, H, O — колінеарні…»)
    // малює vendor, тож перекладач передаємо туди. Немає ключа в локалі →
    // повертаємо null, і vendor лишає авторський текст.
    i18n: (key: string) => {
      const full = `winterboard.geo2dV2.${key}`
      return te(full) ? t(full) : null
    },
  })
  applyPersistedToggles()
  applyPersistedPoints()
  wirePointMovePersistence()
  if (toolbarRef.value) {
    toolbarEl = W.makeGeoToolbar(card, toolbarRef.value)
    wireToolbarPersistence()
    toolbarRef.value.appendChild(toolbarEl)
    localizeToolbar()
    // Тулбар народився ПІСЛЯ watch(isSelected immediate) — якщо картка вже
    // виділена (напр. вставка з авто-виділенням), доганяємо реєстрацію інспектора.
    syncInspector(props.isSelected)
  }
  // Apply pointer-events policy based on current interactive prop.
  syncPointerEvents()
}

/**
 * Replaces bundle's hardcoded українські tool-labels на translated ones.
 * Кожна toolbar button має `data-key` attribute (preset toggle key OR
 * 'grid' | 'axes' | 'reset'). Лезо i18n key — `winterboard.geo2dV2.toggle.<key>`.
 * Якщо переклад відсутній — залишаємо bundle's default український label.
 */
function localizeToolbar(): void {
  if (!toolbarEl) return
  const buttons = toolbarEl.querySelectorAll('button.tool')
  buttons.forEach((btn) => {
    const key = (btn as HTMLElement).dataset.key
    if (!key) return
    const i18nKey = `winterboard.geo2dV2.toggle.${key}`
    if (!te(i18nKey)) return
    const labelEl = btn.querySelector('.tool-label')
    if (labelEl) labelEl.textContent = t(i18nKey)
    const title = t(i18nKey)
    btn.setAttribute('title', title)
  })
}

// Re-localize якщо locale змінюється на льоту (rare).
watch(locale, () => localizeToolbar())

function applyPersistedToggles(): void {
  if (!card) return
  const t = props.asset.data.toggles
  if (!t) return
  for (const [key, on] of Object.entries(t)) {
    try { card.setToggle(key, on) } catch { /* preset doesn't have this toggle */ }
  }
}

function applyPersistedPoints(): void {
  if (!card || !props.asset.data.pointsSnapshot) return
  card.setFreePoints(props.asset.data.pointsSnapshot)
}

function wirePointMovePersistence(): void {
  if (!card) return
  card.onPointMove = (points) => {
    if (_pointMoveTimer) clearTimeout(_pointMoveTimer)
    _pointMoveTimer = setTimeout(() => {
      _pointMoveTimer = null
      emitDataPatch({ pointsSnapshot: points })
    }, 400)
  }
}

function wireToolbarPersistence(): void {
  if (!toolbarEl || !card) return
  toolbarEl.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as HTMLElement | null)?.closest('button.tool') as HTMLElement | null
      if (!btn || !card) return
      const key = btn.dataset.key
      if (!key) return
      queueMicrotask(() => {
        if (!card) return
        const nextToggles = { ...(props.asset.data.toggles || {}), ...card.toggleState }
        emitDataPatch({ toggles: nextToggles })
      })
    },
    false,
  )
}

function destroyCard(): void {
  if (_pointMoveTimer) { clearTimeout(_pointMoveTimer); _pointMoveTimer = null }
  if (card) {
    card.onPointMove = null
    try { card.destroy() } catch { /* idempotent */ }
    card = null
  }
  if (toolbarEl && toolbarEl.parentNode) {
    toolbarEl.parentNode.removeChild(toolbarEl)
    toolbarEl = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => {
  unregisterGeo2dInspector(props.asset.id)
  destroyCard()
})

// ── Правий сайдбар-інспектор: перемикачі побудов при виділенні (запит власника
// 2026-07-16 — «кнопки знизу геометрії мають бути у правому сайдбарі»).
// vendor-тулбар ТЕЛЕПОРТУЄТЬСЯ у Geo2dInspector (appendChild переміщує вузол
// разом з live listeners); при знятті виділення — повертається у картку
// (там CSS ховає його поза .is-selected, тож візуально кнопки живуть ЛИШЕ в сайдбарі).
function syncInspector(sel: boolean): void {
  if (sel && toolbarEl) {
    registerGeo2dInspector(props.asset.id, { label: presetLabel.value, toolbarEl })
  } else {
    unregisterGeo2dInspector(props.asset.id)
    if (toolbarEl && toolbarRef.value && toolbarEl.parentElement !== toolbarRef.value) {
      toolbarRef.value.appendChild(toolbarEl) // повернути з сайдбар-хоста назад у картку
    }
  }
}
watch(() => props.isSelected, syncInspector, { immediate: true })

watch(() => props.asset.data.preset, async (next, prev) => {
  if (next === prev) return
  destroyCard()
  await mount()
})

// ── Replay sync: store → GeoCard ─────────────────────────────────────────────
// When replay applies asset_update (store.updateAsset with skipHistory), Vue
// reactively updates props.asset. These watchers push the new state into the
// live GeoCard so the geometry visually reflects the replay operation.
// No feedback loop: card.setToggle/setFreePoints are JS calls, NOT DOM events —
// wireToolbarPersistence only listens on toolbarEl.click, so no double-emit.
watch(
  () => props.asset.data.toggles,
  (newToggles) => {
    if (!card || !newToggles) return
    for (const [key, on] of Object.entries(newToggles)) {
      try { card.setToggle(key, on as boolean) } catch { /* preset missing toggle */ }
    }
  },
  { deep: true },
)

watch(
  () => props.asset.data.pointsSnapshot,
  (snapshot) => {
    if (!card || !snapshot) return
    card.setFreePoints(snapshot)
  },
  { deep: true },
)

/* ────── pointer-events sync (interactive vs draw-over mode) ──────
 * Коли !interactive — увесь bundle's SVG має пропускати pointer events до
 * Konva strokes layer, щоб pen/highlighter/eraser малювали поверх картки.
 * CSS rules часом не пробивають bundle's inline svg styles → встановлюємо
 * inline через JS на самому SVG node після кожного render циклу.
 */
function syncPointerEvents(): void {
  const stage = stageRef.value
  if (!stage) return
  const svg = stage.querySelector('svg') as SVGElement | null
  if (!svg) return
  const val = props.interactive ? '' : 'none'
  svg.style.pointerEvents = val
  // Setting on all descendants in case any have inherent visiblePainted.
  const all = svg.querySelectorAll('*')
  for (let i = 0; i < all.length; i++) {
    (all[i] as HTMLElement).style.pointerEvents = val
  }
}

watch(() => props.interactive, () => { syncPointerEvents() })
// Trigger after each toggle change (toolbar action rebuilds geometry).
watch(() => props.asset.data, () => { setTimeout(syncPointerEvents, 50) }, { deep: true })

// Phase 2.11: Інтегралик міняє toggles (описане/вписане коло, медіани…) через updateAsset —
// застосовуємо їх до ЖИВОЇ картки (без цього оновлення видно лише після перезавантаження).
watch(() => props.asset.data.toggles, () => applyPersistedToggles(), { deep: true })

function emitDataPatch(patch: Partial<Geometry2DV2Asset['data']>): void {
  const nextData = { ...props.asset.data, ...patch }
  emit('update:asset', { ...props.asset, data: nextData } as Geometry2DV2Asset)
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────────
   POINTER-EVENTS MODEL (KEY for selection/drag/resize):

   Root .geo2dv2-renderer = pointer-events:none — Konva proxy внизу catches
   drag/move/resize/select через existing asset handlers. Diveract children
   opt-in auto де потрібно (delete button, stage, toolbar).
   "Empty zones" (header bg) = inherit none → клік проходить до Konva → drag.
   ───────────────────────────────────────────────────────────────────────── */
.geo2dv2-renderer {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}

/* Read-only mode (pen/highlighter/eraser/etc.) — прибираємо білий фон,
   щоб Konva strokes на canvas-layer ПІД HTML overlay проступали наскрізь.
   SVG геометрія залишається видимою (її background — transparent).
   У select mode (interactive) — повертається білий paper-feel. */
.geo2dv2-renderer.is-readonly {
  background: transparent;
}
.geo2dv2-renderer.is-readonly .geo2dv2-header {
  background: rgba(15, 23, 42, 0.10);
}
.geo2dv2-renderer.is-readonly .geo2dv2-toolbar-host {
  background: rgba(15, 23, 42, 0.08);
}
.geo2dv2-renderer.is-readonly .geo2dv2-stage {
  background: transparent;
}
.geo2dv2-renderer.is-readonly .geo2dv2-stage :deep(.geo-stage) {
  background: transparent;
}

.geo2dv2-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #1e293b;
  /* INHERIT none — це drag-handle картки. */
  cursor: grab;
  user-select: none;
}

.geo2dv2-renderer.is-selected .geo2dv2-header {
  background: rgba(59, 130, 246, 0.08);
}

.geo2dv2-title {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.geo2dv2-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

/* Read-only mode (tool != select OR replay) — stage пропускає pointer events
   до Konva strokes layer. Це дозволяє pen/highlighter/eraser малювати ПОВЕРХ
   геометричної картки (annotation), як для 3D solids. Mirror pattern: .solid-canvas
   завжди має pointer-events:none, а тут conditionalна. */
.geo2dv2-renderer.is-readonly .geo2dv2-stage {
  pointer-events: none;
}
.geo2dv2-renderer.is-readonly .geo2dv2-stage :deep(svg) {
  pointer-events: none;
}
.geo2dv2-renderer.is-readonly .geo2dv2-stage :deep(*) {
  pointer-events: none;
}

.geo2dv2-stage :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.geo2dv2-toolbar-host {
  flex: 0 0 auto;
  padding: 5px 6px;
  background: rgba(15, 23, 42, 0.04);
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  pointer-events: auto;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.geo2dv2-toolbar-host::-webkit-scrollbar {
  display: none;
}

/* Read-only (pen/highlighter/eraser) — hover toolbar/header, тільки малюнок. */
.geo2dv2-renderer.is-readonly .geo2dv2-header {
  display: none;
}
.geo2dv2-renderer.is-readonly .geo2dv2-toolbar-host {
  display: none;
}
.geo2dv2-renderer.is-readonly .geo2dv2-toolbar-host :deep(button) {
  pointer-events: none;
}

.geo2dv2-toolbar-host :deep(.toolbar) {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
}

.geo2dv2-toolbar-host :deep(button.tool) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #f8fafc;
  color: #1e293b;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s;
}

.geo2dv2-toolbar-host :deep(button.tool:hover) {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.geo2dv2-toolbar-host :deep(button.tool.active) {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.4);
  color: #1d4ed8;
  font-weight: 500;
}

.geo2dv2-toolbar-host :deep(.tool-icon) {
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.geo2dv2-toolbar-host :deep(.tool-label) {
  font-size: 11px;
}

.geo2dv2-delete {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.78);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 50%;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  transition: background 120ms ease, border-color 120ms ease;
}

/* Read-only — delete button НЕ ловить events щоб pen/highlighter міг
   пройти повз. Кнопка візуально dim-ається. Видалити можна лише у select mode. */
.geo2dv2-renderer.is-readonly .geo2dv2-delete {
  pointer-events: none;
  opacity: 0.4;
}

.geo2dv2-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
