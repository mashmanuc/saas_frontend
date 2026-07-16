<!--
  Nmt3dInspector — contextual sidebar panel for selected NMT3D asset.

  Shown by GroupContentSidebar when nmt3dUiState.ws !== null (asset selected).
  Reads reactive state from nmt3dUiState; calls ws methods directly.

  Sections:
    1. Header — template name
    2. ПАРАМЕТРИ — range sliders per template.params
    3. View buttons — 3D / iso / front / side / top / bottom + reset
    4. Авто-обертання toggle
    5. ДОП. ПОБУДОВИ — checkboxes per template.aux (persisted to store via persistOpts)
    6. Розгортка — only if template.buildUnfolded defined
-->
<template>
  <div class="nmt3d-inspector">
    <!-- Header -->
    <div class="nmt3d-inspector__header">
      <span class="nmt3d-inspector__title">{{ templateName }}</span>
      <span v-if="ws?.template?.full" class="nmt3d-inspector__subtitle">{{ ws.template.full }}</span>
    </div>

    <!-- ПАРАМЕТРИ -->
    <div v-if="hasParams" class="nmt3d-inspector__section">
      <div class="nmt3d-inspector__section-label">{{ t('winterboard.nmt3d.paramsLabel') }}</div>
      <div
        v-for="(def, key) in templateParams"
        :key="key"
        class="nmt3d-inspector__param-row"
      >
        <span class="nmt3d-inspector__param-label">{{ def.label || key }}</span>
        <input
          type="range"
          class="nmt3d-inspector__slider"
          :min="def.min"
          :max="def.max"
          :step="def.step ?? sliderStep(def.min, def.max)"
          :value="nmt3dUiState.latestParams[key] ?? def.value"
          @input="onParamInput(key, $event)"
        />
        <span class="nmt3d-inspector__param-value">
          {{ formatVal(nmt3dUiState.latestParams[key] ?? def.value, def) }}
        </span>
      </div>
    </div>

    <!-- View buttons -->
    <div class="nmt3d-inspector__section">
      <div class="nmt3d-inspector__section-label">{{ t('winterboard.nmt3d.viewLabel') }}</div>
      <div class="nmt3d-inspector__view-btns">
        <button
          v-for="v in VIEW_PRESETS"
          :key="v.preset"
          type="button"
          class="nmt3d-inspector__view-btn"
          :title="v.title"
          @click="setView(v.preset)"
        >{{ v.label }}</button>
        <button
          type="button"
          class="nmt3d-inspector__view-btn nmt3d-inspector__view-btn--reset"
          :title="t('winterboard.nmt3d.resetView')"
          @click="ws?.resetView()"
        >↺</button>
      </div>

      <!-- Auto-orbit toggle -->
      <button
        type="button"
        class="nmt3d-inspector__orbit-btn"
        :class="{ 'is-active': autoOrbit }"
        @click="toggleOrbit"
      >
        {{ t('winterboard.nmt3d.autoOrbit') }}
      </button>
    </div>

    <!-- ДОП. ПОБУДОВИ -->
    <div v-if="hasAux" class="nmt3d-inspector__section">
      <div class="nmt3d-inspector__section-label">{{ t('winterboard.nmt3d.auxLabel') }}</div>
      <label
        v-for="item in templateAux"
        :key="item.key"
        class="nmt3d-inspector__aux-row"
      >
        <input
          type="checkbox"
          class="nmt3d-inspector__aux-check"
          :checked="!!nmt3dUiState.latestOpts[item.key]"
          @change="onOptChange(item.key, ($event.target as HTMLInputElement).checked)"
        />
        <span class="nmt3d-inspector__aux-label">{{ auxLabel(item) }}</span>
      </label>
    </div>

    <!-- Розгортка -->
    <div v-if="hasUnfold" class="nmt3d-inspector__section">
      <button
        type="button"
        class="nmt3d-inspector__unfold-btn"
        @click="ws?.toggleUnfold()"
      >
        {{ t('winterboard.nmt3d.unfold') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { nmt3dUiState } from '../../board/state/nmt3dUiState'

const { t, te } = useI18n()

const ws = computed(() => nmt3dUiState.ws)

// i18n-first (2026-07-16): назва шаблона і aux-лейбли — з vendor (укр хардкод);
// словник winterboard.nmt3d.{template,aux.<tpl>}.* ×3 локалі, vendor = fallback.
const templateName = computed(() => {
  const key = ws.value?.template?.key
  const i18nKey = `winterboard.nmt3d.template.${key}`
  if (key && te(i18nKey)) return t(i18nKey)
  return ws.value?.template?.name ?? ''
})
function auxLabel(item: { key: string; label: string }): string {
  const tpl = ws.value?.template?.key
  const k = `winterboard.nmt3d.aux.${tpl}.${item.key}`
  return tpl && te(k) ? t(k) : item.label
}
const templateParams = computed(() => ws.value?.template?.params ?? {})
const templateAux = computed(() => ws.value?.template?.aux ?? [])

const hasParams = computed(() => Object.keys(templateParams.value).length > 0)
const hasAux = computed(() => templateAux.value.length > 0)
const hasUnfold = computed(() => !!ws.value?.template?.buildUnfolded)

const autoOrbit = ref(false)

const VIEW_PRESETS = computed(() => [
  { preset: '3d'     as const, label: '3D',   title: t('winterboard.nmt3d.view3d') },
  { preset: 'iso'    as const, label: 'iso',  title: t('winterboard.nmt3d.viewIso') },
  { preset: 'front'  as const, label: '↑',    title: t('winterboard.nmt3d.viewFront') },
  { preset: 'side'   as const, label: '→',    title: t('winterboard.nmt3d.viewSide') },
  { preset: 'top'    as const, label: '⊙',    title: t('winterboard.nmt3d.viewTop') },
  { preset: 'bottom' as const, label: '⊕',    title: t('winterboard.nmt3d.viewBottom') },
])

function setView(preset: '3d' | 'iso' | 'front' | 'side' | 'top' | 'bottom'): void {
  ws.value?.setView(preset)
}

function toggleOrbit(): void {
  autoOrbit.value = !autoOrbit.value
  ws.value?.setAutoOrbit(autoOrbit.value)
}

function sliderStep(min: number, max: number): number {
  const range = max - min
  if (range <= 1) return 0.05
  if (range <= 5) return 0.1
  return 0.25
}

function formatVal(v: number, def?: { step?: number }): string {
  if (def?.step === 1) return String(Math.round(v))
  return v.toFixed(2)
}

function onParamInput(key: string, event: Event): void {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (isNaN(val) || !ws.value) return
  nmt3dUiState.latestParams[key] = val
  ws.value.setParam(key, val)
  // ws.onParamsChanged fires → renderer persists via update:asset
}

function onOptChange(key: string, checked: boolean): void {
  if (!ws.value) return
  nmt3dUiState.latestOpts[key] = checked
  ws.value.setOpt(key, checked)
  // Persist opts via renderer closure
  const newOpts = { ...nmt3dUiState.latestOpts }
  nmt3dUiState.persistOpts?.(newOpts)
}
</script>

<style scoped>
.nmt3d-inspector {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.nmt3d-inspector__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #e5c99a;
  background: #f4ede0;
}

.nmt3d-inspector__title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #3a2f24;
  line-height: 1.3;
}

.nmt3d-inspector__subtitle {
  display: block;
  font-size: 10px;
  color: #9a8674;
  margin-top: 2px;
  font-family: 'JetBrains Mono', monospace;
}

/* ── Section ── */
.nmt3d-inspector__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ede3d0;
}

.nmt3d-inspector__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a8674;
  margin-bottom: 6px;
}

/* ── Params sliders ── */
.nmt3d-inspector__param-row {
  display: grid;
  grid-template-columns: 14px 1fr 34px;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.nmt3d-inspector__param-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-style: italic;
  color: #3a2f24;
  font-weight: 600;
}

.nmt3d-inspector__slider {
  width: 100%;
  height: 3px;
  accent-color: #c4622a;
  cursor: pointer;
}

.nmt3d-inspector__param-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #6a594a;
  text-align: right;
  white-space: nowrap;
}

/* ── View buttons ── */
.nmt3d-inspector__view-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.nmt3d-inspector__view-btn {
  background: #ede3d0;
  border: 1px solid #d6c8b2;
  border-radius: 4px;
  color: #3a2f24;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 3px 7px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s, border-color 0.1s;
}

.nmt3d-inspector__view-btn:hover {
  background: #c4622a;
  border-color: #c4622a;
  color: #fff;
}

.nmt3d-inspector__view-btn--reset {
  margin-left: auto;
  color: #9a8674;
}

/* ── Auto-orbit ── */
.nmt3d-inspector__orbit-btn {
  width: 100%;
  background: #ede3d0;
  border: 1px solid #d6c8b2;
  border-radius: 5px;
  color: #6a594a;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 5px 8px;
  cursor: pointer;
  text-align: center;
  transition: background 0.1s, color 0.1s;
}

.nmt3d-inspector__orbit-btn.is-active {
  background: #3a2f24;
  color: #fffaf0;
  border-color: #3a2f24;
}

.nmt3d-inspector__orbit-btn:hover:not(.is-active) {
  background: #d6c8b2;
}

/* ── Aux checkboxes ── */
.nmt3d-inspector__aux-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 5px;
  cursor: pointer;
}

.nmt3d-inspector__aux-check {
  flex-shrink: 0;
  margin-top: 1px;
  accent-color: #c4622a;
  width: 13px;
  height: 13px;
  cursor: pointer;
}

.nmt3d-inspector__aux-label {
  font-size: 11px;
  color: #3a2f24;
  line-height: 1.35;
}

/* ── Unfold ── */
.nmt3d-inspector__unfold-btn {
  width: 100%;
  background: #ede3d0;
  border: 1px solid #d6c8b2;
  border-radius: 5px;
  color: #3a2f24;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 5px 8px;
  cursor: pointer;
  text-align: center;
  transition: background 0.1s;
}

.nmt3d-inspector__unfold-btn:hover {
  background: #d6c8b2;
}
</style>
