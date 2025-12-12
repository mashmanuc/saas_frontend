<template>
  <div class="space-y-6">
    <Card class="space-y-4">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold text-body">{{ $t('dashboard.tutor.title') }}</h1>
        <p class="text-sm text-muted">
          {{ $t('dashboard.tutor.description') }}
        </p>
      </header>

      <div class="rounded-2xl border border-default bg-surface p-4 shadow-theme">
        <p class="text-sm text-muted">
          {{ $t('dashboard.nextLessonAt') }}:
          <span v-if="nextLessonAt" class="font-medium text-body">
            {{ formatDateTime(nextLessonAt, userTimezone) }}
          </span>
          <span v-else class="font-medium text-body">{{ $t('dashboard.tutor.nextLessonFallback') }}</span>
        </p>
      </div>

      <!-- Today's Lessons -->
      <div v-if="dashboard.todaysLessons?.length > 0" class="space-y-3">
        <h3 class="text-base font-medium text-body">{{ $t('dashboard.tutor.todaysLessons') || 'Уроки сьогодні' }}</h3>
        <div class="space-y-2">
          <UpcomingLessonCard
            v-for="lesson in dashboard.todaysLessons"
            :key="lesson.id"
            :lesson="lesson"
            :is-tutor="true"
          />
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex flex-wrap gap-3">
        <router-link to="/bookings" class="text-sm text-accent hover:underline">
          {{ $t('dashboard.tutor.viewBookings') || 'Переглянути бронювання' }}
        </router-link>
        <router-link to="/lessons" class="text-sm text-accent hover:underline">
          {{ $t('dashboard.tutor.viewLessons') || 'Мої уроки' }}
        </router-link>
      </div>
    </Card>

    <Card class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">{{ $t('dashboard.tutor.studentsTitle') }}</h2>
          <p class="text-sm text-muted">
            {{ $t('dashboard.tutor.studentsDescription') }}
          </p>
        </div>
        <div class="inline-flex rounded-full border border-default overflow-hidden text-xs">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="flex items-center gap-2 px-3 py-1 transition"
            :class="tutorFilter === tab.value ? 'bg-accent text-white' : 'text-muted'"
            :data-test="`tutor-tab-${tab.value}`"
            @click="setFilter(tab.value)"
          >
            <span>{{ $t(tab.label) }}</span>
            <span
              class="inline-flex min-w-[1.5rem] justify-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white"
            >
              {{ tab.count ?? 0 }}
            </span>
          </button>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-soft/70 px-4 py-3 text-sm"
      >
        <div class="flex flex-wrap items-center gap-3 text-muted">
          <span v-if="totalSelected">
            {{ $t('dashboard.tutor.bulk.selected', { count: totalSelected }) }}
          </span>
          <span v-else>
            {{ $t('dashboard.tutor.bulk.selectHint') }}
          </span>

          <button
            type="button"
            class="font-medium text-body hover:underline disabled:opacity-60"
            :disabled="!filteredRelations.length"
            @click="selectAllCurrent"
          >
            {{ $t('dashboard.tutor.bulk.selectAllCurrent') }}
          </button>
          <button
            type="button"
            class="font-medium text-body hover:underline disabled:opacity-60"
            :disabled="!totalSelected"
            @click="clearSelection"
          >
            {{ $t('dashboard.tutor.bulk.clearSelection') }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            :disabled="!canBulkAccept || bulkLoading"
            :loading="bulkLoading && canBulkAccept"
            data-test="bulk-accept"
            @click="handleBulkAccept"
          >
            {{ $t('dashboard.tutor.bulk.acceptSelected') }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="!canBulkArchive || bulkLoading"
            :loading="bulkLoading && canBulkArchive"
            data-test="bulk-archive"
            @click="handleBulkArchive"
          >
            {{ $t('dashboard.tutor.bulk.archiveSelected') }}
          </Button>
        </div>
      </div>

      <div v-if="relationsLoading" class="text-sm text-muted">{{ $t('loader.loading') }}</div>
      <p v-else-if="relationsError" class="text-sm text-danger" data-test="relations-error">{{ relationsError }}</p>
      <template v-else>
        <div
          v-if="tabHint"
          class="rounded-2xl border border-dashed border-default bg-surface-soft p-4 space-y-1"
        >
          <p class="text-sm font-semibold text-body">
            {{ tabHint.title }}
          </p>
          <p class="text-sm text-muted">
            {{ tabHint.description }}
          </p>
        </div>

        <ul v-if="filteredRelations.length" class="space-y-3">
          <li
            v-for="relation in filteredRelations"
            :key="getRelationId(relation)"
            class="space-y-3 rounded-2xl border border-border-subtle bg-surface-soft/60 p-4"
          >
            <div class="flex flex-wrap items-start gap-4">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-border-subtle accent-accent"
                :checked="relationsStore.isTutorSelected(getRelationId(relation))"
                @change="toggleSelection(getRelationId(relation))"
              />
              <div class="flex-1 space-y-1">
                <p class="text-base font-semibold text-body">{{ getStudentName(relation.student) }}</p>
                <p class="text-sm text-muted">{{ relation.student?.email }}</p>
                <p class="text-xs text-muted">
                  {{ $t('dashboard.tutor.timezoneLabel') }}
                  <span class="font-medium">
                    {{ relation.student?.timezone || $t('dashboard.tutor.timezoneUnknown') }}
                  </span>
                </p>
                <p v-if="relation.notes" class="text-xs text-muted">
                  {{ relation.notes }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border border-default px-3 py-1 text-xs font-semibold text-muted"
                :data-test="`relation-status-${getRelationId(relation)}`"
              >
                {{ statusLabels[relation.status] || relation.status }}
              </span>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" @click="handleCreateLesson(relation)">
                  {{ $t('dashboard.tutor.cta.createLesson') }}
                </Button>
                <Button variant="ghost" size="sm" @click="handleOpenChat(relation)">
                  {{ $t('dashboard.tutor.cta.openChat') }}
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap gap-2" v-if="relation.status === 'invited'">
              <Button
                variant="primary"
                size="sm"
                :disabled="actionLoadingId === getRelationId(relation)"
                :loading="actionLoadingId === getRelationId(relation)"
                @click="handleAccept(getRelationId(relation))"
              >
                {{ $t('common.accept') }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="actionLoadingId === getRelationId(relation)"
                @click="handleDecline(getRelationId(relation))"
              >
                {{ $t('common.decline') }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :disabled="resendLoadingId === getRelationId(relation)"
                :loading="resendLoadingId === getRelationId(relation)"
                @click="handleResend(getRelationId(relation))"
              >
                {{ $t('tutor.actions.resend') }}
              </Button>
            </div>
          </li>
        </ul>

        <Button
          v-if="hasMore"
          class="w-full"
          variant="ghost"
          :loading="loadingMore"
          @click="handleLoadMore"
        >
          {{ $t('dashboard.tutor.loadMore') }}
        </Button>

        <div
          v-else
          class="rounded-2xl border border-dashed border-default bg-surface-soft p-6 space-y-2 text-center"
        >
          <p class="font-semibold text-body">
            {{ emptyState.title }}
          </p>
          <p class="text-sm text-muted">
            {{ emptyState.description }}
          </p>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Avatar from '../../../ui/Avatar.vue'
import PresenceDot from '../../../ui/PresenceDot.vue'
import UpcomingLessonCard from '../components/UpcomingLessonCard.vue'
import { formatDateTime } from '../../../utils/datetime'
import { useAuthStore } from '../../auth/store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useRelationsStore } from '../../../stores/relationsStore'
import { usePresenceStore } from '../../../stores/presenceStore'
import { notifySuccess, notifyError } from '../../../utils/notify'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const relationsStore = useRelationsStore()
const presenceStore = usePresenceStore()
presenceStore.init()
const router = useRouter()
const { t } = useI18n()

const nextLessonAt = computed(() => dashboard.nextLessonAt)
const userTimezone = computed(() => auth.user?.timezone)
const relationsLoading = computed(() => relationsStore.tutorLoading)
const relationsError = computed(() => relationsStore.tutorError)
const relationsErrorCode = computed(() => relationsStore.tutorErrorCode)
const filteredRelations = computed(() => relationsStore.filteredTutorRelations)
const tutorFilter = computed(() => relationsStore.tutorFilter)
const summary = computed(() => relationsStore.tutorSummary || {})
const totalSelected = computed(() => relationsStore.selectedTutorCount)
const canBulkAccept = computed(() => relationsStore.canBulkAccept)
const canBulkArchive = computed(() => relationsStore.canBulkArchive)
const bulkLoading = computed(() => relationsStore.tutorBulkLoading)
const hasMore = computed(() => relationsStore.tutorHasMore)
const loadingMore = computed(() => relationsStore.tutorLoadingMore)
const trackedStudentIds = computed(() =>
  filteredRelations.value
    .map((relation) => relation.student?.id)
    .filter((id) => id != null)
    .map((id) => String(id)),
)

watch(
  trackedStudentIds,
  (ids) => {
    if (ids?.length) {
      presenceStore.track(ids)
    }
  },
  { immediate: true },
)

const actionLoadingId = ref(null)
const resendLoadingId = ref(null)
const retryLoading = ref(false)

const tabs = computed(() => [
  {
    value: 'all',
    label: 'dashboard.tutor.tabs.all',
    count: summary.value?.total ?? relationsStore.tutorRelations.length,
  },
  {
    value: 'invited',
    label: 'dashboard.tutor.tabs.invited',
    count: summary.value?.invited ?? 0,
  },
  {
    value: 'active',
    label: 'dashboard.tutor.tabs.active',
    count: summary.value?.active ?? 0,
  },
  {
    value: 'archived',
    label: 'dashboard.tutor.tabs.archived',
    count: summary.value?.archived ?? 0,
  },
])

const statusLabels = computed(() => ({
  pending: t('dashboard.tutor.status.pending'),
  active: t('dashboard.tutor.status.active'),
  inactive: t('dashboard.tutor.status.inactive'),
  invited: t('dashboard.tutor.status.invited'),
  archived: t('dashboard.tutor.status.archived'),
}))

const tabHint = computed(() => {
  const map = {
    invited: {
      title: t('dashboard.tutor.tabHints.invited.title'),
      description: t('dashboard.tutor.tabHints.invited.description'),
    },
    active: {
      title: t('dashboard.tutor.tabHints.active.title'),
      description: t('dashboard.tutor.tabHints.active.description'),
    },
  }
  return map[tutorFilter.value] || null
})

const emptyState = computed(() => {
  const map = {
    all: {
      title: t('dashboard.tutor.emptyStates.all.title'),
      description: t('dashboard.tutor.emptyStates.all.description'),
    },
    invited: {
      title: t('dashboard.tutor.emptyStates.invited.title'),
      description: t('dashboard.tutor.emptyStates.invited.description'),
    },
    active: {
      title: t('dashboard.tutor.emptyStates.active.title'),
      description: t('dashboard.tutor.emptyStates.active.description'),
    },
  }
  return map[tutorFilter.value] || map.all
})

const errorState = computed(() => {
  if (!relationsError.value) return null
  const code = relationsErrorCode.value
  const titleKeyMap = {
    offline: 'relations.errors.offlineTitle',
    'rate-limit': 'relations.errors.rateLimitTitle',
    backend: 'relations.errors.backendTitle',
  }
  const descriptionKeyMap = {
    offline: 'relations.errors.offlineDescription',
    'rate-limit': 'relations.errors.rateLimitDescription',
    backend: 'relations.errors.backendDescription',
  }
  const titleKey = titleKeyMap[code] || titleKeyMap.backend
  const descriptionKey = descriptionKeyMap[code] || descriptionKeyMap.backend
  return {
    title: t(titleKey),
    description: t(descriptionKey),
  }
})

function getStudentName(student) {
  if (!student) return '—'
  const { first_name: firstName, last_name: lastName, email } = student
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || email || '—'
}

function formatLessonCount(value) {
  return typeof value === 'number' ? value : 0
}

function formatRecentActivity(value) {
  return value || t('relations.meta.never')
}

function formatMetaDate(value) {
  return value ? formatDateTime(value) : t('relations.meta.never')
}

function getRelationId(relation) {
  if (!relation) return ''
  const id = relation.id ?? relation.relation_id ?? relation.student_id ?? relation.student?.id
  return id != null ? String(id) : ''
}

function setFilter(value) {
  relationsStore.setTutorFilter(value).catch(() => {})
}

function toggleSelection(id) {
  relationsStore.toggleTutorSelection(id)
}

function selectAllCurrent() {
  relationsStore.selectAllCurrentTutorRelations()
}

function clearSelection() {
  relationsStore.clearTutorSelection()
}

function handleBulkAccept() {
  relationsStore.bulkAcceptSelectedTutorRelations().catch(() => {})
}

function handleBulkArchive() {
  relationsStore.bulkArchiveSelectedTutorRelations().catch(() => {})
}

async function handleAccept(relationId) {
  actionLoadingId.value = relationId
  try {
    await relationsStore.acceptRelation(relationId)
    notifySuccess(t('tutor.notifications.acceptSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('tutor.notifications.acceptError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleDecline(relationId) {
  actionLoadingId.value = relationId
  try {
    await relationsStore.declineRelation(relationId)
    notifySuccess(t('tutor.notifications.declineSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('tutor.notifications.declineError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleResend(relationId) {
  resendLoadingId.value = relationId
  try {
    await relationsStore.resendRelation(relationId)
    notifySuccess(t('tutor.notifications.resendSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('tutor.notifications.resendError'))
  } finally {
    resendLoadingId.value = null
  }
}

function handleCreateLesson(relation) {
  const studentId = relation.student?.id
  router.push({ name: 'lessons', query: studentId ? { student: studentId } : undefined }).catch(() => {})
}

function handleOpenChat() {
  router.push('/chat').catch(() => {})
}

function handleLoadMore() {
  relationsStore.loadMoreTutorRelations().catch(() => {})
}

async function handleRetryFetch() {
  retryLoading.value = true
  try {
    await relationsStore.fetchTutorRelations()
  } finally {
    retryLoading.value = false
  }
}

function isOnline(userId) {
  if (!userId) return false
  return presenceStore.isOnline?.(String(userId)) || false
}

onMounted(() => {
  // Use new method if available, fallback to old
  if (dashboard.fetchTutorDashboard) {
    dashboard.fetchTutorDashboard().catch(() => {})
  } else if (dashboard.fetchTutorStudents) {
    dashboard.fetchTutorStudents().catch(() => {})
  }
  relationsStore.fetchTutorRelations().catch(() => {})
})
</script>
