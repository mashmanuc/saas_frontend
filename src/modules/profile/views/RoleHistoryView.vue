<template>
  <div class="space-y-6">
    <Card>
      <div class="flex items-start justify-between">
        <div>
          <Heading :level="1">
            {{ $t('users.roleHistory.title') }}
          </Heading>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ $t('users.roleHistory.description', { userName: userName }) }}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          @click="handleBack"
        >
          {{ $t('ui.back') }}
        </Button>
      </div>
    </Card>

    <Card v-if="loading" class="flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p class="text-sm text-muted-foreground">
          {{ $t('ui.loading') }}
        </p>
      </div>
    </Card>

    <Card v-else-if="error" class="border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </Card>

    <Card v-else-if="history.length === 0" class="flex flex-col items-center justify-center py-12">
      <p class="text-sm text-muted-foreground">
        {{ $t('users.roleHistory.empty') }}
      </p>
    </Card>

    <Card v-else class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-border bg-surface-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t('users.roleHistory.date') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t('users.roleHistory.oldRole') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t('users.roleHistory.newRole') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t('users.roleHistory.changedBy') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {{ $t('users.roleHistory.reason') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="entry in paginatedHistory"
              :key="entry.id"
              class="hover:bg-surface-muted/30"
            >
              <td class="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                {{ formatDate(entry.changed_at) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span class="inline-flex rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {{ entry.old_role }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span class="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {{ entry.new_role }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                {{ entry.changed_by }}
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">
                {{ entry.reason || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-border px-4 py-3">
        <div class="text-sm text-muted-foreground">
          {{ $t('users.roleHistory.showing', { 
            from: (currentPage - 1) * pageSize + 1, 
            to: Math.min(currentPage * pageSize, history.length),
            total: history.length 
          }) }}
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            {{ $t('ui.previous') }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            {{ $t('ui.next') }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import Button from '@/ui/Button.vue'
import { getRoleHistory, type RoleHistoryEntry } from '@/api/users'
import { notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const route = useRoute()
const router = useRouter()

const userId = computed(() => route.params.userId as string)
const userName = computed(() => route.query.userName as string || userId.value)

const history = ref<RoleHistoryEntry[]>([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const pageSize = 10

const totalPages = computed(() => Math.ceil(history.value.length / pageSize))

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return history.value.slice(start, end)
})

onMounted(async () => {
  await loadHistory()
})

async function loadHistory() {
  loading.value = true
  error.value = ''

  try {
    history.value = await getRoleHistory(userId.value)
  } catch (err: any) {
    error.value = err?.response?.data?.detail || i18n.global.t('users.roleHistory.loadError')
    notifyError(error.value)
  } finally {
    loading.value = false
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function handleBack() {
  router.back()
}
</script>
