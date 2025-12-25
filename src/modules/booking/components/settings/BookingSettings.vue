<script setup lang="ts">
// F22: Booking Settings Component
import { ref, watch } from 'vue'
import { Save, Clock, Bell, Shield } from 'lucide-vue-next'
import { bookingApi } from '../../api/booking'
import type { TutorSettings } from '../../api/booking'

const props = defineProps<{
  settings: TutorSettings | null
}>()

// Local state for editing
const localSettings = ref<Partial<TutorSettings>>({})
const isSaving = ref(false)
const hasChanges = ref(false)

// Initialize from props
watch(
  () => props.settings,
  (newSettings) => {
    if (newSettings) {
      localSettings.value = { ...newSettings }
      hasChanges.value = false
    }
  },
  { immediate: true }
)

function markChanged() {
  hasChanges.value = true
}

async function saveSettings() {
  isSaving.value = true

  try {
    await bookingApi.updateSettings(localSettings.value)
    hasChanges.value = false
  } catch (e) {
    console.error('Failed to save settings:', e)
  } finally {
    isSaving.value = false
  }
}

// Timezone options (simplified list)
const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Kiev',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const durationOptions = [30, 45, 60, 90, 120]
const bufferOptions = [0, 5, 10, 15, 30]
const noticeOptions = [1, 2, 4, 12, 24, 48]
const advanceOptions = [7, 14, 30, 60, 90]

const cancellationPolicies = [
  { value: 'flexible', label: 'Flexible - Free cancellation up to 24h before' },
  { value: 'moderate', label: 'Moderate - Free cancellation up to 48h before' },
  { value: 'strict', label: 'Strict - 50% refund up to 7 days before' },
]
</script>

<template>
  <div class="booking-settings">
    <div v-if="!settings" class="loading">
      <div class="spinner" />
    </div>

    <template v-else>
      <!-- Timezone -->
      <section class="settings-section">
        <h4>
          <Clock :size="18" />
          Time Settings
        </h4>

        <div class="form-group">
          <label>Timezone</label>
          <select v-model="localSettings.timezone" @change="markChanged">
            <option v-for="tz in timezones" :key="tz" :value="tz">
              {{ tz }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Default Lesson Duration</label>
          <select v-model.number="localSettings.default_lesson_duration" @change="markChanged">
            <option v-for="d in durationOptions" :key="d" :value="d">
              {{ d }} minutes
            </option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Buffer Before</label>
            <select v-model.number="localSettings.buffer_before" @change="markChanged">
              <option v-for="b in bufferOptions" :key="b" :value="b">
                {{ b }} min
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Buffer After</label>
            <select v-model.number="localSettings.buffer_after" @change="markChanged">
              <option v-for="b in bufferOptions" :key="b" :value="b">
                {{ b }} min
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- Booking Rules -->
      <section class="settings-section">
        <h4>
          <Shield :size="18" />
          Booking Rules
        </h4>

        <div class="form-group">
          <label>Minimum Booking Notice</label>
          <select v-model.number="localSettings.min_booking_notice" @change="markChanged">
            <option v-for="n in noticeOptions" :key="n" :value="n">
              {{ n }} hour{{ n > 1 ? 's' : '' }}
            </option>
          </select>
          <span class="hint">How far in advance students must book</span>
        </div>

        <div class="form-group">
          <label>Maximum Booking Advance</label>
          <select v-model.number="localSettings.max_booking_advance" @change="markChanged">
            <option v-for="a in advanceOptions" :key="a" :value="a">
              {{ a }} days
            </option>
          </select>
          <span class="hint">How far ahead students can book</span>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="localSettings.auto_accept"
              @change="markChanged"
            />
            Auto-accept bookings
          </label>
          <span class="hint">Automatically confirm new bookings</span>
        </div>

        <div class="form-group">
          <label>Cancellation Policy</label>
          <select v-model="localSettings.cancellation_policy" @change="markChanged">
            <option
              v-for="policy in cancellationPolicies"
              :key="policy.value"
              :value="policy.value"
            >
              {{ policy.label }}
            </option>
          </select>
        </div>
      </section>

      <!-- Notifications -->
      <section class="settings-section">
        <h4>
          <Bell :size="18" />
          Notifications
        </h4>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="localSettings.email_notifications"
              @change="markChanged"
            />
            Email notifications
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="localSettings.push_notifications"
              @change="markChanged"
            />
            Push notifications
          </label>
        </div>
      </section>

      <!-- Save Button -->
      <div v-if="hasChanges" class="save-section">
        <button
          class="btn btn-primary"
          :disabled="isSaving"
          @click="saveSettings"
        >
          <Save :size="16" />
          {{ isSaving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.booking-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-section {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.settings-section:last-of-type {
  border-bottom: none;
}

.settings-section h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.form-group select,
.form-group input[type='text'] {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary, #3b82f6);
}

.hint {
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

.save-section {
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
