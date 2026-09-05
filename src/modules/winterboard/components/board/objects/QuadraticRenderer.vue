<!--
  QuadraticRenderer — quadratic_card renderer.
  ax² + bx + c = 0: parabola, discriminant, roots, draggable handles.

  Mirror pattern: CalculusRenderer.vue (bundle-backed HTML overlay, Konva proxy underneath).

  POINTER-EVENTS MODEL:
    - Root .quad-renderer = pointer-events:none → Konva proxy catches drag/select.
    - Header = none → drag handle.
    - Stage canvas = auto (drag handles on canvas).
    - У read-only mode (pen/highlighter active): all = none.

  PERSISTENCE: onChange callback → debounced emit asset_update з patched data.
-->
<template>
  <div
    class="quad-renderer"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
    }"
    :data-testid="`quad-renderer-${asset.id}`"
  >
    <header class="quad-header">
      <span class="quad-title">ax² + bx + c {{ asset.data.sign ?? '=' }} 0</span>
      <span v-if="!isSelected" class="quad-expr-readonly">
        {{ exprText }} {{ asset.data.sign ?? '=' }} 0
      </span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="quad-delete"
        :title="t('common.delete')"
        @click.stop="onDelete"
      >×</button>
    </header>

    <div ref="stageRef" class="quad-stage" data-testid="quad-stage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import type { QuadraticAsset, QuadSign } from '../../../types/quad'
import type { QuadraticCardInstance } from '../../../vendor/quad'
import { registerQuadInspector, unregisterQuadInspector } from '../../../board/state/quadUiState'
import type { QuadBridge } from '../../../board/state/quadUiState'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { renderPoly } from '../../../utils/polyText'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: QuadraticAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: QuadraticAsset]
  delete: []
}>()

const stageRef = ref<HTMLElement | null>(null)

useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

let card: QuadraticCardInstance | null = null
let bundleReady = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
const SNAPSHOT_DEBOUNCE_MS = 150

// ⚠️ Локальний `fmt` прибрано: вираз у шапці тепер збирає спільний
// `renderPoly` (`utils/polyText.ts`). Було `1x² − 1x − 6 = 0` — у
// математиці не пишуть ні коефіцієнт 1, ні доданок з нулем. Видно на
// демо-дошці лендингу; той самий клас дефекту за 09-04 знайшовся у
// восьми темах банку задач, і причина скрізь одна — кожне місце
// винаходило запис многочлена заново.
//
// ⚠️ `computed`, а не функція в шаблоні: вираз перечитується на кожен
// рендер картки, а коефіцієнти тягне повзунок інспектора.
const exprText = computed(() =>
  renderPoly([
    [props.asset.data.a, 'x²'],
    [props.asset.data.b, 'x'],
    [props.asset.data.c, ''],
  ]),
)

// ── Bridge ────────────────────────────────────────────────────────────────
const _bridge = reactive<QuadBridge>({
  a: props.asset.data.a,
  b: props.asset.data.b,
  c: props.asset.data.c,
  sign: (props.asset.data.sign ?? '=') as QuadSign,
  showVertex: props.asset.data.showVertex ?? true,
  showAxis:   props.asset.data.showAxis   ?? true,
  showRoots:  props.asset.data.showRoots  ?? true,
  setA:    (v) => patch({ a: v }),
  setB:    (v) => patch({ b: v }),
  setC:    (v) => patch({ c: v }),
  setSign: (v) => patch({ sign: v }),
  toggle:  (key) => patch({ [key]: !props.asset.data[key] } as Partial<QuadraticAsset['data']>),
  setPreset: (a, b, c) => patch({ a, b, c }),
})

watchEffect(() => {
  _bridge.a    = props.asset.data.a
  _bridge.b    = props.asset.data.b
  _bridge.c    = props.asset.data.c
  _bridge.sign = (props.asset.data.sign ?? '=') as QuadSign
  _bridge.showVertex = props.asset.data.showVertex ?? true
  _bridge.showAxis   = props.asset.data.showAxis   ?? true
  _bridge.showRoots  = props.asset.data.showRoots  ?? true
})

// ── Lifecycle ─────────────────────────────────────────────────────────────

async function ensureBundle(): Promise<void> {
  if (bundleReady) return
  await import('../../../vendor/quad')
  bundleReady = true
}

async function mount(): Promise<void> {
  if (!stageRef.value) return
  await ensureBundle()
  if (!stageRef.value) return

  const W = window as unknown as {
    QuadraticCard: new (el: HTMLElement, o: object) => QuadraticCardInstance
  }

  card = new W.QuadraticCard(stageRef.value, {
    a:    props.asset.data.a,
    b:    props.asset.data.b,
    c:    props.asset.data.c,
    sign: props.asset.data.sign ?? '=',
    showVertex: props.asset.data.showVertex ?? true,
    showAxis:   props.asset.data.showAxis   ?? true,
    showRoots:  props.asset.data.showRoots  ?? true,
  })
  if (props.asset.data.viewport) {
    card.viewport = { ...props.asset.data.viewport }
  }
  // Debounced snapshot on drag (handle moved)
  card.onChange = () => scheduleSnapshot()
  syncCanvasPointerEvents()
  // Bridge registration handled by watchEffect above (immediate, reactive).
}

function syncCanvasPointerEvents(): void {
  const el = stageRef.value
  if (!el) return
  const val = props.interactive ? '' : 'none'
  ;(el as HTMLElement).style.pointerEvents = val
  el.querySelectorAll('*').forEach((child) => {
    ;(child as HTMLElement).style.pointerEvents = val
  })
}

watch(() => props.interactive, syncCanvasPointerEvents)

// Register / unregister bridge as selection changes.
// watchEffect (не watch) — fires immediately on mount so the bridge
// is registered synchronously, without waiting for an isSelected→false→true transition.
watchEffect(() => {
  if (props.isSelected) registerQuadInspector(props.asset.id, _bridge)
  else unregisterQuadInspector(props.asset.id)
})

function destroyCard(): void {
  if (snapshotTimer != null) { clearTimeout(snapshotTimer); snapshotTimer = null }
  if (card) {
    try { card.destroy() } catch { /* idempotent */ }
    card = null
  }
}

onMounted(() => { void mount() })
onUnmounted(() => { unregisterQuadInspector(props.asset.id); destroyCard() })

// Sync opts when store changes
watch(
  () => [
    props.asset.data.a,
    props.asset.data.b,
    props.asset.data.c,
    props.asset.data.sign,
    props.asset.data.showVertex,
    props.asset.data.showAxis,
    props.asset.data.showRoots,
  ],
  () => {
    if (!card) return
    const d = props.asset.data
    const keys = ['a', 'b', 'c', 'sign', 'showVertex', 'showAxis', 'showRoots'] as const
    for (const k of keys) {
      const v = d[k]
      if (v !== undefined && (card.opts as Record<string, unknown>)[k] !== v) {
        card.setOption(k, v as never)
      }
    }
  },
)

// ── Emit helpers ──────────────────────────────────────────────────────────

function scheduleSnapshot(): void {
  if (snapshotTimer != null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    if (!card) return
    const patched: QuadraticAsset = {
      ...props.asset,
      data: {
        ...props.asset.data,
        a:    card.opts.a,
        b:    card.opts.b,
        c:    card.opts.c,
        sign: (card.opts as Record<string, unknown>).sign as QuadSign | undefined ?? props.asset.data.sign,
        viewport: { ...card.viewport },
      },
    }
    emit('update:asset', patched)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function patch(updates: Partial<QuadraticAsset['data']>): void {
  emit('update:asset', {
    ...props.asset,
    data: { ...props.asset.data, ...updates },
  })
}

function onDelete(): void { emit('delete') }
</script>

<style scoped>
.quad-renderer {
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

.quad-renderer.is-readonly {
  background: transparent;
}
.quad-renderer.is-readonly .quad-stage { pointer-events: none; }
.quad-renderer.is-readonly .quad-header { display: none; }

.quad-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(59, 123, 155, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  cursor: grab;
  user-select: none;
}

.quad-renderer.is-selected .quad-header {
  background: rgba(59, 123, 155, 0.15);
}

.quad-title {
  flex: 0 0 auto;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  color: #3b7b9b;
}

.quad-expr-readonly {
  flex: 1 1 auto;
  min-width: 0;
  font: 12px 'JetBrains Mono', monospace;
  color: #5a4a3a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quad-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  pointer-events: auto;
}

.quad-delete {
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
.quad-delete:hover { background: #dc2626; border-color: #f87171; }
.quad-renderer.is-readonly .quad-delete { pointer-events: none; opacity: 0.4; }
</style>
