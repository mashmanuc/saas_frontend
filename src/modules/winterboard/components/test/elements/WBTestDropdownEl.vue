<template>
  <div class="test-dropdown">
    <select
      class="test-dropdown__select"
      :value="currentValue"
      :disabled="mode !== 'live'"
      @change="onSelect"
    >
      <option :value="-1" disabled>{{ t('winterboard.test.chooseAnswer') }}</option>
      <option
        v-for="(opt, i) in dropObj.options"
        :key="i"
        :value="i"
      >
        {{ opt }}
      </option>
    </select>
    <div v-if="mode === 'edit' || mode === 'review'" class="test-dropdown__hint">
      {{ t('winterboard.test.correct') }}: {{ dropObj.options[dropObj.correctIndex] }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBTestDropdown } from '../../../types/winterboard'
import type { TestPhase } from '../../../board/state/testStore'

const { t } = useI18n()

const props = defineProps<{
  testObject: WBTestDropdown
  mode: TestPhase
  answer?: unknown
}>()

const emit = defineEmits<{ 'answer': [value: unknown] }>()

const dropObj = computed(() => props.testObject as WBTestDropdown)

const currentValue = computed(() => {
  if (props.mode === 'edit') return dropObj.value.correctIndex
  return typeof props.answer === 'number' ? props.answer : -1
})

function onSelect(e: Event) {
  if (props.mode !== 'live') return
  emit('answer', Number((e.target as HTMLSelectElement).value))
}
</script>

<style scoped>
.test-dropdown__select {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: #fafafa;
  color: #111827;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}
.test-dropdown__select:focus {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.test-dropdown__select:disabled {
  background: #f9fafb;
  cursor: default;
}
.test-dropdown__hint {
  font-size: 11px;
  color: #6366f1;
  font-style: italic;
  margin-top: 2px;
  padding-left: 2px;
  opacity: 0.8;
}
</style>
