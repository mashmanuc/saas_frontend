<script setup lang="ts">
// F14: Detailed Rating Component (Multi-criteria)
import StarRating from './StarRating.vue'

interface DetailedRatings {
  communication: number
  knowledge: number
  punctuality: number
}

const props = defineProps<{
  modelValue: DetailedRatings
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DetailedRatings]
}>()

function updateRating(key: keyof DetailedRatings, value: number) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  })
}
</script>

<template>
  <div class="detailed-rating">
    <div class="rating-item">
      <label>Communication</label>
      <StarRating
        :model-value="modelValue.communication"
        size="sm"
        @update:model-value="(v) => updateRating('communication', v)"
      />
    </div>

    <div class="rating-item">
      <label>Knowledge</label>
      <StarRating
        :model-value="modelValue.knowledge"
        size="sm"
        @update:model-value="(v) => updateRating('knowledge', v)"
      />
    </div>

    <div class="rating-item">
      <label>Punctuality</label>
      <StarRating
        :model-value="modelValue.punctuality"
        size="sm"
        @update:model-value="(v) => updateRating('punctuality', v)"
      />
    </div>
  </div>
</template>

<style scoped>
.detailed-rating {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-top: 8px;
}

.rating-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rating-item label {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
