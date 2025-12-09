<template>
  <div class="space-y-4">
    <div
      class="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-border-subtle bg-surface-muted/40 text-center transition hover:border-primary focus-within:border-primary"
      :class="{ 'opacity-70 pointer-events-none': disabled }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="sr-only"
        @change="handleFileChange"
      />

      <button
        type="button"
        class="flex h-full w-full flex-col items-center justify-center rounded-full text-sm text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :disabled="disabled"
        @click="openFileDialog"
      >
        <template v-if="previewUrl">
          <img
            :src="previewUrl"
            alt="Avatar preview"
            class="h-full w-full rounded-full object-cover"
          />
          <div class="absolute inset-0 rounded-full bg-black/40 opacity-0 transition hover:opacity-100">
            <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              {{ $t('profile.avatar.change') || 'Змінити' }}
            </span>
          </div>
        </template>
        <template v-else>
          <span class="text-2xl font-semibold text-primary">{{ initials }}</span>
          <span class="mt-1 text-xs">{{ dragActive ? $t('profile.avatar.drop') || 'Відпустіть' : $t('profile.avatar.upload') || 'Завантажити' }}</span>
        </template>
      </button>
    </div>

    <div class="flex items-center justify-center gap-3">
      <Button
        variant="primary"
        size="sm"
        :disabled="disabled"
        @click="openFileDialog"
      >
        {{ $t('profile.avatar.update') || 'Оновити фото' }}
      </Button>

      <Button
        variant="outline"
        size="sm"
        :disabled="disabled || !previewUrl"
        @click="$emit('delete')"
      >
        {{ $t('profile.avatar.remove') || 'Видалити фото' }}
      </Button>
    </div>

    <p class="text-center text-xs text-muted-foreground">
      {{ $t('profile.avatar.hint') || 'Drag & drop або оберіть з пристрою. До 5 МБ, JPG/PNG/WebP.' }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Button from '../../../ui/Button.vue'

const props = defineProps({
  imageUrl: {
    type: String,
    default: '',
  },
  fallbackName: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['upload', 'delete'])

const fileInput = ref(null)
const dragActive = ref(false)

const previewUrl = computed(() => props.imageUrl || '')

const initials = computed(() => {
  if (!props.fallbackName) return '?'
  return props.fallbackName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

function openFileDialog() {
  if (props.disabled) return
  fileInput.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (file) {
    emit('upload', file)
  }
  event.target.value = ''
}

function handleDragOver() {
  if (props.disabled) return
  dragActive.value = true
}

function handleDrop(event) {
  dragActive.value = false
  if (props.disabled) return
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    emit('upload', file)
  }
}
</script>
