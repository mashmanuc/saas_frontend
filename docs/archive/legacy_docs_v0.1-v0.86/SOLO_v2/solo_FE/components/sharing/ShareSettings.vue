<template>
  <div class="share-settings">
    <!-- Expiration -->
    <div class="share-settings__option">
      <label>{{ $t('solo.sharing.expiresIn') }}</label>
      <select v-model="localSettings.expires_in_days">
        <option :value="1">1 {{ $t('solo.sharing.day') }}</option>
        <option :value="7">7 {{ $t('solo.sharing.days') }}</option>
        <option :value="30">30 {{ $t('solo.sharing.days') }}</option>
        <option :value="null">{{ $t('solo.sharing.never') }}</option>
      </select>
    </div>

    <!-- Max views -->
    <div class="share-settings__option">
      <label>{{ $t('solo.sharing.maxViews') }}</label>
      <input
        type="number"
        v-model.number="localSettings.max_views"
        min="0"
        :placeholder="$t('solo.sharing.unlimited')"
      />
    </div>

    <!-- Allow download -->
    <div class="share-settings__option share-settings__option--checkbox">
      <label class="checkbox-label">
        <input type="checkbox" v-model="localSettings.allow_download" />
        <span>{{ $t('solo.sharing.allowDownload') }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

interface ShareSettings {
  expires_in_days: number | null
  max_views: number | null
  allow_download: boolean
}

const props = defineProps<{
  modelValue: ShareSettings
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ShareSettings): void
}>()

const localSettings = reactive<ShareSettings>({
  expires_in_days: props.modelValue.expires_in_days,
  max_views: props.modelValue.max_views,
  allow_download: props.modelValue.allow_download,
})

watch(
  localSettings,
  (newVal) => {
    emit('update:modelValue', { ...newVal })
  },
  { deep: true }
)

watch(
  () => props.modelValue,
  (newVal) => {
    localSettings.expires_in_days = newVal.expires_in_days
    localSettings.max_views = newVal.max_views
    localSettings.allow_download = newVal.allow_download
  },
  { deep: true }
)
</script>

<style scoped>
.share-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.share-settings__option {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.share-settings__option label {
  font-weight: 500;
  font-size: 0.875rem;
}

.share-settings__option select,
.share-settings__option input[type='number'] {
  padding: 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
}

.share-settings__option--checkbox {
  flex-direction: row;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: 1rem;
  height: 1rem;
}
</style>
