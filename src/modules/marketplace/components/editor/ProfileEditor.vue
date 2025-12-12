<script setup lang="ts">
// TASK MF10: ProfileEditor component
import { ref, watch } from 'vue'
import { Save, Upload } from 'lucide-vue-next'
import type { TutorProfile } from '../../api/marketplace'

interface Props {
  profile: TutorProfile
  saving: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', data: Partial<TutorProfile>): void
}>()

const formData = ref({
  headline: props.profile.headline || '',
  bio: props.profile.bio || '',
  hourly_rate: props.profile.hourly_rate || 0,
  currency: props.profile.currency || 'USD',
  trial_lesson_price: props.profile.trial_lesson_price,
  video_intro_url: props.profile.video_intro_url || '',
  country: props.profile.country || '',
  timezone: props.profile.timezone || '',
})

watch(
  () => props.profile,
  (newProfile) => {
    formData.value = {
      headline: newProfile.headline || '',
      bio: newProfile.bio || '',
      hourly_rate: newProfile.hourly_rate || 0,
      currency: newProfile.currency || 'USD',
      trial_lesson_price: newProfile.trial_lesson_price,
      video_intro_url: newProfile.video_intro_url || '',
      country: newProfile.country || '',
      timezone: newProfile.timezone || '',
    }
  }
)

function handleSubmit() {
  emit('save', { ...formData.value })
}

const currencies = ['USD', 'EUR', 'GBP', 'UAH', 'PLN']
</script>

<template>
  <form class="profile-editor" @submit.prevent="handleSubmit">
    <section class="editor-section">
      <h2>Basic Information</h2>

      <div class="form-group">
        <label for="headline">Headline</label>
        <input
          id="headline"
          v-model="formData.headline"
          type="text"
          placeholder="e.g., Experienced Math Tutor"
          maxlength="100"
        />
        <span class="hint">A short tagline that describes you</span>
      </div>

      <div class="form-group">
        <label for="bio">About Me</label>
        <textarea
          id="bio"
          v-model="formData.bio"
          rows="6"
          placeholder="Tell students about yourself, your teaching style, and experience..."
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="country">Country</label>
          <input
            id="country"
            v-model="formData.country"
            type="text"
            placeholder="e.g., Ukraine"
          />
        </div>

        <div class="form-group">
          <label for="timezone">Timezone</label>
          <input
            id="timezone"
            v-model="formData.timezone"
            type="text"
            placeholder="e.g., Europe/Kyiv"
          />
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>Pricing</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="hourly_rate">Hourly Rate</label>
          <div class="input-with-addon">
            <input
              id="hourly_rate"
              v-model.number="formData.hourly_rate"
              type="number"
              min="0"
              step="1"
            />
            <select v-model="formData.currency">
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="trial_price">Trial Lesson Price</label>
          <input
            id="trial_price"
            v-model.number="formData.trial_lesson_price"
            type="number"
            min="0"
            step="1"
            placeholder="Leave empty for no trial"
          />
          <span class="hint">Optional discounted price for first lesson</span>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>Video Introduction</h2>

      <div class="form-group">
        <label for="video_url">Video URL</label>
        <input
          id="video_url"
          v-model="formData.video_intro_url"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
        />
        <span class="hint">YouTube or Vimeo link to your introduction video</span>
      </div>
    </section>

    <div class="editor-actions">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <Save :size="18" />
        {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.profile-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.editor-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: #111827;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.hint {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.input-with-addon {
  display: flex;
  gap: 0.5rem;
}

.input-with-addon input {
  flex: 1;
}

.input-with-addon select {
  width: auto;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
