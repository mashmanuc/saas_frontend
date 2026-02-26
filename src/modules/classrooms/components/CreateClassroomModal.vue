<template>
  <Modal :open="modelValue" :title="$t('classroom.create.title')" @close="handleCancel">
    <div class="space-y-4">
      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400" for="classroom-name">
          {{ $t('classroom.create.nameLabel') }}
        </label>
        <input
          id="classroom-name"
          ref="nameInputRef"
          v-model="name"
          type="text"
          :disabled="loading"
          class="block w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
          :placeholder="$t('classroom.create.namePlaceholder')"
          @keydown.enter="handleSubmit"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400" for="classroom-type">
          {{ $t('classroom.create.typeLabel') }}
        </label>
        <select
          id="classroom-type"
          v-model="classroomType"
          :disabled="loading"
          class="block w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="group">{{ $t('classroom.create.types.group') }}</option>
          <option value="microgroup">{{ $t('classroom.create.types.microgroup') }}</option>
          <option value="individual">{{ $t('classroom.create.types.individual') }}</option>
        </select>
      </div>

      <p v-if="errorMessage" class="text-xs text-red-600 mt-1">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" size="sm" :disabled="loading" @click="handleCancel">
        {{ $t('common.cancel') }}
      </Button>
      <Button variant="primary" size="sm" :disabled="loading || !name.trim()" :loading="loading" @click="handleSubmit">
        {{ $t('classroom.create.submit') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Modal from '../../../ui/Modal.vue'
import { useClassroomStore } from '../store/classroomStore'
import { notifySuccess, notifyError } from '../../../utils/notify'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'created'])

const { t } = useI18n()
const store = useClassroomStore()

const name = ref('')
const classroomType = ref('group')
const loading = ref(false)
const errorMessage = ref('')
const nameInputRef = ref(null)

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      name.value = ''
      classroomType.value = 'group'
      errorMessage.value = ''
      nextTick(() => nameInputRef.value?.focus())
    }
  },
)

async function handleSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    errorMessage.value = t('classroom.create.errors.nameRequired')
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const created = await store.createClassroom({
      name: trimmed,
      classroom_type: classroomType.value,
    })
    notifySuccess(t('classroom.create.success'))
    emit('created', created)
    emit('update:modelValue', false)
  } catch (e) {
    const detail = e?.response?.data?.detail
    const code = e?.response?.data?.code

    if (code === 'title_required') {
      errorMessage.value = t('classroom.create.errors.nameRequired')
    } else if (code === 'title_too_long') {
      errorMessage.value = t('classroom.create.errors.nameTooLong')
    } else if (code === 'limit_reached') {
      errorMessage.value = t('classroom.create.errors.limitReached')
    } else {
      errorMessage.value = detail || t('classroom.create.errors.generic')
    }
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  if (loading.value) return
  emit('update:modelValue', false)
}
</script>
