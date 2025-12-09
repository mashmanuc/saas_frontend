<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('profile.activity.title') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.activity.subtitle') }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          @click="goBack"
        >
          {{ $t('profile.actions.cancel') }}
        </button>
      </div>
    </Card>

    <Card v-if="errorMessage" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </Card>

    <Card>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-foreground">
            {{ $t('profile.activity.eventsTitle') }}
          </h2>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="reload"
            >
              {{ loading ? $t('profile.activity.refreshing') : $t('profile.activity.refresh') }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-3 rounded-lg bg-surface-muted/40 p-3 md:flex-row md:flex-wrap">
          <Select
            v-model="filters.action"
            :options="actionOptions"
            value-key="value"
            label-key="label"
            class="w-full md:w-48"
            :placeholder="$t('profile.activity.filters.action')"
          />
          <Select
            v-model="filters.entity_type"
            :options="entityOptions"
            value-key="value"
            label-key="label"
            class="w-full md:w-48"
            :placeholder="$t('profile.activity.filters.entity')"
          />
          <Input
            v-model="filters.date_from"
            type="date"
            class="w-full md:w-44"
            :placeholder="$t('profile.activity.filters.dateFrom')"
          />
          <Input
            v-model="filters.date_to"
            type="date"
            class="w-full md:w-44"
            :placeholder="$t('profile.activity.filters.dateTo')"
          />
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            :class="{'w-full': true, 'md:w-auto': true}"
            :disabled="loading"
            @click="applyFilters"
          >
            {{ $t('profile.activity.filters.apply') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            :class="{'w-full': true, 'md:w-auto': true}"
            :disabled="loading"
            @click="resetFilters"
          >
            {{ $t('profile.activity.filters.reset') }}
          </button>
        </div>
      </div>

      <div class="mt-4 hidden overflow-hidden rounded-lg border border-border-subtle md:block">
        <table class="min-w-full divide-y divide-border-subtle text-sm">
          <thead class="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-2 text-left">{{ $t('profile.activity.columns.action') }}</th>
              <th scope="col" class="px-4 py-2 text-left">{{ $t('profile.activity.columns.timestamp') }}</th>
              <th scope="col" class="px-4 py-2 text-left">{{ $t('profile.activity.columns.metadata') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle bg-card text-foreground">
            <tr v-for="event in events" :key="event.id || event.timestamp">
              <td class="px-4 py-3 font-medium">
                {{ event.action || '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                {{ formatTimestamp(event.timestamp || event.created_at) }}
              </td>
              <td class="px-4 py-3">
                <div class="space-y-2">
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    @click="toggleMetadata(event)"
                  >
                    {{ expandedEventId === (event.id || event.timestamp) ? $t('profile.activity.hideMetadata') : $t('profile.activity.showMetadata') }}
                  </button>
                  <div v-if="expandedEventId === (event.id || event.timestamp)" class="rounded-lg border border-border-subtle bg-surface-muted/60 p-3">
                    <ActivityMetadataTree :data="event.metadata" />
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !events.length">
              <td class="px-4 py-6 text-center text-sm text-muted-foreground" colspan="3">
                {{ $t('profile.activity.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 space-y-3 md:hidden">
        <div
          v-for="event in events"
          :key="event.id || event.timestamp"
          class="rounded-xl border border-border-subtle bg-card/70 p-4 shadow-sm"
        >
          <div class="space-y-2">
            <div>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">{{ $t('profile.activity.columns.action') }}</p>
              <p class="text-base font-semibold text-foreground">{{ event.action || '—' }}</p>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{{ formatTimestamp(event.timestamp || event.created_at) }}</span>
              <span v-if="event.entity_type" class="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {{ event.entity_type }}
              </span>
            </div>
            <div class="space-y-2">
              <button
                type="button"
                class="text-xs font-semibold text-primary hover:underline"
                @click="toggleMetadata(event)"
              >
                {{ expandedEventId === (event.id || event.timestamp) ? $t('profile.activity.hideMetadata') : $t('profile.activity.showMetadata') }}
              </button>
              <div v-if="expandedEventId === (event.id || event.timestamp)" class="rounded-lg border border-border-subtle bg-surface-muted/60 p-3">
                <ActivityMetadataTree :data="event.metadata" />
              </div>
            </div>
          </div>
        </div>
        <div v-if="!loading && !events.length" class="rounded-lg border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          {{ $t('profile.activity.empty') }}
        </div>
      </div>

      <div class="mt-4 flex justify-center">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-border-subtle px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !hasMore"
          @click="loadMore"
        >
          <span v-if="loading">{{ $t('profile.activity.loading') }}</span>
          <span v-else-if="hasMore">{{ $t('profile.activity.loadMore') }}</span>
          <span v-else>{{ $t('profile.activity.endOfLog') }}</span>
        </button>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import Input from '../../../ui/Input.vue'
import Select from '../../../ui/Select.vue'
import { getMyActivity } from '../../../api/activity'
import { formatDateTime } from '../../../utils/datetime'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../../auth/store/authStore'
import ActivityMetadataTree from '../components/ActivityMetadataTree.vue'

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()

const events = ref([])
const loading = ref(false)
const errorMessage = ref('')
const hasMore = ref(false)
const paginationCursor = ref(null)
const expandedEventId = ref(null)
const PAGE_LIMIT = 20

const filters = reactive({
  action: null,
  entity_type: null,
  date_from: '',
  date_to: '',
})

const actionOptions = [
  { label: 'Усі дії', value: null },
  { label: 'marketplace.search', value: 'marketplace.search' },
  { label: 'marketplace.filter.applied', value: 'marketplace.filter.applied' },
  { label: 'marketplace.sort.changed', value: 'marketplace.sort.changed' },
  { label: 'profile.viewed', value: 'profile.viewed' },
  { label: 'ui.click', value: 'ui.click' },
]

const entityOptions = [
  { label: 'Будь-яка сутність', value: null },
  { label: 'marketplace', value: 'marketplace' },
  { label: 'profile', value: 'profile' },
  { label: 'classroom', value: 'classroom' },
]

const isAuthenticated = computed(() => authStore.isAuthenticated)

async function ensureProfileLoaded() {
  if (!isAuthenticated.value) return
  if (profileStore.initialized || profileStore.loading) return
  try {
    await profileStore.loadProfile()
  } catch (error) {
    console.error('Failed to load profile', error)
  }
}

function formatTimestamp(value) {
  if (!value) return '—'
  return formatDateTime(value)
}

function toggleMetadata(event) {
  const key = event.id || event.timestamp
  expandedEventId.value = expandedEventId.value === key ? null : key
}

async function fetchActivity({ append = false } = {}) {
  if (!isAuthenticated.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const params = {
      limit: PAGE_LIMIT,
      action: filters.action || undefined,
      entity_type: filters.entity_type || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }
    if (append && paginationCursor.value) {
      params.before = paginationCursor.value
    }
    const response = await getMyActivity(params)
    const normalized = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : []
    if (append) {
      events.value = [...events.value, ...normalized]
    } else {
      events.value = normalized
    }
    const lastItem = normalized[normalized.length - 1]
    paginationCursor.value = response?.next_before || lastItem?.id || lastItem?.timestamp || lastItem?.created_at || null
    const reportedHasMore = Boolean(response?.next_before || response?.next)
    hasMore.value = reportedHasMore || (normalized.length === PAGE_LIMIT)
  } catch (error) {
    console.error('Failed to load activity', error)
    errorMessage.value = error?.response?.data?.detail || 'Не вдалося завантажити активність користувача.'
  } finally {
    loading.value = false
  }
}

function reload() {
  paginationCursor.value = null
  fetchActivity({ append: false })
}

function loadMore() {
  if (!hasMore.value) return
  fetchActivity({ append: true })
}

function applyFilters() {
  paginationCursor.value = null
  fetchActivity()
}

function resetFilters() {
  filters.action = null
  filters.entity_type = null
  filters.date_from = ''
  filters.date_to = ''
  applyFilters()
}

function goBack() {
  router.push('/dashboard/profile')
}

onMounted(async () => {
  await ensureProfileLoaded()
  await fetchActivity()
})
</script>
