<template>
  <Modal
    :open="isOpen"
    :title="$t('staff.tutorActivity.grantExemption.title')"
    size="sm"
    @close="close"
  >
    <div class="space-y-4" data-test="grant-exemption-modal">
      <div class="rounded-lg bg-muted p-3">
        <p class="text-sm text-muted">{{ $t('staff.tutorActivity.grantExemption.tutorEmail') }}</p>
        <p class="font-medium text-body">{{ tutor?.email }}</p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-body">
          {{ $t('staff.tutorActivity.grantExemption.until') }}
        </label>
        <input
          v-model="form.until"
          type="datetime-local"
          class="w-full rounded-lg border border-default bg-surface px-3 py-2 text-body focus:border-primary focus:outline-none"
          data-test="exemption-until-input"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-body">
          {{ $t('staff.tutorActivity.grantExemption.reason') }}
        </label>
        <textarea
          v-model="form.reason"
          rows="3"
          class="w-full rounded-lg border border-default bg-surface px-3 py-2 text-body focus:border-primary focus:outline-none"
          :placeholder="$t('staff.tutorActivity.grantExemption.reasonPlaceholder')"
          data-test="exemption-reason-input"
        ></textarea>
      </div>

      <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-600" data-test="exemption-error">
        {{ error }}
      </div>
    </div>

    <template #footer>
      <Button
        variant="secondary"
        :disabled="loading"
        data-test="exemption-cancel-btn"
        @click="close"
      >
        {{ $t('common.cancel') }}
      </Button>
      <Button
        variant="primary"
        :disabled="!form.reason.trim()"
        :loading="loading"
        data-test="exemption-submit-btn"
        @click="submit"
      >
        {{ $t('staff.tutorActivity.grantExemption.submit') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import staffApi from '../api/staffApi'
import type { TutorActivityListItem } from '../api/staffApi'

const props = defineProps<{
  isOpen: boolean
  tutor: TutorActivityListItem | null
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()

const form = ref({
  until: getDefaultUntil(),
  reason: '',
})

const loading = ref(false)
const error = ref('')

function getDefaultUntil(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0')
  const day = String(nextMonth.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00`
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    form.value = {
      until: getDefaultUntil(),
      reason: '',
    }
    error.value = ''
  }
})

function close() {
  emit('close')
}

async function submit() {
  if (!props.tutor) return
  if (!form.value.reason.trim()) return

  loading.value = true
  error.value = ''

  try {
    // Convert datetime-local to ISO string
    const untilDate = new Date(form.value.until)
    const untilISO = untilDate.toISOString()
    
    await staffApi.grantExemption(props.tutor.tutor_id, {
      until: untilISO,
      reason: form.value.reason.trim(),
    })
    
    emit('success')
    close()
  } catch (err: any) {
    if (err.response?.status === 401) {
      error.value = t('staff.tutorActivity.errors.unauthorized')
    } else if (err.response?.status === 403) {
      error.value = t('staff.tutorActivity.errors.forbidden')
    } else if (err.response?.status === 404) {
      error.value = t('staff.tutorActivity.errors.tutorNotFound')
    } else if (err.response?.status === 429) {
      error.value = t('staff.tutorActivity.errors.tooManyRequests')
    } else {
      error.value = t('staff.tutorActivity.errors.generic')
    }
  } finally {
    loading.value = false
  }
}
</script>
