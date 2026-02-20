<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Shield, AlertCircle, Loader2 } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

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
  <Modal
    :open="show"
    size="sm"
    @close="handleClose"
  >
    <template #header>
      <div class="header-row">
        <div class="header-icon">
          <Shield :size="24" />
        </div>
        <h3 class="modal-title">{{ t('auth.webauthn.enrollTitle') }}</h3>
        <span class="beta-badge">{{ t('auth.webauthn.betaLabel') }}</span>
      </div>
    </template>

    <div class="space-y-4">
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

    <template #footer>
      <Button variant="secondary" :disabled="isEnrolling" @click="handleClose">
        {{ t('common.cancel') }}
      </Button>
      <Button variant="primary" :disabled="isEnrolling" :loading="isEnrolling" @click="handleEnroll">
        {{ isEnrolling ? t('auth.webauthn.enrolling') : t('auth.webauthn.enrollCta') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 1;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: var(--radius-md);
}

.modal-title {
  flex: 1;
  font-size: var(--text-xl);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.beta-badge {
  padding: var(--space-2xs) var(--space-xs);
  background: color-mix(in srgb, var(--warning-bg) 20%, transparent);
  color: var(--warning-bg);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.info-box,
.error-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.info-box {
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
  border: 1px solid color-mix(in srgb, var(--info-bg) 30%, transparent);
}

.error-box {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
}

.info-box p,
.error-box p {
  margin: 0;
  flex: 1;
}

.steps-list {
  margin: 0;
  padding-left: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.steps-list li {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
