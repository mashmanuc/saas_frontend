<template>
  <div class="staff-dashboard" data-testid="staff-dashboard">
    <div class="dashboard-header">
      <h1 class="dashboard-title">{{ $t('staff.dashboard.title') }}</h1>
    </div>

    <!-- KPI Stat Cards -->
    <div class="stat-cards-row">
      <StatCard
        icon="👥"
        :value="stats?.users?.total"
        :label="$t('staff.dashboard.users')"
        :trend="stats?.users?.new_7d ? `${stats.users.new_7d} / 7d` : undefined"
        color="accent"
        to="/staff/users"
        :loading="loading"
      />
      <StatCard
        icon="💳"
        :value="stats?.billing?.active_subscriptions"
        :label="$t('staff.dashboard.subscriptions')"
        color="success"
        to="/staff/billing"
        :loading="loading"
      />
      <StatCard
        icon="🚩"
        :value="stats?.trust?.open_reports"
        :label="$t('staff.dashboard.openReports')"
        :color="(stats?.trust?.open_reports ?? 0) > 0 ? 'danger' : 'default'"
        to="/staff/reports"
        :loading="loading"
      />
      <StatCard
        icon="📋"
        :value="stats?.activity?.active_tutors"
        :label="$t('staff.dashboard.activeTutors')"
        :trend="stats?.activity?.inactive_tutors ? `${stats.activity.inactive_tutors} inactive` : undefined"
        to="/staff/tutor-activity"
        :loading="loading"
      />
    </div>

    <!-- Quick sections grid -->
    <div class="sections-grid">
      <!-- Quick Search -->
      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.dashboard.quickSearch') }}</h2>
        <div class="search-box">
          <Input
            v-model="searchQuery"
            :placeholder="$t('staff.dashboard.searchPlaceholder')"
            @input="debouncedSearch"
          />
        </div>
        <div v-if="searchResults.length > 0" class="search-results">
          <router-link
            v-for="u in searchResults"
            :key="u.id"
            :to="`/staff/users/${u.id}`"
            class="search-result-item"
          >
            <div class="result-name">{{ u.first_name }} {{ u.last_name }}</div>
            <div class="result-meta">
              <span class="result-email">{{ u.email }}</span>
              <Badge :variant="u.role === 'tutor' ? 'accent' : 'muted'" size="sm">{{ u.role }}</Badge>
            </div>
          </router-link>
          <router-link
            v-if="searchTotal > searchResults.length"
            :to="{ name: 'staff-users', query: { q: searchQuery } }"
            class="search-show-all"
          >
            {{ $t('staff.dashboard.showAll') }} ({{ searchTotal }})
          </router-link>
        </div>
        <div v-else-if="searchQuery && !searchLoading" class="search-empty">
          {{ $t('staff.dashboard.noResults') }}
        </div>
      </Card>

      <!-- Quick Links -->
      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.dashboard.quickActions') }}</h2>
        <div class="quick-links">
          <router-link to="/staff/reports" class="quick-link">
            <span class="ql-icon">🚩</span>
            <span>{{ $t('staff.sidebar.reports') }}</span>
          </router-link>
          <router-link to="/staff/tutor-activity" class="quick-link">
            <span class="ql-icon">📋</span>
            <span>{{ $t('staff.sidebar.tutorActivity') }}</span>
          </router-link>
          <router-link to="/staff/billing" class="quick-link">
            <span class="ql-icon">💳</span>
            <span>{{ $t('staff.sidebar.billing') }}</span>
          </router-link>
          <router-link to="/staff/health" class="quick-link">
            <span class="ql-icon">🩺</span>
            <span>{{ $t('staff.sidebar.health') }}</span>
          </router-link>
          <router-link to="/staff/users" class="quick-link">
            <span class="ql-icon">👥</span>
            <span>{{ $t('staff.sidebar.users') }}</span>
          </router-link>
        </div>
      </Card>

      <!-- Pending Billing -->
      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.dashboard.pendingBilling') }}</h2>
        <div v-if="loading" class="section-loading">
          <LoadingSpinner />
        </div>
        <div v-else-if="(stats?.billing?.pending_sessions ?? 0) === 0" class="section-empty">
          {{ $t('staff.dashboard.noPending') }}
        </div>
        <div v-else class="pending-count">
          <span class="pending-value">{{ stats.billing.pending_sessions }}</span>
          <span class="pending-label">{{ $t('staff.dashboard.stuckSessions') }}</span>
          <router-link to="/staff/billing" class="pending-link">
            {{ $t('staff.dashboard.viewAll') }} →
          </router-link>
        </div>
      </Card>

      <!-- Recent Activity Feed -->
      <Card class="section-card section-card-wide">
        <h2 class="section-title">{{ $t('staff.dashboard.recentActivity') }}</h2>
        <RecentActivityFeed />
      </Card>

      <!-- System Health mini -->
      <Card class="section-card">
        <h2 class="section-title">{{ $t('staff.dashboard.systemHealth') }}</h2>
        <div v-if="loading" class="section-loading">
          <LoadingSpinner />
        </div>
        <div v-else class="health-mini">
          <div class="health-item">
            <span class="health-dot" :class="(stats?.trust?.suspicious_open ?? 0) > 0 ? 'yellow' : 'green'" />
            <span>{{ $t('staff.dashboard.suspicious') }}: {{ stats?.trust?.suspicious_open ?? 0 }}</span>
          </div>
          <div class="health-item">
            <span class="health-dot" :class="(stats?.trust?.active_bans ?? 0) > 5 ? 'yellow' : 'green'" />
            <span>{{ $t('staff.dashboard.bans') }}: {{ stats?.trust?.active_bans ?? 0 }}</span>
          </div>
          <div class="health-item">
            <span class="health-dot green" />
            <span>{{ $t('staff.dashboard.exempted') }}: {{ stats?.activity?.exempted_tutors ?? 0 }}</span>
          </div>
          <router-link to="/staff/health" class="pending-link">
            {{ $t('staff.dashboard.viewAll') }} →
          </router-link>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStaffStats } from '../composables/useStaffStats'
import apiClient from '@/utils/apiClient'
import StatCard from '../components/StatCard.vue'
import RecentActivityFeed from '../components/RecentActivityFeed.vue'
import Card from '@/ui/Card.vue'
import Input from '@/ui/Input.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { stats, loading } = useStaffStats()

// Quick search
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searchTotal = ref(0)
const searchLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searchTotal.value = 0
    return
  }
  debounceTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  searchLoading.value = true
  try {
    const res = await apiClient.get('/v1/staff/users/search/', {
      params: { q: searchQuery.value, limit: 6 },
      meta: { skipLoader: true },
    } as any)
    searchResults.value = res.results || []
    searchTotal.value = res.count || 0
  } catch {
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}
</script>

<style scoped>
.staff-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.dashboard-header {
  margin-bottom: 0;
}

.dashboard-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.stat-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.sections-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.section-card {
  padding: var(--space-lg);
}

.section-card-wide {
  grid-column: 1 / -1;
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md);
}

.search-box {
  margin-bottom: var(--space-sm);
}

.search-results {
  display: flex;
  flex-direction: column;
}

.search-result-item {
  display: block;
  padding: var(--space-sm) var(--space-xs);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-base);
}

.search-result-item:hover {
  background: var(--bg-secondary);
}

.result-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: 2px;
}

.result-email {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.search-show-all {
  display: block;
  padding: var(--space-sm) var(--space-xs);
  font-size: var(--text-sm);
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.search-show-all:hover {
  text-decoration: underline;
}

.search-empty {
  padding: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--transition-base);
}

.quick-link:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.ql-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.section-loading,
.section-empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.pending-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
}

.pending-value {
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--danger-bg, #ef4444);
}

.pending-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pending-link {
  font-size: var(--text-sm);
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.pending-link:hover {
  text-decoration: underline;
}

.health-mini {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.health-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.health-dot.green { background: #22c55e; }
.health-dot.yellow { background: #eab308; }
.health-dot.red { background: #ef4444; }

@media (max-width: 1024px) {
  .stat-cards-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stat-cards-row {
    grid-template-columns: 1fr;
  }

  .sections-grid {
    grid-template-columns: 1fr;
  }
}
</style>
