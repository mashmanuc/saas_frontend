<template>
  <div class="container mx-auto max-w-7xl p-6" data-test="tutor-activity-page">
    <h1 class="mb-6 text-2xl font-bold text-body">
      {{ $t('staff.tutorActivity.title') }}
    </h1>

    <!-- Filters -->
    <div class="mb-6 flex gap-4">
      <div class="flex-1">
        <input
          v-model="filters.query"
          type="text"
          :placeholder="$t('staff.tutorActivity.filters.searchPlaceholder')"
          class="w-full rounded-lg border border-default bg-surface px-4 py-2 text-body focus:border-primary focus:outline-none"
          data-test="query-filter"
          @input="debouncedLoadTutors"
        />
      </div>
      <div class="w-48">
        <select
          v-model="filters.status"
          class="w-full rounded-lg border border-default bg-surface px-4 py-2 text-body focus:border-primary focus:outline-none"
          data-test="status-filter"
          @change="loadTutors"
        >
          <option value="">{{ $t('staff.tutorActivity.filters.allStatuses') }}</option>
          <option value="OK">OK</option>
          <option value="WARNING">WARNING</option>
          <option value="RESTRICTED">RESTRICTED</option>
          <option value="EXEMPTED">EXEMPTED</option>
        </select>
      </div>
    </div>

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
              {{ $t('staff.tutorActivity.table.tutor') }}
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.status') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.eligible') }}
            </th>
            <th class="px-4 py-3 text-center text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.responses') }}
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium text-body">
              {{ $t('staff.tutorActivity.table.exemptionReason') }}
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
            <td class="px-4 py-3 text-sm text-body">
              <div class="font-medium">{{ tutor.full_name }}</div>
              <div class="text-xs text-muted">{{ tutor.email }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-body">
              <span class="rounded-full px-2 py-1 text-xs" :class="getStatusClass(tutor.activity_status)">
                {{ tutor.activity_status }}
              </span>
            </td>
            <td class="px-4 py-3 text-center text-sm">
              <span v-if="tutor.eligible" class="text-yellow-600">✓</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="px-4 py-3 text-center text-sm text-body">
              {{ tutor.responses_this_month }}
            </td>
            <td class="px-4 py-3 text-sm text-body">
              <span v-if="tutor.exemption_reason" class="text-purple-600">{{ tutor.exemption_reason }}</span>
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

      <div class="border-t border-default bg-muted px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="text-sm text-muted">
            {{ $t('staff.tutorActivity.pagination.showing', { count: tutors.length, total: totalTutors }) }}
          </div>
          <div class="flex gap-2">
            <button
              @click="previousPage"
              :disabled="pagination.offset === 0"
              class="rounded-lg border border-default px-3 py-1 text-sm text-body hover:bg-muted disabled:opacity-50"
              data-test="prev-page-btn"
            >
              {{ $t('common.previous') }}
            </button>
            <button
              @click="nextPage"
              :disabled="pagination.offset + pagination.limit >= totalTutors"
              class="rounded-lg border border-default px-3 py-1 text-sm text-body hover:bg-muted disabled:opacity-50"
              data-test="next-page-btn"
            >
              {{ $t('common.next') }}
            </button>
          </div>
        </div>
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

const filters = ref({
  query: '',
  status: '',
})

const pagination = ref({
  limit: 50,
  offset: 0,
})

const isModalOpen = ref(false)
const selectedTutor = ref<TutorActivityListItem | null>(null)

async function loadTutors() {
  loading.value = true
  error.value = ''

  try {
    const params: any = {
      limit: pagination.value.limit,
      offset: pagination.value.offset,
    }
    
    if (filters.value.query) {
      params.query = filters.value.query
    }
    
    if (filters.value.status) {
      params.status = filters.value.status
    }
    
    const response = await staffApi.getTutorActivityList(params)
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

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoadTutors() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagination.value.offset = 0
    loadTutors()
  }, 300)
}

function previousPage() {
  if (pagination.value.offset > 0) {
    pagination.value.offset = Math.max(0, pagination.value.offset - pagination.value.limit)
    loadTutors()
  }
}

function nextPage() {
  if (pagination.value.offset + pagination.value.limit < totalTutors.value) {
    pagination.value.offset += pagination.value.limit
    loadTutors()
  }
}

function getStatusClass(status: string): string {
  if (status === 'OK') return 'bg-green-100 text-green-800'
  if (status === 'WARNING') return 'bg-yellow-100 text-yellow-800'
  if (status === 'RESTRICTED') return 'bg-red-100 text-red-800'
  if (status === 'EXEMPTED') return 'bg-purple-100 text-purple-800'
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
