<template>
  <div v-if="visible" class="recommended-tutors-widget">
    <div class="widget-header">
      <h4 class="widget-title">
        <i class="icon-users"></i>
        {{ $t('inquiries.recommended.title') }}
      </h4>
      <button class="btn-close" @click="dismiss" :aria-label="$t('common.close')">
        <i class="icon-close"></i>
      </button>
    </div>
    
    <p class="widget-description">{{ $t('inquiries.recommended.description') }}</p>
    
    <div v-if="loading" class="loading-state">
      <div v-for="i in 3" :key="i" class="skeleton-card"></div>
    </div>
    
    <div v-else-if="tutors.length" class="tutors-list">
      <div
        v-for="tutor in tutors"
        :key="tutor.id"
        class="tutor-card"
        @click="goToTutor(tutor.id)"
      >
        <div class="tutor-avatar">
          <img
            v-if="tutor.avatar"
            :src="tutor.avatar"
            :alt="tutor.display_name || tutor.full_name"
          />
          <span v-else class="avatar-placeholder">
            {{ getInitialsFromName(tutor.display_name || tutor.full_name) }}
          </span>
        </div>
        <div class="tutor-info">
          <h5 class="tutor-name">{{ tutor.display_name || tutor.full_name }}</h5>
          <p class="tutor-subjects">{{ formatSubjects(tutor.subjects) }}</p>
          <div class="tutor-meta">
            <span v-if="tutor.hourly_rate" class="tutor-rate">
              {{ tutor.hourly_rate }} {{ tutor.currency }}/год
            </span>
            <span v-if="tutor.rating" class="tutor-rating">
              <i class="icon-star"></i> {{ tutor.rating }}
            </span>
          </div>
        </div>
        <button class="btn-view">
          <i class="icon-chevron-right"></i>
        </button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <p>{{ $t('inquiries.recommended.empty') }}</p>
    </div>
    
    <div class="widget-footer">
      <button class="btn btn-link" @click="goToCatalog">
        {{ $t('inquiries.recommended.viewAll') }}
        <i class="icon-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  // Subject IDs or names to match
  subjects: {
    type: Array,
    default: () => []
  },
  // Budget range
  minBudget: {
    type: Number,
    default: null
  },
  maxBudget: {
    type: Number,
    default: null
  },
  // Current inquiry ID (to exclude current tutor)
  excludeTutorId: {
    type: Number,
    default: null
  },
  // Auto-load on mount
  autoLoad: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['dismiss'])

const router = useRouter()

const visible = ref(true)
const loading = ref(false)
const tutors = ref([])

// Mock data - replace with actual API call
const mockTutors = [
  {
    id: 1,
    display_name: 'Олена П.',
    full_name: 'Олена Петренко',
    subjects: ['Математика', 'Фізика'],
    hourly_rate: 350,
    currency: 'грн',
    rating: 4.9,
    avatar: null
  },
  {
    id: 2,
    display_name: 'Іван К.',
    full_name: 'Іван Коваленко',
    subjects: ['Англійська мова'],
    hourly_rate: 400,
    currency: 'грн',
    rating: 4.8,
    avatar: null
  },
  {
    id: 3,
    display_name: 'Марія Ш.',
    full_name: 'Марія Шевченко',
    subjects: ['Історія', 'Географія'],
    hourly_rate: 300,
    currency: 'грн',
    rating: 4.7,
    avatar: null
  }
]

onMounted(() => {
  if (props.autoLoad) {
    loadRecommendedTutors()
  }
})

async function loadRecommendedTutors() {
  loading.value = true
  
  try {
    // TODO: Replace with actual API call
    // const response = await inquiriesApi.getRecommendedTutors({
    //   subjects: props.subjects,
    //   min_budget: props.minBudget,
    //   max_budget: props.maxBudget,
    //   exclude_tutor_id: props.excludeTutorId
    // })
    // tutors.value = response.tutors
    
    // Mock loading delay
    await new Promise(resolve => setTimeout(resolve, 500))
    tutors.value = mockTutors.filter(t => t.id !== props.excludeTutorId)
  } catch (e) {
    console.error('Failed to load recommended tutors:', e)
  } finally {
    loading.value = false
  }
}

function getDisplayName(tutor) {
  return tutor.display_name || tutor.email?.split('@')[0] || ''
}

function getInitialsFromName(name) {
  if (!name) return ''
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatSubjects(subjects) {
  if (!subjects || !subjects.length) return ''
  return subjects.slice(0, 2).join(', ') + (subjects.length > 2 ? '...' : '')
}

function goToTutor(tutorId) {
  router.push({ name: 'TutorProfile', params: { id: tutorId } })
}

function goToCatalog() {
  router.push({ name: 'Marketplace' })
}

function dismiss() {
  visible.value = false
  emit('dismiss')
}
</script>

<style scoped>
.recommended-tutors-widget {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-top: var(--spacing-lg);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.widget-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0;
}

.widget-title i {
  color: var(--color-primary);
}

.btn-close {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.btn-close:hover {
  opacity: 1;
}

.widget-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-md);
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton-card {
  height: 64px;
  background: var(--color-skeleton);
  border-radius: var(--radius-md);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tutors-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.tutor-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tutor-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.tutor-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tutor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.tutor-info {
  flex: 1;
  min-width: 0;
}

.tutor-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text-primary);
}

.tutor-subjects {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-xs);
}

.tutor-meta {
  display: flex;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.tutor-rating {
  color: var(--color-warning);
}

.tutor-rating i {
  margin-right: 2px;
}

.btn-view {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-view:hover {
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.widget-footer {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: center;
}

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-link:hover {
  color: var(--color-primary-hover);
}
</style>
