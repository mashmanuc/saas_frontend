<!--
  Graphmash3dInspector — правий сайдбар для вибраної GraphMASH 3D-поверхні (§3.7.15, B4).
  Показується GroupContentSidebar коли graphmash3dInspectorState.bridge !== null.
  v1: навігація — список виразів-поверхонь (колір+кольормапа) + deep-link редагування.
-->
<template>
  <div class="gm3d-inspector" data-testid="graphmash3d-inspector">
    <header class="gm3d-inspector__head">
      <span class="gm3d-inspector__icon">△</span>
      <span class="gm3d-inspector__title">GraphMASH 3D</span>
      <span class="gm3d-inspector__count">{{ expressions.length }}</span>
    </header>

    <div class="gm3d-inspector__sec-head">
      <p class="gm3d-inspector__sub">Поверхні</p>
      <button
        type="button"
        class="gm3d-inspector__add"
        :disabled="!canAdd"
        :title="canAdd ? 'Додати поверхню' : 'Досягнуто ліміту'"
        @click="onAdd"
      >+ поверхня</button>
    </div>

    <ul v-if="expressions.length" class="gm3d-inspector__list">
      <li v-for="e in expressions" :key="e.id" class="gm3d-inspector__surface">
        <div class="gm3d-inspector__item">
          <button
            type="button"
            class="gm3d-inspector__eye"
            :class="{ 'is-off': !e.visible }"
            :disabled="e.objIdx < 0"
            :title="e.visible ? 'Приховати' : 'Показати'"
            @click="onVis(e.objIdx, !e.visible)"
          >{{ e.visible ? '👁' : '🚫' }}</button>
          <input
            type="color"
            class="gm3d-inspector__color"
            :value="e.color"
            :disabled="e.objIdx < 0"
            title="Колір поверхні"
            @change="onColorPick(e.objIdx, ($event.target as HTMLInputElement).value)"
          />
          <input
            class="gm3d-inspector__src-input"
            :value="e.src"
            :disabled="e.objIdx < 0"
            spellcheck="false"
            title="Редагувати формулу (Enter застосувати)"
            @change="onEditSrc(e.objIdx, ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
          <button
            type="button"
            class="gm3d-inspector__act"
            :disabled="e.objIdx < 0"
            title="Дублювати поверхню"
            @click="onDup(e.objIdx)"
          >⧉</button>
          <button
            type="button"
            class="gm3d-inspector__act gm3d-inspector__act--del"
            :disabled="e.objIdx < 0"
            title="Видалити поверхню"
            @click="onDel(e.objIdx)"
          >✕</button>
        </div>
        <div class="gm3d-inspector__ctrls">
          <select
            class="gm3d-inspector__cm-select"
            :value="e.colorMap"
            :disabled="e.objIdx < 0"
            @change="onCm(e.objIdx, e.id, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="cm in colorMaps" :key="cm" :value="cm">{{ cm }}</option>
          </select>
          <label class="gm3d-inspector__wire">
            <input
              type="checkbox"
              :checked="e.wireframe"
              :disabled="e.objIdx < 0"
              @change="onWire(e.objIdx, e.id, ($event.target as HTMLInputElement).checked)"
            />
            каркас
          </label>
        </div>
        <div class="gm3d-inspector__prop">
          <span class="gm3d-inspector__prop-lbl">прозорість</span>
          <input
            type="range" min="0.1" max="1" step="0.05"
            class="gm3d-inspector__slider" :value="e.opacity" :disabled="e.objIdx < 0"
            @input="onOpac(e.objIdx, e.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="gm3d-inspector__prop-val">{{ fmt(e.opacity) }}</span>
        </div>
        <div class="gm3d-inspector__prop">
          <span class="gm3d-inspector__prop-lbl">деталізація</span>
          <input
            type="range" min="12" max="120" step="4"
            class="gm3d-inspector__slider" :value="e.resolution" :disabled="e.objIdx < 0"
            @input="onRes(e.objIdx, e.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="gm3d-inspector__prop-val">{{ e.resolution }}</span>
        </div>
        <div class="gm3d-inspector__prop">
          <span class="gm3d-inspector__prop-lbl">домен ±</span>
          <input
            type="range" min="1" max="20" step="1"
            class="gm3d-inspector__slider" :value="e.range" :disabled="e.objIdx < 0"
            @input="onDom(e.objIdx, e.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="gm3d-inspector__prop-val">{{ e.range }}</span>
        </div>
      </li>
    </ul>
    <p v-else class="gm3d-inspector__empty">Порожня сцена</p>

    <!-- Параметри-слайдери (редагування → asset_update ops) -->
    <template v-if="params.length">
      <p class="gm3d-inspector__sub">Параметри</p>
      <div v-for="p in params" :key="p.name" class="gm3d-inspector__param">
        <div class="gm3d-inspector__param-row">
          <button
            type="button"
            class="gm3d-inspector__play"
            :class="{ 'is-playing': p.playing }"
            :title="p.playing ? 'Пауза' : 'Авто-зміна (програти)'"
            @click="onPlay(p.name, p.playing)"
          >{{ p.playing ? '⏸' : '▶' }}</button>
          <span class="gm3d-inspector__param-name">{{ p.name }}</span>
          <span class="gm3d-inspector__param-val">{{ fmt(p.value) }}</span>
        </div>
        <input
          type="range"
          class="gm3d-inspector__slider"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          :value="p.value"
          @input="onSlider(p.name, ($event.target as HTMLInputElement).value)"
        />
        <!-- Межі [min…max] (діапазон слайдера + ▶ анімації) -->
        <div class="gm3d-inspector__param-range">
          <span class="gm3d-inspector__param-range-lbl">межі</span>
          <input
            type="number" class="gm3d-inspector__num" :value="p.min"
            title="Мінімум"
            @change="onPRange(p, 'min', ($event.target as HTMLInputElement).value)"
          />
          <span class="gm3d-inspector__prop-dash">…</span>
          <input
            type="number" class="gm3d-inspector__num" :value="p.max"
            title="Максимум"
            @change="onPRange(p, 'max', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </template>

    <!-- Камера (view-only) -->
    <p class="gm3d-inspector__sub">Камера</p>
    <div class="gm3d-inspector__cam">
      <button type="button" class="gm3d-inspector__cam-btn" @click="bridge?.onResetView()">Скинути</button>
      <button type="button" class="gm3d-inspector__cam-btn" @click="bridge?.onFitView()">Вписати</button>
      <label class="gm3d-inspector__wire">
        <input type="checkbox" :checked="ortho" @change="bridge?.onOrtho(($event.target as HTMLInputElement).checked)" />
        орто
      </label>
      <label class="gm3d-inspector__wire">
        <input type="checkbox" :checked="autoRotate" @change="bridge?.onAutoRotate(($event.target as HTMLInputElement).checked)" />
        обертання
      </label>
    </div>
    <p class="gm3d-inspector__hint">Обертання мишею: перетягни поверхню коли виділено</p>

    <a class="gm3d-inspector__edit" href="/mash/grapher-3d/index.html" target="_blank" rel="noopener">
      Редагувати у GraphMASH 3D ↗
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { graphmash3dInspectorState } from '../../board/state/graphmash3dInspectorState'
import type { Gm3dExprEntry, Gm3dParamEntry } from '../../board/state/graphmash3dInspectorState'

const expressions = computed<Gm3dExprEntry[]>(() => graphmash3dInspectorState.bridge?.expressions ?? [])
const params = computed<Gm3dParamEntry[]>(() => graphmash3dInspectorState.bridge?.params ?? [])
const colorMaps = computed<string[]>(() => graphmash3dInspectorState.bridge?.colorMaps ?? [])

function onSlider(name: string, raw: string) {
  const v = parseFloat(raw)
  if (Number.isFinite(v)) graphmash3dInspectorState.bridge?.onParamInput(name, v)
}
function onPlay(name: string, playing: boolean) {
  graphmash3dInspectorState.bridge?.onParamPlay(name, !playing)
}
function onPRange(p: Gm3dParamEntry, which: 'min' | 'max', raw: string) {
  const v = parseFloat(raw)
  if (!Number.isFinite(v)) return
  const min = which === 'min' ? v : p.min
  const max = which === 'max' ? v : p.max
  graphmash3dInspectorState.bridge?.onParamRange(p.name, min, max)
}
const bridge = computed(() => graphmash3dInspectorState.bridge)
const ortho = computed<boolean>(() => graphmash3dInspectorState.bridge?.ortho ?? false)
const autoRotate = computed<boolean>(() => graphmash3dInspectorState.bridge?.autoRotate ?? false)
const canAdd = computed<boolean>(() => graphmash3dInspectorState.bridge?.canAdd ?? false)

function onEditSrc(objIdx: number, src: string) {
  graphmash3dInspectorState.bridge?.onSrc(objIdx, src)
}
function onVis(objIdx: number, visible: boolean) {
  graphmash3dInspectorState.bridge?.onVisible(objIdx, visible)
}
function onColorPick(objIdx: number, color: string) {
  graphmash3dInspectorState.bridge?.onColor(objIdx, color)
}
function onAdd() {
  graphmash3dInspectorState.bridge?.onAdd()
}
function onDup(objIdx: number) {
  graphmash3dInspectorState.bridge?.onDuplicate(objIdx)
}
function onDel(objIdx: number) {
  graphmash3dInspectorState.bridge?.onDelete(objIdx)
}
function onCm(objIdx: number, engId: number, cm: string) {
  graphmash3dInspectorState.bridge?.onColorMap(objIdx, engId, cm)
}
function onWire(objIdx: number, engId: number, on: boolean) {
  graphmash3dInspectorState.bridge?.onWireframe(objIdx, engId, on)
}
function onOpac(objIdx: number, engId: number, raw: string) {
  const v = parseFloat(raw)
  if (Number.isFinite(v)) graphmash3dInspectorState.bridge?.onOpacity(objIdx, engId, v)
}
function onRes(objIdx: number, engId: number, raw: string) {
  const v = parseFloat(raw)
  if (Number.isFinite(v)) graphmash3dInspectorState.bridge?.onResolution(objIdx, engId, v)
}
function onDom(objIdx: number, engId: number, raw: string) {
  const v = parseFloat(raw)
  if (Number.isFinite(v)) graphmash3dInspectorState.bridge?.onRange(objIdx, engId, v)
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
</script>

<style scoped>
.gm3d-inspector {
  padding: 12px 14px;
  font-family: system-ui, sans-serif;
  color: var(--text-primary, #16324a);
}
.gm3d-inspector__head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.gm3d-inspector__icon { font-size: 18px; color: #2d70b3; }
.gm3d-inspector__title { font-weight: 700; font-size: 14px; flex: 1; }
.gm3d-inspector__count {
  font-size: 11px; font-weight: 600; color: #2d70b3;
  background: rgba(45, 112, 179, 0.1); border-radius: 10px; padding: 1px 8px;
}
.gm3d-inspector__sub {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-secondary, #4a6a86); margin: 8px 0 6px;
}
.gm3d-inspector__list { list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto; }
.gm3d-inspector__item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 6px; border-radius: 6px; font-size: 13px;
}
.gm3d-inspector__item:nth-child(odd) { background: rgba(45, 112, 179, 0.04); }
.gm3d-inspector__swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.gm3d-inspector__eye {
  border: none; background: none; cursor: pointer; padding: 0; font-size: 13px;
  line-height: 1; flex-shrink: 0; filter: grayscale(0);
}
.gm3d-inspector__eye.is-off { opacity: 0.5; filter: grayscale(1); }
.gm3d-inspector__eye:disabled { cursor: default; opacity: 0.3; }
.gm3d-inspector__src-input {
  flex: 1; min-width: 0; font-family: ui-monospace, monospace; font-size: 12px;
  padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border-color, #d0d7de);
  background: var(--surface, #fff); color: inherit;
}
.gm3d-inspector__src-input:focus { outline: none; border-color: #2d70b3; }
.gm3d-inspector__hint { font-size: 10px; color: var(--text-secondary, #4a6a86); margin: 4px 0 0; }
.gm3d-inspector__sec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.gm3d-inspector__add {
  font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid #2d70b3; background: rgba(45,112,179,0.08); color: #2d70b3;
}
.gm3d-inspector__add:hover:not(:disabled) { background: rgba(45,112,179,0.18); }
.gm3d-inspector__add:disabled { opacity: 0.4; cursor: default; }
.gm3d-inspector__color {
  width: 18px; height: 18px; padding: 0; border: 1px solid var(--border-color, #d0d7de);
  border-radius: 4px; flex-shrink: 0; cursor: pointer; background: none;
}
.gm3d-inspector__color::-webkit-color-swatch-wrapper { padding: 1px; }
.gm3d-inspector__color::-webkit-color-swatch { border: none; border-radius: 3px; }
.gm3d-inspector__color:disabled { cursor: default; opacity: 0.4; }
.gm3d-inspector__act {
  border: none; background: none; cursor: pointer; padding: 1px 4px; font-size: 13px;
  line-height: 1; flex-shrink: 0; color: var(--text-secondary, #4a6a86); border-radius: 4px;
}
.gm3d-inspector__act:hover:not(:disabled) { background: rgba(45,112,179,0.1); color: #2d70b3; }
.gm3d-inspector__act--del:hover:not(:disabled) { background: rgba(239,68,68,0.1); color: #ef4444; }
.gm3d-inspector__act:disabled { opacity: 0.3; cursor: default; }
.gm3d-inspector__cm { font-size: 10px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__empty { font-size: 13px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__surface { padding: 6px; border-radius: 6px; margin-bottom: 4px; }
.gm3d-inspector__surface:nth-child(odd) { background: rgba(45, 112, 179, 0.04); }
.gm3d-inspector__ctrls { display: flex; align-items: center; gap: 10px; margin-top: 4px; padding-left: 20px; }
.gm3d-inspector__cm-select { font-size: 11px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color, #d0d7de); }
.gm3d-inspector__wire { font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.gm3d-inspector__prop { display: flex; align-items: center; gap: 6px; margin-top: 3px; padding-left: 20px; font-size: 11px; }
.gm3d-inspector__prop-lbl { min-width: 68px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__prop-val { min-width: 28px; text-align: right; }
.gm3d-inspector__prop-dash { color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__num { width: 48px; font-size: 11px; padding: 1px 3px; border-radius: 4px; border: 1px solid var(--border-color, #d0d7de); }
.gm3d-inspector__cam { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.gm3d-inspector__cam-btn { font-size: 11px; padding: 3px 10px; border-radius: 5px; border: 1px solid var(--border-color, #d0d7de); background: #fff; cursor: pointer; }
.gm3d-inspector__cam-btn:hover { background: rgba(45,112,179,0.08); }
.gm3d-inspector__param { margin-bottom: 8px; }
.gm3d-inspector__param-range { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11px; }
.gm3d-inspector__param-range-lbl { min-width: 40px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__param-row { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 2px; }
.gm3d-inspector__play {
  border: none; background: none; cursor: pointer; padding: 1px 5px; font-size: 11px;
  line-height: 1; border-radius: 4px; color: #2d70b3; flex-shrink: 0;
}
.gm3d-inspector__play:hover { background: rgba(45,112,179,0.12); }
.gm3d-inspector__play.is-playing { color: #ef4444; background: rgba(239,68,68,0.1); }
.gm3d-inspector__param-name { font-family: ui-monospace, monospace; font-weight: 600; flex: 1; }
.gm3d-inspector__param-val { color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__slider { width: 100%; accent-color: #2d70b3; height: 20px; }
.gm3d-inspector__edit {
  display: inline-block; margin-top: 12px; font-size: 12px; font-weight: 600;
  color: #fff; background: #2d70b3; border-radius: 7px; padding: 6px 14px; text-decoration: none;
}
.gm3d-inspector__edit:hover { background: #22597f; }
</style>
