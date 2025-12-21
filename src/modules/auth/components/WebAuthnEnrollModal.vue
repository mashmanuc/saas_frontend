<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Shield, AlertCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  onClose?: () => void
  onEnroll?: () => Promise<void>
}>()

const { t } = useI18n()

const isEnrolling = ref(false)
const error = ref('')

async function handleEnroll() {
  if (!props.onEnroll) return
  
  isEnrolling.value = true
  error.value = ''
  
  try {
    await props.onEnroll()
    if (props.onClose) props.onClose()
  } catch (err: any) {
    error.value = err?.message || t('auth.webauthn.enrollError')
  } finally {
    isEnrolling.value = false
  }
}

function handleClose() {
  if (isEnrolling.value) return
  if (props.onClose) props.onClose()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <Shield :size="24" />
          </div>
          <h2>{{ t('auth.webauthn.enrollTitle') }}</h2>
          <span class="beta-badge">{{ t('auth.webauthn.betaLabel') }}</span>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ t('auth.webauthn.enrollDescription') }}
          </p>

          <div class="info-box">
            <AlertCircle :size="18" />
            <p>{{ t('auth.webauthn.enrollInfo') }}</p>
          </div>

          <div v-if="error" class="error-box">
            <AlertCircle :size="18" />
            <p>{{ error }}</p>
          </div>

          <ul class="steps-list">
            <li>{{ t('auth.webauthn.step1') }}</li>
            <li>{{ t('auth.webauthn.step2') }}</li>
            <li>{{ t('auth.webauthn.step3') }}</li>
          </ul>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="isEnrolling"
            @click="handleClose"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="isEnrolling"
            @click="handleEnroll"
          >
            <Loader2 v-if="isEnrolling" :size="16" class="animate-spin" />
            {{ isEnrolling ? t('auth.webauthn.enrolling') : t('auth.webauthn.enrollCta') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 6, 20, 0.78);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background-color: var(--surface-card-solid, var(--surface-card));
  border-radius: var(--radius-lg, 12px);
  box-shadow:
    0 30px 60px rgba(2, 6, 23, 0.55),
    0 8px 16px rgba(0, 0, 0, 0.35);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--border-strong, rgba(148, 163, 184, 0.4));
  color: var(--text-primary);
}

:global(html[data-theme='light']) .modal-overlay,
:global(html[data-theme='classic']) .modal-overlay {
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(8px);
}

:global(html[data-theme='light']) .modal-content,
:global(html[data-theme='classic']) .modal-content {
  background-color: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow:
    0 20px 45px rgba(15, 23, 42, 0.12),
    0 8px 20px rgba(15, 23, 42, 0.07);
  color: var(--text-primary, #111827);
}

:global(html[data-theme='classic']) .modal-content {
  background-color: rgba(249, 247, 255, 0.98);
  border-color: rgba(109, 40, 217, 0.18);
  box-shadow:
    0 24px 50px rgba(109, 40, 217, 0.15),
    0 12px 24px rgba(15, 23, 42, 0.05);
}

:global(html[data-theme='light']) .description,
:global(html[data-theme='classic']) .description,
:global(html[data-theme='light']) .steps-list li,
:global(html[data-theme='classic']) .steps-list li {
  color: rgba(15, 23, 42, 0.82);
  text-shadow: 0 0 1px rgba(255, 255, 255, 0.6);
}

:global(html[data-theme='light']) .info-box {
  background: rgba(14, 165, 233, 0.1);
  color: #0f172a;
  border: 1px solid rgba(14, 165, 233, 0.35);
}

:global(html[data-theme='classic']) .info-box {
  background: rgba(109, 40, 217, 0.12);
  color: #3c165f;
  border: 1px solid rgba(109, 40, 217, 0.3);
}

:global(html[data-theme='light']) .beta-badge,
:global(html[data-theme='classic']) .beta-badge {
  background: rgba(245, 158, 11, 0.15);
  color: #b45309;
}

:global(html[data-theme='light']) .modal-header,
:global(html[data-theme='classic']) .modal-header,
:global(html[data-theme='light']) .modal-footer,
:global(html[data-theme='classic']) .modal-footer {
  border-color: rgba(15, 23, 42, 0.08);
}

:global(html[data-theme='light']) .btn-secondary,
:global(html[data-theme='classic']) .btn-secondary {
  background: rgba(15, 23, 42, 0.04);
  color: rgba(15, 23, 42, 0.85);
}

:global(html[data-theme='light']) .btn-secondary:hover:not(:disabled),
:global(html[data-theme='classic']) .btn-secondary:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.08);
}

:global(html[data-theme='light']) .btn-primary,
:global(html[data-theme='classic']) .btn-primary {
  background: var(--accent, #2563eb);
  color: #fff;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-bg, #e0f2fe);
  color: var(--primary);
  border-radius: var(--radius-md, 8px);
}

.modal-header h2 {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.beta-badge {
  padding: 0.25rem 0.5rem;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border-radius: var(--radius-sm, 4px);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.description {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.info-box,
.error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
}

.info-box {
  background: var(--info-bg, #dbeafe);
  color: var(--info, #3b82f6);
  border: 1px solid var(--info-border, #93c5fd);
}

.error-box {
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border: 1px solid var(--danger-border, #fca5a5);
}

.info-box p,
.error-box p {
  margin: 0;
  flex: 1;
}

.steps-list {
  margin: 0;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.steps-list li {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
