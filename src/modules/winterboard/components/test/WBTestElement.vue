<template>
  <div
    class="wb-test-element"
    :class="{
      'wb-test-element--selected': isSelected,
      'wb-test-element--live': mode === 'live',
      'wb-test-element--review': mode === 'review',
      'wb-test-element--correct': (mode === 'review' && gradeDetail?.correct) || checkResult === true,
      'wb-test-element--wrong': (mode === 'review' && gradeDetail && !gradeDetail.correct) || checkResult === false,
      'wb-test-element--locked': testObject.locked,
    }"
    :style="elementStyle"
    @pointerdown.stop="onPointerDown"
  >
    <!-- Label (all phases) -->
    <div v-if="testObject.label" class="wb-test-element__label">
      {{ testObject.label }}
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
    />
    <WBTestCheckboxEl
      v-else-if="testObject.type === 'checkbox'"
      :test-object="testObject"
      :mode="mode"
      :answer="answer"
      @answer="onAnswer"
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

    <!-- Edit mode: type badge -->
    <div v-if="mode === 'edit'" class="wb-test-element__badge">{{ typeBadge }}</div>

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
 * Phase 37: WBTestElement — wrapper + dispatcher for individual test objects.
 *
 * 3-фазна архітектура:
 *   edit   — drag/select/edit, показує правильні відповіді
 *   live   — учень відповідає, правильні відповіді приховані
 *   review — readonly, зелене/червоне підсвічування результатів
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestObject } from '../../types/winterboard'
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
  /** Phase 38: результат inline перевірки (true=правильно, false=неправильно, undefined=не перевірено) */
  checkResult?: boolean
}>()

const emit = defineEmits<{
  'select': []
  'update': [payload: { id: string; updates: Record<string, unknown> }]
  'answer': [payload: { objectId: string; answer: unknown }]
  'check': [objectId: string]
}>()

const typeBadge = computed(() => {
  const key = `winterboard.test.typeBadge.${props.testObject.type}`
  return t(key)
})

/** Phase 38: чи є відповідь (для показу кнопки перевірки) */
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
.wb-test-element {
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.wb-test-element--selected {
  border-color: #0066ff;
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.2), 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: move;
}

.wb-test-element--live {
  cursor: default;
  border-color: #e5e7eb;
}

/* Review mode: correct/wrong border */
.wb-test-element--correct {
  border-color: #22c55e;
  background: rgba(240, 253, 244, 0.95);
}

.wb-test-element--wrong {
  border-color: #ef4444;
  background: rgba(254, 242, 242, 0.95);
}

.wb-test-element--review {
  cursor: default;
}

.wb-test-element--locked {
  opacity: 0.7;
}

.wb-test-element__label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
  word-wrap: break-word;
}

.wb-test-element__badge {
  position: absolute;
  top: -10px;
  right: -6px;
  background: #6366f1;
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  pointer-events: none;
}

/* Review result badge */
.wb-test-element__result-badge {
  position: absolute;
  top: -10px;
  right: -6px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
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

/* Phase 38: Inline check button */
.wb-test-element__check-btn {
  position: absolute;
  top: -10px;
  left: -6px;
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
  transition: background 0.12s, transform 0.12s;
  z-index: 1;
}
.wb-test-element__check-btn:hover {
  background: #6366f1;
  color: white;
  transform: scale(1.15);
}
</style>
