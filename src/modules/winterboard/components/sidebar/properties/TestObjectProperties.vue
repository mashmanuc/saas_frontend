<template>
  <div class="test-props">
    <!-- Type badge (read-only) -->
    <div class="test-props__header">
      <span class="test-props__type-badge">{{ typeBadge }}</span>
    </div>

    <!-- Question / Label -->
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

    <!-- ── Input type ── -->
    <template v-if="object.type === 'input'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.correctAnswer') }}</label>
        <input type="text" class="test-props__input" :value="object.correctAnswer ?? ''" :placeholder="t('winterboard.test.props.correctAnswer')" :disabled="isLocked" @change="update('correctAnswer', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="test-props__row-inline">
        <select class="test-props__select test-props__select--compact" :value="(object as WBTestInput).inputType" :disabled="isLocked" @change="update('inputType', ($event.target as HTMLSelectElement).value)">
          <option value="text">{{ t('winterboard.test.props.textType') }}</option>
          <option value="number">{{ t('winterboard.test.props.numberType') }}</option>
        </select>
        <label class="test-props__check">
          <input type="checkbox" :checked="(object as WBTestInput).caseSensitive ?? false" :disabled="isLocked" @change="update('caseSensitive', ($event.target as HTMLInputElement).checked)" />
          {{ t('winterboard.test.props.caseSensitive') }}
        </label>
      </div>
    </template>

    <!-- ── Radio / Dropdown ── -->
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

    <!-- ── Checkbox ── -->
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

    <!-- ── Gap-fill ── -->
    <template v-if="object.type === 'gap-fill'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.template') }}</label>
        <textarea
          class="test-props__textarea"
          :value="(object as WBTestGapFill).template ?? ''"
          :placeholder="t('winterboard.test.props.templatePlaceholder')"
          rows="2"
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

    <!-- ── Matching ── -->
    <template v-if="object.type === 'matching'">
      <div class="test-props__section">
        <label class="test-props__label">{{ t('winterboard.test.props.matchingPairs') }}</label>
        <div v-for="(left, i) in (object as WBTestMatching).leftItems" :key="i" class="test-props__matching-row">
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

    <!-- ── Divider ── -->
    <div class="test-props__divider" />

    <!-- ── Actions (compact row) ── -->
    <div class="test-props__actions">
      <button type="button" class="test-props__action-btn" :disabled="isLocked" :title="t('winterboard.test.props.duplicate')" @click="$emit('duplicate', object.id)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
      <button type="button" class="test-props__action-btn" :title="object.locked ? t('winterboard.test.props.unlock') : t('winterboard.test.props.lock')" @click="update('locked', !object.locked)">
        <svg v-if="object.locked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>
      </button>
      <button type="button" class="test-props__action-btn test-props__action-btn--delete" :disabled="isLocked" :title="t('winterboard.test.props.delete')" @click="$emit('delete', object.id)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TestObjectProperties — чистий sidebar для вчителя.
 *
 * Принцип: sidebar = тільки зміст (запитання + варіанти).
 * Позиція, розмір, бали — прибрано (advanced mode в майбутньому).
 * Дії — компактні іконки внизу.
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
  'duplicate': [id: string]
}>()

const TYPE_BADGE_KEYS: Record<string, string> = {
  input: 'winterboard.test.input',
  radio: 'winterboard.test.radio',
  checkbox: 'winterboard.test.checkbox',
  dropdown: 'winterboard.test.dropdown',
  'gap-fill': 'winterboard.test.gapFill',
  'matching': 'winterboard.test.matching',
}

const TYPE_ICONS: Record<string, string> = {
  input: '📝',
  radio: '⭕',
  checkbox: '☑️',
  dropdown: '📋',
  'gap-fill': '🔤',
  matching: '🔗',
}

const typeBadge = computed(() => {
  const key = TYPE_BADGE_KEYS[props.object.type]
  const icon = TYPE_ICONS[props.object.type] ?? ''
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

function updateMatchingLeft(index: number, value: string) {
  const obj = props.object as WBTestMatching
  const newLeft = [...obj.leftItems]
  newLeft[index] = value
  emit('update', { id: props.object.id, updates: { leftItems: newLeft } })
}

function updateMatchingRight(index: number, value: string) {
  const obj = props.object as WBTestMatching
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
  gap: 12px;
  padding: 2px 0;
}

/* ── Header (type badge) ── */
.test-props__header {
  padding: 6px 10px;
  background: #eef2ff;
  border-radius: 6px;
}
.test-props__type-badge {
  font-size: 13px;
  font-weight: 600;
  color: #4f46e5;
}

/* ── Sections ── */
.test-props__section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.test-props__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
}

/* ── Inputs ── */
.test-props__input {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #111827;
  outline: none;
  transition: border-color 0.12s;
}
.test-props__input:focus {
  border-color: #6366f1;
}
.test-props__input:disabled {
  background: #f9fafb;
  color: #9ca3af;
}
.test-props__input--sm { flex: 1; }

.test-props__select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.test-props__select--compact {
  height: 28px;
  font-size: 12px;
}

.test-props__textarea {
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
}
.test-props__textarea:focus {
  border-color: #6366f1;
  outline: none;
}

.test-props__check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.test-props__row-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── Options rows ── */
.test-props__option-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.test-props__gap-num {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  min-width: 18px;
}
.test-props__matching-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
.test-props__matching-arrow {
  color: #c4b5fd;
  font-size: 13px;
  flex-shrink: 0;
}
.test-props__btn-add {
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  padding: 5px;
  font-size: 12px;
  color: #6366f1;
  cursor: pointer;
  transition: border-color 0.12s;
}
.test-props__btn-add:hover { border-color: #6366f1; }
.test-props__btn-remove {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  color: #d1d5db;
  font-size: 15px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 0.12s;
}
.test-props__btn-remove:hover { color: #ef4444; }

/* ── Divider ── */
.test-props__divider {
  height: 1px;
  background: #f3f4f6;
  margin: 2px 0;
}

/* ── Actions (compact icon row) ── */
.test-props__actions {
  display: flex;
  gap: 4px;
}
.test-props__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.12s;
}
.test-props__action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}
.test-props__action-btn--delete:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-color: #fecaca;
}
.test-props__action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
