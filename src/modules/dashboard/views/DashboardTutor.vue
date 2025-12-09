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
    </Card>

    <Card class="space-y-4">
      <div class="flex items-center justify-between">
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
            class="px-3 py-1 transition"
            :class="tutorFilter === tab.value ? 'bg-accent text-white' : 'text-muted'"
            @click="setFilter(tab.value)"
          >
            {{ $t(tab.label) }}
          </button>
        </div>
      </div>

      <div v-if="relationsLoading" class="text-sm text-muted">{{ $t('loader.loading') }}</div>
      <p v-else-if="relationsError" class="text-sm text-danger">{{ relationsError }}</p>
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

        <ul
          v-if="filteredRelations.length"
          class="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden"
        >
          <li
            v-for="relation in filteredRelations"
            :key="relation.relation_id || relation.id"
            class="flex flex-wrap items-center justify-between gap-4 bg-surface-soft p-4"
          >
            <div>
              <p class="font-medium text-base text-body">{{ getStudentName(relation.student) }}</p>
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

            <div class="flex flex-wrap gap-3 items-center">
              <span class="text-xs font-semibold px-3 py-1 rounded-full border border-default text-muted">
                {{ statusLabels[relation.status] || relation.status }}
              </span>
              <template v-if="relation.status === 'invited'">
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="actionLoadingId === relation.relation_id"
                  :loading="actionLoadingId === relation.relation_id"
                  @click="handleAccept(relation.relation_id)"
                >
                  {{ $t('common.accept') }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="actionLoadingId === relation.relation_id"
                  @click="handleDecline(relation.relation_id)"
                >
                  {{ $t('common.decline') }}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="resendLoadingId === relation.relation_id"
                  :loading="resendLoadingId === relation.relation_id"
                  @click="handleResend(relation.relation_id)"
                >
                  {{ $t('tutor.actions.resend') }}
                </Button>
              </template>
            </div>
          </li>
        </ul>

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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import { formatDateTime } from '../../../utils/datetime'
import { useAuthStore } from '../../auth/store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useRelationsStore } from '../../../stores/relationsStore'
import { notifySuccess, notifyError } from '../../../utils/notify'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const relationsStore = useRelationsStore()
const { t } = useI18n()

const nextLessonAt = computed(() => dashboard.nextLessonAt)
const userTimezone = computed(() => auth.user?.timezone)
const relationsLoading = computed(() => relationsStore.tutorLoading)
const relationsError = computed(() => relationsStore.tutorError)
const filteredRelations = computed(() => relationsStore.filteredTutorRelations)
const tutorFilter = computed(() => relationsStore.tutorFilter)

const actionLoadingId = ref(null)
const resendLoadingId = ref(null)

const tabs = [
  { value: 'all', label: 'dashboard.tutor.tabs.all' },
  { value: 'invited', label: 'dashboard.tutor.tabs.invited' },
  { value: 'active', label: 'dashboard.tutor.tabs.active' },
]

const statusLabels = computed(() => ({
  pending: t('dashboard.tutor.status.pending'),
  active: t('dashboard.tutor.status.active'),
  inactive: t('dashboard.tutor.status.inactive'),
  invited: t('dashboard.tutor.status.invited'),
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
  const { first_name: firstName, last_name: lastName, email } = student
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || email || '—'
}

function setFilter(value) {
  relationsStore.setTutorFilter(value)
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

onMounted(() => {
  dashboard.fetchTutorStudents().catch(() => {})
  relationsStore.fetchTutorRelations().catch(() => {})
})
</script>
