<template>
  <Card class="space-y-4">
    <Heading :level="2">
      {{ $t('studentDashboard.activeTutors.title') }}
    </Heading>

    <!-- Loading State -->
    <div v-if="loading" class="text-sm text-muted">
      {{ $t('loader.loading') }}
    </div>

    <!-- Error State -->
    <p v-else-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Empty State -->
    <template v-else-if="!hasActiveTutors">
      <div
        class="rounded-2xl border border-dashed border-default bg-surface-soft p-4 space-y-1"
      >
        <p class="text-sm font-semibold text-body">
          {{ $t('studentDashboard.noTutor.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('studentDashboard.noTutor.description') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button variant="primary" size="sm" @click="goToMarketplace">
          {{ $t('studentDashboard.actions.chooseTutor') }}
        </Button>
        <Button variant="ghost" size="sm" @click="goToMarketplace">
          {{ $t('studentDashboard.actions.exploreMarketplace') }}
        </Button>
      </div>
    </template>

    <!-- Active Tutors List -->
    <section v-else class="space-y-4">
      <div
        v-for="tutor in activeTutors"
        :key="tutor.id"
        class="rounded-2xl border border-default bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center"
      >
        <div class="flex items-start gap-4 flex-1">
          <div
            class="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-lg font-semibold text-accent shadow-theme"
          >
            {{ getTutorInitials(tutor) }}
          </div>
          <div class="space-y-1 flex-1">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-base text-body">
                {{ tutor.full_name || tutor.email }}
              </p>
              <span 
                v-if="tutor.collaboration_status"
                class="px-2 py-0.5 text-xs rounded-full font-medium"
                :class="getStatusBadgeClass(tutor.collaboration_status)"
              >
                {{ getCollaborationStatusLabel(tutor.collaboration_status) }}
              </span>
            </div>
            <p class="text-sm text-muted" v-if="tutor.email">
              {{ tutor.email }}
            </p>
            <p class="text-xs text-muted" v-if="tutor.timezone">
              {{ $t('dashboard.tutor.timezoneLabel') }}
              <span class="font-medium">{{ tutor.timezone }}</span>
            </p>
            <p class="text-sm text-muted" v-if="tutor.subjects?.length">
              {{ tutor.subjects.join(', ') }}
            </p>
            <p class="text-xs text-muted" v-if="tutor.headline">
              {{ tutor.headline }}
            </p>
            <div v-if="tutor.lesson_count !== undefined" class="flex items-center gap-4 text-xs text-muted mt-2">
              <span v-if="tutor.lesson_count > 0">
                {{ $t('board.collaboration.stats.lessonsCompleted', { count: tutor.lesson_count }) }}
              </span>
              <span v-if="tutor.last_activity_at">
                {{ $t('board.collaboration.stats.lastActivity') }}: {{ formatDate(tutor.last_activity_at) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 w-full md:w-auto">
          <Button
            variant="secondary"
            size="sm"
            class="flex-1 md:flex-none"
            @click="openChatModal(tutor)"
          >
            {{ $t('studentDashboard.actions.messageTutor') }}
          </Button>
          <Button variant="primary" size="sm" class="flex-1 md:flex-none" @click="goToLessons">
            {{ $t('studentDashboard.actions.bookLesson') }}
          </Button>
        </div>
      </div>
    </section>
    
    <!-- Phase 1 v0.87: Chat Modal for Student -->
    <ChatModal
      :is-open="chatModalOpen"
      :student-id="null"
      :tutor-id="selectedTutorId"
      :relation-id="selectedRelationId"
      @close="closeChatModal"
    />
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import ChatModal from '@/modules/chat/components/ChatModal.vue'
import type { AssignedTutor } from '../api/dashboard'

interface Props {
  activeTutors: AssignedTutor[]
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
})

const router = useRouter()
const { t } = useI18n()

const hasActiveTutors = computed(() => props.activeTutors.length > 0)

// Phase 1 v0.87: Chat modal state
const chatModalOpen = ref(false)
const selectedTutorId = ref<number | null>(null)
const selectedRelationId = ref<number | null>(null)

function openChatModal(tutor: AssignedTutor) {
  selectedTutorId.value = tutor.id
  // relation_id буде знайдено через API в ChatModal
  selectedRelationId.value = null
  chatModalOpen.value = true
}

function closeChatModal() {
  chatModalOpen.value = false
  selectedTutorId.value = null
  selectedRelationId.value = null
}

function getCollaborationStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return t('dashboard.tutor.status.pending')
    case 'active':
      return t('dashboard.tutor.status.active')
    case 'inactive':
      return t('dashboard.tutor.status.inactive')
    case 'invited':
      return t('dashboard.tutor.status.invited')
    case 'archived':
      return t('dashboard.tutor.status.archived')
    default:
      return status
  }
}

function getTutorInitials(tutor: AssignedTutor): string {
  if (!tutor.full_name) return 'T'
  const parts = tutor.full_name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return tutor.full_name[0]?.toUpperCase() || 'T'
}

function goToMarketplace() {
  router.push('/marketplace').catch(() => {})
}

function goToLessons() {
  router.push('/calendar').catch(() => {})
}

function goToChat(tutor: AssignedTutor) {
  if (tutor?.id) {
    router.push({ name: 'chat_with_tutor', params: { tutorId: tutor.id } }).catch(() => {})
  }
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    invited: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  }
  return classes[status] || classes.active
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}
</script>
