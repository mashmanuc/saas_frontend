<template>
  <div class="city-privacy-toggle">
    <Toggle
      v-model="isPublic"
      :label="$t('tutor.city.privacy_label')"
      :description="$t('tutor.city.privacy_description')"
    />
    
    <div
      v-if="isPublic"
      class="notice public"
    >
      <Icon name="info" class="icon" />
      <span>{{ $t('tutor.city.public_warning') }}</span>
    </div>
    
    <div
      v-else
      class="notice private"
    >
      <Icon name="eye-off" class="icon" />
      <span>{{ $t('tutor.city.private_notice') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Toggle from '@/components/ui/Toggle.vue'
import Icon from '@/components/ui/Icon.vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isPublic = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<style scoped lang="scss">
.city-privacy-toggle {
  margin-top: 16px;
}

.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  
  .icon {
    flex-shrink: 0;
  }
  
  &.public {
    background: #e3f2fd;
    color: #1565c0;
  }
  
  &.private {
    background: #f5f5f5;
    color: #666;
  }
}
</style>
