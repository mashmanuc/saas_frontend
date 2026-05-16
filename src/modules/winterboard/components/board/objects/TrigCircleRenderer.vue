<!--
  TrigCircle renderer — trig_circle asset HTML overlay.

  Mirror pattern: CalculusRenderer.vue (bundle-backed, HTML overlay, Konva proxy
  catches selection, draw-tools пропускаються наскрізь у read-only).

  Bundle: vendor/trig/* — window.TrigCircle exposed after side-effect import.

  POINTER-EVENTS MODEL (mirror calculus 2026-05 pattern):
    - Root .trig-circle-renderer = pointer-events:none → Konva proxy catches drag/select.
    - Header bg = inherit none → drag handle картки.
    - Stage canvas = auto (drag point P).
    - У read-only mode (pen/highlighter active): all = none, pen draws over card.

  PERSISTENCE: opts → onChange callback → debounce 300ms → emit asset_update.
  Animate mode NOT persisted (always starts paused — user triggers manually).
-->
<template>
  <div
    class="trig-circle-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`trig-circle-renderer-${asset.id}`"
  >
    <header class="trig-circle-header">
      <span class="trig-circle-title">{{ t('winterboard.trigCircle.cardTitle') }}</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="trig-circle-delete"
        :title="t('common.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <!-- Stage — canvas mounted by bundle's TrigCircle. -->
    <div ref="stageRef" class="trig-circle-stage" data-testid="trig-circle-stage" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrigCircleAsset, TrigCircleData } from '../../../types/trigCircle'
import type { TrigCircleInstance } from '../../../vendor/trig'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: TrigCircleAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: TrigCircleAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)
let trig: TrigCircleInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_DEBOUNCE_MS = 300

/* ────── lifecycle ────── */

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/trig')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return
  const W = window as unknown as { TrigCircle: new (
    el: HTMLElement,
    o: import('../../../vendor/trig').TrigCircleOpts,
  ) => TrigCircleInstance }

  const d = props.asset.data
  trig = new W.TrigCircle(stageRef.value, {
    theta:             d.theta,
    showSin:           d.showSin,
    showCos:           d.showCos,
    showTan:           d.showTan,
    showCot:           d.showCot,
    showSpecialPoints: d.showSpecialPoints,
    showRefLabels:     d.showRefLabels,
    showDeg:           d.showDeg,
    showRad:           d.showRad,
    showExactGrid:     d.showExactGrid,
    showInscribed:     d.showInscribed,
    showGraphs:        d.showGraphs,
    snapPi12:          d.snapPi12,
    animate:           false,   // never auto-start on mount — user triggers
    speed:             d.speed,
    partialCurves:     false,
  })

  // onChange fires on drag + setOption + setTheta — debounce snapshot to store.
  trig.onChange = () => scheduleSnapshot()
}

function destroyTrig(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (trig) {
    try { trig.destroy() } catch { /* idempotent */ }
    trig = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => { destroyTrig() })

// Sync opts from store → engine when changed by remote ops or undo/redo.
// Uses keys that map 1-to-1 to TrigCircleOpts.
const SYNC_KEYS: (keyof TrigCircleData)[] = [
  'showSin', 'showCos', 'showTan', 'showCot',
  'showSpecialPoints', 'showRefLabels',
  'showDeg', 'showRad',
  'showExactGrid', 'showInscribed',
  'showGraphs', 'snapPi12', 'speed',
]

watch(
  () => SYNC_KEYS.map((k) => props.asset.data[k]),
  () => {
    if (!trig) return
    const d = props.asset.data
    for (const k of SYNC_KEYS) {
      const v = d[k]
      if (v !== undefined && (trig.opts as Record<string, unknown>)[k as string] !== v) {
        trig.setOption(k as never, v as never)
      }
    }
  },
)

watch(
  () => props.asset.data.theta,
  (next) => {
    if (!trig) return
    if (Math.abs(trig.opts.theta - next) > 0.0001) {
      trig.setTheta(next)
    }
  },
)

/* ────── emit helpers ────── */

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!trig) return
    const o = trig.opts
    const patched: TrigCircleAsset = {
      ...props.asset,
      data: {
        version:           1,
        theta:             o.theta,
        showSin:           o.showSin,
        showCos:           o.showCos,
        showTan:           o.showTan,
        showCot:           o.showCot,
        showSpecialPoints: o.showSpecialPoints,
        showRefLabels:     o.showRefLabels,
        showDeg:           o.showDeg,
        showRad:           o.showRad,
        showExactGrid:     o.showExactGrid,
        showInscribed:     o.showInscribed,
        showGraphs:        o.showGraphs,
        snapPi12:          o.snapPi12,
        speed:             o.speed,
      },
    }
    emit('update:asset', patched)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
.trig-circle-renderer {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}

.trig-circle-renderer.is-readonly {
  background: transparent;
}
.trig-circle-renderer.is-readonly .trig-circle-stage,
.trig-circle-renderer.is-readonly .trig-circle-header {
  pointer-events: none;
}

.trig-circle-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(168, 58, 91, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  cursor: grab;
  user-select: none;
}

.trig-circle-renderer.is-selected .trig-circle-header {
  background: rgba(168, 58, 91, 0.16);
}

.trig-circle-title {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
}

.trig-circle-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

.trig-circle-delete {
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
}

.trig-circle-renderer.is-readonly .trig-circle-delete {
  pointer-events: none;
  opacity: 0.4;
}

.trig-circle-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
