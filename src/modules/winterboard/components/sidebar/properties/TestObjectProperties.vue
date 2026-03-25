<template>
  <div class="test-props">
    <!-- Type badge -->
    <div class="test-props__header">
      <span class="test-props__type-badge">{{ typeBadge }}</span>
      <span class="test-props__points">{{ object.points }} {{ t('winterboard.test.props.points').toLowerCase() }}</span>
    </div>

    <!-- Label -->
    <div class="test-props__section">
      <label class="test-props__label">{{ t('winterboard.test.props.labelQuestion') }}</label>
      <input
        type="text"
        class="test-props__input"
        :value="object.label ?? ''"
        :placeholder="t('winterboard.test.props.labelPlaceholder')"
        :disabled="isLocked"
        @change="update('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Type-specific settings -->
    <template v-if="object.type === 'input'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.inputType') }}</label>
        <select class="test-props__select" :value="(object as WBTestInput).inputType" :disabled="isLocked" @change="update('inputType', ($event.target as HTMLSelectElement).value)">
          <option value="text">{{ t('winterboard.test.props.textType') }}</option>
          <option value="number">{{ t('winterboard.test.props.numberType') }}</option>
        </select>
      </div>
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.correctAnswer') }}</label>
        <input type="text" class="test-props__input" :value="object.correctAnswer ?? ''" :placeholder="t('winterboard.test.props.correctAnswer')" :disabled="isLocked" @change="update('correctAnswer', ($event.target as HTMLInputElement).value)" />
      </div>
      <label class="test-props__check">
        <input type="checkbox" :checked="(object as WBTestInput).caseSensitive ?? false" :disabled="isLocked" @change="update('caseSensitive', ($event.target as HTMLInputElement).checked)" />
        {{ t('winterboard.test.props.caseSensitive') }}
      </label>
    </template>

    <template v-if="object.type === 'radio' || object.type === 'dropdown'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.options') }}</label>
        <div v-for="(opt, i) in (object as WBTestRadio).options" :key="i" class="test-props__option-row">
          <input
            type="radio"
            :name="`correct-${object.id}`"
            :checked="i === (object as WBTestRadio).correctIndex"
            :disabled="isLocked"
            @change="update('correctIndex', i)"
          />
          <input
            type="text"
            class="test-props__input test-props__input--sm"
            :value="opt"
            :disabled="isLocked"
            @change="updateOption(i, ($event.target as HTMLInputElement).value)"
          />
          <button v-if="!isLocked && (object as WBTestRadio).options.length > 2" type="button" class="test-props__btn-remove" @click="removeOption(i)">×</button>
        </div>
        <button v-if="!isLocked" type="button" class="test-props__btn-add" @click="addOption">{{ t('winterboard.test.props.addOption') }}</button>
      </div>
    </template>

    <template v-if="object.type === 'checkbox'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.optionsCheckCorrect') }}</label>
        <div v-for="(opt, i) in (object as WBTestCheckbox).options" :key="i" class="test-props__option-row">
          <input
            type="checkbox"
            :checked="(object as WBTestCheckbox).correctIndices.includes(i)"
            :disabled="isLocked"
            @change="toggleCorrectIndex(i)"
          />
          <input
            type="text"
            class="test-props__input test-props__input--sm"
            :value="opt"
            :disabled="isLocked"
            @change="updateOption(i, ($event.target as HTMLInputElement).value)"
          />
          <button v-if="!isLocked && (object as WBTestCheckbox).options.length > 2" type="button" class="test-props__btn-remove" @click="removeOption(i)">×</button>
        </div>
        <button v-if="!isLocked" type="button" class="test-props__btn-add" @click="addOption">{{ t('winterboard.test.props.addOption') }}</button>
      </div>
    </template>

    <template v-if="object.type === 'gap-fill'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.template') }}</label>
        <textarea
          class="test-props__textarea"
          :value="(object as WBTestGapFill).template ?? ''"
          :placeholder="t('winterboard.test.props.templatePlaceholder')"
          rows="3"
          :disabled="isLocked"
          @change="update('template', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
      <div class="test-props__section" v-if="(object as WBTestGapFill).gaps?.length">
        <label class="test-props__label">{{ t('winterboard.test.props.gapAnswers') }}</label>
        <div v-for="(gap, i) in (object as WBTestGapFill).gaps" :key="i" class="test-props__option-row">
          <span class="test-props__gap-num">{{ i + 1 }}.</span>
          <input
            type="text"
            class="test-props__input test-props__input--sm"
            :value="gap.correctAnswer"
            :disabled="isLocked"
            @change="updateGapAnswer(i, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </template>

    <template v-if="object.type === 'matching'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.matchingPairs') }}</label>
        <div v-for="(left, i) in (object as WBTestMatching).leftItems" :key="i" class="test-props__matching-row">
          <span class="test-props__gap-num">{{ i + 1 }}.</span>
          <input
            type="text"
            class="test-props__input test-props__input--sm"
            :value="left"
            :disabled="isLocked"
            :placeholder="t('winterboard.test.props.leftItem')"
            @change="updateMatchingLeft(i, ($event.target as HTMLInputElement).value)"
          />
          <span class="test-props__matching-arrow">→</span>
          <input
            type="text"
            class="test-props__input test-props__input--sm"
            :value="(object as WBTestMatching).rightItems[(object as WBTestMatching).correctPairs[i]]"
            :disabled="isLocked"
            :placeholder="t('winterboard.test.props.rightItem')"
            @change="updateMatchingRight(i, ($event.target as HTMLInputElement).value)"
          />
          <button v-if="!isLocked && (object as WBTestMatching).leftItems.length > 2" type="button" class="test-props__btn-remove" @click="removeMatchingPair(i)">×</button>
        </div>
        <button v-if="!isLocked" type="button" class="test-props__btn-add" @click="addMatchingPair">{{ t('winterboard.test.props.addPair') }}</button>
      </div>
    </template>

    <!-- Scoring -->
    <div class="test-props__section">
      <label class="test-props__label">{{ t('winterboard.test.props.points') }}</label>
      <input type="number" class="test-props__input test-props__input--xs" :value="object.points" min="0" max="100" :disabled="isLocked" @change="update('points', Number(($event.target as HTMLInputElement).value))" />
    </div>

    <!-- Position -->
    <div class="test-props__section">
      <label class="test-props__label">{{ t('winterboard.test.props.position') }}</label>
      <div class="test-props__pos-row">
        <label class="test-props__pos">X <input type="number" :value="object.x" :disabled="isLocked" @change="update('x', Number(($event.target as HTMLInputElement).value))" /></label>
        <label class="test-props__pos">Y <input type="number" :value="object.y" :disabled="isLocked" @change="update('y', Number(($event.target as HTMLInputElement).value))" /></label>
      </div>
      <div class="test-props__pos-row">
        <label class="test-props__pos">W <input type="number" :value="object.width" min="80" :disabled="isLocked" @change="update('width', Number(($event.target as HTMLInputElement).value))" /></label>
        <label class="test-props__pos">H <input type="number" :value="object.height" min="30" :disabled="isLocked" @change="update('height', Number(($event.target as HTMLInputElement).value))" /></label>
      </div>
    </div>

    <!-- Lock / Delete -->
    <div class="test-props__actions">
      <button type="button" class="test-props__btn" @click="update('locked', !object.locked)">
        {{ object.locked ? t('winterboard.test.props.unlock') : t('winterboard.test.props.lock') }}
      </button>
      <button type="button" class="test-props__btn test-props__btn--delete" :disabled="isLocked" @click="$emit('delete', object.id)">
        {{ t('winterboard.test.props.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 37: TestObjectProperties — sidebar panel for editing test object settings.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  WBTestObject,
  WBTestInput,
  WBTestRadio,
  WBTestCheckbox,
  WBTestGapFill,
  WBTestMatching,
} from '../../../types/winterboard'

const { t } = useI18n()

const props = defineProps<{
  object: WBTestObject
  isLocked: boolean
}>()

const emit = defineEmits<{
  'update': [payload: { id: string; updates: Record<string, unknown> }]
  'delete': [id: string]
}>()

const TYPE_BADGE_KEYS: Record<string, string> = {
  input: 'winterboard.test.input',
  radio: 'winterboard.test.radio',
  checkbox: 'winterboard.test.checkbox',
  dropdown: 'winterboard.test.dropdown',
  'gap-fill': 'winterboard.test.gapFill',
  'matching': 'winterboard.test.matching',
}

const typeBadge = computed(() => {
  const key = TYPE_BADGE_KEYS[props.object.type]
  const icon = { input: '📝', radio: '⭕', checkbox: '☑️', dropdown: '📋', 'gap-fill': '🔤', matching: '🔗' }[props.object.type] ?? ''
  return `${icon} ${key ? t(key) : props.object.type}`
})

function update(field: string, value: unknown) {
  emit('update', { id: props.object.id, updates: { [field]: value } })
}

// Options management for radio/checkbox/dropdown
function updateOption(index: number, value: string) {
  const obj = props.object as WBTestRadio | WBTestCheckbox
  const newOptions = [...obj.options]
  newOptions[index] = value
  emit('update', { id: props.object.id, updates: { options: newOptions } })
}

function addOption() {
  const obj = props.object as WBTestRadio | WBTestCheckbox
  const newOptions = [...obj.options, `Option ${obj.options.length + 1}`]
  emit('update', { id: props.object.id, updates: { options: newOptions } })
}

function removeOption(index: number) {
  const obj = props.object as WBTestRadio | WBTestCheckbox
  const newOptions = obj.options.filter((_, i) => i !== index)
  const updates: Record<string, unknown> = { options: newOptions }

  // Adjust correctIndex/correctIndices
  if ('correctIndex' in obj) {
    let ci = (obj as WBTestRadio).correctIndex
    if (ci === index) ci = 0
    else if (ci > index) ci--
    updates.correctIndex = ci
  }
  if ('correctIndices' in obj) {
    updates.correctIndices = (obj as WBTestCheckbox).correctIndices
      .filter(i => i !== index)
      .map(i => (i > index ? i - 1 : i))
  }

  emit('update', { id: props.object.id, updates })
}

function toggleCorrectIndex(index: number) {
  const obj = props.object as WBTestCheckbox
  const current = [...obj.correctIndices]
  const pos = current.indexOf(index)
  if (pos >= 0) {
    current.splice(pos, 1)
  } else {
    current.push(index)
  }
  emit('update', { id: props.object.id, updates: { correctIndices: current.sort() } })
}

function updateGapAnswer(index: number, value: string) {
  const obj = props.object as WBTestGapFill
  const newGaps = obj.gaps.map((g, i) => (i === index ? { ...g, correctAnswer: value } : g))
  emit('update', { id: props.object.id, updates: { gaps: newGaps } })
}

// Matching pair management
function updateMatchingLeft(index: number, value: string) {
  const obj = props.object as WBTestMatching
  const newLeft = [...obj.leftItems]
  newLeft[index] = value
  emit('update', { id: props.object.id, updates: { leftItems: newLeft } })
}

function updateMatchingRight(index: number, value: string) {
  const obj = props.object as WBTestMatching
  // right item at correctPairs[index] position
  const rightIdx = obj.correctPairs[index]
  const newRight = [...obj.rightItems]
  newRight[rightIdx] = value
  emit('update', { id: props.object.id, updates: { rightItems: newRight } })
}

function addMatchingPair() {
  const obj = props.object as WBTestMatching
  const n = obj.leftItems.length + 1
  const newLeft = [...obj.leftItems, `${n}`]
  const newRight = [...obj.rightItems, String.fromCharCode(64 + n)]
  const newPairs = [...obj.correctPairs, obj.rightItems.length]
  emit('update', { id: props.object.id, updates: { leftItems: newLeft, rightItems: newRight, correctPairs: newPairs } })
}

function removeMatchingPair(index: number) {
  const obj = props.object as WBTestMatching
  const removedRightIdx = obj.correctPairs[index]
  const newLeft = obj.leftItems.filter((_, i) => i !== index)
  const newRight = obj.rightItems.filter((_, i) => i !== removedRightIdx)
  const newPairs = obj.correctPairs
    .filter((_, i) => i !== index)
    .map(p => (p > removedRightIdx ? p - 1 : p))
  emit('update', { id: props.object.id, updates: { leftItems: newLeft, rightItems: newRight, correctPairs: newPairs } })
}
</script>

<style scoped>
.test-props {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.test-props__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #eef2ff;
  border-radius: 8px;
}
.test-props__type-badge {
  font-size: 13px;
  font-weight: 600;
  color: #4f46e5;
}
.test-props__points {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 12px;
}
.test-props__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.test-props__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
}
.test-props__input {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #111827;
  outline: none;
}
.test-props__input:focus {
  border-color: #6366f1;
}
.test-props__input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}
.test-props__input--sm { flex: 1; }
.test-props__input--xs { width: 80px; }
.test-props__select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.test-props__textarea {
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}
.test-props__check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.test-props__option-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.test-props__gap-num {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  min-width: 20px;
}
.test-props__matching-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.test-props__matching-arrow {
  color: #9ca3af;
  font-size: 14px;
  flex-shrink: 0;
}
.test-props__btn-add {
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  padding: 6px;
  font-size: 12px;
  color: #6366f1;
  cursor: pointer;
}
.test-props__btn-add:hover { border-color: #6366f1; }
.test-props__btn-remove {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: #ef4444;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}
.test-props__btn-remove:hover { background: rgba(239,68,68,0.1); }
.test-props__pos-row {
  display: flex;
  gap: 8px;
}
.test-props__pos {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.test-props__pos input {
  width: 64px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
}
.test-props__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.test-props__btn {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}
.test-props__btn:hover { background: #f3f4f6; }
.test-props__btn--delete {
  color: #ef4444;
  border-color: #fecaca;
}
.test-props__btn--delete:hover { background: rgba(239,68,68,0.08); }
.test-props__btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
