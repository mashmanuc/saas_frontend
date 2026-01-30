<template>
  <OnboardingModal
    :show="show"
    :title="$t('auth.mfa.verify.title')"
    :closable="!loading"
    @close="handleClose"
  >
    <div class="space-y-6">
      <p class="text-sm text-muted-foreground">
        {{ $t('auth.mfa.verify.description') }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <Input
          :label="$t('auth.mfa.verify.otpLabel')"
          v-model="otp"
          :disabled="loading"
          :error="otpError"
          required
          inputmode="numeric"
          autocomplete="one-time-code"
          data-testid="mfa-verify-otp-input"
        />

        <div class="flex flex-wrap gap-2">
          <Button variant="primary" type="submit" :disabled="loading" :loading="loading">
            {{ $t('auth.mfa.verify.submit') }}
          </Button>
          <Button variant="outline" type="button" :disabled="loading" @click="handleClose">
            {{ $t('auth.mfa.verify.cancel') }}
          </Button>
        </div>
      </form>

      <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {{ error }}
      </div>

      <div class="text-sm text-muted-foreground">
        <button
          type="button"
          class="hover:underline"
          style="color: var(--accent);"
          @click="handleUseBackupCode"
        >
          {{ $t('auth.mfa.verify.useBackupCode') }}
        </button>
      </div>
    </div>
  </OnboardingModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OnboardingModal from '@/modules/onboarding/components/widgets/OnboardingModal.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'

const props = defineProps<{
  show: boolean
  sessionId?: string
}>()

const emit = defineEmits<{
  close: []
  success: [credential: any]
  useBackupCode: []
}>()

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const otp = ref('')
const otpError = ref('')

watch(() => props.show, (newVal) => {
  if (!newVal) {
    reset()
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = ''
  otpError.value = ''
  
  try {
    emit('success', { otp: otp.value })
  } catch (err: any) {
    const code = err?.response?.data?.code
    if (code === 'mfa_invalid_code') {
      otpError.value = t('auth.mfa.verify.errors.invalidCode')
    } else {
      error.value = err?.response?.data?.message || t('auth.mfa.verify.errors.verifyFailed')
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleUseBackupCode() {
  emit('useBackupCode')
}

function reset() {
  otp.value = ''
  error.value = ''
  otpError.value = ''
  loading.value = false
}
</script>
