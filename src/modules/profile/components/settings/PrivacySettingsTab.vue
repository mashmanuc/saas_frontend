<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-foreground">
        {{ $t('users.settings.privacy.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.privacy.description') }}
      </p>
    </div>

    <div class="space-y-4">
      <div class="rounded-lg border border-border p-4">
        <h4 class="font-medium text-foreground">
          {{ $t('users.settings.privacy.dataExport') }}
        </h4>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ $t('users.settings.privacy.dataExportDescription') }}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3"
          :disabled="exporting"
          :loading="exporting"
          @click="handleExport"
        >
          {{ $t('users.settings.privacy.exportButton') }}
        </Button>
      </div>

      <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <h4 class="font-medium text-red-900 dark:text-red-100">
          {{ $t('users.settings.privacy.dangerZone') }}
        </h4>
        <p class="mt-1 text-sm text-red-800 dark:text-red-200">
          {{ $t('users.settings.privacy.dangerZoneDescription') }}
        </p>
        <Button
          variant="destructive"
          size="sm"
          class="mt-3"
          @click="showDeleteModal = true"
        >
          {{ $t('users.settings.privacy.deleteAccount') }}
        </Button>
      </div>
    </div>

    <AccountDeletionModal
      :is-open="showDeleteModal"
      @close="showDeleteModal = false"
      @deleted="handleAccountDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/ui/Button.vue'
import AccountDeletionModal from '../AccountDeletionModal.vue'
import { exportUserData } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const showDeleteModal = ref(false)
const exporting = ref(false)

async function handleExport() {
  exporting.value = true
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
    notifySuccess(i18n.global.t('users.settings.privacy.exportSuccess'))
  } catch (error: any) {
    notifyError(error?.response?.data?.detail || i18n.global.t('users.settings.privacy.exportError'))
  } finally {
    exporting.value = false
  }
}

function handleAccountDeleted() {
  router.push('/auth/login')
}
</script>
