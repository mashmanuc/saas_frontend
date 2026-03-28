<template>
  <div class="test-radio" :class="`test-radio--${radioObj.layout || 'vertical'}`">
    <div
      v-for="(opt, i) in radioObj.options"
      :key="i"
      class="test-radio__option"
      :class="{
        'test-radio__option--correct': (mode === 'edit' || mode === 'review') && i === radioObj.correctIndex,
        'test-radio__option--hover-actions': mode === 'edit',
      }"
      @click.stop="handleOptionClick(i, $event)"
    >
      <input
        type="radio"
        :name="`radio-${testObject.id}`"
        :value="i"
        :checked="mode === 'live' || mode === 'review' ? answer === i : i === radioObj.correctIndex"
        :disabled="mode === 'review'"
        tabindex="-1"
        @click.stop
        @change="onSelect(i)"
      />

      <!-- Inline editable label -->
      <input
        v-if="editingIndex === i"
        ref="editInputRef"
        type="text"
        class="test-radio__inline-edit"
        :value="opt"
        @blur="finishEdit(i, ($event.target as HTMLInputElement).value)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.escape="editingIndex = -1"
        @click.stop
        @pointerdown.stop
      />
      <span
        v-else
        class="test-radio__label"
        @dblclick.stop="startEdit(i)"
      >{{ opt }}</span>

      <!-- Edit mode: correct indicator -->
      <span v-if="(mode === 'edit' || mode === 'review') && i === radioObj.correctIndex" class="test-radio__check">✓</span>

      <!-- Edit mode: hover delete button -->
      <button
        v-if="mode === 'edit' && radioObj.options.length > 2"
        type="button"
        class="test-radio__remove"
        @click.stop="emit('update-options', { action: 'remove', index: i })"
      >×</button>
    </div>

    <!-- Add option (edit mode) -->
    <button
      v-if="mode === 'edit'"
      type="button"
      class="test-radio__add"
      @click.stop="emit('update-options', { action: 'add' })"
    >+ {{ t('winterboard.test.props.addOption') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestRadio } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestRadio
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{
  'answer': [value: unknown]
  'update-options': [payload: { action: string; index?: number; value?: string }]
  'set-correct': [index: number]
}>()

const radioObj = computed(() => props.testObject as WBTestRadio)

const editingIndex = ref(-1)
const editInputRef = ref<HTMLInputElement[]>()

function handleOptionClick(i: number, e: MouseEvent) {
  // Flash-анімація при кліку
  const el = (e.currentTarget as HTMLElement)
  el.classList.remove('test-radio__option--flash')
  void el.offsetWidth // reflow trigger
  el.classList.add('test-radio__option--flash')

  if (props.mode === 'edit') {
    emit('set-correct', i)
  } else if (props.mode === 'live') {
    onSelect(i)
  }
}

function onSelect(index: number) {
  if (props.mode !== 'live') return
  emit('answer', index)
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
  if (value.trim() && value !== radioObj.value.options[i]) {
    emit('update-options', { action: 'edit', index: i, value: value.trim() })
  }
}
</script>

<style scoped>
.test-radio {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.test-radio--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}
.test-radio__option {
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
.test-radio__option--hover-actions {
  cursor: pointer;
}
.test-radio__option--hover-actions:hover {
  background: rgba(99, 102, 241, 0.06);
}
.test-radio__option--correct {
  color: #6366f1;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.05);
}
.test-radio__label {
  flex: 1;
  cursor: inherit;
  min-width: 0;
  word-break: break-word;
  line-height: 1.4;
}
.test-radio__inline-edit {
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
.test-radio__check {
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
.test-radio__remove {
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
.test-radio__option:hover .test-radio__remove {
  color: #d1d5db;
}
.test-radio__remove:hover {
  color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.08);
}
.test-radio__option--flash {
  animation: radio-flash 0.35s ease-out;
}
@keyframes radio-flash {
  0% { background: rgba(99, 102, 241, 0.18); }
  100% { background: transparent; }
}
.test-radio__option--correct.test-radio__option--flash {
  animation: radio-flash-correct 0.35s ease-out;
}
@keyframes radio-flash-correct {
  0% { background: rgba(99, 102, 241, 0.25); }
  100% { background: rgba(99, 102, 241, 0.05); }
}
.test-radio__add {
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
.test-radio__add:hover {
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.07);
}
input[type="radio"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  flex-shrink: 0;
  cursor: pointer;
}
</style>
