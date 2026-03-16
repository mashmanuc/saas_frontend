<!-- Knowledge: Lesson rating widget — interactive stars + comment
     Ref: Phase 15 B1.1 -->
<template>
  <div class="lesson-rating-widget" role="form" :aria-label="$t('knowledge.rating.title')">
    <!-- Existing rating display (readonly) -->
    <div v-if="existingRating" class="existing-rating">
      <div class="flex items-center gap-2">
        <div class="flex" role="img" :aria-label="$t('knowledge.rating.yourRating', { score: existingRating.score })">
          <Star v-for="i in 5" :key="i" :size="20"
            :class="i <= existingRating.score ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'" />
        </div>
        <span class="text-sm text-gray-500">{{ $t('knowledge.rating.alreadyRated') }}</span>
      </div>
      <p v-if="existingRating.comment" class="mt-1 text-sm text-gray-600">{{ existingRating.comment }}</p>
    </div>

    <!-- Interactive rating (if not rated yet, authenticated) -->
    <div v-else-if="isAuthenticated" class="interactive-rating">
      <p class="text-sm font-medium text-gray-700 mb-2">{{ $t('knowledge.rating.title') }}</p>

      <!-- Star selector -->
      <div class="flex gap-1" role="radiogroup" :aria-label="$t('knowledge.rating.selectScore')">
        <button
          v-for="i in 5" :key="i"
          type="button"
          role="radio"
          :aria-checked="selectedScore === i"
          :aria-label="$t('knowledge.rating.star', { n: i })"
          class="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          @click="selectedScore = i"
          @keydown.left.prevent="selectedScore = Math.max(1, (selectedScore || 1) - 1)"
          @keydown.right.prevent="selectedScore = Math.min(5, (selectedScore || 0) + 1)"
        >
          <Star :size="24" :class="i <= (hoverScore || selectedScore || 0)
            ? 'text-yellow-400 fill-yellow-400 cursor-pointer'
            : 'text-gray-300 cursor-pointer hover:text-yellow-200'"
            @mouseenter="hoverScore = i" @mouseleave="hoverScore = 0" />
        </button>
      </div>

      <!-- Comment textarea (appears after score selected) -->
      <Transition name="slide-down">
        <div v-if="selectedScore" class="mt-3">
          <textarea
            v-model="comment"
            :placeholder="$t('knowledge.rating.placeholder')"
            :maxlength="500"
            rows="2"
            class="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-gray-400">{{ comment.length }}/500</span>
            <button
              :disabled="isSubmitting || !selectedScore"
              class="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              @click="submitRating"
            >
              {{ isSubmitting ? $t('knowledge.rating.submitting') : $t('knowledge.rating.submit') }}
            </button>
          </div>
          <p v-if="error" role="alert" class="mt-1 text-xs text-red-500">{{ error }}</p>
        </div>
      </Transition>
    </div>

    <!-- Not authenticated hint -->
    <div v-else class="text-sm text-gray-500">
      <router-link to="/auth/login" class="text-primary-600 hover:underline">
        {{ $t('knowledge.rating.loginToRate') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star } from 'lucide-vue-next'

export interface ExistingRating {
  score: number
  comment: string
}

const props = defineProps<{
  lessonId: string
  tutorSlug: string
  lessonSlug: string
  existingRating: ExistingRating | null
  isAuthenticated: boolean
}>()

const emit = defineEmits<{
  rated: [score: number, comment: string]
}>()

const { t } = useI18n()

const selectedScore = ref<number | null>(null)
const hoverScore = ref(0)
const comment = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)

async function submitRating(): Promise<void> {
  if (!selectedScore.value) return
  isSubmitting.value = true
  error.value = null
  try {
    // catalogApi.rateLesson will be wired by Agent A when API is ready
    // For now emit to parent which handles the API call
    emit('rated', selectedScore.value, comment.value)
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    error.value = detail || t('knowledge.rating.submitError', 'Failed to submit rating')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>
