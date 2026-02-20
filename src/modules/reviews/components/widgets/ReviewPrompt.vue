<script setup lang="ts">
// F19: Review Prompt Widget (After Lesson)
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import StarRating from '../forms/StarRating.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  bookingId: number
  tutorId: number
  tutorName: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const router = useRouter()
const quickRating = ref(0)
const isDismissed = ref(false)

const showPrompt = computed(() => !isDismissed.value)

function openFullReview() {
  router.push({
    path: `/reviews/write/${props.tutorId}`,
    query: { booking: props.bookingId.toString(), rating: quickRating.value.toString() },
  })
}

function dismiss() {
  isDismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <Transition name="slide">
    <div v-if="showPrompt" class="review-prompt">
      <Button variant="ghost" size="sm" iconOnly class="dismiss-btn" @click="dismiss">
        <X :size="18" />
      </Button>

      <div class="prompt-content">
        <h4>How was your lesson?</h4>
        <p>Share your experience with {{ tutorName }}</p>

        <StarRating v-model="quickRating" size="lg" />

        <div class="prompt-actions">
          <Button variant="primary" @click="openFullReview">
            Write Review
          </Button>
          <Button variant="ghost" @click="dismiss">
            Later
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.review-prompt {
  position: relative;
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dismiss-btn {
  position: absolute;
  top: 12px;
  right: 12px;
}

.prompt-content {
  text-align: center;
}

.prompt-content h4 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.prompt-content p {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.prompt-content :deep(.star-rating) {
  justify-content: center;
  margin-bottom: 20px;
}

.prompt-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
