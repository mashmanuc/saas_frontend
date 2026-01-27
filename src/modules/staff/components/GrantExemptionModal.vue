<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="close"
  >
    <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" data-test="grant-exemption-modal">
      <h2 class="mb-4 text-xl font-semibold text-body">
        {{ $t('staff.tutorActivity.grantExemption.title') }}
      </h2>

      <div class="space-y-4">
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

      <div class="mt-6 flex justify-end gap-3">
        <button
          @click="close"
          class="rounded-lg border border-default px-4 py-2 text-body hover:bg-muted"
          :disabled="loading"
          data-test="exemption-cancel-btn"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="submit"
          class="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          :disabled="loading || !form.reason.trim()"
          data-test="exemption-submit-btn"
        >
          <span v-if="loading">{{ $t('staff.tutorActivity.grantExemption.submitting') }}</span>
          <span v-else>{{ $t('staff.tutorActivity.grantExemption.submit') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
