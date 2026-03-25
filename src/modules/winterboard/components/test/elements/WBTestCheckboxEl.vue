<template>
  <div class="test-checkbox" :class="`test-checkbox--${checkObj.layout || 'vertical'}`">
    <label
      v-for="(opt, i) in checkObj.options"
      :key="i"
      class="test-checkbox__option"
      :class="{
        'test-checkbox__option--correct': (mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i),
      }"
    >
      <input
        type="checkbox"
        :checked="isChecked(i)"
        :disabled="mode !== 'live'"
        @change="onToggle(i)"
      />
      <span class="test-checkbox__label">{{ opt }}</span>
      <span v-if="(mode === 'edit' || mode === 'review') && checkObj.correctIndices.includes(i)" class="test-checkbox__check">✓</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WBTestCheckbox } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const props = defineProps<{
  testObject: WBTestCheckbox
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const checkObj = computed(() => props.testObject as WBTestCheckbox)

const selectedIndices = computed<number[]>(() => {
  if (props.mode === 'edit') return [...checkObj.value.correctIndices]
  return (props.answer as number[]) ?? []
})

function isChecked(index: number): boolean {
  return selectedIndices.value.includes(index)
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
</script>

<style scoped>
.test-checkbox {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.test-checkbox--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
}
.test-checkbox__option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  padding: 4px 0;
}
.test-checkbox__option--correct {
  color: #059669;
  font-weight: 500;
}
.test-checkbox__label {
  flex: 1;
}
.test-checkbox__check {
  color: #059669;
  font-size: 14px;
  font-weight: 700;
}
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  flex-shrink: 0;
}
</style>
