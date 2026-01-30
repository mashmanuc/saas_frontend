<template>
  <div
    v-if="shouldShow"
    class="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/40"
  >
    <div class="flex-shrink-0 text-yellow-600 dark:text-yellow-400">
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div class="flex-1">
      <h3 class="font-semibold text-yellow-900 dark:text-yellow-100">
        {{ $t('users.verification.emailNotVerified') }}
      </h3>
      <p class="mt-1 text-sm text-yellow-800 dark:text-yellow-200">
        {{ $t('users.verification.emailNotVerifiedDescription') }}
      </p>
      <div class="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="loading || cooldown > 0"
          :loading="loading"
          @click="handleResend"
        >
          {{ cooldown > 0 
            ? $t('users.verification.resendIn', { seconds: cooldown }) 
            : $t('users.verification.resendEmail') 
          }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="handleDismiss"
        >
          {{ $t('ui.dismiss') }}
        </Button>
      </div>
    </div>
    <button
      type="button"
      class="flex-shrink-0 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
      @click="handleDismiss"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Button from '@/ui/Button.vue'
import { resendVerificationEmail } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const props = defineProps<{
  emailVerified: boolean
}>()

const emit = defineEmits<{
  'resend': []
  'dismiss': []
}>()

const dismissed = ref(false)
const loading = ref(false)
const cooldown = ref(0)
let cooldownInterval: number | null = null

const shouldShow = computed(() => {
  return !props.emailVerified && !dismissed.value
})

async function handleResend() {
  if (loading.value || cooldown.value > 0) return

  loading.value = true
  try {
    await resendVerificationEmail()
    notifySuccess(i18n.global.t('users.verification.emailSent'))
    emit('resend')
    startCooldown()
  } catch (error: any) {
    notifyError(error?.response?.data?.detail || i18n.global.t('users.verification.emailSendError'))
  } finally {
    loading.value = false
  }
}

function handleDismiss() {
  dismissed.value = true
  emit('dismiss')
  sessionStorage.setItem('email_verification_banner_dismissed', 'true')
}

function startCooldown() {
  cooldown.value = 60
  cooldownInterval = window.setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0 && cooldownInterval) {
      clearInterval(cooldownInterval)
      cooldownInterval = null
    }
  }, 1000)
}

onMounted(() => {
  const wasDismissed = sessionStorage.getItem('email_verification_banner_dismissed')
  if (wasDismissed === 'true') {
    dismissed.value = true
  }
})

onUnmounted(() => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
  }
})
</script>
