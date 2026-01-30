<template>
  <div class="space-y-4">
    <div
      class="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed transition"
      :class="dragActive 
        ? 'border-primary bg-primary/10' 
        : 'border-border-subtle bg-surface-muted/40 hover:border-primary'"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="sr-only"
        :disabled="disabled || uploading"
        @change="handleFileChange"
      />

      <button
        type="button"
        class="flex h-full w-full flex-col items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :disabled="disabled || uploading"
        @click="openFileDialog"
      >
        <template v-if="uploading">
          <div class="flex flex-col items-center gap-2">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span class="text-xs text-muted-foreground">{{ uploadProgress }}%</span>
          </div>
        </template>
        <template v-else-if="previewUrl">
          <img
            :src="previewUrl"
            alt="Avatar"
            class="h-full w-full rounded-full object-cover"
          />
          <div class="absolute inset-0 rounded-full bg-black/40 opacity-0 transition hover:opacity-100">
            <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              {{ $t('users.avatar.change') }}
            </span>
          </div>
        </template>
        <template v-else>
          <span class="text-2xl font-semibold text-primary">{{ initials }}</span>
          <span class="mt-1 text-xs text-muted-foreground">
            {{ dragActive ? $t('users.avatar.drop') : $t('users.avatar.upload') }}
          </span>
        </template>
      </button>
    </div>

    <div class="flex items-center justify-center gap-3">
      <Button
        variant="primary"
        size="sm"
        :disabled="disabled || uploading"
        @click="openFileDialog"
      >
        {{ $t('users.avatar.update') }}
      </Button>

      <Button
        variant="outline"
        size="sm"
        :disabled="disabled || uploading || !previewUrl"
        @click="handleDelete"
      >
        {{ $t('users.avatar.remove') }}
      </Button>
    </div>

    <div class="space-y-1 text-center text-xs text-muted-foreground">
      <p>{{ $t('users.avatar.hint') }}</p>
      <p>{{ $t('users.avatar.formats') }}: JPG, PNG, WebP</p>
      <p>{{ $t('users.avatar.maxSize') }}: 5MB</p>
    </div>

    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from '@/ui/Button.vue'
import { notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const props = defineProps<{
  imageUrl?: string
  fallbackName?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'upload': [file: File]
  'delete': []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')

const previewUrl = computed(() => props.imageUrl || '')

const initials = computed(() => {
  if (!props.fallbackName) return '?'
  return props.fallbackName
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

function openFileDialog() {
  if (props.disabled || uploading.value) return
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    validateAndUpload(file)
  }
  target.value = ''
}

function handleDragOver() {
  if (props.disabled || uploading.value) return
  dragActive.value = true
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (props.disabled || uploading.value) return
  
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    validateAndUpload(file)
  }
}

function validateAndUpload(file: File) {
  errorMessage.value = ''

  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    errorMessage.value = i18n.global.t('users.avatar.invalidFormat')
    notifyError(errorMessage.value)
    return
  }

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    errorMessage.value = i18n.global.t('users.avatar.tooLarge')
    notifyError(errorMessage.value)
    return
  }

  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  
  img.onload = () => {
    URL.revokeObjectURL(objectUrl)
    
    if (img.width < 200 || img.height < 200) {
      errorMessage.value = i18n.global.t('users.avatar.tooSmall')
      notifyError(errorMessage.value)
      return
    }
    
    if (img.width > 2000 || img.height > 2000) {
      errorMessage.value = i18n.global.t('users.avatar.tooBig')
      notifyError(errorMessage.value)
      return
    }

    uploading.value = true
    uploadProgress.value = 0
    
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 100)

    setTimeout(() => {
      clearInterval(progressInterval)
      uploadProgress.value = 100
      uploading.value = false
      emit('upload', file)
    }, 1000)
  }

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    errorMessage.value = i18n.global.t('users.avatar.invalidImage')
    notifyError(errorMessage.value)
  }

  img.src = objectUrl
}

function handleDelete() {
  if (props.disabled || uploading.value) return
  emit('delete')
}
</script>
