<template>
  <Modal :open="isOpen" title="Архівувати користувача" @close="handleClose">
    <p class="text-sm text-muted-foreground mb-4">
      Архівування користувача {{ userEmail }}
    </p>

    <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/40 mb-4">
      <div class="flex gap-3">
        <div class="flex-shrink-0 text-yellow-600 dark:text-yellow-400">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="text-sm text-yellow-800 dark:text-yellow-200">
          <p class="font-semibold">Наслідки архівування:</p>
          <ul class="mt-2 list-inside list-disc space-y-1">
            <li>Користувач втратить доступ до акаунту</li>
            <li>Всі активні заняття будуть скасовані</li>
            <li>Email буде звільнено для повторної реєстрації</li>
            <li>Дані будуть збережені для можливого відновлення</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div>
        <label for="reason" class="block text-sm font-medium text-foreground">
          Причина архівування
          <span class="text-red-500">*</span>
        </label>
        <select
          id="reason"
          v-model="reason"
          :disabled="loading"
          class="input mt-1"
        >
          <option value="admin_action">Дія адміністратора</option>
          <option value="policy_violation">Порушення правил</option>
          <option value="fraud">Шахрайство</option>
          <option value="user_request">Запит користувача</option>
          <option value="other">Інше</option>
        </select>
      </div>

      <Textarea
        v-model="notes"
        label="Додаткові нотатки"
        :disabled="loading"
        :rows="3"
        placeholder="Опишіть причину архівування..."
      />

      <label class="flex items-start gap-2">
        <input
          v-model="confirmed"
          type="checkbox"
          :disabled="loading"
          class="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
        />
        <span class="text-sm text-foreground">
          Я підтверджую, що розумію наслідки архівування цього користувача
        </span>
      </label>
    </div>

    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200 mt-4">
      {{ errorMessage }}
    </div>

    <template #footer>
      <Button
        variant="outline"
        :disabled="loading"
        @click="handleClose"
      >
        Скасувати
      </Button>
      <Button
        variant="danger"
        :disabled="!canArchive"
        :loading="loading"
        @click="handleArchive"
      >
        Архівувати
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import Textarea from '@/ui/Textarea.vue'
import { adminArchiveUser } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'

const props = defineProps<{
  isOpen: boolean
  userId: number
  userEmail: string
}>()

const emit = defineEmits<{
  'close': []
  'archived': []
}>()

const reason = ref('admin_action')
const notes = ref('')
const confirmed = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const canArchive = computed(() => {
  return reason.value && confirmed.value && !loading.value
})

async function handleArchive() {
  if (!canArchive.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await adminArchiveUser(props.userId, reason.value, notes.value || undefined)
    notifySuccess(`Користувача ${props.userEmail} успішно архівовано`)
    emit('archived')
    handleClose()
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message || error?.response?.data?.detail || 'Помилка при архівуванні користувача'
    notifyError(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  if (loading.value) return
  reason.value = 'admin_action'
  notes.value = ''
  confirmed.value = false
  errorMessage.value = ''
  emit('close')
}
</script>
