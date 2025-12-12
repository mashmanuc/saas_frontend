<script setup lang="ts">
// F14: Booking Form Component
import { computed } from 'vue'

interface Subject {
  name: string
  id?: number
}

const props = defineProps<{
  subject: string
  lessonType: 'trial' | 'regular'
  notes: string
  subjects: Subject[]
  trialAvailable?: boolean
}>()

const emit = defineEmits<{
  'update:subject': [value: string]
  'update:lessonType': [value: 'trial' | 'regular']
  'update:notes': [value: string]
}>()

const subjectModel = computed({
  get: () => props.subject,
  set: (v) => emit('update:subject', v),
})

const lessonTypeModel = computed({
  get: () => props.lessonType,
  set: (v) => emit('update:lessonType', v),
})

const notesModel = computed({
  get: () => props.notes,
  set: (v) => emit('update:notes', v),
})
</script>

<template>
  <div class="booking-form">
    <!-- Subject -->
    <div class="form-group">
      <label for="subject">Subject</label>
      <select id="subject" v-model="subjectModel" required>
        <option value="" disabled>Select a subject</option>
        <option v-for="s in subjects" :key="s.name" :value="s.name">
          {{ s.name }}
        </option>
      </select>
    </div>

    <!-- Lesson Type -->
    <div class="form-group">
      <label>Lesson Type</label>
      <div class="lesson-type-options">
        <label class="radio-option" :class="{ selected: lessonTypeModel === 'regular' }">
          <input
            type="radio"
            v-model="lessonTypeModel"
            value="regular"
            name="lessonType"
          />
          <div class="option-content">
            <span class="option-title">Regular Lesson</span>
            <span class="option-desc">Standard lesson rate</span>
          </div>
        </label>
        <label
          v-if="trialAvailable"
          class="radio-option"
          :class="{ selected: lessonTypeModel === 'trial' }"
        >
          <input
            type="radio"
            v-model="lessonTypeModel"
            value="trial"
            name="lessonType"
          />
          <div class="option-content">
            <span class="option-title">Trial Lesson</span>
            <span class="option-desc">Discounted first lesson</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Notes -->
    <div class="form-group">
      <label for="notes">Notes for Tutor (optional)</label>
      <textarea
        id="notes"
        v-model="notesModel"
        rows="3"
        placeholder="Tell the tutor what you'd like to focus on..."
      />
    </div>
  </div>
</template>

<style scoped>
.booking-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.form-group select,
.form-group textarea {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
  transition: all 0.15s;
}

.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* Lesson Type Options */
.lesson-type-options {
  display: flex;
  gap: 12px;
}

.radio-option {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.radio-option:hover {
  border-color: var(--color-primary, #3b82f6);
}

.radio-option.selected {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}

.radio-option input[type='radio'] {
  margin-top: 2px;
  accent-color: var(--color-primary, #3b82f6);
}

.option-content {
  display: flex;
  flex-direction: column;
}

.option-title {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.option-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

@media (max-width: 640px) {
  .lesson-type-options {
    flex-direction: column;
  }
}
</style>
