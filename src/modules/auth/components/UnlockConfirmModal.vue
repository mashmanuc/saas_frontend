<template>
  <OnboardingModal
    :show="show"
    :title="$t('auth.unlock.confirm.title')"
    :closable="!loading"
    @close="handleClose"
  >
    <div class="space-y-6">
      <p class="text-sm text-muted-foreground">
        {{ $t('auth.unlock.confirm.description') }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <Input
          :label="$t('auth.unlock.confirm.tokenLabel')"
          v-model="token"
          :disabled="loading"
          :error="tokenError"
          required
          autocomplete="off"
          data-testid="unlock-confirm-token-input"
        />

        <div class="flex flex-wrap gap-2">
          <Button variant="primary" type="submit" :disabled="loading" :loading="loading">
            {{ $t('auth.unlock.confirm.submit') }}
          </Button>
          <Button variant="outline" type="button" :disabled="loading" @click="handleClose">
            {{ $t('auth.unlock.confirm.cancel') }}
          </Button>
        </div>
      </form>

      <div v-if="success" class="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
        {{ $t('auth.unlock.confirm.successMessage') }}
      </div>

      <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {{ error }}
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
import authApi from '@/api/auth'

const props = defineProps<{
  show: boolean
  initialToken?: string
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref(false)
const token = ref('')
const tokenError = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialToken) {
      token.value = props.initialToken
    }
  } else {
    reset()
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = ''
  success.value = false
  tokenError.value = ''
  
  if (!token.value || !token.value.trim()) {
    tokenError.value = t('auth.unlock.confirm.errors.requiredToken')
    loading.value = false
    return
  }
  
  try {
    await authApi.confirmAccountUnlock({ token: token.value })
    success.value = true
    emit('success')
    setTimeout(() => {
      handleClose()
    }, 2000)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 422) {
      tokenError.value = t('auth.unlock.confirm.errors.invalidToken')
    } else {
      error.value = err?.response?.data?.message || t('auth.unlock.confirm.errors.confirmFailed')
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

function reset() {
  token.value = ''
  error.value = ''
  success.value = false
  tokenError.value = ''
  loading.value = false
}
</script>
