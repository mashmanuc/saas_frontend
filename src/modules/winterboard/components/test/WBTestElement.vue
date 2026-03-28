<template>
  <div
    class="wb-test-element"
    :class="[
      `wb-test-element--type-${testObject.type}`,
      {
        'wb-test-element--selected': isSelected,
        'wb-test-element--editing': isActivelyEditing,
        'wb-test-element--edit': mode === 'edit',
        'wb-test-element--live': mode === 'live',
        'wb-test-element--review': mode === 'review',
        'wb-test-element--correct': (mode === 'review' && gradeDetail?.correct) || checkResult === true,
        'wb-test-element--wrong': (mode === 'review' && gradeDetail && !gradeDetail.correct) || checkResult === false,
        'wb-test-element--locked': testObject.locked,
      },
    ]"
    :style="elementStyle"
    @pointerdown.stop="onPointerDown"
    @focusin="hasChildFocus = true"
    @focusout="hasChildFocus = false"
  >
    <!-- Label: inline editable on dblclick (edit mode) -->
    <input
      v-if="isEditingLabel"
      ref="labelInputRef"
      type="text"
      class="wb-test-element__label-edit"
      :value="testObject.label ?? ''"
      :placeholder="t('winterboard.test.props.labelPlaceholder')"
      @blur="finishLabelEdit(($event.target as HTMLInputElement).value)"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
      @keydown.escape="isEditingLabel = false"
      @pointerdown.stop
      @click.stop
    />
    <div
      v-else-if="testObject.label || mode === 'edit'"
      class="wb-test-element__label"
      :class="{ 'wb-test-element__label--placeholder': !testObject.label }"
      :data-test-id="testObject.id"
      @dblclick.stop="startLabelEdit"
    >
      {{ testObject.label || (mode === 'edit' ? t('winterboard.test.props.labelPlaceholder') : '') }}
    </div>

    <!-- Dispatch by type -->
    <WBTestInputEl
      v-if="testObject.type === 'input'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
    />
    <WBTestRadioEl
      v-else-if="testObject.type === 'radio'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
      @set-correct="onSetCorrectIndex"
      @update-options="onUpdateOptions"
    />
    <WBTestCheckboxEl
      v-else-if="testObject.type === 'checkbox'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
      @toggle-correct="onToggleCorrectIndex"
      @update-options="onUpdateOptions"
    />
    <WBTestDropdownEl
      v-else-if="testObject.type === 'dropdown'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
    />
    <WBTestGapFillEl
      v-else-if="testObject.type === 'gap-fill'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
    />
    <WBTestMatchingEl
      v-else-if="testObject.type === 'matching'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
    />

    <!-- Edit mode: type badge with icon -->
    <div v-if="mode === 'edit'" class="wb-test-element__badge">
      <span class="wb-test-element__badge-icon">{{ typeIcon }}</span>
      {{ typeBadge }}
    </div>

    <!-- Phase 38: Inline check button (live mode, has answer, not yet checked) -->
    <button
      v-if="mode === 'live' && hasAnswer && checkResult === undefined"
      type="button"
      class="wb-test-element__check-btn"
      :title="t('winterboard.test.checkAnswer')"
      @click.stop="emit('check', testObject.id)"
    >
      ✓
    </button>

    <!-- Phase 38: Inline check result badge -->
    <div
      v-if="mode === 'live' && checkResult !== undefined"
      class="wb-test-element__result-badge"
      :class="checkResult ? 'wb-test-element__result-badge--correct' : 'wb-test-element__result-badge--wrong'"
    >
      {{ checkResult ? '✓' : '✗' }}
    </div>

    <!-- Review mode: correct/wrong indicator with points -->
    <div v-if="mode === 'review' && gradeDetail" class="wb-test-element__result-badge"
      :class="gradeDetail.correct ? 'wb-test-element__result-badge--correct' : 'wb-test-element__result-badge--wrong'"
    >
      {{ gradeDetail.correct ? '✓' : '✗' }} {{ gradeDetail.points }} / {{ testObject.points ?? 1 }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WBTestElement — inline-first wrapper for test objects on canvas.
 *
 * Inline interactions (edit mode):
 *   dblclick label → edit text
 *   click radio option → set correct
 *   click checkbox option → toggle correct
 *   dblclick option text → edit text
 *   hover option → show ×
 *   + button → add option
 *
 * Sidebar = secondary (додаткові опції).
 */
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestObject, WBTestRadio, WBTestCheckbox } from '../../types/winterboard'
import type { TestPhase, GradeResult } from '../../board/state/testStore'
import WBTestInputEl from './elements/WBTestInputEl.vue'
import WBTestRadioEl from './elements/WBTestRadioEl.vue'
import WBTestCheckboxEl from './elements/WBTestCheckboxEl.vue'
import WBTestDropdownEl from './elements/WBTestDropdownEl.vue'
import WBTestGapFillEl from './elements/WBTestGapFillEl.vue'
import WBTestMatchingEl from './elements/WBTestMatchingEl.vue'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestObject
  mode: TestPhase
  zoom: number
  isSelected: boolean
  answer?: unknown
  gradeDetail?: GradeResult['details'][0]
  checkResult?: boolean
}>()

const emit = defineEmits<{
  'select': []
  'update': [payload: { id: string; updates: Record<string, unknown> }]
  'answer': [payload: { objectId: string; answer: unknown }]
  'check': [objectId: string]
}>()

const TYPE_ICONS: Record<string, string> = {
  input: '📝', radio: '⭕', checkbox: '☑️', dropdown: '▼', 'gap-fill': '🔤', matching: '🔗',
}

const typeIcon = computed(() => TYPE_ICONS[props.testObject.type] ?? '')

const typeBadge = computed(() => {
  const key = `winterboard.test.typeBadge.${props.testObject.type}`
  return t(key)
})

const hasAnswer = computed(() => {
  const a = props.answer
  if (a === undefined || a === null || a === '') return false
  if (Array.isArray(a) && a.length === 0) return false
  return true
})

const elementStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${props.testObject.x}px`,
  top: `${props.testObject.y}px`,
  width: `${props.testObject.width}px`,
  minHeight: `${props.testObject.height}px`,
  pointerEvents: 'auto' as const,
}))

// ─── "Actively editing" state — label input OR child option input focused ──
const isEditingLabel = ref(false)
const hasChildFocus = ref(false)
const labelInputRef = ref<HTMLInputElement>()

/** True when any inline editor is open inside this card */
const isActivelyEditing = computed(() => isEditingLabel.value || hasChildFocus.value)

function startLabelEdit() {
  if (props.mode !== 'edit' || props.testObject.locked) return
  isEditingLabel.value = true
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

function finishLabelEdit(value: string) {
  isEditingLabel.value = false
  const trimmed = value.trim()
  if (trimmed !== (props.testObject.label ?? '')) {
    emit('update', { id: props.testObject.id, updates: { label: trimmed } })
  }
}

// ─── Inline option editing (radio/checkbox) ──────────────────────────────
function onSetCorrectIndex(index: number) {
  emit('update', { id: props.testObject.id, updates: { correctIndex: index } })
}

function onToggleCorrectIndex(index: number) {
  const obj = props.testObject as WBTestCheckbox
  const current = [...obj.correctIndices]
  const pos = current.indexOf(index)
  if (pos >= 0) {
    current.splice(pos, 1)
  } else {
    current.push(index)
  }
  emit('update', { id: props.testObject.id, updates: { correctIndices: current.sort() } })
}

function onUpdateOptions(payload: { action: string; index?: number; value?: string }) {
  const obj = props.testObject as WBTestRadio | WBTestCheckbox
  const options = [...obj.options]
  const updates: Record<string, unknown> = {}

  if (payload.action === 'add') {
    updates.options = [...options, `Option ${options.length + 1}`]
  } else if (payload.action === 'remove' && payload.index !== undefined) {
    updates.options = options.filter((_, i) => i !== payload.index)
    // Adjust correct indices
    if ('correctIndex' in obj) {
      let ci = (obj as WBTestRadio).correctIndex
      if (ci === payload.index) ci = 0
      else if (ci > payload.index) ci--
      updates.correctIndex = ci
    }
    if ('correctIndices' in obj) {
      updates.correctIndices = (obj as WBTestCheckbox).correctIndices
        .filter(i => i !== payload.index)
        .map(i => (i > payload.index! ? i - 1 : i))
    }
  } else if (payload.action === 'edit' && payload.index !== undefined && payload.value !== undefined) {
    options[payload.index] = payload.value
    updates.options = options
  }

  if (Object.keys(updates).length > 0) {
    emit('update', { id: props.testObject.id, updates })
  }
}

// ─── Drag to reposition (edit mode only) ──────────────────────────────────
const dragStart = ref<{ x: number; y: number; objX: number; objY: number } | null>(null)

function onPointerDown(e: PointerEvent) {
  emit('select')

  if (props.mode !== 'edit' || props.testObject.locked) return

  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    objX: props.testObject.x,
    objY: props.testObject.y,
  }

  const onMove = (ev: PointerEvent) => {
    if (!dragStart.value) return
    const dx = (ev.clientX - dragStart.value.x) / props.zoom
    const dy = (ev.clientY - dragStart.value.y) / props.zoom
    emit('update', {
      id: props.testObject.id,
      updates: {
        x: Math.round(dragStart.value.objX + dx),
        y: Math.round(dragStart.value.objY + dy),
      },
    })
  }

  const onUp = () => {
    dragStart.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onAnswer(answer: unknown) {
  emit('answer', { objectId: props.testObject.id, answer })
}
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   WBTestElement — polished card design with type personality
   ══════════════════════════════════════════════════════════════════════════ */

.wb-test-element {
  background: #ffffff;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.2s ease, transform 0.15s ease;
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  /* Subtle left accent — gives "type personality" */
  border-left: 3px solid transparent;
}

/* ── Type accent colors (left border) ── */
.wb-test-element--type-radio    { border-left-color: #818cf8; }  /* indigo-400 */
.wb-test-element--type-checkbox { border-left-color: #a78bfa; }  /* violet-400 */
.wb-test-element--type-input    { border-left-color: #60a5fa; }  /* blue-400 */
.wb-test-element--type-dropdown { border-left-color: #34d399; }  /* emerald-400 */
.wb-test-element--type-gap-fill { border-left-color: #fbbf24; }  /* amber-400 */
.wb-test-element--type-matching { border-left-color: #f472b6; }  /* pink-400 */

/* Edit mode — draggable feel */
.wb-test-element--edit {
  cursor: grab;
}
.wb-test-element--edit:hover {
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
}
.wb-test-element--edit:active {
  cursor: grabbing;
  transform: scale(0.985) translateY(0);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Selected — strong active focus ring */
.wb-test-element--selected {
  border-color: rgba(99, 102, 241, 0.6);
  border-left-color: #6366f1;
  outline: 2px solid rgba(99, 102, 241, 0.5);
  outline-offset: 1px;
  box-shadow:
    0 0 0 4px rgba(99, 102, 241, 0.1),
    0 4px 16px rgba(99, 102, 241, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.06);
  z-index: 2;
}

/* Actively editing — strong focus ring, distinct from selected */
.wb-test-element--editing {
  border-color: rgba(99, 102, 241, 0.8);
  border-left-color: #6366f1;
  box-shadow:
    0 0 0 6px rgba(99, 102, 241, 0.12),
    0 4px 16px rgba(99, 102, 241, 0.1);
  outline: none;
  opacity: 1 !important;
  z-index: 3;
}
/* Override hover lift when editing — stay grounded */
.wb-test-element--editing:hover {
  transform: none;
}

/* Non-selected in edit mode — subtly dimmed for hierarchy */
.wb-test-element--edit:not(.wb-test-element--selected):not(.wb-test-element--editing) {
  opacity: 0.92;
}
.wb-test-element--edit:not(.wb-test-element--selected):not(.wb-test-element--editing):hover {
  opacity: 1;
}

/* Live mode — neutral border */
.wb-test-element--live {
  cursor: default;
  border-color: #e5e7eb;
  border-left-width: 3px;
}
.wb-test-element--live:hover {
  border-color: #d1d5db;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.06);
  transform: none;
}

/* Review: correct */
.wb-test-element--correct {
  border-color: rgba(34, 197, 94, 0.5);
  border-left-color: #22c55e;
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(220, 252, 231, 0.6));
}

/* Review: wrong */
.wb-test-element--wrong {
  border-color: rgba(239, 68, 68, 0.4);
  border-left-color: #ef4444;
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(254, 226, 226, 0.6));
}

.wb-test-element--review {
  cursor: default;
}
.wb-test-element--review:hover {
  transform: none;
}

.wb-test-element--locked {
  opacity: 0.65;
}

/* ── Label (question text) ── */
.wb-test-element__label {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  line-height: 1.45;
  word-wrap: break-word;
  padding: 2px 4px;
  border-radius: 4px;
  margin-bottom: 2px;
  cursor: text;
  transition: background 0.1s;
}
.wb-test-element--edit .wb-test-element__label:hover {
  background: rgba(99, 102, 241, 0.06);
}
.wb-test-element__label--placeholder {
  color: #a5b4fc;
  font-weight: 400;
  font-style: italic;
  opacity: 0.7;
}

/* Label inline edit input */
.wb-test-element__label-edit {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.45;
  padding: 2px 6px;
  border: 1.5px solid #6366f1;
  border-radius: 6px;
  outline: none;
  background: #fff;
  width: 100%;
  height: 30px;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* ── Type badge — soft pill ── */
.wb-test-element__badge {
  position: absolute;
  top: -8px;
  right: -4px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 3px;
}
.wb-test-element__badge-icon {
  font-size: 10px;
  line-height: 1;
}

/* ── Review result badge ── */
.wb-test-element__result-badge {
  position: absolute;
  top: -8px;
  right: -4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  pointer-events: none;
}

.wb-test-element__result-badge--correct {
  background: #22c55e;
  color: white;
}

.wb-test-element__result-badge--wrong {
  background: #ef4444;
  color: white;
}

/* ── Inline check button ── */
.wb-test-element__check-btn {
  position: absolute;
  top: -8px;
  left: -4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #6366f1;
  background: white;
  color: #6366f1;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  transition: all 0.15s ease;
  z-index: 1;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.2);
}
.wb-test-element__check-btn:hover {
  background: #6366f1;
  color: white;
  transform: scale(1.15);
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3);
}
</style>
