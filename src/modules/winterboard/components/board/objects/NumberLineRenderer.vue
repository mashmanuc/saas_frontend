<!--
  NumberLineRenderer — `number_line` (Б-184): числова пряма для нерівностей,
  систем і сукупностей.

  ДАНІ: лише застосований вхід учителя (умови + «система / сукупність»).
  Рисунок, відповідь, PDF-знімок — з одного обчислення `evaluate()` (інваріант 1).

  ВИГЛЯД — як у тригонометричних нерівностей (TrigSolver): картка — лише рисунок
  (HUD «вид · формула · відповідь» + пряма), усе керування — NumberLineInspector
  у правому сайдбарі (міст numberLineUiState). Чернетка живе тут, у рендері.

  ВВІД (ТЗ §2.3, одне правило):
    • Enter — новий рядок-умова, нічого не пише; Backspace у порожньому — прибрати рядок.
    • «Застосувати» / Ctrl+Enter — перевірка всіх рядків; усі правильні → РІВНО
      один `update:asset` (= штатний asset_update, «скасувати» відкочує його).
      Є помилка → нічого не пишеться: пояснення біля рядка, рисунок — застосований,
      текст лишається.
    • «Скасувати зміни» / Esc — текст повертається до застосованого.
    • Втрата фокусу нічого не пише й не стирає (позначка «не застосовано»).
  Чернетка — лише в цьому компоненті: не стан дошки, не ops, не запис уроку.

  POINTER-EVENTS: корінь — none (Konva-проксі тягне/виділяє).
  ЗНІМОК: окремий самодостатній SVG з інлайн-стилями (XMLSerializer не бере CSS),
  `useExportCapture` → без нього PDF отримав би картку-заглушку (інваріант 4а).
-->
<template>
  <div
    class="nl-card"
    :class="{ 'is-selected': isSelected, 'is-readonly': !interactive }"
    :data-testid="`number-line-renderer-${asset.id}`"
  >
    <!-- Header — pointer-events:none so clicks fall through to Konva proxy -->
    <header class="nl-head">
      <span class="nl-head-title">{{ formula || t('winterboard.numberLine.title') }}</span>
      <button
        v-if="!hostWindowControls && !asset.locked && isSelected && interactive"
        type="button"
        class="nl-delete"
        :title="t('common.delete')"
        @pointerdown.stop
        @mousedown.stop
        @click.stop="emit('delete')"
      >×</button>
    </header>

    <!-- Stage — один самодостатній SVG (і на дошці, і в PDF-знімку). Керування — в інспекторі. -->
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
        <rect x="0" y="0" :width="VB_W" :height="VB_H" :fill="C.bg" />

        <!-- HUD: вид · формула · відповідь (як у тригонометричних нерівностей) -->
        <rect x="14" y="10" :width="VB_W - 28" :height="zeroNote || domainNote ? 140 : 112" rx="10" :fill="C.hud" :stroke="C.hudBorder" stroke-width="1" />
        <text x="30" y="34" font-size="12" font-weight="700" letter-spacing="1" :fill="C.kind" data-testid="number-line-kind">{{ kindLabel }}</text>
        <text
          x="30" y="72"
          :font-size="fitFont(formula, 30)"
          font-weight="750"
          :font-family="MONO"
          :fill="C.ink"
          data-testid="number-line-formula"
        >{{ formula }}</text>
        <line x1="30" :x2="VB_W - 30" y1="86" y2="86" :stroke="C.hudBorder" stroke-width="1" />
        <text
          v-if="answerLine && asset.data.showAnswer !== false"
          x="30" y="110"
          :font-size="fitFont(answerLine, 17)"
          font-weight="700"
          :font-family="MONO"
          :fill="C.ink"
          data-testid="number-line-answer"
        >{{ answerLine }}</text>
        <!-- Коефіцієнт 0: міркування словами (0·x = 0 при будь-якому x → лишається числова нерівність) -->
        <text
          v-if="zeroNote"
          x="30" y="134"
          :font-size="fitFont(zeroNote, 13)"
          font-style="italic"
          :fill="C.muted"
          data-testid="number-line-zero-note"
        >{{ zeroNote }}</text>
        <text
          v-else-if="domainNote"
          x="30" y="134"
          :font-size="fitFont(domainNote, 14)"
          :fill="C.muted"
          data-testid="number-line-domain"
        >{{ domainNote }}</text>
        <text v-else-if="!layout" x="30" y="110" font-size="14" :fill="C.error">{{ t('winterboard.numberLine.storedInvalid') }}</text>
        <text v-else-if="isEmpty" x="30" y="110" font-size="14" :fill="C.muted">{{ t('winterboard.numberLine.emptyHint') }}</text>

        <!-- Розвʼязок — тонована смуга, як проміжки в тригонометрії -->
        <template v-if="layout">
          <rect
            v-for="(s, i) in layout.result"
            :key="`b-${i}`"
            :x="px(s.from)" :y="LINE_Y - 34"
            :width="Math.max(0, (s.to === 1 ? X1 + 10 : px(s.to)) - px(s.from))" height="68"
            :fill="C.band"
          />
        </template>

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

        <!-- Метод інтервалів: «змійка» знаків і + / − над проміжками -->
        <template v-if="layout?.signs?.length">
          <path
            v-for="(sg, i) in layout.signs"
            :key="`c-${i}`"
            :d="snake(sg)"
            fill="none"
            :stroke="C.snake"
            stroke-width="1.6"
            data-testid="number-line-snake"
          />
          <text
            v-for="(sg, i) in layout.signs"
            :key="`s-${i}`"
            :x="(px(sg.from) + (sg.to === 1 ? X1 : px(sg.to))) / 2"
            :y="LINE_Y - 42"
            text-anchor="middle"
            font-size="20"
            font-weight="700"
            :fill="sg.sign === '+' ? C.accent : C.minus"
            :data-testid="`number-line-sign-${i}`"
          >{{ sg.sign === '+' ? '+' : '−' }}</text>
        </template>

        <!-- Пряма зі стрілкою праворуч і підписом змінної -->
        <line :x1="X0" :y1="LINE_Y" :x2="X1 + 14" :y2="LINE_Y" :stroke="C.axis" stroke-width="2" />
        <path :d="`M ${X1 + 22} ${LINE_Y} l -12 -6 l 0 12 z`" :fill="C.axis" />
        <text :x="X1 + 18" :y="LINE_Y + 24" font-size="18" font-style="italic" :fill="C.axis">{{ asset.data.variable || 'x' }}</text>

        <template v-if="layout">
          <line
            v-for="(s, i) in layout.result"
            :key="`r-${i}`"
            :x1="px(s.from)" :y1="LINE_Y" :x2="s.to === 1 ? X1 + 10 : px(s.to)" :y2="LINE_Y"
            :stroke="C.accent"
            stroke-width="5"
            stroke-linecap="round"
            data-testid="number-line-result"
          />
        </template>

        <!-- Точки й підписи -->
        <template v-if="layout">
          <g v-for="(p, i) in layout.points" :key="`p-${i}`" :data-testid="`number-line-point-${i}`">
            <circle
              :cx="px(p.x)" :cy="LINE_Y" r="6.5"
              :fill="p.filled ? C.accent : C.bg"
              :stroke="C.accent"
              stroke-width="2.2"
              :data-filled="p.filled ? '1' : '0'"
            />
            <template v-if="fraction(p.label)">
              <text :x="px(p.x)" :y="LINE_Y + 30" text-anchor="middle" font-size="14" :fill="C.ink">{{ fraction(p.label)!.num }}</text>
              <line :x1="px(p.x) - 11" :y1="LINE_Y + 35" :x2="px(p.x) + 11" :y2="LINE_Y + 35" :stroke="C.ink" stroke-width="1.2" />
              <text :x="px(p.x)" :y="LINE_Y + 50" text-anchor="middle" font-size="14" :fill="C.ink">{{ fraction(p.label)!.den }}</text>
            </template>
            <text v-else :x="px(p.x)" :y="LINE_Y + 32" text-anchor="middle" font-size="16" :fill="C.ink">{{ p.label }}</text>
          </g>
        </template>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHostWindowControls } from '../../../composables/boardWindowControls'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'
import {
  conditionToText,
  displayNumber,
  evaluate,
  intervalsFormula,
  isConstCondition,
  parseIntervalsLine,
  parseLines,
  parseNumber,
  type IntervalsOp,
  type LayoutSegment,
  type LayoutSign,
  type NumberLineData,
  type NumberLineError,
} from '../../../engine/numberLine'
import type { NumberLineAsset } from '../../../types/numberLine'
import { compareReal, type Real } from '../../../engine/numberLine/real'
import type { SolverRefusal, SolverResult } from '../../../engine/numberLine/types'
import { winterboardApi } from '../../../api/winterboardApi'
import {
  registerNumberLine,
  unregisterNumberLine,
  type NumberLineBridge,
} from '../../../board/state/numberLineUiState'

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
const VB_W = 600
const VB_H = 270
const X0 = 30
const X1 = 552
const LINE_Y = 190
const FONT = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace"
/** Палітра тригонометричних нерівностей (TrigSolver): теплий папір + теракота. */
const C = {
  bg: '#fffaf0',
  hud: 'rgba(255, 250, 240, 0.95)',
  hudBorder: 'rgba(132, 79, 39, 0.22)',
  kind: '#9e4e20',
  ink: '#2b2118',
  muted: '#8a7860',
  error: '#a83a5b',
  axis: '#5a4a3a',
  accent: '#c4622a',
  band: 'rgba(196, 98, 42, 0.12)',
  snake: 'rgba(90, 74, 58, 0.55)',
  minus: '#3a6ea5',
}
const HATCH_COLORS = ['#8a6a4a', '#a83a5b', '#3a6ea5', '#5a7d3a', '#7a4a9a', '#b07a1a']

const stageRef = ref<HTMLElement | null>(null)
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(stageRef.value, signal),
)

const evaluation = computed(() => evaluate(props.asset.data))
/** null — у збережених даних помилка (рисунка немає, лише пояснення). */
const layout = computed(() => ('layout' in evaluation.value ? evaluation.value.layout : null))

/** «x > 1 і x ≤ 4» — те саме, що бачить Інтегралик. */
const formula = computed(() => {
  const d = props.asset.data
  if (d.mode === 'intervals') return intervalsFormula(d)
  if (d.mode === 'solved') return d.inequality ?? ''
  const joiner = ` ${t(d.combine === 'or' ? 'winterboard.numberLine.joinOr' : 'winterboard.numberLine.joinAnd')} `
  return d.conditions.map((c) => conditionToText(c, d.variable || 'x')).join(joiner)
})

const kindLabel = computed(() => {
  const d = props.asset.data
  if (d.mode === 'intervals') return t('winterboard.numberLine.kindIntervals').toUpperCase()
  if (d.mode === 'solved') return t('winterboard.numberLine.kindSolved').toUpperCase()
  const key = d.conditions.length <= 1 ? 'kindInequality' : d.combine === 'or' ? 'kindUnion' : 'kindSystem'
  return t(`winterboard.numberLine.${key}`).toUpperCase()
})

/** Порожня пряма: ще нічого не застосовано (підказка замість відповіді). */
const isEmpty = computed(() => {
  const d = props.asset.data
  if (d.mode === 'intervals') return !(d.expression && d.expression.trim()) && !d.points?.length
  if (d.mode === 'solved') return !d.result
  return !d.conditions.length
})

const answerLine = computed(() => {
  const ev = evaluation.value
  if (!('answer' in ev) || isEmpty.value) return ''
  if (ev.answer.kind === 'empty') return t('winterboard.numberLine.answerEmpty')
  const name = ev.answer.name ? ` — ${t(`winterboard.numberLine.names.${ev.answer.name}`)}` : ''
  return `${ev.answer.text}${name}`
})

/** Режим «Розвʼязати»: область визначення для коренів — окремим рядком (ТЗ розвʼязувача §1.2). */
const domainNote = computed(() => {
  const d = props.asset.data
  const dom = d.mode === 'solved' ? d.result?.domain : null
  return dom ? t('winterboard.numberLine.domainLine', { domain: dom }) : ''
})

/** Умови з коефіцієнтом 0 при змінній — пояснення, чому відповідь «усі числа» чи «∅». */
const zeroNote = computed(() => {
  const d = props.asset.data
  const v = d.variable || 'x'
  return d.conditions
    .filter(isConstCondition)
    .map((c) => t('winterboard.numberLine.zeroCoef', {
      variable: v,
      reduced: c.reduced.replace(/-/g, '−'),
      verdict: t(c.holds ? 'winterboard.numberLine.zeroTrue' : 'winterboard.numberLine.zeroFalse', { variable: v }),
    }))
    .join('; ')
})

/** Довгий рядок зменшується, щоб влізти в HUD (моноширинний ≈ 0,6 em на символ). */
function fitFont(text: string, max: number): number {
  const width = VB_W - 60
  return Math.max(11, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * 0.6))))
}

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

/**
 * Дуга «змійки» над (+) чи під (−) проміжком, як у підручнику; на нескінченних
 * краях — пологий вихід до краю прямої.
 */
function snake(sg: LayoutSign): string {
  const H = 24
  const y = sg.sign === '+' ? LINE_Y - H : LINE_Y + H
  const x1 = px(sg.from)
  const x2 = sg.to === 1 ? X1 : px(sg.to)
  if (sg.from === 0 && sg.to === 1) return `M ${x1} ${y} L ${x2} ${y}`
  if (sg.from === 0) return `M ${x1} ${y} Q ${x2 - (x2 - x1) * 0.15} ${y} ${x2} ${LINE_Y}`
  if (sg.to === 1) return `M ${x1} ${LINE_Y} Q ${x1 + (x2 - x1) * 0.15} ${y} ${x2} ${y}`
  return `M ${x1} ${LINE_Y} Q ${(x1 + x2) / 2} ${2 * y - LINE_Y} ${x2} ${LINE_Y}`
}

/** `−1/3`, `√3/2` → чисельник над знаменником (як у зошиті). */
function fraction(label: string): { num: string; den: string } | null {
  const m = /^([−-]?)(\d*√\d+|\d+)\/(\d+)$/.exec(label)
  return m ? { num: `${m[1]}${m[2]}`, den: m[3] } : null
}

// ── Чернетка (не стан дошки, не ops). Поля вводу — в NumberLineInspector. ──
const draftMode = ref<'set' | 'intervals' | 'solved'>('set')
// solved: уся нерівність одним рядком; розвʼязує сервер (ТЗ розвʼязувача §3).
const solveLine = ref('')
const solving = ref(false)
const solveError = ref('')
// set: рядки-умови + система / сукупність.
const draft = ref<string[]>([])
const draftCombine = ref<'and' | 'or'>('and')
const errors = ref<NumberLineError[]>([])
// intervals: вираз одним рядком або вручну — точки (через «;») + знаки + знак нерівності.
const ivInput = ref<'expression' | 'manual'>('expression')
const expressionLine = ref('')
const pointsText = ref('')
/** Зафарбована чи виколота — за записом точки (переживає пересортування). */
const included = ref<Record<string, boolean>>({})
const manualSigns = ref<Array<'+' | '-'>>([])
const manualOp = ref<IntervalsOp>('>')
const ivError = ref<NumberLineError | null>(null)

const OP_TEXT: Record<IntervalsOp, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' }
const isStrict = (op: IntervalsOp) => op === '<' || op === '>'

function appliedLines(d: NumberLineData): string[] {
  const lines = d.conditions.map((c) => conditionToText(c, d.variable || 'x'))
  return lines.length ? lines : ['']
}

/** Точки ручного режиму, як їх бачить учитель: за значенням, із «зафарбована / виколота». */
const manualView = computed(() => {
  const items = pointsText.value.split(';').map((x) => x.trim()).filter(Boolean)
  const pts: Array<{ label: string; value: Real }> = []
  for (let i = 0; i < items.length; i++) {
    const n = parseNumber(items[i])
    if ('error' in n) return { points: [], error: { ...n.error, line: i } as NumberLineError }
    if (pts.some((p) => compareReal(p.value, n.value) === 0)) {
      return { points: [], error: { line: i, index: 0, code: 'duplicate_point', params: { text: items[i] } } as NumberLineError }
    }
    pts.push({ label: items[i], value: n.value })
  }
  pts.sort((x, y) => compareReal(x.value, y.value))
  return {
    points: pts.map((p) => ({
      label: p.label,
      display: displayNumber(p.label),
      included: included.value[p.label] ?? !isStrict(manualOp.value),
    })),
    error: null as NumberLineError | null,
  }
})

/** Знаки на проміжках: учителеві (якщо кількість збігається) або чергування від «+» праворуч. */
const effectiveSigns = computed<Array<'+' | '-'>>(() => {
  const n = manualView.value.points.length
  if (manualSigns.value.length === n + 1) return manualSigns.value
  return Array.from({ length: n + 1 }, (_, i) => ((n - i) % 2 === 0 ? '+' : '-'))
})

const norm = (ls: string[]) => ls.map((l) => l.trim()).filter(Boolean).join('\n')

/** Відбиток чернетки: «не застосовано» — коли він відрізняється від застосованого. */
function snapshot(): string {
  if (draftMode.value === 'set') {
    const filled = draft.value.filter((l) => l.trim()).length
    return JSON.stringify({ m: 'set', l: norm(draft.value), c: filled > 1 ? draftCombine.value : '' })
  }
  if (draftMode.value === 'solved') return JSON.stringify({ m: 'sv', q: solveLine.value.trim().replace(/\s+/g, ' ') })
  if (ivInput.value === 'expression') return JSON.stringify({ m: 'iv', e: expressionLine.value.trim().replace(/\s+/g, ' ') })
  const v = manualView.value
  return JSON.stringify({
    m: 'ivm',
    p: v.error ? pointsText.value.trim() : v.points.map((x) => `${x.label}${x.included ? '●' : '○'}`).join(';'),
    s: effectiveSigns.value.join(''),
    o: manualOp.value,
  })
}

/** Застосоване, з якого чернетку синхронізовано востаннє. */
const synced = ref('')

function loadFrom(d: NumberLineData): void {
  draftMode.value = d.mode === 'intervals' || d.mode === 'solved' ? d.mode : 'set'
  solveLine.value = d.inequality ?? ''
  solveError.value = ''
  draft.value = [...appliedLines(d)]
  draftCombine.value = d.combine
  const manual = !(d.expression && d.expression.trim()) && !!d.points?.length
  ivInput.value = manual ? 'manual' : 'expression'
  expressionLine.value = d.expression && d.expression.trim() ? `${d.expression} ${OP_TEXT[d.op ?? '>']} ${d.rhs ?? '0'}` : ''
  pointsText.value = (d.points ?? []).map((p) => p.value).join('; ')
  included.value = Object.fromEntries((d.points ?? []).map((p) => [p.value.trim(), p.included]))
  manualSigns.value = [...(d.signs ?? [])]
  manualOp.value = d.op ?? '>'
  errors.value = []
  ivError.value = null
  synced.value = snapshot()
}

function revert(): void {
  loadFrom(props.asset.data)
}

const dirty = computed(() => snapshot() !== synced.value)

// Застосоване змінилось ззовні (інший учасник, «скасувати», Інтегралик): чернетки немає —
// показуємо нове застосоване; є незастосована чернетка — не стираємо її.
watch(
  () => {
    const d = props.asset.data
    return [d.mode, d.conditions, d.combine, d.variable, d.expression, d.rhs, d.op, d.points, d.signs, d.inequality, d.result]
  },
  () => { if (!dirty.value) revert() },
  { deep: true },
)
loadFrom(props.asset.data)

function setLine(i: number, value: string): void {
  draft.value[i] = value
  errors.value = errors.value.filter((e) => e.line !== i)
}

function addRow(after: number): number {
  const at = Math.min(Math.max(after, -1), draft.value.length - 1) + 1
  draft.value.splice(at, 0, '')
  errors.value = []
  return at
}

function removeRow(i: number): number {
  if (draft.value.length <= 1) return -1
  draft.value.splice(i, 1)
  errors.value = []
  return Math.max(0, i - 1)
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
  not_linear: 'notLinear',
  unbalanced_paren: 'unbalancedParen',
  root_sum: 'rootSum',
  root_form: 'rootForm',
  sum_with_fraction: 'sumWithFraction',
  too_complex: 'tooComplex',
  bad_power: 'badPower',
  rhs_not_zero: 'rhsNotZero',
  cannot_factor: 'cannotFactor',
  not_inequality: 'notInequality',
  duplicate_point: 'duplicatePoint',
  signs_count: 'signsCount',
  no_points: 'noPoints',
  ambiguous_denominator: 'ambiguousDenominator',
  too_large: 'tooLarge',
  too_long: 'tooLong',
  too_deep: 'tooDeep',
  bad_data: 'badData',
}

function errorFor(i: number): string {
  const e = errors.value.find((x) => x.line === i)
  return e ? t(`winterboard.numberLine.errors.${ERROR_KEYS[e.code]}`, e.params ?? {}) : ''
}

/** Застосувати дані: один update:asset, чернетка — тепер застосоване. */
function commit(data: NumberLineData): void {
  emit('update:asset', { ...props.asset, data })
  loadFrom(data)
}

/** Перевірити всі рядки; усі правильні → один update:asset. Інакше — нічого не писати. */
function apply(): void {
  if (draftMode.value === 'intervals') return applyIntervals()
  if (draftMode.value === 'solved') {
    void applySolved()
    return
  }
  const rows = draft.value.map((text, line) => ({ text, line })).filter((r) => r.text.trim())
  const parsed = parseLines(rows.map((r) => r.text))
  if ('errors' in parsed) {
    errors.value = parsed.errors.map((e) => ({ ...e, line: rows[e.line]?.line ?? e.line }))
    return
  }
  const data: NumberLineData = {
    ...props.asset.data,
    mode: 'set',
    conditions: parsed.conditions,
    variable: parsed.variable,
    combine: parsed.conditions.length > 1 ? draftCombine.value : props.asset.data.combine,
  }
  const ev = evaluate(data)
  if ('errors' in ev) {
    errors.value = ev.errors.map((e) => ({ ...e, line: rows[e.line]?.line ?? e.line }))
    return
  }
  commit(data)
}

/** Метод інтервалів: вираз одним рядком або точки й знаки вчителя. */
function applyIntervals(): void {
  let data: NumberLineData
  if (ivInput.value === 'expression') {
    const p = parseIntervalsLine(expressionLine.value)
    if ('error' in p) {
      ivError.value = { ...p.error, line: 0 }
      return
    }
    data = {
      ...props.asset.data,
      mode: 'intervals',
      expression: p.expression,
      rhs: p.rhs,
      op: p.op,
      variable: p.variable,
      points: undefined,
      signs: undefined,
    }
  } else {
    const v = manualView.value
    if (v.error) {
      ivError.value = v.error
      return
    }
    data = {
      ...props.asset.data,
      mode: 'intervals',
      expression: undefined,
      rhs: undefined,
      op: manualOp.value,
      points: v.points.map((x) => ({ value: x.label, included: x.included })),
      signs: [...effectiveSigns.value],
    }
  }
  const ev = evaluate(data)
  if ('errors' in ev) {
    ivError.value = ev.errors[0]
    return
  }
  commit(data)
}

/** Відмова сервера — словами; для форми запису (parse / degree / too_long) — ще й що саме не так. */
function solverErrorText(r: SolverRefusal): string {
  const base = t(`winterboard.numberLine.solver.${r.reason}`)
  return ['parse', 'degree', 'too_long'].includes(r.reason) && r.detail ? `${base}: ${r.detail}` : base
}

/**
 * «Розвʼязати»: сервер лише рахує; успіх → рівно один asset_update з нерівністю й відповіддю,
 * як прийшла (рисунок, PDF і запис малюють збережене, на сервер не ходять). Відмова — нуль записів.
 */
async function applySolved(): Promise<void> {
  const q = solveLine.value.trim()
  if (!q || solving.value) return
  solving.value = true
  solveError.value = ''
  try {
    const r = await winterboardApi.solveNumberLine(q)
    if (r.ok !== true) {
      solveError.value = solverErrorText(r as SolverRefusal)
      return
    }
    const { solver, ...result } = r as SolverResult & { solver?: string }
    const data: NumberLineData = { ...props.asset.data, mode: 'solved', inequality: q, result: result as SolverResult, solver: solver ?? '' }
    if ('errors' in evaluate(data)) {
      solveError.value = t('winterboard.numberLine.errors.badData')
      return
    }
    commit(data)
  } finally {
    solving.value = false
  }
}

const intervalsError = computed(() => {
  const e = ivError.value
  return e ? t(`winterboard.numberLine.errors.${ERROR_KEYS[e.code]}`, e.params ?? {}) : ''
})

function toggleAnswer(): void {
  emit('update:asset', {
    ...props.asset,
    data: { ...props.asset.data, showAnswer: props.asset.data.showAnswer === false },
  })
}

/* ── Inspector bridge ─────────────────────────────────────────────────────
   Registered while selected (і лише в редагуванні); NumberLineInspector читає
   чернетку й викликає дії. Pattern mirrors TrigSolverRenderer.
──────────────────────────────────────────────────────────────────────────── */
const showAnswer = computed(() => props.asset.data.showAnswer !== false)
const manualPoints = computed(() => manualView.value.points)
const _bridge = reactive({
  mode: draftMode,
  setMode: (m: 'set' | 'intervals' | 'solved') => { draftMode.value = m; ivError.value = null; solveError.value = '' },
  solveLine,
  setSolveLine: (v: string) => { solveLine.value = v; solveError.value = '' },
  solving,
  solveError,
  draft,
  combine: draftCombine,
  dirty,
  showAnswer,
  errorFor,
  setLine,
  addRow,
  removeRow,
  setCombine: (c: 'and' | 'or') => { draftCombine.value = c },
  ivInput,
  setIvInput: (m: 'expression' | 'manual') => { ivInput.value = m; ivError.value = null },
  expressionLine,
  setExpressionLine: (v: string) => { expressionLine.value = v; ivError.value = null },
  pointsText,
  setPointsText: (v: string) => { pointsText.value = v; ivError.value = null },
  manualPoints,
  togglePoint: (i: number) => {
    const p = manualView.value.points[i]
    if (p) included.value = { ...included.value, [p.label]: !p.included }
  },
  manualSigns: effectiveSigns,
  toggleSign: (i: number) => {
    const next = [...effectiveSigns.value]
    next[i] = next[i] === '+' ? '-' : '+'
    manualSigns.value = next
  },
  manualOp,
  setManualOp: (op: IntervalsOp) => { manualOp.value = op },
  intervalsError,
  apply,
  revert,
  toggleAnswer,
}) as unknown as NumberLineBridge

watch(
  () => props.isSelected && props.interactive,
  (on) => {
    if (on) registerNumberLine(props.asset.id, _bridge)
    else unregisterNumberLine(props.asset.id)
  },
  { immediate: true },
)
onBeforeUnmount(() => unregisterNumberLine(props.asset.id))

// TLV2-05B.2: у режимі стандарту карток ⛶/× малює спільна група полотна.
const hostWindowControls = useHostWindowControls()
</script>

<style scoped>
/* ── Root — pointer-events:none so Konva proxy below catches drag/select ── */
.nl-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  border-radius: 4px;
  overflow: hidden;
  pointer-events: none;
}

.nl-card.is-readonly .nl-head { display: none; }

/* ── Header — як у тригонометричних нерівностей ── */
.nl-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(196, 98, 42, 0.08);
  border-bottom: 1px solid rgba(196, 98, 42, 0.18);
  font-size: 11px;
  font-weight: 600;
  color: #5a4a3a;
  user-select: none;
}

.nl-card.is-selected .nl-head { background: rgba(196, 98, 42, 0.16); }

.nl-head-title {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nl-stage {
  flex: 1 1 auto;
  min-height: 0;
}

.nl-delete {
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

.nl-delete:hover {
  background: #dc2626;
  border-color: #f87171;
}
</style>
