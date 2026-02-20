<template>
  <Modal :open="isOpen" :title="$t('users.account.deleteTitle')" @close="handleClose">
    <template #header>
      <div>
        <h3>{{ $t('users.account.deleteTitle') }}</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ $t('users.account.deleteWarning') }}
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <div class="flex gap-3">
          <div class="flex-shrink-0 text-red-600 dark:text-red-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="text-sm text-red-800 dark:text-red-200">
            <p class="font-semibold">{{ $t('users.account.deleteConsequences') }}</p>
            <ul class="mt-2 list-inside list-disc space-y-1">
              <li>{{ $t('users.account.deleteConsequence1') }}</li>
              <li>{{ $t('users.account.deleteConsequence2') }}</li>
              <li>{{ $t('users.account.deleteConsequence3') }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <Button
          variant="outline"
          class="w-full"
          :disabled="loading"
          @click="handleExport"
        >
          {{ $t('users.account.exportData') }}
        </Button>

        <div>
          <label for="password" class="block text-sm font-medium text-foreground">
            {{ $t('users.account.confirmPassword') }}
            <span class="text-red-500">*</span>
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            :disabled="loading"
            class="input mt-1"
            :placeholder="$t('users.account.enterPassword')"
            @keydown.enter="handleDelete"
          />
        </div>

        <label class="flex items-start gap-2">
          <input
            v-model="confirmed"
            type="checkbox"
            :disabled="loading"
            class="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
          />
          <span class="text-sm text-foreground">
            {{ $t('users.account.deleteConfirmation') }}
          </span>
        </label>
      </div>

      <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
        {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <Button
        variant="outline"
        class="flex-1"
        :disabled="loading"
        @click="handleClose"
      >
        {{ $t('ui.cancel') }}
      </Button>
      <Button
        variant="danger"
        class="flex-1"
        :disabled="!canDelete"
        :loading="loading"
        @click="handleDelete"
      >
        {{ $t('users.account.deleteAccount') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import { archiveAccount, exportUserData } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  'close': []
  'deleted': []
}>()

const password = ref('')
const confirmed = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const canDelete = computed(() => {
  return password.value.length > 0 && confirmed.value && !loading.value
})

async function handleDelete() {
  if (!canDelete.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await archiveAccount(password.value, 'user_request')
    notifySuccess(i18n.global.t('users.account.deleteSuccess'))
    emit('deleted')
    handleClose()
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message || error?.response?.data?.detail || i18n.global.t('users.account.deleteError')
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  loading.value = true
  try {
    const blob = await exportUserData()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `user-data-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    notifySuccess(i18n.global.t('users.account.exportSuccess'))
  } catch (error: any) {
    notifyError(error?.response?.data?.detail || i18n.global.t('users.account.exportError'))
  } finally {
    loading.value = false
  }
}

function handleClose() {
  if (loading.value) return
  password.value = ''
  confirmed.value = false
  errorMessage.value = ''
  emit('close')
}
</script>
