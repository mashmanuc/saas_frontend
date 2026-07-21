<!--
  GeomashInspector — правий сайдбар для вибраного GeoMASH-об'єкта.
  Stage A+B (2026-07-09): редактор. Палітра-плитки (з GeoEngine.toolSpec) обирає
  активний інструмент → побудова КЛІКОМ по полотну (GeomashRenderer). Список
  об'єктів зі стилем (колір/око/lock/delete). Кожна дія → один asset_update.
-->
<template>
  <div class="geo-inspector" data-testid="geomash-inspector">
    <header class="geo-inspector__head">
      <span class="geo-inspector__icon">⊙</span>
      <span class="geo-inspector__title">GeoMASH</span>
      <span class="geo-inspector__count">{{ objects.length }}</span>
    </header>

    <!-- ── Палітра-плитки ──────────────────────────────────── -->
    <template v-if="canEdit && toolSpec.length">
      <button type="button" class="geo-select-btn" :class="{ 'is-active': selectMode && !active }" :title="t('winterboard.geomash.selectBtnHint')" @click="selectArrow">
        <span class="geo-select-btn__ic">⬉</span> {{ t('winterboard.geomash.selectBtn') }}
      </button>
      <div v-if="selectMode && !active && selectedObj" class="geo-selbar">
        <input type="color" class="geo-item__color" :value="colorOf(selectedObj)" :title="t('winterboard.geomash.color')" @input="setColor(selectedObj, $event)" />
        <span class="geo-selbar__name">{{ valueOf(selectedObj) }}</span>
        <button type="button" class="geo-item__btn geo-item__btn--del" :title="t('winterboard.geomash.delete')" @click="del(selectedObj)">×</button>
      </div>
      <p class="geo-inspector__sub">{{ t('winterboard.geomash.buildHeader') }}</p>
      <div class="geo-cats">
        <div v-for="cat in categories" :key="cat" class="geo-cat">
          <span class="geo-cat__label">{{ catLabel(cat) }}</span>
          <div class="geo-cat__grid">
            <button
              v-for="e in toolsByCat[cat]"
              :key="e.labelKey"
              type="button"
              class="geo-tile"
              :class="{ 'is-active': activeKey === e.labelKey }"
              :title="toolDesc(e)"
              @click="selectTool(e)"
            >
              <span class="geo-tile__glyph">{{ GLYPHS[keyOf(e)] || '•' }}</span>
              <span class="geo-tile__label">{{ toolLabel(e) }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Розширені (Повзунок/Функція) ────────────────────── -->
      <div v-if="advancedTools.length" class="geo-adv">
        <button type="button" class="geo-adv__toggle" @click="showAdvanced = !showAdvanced">
          {{ showAdvanced ? '▾' : '▸' }} {{ t('winterboard.geomash.advanced') }}
        </button>
        <div v-if="showAdvanced" class="geo-cat__grid geo-adv__grid">
          <button
            v-for="e in advancedTools"
            :key="e.labelKey"
            type="button"
            class="geo-tile"
            :class="{ 'is-active': activeKey === e.labelKey }"
            :title="toolDesc(e)"
            @click="selectTool(e)"
          >
            <span class="geo-tile__glyph">{{ GLYPHS[keyOf(e)] || '•' }}</span>
            <span class="geo-tile__label">{{ toolLabel(e) }}</span>
          </button>
        </div>
      </div>

      <!-- ── Активний інструмент ─────────────────────────────── -->
      <div v-if="active" class="geo-active">
        <div class="geo-active__bar">
          <span class="geo-active__name">{{ active ? toolLabel(active) : '' }}</span>
          <button type="button" class="geo-active__cancel" :title="t('winterboard.geomash.cancel')" @click="cancelTool">✕</button>
        </div>

        <!-- function: без полотна — ввід виразу -->
        <template v-if="active.op === 'function'">
          <label class="geo-field">
            <span class="geo-field__lbl">f(x)</span>
            <input type="text" class="geo-field__ctl" placeholder="sin(x)" :value="extra.expr"
              @input="extra.expr = ($event.target as HTMLInputElement).value" />
          </label>
          <button type="button" class="geo-active__add" :disabled="!extra.expr.trim()" @click="addFunction">{{ t('winterboard.geomash.addFn') }}</button>
        </template>

        <template v-else>
          <p class="geo-active__hint">{{ hint }}</p>
          <!-- многокутник/ламана: завершення кнопкою (тач без дабл-тапу) -->
          <button v-if="activeMulti" type="button" class="geo-active__add" :disabled="polyCount < polyMin" @click="finishPoly">
            {{ t('winterboard.geomash.finish') }} ({{ polyCount }})
          </button>
          <!-- додаткові скаляри під конкретний інструмент -->
          <label v-if="activeK === 'CIRCLER'" class="geo-field">
            <span class="geo-field__lbl">{{ t('winterboard.geomash.radius') }}</span>
            <input type="number" step="any" class="geo-field__ctl" :value="extra.r"
              @input="extra.r = Number(($event.target as HTMLInputElement).value)" />
          </label>
          <label v-if="active.op === 'polygon-reg'" class="geo-field">
            <span class="geo-field__lbl">{{ t('winterboard.geomash.sides') }}</span>
            <input type="number" min="3" step="1" class="geo-field__ctl" :value="extra.n"
              @input="extra.n = Number(($event.target as HTMLInputElement).value)" />
          </label>
          <template v-if="active.op === 'slider'">
            <label class="geo-field"><span class="geo-field__lbl">{{ t('winterboard.geomash.name') }}</span>
              <input type="text" class="geo-field__ctl" :value="extra.name" @input="extra.name = ($event.target as HTMLInputElement).value" /></label>
            <div class="geo-field geo-field--row">
              <label><span class="geo-field__lbl">{{ t('winterboard.geomash.min') }}</span><input type="number" step="any" class="geo-field__ctl" :value="extra.min" @input="extra.min = Number(($event.target as HTMLInputElement).value)" /></label>
              <label><span class="geo-field__lbl">{{ t('winterboard.geomash.max') }}</span><input type="number" step="any" class="geo-field__ctl" :value="extra.max" @input="extra.max = Number(($event.target as HTMLInputElement).value)" /></label>
            </div>
          </template>
        </template>
      </div>
    </template>

    <!-- ── Список об'єктів ──────────────────────────────────── -->
    <p class="geo-inspector__sub">{{ t('winterboard.geomash.objectsHeader') }}</p>
    <ul v-if="objects.length" class="geo-inspector__list">
      <li v-for="o in objects" :key="o.id" class="geo-inspector__item" :class="{ 'is-sel-row': o.id === selectedId }">
        <input v-if="canEdit" type="color" class="geo-item__color" :value="colorOf(o)" :title="t('winterboard.geomash.color')" @input="setColor(o, $event)" />
        <span class="geo-item__val" :title="o.type" @click="selectRow(o)">{{ valueOf(o) }}</span>
        <template v-if="canEdit">
          <button type="button" class="geo-item__btn" :title="isVisible(o) ? t('winterboard.geomash.hide') : t('winterboard.geomash.show')" @click="toggleVisible(o)">{{ isVisible(o) ? '👁' : '🚫' }}</button>
          <button type="button" class="geo-item__btn" :title="o.locked ? t('winterboard.geomash.unlock') : t('winterboard.geomash.lock')" @click="toggleLock(o)">{{ o.locked ? '🔒' : '🔓' }}</button>
          <button type="button" class="geo-item__btn geo-item__btn--del" :title="t('winterboard.geomash.delete')" @click="del(o)">×</button>
        </template>
      </li>
    </ul>
    <p v-else class="geo-inspector__empty">{{ t('winterboard.geomash.emptyState') }}</p>

    <a class="geo-inspector__edit" href="/mash/geomash/GeoMASH.html" target="_blank" rel="noopener">{{ t('winterboard.geomash.fullEditor') }} ↗</a>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { geomashInspectorState } from '../../board/state/geomashInspectorState'
import { geomashToolState, setGeomashTool, resetGeomashTool, enterSelectMode, clearGeomashPicks } from '../../board/state/geomashToolState'
import type { GeoObject, GeoToolSpecEntry } from '../../vendor/geomash'

const bridge = computed(() => geomashInspectorState.bridge)
const objects = computed<GeoObject[]>(() => bridge.value?.objects ?? [])
const toolSpec = computed<GeoToolSpecEntry[]>(() => bridge.value?.toolSpec ?? [])
const canEdit = computed(() => bridge.value?.canEdit ?? false)

const active = computed(() => geomashToolState.activeEntry)
const selectMode = computed(() => geomashToolState.selectMode)
const selectedId = computed(() => geomashToolState.selectedGeoId)
const selectedObj = computed<GeoObject | null>(() =>
  selectedId.value ? (objects.value.find((o) => o.id === selectedId.value) ?? null) : null)
function selectArrow() { enterSelectMode() }
const activeKey = computed(() => geomashToolState.activeEntry?.labelKey ?? '')
const activeK = computed(() => (active.value ? keyOf(active.value) : ''))
const extra = geomashToolState.extra

const { t, te } = useI18n()

const categories = ['point', 'line', 'circle', 'polygon', 'measure'] as const
// i18n-first (2026-07-16): winterboard.geomash.{tool,desc,cat}.* ×3 локалі;
// словник покриває всі поточні ключі; te()-guard лишається для майбутніх
// vendor-ключів (fallback = технічний ідентифікатор, без хардкод-текстів).
function catLabel(cat: string): string {
  const k = `winterboard.geomash.cat.${cat}`
  return te(k) ? t(k) : cat
}
function toolLabel(e: GeoToolSpecEntry): string {
  const k = `winterboard.geomash.tool.${keyOf(e)}`
  return te(k) ? t(k) : e.op
}
function toolDesc(e: GeoToolSpecEntry): string {
  const k = `winterboard.geomash.desc.${keyOf(e)}`
  return te(k) ? t(k) : ''
}
/**
 * Приховані інструменти (2026-07-17, рішення власника). Обидва — vendor-заготовки
 * без проводки: давали кнопку, але не давали цінності.
 *
 * FUNCTION — НІКОЛИ не малювався: інспектор шле construct({op:'function', expr}),
 * двигун кладе `fn: cmd.fn` (geo-engine.js:517), а expr→fn ніхто не компілює →
 * рендерер малює лише при `o.fn` (geo-renderer.js:392) → об'єкт з'являвся у
 * списку сцени, але не на полотні. Геометричної інтеграції теж нема: point-on
 * проєктує лише на прямі/кола, дотична — лише до кола. Отже нічого понад
 * GraphMASH 2D (graph_calculator).
 *
 * SLIDER — малюється (перевірено піксель-діфом канви), АЛЕ його значення нікому
 * не потрібне: у двигуні slider згадано рівно 4 рази — create (520), toolSpec
 * (609), валідація координат (703) і підпис `a = 1` (735). Жодна побудова на
 * нього не посилається (немає deps/перерахунку; circle-R бере число, regpoly —
 * число). У динамічній геометрії слайдер існує заради параметризації побудов —
 * цієї проводки нема, тож він лишався декорацією.
 *
 * Двигун/рендерер НЕ чіпані: старі сцени з такими об'єктами лишаються валідними.
 * Повернення = прибрати ключ звідси (SLIDER повернеться у РОЗШИРЕНІ; для FUNCTION
 * додатково потрібна компіляція expr→fn).
 */
const HIDDEN_KEYS = new Set(['FUNCTION', 'SLIDER'])
const isHidden = (e: GeoToolSpecEntry) => HIDDEN_KEYS.has(keyOf(e))
// Розширені (рідко потрібні для геометрії) — під згорткою
const ADVANCED_KEYS = new Set(['SLIDER'])
const isAdvanced = (e: GeoToolSpecEntry) => ADVANCED_KEYS.has(keyOf(e))
const showAdvanced = ref(false)
const toolsByCat = computed<Record<string, GeoToolSpecEntry[]>>(() => {
  const m: Record<string, GeoToolSpecEntry[]> = {}
  for (const c of categories) m[c] = []
  for (const e of toolSpec.value) {
    if (isHidden(e) || isAdvanced(e)) continue
    ;(m[e.category] ??= []).push(e)
  }
  return m
})
const advancedTools = computed<GeoToolSpecEntry[]>(() =>
  toolSpec.value.filter((e) => isAdvanced(e) && !isHidden(e)),
)

const GLYPHS: Record<string, string> = {
  POINT: '•', POINT_ON: '⦿', MIDPOINT: '⊷', INTERSECT: '✕', SEGMENT: '╱', LINE: '／',
  RAY: '→', VECTOR: '⇀', POLYGON: '⬠', REGPOLY: '⬡', CIRCLE: '◯', CIRCLER: '◎',
  CIRCLE3: '◍', SEMICIRCLE: '◗', ARC: '⌒', PERP: '⊥', PARALLEL: '∥', PERPBIS: '⟂',
  ANGBIS: '∡', TANGENT: '◔', ANGLE: '∠', DISTANCE: '↔', SLIDER: '⇔', POLYLINE: '⋁', FUNCTION: 'ƒ',
}
function keyOf(e: GeoToolSpecEntry): string { return e.labelKey.split('.').pop() || e.op }

const hint = computed<string>(() => {
  const e = active.value
  if (!e) return ''
  const multi = e.inputs.find((i) => i.multi)
  if (multi) return t('winterboard.geomash.hintMulti', { n: geomashToolState.poly.length })
  if (e.inputs.length === 0) return t('winterboard.geomash.hintClickCanvas')
  const next = e.inputs.filter((i) => !i.multi).find((i) => !geomashToolState.picks[i.role])
  // next.role — vendor-рольовий текст (напр. "точка1"), НЕ локалізується тут
  return next ? t('winterboard.geomash.hintClickAt', { role: next.role }) : t('winterboard.geomash.hintBuilding')
})

function selectTool(e: GeoToolSpecEntry) {
  setGeomashTool(activeKey.value === e.labelKey ? null : e)
}
function cancelTool() { resetGeomashTool() }
function addFunction() {
  if (!extra.expr.trim() || !bridge.value) return
  bridge.value.construct({ op: 'function', expr: extra.expr.trim() })
  extra.expr = ''
}

// Multi-інструменти (многокутник/ламана): завершення кнопкою (тач — без дабл-тапу)
const activeMulti = computed(() => active.value?.inputs.some((i) => i.multi) ?? false)
const polyCount = computed(() => geomashToolState.poly.length)
const polyMin = computed(() => (active.value?.op === 'polyline' ? 2 : 3))
function finishPoly() {
  const e = active.value
  if (!e || !bridge.value || polyCount.value < polyMin.value) return
  bridge.value.construct({ op: e.op, pts: [...geomashToolState.poly] })
  clearGeomashPicks()
}

/* ── список об'єктів ─────────────────────────────────────────── */
function colorOf(o: GeoObject): string { return (typeof o.color === 'string' && o.color) ? o.color : '#1a5c38' }
function isVisible(o: GeoObject): boolean { return o.visible !== false }
function valueOf(o: GeoObject): string { return bridge.value?.valueOf(o.id) ?? o.id }
function setColor(o: GeoObject, ev: Event) { bridge.value?.restyle(o.id, { color: (ev.target as HTMLInputElement).value }) }
function toggleVisible(o: GeoObject) { bridge.value?.restyle(o.id, { visible: !isVisible(o) }) }
function toggleLock(o: GeoObject) { bridge.value?.restyle(o.id, { locked: !o.locked }) }
function del(o: GeoObject) {
  bridge.value?.remove(o.id)
  if (geomashToolState.selectedGeoId === o.id) geomashToolState.selectedGeoId = null
}
function selectRow(o: GeoObject) {
  enterSelectMode()
  geomashToolState.selectedGeoId = o.id
}
</script>

<style scoped>
.geo-inspector { padding: 12px 14px; font-family: system-ui, sans-serif; color: var(--text-primary, #0d4a3e); }
.geo-inspector__head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.geo-inspector__icon { font-size: 18px; color: #1a5c38; }
.geo-inspector__title { font-weight: 700; font-size: 14px; flex: 1; }
.geo-inspector__count { font-size: 11px; font-weight: 600; color: #1a5c38; background: rgba(26, 92, 56, 0.1); border-radius: 10px; padding: 1px 8px; }
.geo-inspector__sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary, #1f6b5a); margin: 12px 0 6px; }

/* кнопка вибору + панель виділеного */
.geo-select-btn {
  display: inline-flex; align-items: center; gap: 5px;
  margin: 4px 0 2px; padding: 5px 12px; font-size: 12px; font-weight: 600;
  border: 1px solid rgba(26, 92, 56, 0.3); border-radius: 7px; background: #fff; color: #1a5c38; cursor: pointer;
}
.geo-select-btn:hover { background: rgba(26, 92, 56, 0.06); }
.geo-select-btn.is-active { background: #1a5c38; color: #fff; border-color: #1a5c38; }
.geo-select-btn__ic { font-size: 15px; }
.geo-selbar {
  display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; padding: 6px 8px;
  border: 1px solid rgba(26, 92, 56, 0.3); border-radius: 8px; background: rgba(26, 92, 56, 0.06);
}
.geo-selbar__name { flex: 1; font-size: 12px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* плитки */
.geo-cats { display: flex; flex-direction: column; gap: 10px; }
.geo-cat__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary, #1f6b5a); }
.geo-cat__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
.geo-tile {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 8px 4px; border: 1px solid rgba(26, 92, 56, 0.22); border-radius: 9px;
  background: #fff; color: #1a5c38; cursor: pointer; transition: all 0.12s;
}
.geo-tile:hover { background: rgba(26, 92, 56, 0.07); border-color: rgba(26, 92, 56, 0.4); }
.geo-tile.is-active { background: #1a5c38; color: #fff; border-color: #1a5c38; box-shadow: 0 2px 6px rgba(26, 92, 56, 0.25); }
.geo-tile__glyph { font-size: 18px; line-height: 1; }
.geo-tile__label { font-size: 10px; text-align: center; line-height: 1.15; }
.geo-adv { margin-top: 8px; }
.geo-adv__toggle {
  border: none; background: none; cursor: pointer; font-size: 11px; font-weight: 600;
  color: var(--text-secondary, #1f6b5a); padding: 2px 0; text-transform: uppercase; letter-spacing: 0.03em;
}
.geo-adv__grid { margin-top: 4px; }

/* активний інструмент */
.geo-active { margin-top: 10px; padding: 10px; border: 1px solid rgba(26, 92, 56, 0.25); border-radius: 8px; background: rgba(26, 92, 56, 0.04); }
.geo-active__bar { display: flex; align-items: center; margin-bottom: 6px; }
.geo-active__name { font-weight: 700; font-size: 13px; flex: 1; }
.geo-active__cancel { border: none; background: none; cursor: pointer; font-size: 15px; color: #9ca3af; }
.geo-active__cancel:hover { color: #ef4444; }
.geo-active__hint { font-size: 12px; color: #1a5c38; margin: 0 0 6px; font-weight: 500; }
.geo-active__add { width: 100%; margin-top: 6px; font-size: 13px; font-weight: 600; color: #fff; background: #1a5c38; border: none; border-radius: 7px; padding: 7px; cursor: pointer; }
.geo-active__add:disabled { background: #9db8ac; cursor: not-allowed; }
.geo-field { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.geo-field--row { gap: 10px; }
.geo-field--row label { display: flex; align-items: center; gap: 6px; flex: 1; }
.geo-field__lbl { font-size: 12px; min-width: 56px; color: var(--text-secondary, #1f6b5a); }
.geo-field__ctl { flex: 1; font-size: 12px; padding: 3px 6px; border: 1px solid rgba(26, 92, 56, 0.3); border-radius: 5px; background: #fff; min-width: 0; }

/* список */
.geo-inspector__list { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow-y: auto; }
.geo-inspector__item { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 6px; font-size: 13px; }
.geo-inspector__item:nth-child(odd) { background: rgba(26, 92, 56, 0.04); }
.geo-inspector__item.is-sel-row { background: rgba(26, 92, 56, 0.16); outline: 1px solid rgba(26, 92, 56, 0.4); }
.geo-item__color { width: 20px; height: 20px; padding: 0; border: none; background: none; cursor: pointer; flex-shrink: 0; }
.geo-item__val { flex: 1; font-weight: 600; font-size: 12px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.geo-item__btn { border: none; background: none; cursor: pointer; font-size: 13px; line-height: 1; padding: 2px; flex-shrink: 0; opacity: 0.75; }
.geo-item__btn:hover { opacity: 1; }
.geo-item__btn--del { color: #9ca3af; font-size: 16px; }
.geo-item__btn--del:hover { color: #ef4444; }
.geo-inspector__empty { font-size: 13px; color: var(--text-secondary, #1f6b5a); }
.geo-inspector__edit { display: inline-block; margin-top: 12px; font-size: 12px; font-weight: 600; color: #fff; background: #1a5c38; border-radius: 7px; padding: 6px 14px; text-decoration: none; }
.geo-inspector__edit:hover { background: #124028; }
/* тач: більші таргети (≥44px) */
@media (any-pointer: coarse) {
  .geo-tile { padding: 12px 4px; }
  .geo-tile__glyph { font-size: 22px; }
  .geo-tile__label { font-size: 11px; }
  .geo-select-btn { padding: 9px 16px; font-size: 14px; }
  .geo-active__add { padding: 12px; font-size: 14px; }
  .geo-item__btn { font-size: 17px; padding: 7px; }
  .geo-item__color { width: 26px; height: 26px; }
  .geo-inspector__item { padding: 6px 4px; }
}
</style>
