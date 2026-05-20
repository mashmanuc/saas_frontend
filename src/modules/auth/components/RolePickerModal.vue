<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="role-picker-overlay"
      @click.self="onCancel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div class="role-picker-card">
        <header class="role-picker-header">
          <h2 :id="titleId" class="role-picker-title">
            {{ $t('auth.oauth.rolePicker.title') }}
          </h2>
          <p v-if="claimsPreview?.email" class="role-picker-subtitle">
            {{ $t('auth.oauth.rolePicker.subtitle', { email: claimsPreview.email }) }}
          </p>
        </header>

        <div class="role-picker-options">
          <button
            type="button"
            class="role-picker-option"
            :disabled="loading"
            @click="onPick('student')"
            data-testid="role-picker-student"
          >
            <div class="role-picker-option-icon">🎓</div>
            <div class="role-picker-option-body">
              <div class="role-picker-option-title">
                {{ $t('auth.oauth.rolePicker.student') }}
              </div>
              <div class="role-picker-option-hint">
                {{ $t('auth.oauth.rolePicker.studentHint') }}
              </div>
            </div>
          </button>

          <button
            type="button"
            class="role-picker-option"
            :disabled="loading"
            @click="onPick('tutor')"
            data-testid="role-picker-tutor"
          >
            <div class="role-picker-option-icon">📚</div>
            <div class="role-picker-option-body">
              <div class="role-picker-option-title">
                {{ $t('auth.oauth.rolePicker.tutor') }}
              </div>
              <div class="role-picker-option-hint">
                {{ $t('auth.oauth.rolePicker.tutorHint') }}
              </div>
            </div>
          </button>
        </div>

        <p
          v-if="errorMessage"
          class="role-picker-error"
          data-testid="role-picker-error"
        >
          {{ errorMessage }}
        </p>

        <footer class="role-picker-footer">
          <button
            type="button"
            class="role-picker-cancel"
            :disabled="loading"
            @click="onCancel"
          >
            {{ $t('common.cancel') || 'Скасувати' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  registrationToken: { type: String, default: '' },
  claimsPreview: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'success', 'cancel'])

const { t } = useI18n()

const loading = ref(false)
const errorMessage = ref('')
const titleId = computed(() => `role-picker-title-${Math.random().toString(36).slice(2, 8)}`)

async function onPick(role) {
  if (loading.value) return
  if (!props.registrationToken) {
    errorMessage.value = t('auth.oauth.error.invalidToken')
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    // Завантажуємо authStore лазі, щоб модал не тягнув store-зв'язків при import
    const { useAuthStore } = await import('../store/authStore')
    const auth = useAuthStore()
    const result = await auth.completeGoogleRegistration(props.registrationToken, role)
    emit('success', result)
    emit('update:modelValue', false)
  } catch (err) {
    const code = err?.response?.data?.error || err?.code || ''
    const status = err?.response?.status
    let key = 'auth.oauth.error.unknown'
    switch (code) {
      case 'invalid_registration_token':
        key = 'auth.oauth.error.invalidToken'
        break
      case 'account_deactivated':
        key = 'auth.oauth.error.deactivated'
        break
      case 'account_exists_unverified':
        key = 'auth.oauth.error.emailUnverified'
        break
      case 'cross_provider_merge_forbidden':
        key = 'auth.oauth.error.crossProvider'
        break
      default:
        if (status === 429) key = 'auth.oauth.error.throttled'
        else if (status === 503) key = 'auth.oauth.error.googleUnavailable'
    }
    errorMessage.value = t(key)
  } finally {
    loading.value = false
  }
}

function onCancel() {
  if (loading.value) return
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.role-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}
.role-picker-card {
  background: var(--surface, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.role-picker-header { display: flex; flex-direction: column; gap: 4px; }
.role-picker-title { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0; }
.role-picker-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }
.role-picker-options { display: flex; flex-direction: column; gap: 12px; }
.role-picker-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  background: var(--surface, #fff);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.role-picker-option:hover:not(:disabled) {
  border-color: var(--accent, #10b981);
  background: rgba(16, 185, 129, 0.05);
}
.role-picker-option:disabled { opacity: 0.6; cursor: not-allowed; }
.role-picker-option-icon { font-size: 1.5rem; line-height: 1; }
.role-picker-option-body { flex: 1; }
.role-picker-option-title { font-weight: 600; color: var(--text-primary); }
.role-picker-option-hint { font-size: 0.875rem; color: var(--text-secondary); margin-top: 2px; }
.role-picker-error { color: var(--danger, #d92d20); font-size: 0.875rem; margin: 0; }
.role-picker-footer { display: flex; justify-content: flex-end; }
.role-picker-cancel {
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 8px 12px;
}
.role-picker-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
