<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
        @click="handleClose"
      ></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Send Contact Request
              </h3>
              <div class="mt-4">
                <p class="text-sm text-gray-500 mb-4">
                  Send a request to {{ tutorName }} to establish contact.
                </p>

                <div>
                  <label for="message" class="block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <textarea
                    id="message"
                    v-model="message"
                    rows="4"
                    class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Introduce yourself and explain why you'd like to connect..."
                    :disabled="isSubmitting"
                  ></textarea>
                  <p class="mt-1 text-xs text-gray-500">Minimum 1 character</p>
                  <p v-if="validationError" class="mt-1 text-xs text-red-600">
                    {{ validationError }}
                  </p>
                </div>

                <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p class="text-sm text-red-800">{{ error }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            :disabled="isSubmitting || !isValid"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleSubmit"
          >
            {{ isSubmitting ? 'Sending...' : 'Send Request' }}
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            @click="handleClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'

const props = defineProps<{
  isOpen: boolean
  tutorId: string
  tutorName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const inquiriesStore = useInquiriesStore()

const message = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const validationError = ref<string | null>(null)

const isValid = computed(() => {
  return message.value.trim().length >= 1
})

function validateMessage() {
  if (message.value.trim().length < 1) {
    validationError.value = 'Message must be at least 1 character'
    return false
  }
  validationError.value = null
  return true
}

async function handleSubmit() {
  if (!validateMessage()) {
    return
  }

  isSubmitting.value = true
  error.value = null

  try {
    await inquiriesStore.createInquiry(props.tutorId, message.value.trim())
    emit('success')
    handleClose()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send request'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    message.value = ''
    error.value = null
    validationError.value = null
    emit('close')
  }
}
</script>
