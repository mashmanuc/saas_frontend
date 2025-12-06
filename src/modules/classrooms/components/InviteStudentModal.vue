<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-md rounded-lg bg-surface shadow-lg border border-border-subtle">
      <header class="border-b border-border-subtle px-4 py-3">
        <h2 class="text-base font-semibold text-foreground">
          {{ $t('classroom.invite.title') }}
        </h2>
      </header>

      <div class="px-4 py-3 space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ $t('classroom.invite.description') }}
        </p>

        <div class="space-y-1">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400" for="invite-email">
            {{ $t('classroom.invite.emailLabel') }}
          </label>
          <input
            id="invite-email"
            v-model="email"
            type="email"
            :disabled="loading"
            class="block w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
            :placeholder="$t('classroom.invite.emailPlaceholder')"
          />
          <p v-if="validationError" class="text-xs text-red-600 mt-1">
            {{ validationError }}
          </p>
        </div>
      </div>

      <footer class="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-surface-muted/60"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ $t('common.cancel') || 'Скасувати' }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="loading"
          @click="handleSubmit"
        >
          <span v-if="loading">{{ $t('loader.loading') }}</span>
          <span v-else>{{ $t('classroom.invite.submit') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { notifySuccess, notifyError } from '../../../utils/notify'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const open = ref(props.modelValue)
const email = ref('')
const loading = ref(false)
const validationError = ref('')

watch(
  () => props.modelValue,
  (value) => {
    open.value = value
    if (value) {
      email.value = ''
      validationError.value = ''
    }
  },
)

watch(open, (value) => {
  emit('update:modelValue', value)
})

function validateEmail(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return t('classroom.invite.errors.required')
  }

  // Простий regex + заборона пробілів
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return t('classroom.invite.errors.invalid')
  }

  return ''
}

function fakeApiDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handleSubmit() {
  validationError.value = validateEmail(email.value)
  if (validationError.value) return

  loading.value = true

  try {
    await fakeApiDelay(1200)
    // Тут пізніше буде реальний бекенд-запит
    notifySuccess(t('classroom.invite.success'))
    open.value = false
  } catch (e) {
    notifyError(t('classroom.invite.errors.generic'))
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  if (loading.value) return
  open.value = false
}
</script>
