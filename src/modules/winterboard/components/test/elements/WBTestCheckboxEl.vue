<template>
  <div class="test-checkbox" :class="`test-checkbox--${checkObj.layout || 'vertical'}`">
    <div
      v-for="(opt, i) in checkObj.options"
      :key="i"
      class="test-checkbox__option"
      :class="{
        'test-checkbox__option--selected':     isOptionSelected(i),
        'test-checkbox__option--correct-hint': (mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i),
        'test-checkbox__option--wrong-hint':   mode === 'review' && isWrongSelection(i),
        'test-checkbox__option--clickable':    mode === 'edit' || mode === 'live',
      }"
      @click.stop="handleOptionClick(i, $event)"
    >
      <span class="test-checkbox__letter">{{ optionLetter(i) }}</span>

      <input
        v-if="editingIndex === i"
        ref="editInputRef"
        type="text"
        class="test-checkbox__inline-edit"
        :value="opt"
        @blur="finishEdit(i, ($event.target as HTMLInputElement).value)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.escape="editingIndex = -1"
        @click.stop
        @pointerdown.stop
      />
      <span
        v-else
        class="test-checkbox__label"
        @dblclick.stop="startEdit(i)"
        v-html="renderTextWithLatex(opt)"
      />

      <span
        v-if="(mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i)"
        class="test-checkbox__indicator test-checkbox__indicator--correct"
      >✓</span>
      <span
        v-else-if="mode === 'review' && isWrongSelection(i)"
        class="test-checkbox__indicator test-checkbox__indicator--wrong"
      >✗</span>

      <button
        v-if="mode === 'edit' && checkObj.options.length > 2"
        type="button"
        class="test-checkbox__remove"
        @click.stop="emit('update-options', { action: 'remove', index: i })"
      >×</button>
    </div>

    <button
      v-if="mode === 'edit'"
      type="button"
      class="test-checkbox__add"
      @click.stop="emit('update-options', { action: 'add' })"
    >+ {{ t('winterboard.test.props.addOption') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import type { WBTestCheckbox } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestCheckbox
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{
  'answer': [value: unknown]
  'update-options': [payload: { action: string; index?: number; value?: string }]
  'toggle-correct': [index: number]
}>()

const checkObj = computed(() => props.testObject as WBTestCheckbox)

const editingIndex = ref(-1)
const editInputRef = ref<HTMLInputElement[]>()

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є', 'Ж', 'З', 'І']

function optionLetter(i: number): string {
  return LETTERS[i] ?? String(i + 1)
}

const selectedIndices = computed<number[]>(() => {
  if (props.mode === 'edit') return [...checkObj.value.correctIndices]
  return (props.answer as number[]) ?? []
})

function isOptionSelected(i: number): boolean {
  return selectedIndices.value.includes(i)
}

function isWrongSelection(i: number): boolean {
  return selectedIndices.value.includes(i) && !checkObj.value.correctIndices.includes(i)
}

function handleOptionClick(i: number, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  el.classList.remove('test-checkbox__option--flash')
  void el.offsetWidth
  el.classList.add('test-checkbox__option--flash')

  if (props.mode === 'edit') {
    emit('toggle-correct', i)
  } else if (props.mode === 'live') {
    const current = [...selectedIndices.value]
    const pos = current.indexOf(i)
    if (pos >= 0) {
      current.splice(pos, 1)
    } else {
      current.push(i)
    }
    emit('answer', current.sort())
  }
}

function startEdit(i: number) {
  if (props.mode !== 'edit') return
  editingIndex.value = i
  nextTick(() => {
    const inputs = editInputRef.value
    if (inputs && inputs[0]) {
      inputs[0].focus()
      inputs[0].select()
    }
  })
}

function finishEdit(i: number, value: string) {
  editingIndex.value = -1
  if (value.trim() && value !== checkObj.value.options[i]) {
    emit('update-options', { action: 'edit', index: i, value: value.trim() })
  }
}
</script>

<style scoped>
.test-checkbox {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.test-checkbox--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Option row ── */
.test-checkbox__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 6px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  background: rgba(0, 0, 0, 0.025);
  transition: background 0.12s ease, border-color 0.12s ease;
  position: relative;
  user-select: none;
}

.test-checkbox__option--clickable {
  cursor: pointer;
}

.test-checkbox__option--clickable:hover {
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.18);
}

.test-checkbox__option--selected {
  background: rgba(99, 102, 241, 0.09);
  border-color: rgba(99, 102, 241, 0.35);
}

.test-checkbox__option--correct-hint {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.35);
}

.test-checkbox__option--wrong-hint {
  background: rgba(239, 68, 68, 0.07);
  border-color: rgba(239, 68, 68, 0.3);
}

/* ── Letter badge ── */
.test-checkbox__letter {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s ease, color 0.12s ease;
}

.test-checkbox__option--selected .test-checkbox__letter {
  background: #6366f1;
  color: #fff;
}

.test-checkbox__option--correct-hint .test-checkbox__letter {
  background: #22c55e;
  color: #fff;
}

.test-checkbox__option--wrong-hint .test-checkbox__letter {
  background: #ef4444;
  color: #fff;
}

/* ── Label text ── */
.test-checkbox__label {
  flex: 1;
  font-size: 13px;
  color: #374151;
  line-height: 1.45;
  word-break: break-word;
  min-width: 0;
  cursor: inherit;
}

.test-checkbox__option--selected .test-checkbox__label {
  color: #4338ca;
  font-weight: 500;
}

.test-checkbox__option--correct-hint .test-checkbox__label {
  color: #166534;
}

.test-checkbox__option--wrong-hint .test-checkbox__label {
  color: #991b1b;
}

/* ── Correct / wrong indicator dot ── */
.test-checkbox__indicator {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
}

.test-checkbox__indicator--correct {
  background: #22c55e;
  color: #fff;
}

.test-checkbox__indicator--wrong {
  background: #ef4444;
  color: #fff;
}

/* ── Inline edit input ── */
.test-checkbox__inline-edit {
  flex: 1;
  height: 26px;
  padding: 0 6px;
  border: 1.5px solid #6366f1;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #111827;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* ── Remove button (edit mode hover) ── */
.test-checkbox__remove {
  width: 18px;
  height: 18px;
  border: none;
  background: none;
  color: transparent;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.test-checkbox__option:hover .test-checkbox__remove {
  color: #d1d5db;
}

.test-checkbox__remove:hover {
  color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.08);
}

/* ── Flash on click ── */
.test-checkbox__option--flash {
  animation: checkbox-flash 0.3s ease-out;
}

@keyframes checkbox-flash {
  0%   { opacity: 0.55; }
  100% { opacity: 1; }
}

/* ── Add option button ── */
.test-checkbox__add {
  border: 1.5px dashed rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.03);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #818cf8;
  cursor: pointer;
  text-align: center;
  border-radius: 8px;
  transition: all 0.15s ease;
  margin-top: 2px;
}

.test-checkbox__add:hover {
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.07);
}
</style>
