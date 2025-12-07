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
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-foreground">
          {{ $t('profile.activity.eventsTitle') }}
        </h2>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="reload"
        >
          {{ loading ? $t('profile.activity.refreshing') : $t('profile.activity.refresh') }}
        </button>
      </div>

      <div class="mt-4 overflow-hidden rounded-lg border border-border-subtle">
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
                  <pre
                    v-if="expandedEventId === (event.id || event.timestamp)"
                    class="max-h-48 overflow-auto rounded-md bg-surface-muted/60 p-3 text-xs text-muted-foreground"
                  >
{{ formatMetadata(event.metadata) }}
                  </pre>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import { getMyActivity } from '../../../api/activity'
import { formatDateTime } from '../../../utils/datetime'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../../auth/store/authStore'

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

function formatMetadata(metadata) {
  if (!metadata) return '{}'
  try {
    return JSON.stringify(metadata, null, 2)
  } catch (error) {
    return String(metadata)
  }
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
    const params = { limit: PAGE_LIMIT }
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

function goBack() {
  router.push('/dashboard/profile')
}

onMounted(async () => {
  await ensureProfileLoaded()
  await fetchActivity()
})
</script>
