<!--
  NumberLineRenderer — `number_line` (Б-184): числова пряма для нерівностей,
  систем і сукупностей.

  ДАНІ: лише застосований вхід учителя (умови + «система / сукупність»).
  Рисунок, відповідь, PDF-знімок — з одного обчислення `evaluate()` (інваріант 1).

  ВВІД (ТЗ §2.3, одне правило):
    • Enter — новий рядок-умова, нічого не пише; Backspace у порожньому — прибрати рядок.
    • «Застосувати» / Ctrl+Enter — перевірка всіх рядків; усі правильні → РІВНО
      один `update:asset` (= штатний asset_update, «скасувати» відкочує його).
      Є помилка → нічого не пишеться: пояснення біля рядка, рисунок — застосований,
      текст лишається.
    • «Скасувати зміни» / Esc — текст повертається до застосованого.
    • Втрата фокусу нічого не пише й не стирає (позначка «не застосовано»).
  Чернетка — лише в цьому компоненті: не стан дошки, не ops, не запис уроку.

  POINTER-EVENTS: корінь — none (Konva-проксі тягне/виділяє); поле вводу — auto.
  ЗНІМОК: окремий самодостатній SVG з інлайн-стилями (XMLSerializer не бере CSS),
  `useExportCapture` → без нього PDF отримав би картку-заглушку (інваріант 4а).
-->
<template>
  <div
    class="nl-renderer"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive }"
    :data-testid="`number-line-renderer-${asset.id}`"
  >
    <header class="nl-header">
      <span class="nl-title">{{ t('winterboard.numberLine.title') }}</span>
      <button
        v-if="!hostWindowControls && !asset.locked && isSelected && interactive"
        type="button"
        class="nl-delete"
        :title="t('common.delete')"
        @pointerdown.stop
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <div ref="stageRef" class="nl-stage" data-testid="number-line-stage">
      <svg
        :viewBox="`0 0 ${VB_W} ${VB_H}`"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="number-line-svg"
        :font-family="FONT"
      >
        <rect x="0" y="0" :width="VB_W" :height="VB_H" fill="#ffffff" />

        <!-- Штрихування: кожна умова своє (над / під прямою, інший нахил) -->
        <template v-if="layout && asset.data.showHatching !== false">
          <g
            v-for="h in layout.hatches"
            :key="`h-${h.condition}`"
            :data-testid="`number-line-hatch-${h.condition}`"
          >
            <line
              v-for="(l, i) in hatchLines(h.condition, h.segments)"
              :key="i"
              :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2"
              :stroke="hatchColor(h.condition)"
              stroke-width="1.4"
            />
          </g>
        </template>

        <!-- Пряма зі стрілкою праворуч і підписом змінної -->
        <line :x1="X0" :y1="LINE_Y" :x2="X1 + 14" :y2="LINE_Y" stroke="#1f2937" stroke-width="2" />
        <path :d="`M ${X1 + 22} ${LINE_Y} l -12 -6 l 0 12 z`" fill="#1f2937" />
        <text :x="X1 + 18" :y="LINE_Y + 24" font-size="18" font-style="italic" fill="#1f2937">{{ asset.data.variable || 'x' }}</text>

        <!-- Результат (виділено кольором) -->
        <template v-if="layout">
          <line
            v-for="(s, i) in layout.result"
            :key="`r-${i}`"
            :x1="px(s.from)" :y1="LINE_Y" :x2="s.to === 1 ? X1 + 10 : px(s.to)" :y2="LINE_Y"
            :stroke="RESULT"
            stroke-width="5"
            stroke-linecap="round"
            data-testid="number-line-result"
          />
        </template>

        <!-- Точки й підписи -->
        <template v-if="layout">
          <g v-for="(p, i) in layout.points" :key="`p-${i}`" :data-testid="`number-line-point-${i}`">
            <circle
              :cx="px(p.x)" :cy="LINE_Y" r="6"
              :fill="p.filled ? RESULT_DARK : '#ffffff'"
              :stroke="RESULT_DARK"
              stroke-width="2"
              :data-filled="p.filled ? '1' : '0'"
            />
            <template v-if="fraction(p.label)">
              <text :x="px(p.x)" :y="LINE_Y + 30" text-anchor="middle" font-size="14" fill="#111827">{{ fraction(p.label)!.num }}</text>
              <line :x1="px(p.x) - 11" :y1="LINE_Y + 35" :x2="px(p.x) + 11" :y2="LINE_Y + 35" stroke="#111827" stroke-width="1.2" />
              <text :x="px(p.x)" :y="LINE_Y + 50" text-anchor="middle" font-size="14" fill="#111827">{{ fraction(p.label)!.den }}</text>
            </template>
            <text v-else :x="px(p.x)" :y="LINE_Y + 32" text-anchor="middle" font-size="16" fill="#111827">{{ p.label }}</text>
          </g>
        </template>

        <!-- Відповідь (можна сховати — учні шукають самі) -->
        <text
          v-if="answerLine && asset.data.showAnswer !== false"
          :x="VB_W / 2" :y="VB_H - 18"
          text-anchor="middle" font-size="18" fill="#111827"
          data-testid="number-line-answer"
        >{{ answerLine }}</text>
        <text
          v-else-if="!layout"
          :x="VB_W / 2" :y="VB_H - 18"
          text-anchor="middle" font-size="14" fill="#b91c1c"
        >{{ t('winterboard.numberLine.storedInvalid') }}</text>
        <text
          v-else-if="!asset.data.conditions.length"
          :x="VB_W / 2" :y="VB_H - 18"
          text-anchor="middle" font-size="14" fill="#6b7280"
        >{{ t('winterboard.numberLine.emptyHint') }}</text>
      </svg>
    </div>

    <!-- Поле вводу: лише в редагуванні й для виділеної картки -->
    <div
      v-if="interactive && isSelected"
      class="nl-editor"
      data-testid="number-line-editor"
      @pointerdown.stop
      @keydown.stop
    >
      <div v-for="(line, i) in draft" :key="i" class="nl-row">
        <input
          :ref="(el) => setInputRef(el as HTMLInputElement | null, i)"
          class="nl-input"
          :class="{ 'has-error': errorFor(i) }"
          :value="line"
          :placeholder="i === 0 ? t('winterboard.numberLine.placeholder') : ''"
          :data-testid="`number-line-input-${i}`"
          spellcheck="false"
          autocomplete="off"
          @input="onInput(i, ($event.target as HTMLInputElement).value)"
          @keydown="onKeydown($event, i)"
          @focus="focused = i"
        />
        <div v-if="errorFor(i)" class="nl-error" :data-testid="`number-line-error-${i}`">{{ errorFor(i) }}</div>
      </div>

      <div class="nl-keys">
        <button
          v-for="k in KEYS"
          :key="k"
          type="button"
          class="nl-key"
          @mousedown.prevent
          @click="insertText(k)"
        >{{ k }}</button>
        <button type="button" class="nl-key nl-key--wide" data-testid="number-line-add-row" @mousedown.prevent @click="addRow(focused)">
          {{ t('winterboard.numberLine.addCondition') }}
        </button>
      </div>

      <div class="nl-actions">
        <label v-if="draft.filter((l) => l.trim()).length > 1" class="nl-combine">
          <select v-model="draftCombine" data-testid="number-line-combine">
            <option value="and">{{ t('winterboard.numberLine.combineAnd') }}</option>
            <option value="or">{{ t('winterboard.numberLine.combineOr') }}</option>
          </select>
        </label>
        <label class="nl-toggle">
          <input type="checkbox" :checked="asset.data.showAnswer !== false" data-testid="number-line-show-answer" @change="toggleAnswer" />
          {{ t('winterboard.numberLine.showAnswer') }}
        </label>
        <span v-if="dirty" class="nl-dirty" data-testid="number-line-dirty">{{ t('winterboard.numberLine.notApplied') }}</span>
        <button v-if="dirty" type="button" class="nl-btn" data-testid="number-line-revert" @click="revert">
          {{ t('winterboard.numberLine.revert') }}
        </button>
        <button type="button" class="nl-btn nl-btn--primary" data-testid="number-line-apply" @click="apply">
          {{ t('winterboard.numberLine.apply') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import {
  conditionToText,
  evaluate,
  parseLines,
  type LayoutSegment,
  type NumberLineData,
  type NumberLineError,
} from '../../../engine/numberLine'
import type { NumberLineAsset } from '../../../types/numberLine'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: NumberLineAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: NumberLineAsset]
  delete: []
}>()

// ── Рисунок ────────────────────────────────────────────────────────────────
const VB_W = 560
const VB_H = 190
const X0 = 24
const X1 = 516
const LINE_Y = 78
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const RESULT = '#3b82f6'
const RESULT_DARK = '#1d4ed8'
const HATCH_COLORS = ['#475569', '#b45309', '#7c3aed', '#0f766e', '#be185d', '#4d7c0f']

const stageRef = ref<HTMLElement | null>(null)
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

const evaluation = computed(() => evaluate(props.asset.data))
/** null — у збережених даних помилка (рисунка немає, лише пояснення). */
const layout = computed(() => ('layout' in evaluation.value ? evaluation.value.layout : null))

const answerLine = computed(() => {
  const ev = evaluation.value
  if (!('answer' in ev) || !props.asset.data.conditions.length) return ''
  if (ev.answer.kind === 'empty') return t('winterboard.numberLine.answerEmpty')
  const name = ev.answer.name ? ` — ${t(`winterboard.numberLine.names.${ev.answer.name}`)}` : ''
  return `${ev.answer.text}${name}`
})

function px(x: number): number {
  return X0 + x * (X1 - X0)
}

function hatchColor(condition: number): string {
  return HATCH_COLORS[condition % HATCH_COLORS.length]
}

/** Перша умова — над прямою, друга — під, третя — над з іншим нахилом і вище… */
function hatchLines(condition: number, segments: LayoutSegment[]) {
  const above = condition % 2 === 0
  const tier = Math.floor(condition / 2)
  const base = above ? LINE_Y - 4 - tier * 14 : LINE_Y + 4 + tier * 14
  const len = 12
  const y2 = above ? base - len : base + len
  const slope = (tier + condition) % 2 === 0 ? 8 : -8
  const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (const s of segments) {
    const a = px(s.from)
    const b = s.to === 1 ? X1 + 6 : px(s.to)
    for (let x = a + 4; x <= b - 2; x += 9) {
      out.push({ x1: x, y1: base, x2: x + slope, y2 })
    }
  }
  return out
}

/** `−1/3` → чисельник над знаменником (як у зошиті). */
function fraction(label: string): { num: string; den: string } | null {
  const m = /^([−-]?)(\d+)\/(\d+)$/.exec(label)
  return m ? { num: `${m[1]}${m[2]}`, den: m[3] } : null
}

// ── Ввід (чернетка — не стан дошки) ───────────────────────────────────────
const KEYS = ['<', '≤', '>', '≥', '≠', '=']

const draft = ref<string[]>([])
const draftCombine = ref<'and' | 'or'>('and')
const errors = ref<NumberLineError[]>([])
const focused = ref(0)
const inputs: Array<HTMLInputElement | null> = []

function appliedLines(d: NumberLineData): string[] {
  const lines = d.conditions.map((c) => conditionToText(c, d.variable || 'x'))
  return lines.length ? lines : ['']
}

/** Застосоване, з якого чернетку синхронізовано востаннє: «не застосовано» рахується від нього. */
const synced = ref<{ lines: string[]; combine: 'and' | 'or' }>({ lines: [], combine: 'and' })

function revert(): void {
  const lines = appliedLines(props.asset.data)
  synced.value = { lines, combine: props.asset.data.combine }
  draft.value = [...lines]
  draftCombine.value = props.asset.data.combine
  errors.value = []
}

const norm = (ls: string[]) => ls.map((l) => l.trim()).filter(Boolean).join('\n')

const dirty = computed(() => {
  const now = draft.value
  return norm(now) !== norm(synced.value.lines)
    || (now.filter((l) => l.trim()).length > 1 && draftCombine.value !== synced.value.combine)
})

// Застосоване змінилось ззовні (інший учасник, «скасувати», Інтегралик): чернетки немає —
// показуємо нове застосоване; є незастосована чернетка — не стираємо її.
watch(
  () => [props.asset.data.conditions, props.asset.data.combine, props.asset.data.variable],
  () => { if (!dirty.value) revert() },
  { immediate: true, deep: true },
)

function setInputRef(el: HTMLInputElement | null, i: number): void {
  inputs[i] = el
}

function focusRow(i: number, caret?: number): void {
  void nextTick(() => {
    const el = inputs[i]
    if (!el) return
    el.focus()
    if (caret !== undefined) el.setSelectionRange(caret, caret)
  })
}

function onInput(i: number, value: string): void {
  draft.value[i] = value
  errors.value = errors.value.filter((e) => e.line !== i)
}

function addRow(after: number): void {
  const at = Math.min(Math.max(after, -1), draft.value.length - 1) + 1
  draft.value.splice(at, 0, '')
  errors.value = []
  focusRow(at, 0)
}

function insertText(text: string): void {
  const i = Math.min(focused.value, draft.value.length - 1)
  const el = inputs[i]
  const value = draft.value[i] ?? ''
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  const piece = ` ${text} `
  draft.value[i] = `${value.slice(0, start)}${piece}${value.slice(end)}`.replace(/\s{2,}/g, ' ')
  focusRow(i, Math.min(draft.value[i].length, start + piece.length))
}

function onKeydown(e: KeyboardEvent, i: number): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    apply()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    addRow(i)
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    revert()
    return
  }
  if (e.key === 'Backspace' && draft.value[i] === '' && draft.value.length > 1) {
    e.preventDefault()
    draft.value.splice(i, 1)
    errors.value = []
    const prev = Math.max(0, i - 1)
    focusRow(prev, draft.value[prev].length)
  }
}

const ERROR_KEYS: Record<NumberLineError['code'], string> = {
  empty: 'empty',
  unexpected_char: 'unexpectedChar',
  bad_number: 'badNumber',
  division_by_zero: 'divisionByZero',
  roots_not_supported: 'rootsNotSupported',
  expect_number_after: 'expectNumberAfter',
  expect_op: 'expectOp',
  no_variable: 'noVariable',
  variable_twice: 'variableTwice',
  other_variable: 'otherVariable',
  mixed_direction: 'mixedDirection',
  eq_in_range: 'eqInRange',
  trailing: 'trailing',
  too_many_conditions: 'tooMany',
}

function errorFor(i: number): string {
  const e = errors.value.find((x) => x.line === i)
  return e ? t(`winterboard.numberLine.errors.${ERROR_KEYS[e.code]}`, e.params ?? {}) : ''
}

/** Перевірити всі рядки; усі правильні → один update:asset. Інакше — нічого не писати. */
function apply(): void {
  const rows = draft.value.map((text, line) => ({ text, line })).filter((r) => r.text.trim())
  const parsed = parseLines(rows.map((r) => r.text))
  if ('errors' in parsed) {
    errors.value = parsed.errors.map((e) => ({ ...e, line: rows[e.line]?.line ?? e.line }))
    return
  }
  const data: NumberLineData = {
    ...props.asset.data,
    conditions: parsed.conditions,
    variable: parsed.variable,
    combine: parsed.conditions.length > 1 ? draftCombine.value : props.asset.data.combine,
  }
  const ev = evaluate(data)
  if ('errors' in ev) {
    errors.value = ev.errors.map((e) => ({ ...e, line: rows[e.line]?.line ?? e.line }))
    return
  }
  errors.value = []
  emit('update:asset', { ...props.asset, data })
  const lines = appliedLines(data)
  synced.value = { lines, combine: data.combine }
  draft.value = [...lines]
}

function toggleAnswer(): void {
  emit('update:asset', {
    ...props.asset,
    data: { ...props.asset.data, showAnswer: props.asset.data.showAnswer === false },
  })
}

// TLV2-05B.2: у режимі стандарту карток ⛶/× малює спільна група полотна.
const hostWindowControls = useHostWindowControls()
</script>

<style scoped>
.nl-renderer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}
.nl-renderer.is-readonly .nl-header { display: none; }

.nl-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 11px;
  font-weight: 600;
  color: #1e3a8a;
  cursor: grab;
  user-select: none;
}
.nl-renderer.is-selected .nl-header { background: rgba(59, 130, 246, 0.16); }
.nl-title { flex: 1 1 auto; }

.nl-stage {
  flex: 1 1 auto;
  /* Рисунок не стискається в смужку, коли відкритий редактор. */
  min-height: 45%;
}

.nl-delete {
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
.nl-delete:hover { background: #dc2626; }

.nl-editor {
  flex: 0 0 auto;
  max-height: 50%;
  overflow-y: auto;
  padding: 6px 8px 8px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  pointer-events: auto;
  font-size: 13px;
}
.nl-row { margin-bottom: 4px; }
.nl-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font: 15px 'JetBrains Mono', monospace;
}
.nl-input.has-error { border-color: #dc2626; background: #fef2f2; }
.nl-error { color: #b91c1c; font-size: 12px; margin-top: 2px; }

.nl-keys { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.nl-key {
  min-width: 30px;
  padding: 3px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  font-size: 15px;
  cursor: pointer;
}
.nl-key--wide { font-size: 12px; }

.nl-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.nl-toggle, .nl-combine { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
.nl-dirty { color: #b45309; font-size: 12px; margin-left: auto; }
.nl-btn {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
}
.nl-btn--primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
</style>
