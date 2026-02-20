<template>
  <div class="review-card" :class="{ 'review-card--verified': review.is_verified, 'review-card--anonymous': review.is_anonymous }">
    <!-- Header: Avatar + Name + Date -->
    <div class="review-header">
      <div class="review-author">
        <div class="author-avatar">
          <img 
            v-if="!review.is_anonymous && review.student_avatar" 
            :src="review.student_avatar" 
            :alt="review.student_name"
          />
          <div v-else class="avatar-placeholder">
            <i class="icon-user"></i>
          </div>
        </div>
        <div class="author-info">
          <span class="author-name">
            {{ review.is_anonymous ? $t('reviews.anonymous') : review.student_name }}
          </span>
          <div class="review-meta">
            <span class="review-date">{{ formattedDate }}</span>
            <span v-if="review.is_verified" class="verified-badge">
              <i class="icon-check-circle"></i>
              {{ $t('reviews.verified') }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Rating Stars -->
      <div class="review-rating">
        <span 
          v-for="n in 5" 
          :key="n"
          class="star"
          :class="{ 'star--filled': n <= review.rating, 'star--empty': n > review.rating }"
        >
          ★
        </span>
      </div>
    </div>

    <!-- Review Text -->
    <div class="review-content">
      <p class="review-text">{{ review.text }}</p>
    </div>

    <!-- Tutor Response -->
    <div v-if="review.tutor_response" class="tutor-response">
      <div class="response-header">
        <i class="icon-reply"></i>
        <span>{{ $t('reviews.tutorResponse') }}</span>
        <span class="response-date">{{ formatDate(review.tutor_response.created_at) }}</span>
      </div>
      <p class="response-text">{{ review.tutor_response.text }}</p>
    </div>

    <!-- Actions -->
    <div class="review-actions">
      <Button 
        variant="ghost"
        size="sm"
        :class="{ 'btn-helpful--active': review.has_user_marked_helpful }"
        :disabled="helpfulLoading"
        @click="toggleHelpful"
      >
        <i class="icon-thumbs-up"></i>
        {{ $t('reviews.helpful') }} ({{ review.helpful_count }})
      </Button>
      
      <Button 
        v-if="showReport"
        variant="ghost"
        size="sm"
        @click="showReportModal = true"
      >
        <i class="icon-flag"></i>
        {{ $t('reviews.report') }}
      </Button>

      <Button 
        v-if="review.can_edit && !editMode"
        variant="ghost"
        size="sm"
        @click="startEdit"
      >
        <i class="icon-edit"></i>
        {{ $t('reviews.edit') }}
      </Button>

      <Button 
        v-if="review.can_delete && !editMode"
        variant="danger"
        size="sm"
        @click="confirmDelete"
      >
        <i class="icon-trash"></i>
        {{ $t('reviews.delete') }}
      </Button>
    </div>

    <!-- Edit Mode -->
    <div v-if="editMode" class="edit-form">
      <Textarea 
        v-model="editedText" 
        :placeholder="$t('reviews.editPlaceholder')"
        :rows="4"
      />
      <div class="edit-actions">
        <Button variant="primary" size="sm" :disabled="!canSaveEdit" @click="saveEdit">
          {{ $t('common.save') }}
        </Button>
        <Button variant="secondary" size="sm" @click="cancelEdit">
          {{ $t('common.cancel') }}
        </Button>
      </div>
    </div>

    <!-- Report Modal -->
    <Modal
      :open="showReportModal"
      :title="$t('reviews.reportTitle')"
      size="sm"
      @close="showReportModal = false"
    >
      <p>{{ $t('reviews.reportSubtitle') }}</p>
      
      <div class="report-options">
        <label v-for="reason in reportReasons" :key="reason.value" class="report-option">
          <input 
            type="radio" 
            v-model="selectedReportReason" 
            :value="reason.value"
          />
          <span>{{ reason.label }}</span>
        </label>
      </div>
      
      <Textarea 
        v-model="reportComment"
        :placeholder="$t('reviews.reportCommentPlaceholder')"
        :rows="3"
      />
      
      <template #footer>
        <Button variant="secondary" size="sm" @click="showReportModal = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button 
          variant="danger"
          size="sm"
          :disabled="!selectedReportReason || reportSubmitting"
          :loading="reportSubmitting"
          @click="submitReport"
        >
          {{ $t('reviews.submitReport') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import Textarea from '@/ui/Textarea.vue'

const props = defineProps({
  review: {
    type: Object,
    required: true
  },
  showReport: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update', 'delete'])

const store = useReviewsStore()

// Local state
const helpfulLoading = ref(false)
const editMode = ref(false)
const editedText = ref('')
const showReportModal = ref(false)
const selectedReportReason = ref('')
const reportComment = ref('')
const reportSubmitting = ref(false)

const reportReasons = [
  { value: 'inaccurate', label: 'Недостовірний відгук' },
  { value: 'offensive', label: 'Образливий контент' },
  { value: 'fake', label: 'Фальшивий відгук' },
  { value: 'other', label: 'Інше' }
]

// Computed
const formattedDate = computed(() => {
  return formatDate(props.review.created_at)
})

const canSaveEdit = computed(() => {
  return editedText.value.trim().length >= 50 && editedText.value !== props.review.text
})

// Methods
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

async function toggleHelpful() {
  if (helpfulLoading.value) return
  
  helpfulLoading.value = true
  try {
    if (props.review.has_user_marked_helpful) {
      await store.unmarkHelpful(props.review.id)
    } else {
      await store.markHelpful(props.review.id)
    }
  } catch (error) {
    console.error('Failed to toggle helpful:', error)
  } finally {
    helpfulLoading.value = false
  }
}

function startEdit() {
  editMode.value = true
  editedText.value = props.review.text
}

function cancelEdit() {
  editMode.value = false
  editedText.value = ''
}

async function saveEdit() {
  try {
    await store.updateReview(props.review.id, { text: editedText.value })
    editMode.value = false
    emit('update')
  } catch (error) {
    console.error('Failed to save edit:', error)
  }
}

async function confirmDelete() {
  if (!confirm('Ви впевнені, що хочете видалити цей відгук?')) return
  
  try {
    await store.deleteReview(props.review.id, props.review.tutor_id)
    emit('delete', props.review.id)
  } catch (error) {
    console.error('Failed to delete review:', error)
  }
}

async function submitReport() {
  if (!selectedReportReason.value) return
  
  reportSubmitting.value = true
  try {
    await store.reportReview(
      props.review.id, 
      selectedReportReason.value, 
      reportComment.value
    )
    showReportModal.value = false
    selectedReportReason.value = ''
    reportComment.value = ''
    alert('Скаргу надіслано на модерацію')
  } catch (error) {
    console.error('Failed to report review:', error)
  } finally {
    reportSubmitting.value = false
  }
}
</script>

<style scoped>
.review-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-md);
}

.review-card--verified {
  border-left: 4px solid var(--success-bg);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.review-author {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 20px;
  color: var(--text-secondary);
}

.author-name {
  font-weight: 600;
  color: var(--text-primary);
}

.review-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-2xs);
}

.verified-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  color: var(--success-bg);
  font-weight: 500;
}

.review-rating {
  display: flex;
  gap: var(--space-2xs);
}

.star {
  font-size: 18px;
}

.star--filled {
  color: var(--warning-bg);
}

.star--empty {
  color: var(--border-color);
}

.review-content {
  margin-bottom: var(--space-md);
}

.review-text {
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0;
}

.tutor-response {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  border-left: 3px solid var(--accent);
}

.response-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 500;
  color: var(--accent);
  margin-bottom: var(--space-xs);
  font-size: var(--text-sm);
}

.response-date {
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: auto;
}

.response-text {
  color: var(--text-primary);
  margin: 0;
  line-height: 1.5;
}

.review-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.btn-helpful--active {
  background: color-mix(in srgb, var(--accent) 15%, transparent) !important;
  color: var(--accent) !important;
}

.edit-form {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.edit-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.report-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: var(--space-md) 0;
}

.report-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
}
</style>
