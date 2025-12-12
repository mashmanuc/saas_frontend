<script setup lang="ts">
// F18: Preferences Step Component
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, BookOpen, Clock, Bell } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'

defineProps<{
  step: OnboardingStep | null
}>()

defineEmits<{
  complete: []
  skip: []
}>()

const { t } = useI18n()

const selectedSubjects = ref<string[]>([])
const preferredSchedule = ref('')
const notificationsEnabled = ref(true)

const subjects = [
  { id: 'math', label: 'Mathematics' },
  { id: 'english', label: 'English' },
  { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'biology', label: 'Biology' },
  { id: 'history', label: 'History' },
]

const scheduleOptions = [
  { value: 'morning', label: 'Morning (8:00 - 12:00)' },
  { value: 'afternoon', label: 'Afternoon (12:00 - 17:00)' },
  { value: 'evening', label: 'Evening (17:00 - 21:00)' },
  { value: 'flexible', label: 'Flexible' },
]

function toggleSubject(id: string) {
  const idx = selectedSubjects.value.indexOf(id)
  if (idx >= 0) {
    selectedSubjects.value.splice(idx, 1)
  } else {
    selectedSubjects.value.push(id)
  }
}
</script>

<template>
  <div class="preferences-step">
    <div class="step-header">
      <Settings :size="32" class="header-icon" />
      <h2>{{ t('onboarding.preferences.title') }}</h2>
      <p>{{ t('onboarding.preferences.description') }}</p>
    </div>

    <div class="preferences-form">
      <!-- Subjects -->
      <div class="form-section">
        <label class="section-label">
          <BookOpen :size="18" />
          {{ t('onboarding.preferences.subjects') }}
        </label>
        <div class="subjects-grid">
          <button
            v-for="subject in subjects"
            :key="subject.id"
            :class="['subject-chip', { selected: selectedSubjects.includes(subject.id) }]"
            @click="toggleSubject(subject.id)"
          >
            {{ subject.label }}
          </button>
        </div>
      </div>

      <!-- Schedule -->
      <div class="form-section">
        <label class="section-label">
          <Clock :size="18" />
          {{ t('onboarding.preferences.schedule') }}
        </label>
        <div class="schedule-options">
          <label
            v-for="option in scheduleOptions"
            :key="option.value"
            class="schedule-option"
          >
            <input
              type="radio"
              v-model="preferredSchedule"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- Notifications -->
      <div class="form-section">
        <label class="notification-toggle">
          <Bell :size="18" />
          <span>{{ t('onboarding.preferences.notifications') }}</span>
          <input type="checkbox" v-model="notificationsEnabled" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preferences-step {
  max-width: 500px;
  margin: 0 auto;
  padding: 40px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.step-header {
  text-align: center;
  margin-bottom: 32px;
}

.header-icon {
  color: var(--color-primary, #3b82f6);
  margin-bottom: 16px;
}

.step-header h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
}

.step-header p {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

.preferences-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.section-label svg {
  color: var(--color-text-secondary, #6b7280);
}

/* Subjects Grid */
.subjects-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subject-chip {
  padding: 8px 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 2px solid transparent;
  border-radius: 20px;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.subject-chip:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.subject-chip.selected {
  background: var(--color-primary-light, #eff6ff);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

/* Schedule Options */
.schedule-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.schedule-option:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.schedule-option input {
  accent-color: var(--color-primary, #3b82f6);
}

/* Notification Toggle */
.notification-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  cursor: pointer;
}

.notification-toggle span {
  flex: 1;
  font-size: 14px;
}

.notification-toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--color-primary, #3b82f6);
}
</style>
