<!--
  GeomashRenderer — ЖИВА GeoMASH-геометрія як WBAsset (§3.7.14, B3 2026-07-07).

  Нативний рендер вбудованим headless-движком (vendor/geomash: GeoEngine +
  GeoRenderer за контрактом Guide §4) — справжні вектор-об'єкти (точки/прямі/
  кола/кути), не PNG. Дзеркало nmt3d/graph_calculator: renderer + правий
  інспектор (GeomashInspector — список об'єктів) при виділенні.

  v1 = display-live: рендер+навігація (правий сайдбар список об'єктів);
  редагування (додавання/рух точок) — deep-link «Відкрити у MASH». Незмінна
  data.scene → нуль ops write → SYSTEM_LAW чисто.

  POINTER-EVENTS: root none (Konva-proxy drag/select), кнопки auto+stop, canvas none.
-->
<template>
  <div
    ref="rootEl"
    class="geomash-card"
    :class="{ 'is-selected': isSelected, 'is-expanded': isExpanded }"
    :data-testid="`geomash-${asset.id}`"
  >
    <header class="gm-header">
      <span class="gm-badge">GeoMASH</span>
      <button
        type="button"
        class="gm-expand"
        :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
        @click.stop="emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="gm-delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>
    <div
      ref="stageEl"
      class="gm-stage"
      :class="{ 'gm-stage--interactive': stageInteractive }"
      :style="stageInteractive ? { cursor: stageCursor } : undefined"
      @pointerdown="onStagePointerDown"
      @pointermove="onStagePointerMove"
      @pointerleave="onStagePointerLeave"
      @dblclick="onStageDblClick"
      @contextmenu="onStageContextMenu"
    >
      <canvas ref="canvasEl" class="gm-canvas" />
      <div v-if="stageInteractive && toolHint" class="gm-hint">{{ toolHint }}</div>
      <div
        v-if="ctxMenu"
        class="gm-ctx"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @pointerdown.stop
        @contextmenu.prevent.stop
      >
        <div class="gm-ctx__val">{{ ctxMenuVal }}</div>
        <label class="gm-ctx__row">Колір
          <input type="color" :value="ctxMenuColor" @input="ctxSetColor" />
        </label>
        <button type="button" class="gm-ctx__del" @click="ctxDelete">{{ t('winterboard.widget.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset } from '../../../types/winterboard'
import type { GeoObject, GeoRendererInstance, GeoView, GeoCmd, GeoStylePatch, GeoToolSpecEntry } from '../../../vendor/geomash'
import { geomashInspectorState, registerGeomashInspector, unregisterGeomashInspector } from '../../../board/state/geomashInspectorState'
import type { GeomashInspectorBridge } from '../../../board/state/geomashInspectorState'
import { geomashToolState, clearGeomashPicks, resetGeomashTool, enterSelectMode } from '../../../board/state/geomashToolState'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import { topmostForeignOverlayAssetId } from '../../../utils/overlayTopHit'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean; isExpanded?: boolean }>(),
  { isSelected: false, interactive: true, isExpanded: false },
)
const emit = defineEmits<{ 'update:asset': [asset: WBAsset]; delete: []; expand: []; 'select-other': [assetId: string] }>()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let rr: GeoRendererInstance | null = null
let ro: ResizeObserver | null = null
let objects: Map<string, GeoObject> = new Map()

type GeoScn = { objects?: GeoObject[]; cs?: { ox: number; oy: number; sc: number } }

/** scene = data.scene (envelope від воронки: {objects[], cs}). */
const scene = computed<GeoScn>(() => {
  const d = props.asset.data as unknown as { scene?: GeoScn }
  return d?.scene ?? { objects: [], cs: undefined }
})

/**
 * workingScene — синхронне джерело правди між emit та флашем props (дзеркало 3D):
 * швидкі правки (construct→restyle) не встигають отримати оновлений props.asset і
 * клоберили б одне одного. Тримає останню емитнуту версію до echo-флашу.
 */
let workingScene: GeoScn | null = null
function curScene(): GeoScn { return workingScene ?? scene.value }
function curObjs(): Map<string, GeoObject> {
  const eng = window.GeoEngine
  return eng ? eng.deserialize(curScene() as never).objects : new Map()
}

/** Список об'єктів для інспектора (реактивний). */
const objectList = computed<GeoObject[]>(() => (Array.isArray(scene.value.objects) ? scene.value.objects : []))

/** Bridge — renderer синкає objects + виконавчі handlers (Stage A редактор). */
const _bridge = reactive<GeomashInspectorBridge>({
  objects: [],
  toolSpec: [],
  canEdit: false,
  canConstruct: bridgeCanConstruct,
  construct: bridgeConstruct,
  restyle: bridgeRestyle,
  remove: bridgeRemove,
  valueOf: bridgeValueOf,
})
watch(objectList, (v) => { _bridge.objects = v }, { immediate: true })
watch(() => !!props.asset.locked, (locked) => { _bridge.canEdit = !locked }, { immediate: true })

/** Спільний емітер: serialize нову Map → patch data.scene → emit (один asset_update). */
function emitObjects(next: Map<string, GeoObject>) {
  const eng = window.GeoEngine
  if (!eng) return
  const nextScene = eng.serialize(next, curScene().cs as never) as unknown as GeoScn
  workingScene = nextScene // синхронне джерело правди до echo-флашу props
  const d = (props.asset.data ?? {}) as object
  emit('update:asset', { ...props.asset, data: { ...d, scene: nextScene } } as unknown as WBAsset)
  // миттєве локальне відображення (props ще не флашнув)
  objects = eng.deserialize(nextScene as never).objects
  _bridge.objects = Array.isArray(nextScene.objects) ? nextScene.objects : []
  redraw()
}

function bridgeCanConstruct(cmd: GeoCmd): boolean {
  const eng = window.GeoEngine
  return eng ? eng.canConstruct(curObjs(), cmd).ok : false
}
function runConstruct(cmd: GeoCmd): { ok: boolean; created: string[]; error?: string } {
  const eng = window.GeoEngine
  if (!eng) return { ok: false, created: [], error: 'no-engine' }
  const res = eng.construct(curObjs(), curScene().cs, cmd)
  if ('error' in res) return { ok: false, created: [], error: res.error }
  emitObjects(res.objects)
  return { ok: true, created: res.created }
}
function bridgeConstruct(cmd: GeoCmd): { ok: boolean; error?: string } {
  const r = runConstruct(cmd)
  return { ok: r.ok, error: r.error }
}
function bridgeRestyle(id: string, patch: GeoStylePatch): void {
  const eng = window.GeoEngine
  if (!eng) return
  const res = eng.restyle(curObjs(), id, patch)
  if (!('error' in res)) emitObjects(res.objects)
}
function bridgeRemove(id: string): void {
  const eng = window.GeoEngine
  if (!eng) return
  const res = eng.remove(curObjs(), id, { withDependents: true })
  if (!('error' in res)) emitObjects(res.objects)
}
function bridgeValueOf(id: string): string {
  const eng = window.GeoEngine
  if (!eng) return id
  try { return eng.getValue(curObjs(), id) } catch { return id }
}

/* ── Canvas-click побудова (Stage B) ─────────────────────────── */
// INV-OVERLAY-CLICK v2 крок 2 (2026-07-16): тіло ЗАВЖДИ інтерактивне у
// select-режимі (interactive) — консистентний overlap-select через
// wrapper-capture guard + транзієнт-pop. isSelected прибрано з умови.
// Drag картки — лише за Title-header (тіло тепер ловить pointer). Точковий
// перетяг лишається select-first (onStagePointerDown гейтить isSelected) —
// безпечно, без випадкового розміщення точок на невиділеній картці.
const stageInteractive = computed(() =>
  !props.asset.locked && props.interactive !== false)

const dragging = ref(false)
const hoverId = ref<string | null>(null)
/** Курсор тіла-віджета: побудова=хрестик, вибір=рука(grab), тяг=grabbing. */
const stageCursor = computed(() => {
  if (!props.isSelected || props.asset.locked) return 'default'
  if (geomashToolState.activeEntry) return hoverId.value ? 'pointer' : 'crosshair'
  if (geomashToolState.selectMode) {
    if (dragging.value) return 'grabbing'
    if (hoverId.value) return objects.get(hoverId.value)?.type === 'point' ? 'grab' : 'pointer'
    return 'default'
  }
  return 'default'
})

const toolHint = computed<string>(() => {
  const ts = geomashToolState
  const e = ts.activeEntry
  if (!e) return ts.selectMode
    ? (ts.selectedGeoId ? 'Обрано · тягніть точку щоб посунути' : 'Клікніть об\'єкт щоб виділити')
    : ''
  const multi = e.inputs.find((i) => i.multi)
  if (multi) return `Клікайте точки (${geomashToolState.poly.length}) · подвійний клік — завершити`
  if (e.inputs.length === 0) return e.op === 'point' ? 'Клікніть — нова точка' : e.op === 'slider' ? 'Клікніть — повзунок' : ''
  const next = e.inputs.filter((i) => !i.multi).find((i) => !geomashToolState.picks[i.role])
  if (!next) return 'Готово'
  const acc = next.accepts
  const hasPt = acc.includes('point')
  const hasLine = acc.some((t) => ['line', 'segment', 'ray', 'vector', 'dline'].includes(t))
  const hasCirc = acc.some((t) => ['circle', 'circle3'].includes(t))
  const target = hasPt ? 'точку (або порожнє місце)'
    : hasLine && hasCirc ? 'лінію або коло'
    : hasCirc ? 'коло' : hasLine ? 'пряму/відрізок' : 'об\'єкт'
  if (hasPt) return `Клікніть ${target}`
  const nth = Object.keys(geomashToolState.picks).length ? 'наступну' : 'першу'
  return `Клікніть ${nth} ${target}`
})

function keyOfEntry(e: { labelKey: string }): string { return e.labelKey.split('.').pop() || '' }

function worldFromEvent(ev: PointerEvent | MouseEvent): { wx: number; wy: number; sx: number; sy: number } {
  const cv = canvasEl.value
  if (!cv) return { wx: 0, wy: 0, sx: 0, sy: 0 }
  const rect = cv.getBoundingClientRect()
  const sx = (ev.clientX - rect.left) * (cv.width / (rect.width || 1))
  const sy = (ev.clientY - rect.top) * (cv.height / (rect.height || 1))
  const v = currentView()
  return { wx: (sx - v.ox) / v.sc, wy: (v.oy - sy) / v.sc, sx, sy }
}
/** Останній ввід був тач → більший допуск попадання (палець неточний). */
let pointerCoarse = false
function hitTestAt(sx: number, sy: number, tol?: number): string | null {
  if (!rr) return null
  const t = tol ?? (pointerCoarse ? 24 : 10)
  try { return rr.hitTest({ objects }, currentView(), sx, sy, t) } catch { return null }
}
function typeOfId(id: string | null): string | null { return id ? (objects.get(id)?.type ?? null) : null }

/** Snap кліку: 1) існуюча точка (12px) 2) сітка (крок за масштабом). Дзеркало реального застосунку. */
function snapAt(wx: number, wy: number, excludeId?: string): { wx: number; wy: number; snapId: string | null } {
  const v = currentView()
  const tolPt = (pointerCoarse ? 20 : 12) / v.sc
  let best: GeoObject | null = null, bestD = Infinity
  for (const o of objects.values()) {
    if (o.type !== 'point' || typeof o.wx !== 'number' || o.id === excludeId) continue
    const d = Math.hypot(wx - (o.wx as number), wy - (o.wy as number))
    if (d < tolPt && d < bestD) { bestD = d; best = o }
  }
  if (best) return { wx: best.wx as number, wy: best.wy as number, snapId: best.id }
  // 2: прилипання до прямої/кола (8px) — точка сідає НА об'єкт
  const eng = window.GeoEngine as unknown as {
    lineClamp(o: unknown, x: unknown): { x: number; y: number; dx: number; dy: number; t0: number; t1: number } | null
    circleDefW(o: unknown, x: unknown): { cx: number; cy: number; r: number } | null
  } | undefined
  if (eng) {
    const tolObj = (pointerCoarse ? 13 : 8) / v.sc
    let boPt: [number, number] | null = null, boD = Infinity
    const LT = ['segment', 'line', 'ray', 'vector', 'dline']
    for (const o of objects.values()) {
      if (o.visible === false || o.id === excludeId) continue
      if (LT.includes(o.type)) {
        const lc = eng.lineClamp(objects, o); if (!lc) continue
        const len2 = lc.dx * lc.dx + lc.dy * lc.dy; if (len2 < 1e-18) continue
        let t = ((wx - lc.x) * lc.dx + (wy - lc.y) * lc.dy) / len2
        t = Math.max(lc.t0, Math.min(lc.t1, t))
        const qx = lc.x + t * lc.dx, qy = lc.y + t * lc.dy
        const d = Math.hypot(wx - qx, wy - qy)
        if (d < tolObj && d < boD) { boD = d; boPt = [qx, qy] }
      } else if (o.type === 'circle' || o.type === 'circle3') {
        const cd = eng.circleDefW(objects, o); if (!cd) continue
        const dc = Math.hypot(wx - cd.cx, wy - cd.cy); if (dc < 1e-9) continue
        const d = Math.abs(dc - cd.r)
        if (d < tolObj && d < boD) { boD = d; boPt = [cd.cx + (wx - cd.cx) / dc * cd.r, cd.cy + (wy - cd.cy) / dc * cd.r] }
      }
    }
    if (boPt) return { wx: boPt[0], wy: boPt[1], snapId: null }
  }
  // 3: сітка
  const sc = v.sc
  const st = sc >= 100 ? 0.5 : sc >= 30 ? 1 : sc >= 12 ? 2 : 5
  return { wx: Math.round(wx / st) * st, wy: Math.round(wy / st) * st, snapId: null }
}
/** Роль-точка: snapped існуюча АБО hit-точка АБО НОВА точка (=clickPt реального застосунку). */
function resolvePointAt(sx: number, sy: number, wx: number, wy: number): string | null {
  const s = snapAt(wx, wy)
  if (s.snapId) return s.snapId
  const hit = hitTestAt(sx, sy)
  if (hit && typeOfId(hit) === 'point') return hit
  return runConstruct({ op: 'point', wx: s.wx, wy: s.wy } as GeoCmd).created[0] ?? null
}
function objectRolesFilled(entry: GeoToolSpecEntry): boolean {
  const objInputs = entry.inputs.filter((i) => !i.multi)
  return objInputs.length > 0 && objInputs.every((i) => geomashToolState.picks[i.role])
}
function buildCmdFromState(entry: GeoToolSpecEntry, coords: { wx: number; wy: number }): GeoCmd {
  const c: Record<string, unknown> = { op: entry.op }
  for (const inp of entry.inputs) {
    if (!inp.multi && geomashToolState.picks[inp.role]) c[inp.role] = geomashToolState.picks[inp.role]
  }
  const key = keyOfEntry(entry)
  if (key === 'CIRCLER') c.r = geomashToolState.extra.r
  if (entry.op === 'polygon-reg') c.n = geomashToolState.extra.n
  if (entry.op === 'point-on') {
    const role = entry.inputs[0]?.role
    const pc = (role && geomashToolState.pickCoords[role]) || coords
    c.wx = pc.wx; c.wy = pc.wy
  }
  return c as GeoCmd
}

/* ── перетяг вільної точки (Stage C, batching-drag) ──────────── */
let _dragId: string | null = null
let _dragMap: Map<string, GeoObject> | null = null
function startPointDrag(id: string) {
  _dragId = id
  _dragMap = null
  dragging.value = true
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
}
function onDragMove(ev: PointerEvent) {
  const eng = window.GeoEngine
  if (!_dragId || !eng) return
  const { wx, wy } = worldFromEvent(ev)
  const s = snapAt(wx, wy, _dragId)
  const res = eng.move(curObjs(), curScene().cs, _dragId, s.wx, s.wy)
  if ('error' in res) return // похідна точка — не рухається
  _dragMap = res.objects
  objects = res.objects
  redraw()
}
function onDragUp() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  if (_dragMap) emitObjects(_dragMap) // ОДИН asset_update на mouseup
  _dragId = null
  _dragMap = null
  dragging.value = false
}

/** Hover-підсвітка об'єкта під курсором (миша/перо; на тачі нема hover).
 *  rAF-тротл: hitTest+redraw максимум раз на кадр (сцена може мати десятки об'єктів). */
let _hoverRaf = 0
function onStagePointerMove(ev: PointerEvent) {
  if (!props.isSelected || _dragId || ev.pointerType === 'touch' || _hoverRaf) return
  const { clientX, clientY } = ev
  _hoverRaf = requestAnimationFrame(() => {
    _hoverRaf = 0
    const { sx, sy } = worldFromEvent({ clientX, clientY } as PointerEvent)
    const h = hitTestAt(sx, sy)
    if (h !== hoverId.value) { hoverId.value = h; redraw() }
  })
}
function onStagePointerLeave() {
  if (hoverId.value) { hoverId.value = null; redraw() }
}

/* ── ПКМ контекст-меню (видалити / колір об'єкта) ────────────── */
const ctxMenu = ref<{ x: number; y: number; id: string } | null>(null)
const ctxMenuVal = computed(() => (ctxMenu.value ? bridgeValueOf(ctxMenu.value.id) : ''))
const ctxMenuColor = computed(() => {
  const o = ctxMenu.value ? objects.get(ctxMenu.value.id) : null
  return (o && typeof o.color === 'string' && o.color) ? (o.color as string) : '#1a5c38'
})
function onStageContextMenu(ev: MouseEvent) {
  if (!props.isSelected || props.asset.locked) return
  if (!props.isExpanded && topmostForeignOverlayAssetId(ev.clientX, ev.clientY, rootEl.value)) return
  const p = worldFromEvent(ev)
  const hit = hitTestAt(p.sx, p.sy)
  if (!hit) { ctxMenu.value = null; return }
  ev.preventDefault(); ev.stopPropagation()
  geomashToolState.selectedGeoId = hit
  const rect = stageEl.value?.getBoundingClientRect()
  ctxMenu.value = { x: ev.clientX - (rect?.left ?? 0), y: ev.clientY - (rect?.top ?? 0), id: hit }
  redraw()
}
function ctxDelete() {
  if (!ctxMenu.value) return
  const id = ctxMenu.value.id
  bridgeRemove(id)
  if (geomashToolState.selectedGeoId === id) geomashToolState.selectedGeoId = null
  ctxMenu.value = null
}
function ctxSetColor(ev: Event) {
  if (ctxMenu.value) bridgeRestyle(ctxMenu.value.id, { color: (ev.target as HTMLInputElement).value })
}
function closeCtx() { if (ctxMenu.value) ctxMenu.value = null }

function onStagePointerDown(ev: PointerEvent) {
  if (!props.isSelected || props.asset.locked) return
  // WYSIWYG при перекритті: якщо у цій точці ЗВЕРХУ намальована чужа картка
  // (не бачить hit-test через pointer-events:none) — клік належить ЇЙ:
  // перемикаємо виділення на неї, не редагуємо геометрію «крізь» неї
  if (!props.isExpanded) {
    const other = topmostForeignOverlayAssetId(ev.clientX, ev.clientY, rootEl.value)
    if (other) { emit('select-other', other); return }
  }
  pointerCoarse = ev.pointerType === 'touch'
  closeCtx()
  const entry = geomashToolState.activeEntry

  // SELECT-режим (стрілка): вибір + перетяг вільної точки
  if (!entry) {
    if (!geomashToolState.selectMode) return // ні інструмента, ні вибору → картка рух лише за Title
    ev.stopPropagation()
    const p = worldFromEvent(ev)
    const hit = hitTestAt(p.sx, p.sy)
    geomashToolState.selectedGeoId = hit
    redraw()
    if (hit && typeOfId(hit) === 'point') startPointDrag(hit)
    return
  }

  ev.stopPropagation()
  const { wx, wy, sx, sy } = worldFromEvent(ev)
  const s = snapAt(wx, wy)

  // координатні інструменти (клік = позиція, зі snap до сітки/точки)
  if (entry.inputs.length === 0) {
    if (entry.op === 'point') { if (!s.snapId) runConstruct({ op: 'point', wx: s.wx, wy: s.wy } as GeoCmd) }
    else if (entry.op === 'slider') runConstruct({ op: 'slider', wx: s.wx, wy: s.wy, name: geomashToolState.extra.name, min: geomashToolState.extra.min, max: geomashToolState.extra.max, value: geomashToolState.extra.value } as GeoCmd)
    return
  }
  // multi (polygon/polyline) — авто-створюємо точку на кліку; завершення дабл-кліком
  if (entry.inputs.some((i) => i.multi)) {
    const pid = resolvePointAt(sx, sy, wx, wy)
    if (!pid) return
    const poly = geomashToolState.poly
    // замикання кліком по ПЕРШІЙ точці (як у застосунку: close polygon on first point)
    if (entry.op === 'polygon' && poly.length >= 3 && pid === poly[0]) {
      bridgeConstruct({ op: entry.op, pts: [...poly] } as GeoCmd)
      clearGeomashPicks()
      return
    }
    // dedupe: 2-й pointerdown дабл-кліку снапиться на щойно створену точку — не дублювати
    if (poly[poly.length - 1] !== pid) poly.push(pid)
    return
  }
  // об'єктні інструменти — заповнюємо ролі по порядку (auto-create точок)
  const nextInput = entry.inputs.find((i) => !i.multi && !geomashToolState.picks[i.role])
  if (!nextInput) return
  const hit = hitTestAt(sx, sy)
  const hitType = typeOfId(hit)
  let assignId: string | null
  if (hit && hitType && nextInput.accepts.includes(hitType)) assignId = hit               // клікнули валідний об'єкт
  else if (nextInput.accepts.includes('point')) assignId = resolvePointAt(sx, sy, wx, wy)  // авто-точка
  else return                                                                              // роль потребує лінію/коло — промах
  if (!assignId) return
  geomashToolState.picks[nextInput.role] = assignId
  geomashToolState.pickCoords[nextInput.role] = { wx: s.wx, wy: s.wy }
  if (objectRolesFilled(entry)) {
    const key = keyOfEntry(entry)
    if (key === 'CIRCLER' && !(geomashToolState.extra.r > 0)) return
    if (entry.op === 'polygon-reg' && !(geomashToolState.extra.n >= 3)) return
    bridgeConstruct(buildCmdFromState(entry, { wx: s.wx, wy: s.wy }))
    clearGeomashPicks()
  }
}
function onStageDblClick(ev: MouseEvent) {
  const entry = geomashToolState.activeEntry
  if (!entry || !props.isSelected || !entry.inputs.some((i) => i.multi)) return
  ev.stopPropagation()
  const pts = [...geomashToolState.poly]
  // страховка від хвостового дубля (2-й pointerdown дабл-кліку)
  while (pts.length > 1 && pts[pts.length - 1] === pts[pts.length - 2]) pts.pop()
  const min = entry.op === 'polyline' ? 2 : 3
  if (pts.length >= min) { bridgeConstruct({ op: entry.op, pts } as GeoCmd); clearGeomashPicks() }
}

function onEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (ctxMenu.value) { ctxMenu.value = null; return }
  if (geomashToolState.selectedGeoId) { geomashToolState.selectedGeoId = null; redraw(); return }
  if (geomashToolState.activeEntry) resetGeomashTool()
  else if (props.isExpanded) emit('expand')
}

function currentView(): GeoView {
  const cv = canvasEl.value
  const w = cv?.width || 400
  const h = cv?.height || 300
  const cs = scene.value.cs
  // v1: використовуємо cs сцени, але центруємо origin у канві дошки (розмір інший, ніж у воронці)
  const sc = cs && cs.sc > 0 ? cs.sc : 40
  return { ox: w / 2, oy: h / 2, sc, w, h, dpr: 1 }
}

function redraw() {
  if (!rr || !canvasEl.value) return
  const ts = geomashToolState
  const sel = props.isSelected
  const pendingIds = sel ? [...Object.values(ts.picks), ...ts.poly] : []
  // ⚠️ рендерер очікує Set (paintObj: ui.selection.has(id)), НЕ масив
  const selection = sel && ts.selectedGeoId ? new Set([ts.selectedGeoId]) : undefined
  const hover = sel ? (hoverId.value ?? undefined) : undefined
  try {
    rr.draw({ objects }, currentView(), { showGrid: true, gridMode: 'lines', pendingIds, selection, hover })
  } catch (err) {
    console.warn('[geomash] draw failed', err)
  }
}

function sizeCanvas() {
  const cv = canvasEl.value
  const st = stageEl.value
  if (!cv || !st) return
  const w = Math.max(40, Math.round(st.clientWidth))
  const h = Math.max(40, Math.round(st.clientHeight))
  if (cv.width !== w || cv.height !== h) {
    cv.width = w
    cv.height = h
    rr?.resize?.(w, h, 1)
  }
  redraw()
}

async function mount() {
  await import('../../../vendor/geomash') // side-effect: window.GeoEngine + createGeoRenderer
  const engine = window.GeoEngine
  const make = window.createGeoRenderer
  if (!canvasEl.value || !engine || !make) return
  objects = engine.deserialize(scene.value as never).objects
  try { _bridge.toolSpec = engine.toolSpec() } catch { /* старий движок без конструктора */ }
  rr = make(canvasEl.value, { engine })
  requestAnimationFrame(() => { sizeCanvas(); requestAnimationFrame(sizeCanvas) })
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(stageEl.value)
  }
}

onMounted(mount)

// data.scene змінилась (replay/update/echo) → перечитати об'єкти + перемалювати
watch(() => JSON.stringify(scene.value), (json) => {
  // props флашнув версію, відмінну від нашої емитнутої → зовнішня зміна, скидаємо working
  if (workingScene && JSON.stringify(workingScene) !== json) workingScene = null
  const engine = window.GeoEngine
  if (engine) objects = engine.deserialize(scene.value as never).objects
  redraw()
})

// Правий інспектор — bridge при виділенні (дзеркало graph_calculator)
watch(() => props.isSelected, (sel) => {
  if (sel) { registerGeomashInspector(props.asset.id, _bridge); enterSelectMode() }
  else {
    // reset tool-state ЛИШЕ якщо реєстрація ще наша: інша geomash-картка могла вже
    // зареєструватись (порядок watcher-ів між інстансами не гарантований) —
    // безумовний reset вимикав би її щойно увімкнений select-режим
    const wasMine = geomashInspectorState.assetId === props.asset.id
    unregisterGeomashInspector(props.asset.id)
    if (wasMine) resetGeomashTool()
  }
}, { immediate: true })

// підсвітка виділення/pending змінилась → перемалювати
watch(() => [geomashToolState.selectedGeoId, geomashToolState.poly.length, JSON.stringify(geomashToolState.picks)],
  () => { if (props.isSelected) redraw() })

// Розгортання на цілу дошку — переміряти canvas після зміни розміру контейнера
watch(() => props.isExpanded, () => { requestAnimationFrame(() => { sizeCanvas(); requestAnimationFrame(sizeCanvas) }) })

if (typeof window !== 'undefined') window.addEventListener('keydown', onEsc)

onBeforeUnmount(() => {
  const wasMine = geomashInspectorState.assetId === props.asset.id
  unregisterGeomashInspector(props.asset.id)
  if (wasMine) resetGeomashTool()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onEsc)
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragUp)
  }
  if (_hoverRaf) { cancelAnimationFrame(_hoverRaf); _hoverRaf = 0 }
  try { ro?.disconnect() } catch { /* noop */ }
  ro = null
  try { rr?.destroy?.() } catch { /* noop */ }
  rr = null
})

useExportCapture(() => props.asset?.id, (signal) => snapshotElement(rootEl.value, signal))
</script>

<style scoped>
.geomash-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid rgba(26, 92, 56, 0.4);
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 2px 10px rgba(26, 92, 56, 0.12);
}
.geomash-card.is-selected { border-color: #1a5c38; }
.gm-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(26, 92, 56, 0.08);
  flex-shrink: 0;
}
.gm-badge { font-size: 11px; font-weight: 700; color: #1a5c38; flex: 1; }
.gm-expand, .gm-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  color: #1a5c38;
}
.gm-expand:hover { color: #124028; }
.gm-delete { color: #9ca3af; font-size: 16px; }
.gm-delete:hover { color: #ef4444; }
.gm-stage { flex: 1; min-height: 0; position: relative; pointer-events: none; }
.gm-stage--interactive { pointer-events: auto; touch-action: none; }
.gm-canvas { display: block; width: 100%; height: 100%; }
.gm-hint {
  position: absolute;
  left: 6px;
  bottom: 6px;
  background: rgba(26, 92, 56, 0.92);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  pointer-events: none;
  white-space: nowrap;
}
.gm-ctx {
  position: absolute;
  z-index: 20;
  pointer-events: auto;
  background: #fff;
  border: 1px solid rgba(26, 92, 56, 0.35);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  padding: 6px;
  min-width: 128px;
  font-size: 12px;
}
.gm-ctx__val { font-weight: 600; color: #1a5c38; padding: 2px 4px 6px; border-bottom: 1px solid rgba(26, 92, 56, 0.12); margin-bottom: 4px; }
.gm-ctx__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px; }
.gm-ctx__del { border: none; background: none; cursor: pointer; color: #ef4444; font-weight: 600; text-align: left; padding: 5px 4px; width: 100%; border-radius: 5px; }
.gm-ctx__del:hover { background: rgba(239, 68, 68, 0.08); }
/* тач: більші таргети */
@media (pointer: coarse) {
  .gm-expand, .gm-delete { font-size: 20px; padding: 4px 8px; }
  .gm-header { padding: 8px 10px; }
  .gm-hint { font-size: 13px; padding: 5px 12px; }
  .gm-ctx { min-width: 168px; font-size: 14px; }
  .gm-ctx__row { padding: 9px 4px; }
  .gm-ctx__del { padding: 11px 6px; }
}
</style>
