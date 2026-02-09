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
      <button 
        class="btn-helpful"
        :class="{ 'btn-helpful--active': review.has_user_marked_helpful }"
        @click="toggleHelpful"
        :disabled="helpfulLoading"
      >
        <i class="icon-thumbs-up"></i>
        {{ $t('reviews.helpful') }} ({{ review.helpful_count }})
      </button>
      
      <button 
        v-if="showReport"
        class="btn-report"
        @click="showReportModal = true"
      >
        <i class="icon-flag"></i>
        {{ $t('reviews.report') }}
      </button>

      <button 
        v-if="review.can_edit && !editMode"
        class="btn-edit"
        @click="startEdit"
      >
        <i class="icon-edit"></i>
        {{ $t('reviews.edit') }}
      </button>

      <button 
        v-if="review.can_delete && !editMode"
        class="btn-delete"
        @click="confirmDelete"
      >
        <i class="icon-trash"></i>
        {{ $t('reviews.delete') }}
      </button>
    </div>

    <!-- Edit Mode -->
    <div v-if="editMode" class="edit-form">
      <textarea 
        v-model="editedText" 
        class="edit-textarea"
        :placeholder="$t('reviews.editPlaceholder')"
        rows="4"
      ></textarea>
      <div class="edit-actions">
        <button class="btn-save" @click="saveEdit" :disabled="!canSaveEdit">
          {{ $t('common.save') }}
        </button>
        <button class="btn-cancel" @click="cancelEdit">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>

    <!-- Report Modal -->
    <div v-if="showReportModal" class="report-modal" @click.self="showReportModal = false">
      <div class="modal-content">
        <h3>{{ $t('reviews.reportTitle') }}</h3>
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
        
        <textarea 
          v-model="reportComment"
          class="report-comment"
          :placeholder="$t('reviews.reportCommentPlaceholder')"
          rows="3"
        ></textarea>
        
        <div class="modal-actions">
          <button 
            class="btn-submit-report" 
            @click="submitReport"
            :disabled="!selectedReportReason || reportSubmitting"
          >
            {{ $t('reviews.submitReport') }}
          </button>
          <button class="btn-cancel" @click="showReportModal = false">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'

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
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin-bottom: 16px;
}

.review-card--verified {
  border-left: 4px solid #22c55e;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.review-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: #f3f4f6;
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
  color: #9ca3af;
}

.author-name {
  font-weight: 600;
  color: #111827;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}

.verified-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #22c55e;
  font-weight: 500;
}

.review-rating {
  display: flex;
  gap: 4px;
}

.star {
  font-size: 18px;
}

.star--filled {
  color: #fbbf24;
}

.star--empty {
  color: #e5e7eb;
}

.review-content {
  margin-bottom: 16px;
}

.review-text {
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.tutor-response {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  border-left: 3px solid #3b82f6;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #3b82f6;
  margin-bottom: 8px;
  font-size: 14px;
}

.response-date {
  color: #9ca3af;
  font-weight: normal;
  margin-left: auto;
}

.response-text {
  color: #4b5563;
  margin: 0;
  line-height: 1.5;
}

.review-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.review-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-helpful {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-helpful:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-helpful--active {
  background: #dbeafe;
  color: #2563eb;
}

.btn-report {
  background: transparent;
  color: #9ca3af;
}

.btn-report:hover {
  color: #ef4444;
}

.btn-edit {
  background: transparent;
  color: #6b7280;
}

.btn-edit:hover {
  color: #3b82f6;
}

.btn-delete {
  background: transparent;
  color: #6b7280;
}

.btn-delete:hover {
  color: #ef4444;
}

.edit-form {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.edit-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
}

.edit-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.btn-save {
  background: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.btn-save:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

/* Report Modal */
.report-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 8px;
}

.report-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}

.report-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.report-comment {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  resize: vertical;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-submit-report {
  background: #ef4444;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.btn-submit-report:disabled {
  background: #fca5a5;
  cursor: not-allowed;
}
</style>
