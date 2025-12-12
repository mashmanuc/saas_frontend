<script setup lang="ts">
import { ref } from 'vue'
import { UserPlus, ArrowRight } from 'lucide-vue-next'
import type { TutorProfile } from '../../api/marketplace'

const emit = defineEmits<{
  (e: 'create', data: Partial<TutorProfile>): void
}>()

const headline = ref('')
const isCreating = ref(false)

async function handleCreate() {
  if (!headline.value.trim()) return

  isCreating.value = true
  emit('create', {
    headline: headline.value.trim(),
  })
}
</script>

<template>
  <div class="create-prompt">
    <div class="prompt-icon">
      <UserPlus :size="48" />
    </div>

    <h2>Create Your Tutor Profile</h2>
    <p>Start sharing your expertise with students around the world.</p>

    <div class="prompt-form">
      <input
        v-model="headline"
        type="text"
        placeholder="Enter a headline, e.g., 'Experienced Math Tutor'"
        maxlength="100"
        @keyup.enter="handleCreate"
      />
      <button
        class="btn btn-primary"
        :disabled="!headline.trim() || isCreating"
        @click="handleCreate"
      >
        {{ isCreating ? 'Creating...' : 'Get Started' }}
        <ArrowRight :size="18" />
      </button>
    </div>

    <ul class="benefits">
      <li>Reach thousands of students</li>
      <li>Set your own schedule and rates</li>
      <li>Build your reputation with reviews</li>
      <li>Get paid securely</li>
    </ul>
  </div>
</template>

<style scoped>
.create-prompt {
  max-width: 500px;
  margin: 2rem auto;
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.prompt-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 50%;
  margin: 0 auto 1.5rem;
}

h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: #111827;
}

p {
  color: #6b7280;
  margin: 0 0 2rem;
}

.prompt-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.prompt-form input {
  padding: 0.875rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
}

.prompt-form input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
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

.benefits {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
}

.benefits li {
  padding: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
  color: #374151;
  font-size: 0.9375rem;
}

.benefits li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #22c55e;
  font-weight: bold;
}
</style>
