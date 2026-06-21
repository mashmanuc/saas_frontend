<template>
  <div class="space-y-6" data-testid="tutor-students-page">
    <Card class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">{{ $t('dashboard.tutor.studentsTitle') }}</h1>
          <p class="text-sm text-muted">
            {{ $t('dashboard.tutor.studentsDescription') }}
          </p>
        </div>
        <InviteCreateButton class="shrink-0" />
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
              <div class="flex-1 min-w-0 space-y-1">
                <p class="text-base font-semibold text-body break-words">
                  {{ getStudentName(relation.student) }}
                  <span
                    v-if="relation.student?.is_demo"
                    class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                  >
                    {{ $t('student.demoBadge') }}
                  </span>
                </p>
                <p class="text-sm text-muted break-all" v-if="relation.status === 'active'">{{ relation.student?.email }}</p>
                <p class="text-xs text-muted">
                  {{ $t('dashboard.tutor.timezoneLabel') }}
                  <span class="font-medium">
                    {{ relation.student?.timezone || $t('dashboard.tutor.timezoneUnknown') }}
                  </span>
                </p>
                <p v-if="relation.notes" class="text-xs text-muted break-words">
                  {{ relation.notes }}
                </p>
              </div>
            </div>

            <!-- Contact Access Component - тільки для active -->
            <StudentContactUnlock
              v-if="relation.status === 'active'"
              :relation="relation"
              :show-revoke-button="true"
            />

            <!-- Кнопки дій для active студентів -->
            <div v-if="relation.status === 'active'" class="flex flex-wrap items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="!canOpenChatWithStudent(relation)"
                  @click="handleOpenChatWithStudent(relation)"
                  class="relative"
                >
                  {{ $t('dashboard.tutor.cta.chatWithStudent') }}
                  <span
                    v-if="getUnreadCountForStudent(relation) > 0"
                    class="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white"
                  >
                    {{ getUnreadCountForStudent(relation) }}
                  </span>
                </Button>
              </div>
            </div>

            <!-- Архівні студенти -->
            <div v-if="relation.status === 'archived'" class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border border-default px-3 py-1 text-xs font-semibold text-muted"
                :data-test="`relation-status-${getRelationId(relation)}`"
              >
                {{ statusLabels[relation.status] || relation.status }}
              </span>

              <span
                v-if="relation.student?.is_deleted"
                class="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
              >
                {{ $t('dashboard.tutor.accountDeleted') }}
              </span>

              <div class="flex flex-wrap gap-2">
                <Button
                  v-if="!relation.student?.is_deleted"
                  variant="primary"
                  size="sm"
                  :disabled="actionLoadingId === getRelationId(relation)"
                  :loading="actionLoadingId === getRelationId(relation)"
                  @click="handleRestore(getRelationId(relation))"
                >
                  {{ $t('common.restore') }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="text-danger border-danger hover:bg-danger/10"
                  :disabled="actionLoadingId === getRelationId(relation)"
                  @click="handleHide(getRelationId(relation))"
                >
                  {{ $t('common.hide') }}
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
          v-if="!filteredRelations.length && !hasMore"
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

    <!-- Chat Modal -->
    <ChatModal
      :is-open="chatModalOpen"
      :student-id="chatModalStudentId"
      :relation-id="chatModalRelationId"
      @close="closeChatModal"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import StudentContactUnlock from '../components/StudentContactUnlock.vue'
import ChatModal from '../../chat/components/ChatModal.vue'
import { useAuthStore } from '../../auth/store/authStore'
import { useRelationsStore } from '../../../stores/relationsStore'
import { usePresenceStore } from '../../../stores/presenceStore'
import { useChatThreadsStore } from '../../../stores/chatThreadsStore'
import { useContactAccessStore } from '../../../stores/contactAccessStore'
import { notifySuccess, notifyError, notifyWarning } from '../../../utils/notify'
import { getMessageAction } from '@/utils/relationsUi'
import { pollingCoordinator } from '@/services/pollingCoordinator'
import lessonsApi from '@/api/lessons'
const InviteCreateButton = defineAsyncComponent(() => import('@/components/invites/InviteCreateButton.vue'))

const auth = useAuthStore()
const relationsStore = useRelationsStore()
const presenceStore = usePresenceStore()
const chatThreadsStore = useChatThreadsStore()
const contactAccessStore = useContactAccessStore()
presenceStore.init()
const router = useRouter()
const { t } = useI18n()

const relationsLoading = computed(() => relationsStore.tutorLoading)
const relationsError = computed(() => relationsStore.tutorError)
const nonDemoRelations = computed(() =>
  relationsStore.tutorRelations.filter(r => !r.student?.is_demo)
)
const filteredRelations = computed(() =>
  relationsStore.filteredTutorRelations.filter(r => !r.student?.is_demo)
)
const tutorFilter = computed(() => relationsStore.tutorFilter)
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

let _trackDebounce = null
watch(
  trackedStudentIds,
  (ids) => {
    if (_trackDebounce) clearTimeout(_trackDebounce)
    _trackDebounce = setTimeout(() => {
      if (ids?.length) {
        presenceStore.track(ids)
      }
    }, 300)
  },
  { immediate: true },
)

const actionLoadingId = ref(null)
const chatModalOpen = ref(false)
const chatModalStudentId = ref(null)
const chatModalRelationId = ref(null)

const tabs = computed(() => [
  {
    value: 'all',
    label: 'dashboard.tutor.tabs.all',
    count: nonDemoRelations.value.length,
  },
  {
    value: 'invited',
    label: 'dashboard.tutor.tabs.invited',
    count: nonDemoRelations.value.filter(r => r.status === 'invited').length,
  },
  {
    value: 'active',
    label: 'dashboard.tutor.tabs.active',
    count: nonDemoRelations.value.filter(r => r.status === 'active').length,
  },
  {
    value: 'archived',
    label: 'dashboard.tutor.tabs.archived',
    count: nonDemoRelations.value.filter(r => r.status === 'archived').length,
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

function getStudentName(student) {
  if (!student) return '—'
  if (student.is_deleted) return t('dashboard.tutor.deletedUser')
  return student.display_name || student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || '—'
}

function getRelationId(relation) {
  if (!relation) return ''
  const id = relation.id ?? relation.relation_id ?? relation.student_id ?? relation.student?.id
  return id != null ? Number(id) : ''
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

    try {
      await contactAccessStore.fetchContactAccessByRelation(relationId)
    } catch {
      // Non-critical
    }

    notifySuccess(t('tutorSearch.notifications.acceptSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('tutorSearch.notifications.acceptError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleDecline(relationId) {
  actionLoadingId.value = relationId
  try {
    await relationsStore.declineRelation(relationId)
    notifySuccess(t('tutorSearch.notifications.declineSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('tutorSearch.notifications.declineError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleRestore(relationId) {
  actionLoadingId.value = relationId
  try {
    await relationsStore.restoreRelation(relationId)
    notifySuccess(t('relations.actions.restoreSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('relations.actions.restoreError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleHide(relationId) {
  if (!confirm(t('relations.actions.hideConfirm') || 'Ви впевнені, що хочете приховати цього студента? Він зникне зі списку, але дані будуть збережені.')) {
    return
  }

  actionLoadingId.value = relationId
  try {
    await relationsStore.hideRelation(relationId)
    notifySuccess(t('relations.actions.hideSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('relations.actions.hideError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleCreateLesson(relation) {
  const studentId = relation.student?.id
  if (!studentId) return
  const relationId = getRelationId(relation)
  actionLoadingId.value = relationId
  try {
    // BYO instant lesson: створює Lesson + WBSession + IN_PROGRESS і нотифікує учня
    // (notify_lesson_started у QuickLessonView) → тьютор одразу в живому класі, учневі
    // приходить дзвінок. Раніше вело в tutor-calendar?student, який ?student ІГНОРУЄ
    // (читає лише ?booking) → тьютор падав на порожній планувальник (dead-end).
    const res = await lessonsApi.quickStart({ student_id: studentId })
    const body = res?.data ?? res
    const roomUrl = body?.room_url
      || (body?.lesson_id ? `/winterboard/classroom/${body.lesson_id}` : null)
    if (roomUrl) router.push(roomUrl)
    else notifyError(t('dashboard.tutor.cta.createLessonError'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('dashboard.tutor.cta.createLessonError'))
  } finally {
    actionLoadingId.value = null
  }
}

function canOpenChatWithStudent(relation) {
  return relation.status === 'active'
}

async function handleOpenChatWithStudent(relation) {
  const studentId = relation.student?.id
  const relationId = getRelationId(relation)

  if (!studentId || !relationId) {
    notifyError(t('common.error'))
    return
  }

  if (!canOpenChatWithStudent(relation)) {
    notifyWarning(t('relations.actions.acceptError') || 'Контакт ще не активований')
    return
  }

  try {
    await chatThreadsStore.ensureThread(studentId, relationId)
  } catch {
    notifyError(t('common.error'))
    return
  }

  chatModalStudentId.value = studentId
  chatModalRelationId.value = relationId
  chatModalOpen.value = true
}

function closeChatModal() {
  // Скидаємо кеш для цього студента — badge оновиться одразу з store
  // (markThreadRead у ChatModal вже оновив unreadSummary синхронно)
  if (chatModalStudentId.value) {
    unreadCountsCache.value.delete(chatModalStudentId.value)
  }
  chatModalOpen.value = false
  chatModalStudentId.value = null
  chatModalRelationId.value = null
}

function handleLoadMore() {
  relationsStore.loadMoreTutorRelations().catch(() => {})
}

// Unread polling
let unsubUnreadPolling = null
const unreadCountsCache = ref(new Map())

async function fetchAndCacheUnreadCounts() {
  try {
    await chatThreadsStore.fetchUnreadSummary()
    filteredRelations.value.forEach(relation => {
      const studentId = relation.student?.id
      if (studentId) {
        const count = chatThreadsStore.getUnreadCount(studentId)
        const current = unreadCountsCache.value.get(studentId)
        if (current !== count) {
          unreadCountsCache.value.set(studentId, count)
        }
      }
    })
  } catch {
    // Silent fail
  }
}

function getUnreadCountForStudent(relation) {
  const studentId = relation.student?.id
  if (!studentId) return 0
  const cached = unreadCountsCache.value.get(studentId)
  if (cached !== undefined) return cached
  const count = chatThreadsStore.getUnreadCount(studentId)
  unreadCountsCache.value.set(studentId, count)
  return count
}

function startUnreadPolling() {
  unsubUnreadPolling = pollingCoordinator.register({
    id: 'chat-unread-summary',
    fn: fetchAndCacheUnreadCounts,
    interval: 60_000,
    priority: 'low',
    runImmediately: true,
    visibilityAware: true,
  })
}

function stopUnreadPolling() {
  if (unsubUnreadPolling) {
    unsubUnreadPolling()
    unsubUnreadPolling = null
  }
}

watch(() => auth.isAuthenticated, (isAuth) => {
  if (!isAuth) {
    stopUnreadPolling()
  } else if (isAuth && !unsubUnreadPolling) {
    startUnreadPolling()
  }
})

onMounted(() => {
  relationsStore.fetchTutorRelations().catch(() => {})

  if (auth.isAuthenticated) {
    startUnreadPolling()
  }
})

onUnmounted(() => {
  stopUnreadPolling()
})
</script>
