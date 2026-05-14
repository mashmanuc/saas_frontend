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

  PERSISTENCE LIMITATION (acknowledged):
    - Bundle engine має internal Construction state. Drag free-points оновлює
      візуальний render моментально (sols-board), але coords не syncяться у store.
    - Collaboration sync — окремий PR-G5 scope.
    - Toolbar toggles → emit asset_update з updated `toggles` (працює зараз).
-->
<template>
  <div
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
        title="Видалити"
        @click.stop="onDelete"
      >×</button>
    </header>

    <!-- Stage — JSXGraph-style SVG live engine. pointer-events:auto всередині
         потрібно для drag free points. Сам stage container НЕ є drag-zone картки. -->
    <div ref="stageRef" class="geo2dv2-stage geo-stage" data-testid="geometry-2d-v2-board" />

    <!-- Toolbar host — bundle inject-ить туди button.tool elements (preset toggles:
         Медіани · Висоти · Бісектриси · Медіатриси · Вписане · Описане · Сер. лінія
         + Сітка · Осі · Скинути). Завжди visible — як у standalone bundle demo,
         щоб toggles були доступні без обов'язкової селекції. -->
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
}>()

const stageRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)

let card: GeoCardInstance | null = null
let toolbarEl: HTMLElement | null = null
let bundleReady = false

const presetLabel = computed(() => {
  const meta = (window.GEO_PRESETS || []).find((m: GeoPresetMeta) => m.type === props.asset.data.preset)
  return meta?.full || props.asset.data.preset || 'Геометрія'
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
    GeoCard: new (el: HTMLElement, o: { type: string }) => GeoCardInstance
    makeGeoToolbar: (c: GeoCardInstance, h: HTMLElement) => HTMLDivElement
  }
  const presetKey = props.asset.data.preset || 'blank'
  if (!window.Geo2D?.PRESETS?.[presetKey]) {
    console.warn('[Geometry2DRenderer] Unknown preset:', presetKey, '— falling back to blank')
    card = new W.GeoCard(stageRef.value, { type: 'blank' })
  } else {
    card = new W.GeoCard(stageRef.value, { type: presetKey })
  }
  applyPersistedToggles()
  if (toolbarRef.value) {
    toolbarEl = W.makeGeoToolbar(card, toolbarRef.value)
    wireToolbarPersistence()
    toolbarRef.value.appendChild(toolbarEl)
    localizeToolbar()
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
  if (card) {
    try { card.destroy() } catch { /* idempotent */ }
    card = null
  }
  if (toolbarEl && toolbarEl.parentNode) {
    toolbarEl.parentNode.removeChild(toolbarEl)
    toolbarEl = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => { destroyCard() })

watch(() => props.asset.data.preset, async (next, prev) => {
  if (next === prev) return
  destroyCard()
  await mount()
})

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

/* Read-only mode — toolbar теж пропускає events щоб user міг малювати поверх. */
.geo2dv2-renderer.is-readonly .geo2dv2-toolbar-host {
  pointer-events: none;
  opacity: 0.55;
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
