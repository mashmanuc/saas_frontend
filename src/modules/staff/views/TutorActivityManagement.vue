<template>
  <div class="container mx-auto max-w-7xl p-6" data-test="tutor-activity-page">
    <h1 class="mb-6 text-2xl font-bold text-body">
      {{ $t('staff.tutorActivity.title') }}
    </h1>

    <div v-if="loading && !tutors.length" class="py-12 text-center" data-test="loading-state">
      <p class="text-muted">{{ $t('staff.tutorActivity.loading') }}</p>
    </div>

    <div v-else-if="error" class="rounded-lg bg-red-50 p-6 text-center" data-test="error-state">
      <p class="text-red-600">{{ error }}</p>
      <button
        @click="loadTutors"
        class="mt-4 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-dark"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else-if="tutors.length" class="overflow-x-auto rounded-lg border border-default" data-test="tutors-table-container">
      <table class="w-full" data-test="tutors-table">
        <thead class="bg-muted">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.tutorId') }}
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.email') }}
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.plan') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.activityRequired') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.activityCount') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.meetsRequirement') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.hasExemption') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tutor in tutors"
            :key="tutor.tutor_id"
            class="border-t border-default hover:bg-muted"
            :data-test="`tutor-row-${tutor.tutor_id}`"
          >
            <td class="px-4 py-3 text-sm text-body">{{ tutor.tutor_id }}</td>
            <td class="px-4 py-3 text-sm text-body">{{ tutor.email }}</td>
            <td class="px-4 py-3 text-sm text-body">
              <span class="rounded-full px-2 py-1 text-xs" :class="getPlanClass(tutor.plan_code)">
                {{ tutor.plan_code }}
              </span>
            </td>
            <td class="px-4 py-3 text-center text-sm">
              <span v-if="tutor.activity_required" class="text-yellow-600">✓</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="px-4 py-3 text-center text-sm text-body">
              {{ tutor.activity_count }} / {{ tutor.required_count }}
            </td>
            <td class="px-4 py-3 text-center text-sm">
              <span v-if="tutor.meets_requirement" class="text-green-600">✓</span>
              <span v-else class="text-red-600">✗</span>
            </td>
            <td class="px-4 py-3 text-center text-sm">
              <span v-if="tutor.has_exemption" class="text-purple-600">✓</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="px-4 py-3 text-center">
              <button
                @click="openGrantModal(tutor)"
                class="rounded-lg bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
                :data-test="`grant-exemption-btn-${tutor.tutor_id}`"
              >
                {{ $t('staff.tutorActivity.table.grantExemption') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="border-t border-default bg-muted px-4 py-3 text-sm text-muted">
        {{ $t('staff.tutorActivity.pagination.showing', { count: tutors.length, total: totalTutors }) }}
      </div>
    </div>

    <div v-else class="py-12 text-center" data-test="tutors-empty">
      <p class="text-muted">{{ $t('staff.tutorActivity.empty') }}</p>
    </div>

    <GrantExemptionModal
      :is-open="isModalOpen"
      :tutor="selectedTutor"
      @close="closeGrantModal"
      @success="handleGrantSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffApi from '../api/staffApi'
import type { TutorActivityListItem } from '../api/staffApi'
import GrantExemptionModal from '../components/GrantExemptionModal.vue'

const { t } = useI18n()

const tutors = ref<TutorActivityListItem[]>([])
const totalTutors = ref(0)
const loading = ref(false)
const error = ref('')

const isModalOpen = ref(false)
const selectedTutor = ref<TutorActivityListItem | null>(null)

async function loadTutors() {
  loading.value = true
  error.value = ''

  try {
    const response = await staffApi.getTutorActivityList()
    tutors.value = response.results
    totalTutors.value = response.count
  } catch (err: any) {
    if (err.response?.status === 401) {
      error.value = t('staff.tutorActivity.errors.unauthorized')
    } else if (err.response?.status === 403) {
      error.value = t('staff.tutorActivity.errors.forbidden')
    } else {
      error.value = t('staff.tutorActivity.errors.loadFailed')
    }
  } finally {
    loading.value = false
  }
}

function getPlanClass(plan: string): string {
  if (plan === 'FREE') return 'bg-blue-100 text-blue-800'
  if (plan === 'PRO') return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-800'
}

function openGrantModal(tutor: TutorActivityListItem) {
  selectedTutor.value = tutor
  isModalOpen.value = true
}

function closeGrantModal() {
  isModalOpen.value = false
  selectedTutor.value = null
}

async function handleGrantSuccess() {
  await loadTutors()
}

onMounted(() => {
  loadTutors()
})
</script>
