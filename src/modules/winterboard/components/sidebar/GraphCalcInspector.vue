<!--
  GraphCalcInspector — contextual sidebar panel for selected GraphCalculator asset.

  Shown by GroupContentSidebar when graphCalcInspectorState.bridge !== null.
  Only moves the ПАРАМЕТРИ section (param sliders + range editor) to the sidebar.
  Expression editor stays in the card renderer — too tightly coupled to the engine.

  Pattern: mirrors Nmt3dInspector.vue.
-->
<template>
  <div ref="rootEl" class="gc-insp">
    <!-- Header -->
    <div class="gc-insp__header">
      <div class="gc-insp__header-row">
        <span class="gc-insp__title">{{ t('winterboard.graphCalc.title') }}</span>
        <button
          type="button"
          class="gc-insp__expand-btn"
          :class="{ 'is-active': b.isExpanded }"
          :title="b.isExpanded ? t('winterboard.graphCalc.collapse') : t('winterboard.graphCalc.expand')"
          @click="b.toggleExpand()"
        >{{ b.isExpanded ? '⊠' : '⛶' }}</button>
      </div>
      <span class="gc-insp__subtitle">{{ t('winterboard.graphCalc.subtitle') }}</span>
    </div>

    <!-- ── Швидко додати (quick templates — always first, always visible) ── -->
    <div class="gc-insp__section">
      <div class="gc-insp__section-label">{{ t('winterboard.graphCalc.quickAdd') }}</div>
      <div class="gc-insp__quick-row">
        <button
          v-for="tpl in QUICK_TEMPLATES"
          :key="tpl.src"
          type="button"
          class="gc-insp__quick-btn"
          :title="tpl.src"
          @click="b.onQuickAdd(tpl.src)"
        ><MathExpr :expr="tpl.src" /></button>
      </div>
    </div>

    <!-- ── Вирази ── -->
    <div class="gc-insp__section gc-insp__section--exprs">
      <div class="gc-insp__section-label">{{ t('winterboard.graphCalc.expressions') }}</div>

      <div class="gc-insp__expr-list">
        <div
          v-for="expr in b.displayExpressions"
          :key="expr.id"
          class="gc-insp__expr-row"
          :class="pfRowClass(expr)"
          :data-pf-role="pfRole(expr) ?? undefined"
        >
          <!-- Color swatch / visibility toggle -->
          <span
            class="gc-insp__swatch"
            :style="{ background: expr.color, opacity: expr.hidden ? 0.3 : 1 }"
            :title="t('winterboard.graphCalc.toggleVisibility')"
            @click="b.onToggleHidden(expr.id)"
          />

          <!-- Гібрид «рендер у спокої»: KaTeX-прев'ю поки рядок не редагується;
               клік → живий <input> (той самий, з усіма slash/enter-хендлерами).
               Порожній src → одразу input. Сходинка до повного MathQuill (§0.1). -->
          <button
            v-if="editingId !== expr.id && expr.src.trim()"
            type="button"
            class="gc-insp__expr-preview"
            @click="startEdit(expr.id)"
          ><MathExpr
            :expr="expr.src"
            :highlight-ident="pfRole(expr) ? b.paramFocus!.name : undefined"
          /></button>
          <!-- MathQuill WYSIWYG (як standalone /mash/grapher/): тільки коли
               бібліотека доступна і вираз renderable; інакше plain input.
               «/» = дріб; slash-меню в MQ-режимі відсутнє (шаблони в quick-add). -->
          <!-- mqEditing фіксується ОДИН раз у startEdit: перевіряти renderable
               на кожен keystroke не можна — проміжний ввід (`x+`) тимчасово
               невалідний, умова б падала і розмонтовувала поле посеред набору
               (втрата фокуса на кожен символ — баг 2026-07-22). -->
          <MathQuillField
            v-else-if="editingId === expr.id && mqEditing"
            :model-value="expr.src"
            autofocus
            @update:model-value="(v: string) => b.onSrcInput(expr.id, v)"
            @enter="b.onEnterPress(expr.id)"
            @blur="onInputBlur(expr.id)"
            @unavailable="mqAvailable = false"
          />
          <!-- @focus ОБОВ'ЯЗКОВИЙ: нове поле («+ вираз») порожнє, тому
               рендериться цією гілкою, але `editingId` порожній — його
               ставить лише клік по прев'ю. Щойно юзер друкував перший
               символ, `expr.src.trim()` ставало істинним і ПЕРША умова
               (`editingId !== expr.id && expr.src.trim()`) підміняла
               input кнопкою-прев'ю: поле зникало разом із фокусом, далі
               не вводилось нічого (живий прогін 2026-08-10). Фіксуємо
               режим редагування на фокусі — тоді перша умова хибна, поки
               не станеться blur (він же й скидає editingId). -->
          <input
            v-else
            type="text"
            class="gc-insp__expr-input"
            :value="expr.src"
            :data-expr-id="expr.id"
            placeholder="y = ..."
            @focus="editingId = expr.id"
            @input="b.onSrcInput(expr.id, ($event.target as HTMLInputElement).value)"
            @blur="onInputBlur(expr.id)"
            @keydown.enter.prevent="b.onEnterPress(expr.id)"
            @keydown.down.prevent="b.onArrowNav(expr.id, 1)"
            @keydown.up.prevent="b.onArrowNav(expr.id, -1)"
            @keydown.esc="b.closeSlashPopup()"
            @keydown.stop
            @keypress.stop
            @keyup.stop
          />

          <!-- Parameter Focus: живе значення параметра в кінці рядка -->
          <span
            v-if="pfRole(expr)"
            class="gc-insp__pf-value"
            data-testid="gc-insp-pf-value"
          >{{ b.paramFocus!.name }} = {{ formatParamValue(b.paramFocus!.value) }}</span>

          <!-- Delete row -->
          <button
            type="button"
            class="gc-insp__row-del"
            :title="t('winterboard.graphCalc.delete')"
            @click="b.onRemoveExpression(expr.id)"
          >−</button>

          <!-- Slash popup -->
          <div
            v-if="b.slashPopup?.exprId === expr.id"
            class="gc-insp__slash-popup"
            @mousedown.prevent
          >
            <div
              v-for="(tpl, tplIdx) in b.slashFilteredTemplates"
              :key="tpl.id"
              class="gc-insp__slash-item"
              :class="{ 'is-selected': tplIdx === b.slashPopup!.selectedIdx }"
              @click="b.applySlashTemplate(expr.id, tpl)"
              @mouseenter="b.setSlashSelectedIdx(tplIdx)"
            >
              <span class="gc-insp__slash-key">/{{ tpl.id }}</span>
              <span class="gc-insp__slash-label">{{ tpl.label }}</span>
            </div>
            <div v-if="b.slashFilteredTemplates.length === 0" class="gc-insp__slash-empty">
              {{ t('winterboard.graphCalc.noTemplates') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Add expression -->
      <button
        type="button"
        class="gc-insp__add-btn"
        data-testid="gc-insp-add-expr"
        @click="addExpressionAndFocus"
      >{{ t('winterboard.graphCalc.addExpression') }}</button>
    </div>

    <!-- ── Параметри ── -->
    <div v-if="b.paramEntries.length === 0" class="gc-insp__empty">
      <span class="gc-insp__empty-icon">💡</span>
      <span>{{ t('winterboard.graphCalc.emptyHint') }} <code>y = a·x</code></span>
    </div>

    <!-- Параметри -->
    <div v-if="b.paramEntries.length > 0" class="gc-insp__section">
      <div class="gc-insp__section-label">
        {{ t('winterboard.graphCalc.params') }}
        <span
          v-if="b.dragParamNames.length"
          class="gc-insp__hint"
          :title="t('winterboard.graphCalc.shiftDragHint')"
        >Shift-drag</span>
        <span
          v-else
          class="gc-insp__hint gc-insp__hint--muted"
          :title="t('winterboard.graphCalc.shiftDragOneParam')"
        >Shift-drag —</span>
      </div>

      <div
        v-for="p in b.paramEntries"
        :key="p.name"
        class="gc-insp__param-row"
        :class="{ 'is-expanded': !!b.paramExpanded[p.name] }"
      >
        <button
          type="button"
          class="gc-insp__param-name"
          :title="b.paramExpanded[p.name] ? t('winterboard.graphCalc.collapse') : t('winterboard.graphCalc.configureRange')"
          @click="b.toggleParamExpand(p.name)"
        >{{ p.name }} =</button>
        <input
          type="range"
          class="gc-insp__slider"
          :min="p.min"
          :max="p.max"
          :step="p.step"
          :value="p.value"
          @input="b.onSliderInput(p.name, ($event.target as HTMLInputElement).valueAsNumber)"
          @pointerup="b.flushParam()"
        />
        <span class="gc-insp__param-value">{{ p.value.toFixed(2) }}</span>

        <!-- Range editor (expanded) -->
        <div v-if="b.paramExpanded[p.name]" class="gc-insp__range-editor">
          <label class="gc-insp__range-field">
            <span>{{ t('winterboard.widget.graphCalc.rangeMin') }}</span>
            <input
              type="number"
              class="gc-insp__range-input"
              :value="p.min"
              step="any"
              @change="onRangeMinChange(p.name, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="gc-insp__range-field">
            <span>{{ t('winterboard.widget.graphCalc.rangeMax') }}</span>
            <input
              type="number"
              class="gc-insp__range-input"
              :value="p.max"
              step="any"
              @change="onRangeMaxChange(p.name, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="gc-insp__range-field">
            <span>{{ t('winterboard.widget.graphCalc.rangeStep') }}</span>
            <input
              type="number"
              class="gc-insp__range-input"
              :value="p.step"
              step="any"
              min="0"
              @change="onRangeStepChange(p.name, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MathExpr from '../shared/MathExpr.vue'
import MathQuillField from '../shared/MathQuillField.vue'
import { isRenderableAscii } from '../../utils/asciiMathToLatex'
import { loadMathQuill } from '../../utils/mathquillLoader'
import { graphCalcInspectorState } from '../../board/state/graphCalcInspectorState'
import { formatParamValue, paramFocusRole } from '../../utils/paramFocus'
import type { ParamFocusRole } from '../../utils/paramFocus'

const { t } = useI18n()

// ⚠️ `!` — ТІЛЬКИ для <template>/render-computed'ів (рендер під v-if bridge).
// ОБРОБНИКИ (@blur/@change) НЕ мають права на b.value.МЕТОД() / inline b.метод() —
// teardown → null → page crash (P0). Обробники читають graphCalcInspectorState.bridge?.
// напряму. Інваріант тримає тест InspectorTeardownGuard.
const b = computed(() => graphCalcInspectorState.bridge!)

// ── Parameter Focus (render-only, тому `b.value` тут дозволений) ──────────
type PfExpr = { id: string; src: string; hidden: boolean }
function pfRole(expr: PfExpr): ParamFocusRole | null {
  return paramFocusRole(b.value.paramFocus, expr)
}
function pfRowClass(expr: PfExpr): Record<string, boolean> {
  const role = pfRole(expr)
  return {
    'is-pf-target': role === 'target',
    'is-pf-dependent': role === 'dependent',
    'is-pf-fading': role !== null && b.value.paramFocus?.phase === 'fading',
  }
}

// ── Гібрид «рендер у спокої» ──────────────────────────────────────────────
// editingId = рядок у режимі вводу; решта показують KaTeX-прев'ю.
// Порожні рядки завжди input (прев'ю нема чого рендерити).
const editingId = ref<string | null>(null)
const rootEl = ref<HTMLElement | null>(null)

// MathQuill: доступність визначаємо ПЕРЕД першим показом edit-поля (await
// loader-а в startEdit — один раз, далі кеш), щоб не було flash input→MQ.
const mqAvailable = ref(false)
// Рішення «MQ чи input» приймається НА ВХОДІ в редагування і не міняється
// до blur — інакше транзитно-невалідний ввід розмонтовує поле (див. коментар
// у template).
const mqEditing = ref(false)
let mqChecked = false

async function startEdit(id: string): Promise<void> {
  if (!mqChecked) {
    mqChecked = true
    mqAvailable.value = (await loadMathQuill()) !== null
  }
  const src = b.value.displayExpressions.find((e) => e.id === id)?.src ?? ''
  mqEditing.value = mqAvailable.value && isRenderableAscii(src)
  editingId.value = id
  nextTick(() => {
    // plain-input гілка (MQ недоступний або вираз не renderable)
    const el = rootEl.value?.querySelector<HTMLInputElement>(`input[data-expr-id="${CSS.escape(id)}"]`)
    el?.focus()
    el?.select()
  })
}

// ── Teardown-guarded обробники (@blur / @change) ──────────────────────────
// Клік повз картку одночасно (а) обнуляє bridge (unregisterGraphCalcInspector)
// і (б) шле blur/change → обробник спрацьовує вже на null. Виклики читають
// bridge НАПРЯМУ (не b.value) з optional chaining — інакше null.<method>()
// падає в AppErrorBoundary і вбиває всю сторінку дошки.
function onInputBlur(id: string): void {
  editingId.value = null   // reset UI-стан завжди, навіть якщо bridge вже null
  graphCalcInspectorState.bridge?.onInputBlur(id)
}
// «+ вираз» натискають, щоб ПИСАТИ: курсор одразу в новому (порожньому) полі.
// Без цього фокус лишався на кнопці й набір ішов у нікуди (власник 2026-09-21).
// Новий рядок шукаємо різницею id — контракт мосту (onAddExpression(): void)
// не міняється. Після await міст міг зникнути (клік повз картку) — звідси `?.`.
async function addExpressionAndFocus(): Promise<void> {
  const bridge = graphCalcInspectorState.bridge
  if (!bridge) return
  const before = new Set(bridge.displayExpressions.map((e) => e.id))
  bridge.onAddExpression()
  await nextTick()
  const added = graphCalcInspectorState.bridge?.displayExpressions.find((e) => !before.has(e.id))
  if (!added) return
  // Порожній рядок — завжди plain input: mqEditing міг лишитись true від
  // попереднього редагування іншого рядка, і тоді змонтувався б MathQuill.
  mqEditing.value = false
  editingId.value = added.id
  await nextTick()
  rootEl.value?.querySelector<HTMLInputElement>(`input[data-expr-id="${CSS.escape(added.id)}"]`)?.focus()
}
function onRangeMinChange(name: string, value: string): void {
  graphCalcInspectorState.bridge?.onRangeMinChange(name, value)
}
function onRangeMaxChange(name: string, value: string): void {
  graphCalcInspectorState.bridge?.onRangeMaxChange(name, value)
}
function onRangeStepChange(name: string, value: string): void {
  graphCalcInspectorState.bridge?.onRangeStepChange(name, value)
}

// Mirrors QUICK_TEMPLATES in GraphCalculatorRenderer (Phase G4)
const QUICK_TEMPLATES = [
  { id: 'linear',   label: 'a·x',    src: 'y = a*x' },
  { id: 'sin',      label: 'a·sin',  src: 'y = a*sin(x)' },
  { id: 'parabola', label: 'a·x²',   src: 'y = a*x^2' },
  { id: 'circle',   label: 'circle', src: '(x)^2 + (y)^2 = r^2' },
] as const
</script>

<style scoped>
.gc-insp {
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ── */
.gc-insp__header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid #b8d4e0;
  background: #eef5f9;
}

.gc-insp__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.gc-insp__title {
  font-size: 12px;
  font-weight: 700;
  color: #1e3a4a;
  line-height: 1.3;
}

.gc-insp__subtitle {
  display: block;
  font-size: 10px;
  color: #5a8ea8;
  margin-top: 2px;
  font-family: 'JetBrains Mono', monospace;
}

.gc-insp__expand-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(59, 123, 155, 0.35);
  border-radius: 4px;
  background: #fffaf0;
  color: #3b7b9b;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  user-select: none;
}

.gc-insp__expand-btn:hover {
  background: #daedf5;
  border-color: #3b7b9b;
}

.gc-insp__expand-btn.is-active {
  background: #3b7b9b;
  border-color: #3b7b9b;
  color: #fff;
}

/* ── Empty state ── */
.gc-insp__empty {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #5a4a3a;
  text-align: center;
  line-height: 1.4;
}

.gc-insp__empty-icon {
  font-size: 18px;
}

.gc-insp__empty code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  background: rgba(59, 123, 155, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  color: #3b7b9b;
}

/* ── Section ── */
.gc-insp__section {
  padding: 8px 12px;
  border-bottom: 1px solid #ddeef5;
}

.gc-insp__section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5a8ea8;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.gc-insp__hint {
  font-size: 9px;
  font-weight: 500;
  color: #3b7b9b;
  text-transform: none;
  letter-spacing: 0;
  background: rgba(59, 123, 155, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  cursor: help;
}

.gc-insp__hint--muted {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}

/* ── Param row ── */
.gc-insp__param-row {
  display: grid;
  grid-template-columns: 36px 1fr 40px;
  gap: 5px;
  align-items: center;
  margin-bottom: 5px;
}

.gc-insp__param-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #1e3a4a;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  user-select: none;
  white-space: nowrap;
}

.gc-insp__param-name:hover {
  color: #3b7b9b;
  text-decoration: underline dotted;
}

.gc-insp__param-row.is-expanded .gc-insp__param-name {
  color: #3b7b9b;
  font-weight: 600;
}

.gc-insp__slider {
  width: 100%;
  accent-color: #3b7b9b;
  cursor: pointer;
}

.gc-insp__param-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #5a4a3a;
  text-align: right;
  white-space: nowrap;
}

/* ── Range editor ── */
.gc-insp__range-editor {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 2px;
  padding: 5px 6px;
  background: rgba(59, 123, 155, 0.05);
  border-radius: 4px;
  border: 1px solid rgba(59, 123, 155, 0.15);
}

.gc-insp__range-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
  color: #5a4a3a;
  font-family: 'JetBrains Mono', monospace;
}

.gc-insp__range-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  width: 100%;
  padding: 2px 4px;
  border: 1px solid rgba(59, 123, 155, 0.25);
  border-radius: 3px;
  background: #fff;
  box-sizing: border-box;
}

/* ── Expr section ── */
.gc-insp__section--exprs {
  padding-bottom: 6px;
}

.gc-insp__expr-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
  position: relative;
}

.gc-insp__expr-row {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  border-radius: 4px;
  box-shadow: -3px 0 0 transparent;
  transition: box-shadow 0.4s ease, background-color 0.4s ease;
}

/* ── Parameter Focus ──
   Один акцент (бурштин). target — крива, яку тягнуть: смуга + заливка.
   dependent — та сама смуга без заливки. Символ параметра у формулі —
   той самий колір. Згасання 0.4 с == PARAM_FOCUS_FADE_MS. */
.gc-insp__expr-row.is-pf-dependent { box-shadow: -3px 0 0 #b45309; }
.gc-insp__expr-row.is-pf-target {
  box-shadow: -3px 0 0 #b45309;
  background-color: rgba(245, 158, 11, 0.16);
}
.gc-insp__expr-row.is-pf-fading { box-shadow: -3px 0 0 transparent; background-color: transparent; }
/* Поле формули має власний фон — без цього заливка target ховається під ним. */
.gc-insp__expr-row .gc-insp__expr-preview,
.gc-insp__expr-row .gc-insp__expr-input {
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.gc-insp__expr-row.is-pf-target .gc-insp__expr-preview,
.gc-insp__expr-row.is-pf-target .gc-insp__expr-input {
  background-color: rgba(245, 158, 11, 0.16);
  border-color: #b45309;
}
.gc-insp__expr-row.is-pf-target.is-pf-fading .gc-insp__expr-preview,
.gc-insp__expr-row.is-pf-target.is-pf-fading .gc-insp__expr-input {
  background-color: #fffaf0;
  border-color: rgba(59, 123, 155, 0.18);
}
.gc-insp__expr-row :deep(.wb-pf-sym) {
  color: #b45309;
  font-weight: 700;
  transition: color 0.4s ease;
}
.gc-insp__expr-row.is-pf-fading :deep(.wb-pf-sym) { color: inherit; }
.gc-insp__pf-value {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #b45309;
  white-space: nowrap;
  transition: opacity 0.4s ease;
}
.gc-insp__expr-row.is-pf-fading .gc-insp__pf-value { opacity: 0; }

.gc-insp__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.15);
  transition: opacity 0.1s;
}

.gc-insp__swatch:hover {
  opacity: 0.6 !important;
}

.gc-insp__expr-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid rgba(59, 123, 155, 0.3);
  border-radius: 4px;
  font: 11px 'JetBrains Mono', monospace;
  background: #fffaf0;
  color: #1e293b;
  outline: none;
  transition: border-color 0.12s;
}

/* Гібрид: KaTeX-прев'ю дзеркалить метрики input (без стрибка лейауту) */
.gc-insp__expr-preview {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid rgba(59, 123, 155, 0.18);
  border-radius: 4px;
  font-size: 12px;
  background: #fffaf0;
  color: #1e293b;
  cursor: text;
  text-align: left;
  overflow-x: auto;
  white-space: nowrap;
}

.gc-insp__expr-preview:hover {
  border-color: rgba(59, 123, 155, 0.45);
  background: #fff;
}

.gc-insp__expr-input:focus {
  border-color: #3b7b9b;
  background: #fff;
}

.gc-insp__row-del {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 4px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: background 0.1s, color 0.1s;
}

.gc-insp__row-del:hover {
  background: #fef2f2;
  border-color: #f87171;
  color: #dc2626;
}

/* ── Slash popup ── */
.gc-insp__slash-popup {
  position: absolute;
  top: calc(100% + 2px);
  left: 14px;
  right: 22px;
  background: #fff;
  border: 1px solid rgba(59, 123, 155, 0.3);
  border-radius: 5px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
}

.gc-insp__slash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 11px;
  color: #1e293b;
  transition: background 0.08s;
}

.gc-insp__slash-item:hover,
.gc-insp__slash-item.is-selected {
  background: #eef5f9;
}

.gc-insp__slash-key {
  color: #3b7b9b;
  font-size: 10px;
  flex-shrink: 0;
}

.gc-insp__slash-label {
  flex: 1;
}

.gc-insp__slash-empty {
  padding: 6px 8px;
  font-size: 10px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
}

/* ── Add button + quick templates ── */
.gc-insp__add-btn {
  font-size: 10.5px;
  padding: 3px 8px;
  border: 1px solid rgba(59, 123, 155, 0.3);
  border-radius: 4px;
  background: #fffaf0;
  color: #3b7b9b;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s;
  margin-bottom: 6px;
}

.gc-insp__add-btn:hover {
  background: #eef5f9;
  border-color: #3b7b9b;
}

.gc-insp__quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gc-insp__quick-btn {
  font-size: 10px;
  padding: 3px 7px;
  border: 1px solid rgba(59, 123, 155, 0.25);
  border-radius: 4px;
  background: #eef5f9;
  color: #3b7b9b;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}

.gc-insp__quick-btn:hover {
  background: #d4e8f0;
  border-color: #3b7b9b;
}
</style>
