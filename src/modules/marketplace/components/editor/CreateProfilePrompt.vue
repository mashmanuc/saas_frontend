<script setup lang="ts">
import { ref } from 'vue'
import { UserPlus, ArrowRight } from 'lucide-vue-next'
import type { TutorProfileUpsertPayload } from '../../api/marketplace'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'create', data: TutorProfileUpsertPayload): void
}>()

const { t } = useI18n()

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

    <h2>{{ t('marketplace.profile.create.title') }}</h2>
    <p>{{ t('marketplace.profile.create.subtitle') }}</p>

    <div class="prompt-form">
      <input
        v-model="headline"
        type="text"
        :placeholder="t('marketplace.profile.create.headlinePlaceholder')"
        maxlength="100"
        @keyup.enter="handleCreate"
      />
      <button
        class="btn btn-primary"
        :disabled="!headline.trim() || isCreating"
        @click="handleCreate"
      >
        {{ isCreating ? t('marketplace.profile.create.creating') : t('marketplace.profile.create.cta') }}
        <ArrowRight :size="18" />
      </button>
    </div>

    <ul class="benefits">
      <li>{{ t('marketplace.profile.create.benefit1') }}</li>
      <li>{{ t('marketplace.profile.create.benefit2') }}</li>
      <li>{{ t('marketplace.profile.create.benefit3') }}</li>
      <li>{{ t('marketplace.profile.create.benefit4') }}</li>
    </ul>
  </div>
</template>

<style scoped>
.create-prompt {
  max-width: 500px;
  margin: 2rem auto;
  text-align: center;
  padding: 3rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
}

.prompt-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-muted);
  color: var(--accent-primary);
  border-radius: 50%;
  margin: 0 auto 1.5rem;
}

h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

p {
  color: var(--text-muted);
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
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 1rem;
  text-align: center;
  background: var(--surface-card);
  color: var(--text-primary);
}

.prompt-form input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-primary) 60%, var(--border-color));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent);
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
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.benefits li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--success-bg);
  font-weight: bold;
}
</style>
