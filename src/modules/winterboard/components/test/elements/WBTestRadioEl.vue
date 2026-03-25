<template>
  <div class="test-radio" :class="`test-radio--${radioObj.layout || 'vertical'}`">
    <label
      v-for="(opt, i) in radioObj.options"
      :key="i"
      class="test-radio__option"
      :class="{
        'test-radio__option--correct': (mode === 'edit' || mode === 'review') && i === radioObj.correctIndex,
      }"
    >
      <input
        type="radio"
        :name="`radio-${testObject.id}`"
        :value="i"
        :checked="mode === 'live' || mode === 'review' ? answer === i : i === radioObj.correctIndex"
        :disabled="mode !== 'live'"
        @change="onSelect(i)"
      />
      <span class="test-radio__label">{{ opt }}</span>
      <span v-if="(mode === 'edit' || mode === 'review') && i === radioObj.correctIndex" class="test-radio__check">✓</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WBTestRadio } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const props = defineProps<{
  testObject: WBTestRadio
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const radioObj = computed(() => props.testObject as WBTestRadio)

function onSelect(index: number) {
  if (props.mode !== 'live') return
  emit('answer', index)
}
</script>

<style scoped>
.test-radio {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.test-radio--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
}
.test-radio__option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  padding: 4px 0;
}
.test-radio__option--correct {
  color: #059669;
  font-weight: 500;
}
.test-radio__label {
  flex: 1;
}
.test-radio__check {
  color: #059669;
  font-size: 14px;
  font-weight: 700;
}
input[type="radio"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  flex-shrink: 0;
}
</style>
