<template>
  <div class="space-y-6">
    <Card class="space-y-4">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold">{{ $t('dashboard.tutor.title') }}</h1>
        <p class="text-gray-500 text-sm dark:text-gray-400">
          {{ $t('dashboard.tutor.description') }}
        </p>
      </header>

      <div class="rounded-lg border border-border-subtle bg-surface-muted/30 p-4">
        <p class="text-sm text-gray-500 dark:text-gray-300">
          {{ $t('dashboard.nextLessonAt') }}:
          <span v-if="nextLessonAt" class="font-medium text-foreground">
            {{ formatDateTime(nextLessonAt, userTimezone) }}
          </span>
          <span v-else class="font-medium text-foreground">{{ $t('dashboard.tutor.nextLessonFallback') }}</span>
        </p>
      </div>
    </Card>

    <Card class="space-y-4">
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ $t('dashboard.tutor.studentsTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('dashboard.tutor.studentsDescription') }}
            </p>
          </div>
          <span v-if="isLoading" class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('loader.loading') }}
          </span>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>

      <ul
        v-if="students.length"
        class="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden"
      >
        <li
          v-for="relation in students"
          :key="relation.id"
          class="flex flex-wrap items-center justify-between gap-4 bg-surface-muted/40 p-4"
        >
          <div>
            <p class="font-medium text-base text-foreground">{{ getStudentName(relation.student) }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-300">{{ relation.student?.email }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('dashboard.tutor.timezoneLabel') }}
              <span class="font-medium">
                {{ relation.student?.timezone || $t('dashboard.tutor.timezoneUnknown') }}
              </span>
            </p>
          </div>

          <span class="text-xs font-semibold px-3 py-1 rounded-full" :class="statusClass(relation.status)">
            {{ statusLabels[relation.status] || relation.status }}
          </span>
        </li>
      </ul>

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('dashboard.tutor.empty') }}
      </p>
    </Card>

    <Card class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">{{ $t('tutor.requests') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            <!-- короткий опис можна додати пізніше -->
          </p>
        </div>
        <span v-if="isLoading" class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('loader.loading') }}
        </span>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <ul
        v-if="invitedStudents.length"
        class="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden"
      >
        <li
          v-for="relation in invitedStudents"
          :key="relation.id"
          class="flex flex-wrap items-center justify-between gap-4 bg-surface-muted/40 p-4"
        >
          <div>
            <p class="font-medium text-base text-foreground">{{ getStudentName(relation.student) }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-300">{{ relation.student?.email }}</p>
            <p v-if="relation.notes" class="text-xs text-gray-500 dark:text-gray-400">
              {{ relation.notes }}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            :disabled="acceptLoadingId === relation.id"
            :loading="acceptLoadingId === relation.id"
            @click="acceptRequest(relation.id)"
          >
            {{ acceptLoadingId === relation.id ? $t('loader.loading') : ($t('common.accept') || 'Підтвердити') }}
          </Button>
        </li>
      </ul>

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('dashboard.tutor.empty') }}
      </p>
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
import apiClient from '../../../utils/apiClient'
import { notifySuccess, notifyError } from '../../../utils/notify'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const { t } = useI18n()

const students = computed(() => dashboard.tutorStudents)
const nextLessonAt = computed(() => dashboard.nextLessonAt)
const isLoading = computed(() => dashboard.loading)
const error = computed(() => dashboard.error)
const userTimezone = computed(() => auth.user?.timezone)

const activeStudents = computed(() => students.value.filter((rel) => rel.status === 'active'))
const invitedStudents = computed(() => students.value.filter((rel) => rel.status === 'invited'))
const acceptLoadingId = ref(null)

const statusLabels = computed(() => ({
  pending: t('dashboard.tutor.status.pending'),
  active: t('dashboard.tutor.status.active'),
  inactive: t('dashboard.tutor.status.inactive'),
}))

function getStudentName(student) {
  if (!student) return '—'
  const { first_name: firstName, last_name: lastName, email } = student
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || email || '—'
}

function statusClass(status) {
  const base = 'border'
  const map = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  }
  return `${base} ${map[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`
}

async function acceptRequest(relationId) {
  acceptLoadingId.value = relationId
  try {
    await apiClient.post('/tutor/accept_request/', { relation_id: relationId })
    await dashboard.fetchTutorStudents().catch(() => {})
    notifySuccess(t('tutor.request.accepted') || 'Запит підтверджено')
  } catch (error) {
    notifyError(t('tutor.request.acceptError') || 'Не вдалося підтвердити запит')
  } finally {
    acceptLoadingId.value = null
  }
}

onMounted(() => {
  dashboard.fetchTutorStudents().catch(() => {})
})
</script>
