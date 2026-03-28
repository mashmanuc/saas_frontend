<template>
  <div class="test-checkbox" :class="`test-checkbox--${checkObj.layout || 'vertical'}`">
    <div
      v-for="(opt, i) in checkObj.options"
      :key="i"
      class="test-checkbox__option"
      :class="{
        'test-checkbox__option--correct': (mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i),
        'test-checkbox__option--hover-actions': mode === 'edit',
      }"
      @click.stop="handleOptionClick(i, $event)"
    >
      <input
        type="checkbox"
        :checked="isChecked(i)"
        :disabled="mode === 'review'"
        tabindex="-1"
        @click.stop
        @change="onToggle(i)"
      />

      <!-- Inline editable label -->
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
      >{{ opt }}</span>

      <!-- Correct indicator -->
      <span v-if="(mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i)" class="test-checkbox__check">✓</span>

      <!-- Hover delete button (edit mode) -->
      <button
        v-if="mode === 'edit' && checkObj.options.length > 2"
        type="button"
        class="test-checkbox__remove"
        @click.stop="emit('update-options', { action: 'remove', index: i })"
      >×</button>
    </div>

    <!-- Add option (edit mode) -->
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

const selectedIndices = computed<number[]>(() => {
  if (props.mode === 'edit') return [...checkObj.value.correctIndices]
  return (props.answer as number[]) ?? []
})

function isChecked(index: number): boolean {
  return selectedIndices.value.includes(index)
}

function handleOptionClick(i: number, e: MouseEvent) {
  // Flash-анімація при кліку
  const el = (e.currentTarget as HTMLElement)
  el.classList.remove('test-checkbox__option--flash')
  void el.offsetWidth // reflow trigger
  el.classList.add('test-checkbox__option--flash')

  if (props.mode === 'edit') {
    emit('toggle-correct', i)
  } else if (props.mode === 'live') {
    onToggle(i)
  }
}

function onToggle(index: number) {
  if (props.mode !== 'live') return
  const current = [...selectedIndices.value]
  const pos = current.indexOf(index)
  if (pos >= 0) {
    current.splice(pos, 1)
  } else {
    current.push(index)
  }
  emit('answer', current.sort())
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
  gap: 3px;
}
.test-checkbox--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}
.test-checkbox__option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
  padding: 5px 8px;
  border-radius: 8px;
  transition: all 0.12s ease;
  position: relative;
}
.test-checkbox__option--hover-actions {
  cursor: pointer;
}
.test-checkbox__option--hover-actions:hover {
  background: rgba(99, 102, 241, 0.06);
}
.test-checkbox__option--correct {
  color: #6366f1;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.05);
}
.test-checkbox__label {
  flex: 1;
  cursor: inherit;
  min-width: 0;
  word-break: break-word;
  line-height: 1.4;
}
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
.test-checkbox__check {
  color: #6366f1;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 50%;
}
.test-checkbox__remove {
  width: 20px;
  height: 20px;
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
.test-checkbox__option--flash {
  animation: checkbox-flash 0.35s ease-out;
}
@keyframes checkbox-flash {
  0% { background: rgba(99, 102, 241, 0.18); }
  100% { background: transparent; }
}
.test-checkbox__option--correct.test-checkbox__option--flash {
  animation: checkbox-flash-correct 0.35s ease-out;
}
@keyframes checkbox-flash-correct {
  0% { background: rgba(99, 102, 241, 0.25); }
  100% { background: rgba(99, 102, 241, 0.05); }
}
.test-checkbox__add {
  border: 1.5px dashed rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.03);
  padding: 5px 10px;
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
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  flex-shrink: 0;
  cursor: pointer;
}
</style>
