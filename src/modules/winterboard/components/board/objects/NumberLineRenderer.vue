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
        <rect x="14" y="10" :width="VB_W - 28" :height="zeroNote ? 140 : 112" rx="10" :fill="C.hud" :stroke="C.hudBorder" stroke-width="1" />
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
        <text v-else-if="!layout" x="30" y="110" font-size="14" :fill="C.error">{{ t('winterboard.numberLine.storedInvalid') }}</text>
        <text v-else-if="!asset.data.conditions.length" x="30" y="110" font-size="14" :fill="C.muted">{{ t('winterboard.numberLine.emptyHint') }}</text>

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
  evaluate,
  isConstCondition,
  parseLines,
  type LayoutSegment,
  type NumberLineData,
  type NumberLineError,
} from '../../../engine/numberLine'
import type { NumberLineAsset } from '../../../types/numberLine'
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
  const joiner = ` ${t(d.combine === 'or' ? 'winterboard.numberLine.joinOr' : 'winterboard.numberLine.joinAnd')} `
  return d.conditions.map((c) => conditionToText(c, d.variable || 'x')).join(joiner)
})

const kindLabel = computed(() => {
  const d = props.asset.data
  const key = d.conditions.length <= 1 ? 'kindInequality' : d.combine === 'or' ? 'kindUnion' : 'kindSystem'
  return t(`winterboard.numberLine.${key}`).toUpperCase()
})

const answerLine = computed(() => {
  const ev = evaluation.value
  if (!('answer' in ev) || !props.asset.data.conditions.length) return ''
  if (ev.answer.kind === 'empty') return t('winterboard.numberLine.answerEmpty')
  const name = ev.answer.name ? ` — ${t(`winterboard.numberLine.names.${ev.answer.name}`)}` : ''
  return `${ev.answer.text}${name}`
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

/** `−1/3` → чисельник над знаменником (як у зошиті). */
function fraction(label: string): { num: string; den: string } | null {
  const m = /^([−-]?)(\d+)\/(\d+)$/.exec(label)
  return m ? { num: `${m[1]}${m[2]}`, den: m[3] } : null
}

// ── Чернетка (не стан дошки, не ops). Поля вводу — в NumberLineInspector. ──
const draft = ref<string[]>([])
const draftCombine = ref<'and' | 'or'>('and')
const errors = ref<NumberLineError[]>([])

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

/* ── Inspector bridge ─────────────────────────────────────────────────────
   Registered while selected (і лише в редагуванні); NumberLineInspector читає
   чернетку й викликає дії. Pattern mirrors TrigSolverRenderer.
──────────────────────────────────────────────────────────────────────────── */
const showAnswer = computed(() => props.asset.data.showAnswer !== false)
const _bridge = reactive({
  draft,
  combine: draftCombine,
  dirty,
  showAnswer,
  errorFor,
  setLine,
  addRow,
  removeRow,
  setCombine: (c: 'and' | 'or') => { draftCombine.value = c },
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
