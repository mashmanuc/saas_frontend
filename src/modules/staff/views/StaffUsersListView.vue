<template>
  <div class="staff-users-list" data-testid="staff-users-list">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.users.title') }}</h1>
      <p class="help-text">{{ $t('staff.users.helpText') }}</p>
    </div>

    <!-- 2026-09-26: хто онлайн просто зараз — щоб пушити, коли нікого немає -->
    <PresenceNowPanel />

    <!-- Filters -->
    <Card class="filters-card">
      <div class="filters-row">
        <div class="search-field">
          <Input
            v-model="searchQuery"
            :placeholder="$t('staff.users.searchPlaceholder')"
            @input="debouncedSearch"
          />
        </div>
        <!-- 2026-09-26: БУЛО <option> у слоті — ui/Select його не малює (лише проп
             `options`), тож обидва списки були без жодного пункту. -->
        <Select
          v-model="roleFilter"
          class="role-filter"
          :placeholder="$t('staff.users.allRoles')"
          :options="roleOptions"
        />
        <Select
          v-model="activeFilter"
          class="active-filter"
          :placeholder="$t('staff.users.allStatuses')"
          :options="activeOptions"
        />
      </div>
    </Card>

    <!-- Results -->
    <Card>
      <div v-if="loading" class="loading-state">
        <LoadingSpinner />
      </div>

      <div v-else-if="error" class="error-state">
        <p class="text-danger">{{ error }}</p>
      </div>

      <div v-else-if="users.length === 0" class="empty-state">
        <EmptyState :message="$t('staff.users.noResults')" />
      </div>

      <div v-else>
        <table class="users-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ $t('staff.users.name') }}</th>
              <th>{{ $t('staff.users.email') }}</th>
              <th>{{ $t('staff.users.role') }}</th>
              <th>{{ $t('staff.users.bans') }}</th>
              <!-- 2026-09-26: «Скарги» сховано — у v1 скарг не буває -->
              <th v-if="REPORTS_VISIBLE">{{ $t('staff.users.reports') }}</th>
              <th>{{ $t('staff.users.plan') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(user, i) in users"
              :key="user.id"
              class="user-row"
              @click="goToUser(user.id)"
            >
              <td class="cell-num">{{ offset + i + 1 }}</td>
              <td class="cell-name">
                <span class="user-name">{{ user.first_name }} {{ user.last_name }}</span>
                <Badge v-if="!user.is_active" variant="muted" size="sm">{{ $t('staff.users.inactive') }}</Badge>
              </td>
              <td class="cell-email">{{ user.email }}</td>
              <td>
                <Badge :variant="roleBadgeVariant(user.role)" size="sm">{{ roleLabel(user.role) }}</Badge>
              </td>
              <td>
                <Badge v-if="user.has_active_ban" variant="danger" size="sm">{{ $t('staff.users.banned') }}</Badge>
                <span v-else class="text-muted">—</span>
              </td>
              <td v-if="REPORTS_VISIBLE">
                <span :class="{ 'text-danger': user.open_reports_count > 0 }">
                  {{ user.open_reports_count }}
                </span>
              </td>
              <td>
                <Badge v-if="user.subscription_plan" variant="accent" size="sm">
                  {{ user.subscription_plan }}
                </Badge>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="pagination-row">
          <Button
            variant="ghost"
            size="sm"
            :disabled="offset === 0"
            @click="prevPage"
          >
            ← {{ $t('common.prev') }}
          </Button>
          <span class="pagination-info">
            {{ offset + 1 }}–{{ Math.min(offset + pageSize, totalCount) }}
            {{ $t('common.of') }} {{ totalCount }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            :disabled="offset + pageSize >= totalCount"
            @click="nextPage"
          >
            {{ $t('common.next') }} →
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'
import Card from '@/ui/Card.vue'
import Input from '@/ui/Input.vue'
import Select from '@/ui/Select.vue'
import Badge from '@/ui/Badge.vue'
import Button from '@/ui/Button.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import EmptyState from '@/ui/EmptyState.vue'
import PresenceNowPanel from '@/modules/staff/components/PresenceNowPanel.vue'

const router = useRouter()
const route = useRoute()
const { t, te } = useI18n()

// Початкові фільтри з адреси: дашборд веде сюди з ?role=tutor і ?q=… («Показати всіх»).
const searchQuery = ref(String(route.query.q ?? ''))
const roleFilter = ref(String(route.query.role ?? ''))
const REPORTS_VISIBLE = false

function roleLabel(role: string): string {
  const key = `staff.roles.${String(role || '').toLowerCase()}`
  return te(key) ? t(key) : role
}
const roleOptions = computed(() =>
  ['student', 'tutor', 'admin', 'superadmin'].map(value => ({ value, label: roleLabel(value) }))
)
const activeOptions = computed(() => [
  { value: 'true', label: t('staff.users.active') },
  { value: 'false', label: t('staff.users.inactive') },
])
const activeFilter = ref('')
const users = ref<any[]>([])
const totalCount = ref(0)
const loading = ref(false)
const error = ref('')
const offset = ref(0)
const pageSize = 20

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    offset.value = 0
    fetchUsers()
  }, 300)
}

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = {
      limit: pageSize,
      offset: offset.value,
    }
    if (searchQuery.value) params.q = searchQuery.value
    if (roleFilter.value) params.role = roleFilter.value
    if (activeFilter.value) params.is_active = activeFilter.value

    const res = await apiClient.get('/v1/staff/users/search/', {
      params,
      meta: { skipLoader: true },
    } as any)
    users.value = res.results || []
    totalCount.value = res.count || 0
  } catch (e: any) {
    error.value = e?.message || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function goToUser(id: number) {
  router.push(`/staff/users/${id}`)
}

function roleBadgeVariant(role: string) {
  if (role === 'tutor') return 'accent'
  if (role === 'student') return 'default'
  if (role === 'admin' || role === 'superadmin') return 'warning'
  return 'muted'
}

function prevPage() {
  offset.value = Math.max(0, offset.value - pageSize)
  fetchUsers()
}

function nextPage() {
  offset.value += pageSize
  fetchUsers()
}

watch([roleFilter, activeFilter], () => {
  offset.value = 0
  fetchUsers()
})

onMounted(fetchUsers)
</script>

<style scoped>
.staff-users-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0 0;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.filters-card {
  padding: var(--space-md);
}

.filters-row {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  min-width: 200px;
}

.role-filter,
.active-filter {
  width: 160px;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.users-table td {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.user-row {
  cursor: pointer;
  transition: background var(--transition-base);
}

.user-row:hover {
  background: var(--bg-secondary);
}

.cell-name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.user-name {
  font-weight: 500;
}

.cell-email {
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-secondary);
  opacity: 0.6;
}

.text-danger {
  color: var(--danger-bg, #ef4444);
  font-weight: 600;
}

.loading-state,
.error-state,
.empty-state {
  padding: var(--space-xl);
  text-align: center;
}

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-md) 0 0;
}

.pagination-info {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .filters-row {
    flex-direction: column;
  }

  .role-filter,
  .active-filter {
    width: 100%;
  }

  .users-table {
    font-size: var(--text-xs);
  }

  .users-table th,
  .users-table td {
    padding: var(--space-xs);
  }
}
</style>
